"""The symlink tree of one build (spec section 8, amendments A2 and A4).

Each build makes a complete fresh tree inside its own run directory: a foundation axis, eight
navigation axes (the seventh, 7-sphere, is owner decision D4's KINGDOM OS facet; the eighth,
8-capability, is the business capability facet of decision dec-2026-10-20-1), a manifest,
NOT-LINKED.txt and _CONTESTED.txt. Links are absolute, point at a
canonical checkout's realpath (or, for a group, at its canonical location), and each one is
self-checked immediately before it is created: the target must exist, be a directory holding a
.git entry (a group home need only be a directory), and must neither equal nor contain the estate
layer, nor lie inside it. That cycle guard is what keeps the home repository and the host
repository out of the tree. Nothing is created dangling and no directory is named after an
off-enum value or "unknown".

Every write goes through safety.PrivateArea; untree removes trees only through safety's
marker-gated, no-follow deletion. check_tree re-reads each target's identity through GitRunner.
"""
import hashlib
import json
import math
import os
import re
import stat
import tomllib
from collections import Counter

import model
import proposals
import safety


TREE = "tree"
MANIFEST = safety.TREE_MANIFEST
SCHEMA = "estate.tree/1"
README, NOT_LINKED, CONTESTED, SAME_HOME = "README.txt", "NOT-LINKED.txt", "_CONTESTED.txt", "SAME-HOME.txt"
FOUNDATION, LAYER, FAMILY, ROLE, LIVE, NAME, GROUPS, SPHERE, CAPABILITY = (
    "0-foundation", "1-layer", "2-family", "3-role", "4-live", "5-name", "6-groups", "7-sphere", "8-capability")
REALM_ID = "github.com/cambridgetcg/kingdom"
REALM_FILE = "REALM.md"
UNASSIGNED = "unassigned"
# Never a directory or link name: these are statuses, not values.
RESERVED = frozenset(("unknown", "unset"))
# A group home is linked in a layer when at least this share of its reached members land there.
GROUP_LAYER_SHARE = 0.9
# Canonical checkouts in these roles are never link targets (spec 8: no mirrors, worktrees or lanes).
REFUSED_ROLES = ("linked-worktree", "agent-lane", "mirror", "prunable-registration", "gone-during-run")
_UNSAFE = re.compile(r"[^A-Za-z0-9._@-]+")
HAZARD = ("Hazard: tools that follow symlinks fan out from here into the live checkouts: VS Code "
          "search.followSymlinks, grep -R, find -L, du -L, rsync -L, cp -RL. git never descends into "
          "this tree because the private area is ignored twice.")


# ── names and the self-check ────────────────────────────────────────────────────────────────

def sanitize(name):
    """[A-Za-z0-9._@-] only; a leading '.' becomes 'dot-'; never empty."""
    clean = _UNSAFE.sub("-", str(name or "")).strip("-")
    if clean.startswith("."):
        clean = "dot-" + clean[1:]
    return clean or "unnamed"


def _owner(project_id):
    parts = str(project_id).split("/")
    return sanitize(parts[1]) if len(parts) >= 3 and "." in parts[0] else "local"


def _reserved(name):
    # A leading "_" is kept for generated entries (_<group> links, _CONTESTED.txt).
    return name.lower() in RESERVED or name.startswith("_")


def assign_names(projects):
    """{project id: link name}, unique across the whole tree and case-insensitively (APFS):
    colliding or reserved names get @<forge-owner> or @local, and a short hash if still equal."""
    base = {p["id"]: sanitize(p.get("name") or str(p["id"]).rstrip("/").rsplit("/", 1)[-1]) for p in projects}
    counts = Counter(name.lower() for name in base.values())
    names = {pid: ("%s@%s" % (name, _owner(pid)) if counts[name.lower()] > 1 or _reserved(name) else name)
             for pid, name in base.items()}
    again = Counter(name.lower() for name in names.values())
    return {pid: ("%s-%s" % (name, safety.sha12(pid)[:6]) if again[name.lower()] > 1 else name)
            for pid, name in names.items()}




def _lstat(path):
    try:
        return os.lstat(path)
    except OSError:
        return None


def link_problem(target, estate_real, need_git=True):
    """None when target may be linked, else the refusal reason. The cycle guard refuses the
    estate layer itself and every ancestor of it (HOME, the host repository); a target inside
    the layer is refused too, so no link can point into the private area or another tree."""
    if not isinstance(target, str) or not os.path.isabs(target):
        return "target-not-absolute"
    real = os.path.realpath(target)
    try:
        info = os.stat(real)
    except OSError:
        return "target-missing"
    if not stat.S_ISDIR(info.st_mode):
        return "target-not-directory"
    if real == estate_real or estate_real.startswith(real.rstrip(os.sep) + os.sep):
        return "cycle-refused"
    if real.startswith(estate_real + os.sep):
        return "inside-estate"
    if need_git and _lstat(os.path.join(real, ".git")) is None:
        return "no-git-entry"
    return None


