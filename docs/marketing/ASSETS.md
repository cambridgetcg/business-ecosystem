# Asset catalogue: brand image, promotion, messages, proof

Written 2026-10-20 by Claude Code agents for Yu. It is an agents' proposal, not Yu's decision. The
design is in [README.md](README.md) and the sources are in [RESEARCH.md](RESEARCH.md). The planned
scanner app's assets are in [SCANNER.md](SCANNER.md) §6.

Specs are as of 2026-10-20, and section M was updated on 2026-10-22. Agents updated the ArtCraft
notes on 2026-10-27: How assets get made, A1, A2, A5, A6, B1, B5, B7, B8, M2 and the Cambridge
TCG kit's status. A spec marked **read** was read on the platform's own page by a researcher or a
fact-checker, on 2026-10-20 unless another date is given (RESEARCH tags [O], [D], [V] or
[V, 2026-10-22]); **fact-checked** means [V], checked on 2026-10-20. **Tested** means an agent ran
it on this Mac on 2026-10-20, unless another date is given. For 2026-10-26 that is the
`artcraft-brand` skill's research run, and keys such as [R26 PC F1] are its evidence ids, in the
skill's `references/evidence/research-2026-10-26.json`. **Observed** means an agent saw it itself
on the date given (an account's public page, a branch). **Agents' inference** is our
reasoning, not a source. **Third-party** means only secondary sources say so.
**Unverified** means no one checked it. Platforms change their rules without notice, so the gate G4 data carries a
`review_after` date for each spec.

Each entry gives:
- **Why:** what the asset does.
- **First:** which brand needs it first.
- **Make:** which tool makes it.
- **Spec:** format and exact sizes.
- **Gate:** which check it must pass.

## How assets get made

- **The `artcraft-brand` skill is the asset layer.** It lives at `~/.kingdom/tools/artcraft-brand`
  and is owned by the artcraft-brand lane (the skill names its current owner). It turns one
  `brand.json` into:
  - the mark as an SVG master, and lockups;
  - a favicon set and app icons;
  - a web manifest and head snippet;
  - share cards;
  - a colour kit (tokens, CSS variables, contrast matrix; it exits 1 if a colour pair fails).

  Its interface is `~/.kingdom/tools/artcraft-brand/SKILL.md`: what it takes, what it builds, its exit codes, and
  which Craft app suits which job. Use that, not the skill's internals or this summary. The skill
  says kits belong with what they brand, so a kit is built into the brand's own kernel folder.
  Nothing in this catalogue duplicates the skill: entries it covers say "artcraft-brand".
- **Craft CLIs installed on this Mac:** see `~/.local/share/artcraft/INSTALLED.tsv`, the install
  ledger, which keeps every version installed with its SHA-256. The skill's
  `scripts/install.sh --status` shows which version is active. This catalogue no longer copies the
  numbers: the table that stood here (figcraft 0.7.0 and the rest, 2026-10-20) was out of date two
  days later.

  FilmCraft, DeckCraft, PdfCraft and SoundCraft are **not installed** (checked 2026-10-27).
  Installs, pinning and updates belong to the artcraft-brand lane (SKILL.md, "Updating").
- **Guardrails for every run:** before any recipe beyond the skill's own build, read the guardrails
  SKILL.md points to; they are re-checked per installed version. Two rules this design adds: record
  each tool's version in the asset's sidecar (D3), and rebuild exports from masters, never
  hand-editing an export.
- **What the 2026-10-26 research changed here** (the checks are in the skill's guardrails and
  recipes):
  - OG batches from data rows have three routes now (B1).
  - Brand type that FigCraft, PhotoCraft, EffectCraft or LightCraft renders is set in Inter, the
    one non-Adobe Latin family all six kit apps carry (Regular and SemiBold in each), or in a face
    you install or load, and checked in that app's missing-font report. Those apps lack Source
    Sans 3 and Source Serif 4, or (FigCraft after 0.11.2) are expected to drop them; DesignCraft
    bundles both (A5).
  - PhotoCraft 0.16.0's `serve` route refuses image replacement; its CLI route does it (B5).
  - **Desktop app updates.** The desktop apps installed on 2026-10-27 (VectorCraft 0.17.0,
    PhotoCraft 0.16.0, DesignCraft 0.13.0, FigCraft 0.11.2) have no self-update [R26 G4 G4-06].
    The next releases are expected to: the main branch of all six Craft apps now depends on
    storytold's self-update library, and on VectorCraft's main branch the app checks at every start
    and offers "UPDATE AND RESTART" (read in the source on 2026-10-26 [R26 ECO F08, R26 G4 G4-06]).
    At that prompt choose "Later", then re-sync with the skill's `install.sh --gui`, which keeps
    each app on its CLI's version. Agents' inference: the in-app update would replace the
    `~/Applications` copy outside install.sh, and the app would drift from its CLI.
    PhotoCraft 0.16.0 also asks GitHub for its latest release at every launch, only to notify; turn
    it off in Preferences › General (the first launch checks once before you can) [R26 G4 G4-01].
- **File names:** `<brand>_<campaign>_<asset>_<variant>_<WxH>_<yyyymmdd>_v<NN>.<ext>`. Every asset
  gets a `<name>.meta.json` sidecar (see D3).

## Rules that apply to every asset

1. **Real product only (trading cards and sealed product).** A product image shows the exact item
   sold: a real photo or scan. Only crop, exposure and colour correction are allowed.
   - Never use AI to improve condition, centring or surface, or to add holo or glow.
   - Never AI-render a real product as a photo.
   - A centring overlay is a separate image, never on the main one.

   Why: eBay bans pictures that don't represent the item, and stock photos for used items (picture
   policy). The EU Article 50 guidelines (20 July 2026) count an AI image that makes a product look
   better than it is as a deepfake. CAP 3.1 bans misleading ads. TikTok Shop UK says "always base AI
   output on real product images".
2. **No third-party IP as brand art.** Don't generate or reuse Pokémon, One Piece, Magic or other
   licensed characters, card art or logos. In particular:
   - Wizards' Fan Content Policy (version dated 2017, seen via search) bars use of its logos and marks.
   - Keep nen-artifacts (derived from Hunter × Hunter) out of commercial assets.
   - The AI-looking anime banners in the old Cambridge TCG storefront evoke franchises; review them
     before any reuse.

   Public-domain art with full credit is fine, as on cambridgetcg.com's Met Open Access Sharaku panel;
   `kingdom_commons` finds sources. YOUSPEAK material is CC BY-SA and stays in R3.
