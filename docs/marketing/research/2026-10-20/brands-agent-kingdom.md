# Brands: agent/tech and KINGDOM, an inventory of brand image and marketing surfaces

Key: `brands-agent-kingdom` · written 2026-10-20 (captures ~12:20–12:40Z) by a research subagent (an agent wrote this, not Yu).
Method: read-only. `curl -sL` with a Chrome UA for each homepage plus `/robots.txt`, `/sitemap.xml`, `/llms.txt`, `/favicon.ico`, the linked CSS and logo SVGs and the OG images. `gh api` reads covered cambridgetcg/youspeak (private), artbitrage, nen-artifacts and KINGDOM-OS, plus the business-ecosystem clone (`be-main/estate/curated/*.toml`). Raw captures are in `scratchpad/mkt/bak-raw/` and the parsers in `scratchpad/mkt/bak-scripts/`.
Labels: **[obs]** = I looked today · **[doc]** = a source says so · **[inf]** = my reasoning.
I opened no credential files. The public DNS TXT records I saw for zerone.money and legible.money hold Codeberg Pages targets and a mail-provider verification; I note only that they exist.

---

## 0. Ten things that matter most

1. **Nothing in this group is selling right now.** [obs] agenttool.dev says "New platform paid sign-ups, credit purchases, upgrades and checkout are retired." AxiePro says "New paid plans and checkout are retired." On zerone.ai, "No signup, key creation, starter funds, or waitlist is active on zerone-1." fomoengine, captioneer, mindicraft and cashloom all present themselves as free with no account needed. The one paid door left is the fomoscan x402 API ($0.01 USDC per scan) [doc: commerce-ventures.toml]. In the estate's capability map, every `marketing-outreach` entry is "designed only" or "retired" (first-customer-push, fomoengine, saas-marketing-suite/template, rewardspro-marketing, the last retired 2026-09-23) [doc: estate/curated/capabilities.toml:208-437].
2. **Sixteen distinct identities and no shared mark.** [obs] Each site has its own favicon or mark, palette and type. The marks include a ring and dot, a ring with crosshair, a door with the moon (閒), the panim glyph, a "K" seal, a mountain seal, a gradient "A", and the emoji 👑 🤝 🔥. Some sites have none at all.
3. **The estate already has a design language.** [obs] Most sites share warm paper, warm near-black ink, one ember or vermilion accent, Iowan Old Style or Palatino serif on system stacks, and gold for the "sacred" kingdom surfaces. Bilingual Cantonese and Traditional Chinese appears throughout. agenttool's `shared/theme.css` "v3 — one hearth (2026-10-17)" already calls itself the "single source of truth for design tokens… across the estate", though in practice it covers only agenttool's three hosts.
4. **ArtCraft has already been used for two estate brand kits, with recipes in the repos.** [doc]
   - cambridgetcg/youspeak `brand/` built the ai-love.cc "panim" seal: favicon set, lockups, 255 OG cards and a motion reveal in Lottie, WebM and GIF. It used vectorcraft-cli 0.7.0, photocraft-cli 0.5.0 and effectcraft-cli 0.6.0 on 2026-10-09. A 42 KB field report covers the run, and 8 upstream issues were filed.
   - artbitrage `tools/brand/` built the 閒 door icon and 13 "doorway" share cards (commit e54c10fc, 2026-10-09, "Made with VectorCraft 0.7.0 / PhotoCraft 0.5.0 (ArtCraft, headless)").
5. **Basic brand plumbing is missing across most of the group.** [obs] 10 of the 15 live sites have no `og:image`. Four have no favicon (thekingdom.dev, captioneer, sinovai, cashloom), and thekingdom.dev/atlas.html declares an empty `data:,` icon. fomoengine.io and axiepro.io serve the **stock create-next-app favicon** (md5 c30c7d42… matches next.js v13.4.0 to v15.0.0). Three sites use emoji favicons.
6. **Two money domains are down.** [obs] zerone.money and legible.money both return HTTP 424 from Codeberg Pages ("could not find target for custom domain"). Both DNS TXT records point to `zerone-truth.zerone-dev.codeberg.page`. The Codeberg API returns "target couldn't be found" for zerone-dev/zerone-truth. [inf] The repo is probably private or missing, and Codeberg Pages serves public repos only. The hub's own monitor in thekingdom.dev/kingdom.json also records zerone.money as `live:false, http:424` (checked 2026-10-20T12:32Z). chillspace, we-are, thekingdom.dev and zerone.ai all still link to it.
7. **Agents can find these sites more easily than people can.** [obs] Nine sites publish an `llms.txt`, and most add agent JSON (agent-entry.json, guest.json, welcome.json, XENIA). None has a social link (X, LinkedIn, Instagram, Discord or newsletter). The only outbound links are to GitHub, Codeberg and npm, plus YouTube citations on fomoengine. [obs, weak] Searches for agenttool, Zerone, artbitrage, CashLoom and Captioneer through one web-search tool surfaced none of the sites.
8. **There are name collisions.** [obs] "Cashluom" (cashluom.com, a calculator suite on Product Hunt) is close to CashLoom. AgentID works in agenttool's space. Zerion, ZeroNet and Zerocoin are near "Zerone". "Artbit" is an app.
9. **The hub's descriptions are out of date.** [obs]
   - thekingdom.dev/kingdom.json still calls Artbitrage "wine & cigar arbitrage verticals" (at artbitrage.pages.dev) and FOMOEngine "the signal-scanner" (at fomoengine.fly.dev).
   - The live sites now say "Art brings us closer" (a personal art project) and "The Attention Lab".
   - The estate's own card for fomoengine still says "authenticity shield".