_LOCATOR = re.compile(r"[^\s(),;]+")


def group_locator(text):
    """The locator a curated canonical_location starts with; the curation may follow it with a
    note ("<locator> (living homes); ..."). A glob is not a location. A placeholder in the last
    component ("<homes>/citizen-<name>": one home per member) means the directory holding them
    all; a placeholder anywhere else is not a location."""
    if not isinstance(text, str):
        return None
    match = _LOCATOR.match(text.strip())
    if match is None:
        return None
    word = match.group(0)
    head, _sep, last = word.rstrip("/").rpartition("/")
    if any(ch in head for ch in "<>*?[]{}") or any(ch in last for ch in "*?[]{}"):
        return None
    if "<" in last or ">" in last:
        return head if head not in ("", "~") else None
    return word


def expectation(checkout):
    """What check_tree re-reads to prove the path still holds the same repository: the primary
    remote (by name), else the root commit, else only that the path is still a work-tree top."""
    if checkout.get("primary_remote") and checkout.get("primary_remote_name"):
        return {"remote_id": checkout["primary_remote"], "remote": checkout["primary_remote_name"]}
    if checkout.get("root_commit"):
        return {"root_commit": checkout["root_commit"]}
    return {"toplevel": True}


# ── planning ────────────────────────────────────────────────────────────────────────────────

def _facet(record, name):
    return (record.get("facets") or {}).get(name) or {}


def _layers_of(project, layers):
    """Layer dirs a project belongs under: its settled or roster-fallback value, or every
    candidate when contested. Only LAYERS values ever become directories."""
    facet = _facet(project, "layer")
    if facet.get("status") in ("settled", "roster-fallback"):
        values = [facet.get("value")]
    elif facet.get("status") == "contested":
        values = model.contested_values(facet)
    else:
        values = []
    return [v for v in values if v in layers]


def _family(record):
    value = _facet(record, "family").get("value")
    return sanitize(value) if value else None


def _is_live(project, by_id):
    """At least one attributed surface or scheduler observed up (pulse must be readable)."""
    if _facet(project, "running").get("status") == "unknown":
        return False
    for sid in project.get("surfaces") or []:
        surface = by_id.get(sid) or {}
        if (surface.get("source_project") == project["id"]
                and (surface.get("attribution") or {}).get("class") in model.CURRENT
                and (surface.get("health") or {}).get("state") == "up"):
            return True
    for sid in project.get("schedulers") or []:
        health = (by_id.get(sid) or {}).get("health") or {}
        if health.get("state") == "healthy" and not (health.get("caveat") or {}).get("contradicts"):
            return True
    return False


