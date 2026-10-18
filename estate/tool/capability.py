"""The business capability map: what the business has code for, or does by hand, per project.

The vocabulary is vocab/facets.toml [business.capability]: 23 values in four bands (sell, grow,
run, own-funds). The run band is exactly the eleven be.framework_domain ids, so business-ecosystem's
own domain packages join it by name. The map is a display field of the Business view, not a
navigation facet: making it one is an owner decision the estate does not take for itself.

Each value carries impl (code, code-unbuilt, stub, manual or unread), an operating claim (in-use,
paused, retired, never or unknown; dated, reviewed = false until Yu reviews it) and serves (self,
customers or both). A capability that is only documented or designed is listed under designed and
never as a value; an idea is never a value. A project in business scope that nothing places is
unassigned, never assumed to have no capability.

business_scope() is the one business population: the Business section of the atlas and this map
both use it, so one atlas never shows two different business populations.
"""
from collections import Counter

UNASSIGNED, NONE = "unassigned", "none"
CURATED_PROJECT, DERIVED_PACKAGES, MIRROR = "curated:project", "derived:packages", "mirror"
SET = "set"
# Business scope (vocab/facets.toml [business.capability].rule). The layers and the purpose groups
# are the Business section's earlier scope; the families, the role and the KINGDOM kind are the
# 2026-10-18 business inventory's. The scope is their union, so neither population shrinks.
BUSINESS_LAYERS = ("commerce", "economy")
BUSINESS_GROUPS = ("business_operations", "payments_finance", "commerce_marketplaces")
BUSINESS_FAMILIES = ("commerce-tcg", "commerce-ventures", "economy-ventures", "business-ecosystem")
BUSINESS_ROLES = ("revenue",)
BUSINESS_KINDS = ("venture",)


def _table(facets):
    return ((facets or {}).get("business") or {}).get("capability") or {}


def values(facets):
    """The capability values vocab/facets.toml defines, in its order (empty when absent)."""
    return tuple(_table(facets).get("values") or {})


def bands(facets):
    """{band: [values]} in the order vocab/facets.toml lists them."""
    return {band: list(members) for band, members in (_table(facets).get("bands") or {}).items()}


def vocabulary(facets, name):
    """The values of one companion vocabulary (capability_impl, capability_operating or
    capability_serves), in order."""
    return tuple((((facets or {}).get("vocab") or {}).get(name) or {}).get("values") or {})


def band_of(facets):
    """{value: band}."""
    return {value: band for band, members in bands(facets).items() for value in members}


# ── the one business population ─────────────────────────────────────────────────────────────

def _candidates(facet):
    """Every value a facet could take: its value, or each candidate of a contested facet. This is
    model.contested_values; model imports this module, so it is restated here, not imported."""
    if facet.get("value") is not None:
        return [facet["value"]]
    if facet.get("status") == "contested":
        return sorted({c["value"] for c in facet.get("candidates") or [] if c.get("value") is not None})
    return []


def business_scope(project):
    """Why a project is in business scope, one reason per rule it meets ([] when it is out of
    scope): its KINGDOM layer (each candidate of a contested layer), its purpose group, its family,
    its roles, its KINGDOM kind."""
    facets = project.get("facets") or {}
    reasons = ["layer " + v for v in _candidates(facets.get("layer") or {}) if v in BUSINESS_LAYERS]
    group = (project.get("display") or {}).get("purpose_group")
    if group in BUSINESS_GROUPS:
        reasons.append("purpose group " + group)
    family = (facets.get("family") or {}).get("value")
    if family in BUSINESS_FAMILIES:
        reasons.append("family " + family)
    reasons += ["role " + v for v in (facets.get("role") or {}).get("values") or [] if v in BUSINESS_ROLES]
    reasons += ["kind " + v for v in _candidates(facets.get("kind") or {}) if v in BUSINESS_KINDS]
    return reasons


def scope_rule():
    """The business scope in one line, for the views."""
    return ("KINGDOM layer %s; purpose group %s; family %s; role %s; KINGDOM kind %s" % (
        " or ".join(BUSINESS_LAYERS), ", ".join(BUSINESS_GROUPS), ", ".join(BUSINESS_FAMILIES),
        " or ".join(BUSINESS_ROLES), " or ".join(BUSINESS_KINDS)))


# ── resolution ──────────────────────────────────────────────────────────────────────────────

def facet(values_, status, basis, src=None, at=None, **extra):
    """The capability display field: the common multi-valued facet shape plus capability_extra
    (vocab/records.toml); extras that are None are left out."""
    out = {"values": list(values_), "status": status, "basis": basis, "src": src, "at": at, "alt": []}
    out.update({k: v for k, v in extra.items() if v is not None})
    return out


def _unplaced(scope):
    if scope:
        return facet([], UNASSIGNED, NONE, scope=scope, by_value={}, designed=[],
                     reason="in business scope (%s), and no curated row or package names a capability"
                            % "; ".join(scope))
    return facet([], NONE, NONE, scope=[], by_value={}, designed=[], reason="outside business scope")


def resolve_projects(projects):
    """Set display["capability"] on every project: unassigned when it is in business scope,
    none otherwise."""
    for pid in sorted(projects):
        project = projects[pid]
        project["display"]["capability"] = _unplaced(business_scope(project))
        project["display_src"]["capability"] = None


def summary(projects, allowed, band_map):
    """What the atlas and `estate capability` say about the map in one build."""
    fields = {pid: (project.get("display") or {}).get("capability") or {} for pid, project in projects.items()}
    by_value = {value: [] for value in allowed}
    for pid, field in sorted(fields.items()):
        for value in field.get("values") or []:
            by_value.setdefault(value, []).append(pid)
    return {"values": list(allowed), "bands": dict(band_map),
            "projects": dict(Counter(f.get("status") or "missing" for f in fields.values())),
            "in_scope": sum(1 for f in fields.values() if f.get("scope")),
            "unassigned": sorted(pid for pid, f in fields.items() if f.get("status") == UNASSIGNED),
            "by_value": by_value}
