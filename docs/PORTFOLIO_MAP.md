# Private portfolio map CLI

[`scripts/portfolio.py`](../scripts/portfolio.py) reads an explicitly selected
`business-ecosystem.portfolio-map/1` observation snapshot. It is a small offline
reader and evidence-review applicator, not a registry, crawler, provider client,
application entry point or legal-entity importer. Python 3.10+ and POSIX
no-follow/directory-descriptor support (macOS/Linux) are required; no packages
are installed or imported outside the standard library.

Keep real maps, reviews and exports **outside the repository and public web
roots**. Only synthetic fixtures belong in tests. Human/private and machine
labels describe presentation, **not access control**. JSON and both human
formats retain private metadata and source locators. Nothing here authorizes
publication, source access, transactions, deployment or enrolment.

## Commands

Run from the repository root. Replace the illustrative paths and identifiers
with exact operator-selected values; there is no default map or environment
fallback. `--map` precedes the command.

```sh
python3 -B scripts/portfolio.py --map /private/operator/project-map.json summary
python3 -B scripts/portfolio.py --map /private/operator/project-map.json find atlas --limit 10
python3 -B scripts/portfolio.py --map /private/operator/project-map.json show sample/atlas
python3 -B scripts/portfolio.py --map /private/operator/project-map.json show pages:atlas
python3 -B scripts/portfolio.py --map /private/operator/project-map.json queue
python3 -B scripts/portfolio.py --map /private/operator/project-map.json render --format html
python3 -B scripts/portfolio.py --map /private/operator/project-map.json render --format markdown --output /private/operator/new-view.md
python3 -B scripts/portfolio.py --map /private/operator/project-map.json render --format json --output /private/operator/new-map-export.json
python3 -B scripts/portfolio.py --map /private/operator/project-map.json apply-review --review /private/operator/review.json --output /private/operator/reviewed-map.json
```

- **Every command validates first.** Invalid schema, malformed JSON, duplicate
  identities, inconsistent repository/hosting sets or invalid reviews exit 2
  with a diagnostic and no result on stdout. Successful commands exit 0.
- `summary` returns `computed`, `declared`, `disagreements`, and `unverifiable`.
  Count disagreements are visible data, not a validation error or an implicit
  repair. Missing declared counts are flagged. Unknown declared totals are
  unverifiable, not silently certified.
- `find` searches only saved repository, surface and zone record metadata,
  case-insensitively. It returns exact record values with `kind`,
  `total_matches`, `returned_count`, and `has_more`. The limit defaults to 20
  and must be 1–100. An empty query is rejected. Search does not follow evidence,
  inspect repository histories, enumerate files or load application code.
- `show` matches exact `id`, `resource_id` or repository `full_name`, without
  trimming, case normalization, short-name aliases or fuzzy selection. A
  selector matching multiple records is an error, not a first-match choice.
- `queue` includes **all** candidate/unresolved source assignments, historical
  source evidence, unresolved/name-inferred repository purposes and dirty
  deployment declarations. `record_count` counts affected records;
  `findings_count` counts reasons and can be larger. `counts_by_reason` breaks
  down those reasons. Dirty canonical **or latest** deployments enter the
  queue; `summary.dirty_pages_declarations` specifically counts Pages
  **canonical** dirty declarations to retain the original summary definition.
- `render` defaults to HTML on stdout. HTML and Markdown show repositories,
  hosting surfaces and DNS zones separately, with purpose, attribution,
  unassigned/unknown values, declared lifecycle and native expandable evidence.
  Markdown uses headings plus safe native HTML details/definition lists.
  No scripts, fonts, stylesheets, analytics, images or external requests are
  embedded; evidence URLs are text, not automatically followed links. Scope,
  observation times and review history remain inspectable. JSON exports the
  same map records and extensions without display escaping or semantic changes.
- Only `render --output` and `apply-review --output` write files. Parents must
  already exist. Files are published atomically with mode **0600**, without
  overwriting any existing file, directory, hard link or symlink. No output
  directories, caches or default exports are created. Shell redirection is
  outside this guarantee; use the explicit CLI output options when available.

## Boundaries and validation