class _Builder:
    """Plans every link of one tree, then creates each after its own self-check."""

    def __init__(self, area, tree_rel, snapshot, home):
        self.area = area
        self.tree_rel = tree_rel
        self.snapshot = snapshot
        self.home = home
        self.estate = area.layer
        self.records = [r for r in snapshot.get("records") or [] if isinstance(r, dict) and r.get("id")
                        and r.get("presence", "present") == "present"]
        self.by_id = {r["id"]: r for r in self.records}
        self.projects = sorted((r for r in self.records if r.get("kind") == "project"), key=lambda r: r["id"])
        self.groups = sorted((r for r in self.records if r.get("kind") == "group"), key=lambda r: r["id"])
        self.layers = [v for v in snapshot.get("layers") or [] if v and v.lower() not in RESERVED]
        self.names = assign_names(self.projects)
        self.plan = []          # {path, target, record_id, checkout_id, expect, axis, need_git}
        self.planned = set()
        self.entries = []       # created links (the manifest entries)
        self.refused = {}       # (record_id, reason) -> {record_id, name, reason, target, axes[]}
        self.contested = {}     # dir relpath -> [(project, groups linked instead)]
        self.same_home = []     # (6-groups name not linked, the name linked to the same home)
        self.dirs = set()
        self.files = {}

    # -- targets --
    def checkout_target(self, project):
        """(target, checkout record, None) or (None, None, reason)."""
        cid = project.get("canonical_checkout")
        if not cid:
            return None, None, "no-checkout" if not (project.get("flags") or {}).get("checkout_present") \
                else "no-canonical-checkout"
        co = self.by_id.get(cid)
        if co is None or co.get("presence", "present") != "present":
            return None, None, "checkout-not-present"
        if co.get("checkout_role") in REFUSED_ROLES or co.get("measure_status") == "gone-during-run":
            return None, None, "checkout-role-%s" % (co.get("checkout_role") or co.get("measure_status"))
        if not co.get("path"):
            return None, None, "checkout-without-path"
        return os.path.realpath(co["path"]), co, None

    def group_target(self, group):
        location = group_locator(group.get("canonical_location"))
        if location is None:
            return None, "group-without-location" if not group.get("canonical_location") else "group-location-unusable"
        try:
            target = os.path.realpath(safety.expand_locator(location, self.home))
        except safety.GuardError:
            return None, "group-location-unusable"
        return target, link_problem(target, self.estate, need_git=False)

    def refuse(self, record_id, reason, target=None, axis=None):
        key = (record_id, reason)
        item = self.refused.setdefault(key, {"record_id": record_id, "name": self.label(record_id),
                                             "reason": reason, "target": target, "axes": []})
        if axis and axis not in item["axes"]:
            item["axes"].append(axis)

    def label(self, record_id):
        record = self.by_id.get(record_id) or {}
        return str(record.get("name") or record.get("label") or record_id)

    def add(self, parts, target, record_id, axis, checkout=None, expect=None, need_git=True):
        if any(not part or part.lower() in RESERVED for part in parts):
            self.refuse(record_id, "reserved-name", target, axis)
            return
        path = "/".join(parts)
        if path in self.planned:
            return
        self.planned.add(path)
        self.plan.append({"path": path, "target": target, "record_id": record_id, "axis": axis,
                          "checkout_id": (checkout or {}).get("id"),
                          "expect": expect if expect is not None else expectation(checkout or {}),
                          "need_git": need_git})

    # -- axes --
    def plan_all(self):
        linkable_groups = self.plan_groups()
        covered = self.collapse(linkable_groups)
        self.plan_foundation()
        for project in self.projects:
            self.plan_project(project, covered.get(project["id"]) or {})
        self.plan_group_layers(linkable_groups)

    def plan_groups(self):
        out, homes = [], {}
        # Where groups share a home, the link takes the name of a group defined by its members
        # (names, forge glob) rather than of a set of copies in one place.
        ordered = sorted(self.groups, key=lambda g: (g.get("member_kind") == "checkout", g["id"]))
        for group in ordered:
            target, problem = self.group_target(group)
            if problem:
                self.refuse(group["id"], problem, target, GROUPS)
                continue
            family = sanitize((group.get("family_id") or "").split(":", 1)[-1]) if group.get("family_id") else UNASSIGNED
            slug = sanitize(group["id"].rsplit("/", 1)[-1])
            group = dict(group, _target=target, _family=family, _slug=slug, _links={})
            out.append(group)
            if group.get("count_now") == 0:
                # A group whose members are all gone (removed worktrees) is history, not a home.
                self.refuse(group["id"], "group-empty", target, GROUPS)
                continue
            name = "%s.%s" % (family, slug)
            if target in homes:
                self.same_home.append((name, homes[target]))
                continue
            homes[target] = name
            self.add([GROUPS, name], target, group["id"], GROUPS, expect={"directory": True}, need_git=False)
        return out

    def _reaches(self, group, project):
        """A member is linked through its group's home only when that home holds its canonical
        checkout, and, for a group of checkouts in one place (a mirror, a snapshot), when the
        canonical checkout is one of them: membership through a copy elsewhere is not enough."""
        target, co, problem = self.checkout_target(project)
        if problem or target is None:
            return False
        if group.get("member_kind") == "checkout" and project.get("canonical_checkout") not in (group.get("members") or []):
            return False
        home = group["_target"]
        return target == home or target.startswith(home.rstrip(os.sep) + os.sep)

    def collapse(self, groups):
        """{project id: {layer: [groups]}}: the layers where a project is reached through a group
        home instead of its own link. A group home goes into a layer only when nearly all its
        collapsed members land there (GROUP_LAYER_SHARE: one contested citizen must not put the
        whole citizens home under economy); members that land elsewhere are linked one by one."""
        covered = {}
        for group in groups:
            members = [self.by_id[p] for p in group.get("member_projects") or [] if p in self.by_id]
            placed = [m for m in members if self._reaches(group, m) and _layers_of(m, self.layers)]
            group["_members"] = placed
            need = max(1, math.ceil(GROUP_LAYER_SHARE * len(placed)))
            union = sorted({v for m in placed for v in _layers_of(m, self.layers)}, key=self.layers.index)
            group["_layers"] = [layer for layer in union
                                if sum(1 for m in placed if layer in _layers_of(m, self.layers)) >= need]
            for member in placed:
                for layer in group["_layers"]:
                    if layer in _layers_of(member, self.layers):
                        covered.setdefault(member["id"], {}).setdefault(layer, []).append(group)
        return covered

    def plan_group_layers(self, groups):
        """One link per group home in each layer it covers. Groups that share a home in the same
        directory share one link, named after the home (A4: _citizens); a lone group's link is
        _<slug>."""
        by_dir = {}
        for group in groups:
            for layer in group.get("_layers") or []:
                key = (layer, group["_family"], group["_target"])
                by_dir.setdefault(key, []).append(group)
        taken = {}
        for (layer, family, target), members in sorted(by_dir.items()):
            name = "_" + (members[0]["_slug"] if len(members) == 1 else sanitize(os.path.basename(target)))
            if taken.get((layer, family, name), target) != target:
                name = "_" + members[0]["_slug"]
            taken[(layer, family, name)] = target
            for group in members:
                group["_links"][layer] = name
            self.add([LAYER, layer, family, name], target, members[0]["id"], LAYER, expect={"directory": True},
                     need_git=False)

    def plan_foundation(self):
        found = self.snapshot.get("foundation") or {}
        kos = found.get("kos_path")
        if kos:
            real = os.path.realpath(kos)
            co = next((c for c in self.records if c.get("kind") == "checkout" and c.get("path")
                       and os.path.realpath(c["path"]) == real), None)
            self.add([FOUNDATION, "kingdom-os"], real, (co or {}).get("project_id") or found.get("remote_id") or "kingdom-os",
                     FOUNDATION, co, expect=expectation(co) if co else {"toplevel": True})
        else:
            self.refuse("kingdom-os", "foundation-not-located", None, FOUNDATION)
        realm = next((p for p in self.projects if p["id"] == REALM_ID or REALM_ID in (p.get("aliases") or [])), None)
        target, co, problem = self.checkout_target(realm) if realm else (None, None, "no-realm-project")
        if target and _lstat(os.path.join(target, REALM_FILE)) is None:
            problem = "no-%s-at-root" % REALM_FILE
        if problem:
            self.refuse(realm["id"] if realm else REALM_ID, problem, target, FOUNDATION)
        else:
            self.add([FOUNDATION, "kingdom-realm"], target, realm["id"], FOUNDATION, co)

    def plan_project(self, project, covered):
        pid, name = project["id"], self.names[project["id"]]
        target, co, problem = self.checkout_target(project)
        layers = _layers_of(project, self.layers)
        family = _family(project)
        status = _facet(project, "layer").get("status")
        if status == "contested":
            for layer in layers:
                for where in ("/".join((LAYER, layer)), "/".join((LAYER, layer, family or UNASSIGNED))):
                    self.contested.setdefault(where, []).append((project, covered.get(layer) or []))
        if problem:
            self.refuse(pid, problem, None, None)
            return
        for layer in layers:
            if not covered.get(layer):
                self.add([LAYER, layer, family or UNASSIGNED, name], target, pid, LAYER, co)
        if family:
            self.add([FAMILY, family, name], target, pid, FAMILY, co)
        for role in _facet(project, "role").get("values") or []:
            self.add([ROLE, sanitize(role), name], target, pid, ROLE, co)
        if _is_live(project, self.by_id):
            self.add([LIVE, name], target, pid, LIVE, co)
        self.add([NAME, name], target, pid, NAME, co)
        value = _facet(project, "sphere").get("value")
        if value:
            self.add([SPHERE, sanitize(value), family or UNASSIGNED, name], target, pid, SPHERE, co)
        # Every capability a project holds; a project in business scope that nothing places is linked
        # under unassigned, so it can be reviewed. A project outside business scope is not linked here.
        capability = _facet(project, "capability")
        for value in capability.get("values") or ([UNASSIGNED] if capability.get("status") == UNASSIGNED else []):
            self.add([CAPABILITY, sanitize(value), family or UNASSIGNED, name], target, pid, CAPABILITY, co)

    # -- creation --
    def create(self):
        for item in self.plan:
            problem = link_problem(item["target"], self.estate, need_git=item["need_git"])
            if problem:
                self.refuse(item["record_id"], problem, item["target"], item["axis"])
                continue
            target = os.path.realpath(item["target"])
            parent = item["path"].rsplit("/", 1)[0]
            self.mkdir(parent)
            self.area.symlink("/".join((self.tree_rel, item["path"])), target)
            self.entries.append({"path": item["path"], "target": target, "record_id": item["record_id"],
                                 "checkout_id": item["checkout_id"], "expect": item["expect"], "axis": item["axis"]})

    def mkdir(self, relpath):
        parts = relpath.split("/")
        for index in range(1, len(parts) + 1):
            self.dirs.add("/".join(parts[:index]))
        self.area.mkdir("/".join((self.tree_rel, relpath)))

    def write(self, relpath, body):
        if "/" in relpath:
            self.mkdir(relpath.rsplit("/", 1)[0])
        data = body.encode("utf-8")
        self.area.write("/".join((self.tree_rel, relpath)), data, 0o600)
        self.files[relpath] = hashlib.sha256(data).hexdigest()