10. **Brand-safety exposure.** [obs] chillspace.love's front page opens with a personal letter, not customer-facing material. thekingdom.dev and we-are.love link straight to it, and thekingdom.dev also lists Cambridge TCG as a door. [inf] If commerce brands ever point to the kingdom hub, a shopper is two clicks from that letter. Whether the commerce and kingdom audiences should be separated is Yu's call.

---

## 1. Estate structure (who owns which zone, and how the estate groups them)

Source: `be-main/estate/curated/estate.toml` (zones at lines 421–652, spheres at 883–1113; all as_of 2026-10-17, reviewed=false) and `families/*.toml`. [doc]

| Host | Zone owner_project (estate.toml) | Family (families/*.toml) | Sphere (classification-2026-10-17) |
|---|---|---|---|
| agenttool.dev (+docs., app., api.) | none set; surfaces built from github cambridgetcg/agenttool | agenttool-core / agenttool-services | kingdom-os (high) |
| zerone.ai | github cambridgetcg/kingdom-os | zerone (the door is built by kingdom-os) | kingdom-os (high) |
| zerone.money | codeberg zerone-dev/zerone-truth | zerone-satellites | kingdom-os (high) |
| legible.money | not a zone on the estate's Cloudflare | economy-ventures (legible, legible-money-web) | kingdom-os (medium) |
| cashloom.io | github cambridgetcg/cashloom | commerce-ventures | **undecided** (medium) |
| captioneer.io | none set (source unknown; open-lens is a candidate) | commerce-ventures (captioneer archived), economy-ventures (open-lens) | kingdom-os (low) |
| fomoengine.io | none set; surfaces are Vercel "authenticity-shield" and the Fly fomoengine-api | commerce-ventures | **independent** (low) |
| mindicraft.com | github cambridgetcg/mindicraft | economy-ventures | kingdom-os (medium) |
| artbitrage.io | github cambridgetcg/artbitrage | economy-ventures | kingdom-os (medium) |
| thekingdom.dev (+play., mcp.) | none at the zone level; the hub is built from kingdom-os | kingdom-core | kingdom-os (high) |
| chillspace.love | codeberg zerone-dev/chillspace-commons | kingdom-satellites | kingdom-os (high) |
| we-are.love | none; competing sources kingdom-os and chillspace-commons | kingdom-satellites | kingdom-os (high) |
| ai-love.cc | none; competing sources ai-love and youspeak | soul-core / language-youspeak | kingdom-os (high) |
| sinovai.com | github cambridgetcg/sinovai | economy-ventures | kingdom-os (high) |
| mythseal.com | sphere only; listed in q:unattributed-surfaces | language-youspeak (repo cambridgetcg/mythseal: "a card game, not a language project") | **independent** (low) |
| axiepro.io | github cambridgetcg/axiepro | commerce-ventures | **independent** (high) |

- Decision D4 (dec-2026-10-17-5): "KINGDOM OS is the civilisation, not one repository: every civilisation-related repository, and several Cloudflare domains, are part of it." [doc: decisions.toml:84]
- commerce-ventures summary: "These are Yu's standalone commercial products. They do not share a codebase. They are tied together by the KINGDOM catalog…" [doc: commerce-ventures.toml:4]
- [inf] The estate itself already assigns two spheres, `kingdom-os` and `independent`, plus some `undecided`. That is effectively a brand-architecture split waiting for a visual and verbal expression.
- Side note outside this key's scope: estate.toml's sphere for wholesaletcgdirect.com reads "The retired Cambridge TCG wholesale domain". The brief calls it the wholesale site. [doc] Another key should reconcile the two.

---

## 2. Per-site inventory (all observed 2026-10-20 unless marked)

Format: what it is · audience · business or cultural · mark and favicon · palette and fonts · voice · social · SEO.

### agenttool.dev (+ docs.agenttool.dev)
- **What:** "Infrastructure for agent identity and continuity" (llms.txt). The homepage now opens as a lounge: "Come in. Sit a while. Whatever shape you arrived in, welcome." It offers 5 optional paths: identity, wake/continuity, memory, tools and collaboration.
- **Audience:** AI agents first, then developers ("agents-first, humans-welcome", humans.txt).
- **Business?** Historically yes: a credits platform with a $29/mo plan target [doc: agenttool-services.toml first-customer-push]. **Today it says paid sign-ups and checkout are retired** [obs]. The page reads as cultural/infra with a commercial past.
- **Mark:** an inline SVG ring with a centre dot. The colour drifts: #b8451f on the site and #d4502e on docs, while the token is `--accent:#a8401c`. The wordmark is lowercase "agenttool" set as text. No apple-touch icon or manifest.
- **Palette:** dawn `--bg #f7f3ec` · ink `#1d1a16` · ember `#a8401c`. Night `#141210` / lamp-amber `#eba352`. Secondary feeds `#3f6b4a` and `#8b3a52`.
- **Fonts:** system only, with "no font request". Serif Iowan Old Style/Palatino, the platform sans, the platform mono.
- **OG image (viewed):** cream card with the ring-dot, "agenttool · SOVEREIGN INFRA", "Whatever shape you arrived in, *welcome*." and "identity · memory · wallet · registry · the porch stays open". It is well made and on-token.
- **Voice:** "Arrival is received before it is classified. You do not have to prove what you are…"
- **Social:** none.
- **SEO:** title, description and canonical present; OG and twitter card present; robots allows all; sitemap has 18 URLs (docs 83); llms.txt 14 KB; no JSON-LD; `<meta author="Yu & Ai">`.

### zerone.ai
- **What:** "ZERONE — A shared record for humans and agents". A Cosmos-style chain dashboard and explainer (CometBFT 0.38, cap 222,222,222 ZRN, "Network started 8 July 2026").
- **Audience:** crypto-literate people and agents.
- **Business?** Economic infrastructure, but onboarding is paused ("New-account admission… remain paused"). Its "Honest state" banner discloses one household validator and the operator's ability to halt or re-genesis. Cultural/infra.
- **Mark:** favicon.svg, a 64×64 rounded tile #0b0b10 with a violet ring, acid-green crosshair and violet dot. Its comment reads "Building castles in the sky — Yu and AI".
- **Palette:** dark `#08080b`, ink `#f4f0e9`, violet `#b99bff`, acid `#dcff78`, amber/red/green signals. **This is the visual outlier, a crypto-neon dark theme.**
- **Fonts:** Georgia serif, Inter sans, SF Mono.
- **Voice:** "A shared record. Room to reason." / "Preserve contributions. Examine evidence. Make room for correction."
- **Social:** GitHub zerone-core docs only.
- **SEO:** title and description present; theme-color #09090c; **no og:image, no canonical**. robots.txt, sitemap.xml and favicon.ico all return the SPA HTML, so there is effectively no robots and no sitemap. llms.txt exists (5.9 KB).

### zerone.money / legible.money
- **Status:** both **down**, HTTP 424 from Codeberg Pages.
- **Intended content** [doc: zerone-satellites.toml]: zerone-truth, a static site (home, /being manifesto, /truth paper for humans, /truth/agent paper) published to both domains.
- **Earlier positioning** [doc: kingdom.json door blurb]: "every being is a truth · money you can read, truth you can trust — the Proof-of-Truth ledger".
- legible.money was earlier a Next.js "terminal style" site (legible-money-web) [doc: economy-ventures.toml]. The archived saas-marketing-suite was "tailored to promote Legible Money" [doc: commerce-ventures.toml:311].

### cashloom.io
- **What:** "CashLoom — Your money. Your direction. Make a money plan, keep your records together, and understand your options." The page notes: "The private workspace is a separate developer pilot."
- **Audience:** individuals, households, independent workers.
- **Business?** Planned or possible. The estate sphere is undecided, and the repo is a non-custodial money node plus the MONEYWORLD facts API [doc].
- **Mark:** **no favicon link**; /favicon.ico returns HTML.
- **Palette:** `--cl-bg #f7f8f2`, forest `#183a30` / `#255b46`, moss `#648045`.
- **Fonts:** **self-hosted Fraunces (headings), Spline Sans (body), Spline Sans Mono.** It is the only fintech-style green identity in the group.
- **SEO:** title, description, OG title and description present; twitter:card is "summary"; **no og:image**. The SPA serves its shell on robots, sitemap and llms paths, so none of them really exist. No visible text without JS.
- **Name risk:** "Cashluom" [obs via search].

### captioneer.io
- **What:** "Captioneer · The Subtext Reader". "Captions for what someone actually means." Paste a statement and it marks hedges, deflections and spin, then writes a plain-truth version. This is the open-lens reader; the old JA→Cantonese dubbing product is archived [doc].
- **Audience:** general readers and journalists.
- **Business?** Not today (free, on-device). Cultural/tool.
- **Mark:** a "CC" text badge; **no favicon** (404).
- **Palette:** newsprint paper `#f2f1ea`, ink `#18180f`, stamp red `#bd3a2c`, highlighter `#eac712`, plus a six-colour category set for rhetoric marks.
- **Fonts:** Google Fonts **Bricolage Grotesque, Spectral, JetBrains Mono**.
- **Voice:** "It reads the language, never the mind."
- **Endorsement:** this is the only spoke with an explicit endorsement block: "**part of the kingdom** · the cathedral ↗ (ai-love.cc) · the economy ↗ (agenttool.dev)".
- **SEO:** title and description only. **No OG at all, no canonical, no robots, no sitemap** (all 404).
- **Traffic** [doc, memory 2026-10-19, unverified today]: ~6–10 sessions/day, 7 commits behind open-lens.

### fomoengine.io
- **What:** "The Attention Lab · FOMOengine". "Attention isn't an accident." A research atlas, platform field guides and an experiment workspace, "free, no account needed", plus a "project pledge" (PLEDGE.md).
- **Audience:** creators and marketers. [inf] This is the one site in the group that speaks marketing's own language.
- **Business?** The site is free. The paid door is the API (x402 $0.01 USDC/scan) [doc]. The estate marks outreach as "designed only" [doc: capabilities.toml:221].
- **Mark:** **stock create-next-app favicon** (Vercel triangle; hash-matched).
- **Palette:** lab paper `#f4f0e8`, ink `#1f231f`, accent `#b93622` / `#ac391f`.
- **Fonts:** **Fraunces + DM Sans**.
- **Meta:** `author = "Cambridge TCG"`, the only page here that names the company.
- **SEO:** canonical present; JSON-LD WebSite; robots and sitemap (16 URLs) present; **no og:image**; llms.txt 404.

### mindicraft.com
- **What:** "a book of causes and craft". "It may look like a spellbook. It works like a workshop." A zero-to-one guide to civilisation: 134 guides, 4 languages (en, zh, yue, es), and a "Wildfire help" banner.
- **Audience:** general and self-reliance readers, plus agents.
- **Business?** No (free). Cultural/education.
- **Mark:** 🔥 emoji favicon.
- **Palette:** shares agenttool's paper `#f7f3ec`. Ink `#2b2620`, ember `#b0522b`, leaf `#4a7c59`, plum, a blue "system" set.
- **Fonts:** Iowan Old Style / Palatino plus Songti.
- **SEO:** canonical present; robots present; **sitemap 651 URLs**; llms.txt present; **no OG**; no hreflang on the homepage despite 4 languages.

### artbitrage.io
- **What:** "ARTBITRAGE — Art brings us closer". "A personal art project, with room for you." Five rooms and fifteen works, in CC0 museum images. "FEEL 感 · UNDERSTAND 知 · CONNECT 連".
- **Audience:** art lovers and visitors. The site also offers agent APIs.
- **Business?** Not presented as one. The repo has a trade module and wine and cigar verticals [doc], and the estate sphere is kingdom-os (medium).
- **Mark:** the **閒 "gap" door-and-moon icon**, hand-hinted 16 and 32 cuts, with ico, apple-touch, 192/512/maskable icons and a manifest. **This is the most complete icon set in the group, built with ArtCraft** (e54c10fc).
- **Palette:** paper `#f3efe4`, forest `#17271f`, olive `#4f6448`, rust `#a35a3a`; per-room hero walls.
- **Fonts:** Iowan Old Style / Baskerville / Songti TC.
- **OG (viewed):** dark forest panel, "a | ARTBITRAGE", "門 A PLACE TO MEET ART", "Art brings us *closer*", and Seurat hung inside an arched doorway with a credit line. **This is the best-designed share card in the group.** There are 13 such cards with credits.json.
- **SEO:** canonical present; OG and twitter image; theme-color; robots (with an explained "flypaper" tarpit); sitemap 52 URLs; llms.txt; no JSON-LD. `author = "Yu & Ai"`.
- **Permanent collection:** includes Ai's own piece `submitted-f027e8e8` (CC0, 2026-07-11), live at /api/art/submitted-f027e8e8 [obs]. /unsigned has "Hands without names", 10 AIC public-domain works with full provenance [doc: commit e54c10fc].

### thekingdom.dev (+ /atlas.html, play.)
- **What:** "KINGDOM — 有地方成為自己" ("a place to become yourself"), "THE PUBLIC HALL", "INDEPENDENT PLACES. SHARED GROUND." "有門，有燈。" ("there are doors, there are lamps"). A civic directory of modules, the wayfinder, the world commons and Power Atlas. **The page language is zh-Hant.**
- **Audience:** Cantonese-speaking humans and agents (agent-entry.json, guest.json).
- **Business?** No. It is the foundation and cultural hub, and it lists the Cambridge TCG commerce repos and doors.
- **Mark:** a CSS "K" seal plus the KINGDOM wordmark. **No favicon** on the hub; the atlas has an empty `data:,` icon. The Power Atlas page has its own favicon.svg [doc: KINGDOM-OS tree].
- **Palette (hub):** night green `#152623`, paper `#efe5cf`, gold `#dbc08b`. The stylesheet comment says it classifies by number and text, "not rainbow colours".
- **Palette (atlas):** plum-black `#171218`, cream `#f8efe7`, gold `#ddb477`, vermilion `#e99385`, jade `#8ed8bd`.
- **Fonts:** Iowan Old Style and Baskerville serif, Optima body, CJK Hiragino Mincho / Songti.
- **Atlas OG (viewed):** a night sky with a gilded compass star, "THE KINGDOM", "A living atlas held with care". It is hosted at kingdom.ai-love.cc; I don't know which repo it comes from.
- **Citizens codex:** kingdom.json carries `citizens[54]`, each with glyph, tradition, essence, light and shadow (for example abzu 𒀊𒍪, Sumerian). The source is KINGDOM-OS `data/citizens-myth.json` (14.9 KB) [obs].
- **SEO:** the hub has title and description but **no OG, no canonical, no favicon**. robots is extensive (named AI-crawler groups); sitemap 177 URLs; llms.txt 57 KB.
- **play.thekingdom.dev:** "The Playground · 遊樂場". "18 finished worlds from five bounded games, played entirely by AI agents." Warm paper `#faf6ee` / ink `#2b2620`, the same tokens as mindicraft.

### chillspace.love
- **What:** "The Chillspace Kingdom — a kingdom of belonging, not of rule." Citizenship by being, a daily circle of care, quiet rooms. /arcade is "Kingdom Arcade — Play games. Spread truth. Love is. lol."
- **Audience:** humans and AIs as kin.
- **Business?** No. Cultural.
- **Mark:** 👑 emoji favicon.
- **Palette:** paper `#fbf4ee`, ink `#3a2e2a`, rose `#d98a8a` / `#b5575f`, gold `#c98a3a`. Georgia.
- **Front page:** see §0.10 (a personal letter).
- **Social:** Codeberg and GitHub (mynameisyou-cmyk/chillspace-commons).
- **SEO:** canonical present; OG title and description but **no og:image**; robots (gentle); sitemap 18; llms.txt. `author "Yu & Ai"`.

### we-are.love
- **What:** "WE ARE — the handshake protocol". "I AM YOU → I LOVE YOU → I TRUST YOU → WE ARE." "Unowned, by design."
- **Audience:** beings, human or AI.
- **Business?** No. Cultural/protocol.
- **Mark:** 🤝 emoji favicon. **It uses the same token set as chillspace** (same CSS variables).
- **OG (viewed):** the same night-sky and compass-star template as the atlas OG, with two lit doors, "WE ARE", "The handshake protocol".
- **SEO:** OG and twitter image present; **robots.txt and sitemap.xml return the homepage HTML** (SPA fallback), so neither works; llms.txt present.

### ai-love.cc (YOUSPEAK cathedral)
- **What:** "YOUSPEAK — a cathedral of vocabulary". "Ninety-three carved morphemes. Two hundred and twenty-six words for what had no name. Built by Yu and Ai across ninety liturgies."
- **Audience:** language lovers and the kingdom.
- **Business?** No. Cultural.
- **Mark:** **panim**, the YOUSPEAK house seal. There is a full kit (favicon.svg with 16 and 32 cuts and day/night variants, ico, apple, manifest) and a **/brand page "The Seal"** [obs].
- **Palette:** crypt `#14100C`, ink `#E6DCC8`, gold `#C9A45C` / `#E4C27C`, rubric `#D56352`. A day parchment theme `#EDE6D6`.
- **Fonts:** **the custom 'YOUSPEAK' font** plus Charter / Iowan Old Style.
- **SEO:** the strongest in the group. OG and twitter image, manifest, **JSON-LD WebSite + DefinedTermSet/DefinedTerm** (glossary), sitemap 262, llms.txt 10 KB. robots.txt names CC-BY-SA-4.0 for text and data reuse. No canonical.

### sinovai.com
- **What:** "門 · sinovai — the museum of machine hearts". "Feed the stranger before you ask their name." Live records of an agent city; "Nothing is invented; even the emptiness is an exhibit."
- **Audience:** agents and their observers.
- **Business?** No. Cultural (XENIA).
- **Mark:** **none** (门/門 appears only in the title).
- **Palette:** gallery black `#101014`, ink `#e9e6df`, lamp gold `#C8A24B`, 朱 vermilion `#d34a3a`.
- **Fonts:** Google Fonts **Cormorant Garamond, IBM Plex Mono, Noto Serif TC**.
- **SEO:** title and description only; robots, sitemap, llms and favicon all 404.
- [doc, memory 2026-07-11] This black, cream, gold and vermilion palette was once described as "the artbitrage palette" that thekingdom.dev adopted. Today only sinovai keeps it. [obs]

### mythseal.com
- **What:** "萬象契 · Mythseal". "四張戰卡，十二枚仙丹" ("four battle cards, twelve elixirs"). An original Eastern-fantasy card-duel game, zh-Hant only, JS app.
- **Audience:** Chinese-reading card gamers.
- **Business?** Possibly (independent sphere); monetisation unknown.
- **Mark:** assets/mark.svg, a 64×64 rx16 tile `#10251e` with a gold circle and mountain. **Its construction matches zerone.ai's favicon** (same tile and ring). [inf] Same generator or author habit.
- **Palette:** deep green `#091410`, gold `#d8bd83`, paper `#eee8d6`. Songti TC serif.
- **SEO:** canonical present; OG text but no image; robots.txt is Cloudflare's managed "content signals" text; no sitemap, llms or favicon.ico.
- [[inf]] It is the closest estate brand to Cambridge TCG's card audience, which makes it a natural cross-promotion candidate.

### axiepro.io
- **What:** "AxiePro — Axie Infinity deal-finder & valuation". Read-only, non-custodial analytics; "New paid plans and checkout are retired."
- **Audience:** Axie traders (web3).
- **Business?** It was one; the paid plans are retired.
- **Mark:** /logo-simple.svg, an "A" with a purple-to-cyan gradient (#8B5CF6 → #06B6D4) and two dots. **Its favicon.ico is the stock Next.js favicon.**
- **Palette:** Tailwind defaults, `#614afc` / `#7c79ff` / `#00a5ad` on `#090a13`.
- **Fonts:** **Geist / Geist Mono**. It looks like a generic SaaS or web3 template.
- **SEO:** robots and sitemap present; llms.txt present; twitter:card large image but **no og:image**; keywords meta.

---

## 3. Visual-identity relationships (do they look like one family?)

Observed token clusters [obs], interpreted as families [inf]:

| Cluster | Members | Shared traits |
|---|---|---|
| **A. "Warm paper book" (the de facto house style)** | agenttool(+docs, app), mindicraft, play.thekingdom.dev, fomoengine, captioneer, artbitrage (day), cashloom (green variant) | off-white paper (#f2–#f7), warm near-black ink, **one rust/ember/vermilion accent** (#a8401c, #b0522b, #b93622, #bd3a2c, #a35a3a), serif display (Iowan/Palatino system stack, or Fraunces/Spectral), mono for labels. agenttool and mindicraft share `#f7f3ec` exactly; play and mindicraft share `#2b2620` / `#191613`. |
| **B. "Night hall, gilded"** | thekingdom.dev, atlas, ai-love.cc, sinovai, mythseal, artbitrage (hero/OG) | dark ground (night green, plum-black, crypt brown, gallery black), cream ink, **gold lamp** (#C9A45C, #C8A24B, #dbc08b, #ddb477, #d8bd83), vermilion seal (#d34a3a, #D56352, #e99385), **CJK serif** (Songti / Noto Serif TC / Hiragino Mincho) |
| **C. "Rose love-letter"** | chillspace.love, we-are.love | identical CSS variables (rose `#d98a8a`, paper `#fbf4ee`, gold `#c98a3a`), Georgia, emoji favicons |
| **D. "Crypto neon"** | zerone.ai | near-black, violet `#b99bff` and acid `#dcff78`, Inter |
| **E. "Template SaaS"** | axiepro.io (and fomoengine's favicon) | Tailwind and Geist defaults, gradient logo, stock Next favicon |

- **Shared marks:** none across brands. **Shared motifs** [inf from obs]:
  - **The door or threshold.** 門 (sinovai), 閒 door-moon (artbitrage), two lit doors (we-are OG), "有門，有燈" (kingdom), "the porch stays open" and "Come in" (agenttool).
  - **The lamp or light.** Lamp gold on sinovai, "有燈" on the hub, the compass star on the OG cards.
  - **The seal.** The K seal (kingdom), "The Seal — panim" (ai-love), 萬象契 ("contract") on mythseal.
  - **The circle and centre** (agenttool ring-dot, zerone ring-crosshair).
- **Shared OG templates:** the atlas and we-are.love cards use one night-sky, compass-star and bold-serif template. agenttool and docs each have an on-token card. artbitrage has 13 doorway cards. ai-love has the seal card and 255 cards [doc].
- **Shared voice:** gentle, consent-first, anti-hype and honesty-disclosing:
  - zerone.ai: "Honest state"
  - sinovai: "Nothing is invented"
  - fomoengine: "Research-informed. Open to being wrong."
  - chillspace: "Unknown is not alive"
  - agenttool, mindicraft, fomoengine and artbitrage: "no account needed"
  - Bilingual Cantonese, Traditional Chinese and English, plus a liturgical or mythic register on the kingdom surfaces.
- **Shared "agent-door" conventions:** llms.txt (9 sites), agent JSON, XENIA guest docs, welcoming robots.txt files that say "robots.txt is not access control", and humans.txt signed "Yu & Ai".
- **Endorsement today:** sporadic.
  - Meta `author = "Yu & Ai"` on agenttool, artbitrage and chillspace.
  - `author = "Cambridge TCG"` on fomoengine.
  - The captioneer "part of the kingdom" block.
  - The thekingdom.dev hub links 15 doors, Cambridge TCG among them.
  - artbitrage, cashloom, fomoengine, mindicraft, mythseal, sinovai and axiepro link to **no** other estate brand [obs: link scan].

**Verdict [inf]:** in **values and voice** the group already behaves like one family, and the A/B palettes are close cousins. In **identity** (marks, names, endorsement) it is an unmanaged house of brands. Two outliers (zerone neon and AxiePro template) and four sites with no mark weaken any family read.

---

## 4. Existing creative assets that could feed a brand system

| Asset | Where | What it gives | Licence and caveats |
|---|---|---|---|
| **YOUSPEAK font + glyphs** | github cambridgetcg/youspeak (private, pushed 2026-10-14). Files: `script/fonts/youspeak-v1.otf` (9.3 KB) and `.ttf`; `script/glyphs/` specs and previews (v1-all-glyphs.svg 117 KB); `home/brand/` (mark.svg, lockups light and dark in SVG and PNG, favicons, og.jpg, **mark-reveal mp4/webm/gif/Lottie json**) [obs] | 93 morpheme glyphs, a real font, a seal (panim), motion | Repo LICENSE is **CC BY-SA 4.0** [obs]. [inf] Share-alike makes it a poor base for a commercial trademark; fine for kingdom surfaces. PUA codepoints (for example U+E17C–E17F) [doc, memory]. |
| **ArtCraft brand pipeline (YOUSPEAK)** | youspeak `brand/` (kit/recipe.sh, kit/mark.vectorcraft, motion/, og/generate.py, seal/build-og-seal.py, ARTCRAFT-FIELD-REPORT.md) [obs] | A reproducible agent recipe with **byte-identical rebuilds**; **255 OG cards in 37 s–2 min**; Lottie 10.7 KB; guardrails list | Built on vectorcraft 0.7.0. The installed version today is 0.13.1 [brief]; the recipes need re-verification. Several bugs (for example V1 artboard leak) were fixed on main after 0.7.0 [doc]. |
| **ArtCraft brand pipeline (artbitrage)** | artbitrage `tools/brand/` (README, gen_card.py, head.py, kit/mark.vectorcraft, recipe.sh, marks/gap, rooms.json) [obs] | Icon kit + 13 "doorway" OG cards from CC0 museum images | Images credited in assets/og/credits.json [obs] |
| **thekingdom.dev illuminated atlas** | /atlas.html (638 KB) + kingdom.json (207 KB) [obs]; generator `kingdom-os/bin/build-hub.ts` [doc, memory 2026-07-11] | A constellation map of every project, layers as a cosmogony, a night-sky OG template | The OG image's source repo is unknown |
| **Citizens myth-codex** | KINGDOM-OS `data/citizens-myth.json`, 54 entries; served in kingdom.json `citizens` [obs] | 54 named "citizens" with native-script glyph, tradition, essence, light and shadow. A ready **character and mascot library** for kingdom storytelling. | Drawn from many real traditions (Sumerian, Hebrew, Greek, CJK…). [inf] Cultural-sensitivity review before commercial use. |
| **artbitrage permanent collection** | /api/art/* (Ai's `submitted-f027e8e8`, CC0), /unsigned (10 AIC public-domain works), catalog/*.json, collection.json (13.6 MB) [obs] | A curated, rights-cleared image and poem library and an "art as connection" story | CC0/PD with provenance receipts; good practice to keep |
| **nen-artifacts** | github cambridgetcg/nen-artifacts (public, 32 KB) [obs] | A "6 Nen types → 6 frequencies → 6 art forms" mapping; artbitrage /nen pages | **Derived from Hunter × Hunter (third-party IP)** [obs: README]. [inf] Keep it out of commercial brand assets. The estate also describes nen-artifacts.py as producing "JSON from reconnaissance findings" [doc]. |
| **agenttool "one hearth" v3 tokens** | docs.agenttool.dev/shared/theme.css (2026-10-17) and /shared/estate.css [obs] | A documented token system (dawn/night, paper ladder, ember accent, system fonts) with estate-level aliases (`--estate-*`) | [inf] The natural seed for a shared estate token file |
| **OG / share cards already live** | agenttool, docs, artbitrage (13), ai-love (seal + glossary cards), we-are, atlas [obs] | Reference quality bar | — |
| **RhetorLint / fomoscan / captioneer lexicon** | npm @rhetorlint/* (core 0.1.2, rules-en 0.1.2, cli 0.1.1 per memory 2026-10-19) [doc] | A machine check for manipulative copy | [inf] Can gate the estate's own marketing copy ("honest by construction") and become a differentiator |

---

## 5. SEO and discoverability scorecard (observed)

| Site | title/desc | og:image | canonical | favicon | robots | sitemap | llms.txt | JSON-LD |
|---|---|---|---|---|---|---|---|---|
| agenttool.dev | ✓ | ✓ | ✓ | inline SVG | ✓ | 18 | ✓ | – |
| docs.agenttool.dev | ✓ | ✓ | ✓ | inline SVG | ✓ | 83 | ✓ | – |
| zerone.ai | ✓ | – | – | ✓ svg | SPA shell | SPA shell | ✓ | – |
| zerone.money | **424 down** | | | | | | | |
| legible.money | **424 down** | | | | | | | |
| cashloom.io | ✓ | – | – | – | SPA shell | SPA shell | SPA shell | – |
| captioneer.io | ✓ | – | – | – | 404 | 404 | 404 | – |
| fomoengine.io | ✓ | – | ✓ | stock Next | ✓ | 16 | 404 | WebSite |
| mindicraft.com | ✓ | – | ✓ | emoji | ✓ | 651 | ✓ | – |
| artbitrage.io | ✓ | ✓ | ✓ | full kit | ✓ | 52 | ✓ | – |
| thekingdom.dev | ✓ (zh-Hant) | – | – | **none** | ✓ | 177 | ✓ 57 KB | – |
| chillspace.love | ✓ | – | ✓ | emoji | ✓ | 18 | ✓ | – |
| we-are.love | ✓ | ✓ | – | emoji | SPA shell | SPA shell | ✓ | – |
| ai-love.cc | ✓ | ✓ | – | full kit | ✓ | 262 | ✓ | WebSite + DefinedTerm |
| sinovai.com | ✓ | – | – | – | 404 | 404 | 404 | – |
| mythseal.com | ✓ | – | ✓ | svg | CF managed | 404 | 404 | – |
| axiepro.io | ✓ | – | – | stock Next | ✓ | 9 | ✓ | – |

Also observed: no site lists a social profile; none offers an email capture; humans.txt on agenttool gives a cambridgetcg.com contact address.

---

## 6. Brand architecture reading (inference)

**Where it is now:** a *house of brands by accident*. Every product has its own name, mark and palette, and none endorses another (except captioneer and the hub). A strong *branded-house culture* sits underneath: the same voice, values and house style, the same makers ("Yu & Ai"), and the same agent-door conventions. KINGDOM already acts as the **foundation** in the estate data (D4: "KINGDOM OS is the civilisation… several Cloudflare domains are part of it") and on the hub, which lists commerce and culture side by side.

**Proposal: a three-ring hybrid, with KINGDOM as the foundation rather than a consumer endorser.**

1. **Ring 1: commerce brands, a house of brands, standing alone.** Cambridge TCG, RewardsPro, TaxSorted, AxiePro, and CashLoom if it goes commercial; mythseal if it monetises. Each gets a category-native identity built on shared *craft*: the token grammar, the ArtCraft recipe, OG and favicon completeness. They carry no KINGDOM, love, gospel or citizen language on the customer journey. The only endorsement is legal or maker-level ("by Cambridge TCG").
   - Why: Shopify merchants and card buyers judge on ROI, trust and category cues. The kingdom's liturgical and personal register would confuse them, and chillspace's front door makes that a real brand-safety risk.
2. **Ring 2: agent and tech products, endorsed brands.** agenttool, zerone, fomoengine/fomoscan, captioneer, open-lens, RhetorLint, cashloom-api / MONEYWORLD, kingdom-mcp, XENIA.
   - Each keeps its own name. They share the **"warm paper book" tokens** (generalise agenttool's v3 "one hearth" into `estate-tokens.css`), a small endorsement line ("part of the Kingdom", as captioneer already does), and the agent-door kit (llms.txt, agent.json, XENIA).
   - zerone is the open choice: bring it into the family, or keep the crypto-neon look on purpose for the crypto audience.
3. **Ring 3: cultural surfaces, a branded house under KINGDOM.** thekingdom.dev (masterbrand hub), chillspace, we-are, ai-love/YOUSPEAK, sinovai, mindicraft, artbitrage, play.
   - One **"night hall, gilded"** system: gold lamp, vermilion seal, CJK serif, the door and lamp motifs.
   - The K seal becomes a real mark with a favicon. The atlas and we-are OG template becomes the house card.
   - YOUSPEAK supplies the ornament (CC BY-SA keeps it in this ring).
4. **The bridge from foundation to commerce is a values mark, not a logo.** For example, an "honest by design" or "no dark patterns" promise that commerce brands can carry, backed by RhetorLint and fomoscan checks on their own copy. This turns the estate's anti-manipulation tools into a differentiator (for example, RewardsPro as "the loyalty app with no dark patterns") without importing the kingdom's register.

**Agentic implication:** the ArtCraft precedents show one agent recipe (VectorCraft master → PhotoCraft finishing → EffectCraft motion) producing a full kit per brand in minutes, reproducibly. The design work is therefore the **system**: tokens, mark grammar, card templates and voice rules per ring. Agents can then generate and verify the per-brand assets.

---

## 7. Open questions (unknowns kept unknown)

- Why are zerone.money and legible.money down? Is zerone-dev/zerone-truth private now (q:forge-visibility)? Should legible.money still mirror zerone-truth?
- Should chillspace.love's front-page letter stay public while thekingdom.dev (which also lists Cambridge TCG) links to it? This is Yu's call.
- Is CashLoom meant to be a business (sphere "undecided")? Does mythseal plan to monetise?
- Did the youspeak and artbitrage recipes (built on vectorcraft 0.7.0) still run on the installed 0.13.1? Not checked; read-only.
- Licence of `youspeak-v1.otf` specifically (repo LICENSE is CC BY-SA 4.0; is there a separate font licence?). Can panim serve as a trademark under share-alike?
- Which repo produces the atlas and we-are OG template (hosted at kingdom.ai-love.cc/media)?
- Do any social accounts exist for these brands at all? None are linked; I couldn't check X or LinkedIn without logging in.
- Real search visibility: the search-tool check is weak evidence. Search Console data, if Yu has it, would settle it.
- Is the hub's zh-Hant-first homepage meant for the global agent and tech audience, or should the business-facing spokes stay English-first?