Repository identity, portfolio interpretation, hosting resources, DNS zones and
legal entities remain distinct. A repository name never becomes an `entityId`.
Legal references must be null or point to an explicit legal record already in
the map, including any zone `legal_entity_id`; absent zone references are also
allowed. Reviews cannot assign legal ownership. Declared lifecycle, classification
confidence, provider deployment status and actual runtime health are different
claims. Archived source does not establish an offline deployment; a pinned
commit does not establish deployed-byte equality, especially for dirty releases.
Framework domains mean relevant purpose, not an installed adapter.

Validation covers the versioned map envelope, consumed field types, unique
canonical/provider identities and resource IDs, exact repository names,
repository/candidate membership, declared framework-domain membership, inverse
`hosting_resources`, legal references and attribution/null coupling. Existing
opaque metadata/extensions are preserved, not reinterpreted as a different
provider schema. Existing evidence requires nonempty `kind`, `locator`, `note`;
this tool does not retroactively assert old locators were verified.

Each input is an explicitly named UTF-8 JSON regular file, at most **8 MiB**,
with at most 64 nesting levels. Duplicate JSON object keys, nonfinite numbers
(including exponent overflow), invalid UTF-8 and unpaired surrogates are refused.
Input and output paths reject `..`, final symlinks and symlinked ancestors using
no-follow directory descriptors. Use a real path, not a symlinked convenience
alias. The CLI opens named ancestors only; it does not enumerate directories.
It never reads map `inputs`, evidence locators, source paths, credentials or
provider endpoints. Normal interpreter/standard-library initialization is not
an application or corpus read.

## Applying an attribution review

The operator independently verifies the evidence **before** creating a review.
The CLI verifies syntax, membership, before-state and provenance consistency;
**it does not perform online verification**. The label
`deployment_commit_verified` in an accepted review remains an operator-supplied
claim, not a claim that this CLI contacted a provider.

A review has exactly these top-level fields:

```json
{
  "schema": "business-ecosystem.portfolio-review/1",
  "base_map_sha256": "REPLACE_WITH_SHA256_OF_THE_EXACT_INPUT_BYTES",
  "changes": [
    {
      "resource_id": "pages:atlas",
      "expected": {
        "repository": null,
        "attribution": "candidate_only"
      },
      "replacement": {
        "repository": "sample/atlas",
        "attribution": "current_tracked_config",
        "evidence": [
          {
            "kind": "current_tracked_config",
            "locator": "https://github.com/sample/atlas/blob/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/wrangler.toml",
            "revision": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            "note": "Synthetic example: replace with independently reviewed evidence."
          }
        ],
        "caveat": "Source declaration only; not runtime or deployed-byte verification."
      }
    }
  ]
}
```

This is an illustrative schema example, **not verified evidence or a usable
review**. Calculate the SHA-256 of the exact selected file, e.g.
`shasum -a 256 /private/operator/project-map.json`. Reformatting the map changes
its hash and makes an earlier review stale.

Review rules:

1. Every `resource_id` must exactly identify a baseline **resource_id**, not its
   canonical surface `id`. Changes must be nonempty and cannot repeat a resource.
2. `expected` contains exactly both `repository` and `attribution`, matching the
   baseline. Every change is validated against the unmodified input before any
   projection or output is published.
3. `replacement` contains exactly `repository`, `attribution`, `evidence`, and a
   nonempty `caveat`. Arbitrary field paths, extra fields, legal-owner assignments
   and purpose edits are refused. Keep purpose-only amendments in a separate
   operator findings file rather than overloading this attribution envelope.
4. Repository values must be exact members of the saved repository set, or an
   explicit `https://codeberg.org/{owner}/{repo}` source URL. External Codeberg
   declarations do **not** create GitHub records or invent purpose classifications.
5. Recognized attribution values:
   - `deployment_commit_verified`
   - `current_tracked_config`
   - `current_source_document`
   - `historical_source_evidence`
   - `candidate_only`
   - `unresolved`

   Candidate/unresolved assignments require `repository: null`; the other
   categories require a source. Candidates are not confirmed ownership.