# ── generated text files ────────────────────────────────────────────────────────────────────

def _worst(snapshot):
    worst = snapshot.get("worst_source") or {}
    if not worst:
        return "unknown (no configured source entry)"
    return "%s %s (age %s s)" % (worst.get("id"), worst.get("freshness"), worst.get("age_s"))


def readme_text(run_id, snapshot, layers):
    return "\n".join([
        "ESTATE TREE - run %s" % run_id,
        "",
        "Generated by `estate build`; never hand-edit. `estate untree` removes every tree.",
        "Worst source: %s" % _worst(snapshot),
        "",
        "Axes:",
        "  %-13s the checkouts KINGDOM's taxonomy is read from (see its README.txt)" % FOUNDATION,
        "  %-13s <layer>/<family>/<name>, layers in LAYERS order: %s" % (LAYER, " ".join(layers)),
        "  %-13s a contested record is linked under every candidate layer, beside _CONTESTED.txt;" % "",
        "  %-13s a group home that holds its members' canonical checkouts is linked once, as" % "",
        "  %-13s _<group> (or _<home> when groups share it), in each layer all its members land in;" % "",
        "  %-13s anywhere else those members are linked one by one" % "",
        "  %-13s <family>/<name>" % FAMILY,
        "  %-13s <role>/<name> (a record with two roles appears in both)" % ROLE,
        "  %-13s records with an attributed surface or scheduler observed up" % LIVE,
        "  %-13s every project with a present canonical checkout" % NAME,
        "  %-13s <family>.<group>, one link per group home (empty groups left out; groups sharing a" % GROUPS,
        "  %-13s home are listed in SAME-HOME.txt)" % "",
        "  %-13s <sphere>/<family>/<name>: kingdom-os, independent or undecided, the KINGDOM OS" % SPHERE,
        "  %-13s facet of owner decision D4 (each project once; undecided is listed for Yu)" % "",
        "  %-13s <capability>/<family>/<name>: the business capability facet of decision" % CAPABILITY,
        "  %-13s dec-2026-10-20-1 (a project under every value it holds; unassigned: in business" % "",
        "  %-13s scope and placed by nothing; projects outside business scope are not linked here)" % "",
        "",
        "Links are absolute and point at canonical checkouts only. NOT-LINKED.txt lists every",
        "record without a link and why; .estate-tree.json is the manifest `estate check --tree` reads.",
        "",
        HAZARD,
        "",
    ])


