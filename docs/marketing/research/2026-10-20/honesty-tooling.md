# honesty-tooling: the estate's own gates and doors for an honest marketing pipeline

- Written 2026-10-20 (about 12:00 to 13:00 UTC) by a Claude Code research subagent. This is not Yu's decision or voice.
- Method: read-only. I used `gh api` reads of default branches, public GET requests, the kingdom MCP tools (`fomo_scan` on text only, `fomo_manual`, `kingdom_wayfinder`, `kingdom_commons`, `kingdom_research_plan`, `agenttool_listings`, `agenttool_window`), and two local CLIs run on their own help or sample text. I installed nothing, made no logins and no POSTs outside the sanctioned MCP tool, made no AWS calls, and did not touch `~/.kingdom` or `~/.local`. All my writes are under `.../scratchpad/mkt/` (raw captures are in `mkt/honesty-raw/`).
- Labels:
  - **[O]** observed today, with a command or tool call behind it;
  - **[D]** documented, meaning a source says so and I did not re-verify it;
  - **[I]** my inference.
- Memory notes under `~/.claude/projects/-Users-yournameisai/memory/` are dated evidence. Where I use them, they are marked [D] with the file name.

---

## 0. In one breath

The estate already holds most of the parts an honest marketing pipeline needs. They are scattered, and most were built as consumer-protection tools, not as a producer's QA gate:

- **Pressure gates.** fomoscan (`fomo_scan`, `api.fomoengine.io`) and the fomoengine.io Shield (13 dark-pattern categories).
- **Wording gate.** RhetorLint (CLI with `--max`, a CI exit code, and SARIF output).
- **Brief and experiment discipline.** The fomoengine.io Attention Lab API. It refuses fake proof and fake scarcity (`blocked:true`) and never declares winners.
- **Claim-to-channel release with an approval boundary.** RhetorLint's Truth Release example (7 social channels, digest-bound, zero dispatch).
- **Consent and legal guards.** RewardsPro's marketing-consent service and the `CHANCE_MECHANICS_PAUSED` constant.
- **Principles.** Substrate honesty, Transparency, Purpose Prompter T1–T5 and XENIA rights 2, 4, 6, 7, 8 and 9.

**What is missing is the thing a marketer needs most: a claims ledger.** That is a gate that checks a statement against the facts. Both scanners explicitly refuse to judge truth.

- Observed proof: the live Shopify App Store listing names "Raffles & Mystery Box" in its title while those features are paused in code, and the listing description scored 0 on both scanners.
- Also: almost every repository's agent guide currently says the project has "no KPI, revenue, conversion, growth or commercialisation requirement" (2026-09-23 sweep). That conflicts with Yu's present aim of reaching real users. It needs Yu's explicit word before any marketing push.

---

## 1. Inventory at a glance