3. **Generative AI.** Deterministic templates are the default.
   - Generation is allowed for backgrounds, textures and scenes that show no real product, person or
     licensed character, and for R3 illustration.
   - Text is composited, never generated inside an image.
   - Where an audience could be misled, add a visible "AI-generated" label. Also use the platform's
     own AI label: TikTok rejects undisclosed AI ads, and Google Ads has had a label setting since
     July 2026.
   - Merchant Center requires metadata marking AI images as AI-generated (for example IPTC
     `DigitalSourceType` TrainedAlgorithmicMedia), and it must not be stripped.
   - No Craft app writes C2PA content credentials yet, so the sidecar is the record.
   - **ArtCraft's cloud app stays off for brand material.** In its source code on main, uploads and outputs
     default to Public (deployed behaviour not verified), and the only operator terms found (storyteller.ai, 2022) grant a perpetual,
     sublicensable licence over uploads.
4. **The ArtCraft name and logos never appear** in our marketing. They are trademarks, not open
   source.
5. **No personal data or test data** in any image: screenshots come from a dev store with
   `@example.com` customers.
6. **Accessibility** (WCAG 2.2 AA):
   - text contrast at least 4.5:1, or 3:1 for large text and UI parts (logotypes are exempt);
   - alt text on every image, and `og:image:alt`;
   - captions on every video.

## A. Brand identity

**A1. Mark and lockups**
- **Why:** one recognisable mark per brand, and the source of every icon.
- **First:**
  - RewardsPro: redraw the App Store "R" (navy `#1a3e5c`, teal `#17bebb`) as an SVG master if no
    source file exists. Today it has four looks and two spellings. Yu chose "RewardsPro" and look A
    on 2026-10-20 (ledger `rp-name-spelling`, `rp-identity`); the kit is in monorepo PR #83.
  - Cambridge TCG: another session built its kit at monorepo `apps/storefront/marketing/`, merged
    on 2026-10-26 and live on cambridgetcg.com (see the table at the end).
- **Make:** artcraft-brand (VectorCraft).
- **Spec:**
  - outlined SVG master;
  - lockups: horizontal, stacked, mark only and wordmark, each in colour, mono-dark and mono-light;
  - PDF for print;
  - clear space tied to a unit of the mark;
  - minimum size of about 20 px tall on screen (a common brand-guide convention, **unverified** as a
    standard).
- **Gate:** G5 (colours within tokens, single artboard). Yu approves the look in a review pack.

**A2. Web favicon set**
- **Why:** the browser tab, bookmarks and home screen. On 2026-10-20 RewardsPro served only a
  data-URI icon and `/favicon.ico` returned 404, and TaxSorted showed the Vercel default. Cambridge
  TCG's ICO was 285 KB; since PR #87 (2026-10-26) the site serves the kit's 16/32/48 ICO, 1,831
  bytes (observed 2026-10-27).