def foundation_text(snapshot):
    ref = snapshot.get("ref") or "unknown"
    data = ((snapshot.get("foundation") or {}).get("refs") or {}).get(ref) or {}
    authority = snapshot.get("authority") or {}
    decided = []
    if authority.get("basis") == "decision" and authority.get("ref") == ref:
        # The link reaches the checkout's files, which are its worktree: say which one the map follows.
        decided = ["               (the taxonomy authority, owner decision %s; the files behind this link are"
                   % authority.get("decision"),
                   "               the worktree, shown for drift only)"]
    return "\n".join([
        "0-foundation - the SOURCE of KINGDOM's taxonomy, not an extra layer",
        "",
        "kingdom-os     the located kingdom-os checkout; CARD_ENUMS and LAYERS were read from its",
        "               %s ref at commit %s" % (ref, data.get("commit") or "unknown")] + decided + [
        "kingdom-realm  the checkout of %s whose root holds %s (when present)" % (REALM_ID, REALM_FILE),
        "",
        "LAYERS order: %s" % " ".join(snapshot.get("layers") or []),
        "os is an ordinary layer directory under 1-layer/, never a value of this axis.",
        "",
    ])


def not_linked_text(run_id, builder):
    sections = {"no-checkout": [], "cycle-refused": [], "other": [], "placement": []}
    for item in sorted(builder.refused.values(), key=lambda i: (i["reason"], i["name"].lower(), i["record_id"])):
        key = item["reason"] if item["reason"] in ("no-checkout", "cycle-refused") else "other"
        sections[key].append(item)
    for project in builder.projects:
        status = _facet(project, "layer").get("status")
        if status in ("off-enum-only", "unset"):
            props = [p for p in project.get("proposals") or [] if proposals.rule_of(p) in ("P01", "P03")]
            sections["placement"].append("%s  (%s)  layer %s  %s" % (
                builder.names[project["id"]], project["id"], status, " ".join(props) or "no P01/P03 proposal"))

    def line(item):
        target = (" -> " + item["target"]) if item.get("target") else ""
        axes = (" [%s]" % ", ".join(item["axes"])) if item["axes"] else ""
        return "%s  (%s)%s: %s%s" % (item["name"], item["record_id"], target, item["reason"], axes)

    out = ["NOT-LINKED - run %s" % run_id, "", "Records and groups without a link in this tree, and why. Generated; never hand-edit.", ""]
    for title, key in (("no checkout on this machine (forge-only or curated only)", "no-checkout"),
                       ("cycle-refused (the target is the estate layer or one of its ancestors)", "cycle-refused"),
                       ("missing or refused targets", "other"),
                       ("off-enum-only and unset layers (not placed under 1-layer; by proposal id)", "placement")):
        items = sections[key]
        out.append("== %s: %d" % (title, len(items)))
        out += [item if isinstance(item, str) else line(item) for item in items] or ["(none)"]
        out.append("")
    return "\n".join(out)


