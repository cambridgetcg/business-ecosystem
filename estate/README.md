# estate

A read-only, KINGDOM-first map of the whole estate, kept inside business-ecosystem as an overlay.
Nothing in the estate moves. Every repository stays where its launchd jobs, hooks, worktrees,
object alternates and sessions expect it. This directory reads; it writes only under its own
`private/` directory and two git-ignored links beside it.

The front door is `estate/atlas.html`, a link to the newest atlas. It appears after the first
build.

The overlay is not a KINGDOM member and carries no `kingdom.yaml`. It is a deletable projection:
removing `estate/` leaves every other repository exactly as it was.

## KINGDOM first

KINGDOM is the primary axis. The card vocabularies (`layer`, `kind`, `state`, `owner_sister`,
`domain`) and the layer order are read live from kingdom-os `bin/harvest.ts` on every run, from
both the worktree and `origin/main`. They are never copied into this directory and never
extended. `vocab/kingdom.lock.toml` holds integrity hashes only. When kingdom-os changes, the live
values win, the build reports the drift, and the lock moves only through
`estate/bin/estate accept-vocab --write`.

The taxonomy authority is `origin/main` (GitHub `cambridgetcg/kingdom-os`), by owner decision
`dec-2026-10-17-2`. KINGDOM facets resolve on it and layer labels come from its ARCHITECTURE box
(the commerce layer reads PROJECTS). The worktree is still read, for drift only: where it differs,
the value follows `origin/main`, the facet keeps `ref_divergent` and `by_ref`, DRIFT section 2 lists
it, and one kingdom-os proposal (P17) asks to reconcile local main with `origin/main`. The estate
never fetches, so `origin/main` is as fresh as kingdom-os's last fetch; the atlas shows that age.

Where a card, the roster, REGISTRY or a measurement disagree, the overlay edits nothing. It writes
a proposals queue (`PROPOSALS.md`) that each owner applies, defers or declines in their own
repository, after claiming the paths through agenttool-collab.

## Layout

- `bin/estate`: the command. A POSIX sh shim that picks Python 3.11 or newer (the system
  `python3` on macOS is 3.9) and runs the tool isolated and without bytecode.
- `tool/`: standard-library Python, one module per concern. `tool/safety.py` holds every guard:
  the git allowlist, the guarded reader, the private writer, the run lock and the deletion gates.
  `tool/decisions.py` reads the owner decisions a build applies; `tool/sphere.py` holds the KINGDOM OS
  sphere facet; `tool/hygiene.py` holds the D8 hygiene plan and its join with a run; `tool/capability.py`
  holds the business capability map and the one business scope the Business view uses; `tool/packages.py`
  holds the package records of the host repositories the map reads.