6. Evidence is nonempty. Current attributions require at least one immutable
   locator or full lowercase 40/64-hex `revision`. A standalone
   `sha256:{hash}` locator requires exactly 64 lowercase hex characters.
   Supported URL pins use HTTPS and one of these literal provider/repository
   route prefixes, with a full lowercase 40/64-hex hash in the reference slot:
   - `https://github.com/{owner}/{repo}/blob/{hash}`
   - `https://github.com/{owner}/{repo}/commit/{hash}`
   - `https://codeberg.org/{owner}/{repo}/src/commit/{hash}`
   - `https://codeberg.org/{owner}/{repo}/commit/{hash}`

   The hash ends at a slash or the end of the URL path. A `/blob/{hash}` or
   `/src/commit/{hash}` appearing later in a file path under a mutable branch
   does not pin that branch. Other hosts, relative paths, query strings and
   fragments cannot supply a URL pin. Codeberg repository suffixes such as
   `.git` remain literal identities, not aliases to be stripped.

   Supported provider paths reject raw/encoded `.` or `..` segments, repeated
   slashes, backslashes, encoded separators and encoded percent signs (including
   nested escapes), rather than normalizing them. Parser-stripped leading
   whitespace/controls and embedded tabs/newlines are also refused. This refusal
   applies even with a separate revision; percent-decoding is used only to detect
   ambiguous path syntax, never to repair a hash or rewrite the saved locator.

   A full independent revision may accompany an otherwise unpinned locator,
   such as a saved filename or mutable-branch URL. If both a revision and a
   supported locator pin are supplied, they must agree. Every supplied revision
   is checked for current attribution; short hashes and branch names are not
   immutable revisions. Historical and unestablished findings may cite
   saved/datable metadata without pretending to be current source verification.
   Locator existence and repository/commit correspondence are not checked offline.

Successful application preserves repository/resource/zone coverage, original
observation times, unrelated fields and old evidence. New evidence is appended;
the complete before-record and replacement are retained in `review_history`
with base/review byte hashes, application time, and
`operator_supplied_not_online_verified`. Inverse repository hosting lists,
affected counts and inherited source-purpose framework fields are recomputed.
External or unassigned sources have unresolved grouping and no invented
framework domains. Existing candidate and dirty-deployment metadata is retained.

Retained replacements must satisfy the same review rules, even when a later
review supersedes them. Each next before-record and the final surface must
retain the exact ordered evidence (including repeated entries) and the preceding
replacement caveat. Evidence comparison is recursively type-sensitive, including
opaque extensions: `true`, `1` and `1.0` are distinct, as are `-0.0` and `0.0`.
Object-key order is irrelevant; array order and repeated items are retained.
These are comparisons of parsed JSON values, not original JSON spelling. The
initial before-record keeps the snapshot's legacy evidence rules; these
consistency checks do not authenticate the original snapshot or establish that
any evidence was independently verified.

### The meaning of `new_source_relations`

A legacy snapshot's declared number may refer to an earlier survey not contained
in the selected map. `summary` preserves that declaration, reports computed
`null`, and lists it as **unverifiable** rather than inventing a baseline.

The first applied review stores `review_baseline`: the selected input's exact
hash, original summary and complete resource-to-source mapping. Derived maps
calculate `new_source_relations` as the number of **currently non-null source
pairs that differ from that original baseline**, not the number of review
operations and not the sum of old declared totals. Reassignments count as new
pairs; reverting to the original source or removing a relation removes that
pair from the count. Subsequent reviews preserve the same baseline. Its coverage
and source-state history are validated, but this is not a signed audit log or
proof of provider truth.

Both `apply-review` and `render --format json` check the fully serialized map's
8 MiB size limit and parseability, including the 64-level nesting limit, before
publishing a file or writing stdout. Escaping and retained history can increase
size or depth; failures emit no partial map, rather than output the tool cannot
read. Large histories must be scoped explicitly at the metadata-snapshot
boundary, preserving archived evidence separately; there is no automatic
history traversal, pruning or bulk provider discovery.

## Tests

```sh
python3 -B -m unittest discover -s tests/portfolio -v
```

Tests use tiny synthetic metadata (plus an explicit size-limit case) in
`tempfile` directories. Set `TMPDIR` to an approved private scratch directory
before running if the environment's default temporary root is unsuitable.
No private estate snapshot is a test input. Coverage includes malformed graphs
and JSON, stale hashes, exact lookup ambiguity, count truth, hostile rendering,
atomic/no-overwrite output, failed review batches, repeated/sequential reviews,
external-source classification boundaries, and audit-hook checks forbidding
network, application imports, directory enumeration and reads beyond the named
map after standard-library initialization. Import/help/invalid-command tests
check both file bytes and directory membership for unintended side effects.