def same_home_text(run_id, pairs):
    out = ["SAME HOME - run %s" % run_id, "",
           "Groups whose home is the same directory as another group's get no link of their own:", ""]
    out += ["%s -> see %s" % pair for pair in sorted(pairs)]
    out.append("")
    return "\n".join(out)


def contested_text(where, items, snapshot, builder):
    layer = where.split("/")[1]
    out = ["CONTESTED - %s is one candidate layer for these records (ref %s)" % (layer, snapshot.get("ref") or "unknown"),
           "",
           "KINGDOM has not settled their layer, so they are linked under every candidate layer.",
           "This tree does not settle it either; the decision is a P10 proposal (estate proposals --rule P10).",
           ""]
    groups = {}
    for project, linked_groups in sorted(items, key=lambda i: i[0]["id"]):
        facet = _facet(project, "layer")
        claims = "; ".join("%s <- %s @%s" % (c.get("value"), c.get("source"), c.get("ref"))
                           for c in facet.get("candidates") or [])
        p10 = [p for p in project.get("proposals") or [] if proposals.rule_of(p) == "P10"]
        out.append("%s  (%s)  %s  %s" % (builder.names[project["id"]], project["id"], claims, " ".join(p10) or "no P10 yet"))
        for group in linked_groups:
            groups.setdefault(group["id"], group)
    if groups:
        out += ["", "Linked here as a group home instead of member by member:"]
        out += ["  %s -> %s (%s)" % (g["_links"].get(layer, "_" + g["_slug"]), g.get("label") or g["id"], g["id"])
                for g in groups.values()]
    out.append("")
    return "\n".join(out)


# ── build, diff, read ───────────────────────────────────────────────────────────────────────

def _tree_location(run_dir, layer_dir):
    area = safety.PrivateArea(layer_dir)
    run_rel, name = safety.require_run_dir(area, run_dir)
    safety.require(_lstat(os.path.join(os.path.realpath(run_dir), TREE)) is None, "refusing: this run already has a tree")
    return area, "/".join((run_rel, TREE)), name


def build_tree(run_dir, records, layer_dir, prev_manifest=None, home=None):
    """Build <run_dir>/tree. records: the snapshot of model.build_records() (with proposals
    filled in) or a bare record list; layer_dir: the estate layer (its realpath is the cycle
    guard); prev_manifest: the previous tree's manifest (read_manifest) for the diff.
    Returns {tree_dir, links, refused[], not_linked{}, diff, manifest}."""
    snapshot = {"records": records} if isinstance(records, list) else records
    area, tree_rel, run_id = _tree_location(run_dir, layer_dir)
    builder = _Builder(area, tree_rel, snapshot, os.environ.get("HOME", "") if home is None else home)
    area.mkdir(tree_rel)
    builder.plan_all()
    builder.create()
    builder.write(README, readme_text(run_id, snapshot, builder.layers))
    builder.write("/".join((FOUNDATION, README)), foundation_text(snapshot))
    builder.write(NOT_LINKED, not_linked_text(run_id, builder))
    for where, items in sorted(builder.contested.items()):
        builder.write("/".join((where, CONTESTED)), contested_text(where, items, snapshot, builder))
    if builder.same_home:
        builder.write("/".join((GROUPS, SAME_HOME)), same_home_text(run_id, builder.same_home))
    refused = sorted(builder.refused.values(), key=lambda i: (i["reason"], i["record_id"]))
    manifest = {"schema": SCHEMA, "run_id": run_id, "estate": area.layer, "observed_at": snapshot.get("observed_at"),
                "entries": sorted(builder.entries, key=lambda e: e["path"]), "refused": refused,
                "dirs": sorted(builder.dirs), "files": dict(sorted(builder.files.items()))}
    area.write("/".join((tree_rel, MANIFEST)), json.dumps(manifest, indent=1, sort_keys=True) + "\n", 0o600)
    return {"tree_dir": area.path(tree_rel), "links": len(builder.entries), "refused": refused,
            "not_linked": dict(Counter(i["reason"] for i in refused)), "diff": diff_manifests(prev_manifest, manifest),
            "manifest": manifest}