- `vocab/`: the record contract ([`vocab/records.toml`](vocab/records.toml), the single source for
  every record's fields and privacy class), the facet registry, the raw-tag map and the KINGDOM
  integrity lock.
- `curated/`: hand-curated, scrubbed knowledge keyed by forge id, plus owner decisions.
- `tests/`: a unittest suite over synthetic estates built in temporary directories.
- `private/`: everything measured, generated or risk-bearing. Never committed. Its `README.txt`
  (kept current by every build) says which parts are persistent and which are disposable.

## Run, check, browse

```sh
estate/bin/estate build                   # measure, join, render and seal a new run
estate/bin/estate build --full            # walk every root at unlimited depth (automatic after 7 days)
estate/bin/estate build --reuse-census    # re-read KINGDOM and sources against the last census
estate/bin/estate build --no-tree         # this run without the symlink tree
estate/bin/estate build --forge           # also list forge repos and read wires' workflow runs (the only network use)
estate/bin/estate check                   # verify the current run: checksums, age, stale sources
estate/bin/estate check --tree            # compare the symlink tree with its manifest
estate/bin/estate check --vocab           # tag-map closure against facets.toml and the live enums
estate/bin/estate check --commit-ready    # privacy lint and host checks before a commit
estate/bin/estate check --verify-harvest  # the authority ref's harvest validate/conformance vs the mirror
estate/bin/estate check --wires           # curated wires against measurement: 1 if a wired claim has no code
estate/bin/estate show <query>            # one record, claims beside measurements
estate/bin/estate ls --facet layer=soul   # records by facet
estate/bin/estate ls --facet sphere=kingdom-os   # the members of KINGDOM OS (D4): projects, zones, surfaces
estate/bin/estate ls --kind zone --facet sphere=kingdom-os   # the Cloudflare domains (and other zones) among them
estate/bin/estate proposals               # the KINGDOM proposals queue
estate/bin/estate proposals --decide ID --as declined|deferred|accepted --reason TEXT --write
estate/bin/estate decisions               # the owner decisions and how a build applies them
estate/bin/estate decisions --sync-config --write    # align config.toml [kingdom].ref with them
estate/bin/estate decisions --words-from ABS_PATH --for ID[,ID...] --write   # keep the owner's words
estate/bin/estate decisions --private-from ABS_PATH --write   # private refinements: [[open]] and [[note]] rows
estate/bin/estate accept-vocab --reviewed-harvest SHA256 --write   # record a hand review of harvest.ts
estate/bin/estate sphere                  # the sphere facet of the current run: counts and the undecided list
estate/bin/estate sphere --import ABS_PATH --write   # write a sphere classification into the curation
estate/bin/estate capability              # the business capability map: counts by band, unassigned, rows to review
estate/bin/estate capability --import ABS_PATH --write   # merge a classification into curated/capabilities.toml
estate/bin/estate ls --kind package       # the packages of the host repositories ([[host]] rows)
estate/bin/estate hygiene                 # the hygiene plan (D8), joined with the current run
estate/bin/estate hygiene --severity P0 --status open   # filters: --wave, --severity, --status, --area
estate/bin/estate hygiene --needs-yu      # the items the plan marks as needing Yu (also --agent-safe)
estate/bin/estate hygiene --import ABS_PATH --write    # merge an estate.hygiene/1 plan by item id
estate/bin/estate hygiene --set ID --status done --note TEXT --write   # record the owner's status of one item
estate/bin/estate untree                  # remove the symlink tree and stop building it
```

`check --verify-harvest` runs only the read-only verbs of the harvest.ts the lock records as reviewed
(`accept-vocab --reviewed-harvest`), on the authority ref: `origin/main` is never checked out, so its
`bin/harvest.ts` and `roster.conf` blobs are written to a private scratch directory, run from an empty
working directory, and removed.

`--decide` records an owner decision in `curated/decisions.toml` (committed: the reason must pass
the privacy lint); without `--write` it only prints the diff. ID is a proposal id or a bulk key.

## Owner decisions

`curated/decisions.toml` also holds owner decisions (`kind = "owner-decision"`, D1 to D8 of
2026-10-17). Each names what it `resolves` (question and dispute ids), what was decided per id
(`outcome`), what stays open (`open`, `stays_open`, `pending`) and a small `effects` table. A build
applies them (`tool/decisions.py`) instead of rewriting any curation, so the private curation keeps
its single copy untouched and a status lives in one place: resolved questions and disputes become
`decided` or `partly-decided` (only the open remainder stays in Questions for Yu), the atlas gains a
Decided section, and proposals whose subject a decision settled are carried as `superseded` with
that decision as `decision_ref`, beside the follow-up it calls for (P17). Effects this version
applies: `taxonomy_ref` (the primary ref), `layer_overrule`/`layer_default` (harvest's forced fleet no
longer contests a citizen's soul card; soul when a card has none; a card naming another layer stays
contested and is listed for Yu), `ownership` (surfaces and zones on the
estate's own provider account), `provider_status` (AWS: in-progress-elsewhere; the estate makes no AWS
calls), `sphere_by_layer` (the layer rule of the sphere facet, below), `hygiene_view` (the hygiene plan
renders on every build, below), `confirms` and `status_note`. Any other
effect key is listed as not applied.

An owner decision on the taxonomy authority outranks `private/config.toml [kingdom].ref`, which
applies only when no such decision exists. A config pin that contradicts the decision degrades the
run with a reason (the decision is still followed) until `decisions --sync-config --write` aligns it,
keeping the old file as a new 0400 `config.toml.bak-<time>`. The owner's verbatim words behind the
decisions live only in `private/curated/decisions.toml` (`decisions --words-from`), shown in the
private atlas; the committed file paraphrases them. The same private file holds what the committed
text only points at (`decisions --private-from`): an `[[open]]` row refines the remainder a decision
leaves open (the private views show it instead of the neutral committed words), and a `[[note]]` row
names, for instance, the coordination task carrying a decision out.

Commands are shown from the business-ecosystem root. A build needs no TTY, so it runs the same by
hand or from an agent session. It is never scheduled: macOS privacy controls stop scheduled jobs
from reading under the Desktop folder, and a quietly failing job is worse than none.

`estate/atlas.html` opens over `file://` and makes no network requests. A build writes, all under
`private/`:

- `private/ATLAS.html` (reached as `estate/atlas.html`) and `private/ATLAS.md`, the atlas;
- `private/current/` (the newest run): `PROPOSALS.md`, `DRIFT.md`, `QUEUE.md`, `ATTENTION.md`,
  `HYGIENE.md`, `CAPABILITIES.md`, `portfolio-join.json`, `records.jsonl`, `proposals.jsonl`, `run.json` and
  `SHA256SUMS`;
- `private/tree` (reached as `estate/tree`), the symlink tree of canonical checkouts.

The tree has eight axes: `0-foundation` (the kingdom-os and REALM checkouts the taxonomy is read
from), `1-layer/<layer>/<family>` (contested records under every candidate layer, beside
`_CONTESTED.txt`), `2-family`, `3-role`, `4-live` (records with an attributed surface or scheduler
observed up), `5-name`, `6-groups` (one link per group home), and `7-sphere/<sphere>/<family>` (each
project once, under kingdom-os, independent or undecided). `NOT-LINKED.txt` says why a record has no link.

The design spec the code comments cite ("spec 6.8", "A4") is kept with the survey copy, in
`private/curated/survey-2026-10-17/design/SPEC.md`.

Tests run with:

```sh
python3 -I -B -m unittest discover -s estate/tests -t estate
```

## KINGDOM OS: the sphere facet

Owner decision `dec-2026-10-17-5` (D4) says KINGDOM OS is the civilisation, not one repository: every
civilisation-related repository and several Cloudflare domains belong to it. The navigation facet `sphere`
says so per project, zone and surface: `kingdom-os` (part of the civilisation), `independent` (independent
tools, existing services and businesses, origin/main's PROJECTS label) or `undecided` (evidence mixed or
absent, listed for Yu with the reason). Every value names its basis and the decision.

A project takes its curated assignment (under its id or an alias), else the sphere of the one project it is
a `mirror_of` or `copy_of`, else its family default when that is kingdom-os or independent (a family default
of undecided presumes nothing), else the sphere its KINGDOM layer on the authority ref maps to under the
decision's `sphere_by_layer`, else undecided. A zone takes its curated assignment, else its owner project's
sphere; a surface its curated assignment, else its source project's. A curated zone or surface row may
say `follows = <record id>`, and then takes that record's sphere on every build, so it cannot go stale; a
curated row that differs from its owner or source project is listed in QUEUE (`sphere-follow-mismatch`)
and stands until Yu reviews it. Third-party code the estate holds but
does not own is undecided with `third_party`, since D4 names no sphere for it; third-party apexes (github.com,
codeberg.org) are not estate zones.

The assignments come from an evidence-backed classification (`reviewed = false` until Yu reviews it) and sit
where the curation keeps per-record knowledge: `[family.sphere]` in `curated/families/<family>.toml`, a
project's own `sphere` on its `[[project]]` row, `[[sphere]]` rows in `curated/estate.toml` for zones,
surfaces and projects without a curated row, and local ids plus the full evidence of every row in
`private/curated/sphere.toml` (0600, one copy). `estate sphere --import ABS_PATH` prints the committed diff
and writes only with `--write`; it inserts the rows exactly where `import-survey` renders them, and
`import-survey` (even with `--overwrite`) carries them forward, so a re-import changes no byte. The atlas
shows a KINGDOM OS section after §0 Foundation (sphere × layer, the zones and their surfaces by sphere, and
the undecided list for Yu); proposals carry their subject's sphere, and the estate lists the roster- and REGISTRY-absent rules
(P09, P12) for members of KINGDOM OS or surfaces in a KINGDOM OS zone ahead of the same rule for others: an
ordering of the estate's own, not part of D4. A citizen's roster row is not raised, because harvest's own
discovery (P17, the follow-up of D2) is the route for citizens.

## Business: the capability map

The Business view says what the business has code for, or does by hand, with 23 capabilities in four
bands (`vocab/facets.toml [business.capability]`): sell, grow, run (exactly the eleven `be.framework_domain`
ids, so business-ecosystem's own domain packages join by name) and own funds. It is a display field of the
Business view, not a navigation facet: only an owner decision makes it one. One business population serves
the whole view (`capability.business_scope`): a KINGDOM layer commerce or economy, a business purpose group,
a commerce, economy or business-ecosystem family, the role revenue, or the KINGDOM kind venture.

Each value carries `impl` (code, code-unbuilt, stub, manual or unread), an `operating` claim (in-use,
paused, retired, never or unknown, as of its row) and `serves` (self, customers or both). A capability that
is only documented or designed is listed under `designed`, never as a value; an idea is never a value. A
project takes its curated row (under its id or an alias), else the values of the one project it mirrors,
else `unassigned` when it is in business scope and `none` outside it. business-ecosystem's own packages give
it its values from code, not from a curated row.

Packages are records of their own, `pkg:<forge id>//<subpath>`, for the repositories a `[[host]]` row of
`curated/capabilities.toml` opts in (business-ecosystem only, so far). The canonical checkout's tracked
manifests name them (`sources.read_packages`), every file is read through the deny list, and each package
carries its lines of code, test files, declared against imported internal dependencies and static problems.
A package takes its curated row (a `[[capability]]` row keyed by its package id), else the run-band value
its directory names (`rule:package-path`: business-ecosystem's domain packages are named after their
framework domain), else none; a host project with no row of its own takes the union of its packages that
have code (`derived:packages`). Build state comes from the tracked quarantine list the host row names
(`ci/quarantine.json`): a task is `quarantined` when listed, `gated` when CI runs it and `not-run`
otherwise, read as the list at the checkout's HEAD, which is the contract CI enforces there. An entry's
`measured_at` is the earlier commit its error count was measured at, shown as dated evidence with its
distance from HEAD and never compared with HEAD. When the list cannot be read as HEAD's (missing,
untracked, or the checkout not measured clean) every task is `not-measured`. A package whose build or
typecheck is quarantined reads `code-unbuilt`. The estate runs no build: `gated` is CI's contract, not an
observed run.

Whole repositories are curated in `curated/capabilities.toml`, one `[[capability]]` row per forge id,
`reviewed = false` until Yu reviews it. `estate capability --import ABS_PATH` prints the diff and writes
only with `--write`; it merges by id, keeps every row with `reviewed = true` unless `--replace-reviewed ID`
names it, keeps rows the import leaves out, and puts local ids and the full evidence of every row in
`private/curated/capability.toml` (0600, one copy). QUEUE lists `capability-unassigned` (in scope, nothing
places it), `capability-candidate` (a run-band value `be.framework_domain` names that the project neither
holds nor lists as designed), `capability-review-overdue` and `capability-orphan-row` (a row naming no record).

The map is the body of the atlas's Business (secondary) section: per band, each capability with the records
holding it and their operating claims, who it serves, where it is designed only and which records name it
as `be.framework_domain` relevance; then the gaps (sell and grow capabilities no record holds as in use,
worded as a statement about code, not a verdict on the business), the wires and every record in business
scope; each value also shows what its packages measure (lines, test files, importers, unread files, and how
many have no measured build state), and each host where and at which commit its packages were read.
`CAPABILITIES.md` beside the atlas holds the whole map value by value, with each row's private evidence and
each wire's anchors; Questions for Yu carries one line for the rows waiting on review.

Wires are relations (`[kind.relation]`), not a record kind of their own, and a package may stand at either
end (`tool/wires.py`). Between the packages of a host, an import in non-test source is a `depends_on`
relation of basis `measured-import`, and a manifest declaration no code imports is one of basis
`measured-manifest`. Curated wires are the `[[wire]]` rows of `curated/wires.toml`, `reviewed = false` until
Yu reviews them: one end `feeds` the other over an event, an HTTP route or a file (or `depends_on` it), each
end a package or project id, with anchors: a repository-relative path (a file, or a directory and everything
under it) and a text that every build re-finds in the tracked files of that side's canonical checkout,
through the deny list and with comments stripped; a hit in a test or a document is not code. A row may name
its `flow` and `hop`, and an end that is not built yet (it is measured and shown, but gives no relation
record). Each wire has two independent fields. `code_state` is what the code shows: `wired` (both sides have
non-test code for it and no end package is on the build or typecheck quarantine list), `wired-unbuilt` (an
end package is), `declared` (no code consumes it yet, or nothing is tracked yet where one side's anchors
point) or `contradicted` (one side has the code and the other side's code does not answer it). `stage` is how
far it has been shown to work: `designed`; `demonstrated` only when the latest run on main of the workflow
the row names (`demonstrated_by`, in the repository of the wire's consuming side) is read green;
`accepted` or `active` only with the owner decision the row names. Neither says live, which in the estate
means observed up, and CI alone never makes a wire accepted or active.

The run is read only by `build --forge`, with one allowlisted, read-only call per workflow: `gh run list
--repo OWNER/NAME --workflow FILE --branch main --limit 1 --json
databaseId,status,conclusion,headSha,event,createdAt`, for host repositories (a `[[host]]` row) on github.com
only. gh runs with the estate's minimal environment, which passes it no token variable (it uses its own stored
login), and nothing gh prints is kept but those six fields, checked one by one; a failed call keeps only the
estate's own words for why (exit code, timeout), so no token can reach a record, a run file or the terminal. A
green run reads `demonstrated`; a run that concluded otherwise, or no run on main, reads `designed`; a run
still in progress, a build without `--forge` or a failed read reads `unknown`, and a failed read degrades the
run. A wire shows the run it was measured against (its id, commit and time).

Each build measures every curated row and compares it with its claim: `agrees`, `unevidenced` (it claims
`wired` or `wired-unbuilt` and the consuming side has no code for it), `differs` or `not-measured`. QUEUE
lists `wire-unevidenced` and `wire-differs`. `estate check --wires` reads the current run against the rows
as they are now: exit 1 when a curated wired claim has no consuming code, 10 when another state differs,
could not be measured, a row is invalid or a row changed since the build, and 0 otherwise. Committed rows hold
only forge ids, package ids, repository-relative anchors and short evidence that passes the privacy lint.
The first rows, all `reviewed = false`, are the plan's seed: the compliance-status route and the breach and
entity events into the workflow engine (`wired`, since the quarantine follow-ups let both sides build), four
calls or events the other side does not answer (`contradicted`), and the first wire, `sale-to-ledger`,
`wired` and still `designed`: it becomes `demonstrated` once `build --forge` can read a green
`wire-e2e.yml` run on main.

## Hygiene: the plan of owner decision D8

D8 (`dec-2026-10-17-9`) asks for every hygiene issue and what needs to be done: a plan, not execution.
The plan names where sensitive material lives, so it stays in the private half, in one file:
`private/curated/hygiene.json` (mode 0400), changed only by `estate hygiene --import` (merge by stable
item id: the owner's statuses are kept, and an item a newer plan leaves out is kept and marked missing,
never dropped) and `estate hygiene --set` (the owner's status of one item, with a log). Both print what
changes and write only with `--write`, keeping the previous file as a new 0400 backup. Each build renders
`HYGIENE.md` beside the atlas and a Hygiene section in it (counts by wave, severity and status, the P0
items in one line each, a link). Every item is joined with what the estate already measures on its
related records for its area (scheduler health, surface health, risks, whether a curated file is still
there), against the signals seen at import, so an item whose signals have all cleared reads "no longer
observed" without anyone editing it. That is a reason to check the item, not proof of a fix: the status
stays the owner's. Items in progress elsewhere (AWS, D6) are shown as such; the estate makes no calls there.

## Exit codes

- `0`: complete, and every required source is fresh.
- `10`: complete but degraded. `run.json` lists every reason (a stale or missing source,
  unmeasured checkouts, vocabulary drift, unmapped tags, broken tree links, unknown visibility).
  Wrappers must not treat 10 as failure.
- `1`: failed. The previous run stays current.
- `2`: usage error or guard refusal. Nothing was written.

## Privacy boundary

The committed half is tooling, vocabulary, the record contract and scrubbed curation keyed by
forge id. Everything measured, generated or risk-bearing lives in `private/`.

- This directory's `.gitignore` ignores `private/`, `atlas.html` and `tree`, and
  `private/.gitignore` ignores everything inside it. Either guard alone keeps the private area
  out of git, and every run checks both, each on its own. The two root links are ignored once,
  by this directory's `.gitignore`.
- Before every write the tool asks git whether `private/DO-NOT-COMMIT` is ignored and whether
  anything under `private/` is tracked. A wrong answer refuses the run.
- Private directories are 0700 and files 0600. Every private write creates a new file with
  O_EXCL and O_NOFOLLOW after checking each ancestor, so nothing is reached through a link.
  Generated outputs are never overwritten: each build writes a new run. Two owner verbs replace
  a private input file atomically: `untree` sets `[tree].enabled = false` in
  `private/config.toml`, and `import-survey --write --overwrite` replaces the private curation
  only after keeping the old bytes beside it as a new 0400 `.bak-<time>` file (it never replaces
  `config.toml`). `private/curated` stays 0500 between writes.
- The only writes outside `private/` are the links `atlas.html` and `tree` at this directory's
  root. The tool creates them and refuses to touch either name if anything else is there.
- Secret contents are never read. Environment files, Terraform state, keys, mnemonics, wallets,
  keychains and LaunchAgent environment values are seen by name and metadata only. Scheduler
  command lines are stored with substitutions and secret-named values redacted.
- Git runs read-only: a replaced environment, optional locks off, hooks, fsmonitor and gpg off,
  every transport protocol disabled, an allowlist of read subcommands, no object reads on
  promisor clones, and no `status` where a filter driver is configured (status would run it;
  that checkout's dirty state is reported unknown). The only network access is the opt-in
  `build --forge`: its repository listing and the latest-run read of the workflows demonstrated wires name.
- Nothing is published: no artifact, site, bundle or registry entry.

`estate/bin/estate check --commit-ready` runs the privacy lint over the committed files. Beyond
paths, addresses, ids and secret shapes, it rejects in `curated/` any per-record risk detail
(working-tree and push state, security posture), which the import moves to the private curation.
The newest forge listing (configured, dated by its file time, or from `build --forge` in any retained
run, dated by that run) must show the host repository private and be at most 30 days old. That is
evidence from the listing's day, not from the moment of a push, so the recipe below checks again
right before pushing.

## Commit recipe

Committing is Yu's act. On a branch Yu chooses (not `main` or `develop`):

```sh
estate/bin/estate check --commit-ready
git add -- estate ':(exclude)estate/private'
# immediately before any push: the host must still be private (the guard above weighs a dated listing)
gh repo view cambridgetcg/business-ecosystem --json isPrivate --jq .isPrivate   # must print true
```

Never run `git add -A` in business-ecosystem: stage only estate paths, as above.

Until the first commit the committed half is untracked, so `git clean -fd` in business-ecosystem
would delete it. It can be rebuilt from the private survey copy with
`estate/bin/estate import-survey --write`. The owner's private tables (devices, accounts, caveat
checks, location rules, group paths, locators) are not in the survey or in this code: they live
only in `private/curated/estate.toml` and `private/config.toml`, and a re-import carries them
forward.

## No backup

`private/curated` (the verbatim survey of 2026-10-17 and the private curation) exists only on this
machine. `estate/bin/estate export-private --to ABS_PATH` writes a 0600 tar of `private/curated`
and `private/config.toml` to a path outside business-ecosystem and outside any git work tree
that would not ignore it, and refuses to overwrite.

## PORTFOLIO_MAP deviation

`docs/PORTFOLIO_MAP.md` (from PR #1) says to keep real maps, reviews and exports outside the
repository. This layer keeps its private area inside the repository, because the owner asked for
the layer to live in business-ecosystem, and confirmed it on 2026-10-17 (`dec-2026-10-17-4`). It is
recorded as `dec-2026-10-17-1` in `curated/decisions.toml`, and the same rules apply to every private
output: mode 0600, no link following, never overwriting. PORTFOLIO_MAP.md records the same
exception, and the root `.gitignore` excludes this layer's private area too (both landed with PR #1).
The portfolio-map/1 snapshot is read as a dated, historical source and never rewritten.

## Symlink hazard

`estate/tree` points into live checkouts across the estate. Tools that follow symlinks from inside
business-ecosystem will fan out into them: VS Code with `search.followSymlinks`, `grep -R`,
`find -L`, `du -L`, `rsync -L` and `cp -RL`. Prettier's CLI does not follow symlinks, and git never
descends into the tree because it is ignored twice. `estate/bin/estate untree` removes the tree.
