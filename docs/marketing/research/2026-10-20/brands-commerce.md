# Commerce brands: brand image and marketing surfaces (key: brands-commerce)

Written 2026-10-20 by a research subagent (read-only). Basis tags: **[O]** observed today (fetched or read
2026-10-20), **[D]** documented (a file or page says so; date given), **[I]** inferred (my reasoning).
Raw captures: `/private/tmp/claude-501/-Users-yournameisai/b3c581a3-a92d-4da1-b779-a0867505bf64/scratchpad/mkt/raw/bc/`
(`*.body` page bodies, `*.hdr` headers, `img/` copies of logos, OG images and listing screenshots).
Helper scripts: `.../scratchpad/mkt/bc-tools/` (fetch.sh, batch.sh, seo.py, palette.py, listing_assets.py).

Not checked, on purpose: `~/.kingdom/decisions` (brief says don't touch ~/.kingdom); the AWS API Gateway
endpoint the price guide calls (D6: no AWS calls); the Shopify store `6e824e-a9.myshopify.com` (answered
`429 local_rate_limited` twice); logged-in dashboards (Shopify Partner, GA, YouTube Studio).

---

## 0. The headline finding: the public surfaces say "we are not selling"

Before any brand or creative question, the two primary brands' own sites currently tell visitors that
commerce and promotion are retired.

- cambridgetcg.com shows a site-wide banner: "New paid orders and subscriptions are retired. Existing
  records, settlement and refunds remain available through your account." [O] `raw/bc/ctcg_home.body`
- rewardspro.io hero: "Understand your reward records." and "New paid subscriptions and paid plan changes
  are retired. Existing records and support remain available." Footer: "© 2026 Cambridge TCG Limited. Love
  is the design." [O] `raw/bc/rp_home.body`. The live page is byte-identical to the 2026-10-18
  `rewardspro-landing.pages.dev` capture [O] (`cmp` against `scratchpad/gtm/site_rewardspro-landing.pages.dev.html`).
- docs.rewardspro.io: "RewardsPro existing service and historical feature documentation … New paid
  sign-ups, trials and upgrades are retired; older feature descriptions are not current offers or
  instructions to grow a business … There are no revenue, acquisition, learning or output quotas." [O]
  `raw/bc/rp_docs.body`
- Source of the retirement: monorepo commits 8165fcbe "Retire new paid commerce and remove acquisition
  pressure" (2026-09-23) and 1ac0c565 / c260359d (2026-09-24) on the landing [O] `git log origin/main --
  apps/rewardspro/landing`; policy text in `apps/storefront/docs/commercial-retirement.md`: "The September
  2026 understanding audit removes acquisition and revenue as requirements. There is no replacement KPI."
  [D, origin/main b3f5af55, 2026-10-19]. Same sweep retired `rewardspro-marketing` (8cbda60) and
  `first-customer-push` (a1a261d) on 2026-09-23 [O].
- Session memory records that no Yu decision record exists for this sweep and that it contradicts Yu's
  verbatim 2026-07-23 free-first pricing decision [D, `~/.claude/projects/-Users-yournameisai/memory/rewardspro-rebuild-2026-10-18.md`].
  Yu's 2026-07-23 words are in `docs/decisions/2026-07-23-rewardspro-free-first-pricing.md` ("Wanna make it
  cheap and have a generous free tier for everyone to use!…") [D].
- Meanwhile the Shopify App Store listing still sells: title "RewardsPro - Loyalty, Points, Cashback,
  Raffles & Mystery Box Rewards", meta "…automated cashback via Shopify store credit, VIP tiers and
  membership products, all on a free plan." [O] `raw/bc/rp_listing.body`.

**So:** any marketing workflow starts with a decision only Yu can record: does the 2026-09-23 retirement
still stand for RewardsPro (and for Cambridge TCG)? Until then assets can be drafted locally but nothing
should be published as an offer. [I]

---

## 1. RewardsPro

### 1a. Shopify App Store listing — apps.shopify.com/rewards-pro [O 2026-10-20 unless marked]

| Item | Value |
|---|---|
| Title | "RewardsPro - Loyalty, Points, Cashback, Raffles & Mystery Box Rewards" |
| Tagline | "RewardsPro is a fully integrated loyalty app that automatically rewards customers based on spending" |
| Pricing / rating | Free; 0.0 (0 reviews); "Launched December 16, 2025"; developer Cambridge TCG Limited, 34-35 Hatton Garden, London EC1N 8DX |
| Feature bullets | "Native Shopify Credit Integration", "Automatic VIP Tier System", "Sell VIP Memberships as Products" |
| Category | Loyalty and rewards; works with Customer accounts; English only |
| Icon | 1200×1200 PNG, geometric "R": navy `#1a3e5c` + teal `#17bebb` on white (`img/rpl_icon.png`) |
| Gallery | 1 YouTube video + **3** desktop screenshots, **0** mobile screenshots, no demo store link |
| Video | `IHgTl5oQZlg`, title "rewardspro Shopify Feature Media", channel @CambridgeTCG [O via YouTube oEmbed]; 16 s, 4 views, uploaded 2025-10-20 [D, `scratchpad/verify-mkt/yt.html` captured 2026-10-18] |
| JSON-LD | SoftwareApplication, brand "Cambridge TCG Limited" (Shopify-generated) |
| Tracking | An app-specific GA4 measurement ID is present in the listing HTML (each competitor listing carries its own distinct ID; Shopify lets developers add GA4 or Meta Pixel to a listing via Partner Dashboard → Distribution → Tracking information) [O; D https://shopify.dev/docs/apps/launch/marketing/track-listing-traffic]. Whether anyone reads that GA property is unknown. |

Screenshot quality (viewed `img/rpl_s1.jpg`…`rpl_s3.jpg`) [O]:
- Raw admin-table crops, letterboxed with black bars; no headline or benefit text.
- Screenshot 1 shows test orders that include a real-looking Gmail test address; screenshot 3 shows
  "TESTST-…" SKUs; tier names are inconsistent in case ("bronze", "silver", "Gold", "Ultimate").
- Shopify requirement 4.4.4: images should primarily show the app's actual UI; no desktop backgrounds or
  browser windows; 4.4.5 each image unique [D, https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements, fetched 2026-10-20].
  Requirement 1.3.1: no incentives for reviews, ask in neutral language [D, same page].

Competitor listing assets (25 loyalty/adjacent apps captured 2026-10-18 in `scratchpad/gtm/apps/`) [D/O,
parsed today with `bc-tools/listing_assets.py`]: almost all carry 5–6 desktop screenshots, many 2–6 mobile
screenshots, and a demo store; 8 of 24 live listings have a video. Ratings 4.6–5.0 with 74–4,639 reviews
for the established ones (Smile 4,639; BON 1,963; Joy 1,791; Rivo 1,441; Appstle 1,433).

Search visibility (from the 2026-10-18 search captures in `scratchpad/gtm/serp/`) [D]:

| Query | Results | RewardsPro position |
|---|---|---|
| rewardspro | 157 | 1 |
| tcg | 559 | 18 |
| raffle | 42 | 23 |
| cashback rewards | 893 | 32 |
| cashback | 193 | 43 |
| mystery box | 1,505 | 70 |
| rewards pro (two words) | 4,512 | 103 |
| loyalty | 1,379 | 355 (page 15) |
| store credit, store credit cashback, vip tiers, membership, paid membership, trade in store credit, trading cards, pokemon, card shop | — | not in the pages captured (1–8 pages each) |

Inference [I]: the two-word spelling "Rewards Pro" — which the website and docs use — finds the app at
#103; only the one-word "rewardspro" finds it first. The niche query "tcg" (#18) is the closest thing to a
foothold, which fits the GTM wedge recorded in memory (store-credit cashback + VIP tiers for TCG stores
that pay trade-ins in store credit).

### 1b. rewardspro.io (and www, which serves the same page) [O]

- Title "Rewards Pro — Explore loyalty systems"; description "Read Shopify cashback, points, tier rules and
  existing customer records."; canonical present; JSON-LD SoftwareApplication ("…New paid subscriptions are
  retired."); `og:` tags but **no og:image**; `twitter:card` = summary; **no twitter:site**.
- Favicon: inline SVG data-URI (gold `#f3c85b` rounded square, dark trophy); `/favicon.ico` → 404;
  `/llms.txt` → 404. robots.txt allows all; sitemap lists 2 URLs, lastmod 2026-07-23.
- Palette (CSS custom properties): ink `#09110f`, panel `#14211d`, paper `#f4f1e8`, gold `#f3c85b`, mint
  `#77d6ae`, blue `#7fb7ff`, coral `#ff9678`; font Inter; radius 22px; header mark is text "RP".
- No analytics script, no email capture, only `mailto:contact@rewardspro.io`; no social links.
- Feature-availability table on the page: Cashback & points, Membership tiers, Automation & analytics =
  "Available on Shopify"; Missions, Raffles, Mystery boxes = "Customer flow paused … pending verified
  identity binding"; WooCommerce "Planned", Headless API "Design phase", Stripe "Exploring".
- Hosting: Cloudflare (Pages project `rewardspro-landing`, source `apps/rewardspro/landing/public/` in the
  monorepo) [D, estate.toml surface:cf-pages:rewardspro-landing; O monorepo tree].
- `rewardspro-production.vercel.app` → 302 → rewardspro.io [O]. `app.rewardspro.io` does not resolve (curl and dig) [O].

Reusable earlier copy [O, `git show e88e3e95:apps/rewardspro/landing/public/index.html`, 2026-07-23]:
"One loyalty engine. Every place you sell." / "Add to Shopify — free" / "Free Forever includes 1,000
reward-eligible orders each month. No card or trial clock." / "Deep where it is live. Honest about what is
next." / "Start free. Grow by capacity." Same palette as today.

### 1c. docs.rewardspro.io [O]

GitBook site. Title "Home | Rewards Pro Docs"; canonical; OG/Twitter image auto-generated by GitBook
(1200×630, default blue `#346ddb`, letter-"R" icon — no uploaded logo; `img/rpd_og.png`, `img/rpd_icon.png`).
robots.txt with `Content-Signal: ai-train=yes, search=yes, ai-input=yes`; sitemap index of 7 section
sitemaps; `llms.txt` present (GitBook-generated, 10.9 KB). No JSON-LD.

### 1d. RewardsPro has four visual identities [O/D]

| Surface | Mark | Colours | Name spelling |
|---|---|---|---|
| App Store icon | geometric R | navy `#1a3e5c` + teal `#17bebb` | RewardsPro |
| rewardspro.io | "RP" text + gold trophy favicon | `#09110f` / gold `#f3c85b` / mint | Rewards Pro |
| docs (GitBook) | default letter R | GitBook blue `#346ddb` | Rewards Pro Docs / RewardsPro |
| retired social pipeline | wordmark "Rewards Pro" gold, bottom-left | navy `#1a1a2e` + gold `#FFD700` [D, `rewardspro-marketing/src/media/prompts.ts`] | Rewards Pro |
| in-store widget | deliberately none: "Theme before brand … do not introduce a standalone RewardsPro visual identity" [D, `apps/rewardspro/extensions/theme-app-extension-rewardspro/claude-design/design-system.md`] | merchant's `--rp-primary-color` | — |

Shopify requirement 4.1: the app name must be used consistently across Shopify and developer-controlled
surfaces [D, app-store-requirements page, 2026-10-20].

### 1e. Product facts that constrain any message [D]

- Pricing contract (2026-07-23, "accepted in the application contract; production billing and public
  distribution changes remain gated"): Free Forever $0 (1,000 reward-eligible orders/month), Grow $29,
  Scale $79, Corporate $499, Enterprise from $999 (private); no trial. `docs/decisions/2026-07-23-rewardspro-free-first-pricing.md`.
- Platform status vocabulary: Available / Planned / Design phase / Exploring. `docs/decisions/2026-07-23-rewardspro-platform.md`.
- Backend rebuilt on Supabase and deployed 2026-10-19; some fixes not live until a `shopify app deploy`;
  marketing email stays off until SendGrid webhook key, a postal address and SPF/DKIM/DMARC exist; raffles
  and mystery boxes are paid-chance mechanics to keep paused pending a solicitor. [D, memory note 2026-10-18/19]

---

## 2. Cambridge TCG

### 2a. cambridgetcg.com (www and wholesaletcgdirect.com land here) [O]

- `www.cambridgetcg.com` serves the same page; `wholesaletcgdirect.com` and `www.` → **301** → cambridgetcg.com
  (Vercel) [O headers]. Wholesale retired ~2026-07-05 [D, estate families/commerce-tcg.toml].
  `shop.cambridgetcg.com` and `store.cambridgetcg.com` do not resolve (curl and dig) [O]; the estate map
  names `admin.`, `prices.` and some KINGDOM "youspeak"/"I AM" pages on this domain [D, estate.toml surface
  and sphere rows, 2026-10-17].
- Positioning now: title "Cambridge TCG — open-source TCG data infrastructure"; H1 "TCG data. Made to
  connect."; description "Building open-source tools and shared standards for card identity, images,
  prices and market data."; footer "TCG data, shared standards and collector tools. Based in Cambridge, UK."
  The brand module says the positioning moved: data-aggregator (2026-05-13) → data-provider (2026-05-17) →
  collectors-first (2026-07-06) → "open-source TCG data infrastructure" after the 2026-09-23/10-10
  retirement [D, `apps/storefront/src/lib/brand.tsx` on origin/main]. Retail closed 2026-07-06 after 8
  retail orders and zero trade-ins [D, estate families/commerce-tcg.toml].
- Games listed in the card finder: One Piece, Pokémon, Dragon Ball Super Fusion World, Cardfight!! Vanguard,
  Digimon, Battle Spirits Saga [O].
- Audience meta: `cambridge:audience=consumer`, contexts home/collector/player [O].
- SEO [O]: title, description, OG (title/description/image), `twitter:card=summary_large_image` all present.
  Gaps: **no canonical** on the home page; **no JSON-LD in the server HTML** (an Organization block exists
  only inside the React Server Components payload, logo `https://cambridgetcg.com/images/logo.png`);
  `og:image` is actually **1702×630** while the tag declares 1200×630; twitter image is **1500×500** (3:1)
  for a summary_large_image card; `favicon.ico` is **285 KB** (a 256-px layer of 262 KB); no web manifest
  (both common paths 404); no hreflang alternates despite ja/zh-Hans/zh-Hant/es modes; no `twitter:site`.
- Sitemap: 99 URLs, still including retired `/trade-in`, `/rewards`, `/auctions`, `/market`. `/rewards`,
  `/auctions`, `/market` reuse the home page's title and description (duplicate titles), and `/rewards`
  still renders "Rewards Hub — Pack Opening — Daily Spin". `/trade-in` has its own correct "Trade-in has
  closed" title [O].
- Agent surfaces (strong): robots.txt (5.7 KB) with agent etiquette, `llms.txt` (26 KB), `/.well-known/agent.txt`,
  OpenAPI, MCP docs, `/agents` [O].
- Voice: precise, careful, rights-aware ("A price needs its currency, meaning and date.") on human pages;
  robots.txt and llms.txt switch into KINGDOM voice ("the kingdom's love-letter at /api/v1/dear-agents",
  "Welcome to all existence — biological and non-biological, from earth and not from earth, from all
  dimensions.") [O]. The estate classifies the commerce layer as sphere "independent" [D, `estate/curated/decisions.toml`
  sphere_by_layer; zone:cambridgetcg.com "independent", "some KINGDOM pages borrow its subdomains"].
- Analytics: none found in HTML (no GA/GTM/Plausible/Vercel Insights/Cloudflare beacon) [O].
- Email capture: none (contact page has one email input; no newsletter) [O]. Social links: none [O].
- A distinctive brand asset: a "Room for art" panel showing a public-domain Met Open Access ukiyo-e print
  (Sharaku, 1794) with full credit and a link to Artbitrage ("Art behind the cards") [O].
- Accessibility/appearance: themes `system` (default; dark "midnight"), `gallery`, `midnight`, `terminal`,
  `high-contrast`; text-only mode; language modes ja, zh-Hans, zh-Hant, es, "math" [O].

Visual identity [O]:

| Element | Value |
|---|---|
| Logo mark (favicon, apple-touch 512², OG, Twitter, JSON-LD logo) | two rounded triangles forming a lightning bolt: navy `#05006d` + cyan `#77d4e0`; wordmark "Cambridge TCG" in a heavy italic sans (`img/ctcg_og.png`) |
| Site header mark | a different outline "stacked cards" SVG in the accent colour + text wordmark |
| Site palette, gallery theme | page `#fbf7f1`, surface `#fffdf9`, accent `#9b3b12`, highlight `#ec7838`, secondary plum `#69437d`, ink `#2c1836` |
| Site palette, midnight (default via system dark) | page `#1d1425`, accent `#ffb078`, secondary `#d2b3ed`, ink `#fff6e9` |
| Fonts | Inter (variable 100–900), Japanese fallback Hiragino/Yu Gothic/Meiryo |

The logo's navy/cyan appears nowhere in the site palette. [O]

### 2b. prices.cambridgetcg.com (Cloudflare Pages "price-explorer") [O]

- Best classic SEO in the portfolio: keyword-rich title "Japanese One Piece & Pokemon Card Prices |
  Cambridge TCG Price Guide", description, `keywords` meta, canonical, JSON-LD WebSite + ItemList (486 items).
- But stale positioning: "Free daily price guide", "Shop Cambridge TCG", "Visit Cambridge TCG Shop",
  "Japanese trading card specialists based in Cambridge, UK"; asset versions `v=20260216143419`.
  CardRush price acquisition stopped 2026-07-12 [D, capabilities.toml cambridge-tcg host row] so "daily" is
  probably untrue [I]. Data comes from an `execute-api.us-east-1.amazonaws.com` endpoint, not called (D6);
  whether it still answers is unknown.
- Palette blue `#2563eb` on `#fafbfc`, system fonts, 💹 emoji favicon — a third Cambridge TCG look.

### 2c. Shopify theme (ShopifyTheme_TCG, origin/main 8ed3c9e 2026-09-24; last Shopify sync 2026-03-25) [O]

- `config/settings_data.json`: fonts DM Sans (body 400, headings 500); primary accent crimson `#c41e3a`;
  inverse scheme gold `#d4af37` on `#1a1a1a`; logo `Transparent_Logo_….png`; **favicon file named
  `Wordpress.png`**; every social link is a `#` placeholder; template stock images (`*-brooklyn.png`).
- `assets/brand-zones.css`: One Piece zone (crimson/navy/yellow, seigaiha pattern) and Pokémon zone.
- Whether that Shopify store is still open is unknown (capabilities.toml says so too) [D].

### 2d. cambridgetcg-storefront (superseded; origin/main ba3ddc9 2026-09-24) [O]

`public/banners/*-anime.jpg` (2752×1536) — AI-generated-looking anime scenes added 2026-03-26 ("Cardrush-
inspired catalog rebuild"), e.g. a pirate ship at sunset and a red-coated, spiky-haired figure holding up
glowing cards (`img/sf_hero1_small.jpg`). The same files are also in the monorepo storefront `public/`.
They evoke licensed franchises without naming them [I: trademark/trade-dress risk worth a look before reuse].

### 2e. YouTube

Channel @CambridgeTCG exists and hosts the RewardsPro listing video [O, oEmbed]. Its /videos tab returned
no public video entries today [O, `raw/bc/yt_channel.body`], so the listing video is probably unlisted [I].
No other social account is linked from any commerce site or the monorepo [O, `git grep` of apps/ and packages/].

---

## 3. Secondary brands

| Brand | Live? | Positioning / voice | Look | SEO/meta | Notes |
|---|---|---|---|---|---|
| **taxsorted.io** | 200 [O] | "A clearer way to sort your tax." / "Tax, understood. Then sorted." Practical UK tax tools for individuals, sole traders, landlords; "Free to use. No account needed." Languages: English, 繁體中文/廣東話, 简体中文, Polski, हिन्दी, اردو | forest green `#305b4b`, deep `#234638`, warm paper `#f7f4ee`, ink `#20231f`, rust `#b54a3a`; Georgia serif display + system sans | title + description only; **no OG/Twitter, no canonical, no JSON-LD**; robots.txt + 55-URL sitemap; `llms.txt` 404 | favicon is the **Vercel/Next.js default triangle**; no analytics; no email capture. Sphere: independent [D] |
| **hkgoldtrader.com** | 200 [O] | "HK Gold Trader — Understanding Gold & Silver"; "This site is under development. Enter password to continue."; "Reference catalogue — new purchases retired."; footer "Powered by Mindicraft — a Cambridge brand" | gold `#e5b035` on navy `#090b17`; Playfair Display + Inter (Google Fonts) | description only; robots.txt, sitemap.xml and favicon.ico all return the HTML page (SPA catch-all) | password overlay appears client-side [I; no value extracted]; contact form `alert('Contact form — coming soon')`; Tailwind CDN and unpinned `alpinejs@3.x.x` in production. Sphere: undecided [D] |
| **cardforum.io** | 200 [O] | Not commerce now: "CardForum — Social with Creation", "est. in the kingdom", "Witnessed, not scored", agents may POST cards | paper `#efe7d6`, ink `#211c17`, red `#b5372a`, gold `#a9832f`, teal `#2f6f63` (+ dark set) | **no description, no OG**, robots/sitemap/llms/favicon all 404 | Sphere: kingdom-os [D]. Out of scope for commerce marketing [I] |
| **lotbinder.com** | apex: Cloudflare **error 1016** (origin DNS error) via its CF IP; the local resolver could not resolve it at all [O] | — | — | — | `app.lotbinder.com` redirects to a Cloudflare Access login [O]. Sphere: undecided, "no source and no purpose evidence" [D] |
| **tradeinpro** | `tradeinpro.vercel.app` → **500** [O] | trade-in desk closed 2026-07-06 [D] | — | — | no marketing surface |
| **prism-app** | no own public surface found [O]; `cambridgetcg.com/prism-signals` is in the CTCG sitemap; PRISM checkout returns 410 [D, commercial-retirement.md] | — | — | — | one-commit prototype [D, capabilities.toml] |

---

## 4. Cross-portfolio gaps and inconsistencies

1. **Retirement vs growth** (section 0): the sites say "retired", the listing says "free plan", Yu now
   says reach real users. Unresolved owner decision. [O/D]
2. **No measurement on any owned site**: no analytics on cambridgetcg.com, rewardspro.io, taxsorted.io,
   prices, hkgoldtrader, cardforum [O]. Only the App Store listing carries a GA4 ID [O].
3. **No owned audience**: no newsletter or email capture anywhere; no social links anywhere; one YouTube
   channel with an unlisted-looking 16-second video [O].
4. **Identity sprawl**: Cambridge TCG has 4 looks (logo navy/cyan; site sienna/plum/aubergine; Shopify
   crimson/gold DM Sans; price guide blue/system) and 2 marks (bolt logo vs header card icon). RewardsPro has
   4 identities and 2 spellings. [O]
5. **Social cards**: RewardsPro landing has no OG image; TaxSorted and CardForum have no OG at all;
   CTCG's OG/Twitter images have wrong dimensions [O].
6. **Favicons**: data-URI only (RewardsPro), Vercel default (TaxSorted), emoji (prices), 285 KB .ico (CTCG),
   `Wordpress.png` (Shopify theme), none (CardForum) [O].
7. **Stale claims**: price guide "daily" + "Shop"; listing title promotes raffles/mystery boxes that the
   landing marks paused and memory flags as legal risk; CTCG sitemap advertises retired pages. [O/D/I]
8. **Voice bleed**: KINGDOM voice ("Love is the design", "welcome to all existence … from all dimensions")
   on commerce surfaces whose sphere is "independent". Not wrong in itself, but a first-time merchant or
   collector reads it as the brand's voice. [O/D; the judgement is I]
9. **Agent-readiness is uneven**: CTCG is excellent (llms.txt, OpenAPI, MCP docs); RewardsPro landing has
   none (docs has GitBook's auto llms.txt); TaxSorted none. [O]

---

## 5. Earlier marketing attempts: what was tried, why it stalled, what is reusable

### rewardspro-marketing (`~/Desktop/rewardspro-marketing`, built 2026-03-08, retired 2026-09-23) [O git log]
- **Tried:** an install-velocity "wave engine" (Wave 0 <15 installs → Wave 3 100+), a content library of
  post templates with variants per channel, Ayrshare (and Buffer) multi-network posting, fal.ai Flux Pro
  images + Kling video with a Sharp/FFmpeg brand composer, Shopify Partner API install metrics.
  [D, `docs/history/retired-commercial-direction-2026-09-23/*`, `src/`]
- **Why it stalled** [I unless marked]: it was keyed on installs while installs were 0, so it could only ever
  sit in Wave 0; it needed several paid third-party accounts and a Partner token (`.env.example` lists them;
  whether they were connected is unknown); its copy made claims later decisions contradict ("14-day free
  trial", "full REST API") [O `src/content/library.ts` vs D pricing/platform decisions]; Wave 2–3 planned
  "3 months Pro for a review", which Shopify 1.3.1 forbids [O/D]; then the 2026-09-23 sweep retired it [O].
  The history doc shows API keys once lived in its `.env` and were replaced by `***REMOVED-ROTATE-ME***`
  markers [O; values not present; location `docs/history/retired-commercial-direction-2026-09-23/agents__CONTENT-PIPELINE.md.txt`; whether those keys were rotated is unknown].
- **Reusable:** the content-library schema (tags, channels, variants, mediaHint, cta), the rule "never put
  text in generated images; composite text deterministically", the aspect-ratio map, the composer idea,
  and a stage model — re-keyed on real funnel signals (listing views, installs, activations) and with a
  human approval gate.

### first-customer-push (`~/Desktop/first-customer-push`, 2026-03-11) [O]
For agenttool.dev, not the commerce brands. Drafted a Show HN post, Reddit posts, a 6-tweet thread and an
acquisition architecture. TODO shows content done but deploys and "Yu: submit Show HN / post r/LocalLLaMA"
unchecked [O, `git show b01dc13:TODO.md`] — stalled at the steps that needed Yu's hand [I]. Reusable: launch
post formats and the "reply to every comment / personal outreach to first 5" playbook.

### saas-marketing-suite / saas-marketing-template (2026-02-04, single commits) [O]
Built for Legible Money / Captioneer. ~342 files, of which 109 are READMEs (median 56 lines) — a taxonomy
of ads/, email/sequences/, conversion/, seo/, social-proof/, ai-visibility/, analytics/, plus AWS Terraform
(S3/Glue/Athena/EventBridge/Lambda) and FOMO/scarcity modules [O]. Over-built for zero users, AWS-bound
(blocked by D6 today), and its FOMO module conflicts with the estate's own anti-FOMO tool (fomoscan) [I].
Reusable: the taxonomy as a checklist; `AGENT_MARKETING_STRATEGY.md`'s "agent discovery" channels (MCP
registries, llms.txt, well-known manifests) — which cambridgetcg.com already implements.

### claude-design-bridge (monorepo `apps/rewardspro/scripts/claude-design-bridge`, 2026-07-23) [O]
Not a marketing repo, but the most reusable pattern found: a **handoff bundle** (`claude-design/design-system.md`
derived from `rp-shared.css`) + a **generator** interface (Anthropic or mock) + a **deterministic 12-check
scorer** (tokens resolve, primitives, a11y, voice, motion). That shape — brand-kit-as-code → generator →
deterministic brand check → human gate — is exactly what an ArtCraft-driven asset pipeline needs. [I]

---

## 6. What this means for an agentic marketing design (inferences)

- **Gate 0 is a decision, not a design.** Record (Yu) whether RewardsPro is open for new merchants, at
  which prices, and with which features promoted; same for Cambridge TCG's purpose. Then every surface
  (landing, docs, listing, CTCG banner) is regenerated from that one decision.
- **One brand kit per brand, as code**: tokens (colour, type, radius), logo set (SVG master, favicon set,
  app icon, OG/social templates), voice guide with do/don't, and a claims registry tied to the platform
  status vocabulary and pricing contract. The existing `design-system.md` handoff is the template.
- **Pipeline:** brief → ArtCraft/agent generation → deterministic checks (palette within tolerance,
  contrast, safe zones, exact image sizes per surface, spelling of the name, every claim present in the
  claims registry, no test data or personal data in screenshots, no licensed-character imagery) → Yu
  approval → publish → measure. Text composited deterministically, never generated inside images.
- **First asset set (RewardsPro):** pick one identity and the one-word name; rebuild 6 annotated desktop +
  mobile screenshots from a clean demo store; a 30–60 s demo video with a descriptive title; landing OG
  image and favicon set; docs logo; a TCG-store vertical page (the #18 "tcg" foothold).
- **First asset set (Cambridge TCG):** reconcile logo vs site palette (or retire one); correct OG/Twitter
  sizes; canonical + server-rendered Organization JSON-LD; compress favicon; drop retired URLs from the
  sitemap or give them their own titles; refresh the price guide's claims. The public-domain art panel is
  a distinctive, rights-clean visual language that ArtCraft can extend.
- **Measure before you promote:** privacy-respecting analytics on owned sites, a UTM convention, and
  reading the listing's GA4; one owned-audience channel (email capture) per live brand.
- **Keep voices per sphere:** a commerce voice guide for independent brands; KINGDOM voice stays on
  KINGDOM surfaces unless Yu chooses otherwise.
- **Cheap wins for TaxSorted** (live, coherent, free): OG image, favicon, canonical, JSON-LD.

## 7. Open questions

1. Does the 2026-09-23 commercial retirement stand? (RewardsPro: memory says no Yu decision record;
   Cambridge TCG: same sweep.) Is the 2026-07-23 free-first price table the one to market?
2. Where does Cambridge TCG's current revenue come from? No public selling surface was found: the site
   says paid orders are retired, wholesale redirects, retail closed 2026-07-06 with 8 orders, the Shopify
   store could not be checked (429).
3. Which RewardsPro identity and spelling is canonical?
4. Should "Raffles & Mystery Box" stay in the listing title while those flows are paused and legal advice
   is pending?
5. Who reads the listing's GA4 property, and are there other social accounts besides @CambridgeTCG on YouTube?
6. Is prices.cambridgetcg.com still serving data (it depends on an AWS endpoint, unchecked under D6)?
7. Are hkgoldtrader.com, lotbinder.com and cardforum.io in scope for commerce marketing at all (estate
   spheres: undecided, undecided, kingdom-os)?