def diff_manifests(prev, current):
    """DRIFT section 4 for the tree: links added, removed and retargeted by path, and refusals
    that are new since the previous manifest. baseline is False when there is none to compare."""
    if not isinstance(prev, dict) or not isinstance(prev.get("entries"), list):
        return {"baseline": False, "added": [], "removed": [], "retargeted": [], "refused": []}
    before = {e.get("path"): e.get("target") for e in prev["entries"] if isinstance(e, dict)}
    after = {e["path"]: e["target"] for e in current["entries"]}
    old_refused = {(r.get("record_id"), r.get("reason")) for r in prev.get("refused") or [] if isinstance(r, dict)}
    return {"baseline": True,
            "added": sorted(p for p in after if p not in before),
            "removed": sorted(p for p in before if p not in after),
            "retargeted": [{"path": p, "from": before[p], "to": after[p]} for p in sorted(after)
                           if p in before and before[p] != after[p]],
            "refused": [r for r in current["refused"] if (r["record_id"], r["reason"]) not in old_refused]}


def read_manifest(tree_dir):
    """(manifest, None) or (None, reason) for a tree dir (private/tree or a run's tree)."""
    raw, reason = safety.read_checked(os.path.join(os.path.realpath(tree_dir), MANIFEST), 32 << 20)
    if raw is None:
        return None, reason
    try:
        data = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, ValueError) as exc:
        return None, "invalid manifest: %s" % exc
    if not isinstance(data, dict) or data.get("schema") != SCHEMA or not isinstance(data.get("entries"), list):
        return None, "unsupported manifest schema"
    return data, None


# ── check ───────────────────────────────────────────────────────────────────────────────────

def _identity(entry):
    """(category, detail) when the target no longer holds the expected repository, else None."""
    target, expect = entry["target"], entry.get("expect") or {}
    if expect.get("directory"):
        return None if os.path.isdir(target) else ("broken", "group home is not a directory")
    git = safety.GitRunner(target)
    top = git.toplevel_check()
    if not top["ok"]:
        if top["reason"] == "gone":
            return "broken", "target vanished"
        if top["reason"] == "timeout":
            return "unverified", "git timed out"
        return "mismatched", "no longer this work tree (%s)" % top["reason"]
    if "remote_id" in expect:
        res = git.run("config", "--get", "remote.%s.url" % expect.get("remote"))
        if res.timed_out or res.code not in (0, 1):
            return "unverified", "remote url unreadable (%s)" % (res.err.strip() or res.code)
        found = safety.normalize_remote(res.out.strip()) if res.ok else None
        if found != expect["remote_id"]:
            return "mismatched", "remote %s is now %s, expected %s" % (expect.get("remote"), found, expect["remote_id"])
        return None
    if "root_commit" in expect:
        res = git.run("rev-list", "--max-parents=0", "HEAD")
        if res.timed_out:
            return "unverified", "git timed out"
        if not res.ok or expect["root_commit"] not in res.out.split():
            return "mismatched", "root commit %s not found" % expect["root_commit"][:12]
    return None


def _walk(tree_real):
    """Every path under the tree, relative, without following any link."""
    found = {}
    pending = [""]
    while pending:
        rel = pending.pop()
        with os.scandir(os.path.join(tree_real, rel) if rel else tree_real) as entries:
            for entry in entries:
                path = "/".join((rel, entry.name)) if rel else entry.name
                if entry.is_symlink():
                    found[path] = "link"
                elif entry.is_dir(follow_symlinks=False):
                    found[path] = "dir"
                    pending.append(path)
                else:
                    found[path] = "file"
    return found