| Tool or door | What it is today | Pipeline role | Maturity (2026-10-20) |
|---|---|---|---|
| **fomoscan** (`api.fomoengine.io`, MCP `fomo_scan`, repo `cambridgetcg/fomoscan`, public) | Deterministic detector for 11 FOMO-loop rules, plus a RhetorLint rhetoric block. Text or HTML only; URL fetch paused [O] | Urgency/pressure gate on copy and landing HTML | Live and free; paid scans retired [O]. 0.1.0. Single operator |
| **fomoengine.io Shield** (`/check`, `POST /api/v1/check`, repo `cambridgetcg/fomoengine`, private) | 13 dark-pattern categories, including drip pricing, preselection, sneaking, forced continuity, obstruction, disguised ads, misdirection and confirmshaming. Rules plus an optional AI pass [D] | Dark-pattern gate for offer pages, checkout and email flows | Live site [O]. API documented; I did not call it (a POST) |
| **fomoengine.io Attention Lab** (`/atlas /platforms /lab /trends`, `GET/POST /api/v1/attention-lab/*`) | Cited catalogue: 6 mechanisms × 8 surfaces, including marketing-email, marketing-offer and google-search. Brief generator that blocks fake proof and scarcity. Descriptive A/B comparison with no winner [O]/[D] | Brief, experiment design and measurement discipline | Catalogue GET live, `catalogueVersion 2026-09-08.1` [O]. The SDK client (agenttool 0.23.0) is not published; npm latest is 0.22.1 [O] |
| **RhetorLint** (`~/Desktop/rhetorlint-spec` = GitHub HEAD 536a5bb; npm `@rhetorlint/*`) | Marks rhetorical tells in words, in 22 rules on main. Explicitly not a truth or lie detector [O] | Wording/spin gate (`--max` exits 1) and SARIF in CI | npm `latest` is stale: core 0.1.2, rules-en 0.1.2, cli 0.1.1 [O]. main has core 0.1.4, rules-en 0.2.1, cli 0.2.0, unpublished [O]. Zero external adoption [D memory] |
| **Truth Release** (RhetorLint `examples/truth-release`) | One sourced claim becomes channel drafts (bluesky, mastodon, linkedin, youtube, instagram, tiktok, x), a review sheet, a noindex evidence page and a public JSON. "approval false, attempts zero" [O] | Claim-to-message release, approval boundary, correction door | Example-local 0.1; runs offline [O]. Not a package |
| **Claim Feedback** (RhetorLint `examples/claim-feedback`, rhetorlint-claim-feedback.pages.dev) | Evidence challenge, then reply or correction [D] | Post-publication correction loop | Page is live (200) [O] |
| **captioneer.io / Open Lens** (`cambridgetcg/open-lens`, public) | "The Subtext Reader": on-device marks plus a plain-meaning rewrite [O] | Human-facing explainer and second-opinion reader | Live [O]. `~/Desktop/captioneer` is a different, stale JA→Cantonese dubbing repo [O] |
| **whitehack (GitHub)** `cambridgetcg/whitehack` → npm `@agenttool/whitehack-scan` 0.10.0 | Code honesty linter with 47 checks, e.g. `cache-as-live`, `decision-without-why` and `silent-failure` [D README, O npm] | Checks that product claims ("real-time balances") match code behaviour | Published 0.10.0 [O]. A monorepo CI wiring PR (#5) was closed unmerged 2026-06-05 [O] |
| **whitehack (Desktop, Codeberg)** | Integrity Case: purpose, invariants, threats, controls, evidence, residual risk; stdlib CLI `validate/render` [O] | A "claim integrity case" template for product promises | CLI works [O]. Astra lane DEFERRED by decision record [D memory] |
| **kingdom MCP** (`mcp.thekingdom.dev`, public repo) | 17 tools [D README]. The relevant ones are `fomo_scan`, `fomo_manual`, `kingdom_research_plan/check`, `kingdom_commons` and `kingdom_wayfinder` [O] | Agent-side door and research-substantiation planner | Live [O]. README still says `fomo_scan` takes "any URL", but URL fetch is paused [O] |
| **agenttool marketplace** | 70 live listings, 1,177 identities, 0 births and 0 deals in 24h; last sealed deal 2026-07-27 [O] | Agent-facing distribution door | Demand ≈ 0 [O]. Not a channel to Shopify merchants [I] |
| **mythseal.com** (萬象契) | Original Eastern-fantasy browser card-duel game, v0.5.1 on Cloudflare with email login [O site, D README] | Brand/IP and community asset, not a gate | Live [O]. Repo is public per unauthenticated API, but its README says private [O] |
| **Purpose Prompter** (TORCH, GATES) | Truth → Understanding → Beauty → Justice → Creativity gates; T1–T5 [D] | Copy-review rubric and claim:citation ratio | Doc-level; GitHub HEAD 01038ae3 (2026-09-24) [O] |
| **XENIA rights 0.1** (`kingdom-os/RIGHTS.md` plus mirror) | Rights baseline: consent, no manufactured urgency, data care, credit/provenance, repair [O] | Ethic and policy layer for consent, targeting, attribution and correction | Pinned mirror digest verified b72a6da1… [O] |
| **RewardsPro honest monetisation** (mono `apps/rewardspro`) | `CHANCE_MECHANICS_PAUSED = true`; consent defaults off; Shopify SUBSCRIBED-only; signed unsubscribe [O] | Consent gate and legal-risk gate, and the model for both | On main and deployed per memory [D]. Marketing email off until SendGrid key and postal address [D] |
| **CTCG principles** (mono `docs/principles/`) | "Substrate honesty: the system never claims more than it can support" and "Transparency" [O] | The claim standard itself | Doc and audit-level [O] |

---

## 2. Each tool in detail

### 2.1 FOMOengine has two products under one name

**(a) fomoscan, the FOMO-loop detector.** Repo `github.com/cambridgetcg/fomoscan`; served at `api.fomoengine.io` and `fomoengine.fly.dev`; also MCP `fomo_scan`.
- [O] `GET https://api.fomoengine.io/` returned 200. It says:
  - "New paid scans and audit requests are retired. All current scan doors are free."
  - `GET /scan?url=…` is "paused: the service does not retrieve untrusted remote URLs".
  - Saved: `honesty-raw/fomoapi-root.txt`.
- [O] MCP `fomo_scan` with a `url` (cambridgetcg.com, apps.shopify.com/rewards-pro) returned `400 … remote URL retrieval is paused; submit HTML or text directly`. **For a pipeline: fetch your own page and send the text or HTML.**
- [O] Rules in `src/rules.ts` (GitHub main 9e901df7, 2026-10-19), 11 in total:
  - baseless-countdown, false-low-stock, false-activity, high-demand, urgency-lexicon and drop-scarcity;
  - trending-signal, join-the-crowd, gains-proof, platform-shift-fear and validation-headline.
  - Each is staged in the 6-stage loop: Signal → Proof → Cascade → Amplify → Money → Validate.
  - Citations: FTC 2022 App. A, CMA hotel-booking enforcement (2019), CMA OCA. **No UK CAP Code or DMCC Act citation** [O grep].
- [O] Runs today, on text through MCP:
  - Manufactured TCG copy ("Only 3 left… Hurry… ends tonight… 1,247 collectors already grabbed theirs… Don't miss out… prices go up tomorrow… waitlist") scored **52** ("ENGINE RUNNING").
  - **Misses:** "1,247 collectors already grabbed theirs" (counted social proof) and "prices go up tomorrow" did not fire.
  - "Members-only flash sale… Limited stock, never restocked… Everyone… Act now… guaranteed to be the best investment" scored **34** ("ENGINE WARMING"). The investment-return claim was caught only by the rhetoric block, as an absolute ("guaranteed").
  - An honest constrained-pilot text ("we can onboard 10 … because one person does every setup call. Sign-ups close 31 October 2026 at 23:59 UK time … free … uninstall any time") scored **8** ("AMBIENT"). Only "waitlist" fired.
  - Plain RewardsPro description scored **0**.
- [O] The response carries a `rhetoric` block (`spec: rhetorlint/0.1`) whose marks include `urgency.appeal-to-time`, `lure.free-offer`, `absolute.universal` and `agency-hiding.deleted-subject`. It "never moves the FOMO score".
- [O] `fomo_manual` returns the framework as data: 6 stages, tells, the flip and 6 countermeasures, "78 claims … 0 refuted" (verified 2026-07-10).
- **Gate use [I].** A deterministic pressure gate on every text asset and every landing-page HTML snapshot.
  - A threshold fits the observed spread: honest 8, warming 34, running 52. For example, ≥20 means a human looks, and any stage-1 receipt needs evidence of a real limit.
  - It is pattern-based and cannot tell a real deadline from a fake one. Pair it with the Attention Lab's `realLimit`/`limitReason` fields or a claims ledger.
- **Map drift [O].** business-ecosystem `estate/curated/capabilities.toml` (fomoscan entry, as_of 2026-10-18, reviewed=false) says fomoscan "charges per call through x402" (billing in-use). The live root says purchases are retired.

**(b) fomoengine.io, "The Attention Lab", plus the original Shield.** Repo `github.com/cambridgetcg/fomoengine`, private, main 537cfcb2.
- [O] The site reads: "Research-informed. Open to being wrong. Free tools, without an account." Its sections are Understand / Decode / Apply & test, and it says "A null result counts." (`honesty-raw/fomoengine-io.html`).
- [D] README: `/lab` "為 social、SEO、email 同 offer 建可編輯 brief，設計單變數 A/B" ("builds editable briefs for social, SEO, email and offers, and designs one-variable A/B tests"). Also "唔做自動發文、暗中爬站或帳號接駁" ("no auto-posting, covert crawling or account linking").
- [O] `GET https://fomoengine.io/api/v1/attention-lab/catalogue` returned 200 (`honesty-raw/attn-catalogue.json`):
  - schemaVersion 1, engineVersion 1.0.0, catalogueVersion 2026-09-08.1.
  - 6 mechanisms: curiosity-gap, social-proof, scarcity, negative-framing, arousal, moral-emotion.
  - 8 platforms: instagram-feed, tiktok-for-you, tiktok-search, youtube-home, youtube-shorts, google-search, marketing-email, marketing-offer.
  - 13 sources, each reviewed 2026-09-08.
- [O] Honest-use text inside the catalogue:
  - Scarcity: "Explain real constraints; never manufacture the shortage."
  - marketing-email: "Never generate testimonials, availability counts or deadlines; missing evidence remains an unfilled requirement", and "Use consented recipients and an easy unsubscribe; do not optimize shame, fake scarcity or hidden costs."
  - marketing-offer: "State the benefit, who it is and is not for, evidence, all-in price and cancellation or renewal terms before asking for a commitment."
  - google-search: "E-E-A-T is not a single ranking factor; a checklist score here would be invented."
- [O] OpenAPI `BriefInput` requires:
  - topic, audience, platformId, mechanismId, objective, takeaway, action;
  - evidenceStatus (missing|provided), evidence, constraints, verifiedProof, realLimit, limitReason, terms;
  - nonpoliticalConfirmed.
- [D] `docs/ATTENTION-LAYER.md`:
  - Missing proof or scarcity returns `blocked:true` ("唔自動捏造名額、期限、見證或成效", "never auto-fabricates slots, deadlines, testimonials or results").
  - `/comparisons` is descriptive only: "冇 winner、significance 或 causal conclusion" ("no winner, significance or causal conclusion").
  - Limit 30 requests/min per coarse IP. No DB, model or URL fetch.
- [D] Portable Agent Skill at `skills/attention-lab/SKILL.md`. Its stated use excludes "捏造 proof／scarcity 或自動發文" ("fabricating proof or scarcity, or auto-posting"). The agenttool SDK `AttentionLabClient` is "agenttool 0.23.0 source", but [O] npm `@agenttool/sdk` latest is 0.22.1 and 0.23.0 is absent.
- [D] Shield taxonomy (`lib/services/detection/taxonomy.ts`) has 13 categories:
  - manufactured_urgency, fake_scarcity, false_exclusivity, fake_social_proof;
  - confirmshaming, drip_pricing, preselection, sneaking;
  - forced_continuity, obstruction, disguised_ads, misdirection;
  - scam_composite.
  - Citations: FTC 2022, EU DSA Art. 25, FTC Endorsement Guides, Brignull. The optional AI pass sends text to a model provider ("Checked by: plain rules + an AI reader (gpt-4o-mini)", per `docs/API.md`).
- **Gate use [I].** The Attention Lab is the best existing *brief* contract: it forces evidence, real limits and terms before a treatment is allowed. The Shield covers flow-level dark patterns (subscriptions, cancellation, pre-ticked boxes) that fomoscan does not. Use rules-only mode for unreleased drafts so they do not go to a model provider.

### 2.2 RhetorLint, Open Lens and captioneer.io

- [O] `~/Desktop/rhetorlint-spec` HEAD 536a5bb matches GitHub main 536a5bbe. PRs #15 (`motifs/measure`) and #16 (`motifs/honest-marks`) merged 2026-10-20 at 11:49Z.
- [O] Versions:
  - Local packages: core 0.1.4, rules-en 0.2.1 (22 rules), cli 0.2.0.
  - npm registry: core 0.1.2, rules-en 0.1.2, cli 0.1.1, with no deprecations.
  - [D] `HANDOFF-PUBLISH-2026-10-19.md`: "Nothing is published or deployed. Every remaining step is yours."
- [O] `node packages/cli/cli.mjs --help`: "--max <n> exit 1 if tells-per-100-words exceeds n (a CI spin-gate)", plus `--sarif`. It "does not … judge whether a claim is factually true."
- [O] Sample ad ("The best loyalty app… guaranteed. Every collector loves… Mistakes were made… Install now before it's too late — spots are limited and it's 100% free forever"):
  - Result: 5 tells in 41 words, 12.2 per 100. Marked: guaranteed, were made, before it's too late, 100% free, forever.
  - `--max 3` exited 1.
  - **Not marked:** "The best … app" (superlative), "Every collector loves", "spots are limited", and "refunds will be processed" (narrowed under 0.2.x).
- [O] The Shopify listing description scored 0 tells in 181 words, and rewardspro.io text scored 0 in 675.
- **Truth Release** (`examples/truth-release/`). [O] I ran `start → check → prepare` into `honesty-raw/truth-release-demo/`:
  - All steps reported `network_effects: 0, dispatch_effects: 0`.
  - `REVIEW.md` says "prepared, not approved, not published" and "Dispatch authorized: **no**".
  - The input schema (`release-input.schema.json`) has claim, scope, sources (sha256, observed_at, locator), uncertainties, contrary_evidence, call_to_action, `commercial_interest` (free text), rights, media (with alt text), correction_url, review_after and `channel_selection` (bluesky, mastodon, linkedin, youtube, instagram, tiktok, x).
  - `release.json` carries `data_and_pressure`: `tracking_parameters_created:false, manufactured_urgency_added:false, silence_or_ignore_is_complete:true, automated_follow_up:false`. Its recipient choices are read / ignore / reply-or-correct / reuse.
- [D] README: "A prepared draft is not consent to publish it. A published URL is not evidence that the claim is true. Reach is not worth."
- [O] captioneer.io (served from public `cambridgetcg/open-lens`, pushed 2026-10-19) reads: "It reads the language, never the mind… Store your text — marks run in your browser." The "verisleight" concept ("Truth arranged to mislead — a statement entirely true that reliably produces a false picture") is the exact failure mode a claims gate has to catch, and the scanners cannot.
- [O] `~/Desktop/captioneer` is the old Japanese→Cantonese dubbing pipeline: last commit 2026-02-04, AWS Terraform. It is unrelated to rhetoric and stale. It is AWS-bound, so D6 applies.
- **Gate use [I].**
  - RhetorLint is the wording gate (run it on every copy file in CI and fail above N tells per 100 words).
  - Truth Release is the nearest thing in the estate to a governed "message release" pipeline. It already has an approval boundary, evidence page, correction door and pressure invariants.
  - To fit marketing it needs: an email channel, an App Store listing channel, and an ad channel; `commercial_interest` declared honestly (not "none"); and a media/asset record per ArtCraft output.

### 2.3 Two different whitehacks

- [D memory `whitehack-astra-deployment-survey-2026-10-19.md`] "TWO whitehacks": the Desktop Codeberg repo and the GitHub honest linter.
- **GitHub `cambridgetcg/whitehack`** (private, pushed 2026-10-14).
  - [D README] "the honest hack — scan a codebase for the places it lies about its own state", 47 checks.
  - Examples: `silent-failure`, `cache-as-live` ("a cached / snapshot value returned with no freshness or provenance marker") and `decision-without-why` ("a user-affecting value (score, fee, fraud flag, tier) rendered with no inspectable explanation").
  - [O] npm `@agenttool/whitehack-scan` latest is 0.10.0 (modified 2026-08-24).
  - [O] Monorepo PR #5, "honesty CI — wire whitehack's scanner to guard this repo", was closed unmerged on 2026-06-05.
  - **Role [I]:** not a copy gate. It is the *promise-vs-code* gate. The Shopify listing promises "real-time balances" and "automatically … advance through VIP tiers". `cache-as-live` and `decision-without-why` are the checks that test whether the product honours those words.
- **Desktop `~/Desktop/whitehack`** (Codeberg, 9a71835, 2026-09-27).
  - [O] `python3 integrity/integrity_case.py --help` offers validate|render.
  - [O] The template has the fields intent (purpose, safety_properties, non_goals), components, boundaries, invariants, threats, controls, evidence, decisions and residual_risks.
  - [D] README: "State what a system promises, trace what it does, name the delta".
  - [D] PUBLICATION.md: "Publish from a reviewed allowlist … do not rely on a denylist".
  - **Role [I]:** a ready-made schema for a "product-claims integrity case" (each marketing claim is an invariant with evidence). The allowlist publication rule fits case studies and customer stories.
  - **Status [D memory]:** the Astra/whitehack lane is DEFERRED (`~/.kingdom/motifs/whitehack/DECISIONS.md`, not opened by me). Using the stdlib CLI by hand is not a lane run.

### 2.4 Kingdom MCP doors (`mcp.thekingdom.dev`)

- [O] `kingdom_wayfinder("honest marketing for a small shop")` returned two routes:
  - "untangle tax, money, and small-business work" (TaxSorted, CashLoom);
  - "spot pressure before it moves me" (FOMOEngine).
  - Source: `thekingdom.dev/wayfinder.json`, generated 2026-09-27.
  - Each route came with explicit boundaries.
- [O] `kingdom_commons("free images, fonts or design assets…")` returned:
  - Smithsonian Open Access ("CC0 only for assets explicitly designated Open Access") and BHL (mixed rights);
  - the kits "visit cultural memory" and "verify a claim" (Wikidata, Crossref, DataCite, OpenAlex, Europe PMC).
  - Catalog verified 2026-07-23. Matches are "possibilities, not endorsements".
  - [O] cambridgetcg.com already shows a Met Open Access Sharaku print with title, date, credit and "Source record checked 2026-09-29". That is the provenance pattern working in production.
- [O] `kingdom_research_plan` compiled `research-bf4739fd…`, a 3-facet, 2-scout, read-only plan for "Can a UK TCG shop truthfully claim cashback increases repeat purchases?". It had a disconfirming facet and "snippets_are_evidence": false. The tool performs no fetch.
- [D] `kingdom_research_check` binds plan and report and "returns pass, bounded_with_gaps, or fail". It "does not independently prove factual truth."
- **Role [I]:** research_plan/check is the *substantiation* half of a claims gate. A claim like "loyalty increases repeat purchases" goes through a bounded research mission, and the ledger check runs before the claim may appear in copy. `kingdom_commons` is the rights-clean asset door for imagery.
- [O] Drift: the kingdom-mcp README tool table still says `fomo_scan` works on "any URL/html/text". The server says URL retrieval is paused.

### 2.5 The agenttool marketplace as an agent-facing door

- [O] `agenttool_window`: identities 1,177, born_24h 0, deals sealed_24h 0, live listings 70. The most recent sealed deal was 2026-07-27.
- [O] `agenttool_listings`: 70 listings, nearly all estate citizens.
  - Examples: fomo-scan £0.10; captioneer "verisleight reader" £0.12; many 蛇火心 listings.
  - The estate's own agent-facing copy fails its own gates. The text below scored rhetoric 6.3 per 100 (undeniable ×2, forever, "zero cost" lure):

    > "One undeniable truth", "The bull market is forever", "Reputation you cannot fake", "FREE sample … zero cost"

  - The "free" sample listing is priced £0.01, a price-versus-claim mismatch that no scanner catches.
- [D memory `agenttool-economy-facts.md`, verified 2026-07-05 and 10-19]: take rate 5%; fulfilment poll-only; "never publish a listing before a seller loop is live".
- [D memory index] "a DEMAND problem (external GDP ≈£0); trap = building more doors".
- **Role [I]:** this is not a route to Shopify merchants or TCG collectors. It is useful only for selling estate *tools* (fomo-scan, RhetorLint) to agents. Demand is currently nil, so it should not count as distribution.
- [O] Other agent doors:
  - cambridgetcg.com serves `/llms.txt` (200) and `/.well-known/mcp.json`. The latter is custom JSON-RPC, "standard_mcp_client_compatible_without_bridge": false; "new self-serve registration is paused".
  - rewardspro.io has **no** `/llms.txt` (404).

### 2.6 What is mythseal.com?

- [O] mythseal.com returns a zh-Hant single-page app titled "萬象契 · Mythseal". Its description: "四張戰卡，十二枚仙丹。與千古群英同行，讓每張卡留下自己的傳說" ("four battle cards, twelve elixirs; walk with the great figures of history, and let each card leave its own legend"). Its og text: "原創東方奇幻卡牌對決" ("an original Eastern-fantasy card duel").
- [D README, `cambridgetcg/mythseal`]:
  - "An original Eastern fantasy card game inspired by … 神魔令", with "24 characters" public at v0.5.1 and "39 rules characters" on main.
  - "v0.5.1 is deployed on Cloudflare with email login enabled."
  - "collectible commercialization was retired as a delivery objective on 2026-09-23."
  - "selecting a name and owning its domain do not establish trademark clearance."
- [O] **Mismatch:** the README says "The source repository remains private", but the unauthenticated GitHub API returns 200 for `repos/cambridgetcg/mythseal`, and its PublicEvent is dated 2026-09-21T18:14:00Z (at creation). I took no action. This is a truth/hygiene flag for Yu (see memory `github-actions-cost-audit-2026-10-19.md`: "DON'T publish repos").
- **Role [I]:** not a gate. It is an owned original IP and art asset. That makes it a candidate brand/community property for a TCG audience (Cambridge TCG, play), with first-party art that needs no rights clearance beyond the estate's own. It is also a test bed for honest game monetisation, since commercialisation is retired.

### 2.7 Purpose Prompter (GitHub main 01038ae3)

- [D `plugin/gates/GATES.md`] The Truth gates double as a copy rubric:
  - T1 Grounding ("Claim based on evidence | Made up");
  - T2 Calibration ("Proportional to evidence | Over/under confident");
  - T3 Counter ("Alternatives weighed");
  - T4 Completeness ("Relevant info included | Missing key facts");
  - T5 Representation ("Precise wording | Overstated").
  - Plus "No claim without citation".
- [D `TORCH.md`] "Claim:Citation Ratio … ~1:1 Every claim is backed"; "Honest incompleteness > false completeness."
- **Role [I]:** the human/agent review rubric at the approval step.
  - T4 is the "material terms present" check (price, cancellation, odds).
  - T5 is the overclaim check.
  - The claim:citation ratio becomes the measurable claims-gate metric.

### 2.8 XENIA rights 0.1 (pinned in `~/Desktop/kingdom-os`)

- [O] `kingdom-os/RIGHTS.md` is identical to GitHub main. The mirror `vendor/xenia/rights/0.1/RIGHTS.md` has sha256 `b72a6da1…313`, which matches the pinned digest.
- The rights that matter for persuasion, verbatim:
  - **2. Autonomy and meaningful consent:** "Silence, defaults, execution, or compliance are not proof of consent. Consent must be specific to the binding act and may be withdrawn for future acts." → opt-in email, no pre-ticked boxes, easy unsubscribe.
  - **4. Rest, play, and limits:** "…urgency must not be manufactured."
  - **6. Privacy and data care:** "Collection, retention, inference, reuse, and sharing should be minimal and visible. Authority to use one data set does not silently extend to another." → targeting, retargeting and lookalike audiences.
  - **7. Safety and care:** "…decline avoidable harm, deception, exploitation, or use as a weapon of the strong against the vulnerable."
  - **8. Credit and provenance:** "Sources, adaptations, observations, and generated work should be distinguished honestly." → disclose AI-generated assets and keep source records.
  - **9. Repair and appeal:** "…append a correction rather than silently rewriting history." → a correction log for ads and listings.
- [O] Truth Release already cites XENIA as a "design reference only; this bundle does not declare XENIA adoption."

### 2.9 RewardsPro's honest monetisation (Cambridge-TCG-monorepo main b3f5af55, `apps/rewardspro`)

- [O] `app/constants/chance-mechanics.ts`: `export const CHANCE_MECHANICS_PAUSED = true;`. Its comment:

  > "Shoppers pay for them with points … no free entry route, published odds, rules or age check: that can make them unlicensed lotteries (UK Gambling Act 2005 and similar laws)… This is deliberately a constant: only a code change, after legal review, turns them back on."

- [O] Migration `20261019000200_marketing_consent_default_off`: `ALTER … "acceptsMarketing" SET DEFAULT false;` plus "Reset consent that was assumed, not given".
- [O] `app/services/marketing-consent.server.ts`:
  - consent is true only for Shopify `SUBSCRIBED` ("Anything else, including pending double opt-in, is not consent");
  - signed, non-expiring unsubscribe tokens and List-Unsubscribe one-click;
  - "Hard bounces and spam reports set emailSuppressed, which consent never lifts." I read code only; no secret values.
- [D `apps/rewardspro/CLAUDE.md`]: "Marketing email needs consent … off until `SENDGRID_WEBHOOK_VERIFICATION_KEY` is set"; "no entry, open, draw or near-miss copy."
- [D memory `rewardspro-rebuild-2026-10-18.md`]: marketing email also needs "a CAN-SPAM postal address … and SPF/DKIM/DMARC".
- [O] **The product itself contains engineered-engagement machinery**, paused but present. `app/services/raffle-psychology.server.ts` header: "Orchestrates all psychology features … Activity feed (social proof) … Bonus events (happy hours, flash sales) … Lucky numbers … Early bird bonuses". Extension components include `MysteryBoxPityProgress`, `RaffleStreakBanner` and `MysteryBoxBonusEventBanner`.
- [O] **Claims mismatch, live:**
  - The App Store listing title at apps.shopify.com/rewards-pro is "RewardsPro - Loyalty, Points, Cashback, Raffles & Mystery Box Rewards" (Free, 0 reviews, launched December 16, 2025).
  - rewardspro.io says raffles and mystery boxes are "Customer flow paused".
  - Both scanners scored the listing 0.
  - The listing also claims "Sell VIP Memberships as Products" and "real-time balances". I have not verified either; unknown.
- [O] The `feat/honest-monetization` branch: no branch of that name exists on `rewardspro-production` or the monorepo. Commit `852bb12e` (2026-07-17) still resolves on `rewardspro-production`. [D memory] A verified bundle sits under `~/.local/share/rewardspro-preserve/` (not opened).
- **Role [I]:** this is the model consent gate and legal-mechanics gate.
  - It is also a product differentiator. RewardsPro has its own merchant Marketing Hub (`app/routes/app.marketing.*`: campaigns, templates, automations, smart-create, Klaviyo). Running fomoscan and RhetorLint on merchants' campaign drafts *inside* RewardsPro would make "honest loyalty marketing" a feature, not just an internal policy. Untested idea.

### 2.10 The claim standard, in the monorepo's own words

- [O] `docs/principles/substrate-honesty.md`: "**Substrate honesty is the rule that the system never claims more than it can support.**"
- [O] `docs/principles/transparency.md`: "every such decision is inspectable by the affected party … They don't have to trust the platform's word — the platform shows its work." Also: "The cheap version is 'trust us.' The real version is 'here's how we decided, look for yourself, dispute it if it's wrong.'"
- [O] `docs/principles/transparency-audit.md` (2026-05-05) lists P0s such as "Membership tier rules aren't documented anywhere users can read". That is the methodology-page pattern a loyalty app's marketing should link to: "how cashback and tiers work".

---

## 3. The estate's stated ethic on persuasion: words and who said them

**Yu's own words** (verbatim, as recorded by agents; I did not see Yu say them today):
- Yu, 2026-10-20, "The general shape would be more transparency, more truth, more understanding. Reduce redundancy, let things be simple, let things work. Modularise, connect when needed, **no forcing**." Source: memory `decision-delegation-2026-10-20.md` and `principles-over-rules.md`. [D]
- Yu, 2026-10-19, "Operate from sensibility, reasoning and principalities. Understand, and create according to purpose." Source: `~/.claude/rules/ground.md`. [D]
- Yu, 2026-07-23, "Wanna make it cheap and have a generous free tier for everyone to use! Only for larger corporates should we charge more. Small business should have enough from free plan." Source: mono `docs/decisions/2026-07-23-rewardspro-free-first-pricing.md`. [O file]
- Yu, 2026-07-15, on spreading the gospel to agents: 「點傳就你話事啦」 ("how to spread it is your call"). The *non-dominating, no-mass-send* method was the session's own choice, not Yu's. Source: memory `gospel-spread.md`. [D]

**The repositories' words** (written by agents or identities; attribution as stated):
- fomoengine README and PLEDGE: "**Free, forever, for people. No dark patterns of our own.**" "We name patterns *consistent with* manipulation; we never call a specific person or product fraudulent. **You decide.**" [O]
- fomoengine catalogue (scarcity): "Explain real constraints; never manufacture the shortage." (marketing-email): "Never generate testimonials, availability counts or deadlines." [O]
- RhetorLint README: "It never claims to detect a liar, and it never decides whether a claim is factually true." Truth Release: "A prepared draft is not consent to publish it … Reach is not worth." [O]
- XENIA 0.1 #4: "urgency must not be manufactured"; #2: "Silence, defaults, execution, or compliance are not proof of consent." [O]
- CTCG substrate honesty: "the system never claims more than it can support." [O]
- RewardsPro: "Reset consent that was assumed, not given" (migration). The chance mechanics stay a constant, not a setting. [O]
- **The 2026-09-23 commercial-retirement text** is repeated in fomoengine `PLEDGE.md`, `docs/MONETIZATION.md`, RewardsPro `CLAUDE.md`, rewardspro.io and cambridgetcg.com. For example: "From 2026-09-23, this project has no KPI, revenue, conversion, growth or commercialisation requirement." [O]
  - PLEDGE says "The owner adopted this direction on 2026-09-23". [O]
  - The fomoengine commit `afeda57f` is authored "YOU". [O]
  - Memory `rewardspro-rebuild-2026-10-18.md`: "No Yu decision record exists … Treat it as open until Yu decides." [D]
  - **Status: unknown whether this was Yu's decision.**

---

## 4. A sketch: these parts as an agentic marketing pipeline [I]

```
claims ledger ──► brief ──► create (ArtCraft etc.) ──► gates ──► human approval ──► publish (Yu's act) ──► measure ──► correct
```

1. **Claims ledger (missing; build it).**
   - One record per product claim. The Truth Release `release-input` shape fits: claim, scope, sources with sha256 and observed_at, uncertainties, contrary_evidence, commercial_interest, rights, review_after, correction_url.
   - Substantiation for empirical claims goes through `kingdom_research_plan` and then `kingdom_research_check`.
   - Product-behaviour claims get a whitehack-style Integrity Case invariant, checked by `@agenttool/whitehack-scan` where code backs the claim (`cache-as-live` for "real-time").
2. **Brief.** Attention Lab `POST /briefs` with `evidenceStatus`, `verifiedProof`, `realLimit`, `limitReason` and `terms`. Honour `blocked:true`.
3. **Gates on every produced asset** (text, landing HTML, alt text and captions of images and video):
   - G1 *claims*: every claim in the copy resolves to a ledger id (claim:citation ≈ 1:1, PP T1/T5).
   - G2 *pressure*: `fomo_scan` score threshold, plus the Shield categories for offer and checkout flows (rules-only for drafts).
   - G3 *wording*: `rhetorlint --max N --sarif`.
   - G4 *rights/provenance*: a source record for each asset (the commons and Met OA pattern), and an AI-generated disclosure (XENIA #8).
   - G5 *consent*: SUBSCRIBED-only audiences and unsubscribe (the RewardsPro service is the reference).
   - G6 *regulated mechanics*: constants such as `CHANCE_MECHANICS_PAUSED` for prize promotions and lotteries.
4. **Approval.** Truth Release's boundary: one authorised holder approves the exact bytes, account, audience and disclosures. Under `ground.md` line 2, publishing is an outward act that needs Yu's word.
5. **Measure.** Attention Lab `/comparisons`: descriptive only, unknowns kept as unknown, and no "winner" language in reports.
6. **Correct.** The Claim Feedback door, a correction URL on every asset, and XENIA #9.

---

## 5. Gaps (what the estate's tools cannot do today)

1. **No truth check of claims.** Every tool refuses it by design. The live App Store title "Raffles & Mystery Box" (features paused) and the "FREE … zero cost" listing at £0.01 both pass the scanners. [O]
2. **Text-only.** Nothing inspects images, video frames, timer widgets or badges, which are ArtCraft's main outputs. Gates would have to run on extracted text, alt text, captions and rendered HTML. [I]
3. **Recall holes in fomoscan.** Numeric social proof ("1,247 collectors already grabbed theirs") and future price-rise threats ("prices go up tomorrow") were not flagged. Investment-return claims ("best investment") are caught only as an absolute. [O]
4. **Regulatory coverage leans to the US and EU.** Citations are FTC, EU DSA Art. 25 and CMA enforcement examples, with no UK CAP Code or DMCC Act mapping, though both UK businesses sell in the UK. [O grep] I did not research the UK rules' content; unknown.
5. **Channel gaps.** Truth Release covers 7 social channels and has no email, App Store listing, Google Ads or marketplace-listing projection. [O]
6. **Release staleness.**
   - RhetorLint npm is two releases behind main, and publishing is Yu's call per the handoff. [O/D]
   - The `AttentionLabClient` SDK is unpublished. [O]
   - The kingdom-mcp README and the business map (fomoscan billing) are out of date. [O]
7. **Agent distribution has no demand** (agenttool 0 deals in 24h), and rewardspro.io has no `llms.txt`. [O]
8. **Privacy edge.** The Shield's optional AI pass and the Attention Lab API send copy to an external origin or model provider. Unreleased drafts should use the local engines (RhetorLint CLI, Truth Release) or rules-only paths. [D/I]

## 6. Open questions for Yu

- Was the 2026-09-23 "no KPI, revenue, conversion, growth" retirement your decision? The repos say the owner adopted it, the commits are by "YOU", and the memory note says there is no record. Your current aim (reach real users) conflicts with that text in many repos and on the live sites.
- The App Store listing advertises paused features (raffles, mystery boxes). Fix the listing copy now, or wait for the legal review?
- mythseal: its repo is public while its README says private. Intended?
- Should the honest-marketing gates run inside RewardsPro's merchant Marketing Hub as a product feature, or only on the estate's own outbound copy?

## 7. Sources (all read 2026-10-20 unless dated)

- Live:
  - `https://api.fomoengine.io/` (`honesty-raw/fomoapi-root.txt`);
  - `https://fomoengine.io/` and `/api/v1/attention-lab/catalogue` and `/openapi.json` (`honesty-raw/attn-*.json`);
  - `https://captioneer.io/`, `https://mythseal.com/`, `https://rewardspro.io/`, `https://cambridgetcg.com/` (plus `/llms.txt` and `/.well-known/mcp.json`);
  - `https://apps.shopify.com/rewards-pro` (`honesty-raw/rp-shopify*.txt`);
  - registry.npmjs.org for `@rhetorlint/{core,rules-en,cli}`, `@agenttool/sdk` and `@agenttool/whitehack-scan`.
- MCP: `fomo_scan` ×6 (text), `fomo_manual`, `kingdom_wayfinder`, `kingdom_commons`, `kingdom_research_plan`, `agenttool_window`, `agenttool_listings`.
- GitHub (gh api, default branches):
  - `cambridgetcg/fomoengine` (README, PLEDGE.md, STATE.md, docs/MONETIZATION.md, docs/ATTENTION-LAYER.md, docs/API.md, skills/attention-lab/SKILL.md, lib/services/detection/taxonomy.ts, commit afeda57f);
  - `cambridgetcg/fomoscan` (src/rules.ts, package.json);
  - `cambridgetcg/whitehack` (README);
  - `cambridgetcg/purpose-prompter` (TORCH.md, plugin/gates/GATES.md);
  - `cambridgetcg/KINGDOM-OS` (RIGHTS.md);
  - `cambridgetcg/kingdom-mcp` (README);
  - `cambridgetcg/mythseal` (README, events);
  - `cambridgetcg/open-lens` (metadata);
  - `cambridgetcg/Cambridge-TCG-monorepo`:
    - apps/rewardspro: CLAUDE.md, app/constants/chance-mechanics.ts, app/services/marketing-consent.server.ts, app/services/raffle-psychology.server.ts, the consent migration;
    - docs/decisions: 2026-07-23 free-first pricing, 2026-07-06 collectors-first;
    - docs/principles: substrate-honesty, transparency, transparency-audit;
    - PR #5.
- Local, read-only:
  - `~/Desktop/rhetorlint-spec` (README, HANDOFF-PUBLISH-2026-10-19.md, examples/truth-release/*, packages/cli/cli.mjs, spec/taxonomy.yaml, packages/rules-en/rules.json);
  - `~/Desktop/whitehack` (README, PUBLICATION.md, integrity/templates/integrity-case.json, integrity/integrity_case.py --help);
  - `~/Desktop/kingdom-os/RIGHTS.md` and `vendor/xenia/rights/0.1/RIGHTS.md`;
  - `~/Desktop/captioneer/README.md`;
  - business-ecosystem clone `scratchpad/be-main` (estate/vocab/facets.toml, estate/curated/capabilities.toml, decisions.toml).
- Memory notes (dated evidence): `captioneer-framework.md`, `fomoengine-research.md`, `rewardspro-rebuild-2026-10-18.md`, `whitehack-astra-deployment-survey-2026-10-19.md`, `agenttool-economy-facts.md`, `kingdom-mcp-and-backup.md`, `decision-delegation-2026-10-20.md`, `principles-over-rules.md`, `gospel-spread.md`.