- **First:** RewardsPro, TaxSorted.
- **Make:** artcraft-brand (it packs a multi-size ICO itself; VectorCraft has no ICO writer).
- **Spec** (Evil Martians' six-file set, page dated 2026-01-21, third-party):
  - `favicon.ico` as the skill writes it (16, 32 and 48 px frames);
  - `icon.svg`, which may carry a dark-mode style;
  - `apple-touch-icon.png` 180×180, **opaque** (check that it is RGB, not RGBA);
  - `icon-192.png` and `icon-512.png`;
  - maskable `icon-mask.png` 512 with the art inside a 409×409 safe zone;
  - a manifest only for installable web apps;
  - `sizes="32x32"` on the ICO link.
- **Gate:** G5.

**A3. Shopify App Store app icon**
- **Why:** what merchants see in search, in Sidekick cards and in their admin.
- **First:** RewardsPro. Keep the current icon; it already fits the spec.
- **Make:** artcraft-brand, from A1.
- **Spec (read and fact-checked, shopify.dev best practices):** 1200×1200 JPEG or PNG, square with padding
  (Shopify rounds the corners), no text, no screenshots, no Shopify trademarks.
- **Gate:** G4, G5.

**A4. Colour kit**
- **Why:** one machine-readable answer to "what is RewardsPro blue?" for sites, cards, decks and
  emails.
- **First:** RewardsPro, then each maintain-tier brand.
- **Make:** artcraft-brand (its colour kit: tokens, CSS, contrast table and swatch files). Outside the
  skill, VectorCraft can also save `.ase` and `.css` swatches (tested); name them explicitly, or
  exports include 53 default swatches.
- **Spec:**
  - DTCG tokens (format 2025.10, a stable W3C Community Group report, not a W3C standard);
  - CSS custom properties;
  - a contrast table checked against WCAG 2.x. Don't build on APCA, since WCAG 3 contrast is not
    settled.
- **Gate:** G5. A failing pair blocks.

**A5. Type**
- **Why:** consistent text across sites and assets.
- **First:** RewardsPro. Its landing page uses Inter; keep it unless Yu wants a change.
- **Make:** a choice, not a render. Name the wordmark font explicitly in `brand.json`, using an
  installed OFL font (Inter, the landing page's font). SKILL.md warns that outlining a font into a
  logo is a use its licence must allow, so check before shipping a mark set in a macOS system font
  such as Avenir Next.
  - The Craft apps bundle OFL 1.1 fonts, and OFL allows commercial artwork. They don't bundle the
    same ones (read in each app's source, and checked in the VectorCraft, DesignCraft and FigCraft
    CLIs, 2026-10-26 [R26 G1 G1-02, G1-03, G1-04, G1-05, G1-06, G1-07, G1-11]):
    - Inter (Regular and SemiBold) is the one non-Adobe Latin family all six kit apps carry.
    - VectorCraft and DesignCraft also bundle Source Sans 3 and Source Serif 4, and FigCraft 0.11.2
      still does, but its main branch drops both. PhotoCraft, EffectCraft and LightCraft don't.
    - So the generated kit keeps its Source Sans 3 default wordmark (VectorCraft draws it, and the
      build fails loudly if the face goes). Brand type that FigCraft, PhotoCraft, EffectCraft or
      LightCraft renders, such as a FigCraft or PhotoCraft card title, is set in Inter, or in a
      face you install or load (recipes §2 uses the installed Iowan Old Style), and checked for
      fallbacks: FigCraft draws a missing family in another face with exit 0, and only its
      missing-font reports name it. DesignCraft can also use the Source faces it bundles, as the
      skill's DesignCraft recipes do with Source Sans 3.
  - craft-fonts has CJK and Arabic faces but no Latin display face.
- **Spec:** one sans for R1 commerce. R2 and R3 keep their system serif stacks. Outline type in logos.
- **Gate:** G5 (font resolved, no missing glyphs).

**A6. Web manifest and head snippet**
- **Why:** wires the icons, share card and colour into each site.
- **First:** RewardsPro landing, TaxSorted, Cambridge TCG (wired by PR #87; the theme-color pair
  is still missing, README §4, step 5).
- **Make:** artcraft-brand.
- **Spec:** the icon links above, `theme-color`, and the share-card tags (B1). From generator 1.7,
  also a `color-scheme` meta and, when the brand has a `url`, the Organization and WebSite JSON-LD
  in a separate `head-home.html` for the home page only.
- **Gate:** G5.
- **Wire:** the skill's `references/wiring.md` (Next.js, static, Vite and Pages sites) and its
  sync-test template, as in README §4's new-brand checklist.
- **Ship:** as a PR to each site's own lane. Merging a deploy of public pages is Yu's word.

**A7. Docs logo**
- **Why:** docs.rewardspro.io shows GitBook's default blue "R".
- **First:** RewardsPro.
- **Make:** a PNG or SVG from A1.
- **Spec:** GitBook's own upload rules (**unverified**).
- **Gate:** G5. Uploading it is Yu's hand (a GitBook login).

## B. Promotion

**B1. Share card (Open Graph, the image shown when a link is shared)**
- **Why:** every shared link gets a picture.
- **First:**
  - RewardsPro: rewardspro.io had no `og:image` on 2026-10-20.
  - TaxSorted: none on 2026-10-20.
  - Cambridge TCG: done by PR #87; `og:image` and `twitter:image` are the kit's 1200×630
    `og.jpg`, 63,619 bytes (observed 2026-10-27).
- **Make:** artcraft-brand. VectorCraft made 1200×630 PNG, JPG and WebP on 2026-10-20 (tested;
  WebP is lossless only). The kit makes the default card and, with `pages`, one per page (up to
  40). For a batch from data rows there are three routes, each with its checks in the skill's
  `references/recipes.md` (tested 2026-10-26):
  - **DesignCraft data merge** (recipes §1): 255 cards, byte-identical on 0.11.0 and 0.13.0
    [R26 DC DC13-F8].
  - **PhotoCraft data sets through the CLI** (`run` with `file.export.dataSetsAsFiles`, recipes
    §2), on 0.12.0 and 0.16.0: 250 cards in about 4 seconds. It overwrites files in its output
    folder without a word, so start each run in a new, empty folder [R26 PC F2, N1].
  - **FigCraft `data.fill`** (0.11.2 and later, recipes §10): one card per row in several sizes,
    with headlines fitted to their lines. Its errors come back with exit 0, so run the recipe's
    guards [R26 FC F1, F2].

  Card text in FigCraft or PhotoCraft is set in Inter or in a face you install or load, confirmed
  by that app's missing-font report (A5); DesignCraft also bundles Source Sans 3 and Source Serif 4.
- **Spec** (Meta's developer docs on sharing images, and ogp.me, per research note marketing-workflow):
  - 1200×630 recommended; at least 200×200; at most 8 MB;
  - under 600,000 bytes, at least 300 px wide and at most 4:1 width to height, or WhatsApp may show
    no preview (Meta's sharing docs allow 8 MB). The kit's verify fails a card at 600,000 bytes from
    generator 1.7; check batch cards yourself [R26 WS WS-10, R26 G5 G5-01];
  - declare `og:image:width` and `og:image:height`, and set `og:image:alt`;
  - Meta caches by URL, so a changed image needs a new file name;
  - use the same image for X's large card. X's own size rules were **not checked**.
- **Gate:** G1–G3 for any words on the card; G5.

**B2. App Store screenshots (RewardsPro)**
- **Why:** the main visual proof on the listing. Today there are 3 letterboxed crops, one showing a
  real-looking test Gmail address. Competitors carry 5–6 desktop screenshots and often mobile ones.
- **First:** RewardsPro, after the dev-store test.
- **Make:**
  - Yu captures the screens from the shot list.
  - A VectorCraft template with CSV captions adds a short headline; real UI fills most of the frame.
  - Placing a screenshot into a VectorCraft template is **unverified**, so smoke-test it first.
    PhotoCraft finishing is the fallback.
- **Spec (read and fact-checked, shopify.dev):**
  - 1600×900 (16:9), 3–6 desktop, at least one showing the app's UI;
  - mobile or POS screenshots only if the app supports them;
  - alt text required;
  - no pricing, reviews, outcome guarantees or personal data;
  - each image unique (4.4.5), showing real UI with no desktop backgrounds or browser windows (4.4.4);
  - no Shopify trademarks (4.4.3);
  - don't use the Sidekick icon or Shopify's "magic purple" to mark AI features (BFS 4.3.5).
- **Gate:** G1, G4, G5, G6 (privacy).

**B3. App Store feature image, or promo video**
- **Why:** the top slot on the listing. Today it holds a 16-second video with 4 views.
- **First:** RewardsPro.
- **Make:** VectorCraft for the image. FilmCraft for a video, which needs installing first.
- **Spec (read and fact-checked, shopify.dev):**
  - a 2–3 minute promotional video is *recommended*, not required, with screencast at most 25% of it;
  - otherwise a static 1600×900 feature image: one focal point, contrast 4.5:1 or better, alt text,
    no Shopify logos.

  Start with the image. A video comes later, when a design partner agrees in writing to a real story.
- **Gate:** G1–G5.

**B4. Walkthrough video (60–90 s, captioned, readable with the sound off)**
- **Why:** to show setup in messages, docs and the listing.
- **First:** RewardsPro, from about week 6, recorded on the dev store.
- **Make:** FilmCraft.
  - Its local presets include "Social Vertical 1080×1920" (H.264) and YouTube 1080p and 4K.
  - Captions come from a typed transcript: Whisper is not in release builds.
  - FilmCraft has no folder confinement, so run the CLI on explicit paths.
- **Spec:**
  - YouTube thumbnails: 3840×2160 (video) or 2160×3840 (Shorts), JPG or PNG (read, YouTube help).
  - Vertical 9:16 1080×1920 (third-party sources agree).
- **Gate:** G1–G3 on the script and captions; G6.

**B5. Social cards and stories**
- **Why:** organic posts, but only once a brand has a channel. RewardsPro doesn't need one now.
  Cambridge TCG sells only on eBay and Cardmarket. The usernames came on 2026-10-22; social waits
  until Yu decides whether to open accounts (RESEARCH §6.7).
- **First:** none yet.
- **Make:**
  - VectorCraft data sets: one card per CSV row (tested 2026-10-20).
  - PhotoCraft data sets, including image replacement, for price tiles: through the CLI route
    (B1). On PhotoCraft 0.16.0 the `serve` route refuses image replacement and writes no images
    (it leaves an empty output folder); text and visibility data sets still work there (tested
    2026-10-26 [R26 PC F1, N3]).
  - FigCraft `data.fill`: one template, several post sizes per row (B1).
  - EffectCraft templates for animated tiles.
- **Spec:**
  - VectorCraft presets (observed): 1080×1080, 1080×1350, 1080×1920 story, 1500×500 cover,
    1640×624 page cover, 2560×1440 banner.
  - Instagram feed 1080×1350 or 1080×1440 (third-party; sources conflict).
  - Keep text out of roughly the top 14% and bottom 20% of a 9:16 frame (third-party).
  - TikTok in-feed ads: 9:16, at least 540×960, mp4 or mov, 500 MB or less (read, TikTok ads
    help).
- **Gate:** G1–G6. TikTok Shop UK surprise products only: no "win", "chance" or "investment" wording,
  no value claims, and probabilities shown.

**B6. Motion: logo sting and web micro-animation**
- **Why:** a small moving mark for videos and the landing page.
- **First:** optional, R3 first. ai-love.cc already has a Lottie reveal.
- **Make:** EffectCraft.
  - Lottie export was proven in the ai-love run.
  - For WebM, use `--video-quality`, since `--bitrate` is ignored.
- **Spec:** Lottie JSON (the ai-love one was 10.7 KB), plus MP4 or WebM.
- **Gate:** G5, G6.

**B7. One-pager (A4 PDF, plus the same content as a web page)**
- **Why:** something to link to from messages. It covers:
  - what the app does for a card shop;
  - how store-credit cashback works;
  - what it costs (nothing);
  - what it doesn't do;
  - how to leave.
- **First:** RewardsPro (a `/tcg` page and a PDF).
- **Make:** VectorCraft PDF export (tested). DesignCraft only if a QR code is needed; it is
  pre-alpha. A static `object.qrCode` takes `color` (tested 2026-10-26); scan it before shipping
  [R26 DC DC13-F6].
- **Spec:** A4 PDF. VectorCraft writes PDF/A-2b and PDF/X-1a, X-3 and X-4. Check anything for a
  commercial printer with an independent preflight tool.
- **Gate:** G1–G5.

**B8. Event print: table banner, price cards, QR to a page**
- **Why:** card shows and prereleases, only if Yu goes.
- **First:** Cambridge TCG or RewardsPro, by Yu's choice.
- **Make:** DesignCraft data merge and `object.qrCode`, or VectorCraft presets. A merged QR is drawn
  black: recolour its `<path>` child after the merge, and scan it before shipping (tested
  2026-10-26, scanning untested [R26 DC DC13-F6]).
  `designcraft-cli validate-pdf` checks DesignCraft's PDF/X-4 output and exits 1 on a failure. It
  is the vendor's partial checker, not certification, so a printer's preflight still decides
  (tested 2026-10-26 [R26 DC DC13-F2]).
- **Spec:** the venue's and printer's sizes (**unverified**, ask them).
- **Gate:** G1–G5. Printing orders spend money and need Yu's word.

**B9. Product photos for an own web shop (Cambridge TCG uses M2)**
- **Why:** the photo is the product truth.
- **First:** none now. Cambridge TCG sells only on marketplaces and uses M2's photo standard. The
  Merchant Center spec below applies only if a brand opens its own web shop.
- **Make:** as M2. PhotoCraft's classical background removal is for an own site only, never for
  marketplace images.
- **Spec:**
  - **Google Merchant Center (read and fact-checked):**
    - at least 500×500 for all products from 31 January 2027; 1500×1500 or larger recommended;
    - 64 MP and 16 MB at most;
    - no promotional text, watermarks, borders, logos or QR overlays;
    - no upscaling;
    - AI images must carry metadata marking them as AI-generated (for example IPTC
      `DigitalSourceType` TrainedAlgorithmicMedia), and it must not be stripped;
    - the product should fill 75–90% of the frame (a research note, from the same page).
- **Gate:** rule 1, G4, G6.

**Ads (not now).** Shopify App Store ads are pay-per-click with no published creative spec. Ads
spend money, and agency advice is to wait for 5–10 genuine reviews and a listing conversion rate
above 10% (third-party). TikTok and
Google AI labels apply if generated media is ever used.

## M. Marketplace kit (Cambridge TCG: eBay UK and Cardmarket)

Yu, 2026-10-20: "For now only ebay and cardmarket sales." Cambridge TCG has no web shop, so its
promotion is its listings and profiles. eBay pages were read through a summarising tool on
2026-10-20, because eBay blocked scripted reads (RESEARCH §7.1); §7.6 adds 2026-10-22 reads. Not
legal advice.

**Update, 2026-10-22** (notes in [research/2026-10-22/](research/2026-10-22/)):
- Yu: "eBay: cambridgetcg cardmarket: cambridgetcg 😂 yes VAT registered."
- The eBay account's pages show "Registered as a private seller" and no business details (observed
  2026-10-22; how, and why agents won't repeat it: RESEARCH §7.6 and
  [ebay-account.md](research/2026-10-22/ebay-account.md)). The Cardmarket profile was not observed
  ([cardmarket-account.md](research/2026-10-22/cardmarket-account.md)).
- Paste-ready texts for M1, M3, M4 and M6 are a dated draft in
  [research/2026-10-22/marketplace-texts.md](research/2026-10-22/marketplace-texts.md) until Yu
  approves them; the next step is an agents' proposal (RESEARCH §7.6).
- Monorepo PR #86 (the Cambridge TCG brand kit, by another session) now carries the eBay logo and
  billboards and the Cardmarket avatar (observed 2026-10-22 on branch
  `feat/cambridge-tcg-brand-kit`). It was merged on 2026-10-26 (README §4).

**Rules that limit every marketplace asset:**

1. **No links off the platform.**
   - eBay listings and descriptions "can't contain links that direct customers to a site other than
     eBay", even unclickable ones. The exceptions are eBay pages, product videos, approved freight
     and legally required information (read and fact-checked).
   - Cardmarket's General Terms (§10): "you are prohibited from using hyperlinks in your offers"
     (fact-checked).
   - So no asset on either platform mentions cambridgetcg.com or the planned app.
2. **No selling off-platform.** eBay bans using a buyer's contact details to sell outside eBay, at
   any time. It also bans promoting outside sales sites in messages (fact-checked). Parcel inserts
   aren't named, but these clauses plausibly reach them.
3. **No third-party images or text on eBay Shop pages** without the owner's written permission
   (images and text policy 4240, read). Together with house rule 2, the Shop branding uses no card
   art, no characters and no game logos, including photos of cards used as decoration.
4. **Marketplace logos stay theirs.** Cardmarket's brand is its "sole property" (fact-checked), and
   eBay's Authenticity Guarantee badge is eBay's. We never write "authenticated" or "guaranteed"
   ourselves.
5. **No feedback bargaining.** eBay bans any "incentive in exchange for positive feedback"
   (fact-checked). Nothing pairs "feedback" or "evaluation" with an offer.
6. **Real product only** (house rule 1). The listing image is the item sold.
7. **Prices include VAT** (added 2026-10-22; the business is VAT-registered). Consumer prices are
   VAT-inclusive: never "+VAT", and never add VAT after the sale (Price Marking Order 2004 art. 4;
   DMCC Act s.230(4); eBay help 4121; Cardmarket General Terms §7; read 2026-10-22).

**M1. Business identity on both marketplaces**
- **Why:** law and both platforms expect a business to say it is one. Falsely creating the
  impression that you are not trading is a banned practice (DMCC Sch 20 para 25).
- **First:** the usernames came on 2026-10-22 (both `cambridgetcg`). The account types are still
  open: eBay shows "Registered as a private seller" (observed 2026-10-22), and Cardmarket's is
  unobserved. The texts are drafted, and they fit once each account is registered as a business
  (Yu's hand; the fees that adds on eBay are in RESEARCH §7.6).
- **Make:** text, one ledger claim per fact.
- **Spec:**
  - **eBay business-seller information** (read):
    - Cambridge TCG Limited, company 15680297 (read at Companies House on 2026-10-22);
    - the registered office, "60 Tottenham Court Road Suite 4583a, Fitzrovia, London, United
      Kingdom, W1T 2EW", and the part of the UK where it is registered, England and Wales (the
      certificate of incorporation, read 2026-10-22; SI 2015/17 reg. 25, fact-checked);
    - a contact email, and the VAT number. eBay: "It's mandatory that you display your VAT
      identification number" (help 4650, read 2026-10-22). Yu holds the number; these docs don't
      record it;
    - names that match Companies House and HMRC.
  - **Returns** (eBay business-seller policy, help 4710; the raw page was read on 2026-10-22): a
    14-day right to cancel, faulty items within 30 days, no restocking fee, original postage
    refunded, and no return postage charged. The one listing read says "No returns accepted."
    (observed 2026-10-22); a business account can't keep that setting (agents' inference).
  - **Cardmarket Professional account** (requirements fact-checked; the username rule read):
    - a phone number, a photo ID and the business registration;
    - the username is 5–20 letters, digits or dashes. The account Yu named is `cambridgetcg`
      (2026-10-22); whether it is Private or Professional is unobserved;
    - a commercial profile must include "a correct and complete About Us, General Terms and
      Conditions, a Privacy Policy, and a Withdrawal Form" (General Terms §3, read 2026-10-22).
- **Gate:** G1, G3. Registering or converting the accounts is Yu's hand.

**M2. Photo and scan standard (replaces B9's Make and Spec for Cambridge TCG)**
- **Why:** eBay's free price guide shows buyers two years of sold prices, so photos, condition and
  trust are what compete.
- **Make:**
  - Shoot one master per angle.
  - Convert phone HEIC files to JPEG with `sips`, or import them into LightCraft directly (tested
    2026-10-26 on a `sips`-made HEIC only, not on an iPhone's [R26 LC LC-04]).
  - LightCraft makes one `run` per output, cropping, resizing to sRGB and stripping metadata with
    `metadata=none`, which also removes phone GPS.
  - The skill's own reference records two limits: LightCraft raw input is untested, and
    LightCraft 0.11.0 turns pure white `#FFFFFF` into 254 (fixed in v0.12.0, PR #1972). On 0.14.0,
    unedited exports and edits with Contrast, Whites and Blacks at 0 keep it, but any curve grade
    still lowers it (tested 2026-10-26 on 0.11.0 and 0.14.0 [R26 LC LC-01]). So keep white-ground
    photos ungraded, shoot on a light neutral matte background, or use PhotoCraft `batch`.
  - Never use a Craft watermark or background removal, or eBay's AI "Studio", "Surface" or
    "Outside" backgrounds.
- **Spec, eBay** (read and fact-checked):
  - up to 24 pictures; at least 500 px on the longest side; about 1600×1600 recommended; 12 MB at
    most;
  - JPEG, PNG, WEBP, HEIC and others; 1:1 or 16:9 "look best";
  - no borders, no added text, artwork or marketing, no logos, and no "Watermarks of any type";
  - no stock photos for used items;
  - show the front, the back, "any significant blemishes, and any grading labels", in soft light
    with no flash.
- **Spec, Cardmarket:**
  - attach scans to articles (a feature since 2023-09-19, read);
  - an altered card needs its own image;
  - no published rule on image content was found (unverified);
  - never reuse Cardmarket's catalogue images, which show publishers' art.
- **House standard:** a 1600×1600 sRGB JPEG master, under 12 MB.
  - **Raw singles worth over about £20:** front, back, one raking-light angle, and corner and edge
    close-ups.
  - **Graded slabs:** front, back, and a close-up of the certificate number.
  - **Sealed product:** front, back, a seal close-up, and a barcode shot that is not the main image.
- **Gate:** rule 1, G4, G6 (no addresses or other personal data in frame).

**M3. Title, condition and comment templates**
- **Why:** eBay's search ranks on relevance and completeness. Cardmarket ranks on price, so accuracy
  is what protects the rating.
- **Make:** a CSV template plus a G4 checker (80 characters, banned tokens).
- **Now** (observed 2026-10-22): eBay titles follow no template ("JP", "Jap", "JDM", "! NM!"),
  the one description read repeats the title, and one "Mint" title sits on a card listed with
  "Back scuffs/chips". Draft templates and a condition mapping are in
  [marketplace-texts.md](research/2026-10-22/marketplace-texts.md), M3.
- **Spec, eBay** (read and fact-checked):
  - A title has 80 characters at most, in this order: name, number, set, features, language,
    franchise, condition or grade. Example: `[Card name] [number] [set] [features] Japanese One
    Piece Card Game [NM]`. Put the language early.
  - No unrelated keywords, no keywords with "?", no comparisons ("like", "not"), and no mixed
    conditions. One fixed-price listing per identical item.
  - Condition is **Graded** (grader, grade, optional certificate number of 30 characters or fewer)
    or **Ungraded**. The Ungraded tiers are Near Mint or Better, Lightly Played (Excellent),
    Moderately Played (Very good) and Heavily Played (Poor).
- **Spec, Cardmarket** (read; the Japanese-card rule is fact-checked):
  - Comments are written in simple English and never contradict the structured fields.
  - When in doubt, use one grade lower. Never use "Mint".
  - Japanese One Piece cards go only on their Asian-edition pages, never on English ones.
  - No hyperlinks.
- **Gate:** G4.

**M4. Cardmarket profile texts**
- **Why:** professional sellers "must have a right of withdrawal policy visible on their Cardmarket
  profile" (fact-checked). Powersellers are expected to have About Us, Privacy Policy and Terms of
  Revocation (read). The General Terms read on 2026-10-22 ask this of every commercial user: About
  Us, terms, a privacy policy and a withdrawal form (§3).
- **Make:** text blocks for Yu to paste.
- **Spec:**
  - **The withdrawal policy:** 14 days from delivery (UK CCR 2013 reg. 30). Cardmarket's own button
    doesn't appear on UK-to-UK orders (fact-checked).
  - **The legal blocks:** an imprint (company name, number, registered office, the part of the UK
    where it is registered, and the VAT number), terms, a privacy notice and a withdrawal form.
  - **One entity sentence** matching C1, for example: "Cambridge TCG Limited is a UK company selling
    trading cards on eBay UK and Cardmarket." (Unverified: the eBay account observed on 2026-10-22
    is registered as a private seller, and Cardmarket's profile was not seen.) Agents' proposal: on
    Cardmarket, leave out "on eBay UK and Cardmarket" until its rule for profile text is read
    (unverified). Its General Terms bar advertising in comments (§7) and in messages (§10), read
    2026-10-22.
  - **Contact:** in English; reply within 24 hours (Seller Guide).
  - **Logo or banner:** no published spec, and the profile page was blocked again on 2026-10-22
    (unverified). The kit carries a Cardmarket avatar (`kit/social/avatar-1024.png`, on monorepo
    main since PR #86 was merged on 2026-10-26); check the upload form when Yu is logged in.
  - **Links:** none on the profile until Yu has read the rules for it.
- **Gate:** G1–G3. A solicitor's glance is advisable.

**M5. eBay Shop kit (only with a Shop: Basic £27 a month, Yu's word)**
- **Why:** a Shop unlocks the Discounts Manager, coupons, automated offers, newsletters and
  Promoted Shops (read; the Discounts Manager rule fact-checked).
- **Make:** the Cambridge TCG brand kit renders these from its mark and colours. Type and shapes
  only. Monorepo PR #86 (by another session, merged 2026-10-26) carries the eBay logo (300×300) and
  light and dark billboards (1280×290) in `apps/storefront/marketing/marketplaces/` (observed on
  main on 2026-10-27). They still need a Shop subscription:
  https://www.ebay.co.uk/str/cambridgetcg returned 410 on 2026-10-20 (fact-checked). The current eBay avatar is a
  blue "Cambridge TCG" mark (observed 2026-10-22), so swapping in the kit's look is a visible change
  for Yu to approve.
- **Spec** (read and fact-checked, help 4090):
  - **Logo:** 300×300 px, under 12 MB. The format isn't stated, so use PNG in RGB. Promoted Shops
    ads reuse it.
  - **Billboard:** 1280×290 px, under 12 MB. Mobile cropping isn't stated (unverified), so keep the
    text and mark central, and check eBay's preview on a phone before publishing.
  - **Marketing banner:** 640×640, under 12 MB. Its title and description are public text, and it
    links to an eBay promotion, category or listing.
  - **Featured categories:** up to 6 tiles at 300×300. Each shows only while it has an active
    listing. Make them from type and shape, for example "One Piece singles", "Japanese", "Graded"
    and "Sealed".
  - **Text limits:**
    - The Shop description has 1,000 characters and is auto-translated.
    - Each policy (Shipping, Returns, Warranty, Data Privacy, Other) has 4,000 characters.
    - House rule: neither uses "best" or "cheapest".
  - **The Shop name** can't be a web address or contain ".com".
- **Gate:** G1–G5. Subscribing and uploading are Yu's hand.

**M6. Message templates (eBay and Cardmarket)**
- **Spec:**
  - One template each for: shipped (with tracking); a problem before dispatch; a partial refund (for
    a one-grade dispute on Cardmarket, about 10% of the card's value); and a withdrawal request.
  - On Cardmarket, send tracking through its messages.
  - Ask only "please confirm arrival when it arrives".
  - Never mention feedback or evaluations near an offer.
  - No contact details, URLs or off-platform offers.
- **Gate:** G1–G3, plus a G4 rule that blocks "feedback" or "evaluation" next to an offer.

**M7. Parcel insert (eBay orders only)**
- **Spec:**
  - A6 or DL; confirm the size with the printer (unverified).
  - One eBay coded coupon, printed from Seller Hub ("Print a coded coupon note", fact-checked), with
    its real expiry stated.
  - No URLs, no app or website, and no link to feedback.
  - Coupons don't stack with order discounts or multi-buy.
  - Cardmarket parcels get no promotional insert until Cardmarket's rules on inserts are read
    (unverified).
  - VAT (read 2026-10-22, Notice 700/7): the coupon itself carries no VAT, VAT is due on the
    discounted amount, and free gifts stay within £50 per person a year.
  - eBay closed coupons to private sellers on 20 January 2025 (help 4090, read 2026-10-20), so M7
    also needs a business account.
- **Gate:** G2, G3, G4. Needs a Shop subscription (M5). Printing spends money, so it needs Yu's word.

**M8. cambridgetcg.com: where we sell**
- **Why:** neither the homepage nor `llms.txt` links eBay or Cardmarket today (fact-checked). What
  people and AI assistants read should match what is true.
- **Spec:**
  - **A "Where we sell" line:** add it to the site, with plain links to the eBay seller page and the
    Cardmarket profile. The usernames are known (2026-10-22). Agents' proposal: link them only once
    each account shows the business details (M1), so the company's site doesn't point to an
    account registered as private.
  - **No EPN tracking on those links.** EPN requires its approval for self-made promotional
    content.
  - **Company details:** show them on the site (reg. 25).
  - **llms.txt, Organization JSON-LD and C1:** update all three to say Cambridge TCG sells on eBay
    UK and Cardmarket.
  - **Retired claims:** remove the retired shop, "Daily Spin" and "daily price guide".
  - **Cardmarket price display:** re-check the member display against Cardmarket's §9 wording from
    26 Nov 2026 (RESEARCH §7.2; README §8 step 11).
- **Ship:** a PR to the Cambridge TCG lane, which Yu merges. The proposed one-way link rule
  concerns R1-to-R3 links, so it doesn't decide this.
- **Gate:** G1–G4.

**Not now:**
- Promoted Listings, Offsite or Promoted Shops. They need "Above standard" status with recent sales,
  and they spend money.
- Cardmarket pre-sales, which need 1,000 sales and a year.
- Powerseller status.
- EPN links to our own listings.
- Marketplace logos in our material.
- AI-made product images.

## C. Messaging

**C1. Entity card (one consistent description)**
- **Why:** people, search engines, AI assistants and Sidekick should all read the same sentence.
  Evidence favours specific, extractable, dated facts (the GEO survey) and brand mentions (Ahrefs,
  correlation only). One consistent description is our inference: it keeps those facts from
  contradicting each other.
- **First:** RewardsPro.
- **Make:** text in `kernel.toml [entity]`, from verified claims only.
- **Spec:**
  - one sentence, reused in the meta description, Organization and SoftwareApplication JSON-LD, the
    listing intro and any bio;
  - an as-of date.

  Draft, unverified until the dev-store test: "RewardsPro is a free Shopify app that pays your
  customers cashback as Shopify store credit and moves them through VIP tiers."
- **Gate:** G1–G4.

**C2. App Store listing text (RewardsPro)**
- **Why:** the listing is both the shop window and the input Sidekick reads.
- **Make:** the Maker drafts from claims. Yu edits the Partner Dashboard.
- **Spec (read and fact-checked, shopify.dev):**
  - app name 30 characters at most; app introduction 100; app details 500; each feature 80;
  - up to 5 search terms;
  - no statistics or data, no "first, best or only" (4.3.3, 4.3.4);
  - no reviews or testimonials (4.3.6, 4.3.7);
  - pricing only in the Pricing section (4.2.2, 4.2.3);
  - one consistent name across surfaces (4.1).

  The app card subtitle limit is **unverified** (third-party: about 80). The English listing is
  auto-translated into 8 languages (research capture, 2026-10-18).
- **Content:**
  - Drop "Raffles & Mystery Box": the chance mechanics are paused (`CHANCE_MECHANICS_PAUSED = true`).
  - Name only features the dev-store test shows working.
  - Price wording: the Pricing field says Free. Elsewhere, prefer "Free. There is no paid plan."
    "Forever" is a promise, and RhetorLint marks it. Use it only once Yu writes a notice commitment
    and the order cap is settled.
- **Gate:** G1–G4. The G4 anchor rule blocks raffle or mystery-box words.

**C3. Landing page and "How cashback and tiers work" page (rewardspro.io)**
- **Why:** the "retired" copy contradicts the agents' call for a free-only relaunch
  (`rp-commercial-shape`, made under Yu's 2026-10-20 delegation). The monorepo's own
  transparency audit records that tier rules "aren't documented anywhere users can read".
- **Make:** a PR to `apps/rewardspro/landing/` that removes the retirement copy and adds the page,
  with B1, A2 and A6 included.
- **Spec:**
  - canonical tag;
  - meta description equal to C1;
  - JSON-LD;
  - true statistics may appear here, with evidence (the listing forbids them).
- **Gate:** G1–G5. Merging and the Pages deploy (wrangler; whether the project is git-connected was
  not checked) publish public copy, so Yu says yes to the exact words.

**C4. Design-partner message and terms**
- **Why:** first merchants come from personal contact.
- **Make:** the Maker drafts. Yu edits and sends, from Yu's own account.
- **Spec, the message:** about 90 words. It includes:
  - who we are, and one true observation about the shop;
  - the company name and registered office;
  - a plain opt-out;
  - "I won't write again".
- **Spec, the terms (one page):**
  - free, as for everyone;
  - setup on a call;
  - feedback calls at weeks 2 and 6;
  - **reviews are not part of it, and help never depends on one**;
  - uninstall any time, and what happens to their data.
- **Lawful contact (UK, not legal advice):**
  - limited companies only;
  - sole traders count as individuals under PECR, so no cold email to them;
  - record a short legitimate-interest note;
  - no bought lists and no follow-ups.
- **Gate:** G1–G3, and a G4 PECR rule.

**C5. Review request**
- **Why:** reviews drive App Store ranking and the Built for Shopify badge (5 needed).
- **Make:** a lane PR for an in-app prompt (App Bridge Reviews API, or the `#modal-show=WriteReviewModal`
  deep link), plus one neutral sentence Yu says at the week-6 call.
- **Spec:**
  - shown once, after a real value moment (the first cashback credited to a real shopper, or 14 days
    of active tiers), with "don't ask again";
  - never during onboarding or install;
  - no unsolicited review emails;
  - no incentive, and no features withheld (Shopify 1.3.1);
  - ask everyone, not only happy merchants (UK law bans "review gating", per CMA guidance CMA208);
  - unresearched: whether a design partner's review needs a note that the developer set the app up by
    hand (CAP 3.46 treats leaving out relevant circumstances of a review as misleading). Settle it
    before asking;
  - admin, Sidekick and checkout extensions can't be used to ask for reviews;
  - Yu replies to every review.
- **Gate:** G1–G4.

**C6. Switch-interview guide (internal)**
- **Why:** turns calls into evidence for positioning and copy. The four forces are: push of the
  problem, pull of the new, anxiety about it, and habit.
- **Make:** text.
- **Spec:** seven questions, from what the shop used before to what happened in week one. Record
  quotes only with consent; personal data stays in `private/`.
- **Gate:** none (internal).

**C7. Community answers**
- **Why:** useful presence where merchants ask questions.
- **Make:** agents draft and Yu posts.
- **Spec:** Shopify's community FAQ (seen only via search) treats self-promotion outside its
  designated board as spam. Answer the question, with no link unless asked.
- **Gate:** G1–G3.

**C8. Marketing email (gated)**
- **Why:** not now. It stays off until the first real merchant (`rp-marketing-email-gate`).
- **Spec:**
  - consent defaults to off, and only Shopify `SUBSCRIBED` counts as consent;
  - one-click List-Unsubscribe;
  - SPF, DKIM and DMARC aligned (keep one of the two `_dmarc` records first; Yu picks which);
  - a postal address.
- **Gate:** G1–G4.

**C9. Sidekick extension text (later, after real merchants)**
- **Why:** loyalty data inside the merchant's assistant. Smile shipped one on 2026-06-18.
- **Spec:** the extension description reportedly has a 256-token limit and may not promote, cross-sell
  or ask for reviews (third-party).
- **Gate:** G1–G4.

## D. Proof and trust

**D1. Claims ledger (`claims.toml`)**
- **Why:** the only thing that stops a false sentence; both of the estate's scanners refuse to judge
  truth.
- **First:** RewardsPro.
- **Make:** the Clerk. Rows use Truth Release's input fields plus `status`, `kind`, `channels` and
  `review_after`.
- **Gate:** it *is* G1's source.

**D2. Review pack and approvals log**
- **Why:** Yu approves exact bytes, and the record shows who said what.
- **Make:** the Checker. The pack is a local page; the log is append-only `approvals.jsonl`.
- **Spec:** asset hashes, channel, account, labels, Yu's verbatim words, and the reasons for
  rejections.

**D3. Provenance sidecar (`<asset>.meta.json`)**
- **Why:** pipelines strip metadata, and no Craft app writes C2PA.
- **Spec:**
  - brief id, kernel version, template and tool versions;
  - inputs with sha256 and licence;
  - `ai_involvement` (none, assistive or generative);
  - jurisdictions and channel;
  - claims used, labels and alt text;
  - the gate-report digest;
  - later, the approval id and publish URL.
- **Gate:** G6.

**D4. Corrections log and correction door**
- **Why:** XENIA right 9: append a correction, never rewrite history silently.
- **Make:** reuse RhetorLint's Claim Feedback example.
- **Spec:** every public claim page links to a way to dispute it.

**D5. "How we know" page and `claims.json` (test before wide use)**
- **Why:** shows the work behind every claim on a surface: receipt, date, gate results and
  corrections. It also shows its own lapses ("1 claim overdue for re-check").
- **Make:** generated from the ledger, using Truth Release's page output.
- **Spec:** a plain link in the brand's own colours. **Never a shield, tick or seal** (CAP 3.52 bans
  displaying trust marks without authorisation). Show it only where every claim passes G1–G3.
- **Status:** no evidence yet that merchants value it. Ask design partners first.

**D6. Proof bank (consented quotes)**
- **Why:** real merchant words for the website and future copy.
- **Spec:**
  - each quote has a consent record id, and the personal data stays out of git;
  - never AI-written, and never paraphrased into a better quote;
  - not on the App Store listing (4.3.6, 4.3.7);
  - on our own site only if genuine and permitted (CAP 3.47, 3.50).

**D7. Genuine reviews**
- See C5. Never use an insider or the developer's own store as a reviewer.

**D8. Receipt cards (later)**
- **Why:** one verified claim, its source and its date, as a social image.
- **Make:** a VectorCraft template fed by ledger rows.
- **Gate:** G1–G6.

## E. Machine-facing (what AI assistants and agents read)

Evidence for special AI files and tricks is weak (RESEARCH §2.1), so these are small and follow the
entity card (C1). Demand, not doors, is the constraint.

**E1. Structured data and page plumbing**
- **Why:** search engines and AI assistants read the page's own description of itself.
- **First:** RewardsPro landing, TaxSorted (with A6), and Cambridge TCG, whose home page already
  served Organization and WebSite JSON-LD on 2026-10-27; its canonical tag and sitemap remain (see
  the table at the end).
- **Make:** text from C1; Organization and SoftwareApplication JSON-LD rendered on the server; a
  canonical tag; a sitemap without retired pages.
- **Gate:** G1–G4.

**E2. Agent doors that already exist**
- **Why:** an agent door that misdescribes the brand repeats the error at machine speed.
- **First:** Cambridge TCG.
- **Make:** keep `llms.txt`, MCP and registry metadata in step with C1. cambridgetcg.com's custom
  JSON-RPC "MCP" can't be used by standard MCP clients: make it conformant or stop calling it MCP.
  Commerce text, not KINGDOM text, on commerce doors (README §3).
- **Not now:** new doors, UCP or agent checkout, or a Sidekick extension (C9) before merchants exist.
- **Gate:** G1–G3.

## What each brand needs first

| Brand | Tier (proposed) | First assets |
|---|---|---|
| RewardsPro | Focus | A1–A7, B1–B3, C1–C5, D1–D3; later B4, B7, C9, D5 |
| Cambridge TCG | Maintain: marketplace-only (eBay UK and Cardmarket; Yu, 2026-10-20) | The brand kit (A1, A2, B1, and eBay Shop and Cardmarket images) is at monorepo `apps/storefront/marketing/`, by another session, which reports that Yu asked for it on 2026-10-20; it carries the eBay logo and billboards and the Cardmarket avatar. PRs #86 and #87 merged it and wired it into cambridgetcg.com on 2026-10-26, and the site served its icons and share card on 2026-10-27 (observed). On 2026-10-27 (curl) the home page's server HTML still had no theme-color pair and no color-scheme meta (README §4, steps 2 and 5; a 1.7 kit writes the meta), and its `<head>` already carried Organization and WebSite JSON-LD. The usernames came on 2026-10-22 (both `cambridgetcg`), and the business is VAT-registered: M1–M4 (business details with the VAT number, photo standard, title and condition templates, Cardmarket profile texts), then M6 and M8. Texts for M1, M3, M4 and M6 are a dated draft in [research/2026-10-22/marketplace-texts.md](research/2026-10-22/marketplace-texts.md) until Yu approves them (the next step is an agents' proposal, RESEARCH §7.6). They fit once each account is registered as a business; eBay shows a private seller (RESEARCH §7.6). M5 and M7 only with a Shop subscription (the Shop page returned 410 on 2026-10-20; coupons need one, RESEARCH §7.1); M7 also needs a printer quote. Site truth fixes still stand: a canonical tag (none on the home page, 2026-10-27); sitemap without retired `/trade-in`, `/rewards`, `/auctions`, `/market`, or with true titles; fix `/rewards` "Daily Spin" and the price guide's "Free daily price guide" (collection stopped 2026-07-12). Not now: Promoted Listings, social (B5), Merchant Center (no own web shop). |
| The One Piece scanner (planned) | Pre-launch (proposed) | No public promotion until its G0 holds; each preparatory act needs Yu's word (SCANNER §8). Then SCANNER.md §6: mark and kit, store icons, screenshots from real captures, feature graphic, landing page. |
| TaxSorted | Maintain | B1, A2 (replace the Vercel default), canonical tag, JSON-LD |
| R2 and R3 sites | Later, per lane | 10 of 15 live sites have no `og:image`. Four have no favicon. fomoengine.io and axiepro.io serve the stock Next.js favicon. A later sweep with the same skill, through each site's own lane. |