def check_tree(tree_dir):
    """Compare the live tree with its manifest (spec 8 rot handling). Reports broken (target
    gone), mismatched (retargeted link, replaced entry, modified file, or a path now holding a
    different repository), missing, extra (hand-added) and unverified entries; exit is 1 on any
    of them, 0 only when everything was verified."""
    report = {"ok": False, "exit": 1, "tree": None, "checked": 0, "broken": [], "mismatched": [], "missing": [],
              "extra": [], "unverified": [], "errors": []}
    tree_real = os.path.realpath(tree_dir)
    report["tree"] = tree_real
    manifest, reason = read_manifest(tree_real)
    if manifest is None:
        report["errors"].append("manifest unreadable: %s" % reason)
        return report
    try:
        found = _walk(tree_real)
    except OSError as exc:
        report["errors"].append("cannot walk tree: %s" % exc)
        return report
    verified = {}
    for entry in manifest["entries"]:
        path = entry.get("path")
        report["checked"] += 1
        kind = found.get(path)
        if kind is None:
            report["missing"].append({"path": path})
            continue
        if kind != "link":
            report["mismatched"].append({"path": path, "detail": "replaced by a %s" % kind})
            continue
        dest = os.readlink(os.path.join(tree_real, path))
        if dest != entry.get("target"):
            report["mismatched"].append({"path": path, "detail": "retargeted to %s" % dest})
            continue
        if not os.path.exists(dest):
            report["broken"].append({"path": path, "detail": "target missing"})
            continue
        key = (dest, json.dumps(entry.get("expect"), sort_keys=True))
        if key not in verified:
            verified[key] = _identity(entry)
        if verified[key]:
            category, detail = verified[key]
            report[category].append({"path": path, "detail": detail})
    for path, digest in (manifest.get("files") or {}).items():
        raw, why = safety.read_checked(os.path.join(tree_real, path), 16 << 20)
        if raw is None:
            report["missing" if why == "missing" else "mismatched"].append({"path": path, "detail": why})
        elif hashlib.sha256(raw).hexdigest() != digest:
            report["mismatched"].append({"path": path, "detail": "file modified"})
    expected = {e.get("path") for e in manifest["entries"]} | set(manifest.get("dirs") or []) \
        | set(manifest.get("files") or {}) | {MANIFEST}
    report["extra"] = [{"path": p, "detail": "hand-added %s" % kind} for p, kind in sorted(found.items())
                       if p not in expected]
    report["ok"] = not any(report[k] for k in ("broken", "mismatched", "missing", "extra", "unverified", "errors"))
    report["exit"] = 0 if report["ok"] else 1
    return report


# ── untree ──────────────────────────────────────────────────────────────────────────────────

def _tree_disabled(text):
    """config.toml text with [tree] enabled = false, comments and other tables kept as written."""
    lines = text.splitlines()
    header = next((i for i, line in enumerate(lines) if line.strip() == "[tree]"), None)
    if header is None:
        return (text.rstrip("\n") + "\n\n" if text.strip() else "") + "[tree]\nenabled = false\n"
    end = next((i for i in range(header + 1, len(lines)) if lines[i].lstrip().startswith("[")), len(lines))
    for index in range(header + 1, end):
        if re.match(r"\s*enabled\s*=", lines[index]):
            lines[index] = "enabled = false"
            break
    else:
        lines.insert(header + 1, "enabled = false")
    return "\n".join(lines) + "\n"


def disable_in_config(area):
    """Set [tree].enabled=false in private/config.toml (created if absent). The edit is verified
    with tomllib before it replaces the file; a config it cannot edit safely is refused."""
    raw, reason = safety.read_checked(area.path("config.toml"), 1 << 20)
    if raw is None and reason != "missing":
        raise safety.GuardError("config.toml unreadable: %s" % reason)
    old = raw.decode("utf-8") if raw is not None else ""
    new = _tree_disabled(old)
    try:
        parsed = tomllib.loads(new)
    except tomllib.TOMLDecodeError as exc:
        raise safety.GuardError("cannot set [tree].enabled in config.toml automatically (%s); edit it by hand" % exc)
    safety.require((parsed.get("tree") or {}).get("enabled") is False, "config.toml edit did not disable the tree")
    if new == old:
        return "unchanged"
    area.replace("config.toml", new)
    return "disabled"


def untree(private_dir, layer_dir=None):
    """Disable the tree in config.toml, remove tree/ from every marked run (marker and manifest
    gated, lstat and unlink only), then the private/tree link and the layer-root tree link.
    Returns {ok, config, runs{run id: counts}, refused[], private_link, root_link}."""
    private_real = os.path.realpath(private_dir)
    area = safety.PrivateArea(layer_dir or os.path.dirname(private_real))
    safety.require(private_real == area.root, "untree needs the private area itself: %s" % private_dir)
    report = {"ok": False, "config": disable_in_config(area), "runs": {}, "refused": [],
              "private_link": None, "root_link": None}
    runs = os.path.join(area.root, "runs")
    names = sorted(os.listdir(runs)) if os.path.isdir(runs) and not os.path.islink(runs) else []
    for name in names:
        if safety.RUN_ID.fullmatch(name) is None:
            continue
        run_dir = os.path.join(runs, name)
        try:
            report["runs"][name] = safety.remove_tree_dir(os.path.join(run_dir, TREE), run_dir)
        except (safety.GuardError, OSError) as exc:
            report["refused"].append({"run": name, "reason": str(exc)})
    report["private_link"] = area.remove_link(TREE)
    report["root_link"] = area.remove_root_link(TREE)
    report["ok"] = not report["refused"]
    return report
