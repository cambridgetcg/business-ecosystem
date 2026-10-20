# Marketing workflow for a solo founder running a multi-brand portfolio

Key: `marketing-workflow` · Written 2026-10-20 by a Claude research subagent (an agent wrote this; none of it is Yu's decision).
Scope: the operating *workflow* of marketing — the sequence, artefacts, routines and gates — for Yu's estate, with an agentic-era design.
Method: public web reads (WebSearch/WebFetch), `gh api` reads, `curl` GETs of public estate pages, and read-only reads of the business-ecosystem clone and one memory note. Nothing was installed, posted or changed.

Evidence tags: **[O]** observed today (2026-10-20) · **[D]** documented by the cited source · **[I]** my inference/synthesis.
Where a source is secondary (a summary, a vendor blog), I say so.

---

## 0. What I found about the estate before talking workflow

These change what the workflow should do first.

| # | Finding | Tag | Source |
|---|---|---|---|
| 0.1 | The RewardsPro App Store listing shows: developer "Cambridge TCG Limited", launched 16 Dec 2025, price "Free", **0 reviews**, no Built for Shopify badge. | O | https://apps.shopify.com/rewards-pro |
| 0.2 | The listing's `<title>` is "RewardsPro - Loyalty, Points, Cashback, **Raffles & Mystery Box** Rewards". A memory note dated 2026-10-18 records raffles and mystery boxes as paid-chance mechanics to pause, with a solicitor's advice needed before they return. The public listing still advertises them. | O (title) / D (memory) | listing HTML; `~/.claude/projects/-Users-yournameisai/memory/rewardspro-rebuild-2026-10-18.md` |
| 0.3 | rewardspro.io leads with "Understand your reward records." and says "New paid subscriptions and paid plan changes are retired." It has no proof points, no meta description, no `og:image`, no favicon `<link>`, and no analytics script in its HTML. The site calls the product "Rewards Pro" while the App Store says "RewardsPro". | O | https://rewardspro.io (HTML via curl, page via WebFetch) |
| 0.4 | cambridgetcg.com leads with "TCG data. Made to connect." and describes open-source TCG data infrastructure. It says new paid orders and subscriptions are retired. It has a 1200×630 OG image, `favicon.ico` and `apple-touch-icon`, but no SVG icon. No analytics script appears in its initial HTML. | O | https://cambridgetcg.com |
| 0.5 | wholesaletcgdirect.com returns a 301 redirect to cambridgetcg.com. | O | curl, 2026-10-20 |
| 0.6 | The estate map marks `marketing-outreach` as "designed only" in first-customer-push, fomoengine, saas-marketing-suite and saas-marketing-template. In rewardspro-marketing it is "retired". | D | `be-main/estate/curated/capabilities.toml` (as_of 2026-10-18) |
| 0.7 | The READMEs of first-customer-push and rewardspro-marketing say the commercial direction was retired on 2026-09-23. | O | `gh api repos/cambridgetcg/{first-customer-push,rewardspro-marketing}/readme` |
| 0.8 | The memory note says that 2026-09-23 retirement was an agent sweep (Codex and the "YOU"/cambridgetcg identities), that no Yu decision record exists, and that it contradicts Yu's verbatim 2026-07-23 free-first pricing decision. It says to "treat it as open until Yu decides". The same note proposes a wedge: store-credit cashback plus VIP tiers for Shopify TCG stores that pay trade-ins in store credit, on a free plan. It also sets gates before any marketing: database live, P0s closed, a dev-store end-to-end run, and Yu's retirement and pricing decisions recorded. | D (dated 2026-10-18/19; re-verify) | memory note above |
| 0.9 | **Tension:** the brief for this task says Cambridge TCG "is generating revenue" and has wholesale at wholesaletcgdirect.com. The public sites say paid orders are retired, and wholesale redirects. I could not see where current revenue comes from (eBay? Cardmarket? in person?). This stays **unknown**. | O + unknown | 0.4, 0.5 |
| 0.10 | The estate already contains copy-audit tools: fomoscan (engineered-urgency detector, live at api.fomoengine.io) and rhetorlint (copy-audit spec and npm packages). They are natural QA gates for marketing copy. | D | `be-main/estate/curated/families/commerce-ventures.toml` |
| 0.11 | The estate has 37 public surfaces (hostnames) across roughly 20 brand names. | O | `be-main/estate/curated/estate.toml` (`grep -c '^\[\[surface\]\]'`) |

**Implication [I]:** the first marketing job is not ads or SEO. It is (a) Yu deciding whether the 09-23 retirement stands, and (b) rewriting positioning and messaging for the one brand chosen to grow. Today the public face of the growth bet reads as a records-only wind-down, under two different spellings of its name, while still advertising mechanics flagged for legal review. Any channel spend before that leaks.

---

## 1. Brand strategy: the order of operations

### 1.1 The sequence [I, built from the sources below]

```
Evidence (talk to buyers, JTBD)
  → Positioning (Dunford: alternatives → unique capabilities → value → best-fit customers → category)
    → Brand platform (purpose, promise, personality, voice)
      → Messaging house (one roof line, 3 pillars, proof under each)
        → Proof bank (every claim traced to evidence)
          → Identity / brand kit (tokens, logo suite, type, icons) ← colour theory and brand kits live here
            → Content system and channels
              → Measurement and experiments → loop back to Evidence
```

Each layer constrains the next. The usual failure is starting at the identity layer (logo, colours) or the channel layer (ads) before positioning exists. Then every asset is decoration with nothing to say. ArtCraft-type tools are identity- and content-layer tools: they make assets fast, but they cannot supply the positioning.

### 1.2 Jobs-to-be-done: the evidence layer

- **Four forces** (Moesta and Spiek): a customer switches when **Push + Pull > Anxiety + Habit**. Push is the problem with the current situation, pull is the appeal of the new one, anxiety is fear about the new option, and habit is the inertia of the old way. The site calls anxiety "the most underestimated force in business". [D] https://jobstobedone.org/the-four-forces/
- **Switch timeline:** First Thought → Passive Looking → Event 1 → Active Looking → Event 2 → Decision and Purchase → Actual Consumption. [D] https://jobstobedone.org/the-timeline/
- **Method:** interview people who recently switched and walk backwards through their decision. A secondary source suggests interviewing within 30 days of the switch, ideally 14. [D, secondary] https://www.koji.so/docs/switch-interviews-jtbd-method
- **Why it matters for marketing [I]:** messaging that only adds pull (features) ignores anxiety ("will this break my store / my store credit?") and habit ("we already use Smile.io" or "we do nothing"). A merchant loyalty app's best copy may be about safety, reversibility and setup time, not features.

**Template: switch interview guide (one page)** [I]
1. Context: who are you, what is your store, and what were you using before?
2. First thought: when did you first think "we need something for repeat customers / store credit"? What was happening?
3. Passive → active: what did you look at? What did you rule out, and why?
4. Event 2: what made you install *today* and not last month?
5. Anxieties: what nearly stopped you? What did you check before trusting it?
6. Habit: what did you have to stop doing? What still feels awkward?
7. Consumption: what happened in week one? What surprised you?

Record the answers as verbatim quotes in the proof bank (§1.6), tagged push/pull/anxiety/habit.

### 1.3 Positioning: April Dunford's method

- **Five components, in this order:** (1) competitive alternatives, meaning what the customer would do if you didn't exist, including the status quo; (2) differentiated capabilities ("key unique attributes"); (3) value for customers (the "so what?"); (4) target customers who care a lot about that value; (5) market category, the context that makes the value obvious. [D] https://www.aprildunford.com/post/a-quickstart-guide-to-positioning (2021-03-15)
- Work in that order, because each component depends on the one before. [D] same
- **Don't use the fill-in-the-blank positioning statement.** She calls it "pointless but potentially dangerous". [D] same
- **Name only alternatives you actually lose to.** Leave out "phantom competitors", and include "do nothing". [D] same
- **Category:** pick an existing category buyers already understand, or create one, which is costly. Most companies start in an existing category. [D] same
- **Editions:** *Obviously Awesome* has an updated and expanded edition. One retailer lists a second edition dated 27 Jan 2026, and its blurb describes a five-step process. Dunford's site offers a free **Positioning Canvas**, a reference positioning flow, a **messaging document template**, and a "Styles of Positioning" card through a newsletter form. Her second book, *Sales Pitch*, describes an eight-step pitch structure. [D] https://www.aprildunford.com/books ; [D, retailer] https://www.hugendubel.de/de/ebook_epub/april_dunford-obviously_awesome-52549076-produkt-details.html
- Re-check positioning about every six months. [D, secondary] https://www.shortform.com/blog/product-positioning-strategy-2/

**Template: positioning canvas (fill one per brand)** [I, structure from Dunford's components]

| Field | Content | Evidence (link to proof bank) |
|---|---|---|
| Competitive alternatives | What best-fit buyers do today (named products + "do nothing" + spreadsheets/manual) | interview IDs |
| Unique capabilities | 3–5 things only you have, compared with *those* alternatives | |
| Value (so what?) | One value theme per capability, in the customer's words | |
| Best-fit customers | Observable traits that make someone care a lot (not demographics) | |
| Market category | Frame of reference; existing or new | |
| Relevant trend (optional) | Why now | |
| Positioning style | Head-to-head / big fish in small pond / new category (from Dunford's styles card) | |

**Worked illustration for RewardsPro (a hypothesis, not a decision)** [I]: alternatives could be Smile.io (described by a competitor as "the default loyalty app for Shopify" [D, secondary] https://www.ringly.io/blog/smile-io-alternatives), LoyaltyLion, Yotpo, Rivo, manual discount codes, or doing nothing. The memory note's proposed wedge points to the "big fish in a small pond" style: loyalty for **trading-card stores that pay trade-ins in store credit**. That is a niche where Cambridge TCG's own domain knowledge is the unique attribute. Validate it with 5–10 switch interviews of TCG store owners before treating it as true.

### 1.4 Brand platform: purpose, promise, personality, voice

- **Voice versus tone:** "You have the same voice all the time, but your tone changes." Voice is the fixed traits; tone flexes with the reader's state. Mailchimp's guide pairs traits with limits ("weird but not inappropriate, smart but not snobbish"). It is published under CC BY-NC 4.0. [D] https://styleguide.mailchimp.com/voice-and-tone/
- **Tone dimensions** (Nielsen Norman Group, Kate Meyer, 2016): funny–serious, formal–casual, respectful–irreverent, enthusiastic–matter-of-fact. Their study found tone significantly affected perceived friendliness, trustworthiness and willingness to recommend. [D, secondary; nngroup.com returned 503 today] https://www.beta.knowledgeowl.com/blog/posts/four-dimensions-of-tone-of-voice/
- **"Onliness"** (Marty Neumeier, *Zag*): a one-sentence statement of what makes you the only one, and it is situational, not permanent. [D, secondary] https://www.blinkist.com/books/zag-en ; https://useallfive.com/thoughts/a-modern-view-of-branding-author-marty-neumeier-talks-shop-with-use-all-five

**Template: brand platform (one page per brand)** [I]
```
Purpose     – why this brand exists beyond money (1 sentence)
Promise     – what a customer can always count on (1 sentence; must be provable)
Onliness    – "<Brand> is the only <category> that <unique value> for <best-fit customer>"
Personality – 3–4 traits, each written "X but not Y"
Voice       – positions on the 4 NN/g scales (e.g. serious 70 / casual 60 / respectful 90 / matter-of-fact 70)
Tone shifts – onboarding, error/apology, celebration, legal/billing
Words we use / words we avoid – banned hype words, required terms (e.g. "store credit", not "cash")
```

### 1.5 Messaging house (message hierarchy)

- **Structure:** the roof is one umbrella statement, usually one sentence. Under it sit 3–4 pillars, each a distinct value driver with "no overlap, no gaps". The foundation is proof (data, examples, quotes). Some versions add an "applications" layer for each audience or funnel stage. [D, secondary] https://umbrex.com/?p=241777 ; https://www.thestarrconspiracy.com/insights/guides/how-to-create-messaging-framework
- **Multi-product portfolios** can use a "house of messages": a corporate roof with a separate house per product. [D, secondary] same Starr Conspiracy guide
- **Governance:** a framework only sticks with an owner, an update cadence and enforcement. Version the proof points. [D, secondary] same
- **On the page:** headlines get read and subheads often don't. Explain the value before showing proof. Test from strategic to tactical: value proposition, then framing, then proof type, then headline wording, then CTA. [D, secondary] https://convertibles.dev/blogs/case-studies/homepage-banner-copy-test-case-study ; https://benly.ai/learn/brand-xray/brand-messaging-testing

**Template: messaging house** [I]
```
ROOF (umbrella, ≤ 15 words):  ______________________________________
  Audience line (who it's for): ________________________
PILLAR 1 (value theme)     PILLAR 2                 PILLAR 3
  headline (≤ 8 words)       headline                 headline
  2-sentence explanation     ...                      ...
  proof: P-ids from bank     proof: P-ids             proof: P-ids
  objection it answers       ...                      ...
  (anxiety / habit)
CTA ladder: primary ("Install free") · secondary ("See how store credit works")
Applications: App Store listing · landing hero · onboarding email 1 · demo video · trade-show card
```

### 1.6 Proof points and the proof bank

- **Copy test (Harry Dry):** can I visualise it? Can I falsify it? Can nobody else say it? "If you have three no's, you've probably written a lot of rubbish." [D, secondary] https://upgrow.io/blog/harry-dry-copywriting-3-rules
- **Brief evidence:** in the IPA-linked BetterBriefs survey (2021, 1,700+ respondents in 70+ countries), 80% of marketers thought they wrote good briefs but only 10% of agencies agreed, and respondents estimated about 33% of budget was wasted through poor briefing. These are self-reported figures. [D] https://www.lbbonline.com/news/global-research-uncovers-one-third-of-marketing-budgets-could-be-wasted-due-to-poor-briefing ; https://ipa.co.uk/news/betterbriefs-compendium/
- **UK law on reviews and proof:** from 6 April 2025 the DMCC Act 2024 bans fake consumer reviews, concealed incentivised reviews, and misleading presentation of reviews. The CMA published guidance CMA208 on 4 April 2025, and penalties can reach 10% of global turnover. [D, secondary] https://cms.law/en/gbr/legal-updates/no-more-faux-five-stars-the-dmcc-act-bans-fake-reviews
- **Shopify:** "Never create fake reviews, or offer merchants incentives for leaving positive reviews." Doing so can get the app removed. [D] https://shopify.dev/docs/apps/launch/marketing

**Template: proof bank (a CSV or TOML file, one row per proof)** [I]
`id, claim_it_supports, type (metric|quote|demo|third-party|spec), statement, source_url_or_file, date_observed, consent (for quotes), expiry/review_date, used_in (asset ids)`
Rule: an asset may only make a factual claim that cites a proof-bank id. This is how an agent pipeline keeps copy truthful (§8).

---

## 2. Brand architecture for a portfolio

- **The spectrum** (Aaker and Joachimsthaler, 2000, "The Brand Relationship Spectrum", *California Management Review*): branded house → sub-brands → endorsed brands → house of brands. It is a continuum of four strategies and nine sub-strategies. [D] https://moodle.novasbe.pt/pluginfile.php/672530/mod_resource/content/1/aaker-joachimsthaler-2000-the-brand-relationship-spectrum-the-key-to-the-brand-architecture-challenge.pdf ; summary https://brandingstrategyinsider.com/brand-architecture-for-competitive-advantage/
  - **Branded house:** one master brand drives the purchase and sub-brands are descriptors (Virgin, Nike). **House of brands:** stand-alone brands, each maximising impact in its niche. **Endorsed:** independent brands carrying an organisational endorsement. [D] same
- **The decision has been oversimplified** into a binary choice. [D] https://www.warc.com/content/article/warc-exclusive/the-brand-strategy-toolkit-branded-house-and-house-of-brands/en-gb/135102
- **Academic model:** Jungju Yu (*Marketing Science*, 2021). Reputation spillover depends on how related the markets are. Separate names can credibly commit a firm to investing in each market. [D, secondary summary] https://scholars.cityu.edu.hk/en/publications/a-model-of-brand-architecture-choice-a-house-of-brands-vs-a-brand/
- **Practitioner criteria:** customer overlap (heavy overlap favours a branded house); reputation concentration (a branded house shares risk across everything); acquisitions; marketing economics (separate brands cost more to run); and hybrids that need "strong parent equity" to avoid confusion. [D, secondary, vendor blogs] https://vivaldigroup.com/house-of-brands-vs-branded-house-which-architecture-model-is-right-for-your-portfolio/

**Decision grid for the estate** [I]

| Question | If yes → | Estate reading (hypothesis) |
|---|---|---|
| Do the brands share buyers? | branded house / endorse | Collectors (Cambridge TCG) ≠ Shopify merchants (RewardsPro) ≠ agent builders (agenttool) ≠ KINGDOM/zerone communities. Little overlap. |
| Would a failure in one hurt the others? | separate | Commerce, crypto/chain, and spiritual/relational projects carry very different risk profiles. Keep them apart. |
| Does a parent name add credibility for the buyer? | endorse | "Cambridge TCG Limited" already appears as RewardsPro's developer [O]. For merchants that could read as either "built by a real card shop" (good for the TCG wedge) or as off-category. Test it with buyers. |
| Can one person maintain N separate kits? | fewer brands | No, not at about 20 names [O 0.11]. Use tiers. |

Suggested shape [I]: a **house of brands with a light, optional endorsement** where it helps the buyer ("RewardsPro, by Cambridge TCG" in the TCG-store niche only). Tier the portfolio:
- **Focus (1–2 brands):** a full platform, messaging, kit and weekly content.
- **Maintain:** a minimal kit (logo, tokens, favicons, OG image) and an accurate one-line positioning.
- **Dormant:** an honest holding page, with no promotion.

The estate's `estate/curated/*.toml` could carry a `brand_tier` and `architecture_role` per project. The registry belongs there, not in a new place.

---

## 3. Brand kit as a design system in code

### 3.1 Design tokens: W3C DTCG format status

- **First stable version, 2025.10, announced 28 Oct 2025** by the Design Tokens Community Group. It is a "production-ready, vendor-neutral format". It is **not a W3C Standard** and not on the Standards Track; it is a Final Community Group Report. [D] https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/ ; https://www.w3.org/community/reports/design-tokens/CG-FINAL-format-20251028/
- **Modules:** Format, Color and **Resolver**. The resolver handles themes and brands through *sets* and *modifiers* with *contexts*. Its own examples include light/dark, high contrast, and a `brand` modifier (brandA/brandB). The published resolver page says "Final Community Group Report", 28 Oct 2025, and "considered stable". [D] https://www.designtokens.org/tr/2025.10/resolver/ . The GitHub source for the resolver still says `specStatus: 'CG-DRAFT'`, and the latest repo commit was 2026-09-08. [O] `gh api repos/design-tokens/community-group/...`
- **Files:** `.tokens` or `.tokens.json`, media type `application/design-tokens+json`. A token is any object with `$value`. Optional fields are `$type`, `$description`, `$extensions` and `$deprecated`. Aliases use `"{group.token}"` or a JSON Pointer `$ref`. Types: color, dimension, fontFamily, fontWeight, duration, cubicBezier, number; composites strokeStyle, border, transition, shadow, gradient, typography. Colours support Display P3 and OKLCH. [D] https://www.designtokens.org/tr/2025.10/format/
- **Tools:** reference implementations are Style Dictionary, Tokens Studio and Terrazzo. Penpot, Figma, Sketch, Framer, Knapsack, Supernova and zeroheight support or implement it. [D] W3C announcement. Style Dictionary's latest release is **v5.7.0 (2026-10-16)**. [O] `gh api repos/style-dictionary/style-dictionary/releases`. A vendor doc says v5 uses DTCG 2025.10 as its base format, and one secondary source says resolver support is still incomplete. [D, secondary] https://help.zeroheight.com/hc/en-us/articles/48049028236187

**Why this matters for agents [I]:** a tokens file is the one place where "what is RewardsPro blue?" is answered in machine-readable form. Websites (CSS variables), email templates, ArtCraft/vectorcraft renders, slide decks and OG-image generators all read the same file. A brand change becomes a one-line diff with review, not a hunt through 40 PNGs.

**Template: multi-brand token repo layout** [I]
```
brand-kit/
  tokens/
    primitives.tokens.json          # raw palette (OKLCH), spacing scale, radii, font stacks
    semantic.tokens.json            # color.text.default, color.surface.brand, … → aliases into primitives
    brands/
      rewardspro.tokens.json        # overrides semantic layer for this brand
      cambridgetcg.tokens.json
    modes/ light.tokens.json, dark.tokens.json, high-contrast.tokens.json
    resolver.json                   # DTCG resolver: modifiers {brand: [...], theme: [light, dark, hc]}
  logos/<brand>/ (SVG masters + exports, see 3.2)
  icons/<brand>/ (favicon set, see 3.3)
  type/ (licences + scale config)
  platform/<brand>.md               # brand platform + messaging house + voice rules
  proof/<brand>.csv                 # proof bank
  checks/                           # contrast tests, naming lint, claims lint
  build/                            # Style Dictionary/Terrazzo config → css/, json/, swift/, …
```

### 3.2 Logo suite

The common pattern across published brand guides: a primary lockup; a compact mark or badge for small sizes; a one-colour or outline version, rather than greying out the full-colour artwork; a clear-space rule tied to a unit of the logo; and separate print and screen minimum sizes (e.g. 20 px tall on screen). [D, examples] https://brandguidelines.prioritycommerce.com/logo ; https://median.co/brand ; https://www.sendible.com/brand-guidelines-page

Template [I]: `primary-horizontal`, `primary-stacked`, `mark` (square), `wordmark`; each in `color`, `mono-dark`, `mono-light` (reverse); SVG master plus PNG exports at 1×/2×/3×; a clear-space spec; minimum sizes; and misuse examples.

### 3.3 Favicon and app-icon set (Evil Martians, page metadata 2026-01-21)

`favicon.ico` (32×32), `icon.svg` (it can carry a `prefers-color-scheme: dark` style block), `apple-touch-icon.png` (180×180), `icon-192.png`, `icon-512.png`, and a maskable `icon-mask.png` (512 canvas, artwork inside a 409×409 safe zone). Add `manifest.webmanifest` only for PWAs. Use `sizes="32x32"` on the ICO link to work around a Chrome bug. [D] https://evilmartians.com/chronicles/how-to-favicon-in-six-files-that-fit-most-needs
For a Shopify app, the App Store also needs its own app icon and listing images. Check shopify.dev requirements at the time.

### 3.4 Social preview images

Meta recommends at least 1200×630 (hard minimum 200×200, file cap 8 MB). Declare `og:image:width/height`. Meta caches by URL, so a changed image needs a new URL. [D] https://developers.facebook.com/documentation/sharing/webmasters/images . Open Graph says to also set `og:image:alt`. [D] https://ogp.me/
cambridgetcg.com already does 1200×630 [O]. rewardspro.io has no `og:image` [O].

### 3.5 Colour accessibility

- **WCAG 2.2 SC 1.4.3 (AA):** 4.5:1 for text, 3:1 for large text (18 pt, or 14 pt bold). **Logotypes are exempt**, but a low-contrast logo used as a control, or shown in low contrast by choice rather than by brand guideline, is not. [D] https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- **SC 1.4.11 Non-text contrast (AA):** 3:1 for UI components and meaningful graphics. It is a hard threshold, so 2.999:1 fails. [D] https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast
- **AAA 1.4.6:** 7:1, and 4.5:1 for large text. [D, secondary] https://specification.website/spec/accessibility/color-contrast/
- **WCAG 3 / APCA:** not settled. In April 2026 the draft still said the contrast algorithm "is yet to be determined", so do not build compliance on APCA. [D] https://adrianroselli.com/2026/04/wcag3-contrast-as-of-april-2026.html
- **European Accessibility Act:** applies from 28 June 2025 to services for EU consumers, wherever the seller is based. Microenterprises (fewer than 10 staff and ≤ €2 m turnover or balance sheet) are reportedly exempt for *services*. The practical benchmark is EN 301 549, which tracks WCAG 2.1 AA. [D, secondary — check against Directive (EU) 2019/882] https://www.iubenda.com/en/help/179096-eaa-compliance
- **Workflow [I]:** encode the accessible pairs as semantic tokens (`text.on-brand`) and run a contrast test in `checks/` on every token change, so an agent can't ship an unreadable variant.

### 3.6 Type scale

Use a modular scale (a base size times a ratio such as 1.2 or 1.25). Utopia's "fluid" approach defines one scale for a small viewport and one for a large viewport, and the browser interpolates between them with `clamp()`. Its calculator example uses viewports 360–1240, base 18–20, and ratios 1.2–1.25. [D] https://utopia.fyi/ ; https://smashingmagazine.com/2021/04/designing-developing-fluid-type-space-scales/
Express each step as a `dimension` or `typography` token. Named steps prevent ad-hoc font sizes. [D] Smashing

---

## 4. The content operating system

### 4.1 Pillars

Keep 3–5 recurring themes per brand, rooted in expertise and in what the audience wants. Give each pillar a cadence, and measure engagement and conversion per pillar. [D, secondary] https://www.shopify.com/blog/content-pillars ; https://sociallyup.beehiiv.com/p/building-your-social-media-content-pillars
Example pillars [I]: **RewardsPro**: (1) store-credit economics for card shops, (2) setup and how-to, (3) merchant stories (with consent), (4) product changelog. **Cambridge TCG**: (1) price and market data insights, (2) card identity and standards explainers, (3) collector culture, (4) open-data releases.

### 4.2 Repurposing chain (one source → many assets)

- **GaryVee's "reverse pyramid":** one pillar piece (a keynote, vlog or podcast) is cut into "dozens" of micro pieces that point back to it. [D] https://garyvaynerchuk.com/the-garyvee-content-strategy-how-to-grow-and-distribute-your-brands-social-media-content/
- **Ross Simmonds, *Create Once, Distribute Forever*:** distribution is the main lever. Research where the audience already is, then reuse and redistribute over months. His B2B example is about 5 hours to make a video and about 15 hours distributing it. [D, secondary] https://buzzstream.com/blog/content-distribution-podcast ; https://marketingagainstthegrain.com/articles/ross-simmonds-on-ai-and-experimentation
- **COPE (Create Once, Publish Everywhere), NPR:** content stored as structured data behind an API, then rendered to every surface. [D, secondary, slide deck] https://www.slideshare.net/slideshow/adapting-ourselves-to-adaptive-content-12133365/12133365

**Template: repurposing chain** [I]
```
SOURCE (monthly, 1 per focus brand): a data note / teardown / 5-min screen recording + transcript
 ├─ Long: blog/guide page (SEO, canonical)            ─ owner: human; agent drafts from transcript
 ├─ Email: newsletter issue (summary + 1 CTA)
 ├─ Social: 3–5 short posts (quote, chart, clip)      ─ agent cuts; human approves
 ├─ Visual: 1 chart + 1 OG image + 2 carousel frames  ─ ArtCraft/vectorcraft from tokens
 ├─ Video: 2–3 clips with captions (≤ 60 s)
 ├─ Community: answer 2 relevant threads using it (no spam)
 └─ Sales/support: snippet into FAQ / App Store listing / onboarding
Each derivative carries: source id, proof ids, UTM, alt text, provenance note.
```

### 4.3 Cadence

Batch distribution into fixed, protected blocks. Practitioners describe about 10 protected hours a week (roughly 3 on the core asset, 2 on customer conversations, 3 on distribution, 2 on review), or a daily marketing hour, and keeping the schedule for four weeks before tuning it. These are anecdotes and templates, not studies. [D, secondary] https://gauravtiwari.org/marketing-for-solopreneurs/ ; https://routine.co/blog/posts/design-30-hour-workweek
*Traction*'s "50 percent rule": spend half your time on product and half on traction. "Almost every failed startup has a product. What failed startups don't have is enough customers." [D] https://grahammann.net/book-notes/traction-gabriel-weinberg

### 4.4 Editorial calendar

**Template: calendar row** [I]
`id | brand | pillar | funnel stage (AARRR) | source asset id | format | channel | publish date | owner (agent/human) | status (idea→brief→draft→QA→approved→scheduled→live→measured) | brief link | proof ids | UTM campaign | result (7-day / 30-day)`
Keep it as a file or table the agents can read and write: CSV/TOML in a repo, or an Artifact DB. That way status changes leave an audit trail.

### 4.5 Creative brief

Briefs should be 1–2 pages: background, objective, audience, single-minded proposition (one sentence), reasons to believe (nothing invented, every number traceable), deliverables with formats and placements, mandatories (legal, brand, budget, dates), success measure, approvers and timings. [D, secondary, vendor guides] https://arcalea.com/tools/creative-brief ; https://selzee.com/creative-brief-template ; https://profiletree.com/how-to-write-a-creative-brief/ . BetterBriefs found 65% of agencies unclear on the target audience and 88% unclear on how work would be evaluated. [D] https://ipa.co.uk/news/betterbriefs-compendium/

**Template: creative brief (agent-readable)** [I]
```yaml
id: CB-2026-11-rewardspro-tcg-landing
brand: rewardspro
objective: "Get 10 TCG-store installs that complete onboarding by 2026-12-15"   # one measurable outcome
audience: "UK/EU Shopify TCG stores that pay trade-ins in store credit"         # best-fit from canvas
insight: "<JTBD quote, interview id>"
proposition: "<one sentence, from messaging house pillar>"
reasons_to_believe: [P-003, P-007]          # proof-bank ids only
tone: {serious: 70, casual: 55, respectful: 90, matter_of_fact: 75}
deliverables: [{format: landing-hero, size: 1440x900}, {format: og-image, size: 1200x630}, {format: listing-screenshot, count: 3}]
mandatories: [tokens: brand-kit/tokens@<git sha>, no chance/raffle mechanics, no review incentives, AI-image disclosure check]
measure: {primary: onboarding_completed, utm_campaign: "2026-11_tcg-store-credit"}
approver: Yu
due: 2026-11-07
```

### 4.6 Creative QA checklist (the gate before anything is public) [I, items sourced]

1. **Brand:** only tokens from a pinned kit version are used; logo clear space and minimum size respected; voice matches the platform's tone settings.
2. **Truth:** every factual claim maps to a proof-bank id; Harry Dry's three tests; no invented urgency or scarcity. Run fomoscan/rhetorlint, which the estate already owns [D 0.10].
3. **Law and platform rules (UK/EU, as of Oct 2026):**
   - DMCC Act: no fake or concealed-incentive reviews (§1.6).
   - Shopify: no review incentives.
   - CAP/ASA: ads made with AI are under the same misleadingness rules, and disclosure cannot rescue a misleading ad. Ask (a) would the audience be misled without disclosure, and (b) does the disclosure clarify or contradict the message? [D, secondary] https://www.rpclegal.com/snapshots/advertising-and-marketing/summer-2025/cap-issues-guidance-on-use-of-ai-in-ads/
   - EU AI Act Art. 50: deployers must disclose deepfakes (AI image, audio or video that appears real) from 2 Aug 2026. Machine-readable marking (Art. 50(2)) has a grace period to 2 Dec 2026 for systems already on the market. [D, secondary] https://labs.cloudsecurityalliance.org/research/csa-research-note-eu-ai-act-article-50-transparency-20260729/
   - Paid-chance mechanics (raffles, mystery boxes) need legal advice first [D, memory 0.2].
4. **Accessibility:** text contrast ≥ 4.5:1 (3:1 large); alt text on every image and `og:image:alt`; captions on video.
5. **Search hygiene:** no mass near-duplicate pages (§6.6). AI-generated product images in Google Merchant Center must carry IPTC `DigitalSourceType=TrainedAlgorithmicMedia`, and AI-generated product text must be labelled. [D] https://developers.google.com/search/docs/fundamentals/using-gen-ai-content (updated 2026-10-01)
6. **Tracking:** UTMs present, lowercase, and from the registry (§6.3); links tested.
7. **Provenance:** a sidecar records the source, tool, model, prompt id, approver and date. Optionally embed C2PA Content Credentials. Platform support is patchy, and metadata is often stripped on upload. [D, secondary] https://softwareseni.com/c2pa-adoption-in-2026-hardware-platforms-and-verification-reality

### 4.7 Approvals: autonomy tiers for agents

The Canadian Marketing Association's *Managing AI Agents in Marketing* (August 2026):
- **Full autonomy:** data processing, small bid adjustments, report generation, social *scheduling*. Decision rule: "internal and low-risk only".
- **Human in the loop:** content drafts, campaign builds, creative variants. Decision rule: "human sign-off before anything publishes".
- **Human-led:** brand strategy, crisis comms, legal sign-off, annual planning.
- Rule of thumb: "if it touches a customer's trust or your brand's public face, a human stays in the loop."
- Agent-manager skills: intent writing, task decomposition, output verification ("score outputs against brand rubrics"), escalation judgement, human–AI collaboration design.

[O] read today: https://thecma.ca/docs/default-source/default-document-library/CMA-AI-Playbook-45_AI-Agent-Management.pdf
This matches the estate's own ground rule that publishing, posting, sending and spending are outward acts needing Yu's word [D] `~/.claude/rules/ground.md`.

### 4.8 Asset library (a light DAM) naming and versioning

DAM guidance: consistency matters more than the particular scheme; use a fixed date format (YYYYMMDD / ISO 8601); separate fields with hyphens or underscores; avoid spaces and special characters; include a version; and parse name fields into tags. [D, secondary] https://resourcespace.com/blog/file-naming-conventions ; https://www.acquia.com/glossary/file-naming-conventions

**Template: naming convention** [I]
```
<brand>_<campaign-or-pillar>_<asset-type>_<variant>_<WxH>_<yyyymmdd>_v<NN>.<ext>
rewardspro_tcg-store-credit_og-image_dark_1200x630_20261105_v02.png
```
- Keep **masters** (SVG, layered source, prompt and seed) in git, or git-LFS for large binaries. Treat **exports** as build products regenerated from master plus tokens.
- Don't overwrite an approved file. A new version gets a new name, and since Meta caches images by URL, new names also bust caches [D §3.4].
- Each asset gets a sidecar `*.meta.json`: brief id, proof ids, tokens git sha, tool and model, approver, publish URLs, licence/rights, AI-generated true/false.

---

## 5. Channel selection

### 5.1 Bullseye (*Traction*, Weinberg and Mares)

- **19 channels:** viral marketing, PR, unconventional PR, SEM, social and display ads, offline ads, SEO, content marketing, email marketing, engineering as marketing, influencers (Demand Curve's wording; I recall the 2015 book calling this one "targeting blogs", unverified), business development, sales, affiliate programs, existing platforms, trade shows, offline events, speaking engagements, community building. [D] https://demandcurve.com/newsletters/growth-newsletter-209 (12 Sep 2024)
- **Steps:** Brainstorm at least one idea per channel → Rank into A (promising now), B (possible), C (long shots) → Prioritise about 3 for the inner ring → Test cheaply in parallel → Focus on the winner until it saturates, then repeat. [D] https://brianbalfour.com/essays/traction-the-bullseye-framework (2 Sep 2014)
- **A test answers three things:** roughly what a customer costs through this channel, how many customers it can supply, and whether they are the customers you want. Speed of data comes first; "a few hundred dollars" gives a rough read. [D] same

### 5.2 The four fits (Brian Balfour)

Market–product, product–channel ("channels do not mold to products"), channel–model ("your channels are determined by your model and vice versa", the ARPU ↔ CAC spectrum), and model–market. [D] https://brianbalfour.com/four-fits-growth-framework
**For the estate [I]:** a *free* Shopify app has near-zero ARPU, so it needs near-zero-CAC channels: the App Store itself (an "existing platform"), community, content/SEO, partnerships with TCG distributors or POS vendors, and founder-led outreach to a short list. Paid ads only make sense once a paid plan exists, and that depends on Yu's pricing decision [D 0.8].

### 5.3 Brand versus activation, organic versus paid

Binet and Field's 60/40 brand/activation split comes from IPA case data. It varies by category and lifecycle: one IPA-linked figure for a brand's first year is 35% brand / 65% activation. Byron Sharp called 60:40 "terrible and misleading". [D, secondary] https://www.warc.com/newsandopinion/news/binet_highlights_importance_of_brand_building/42010 ; https://www.marketingweek.com/start-ups-brand-building-sales-profit/ ; https://www.mi-3.com.au/07-09-2022/how-brands-shrink-prof-byron-sharps-takedown-binet-field-attention-metrics
**For one person with no budget [I]:** the useful lesson is to build distinctive brand assets consistently (same colours, mark, phrasing) from day one, while nearly all effort goes to direct activation. Ehrenberg-Bass (Romaniuk) judges distinctive assets on **fame** (the share of buyers who link the asset to the brand, measured unprompted) and **uniqueness** (whether it evokes only you). [D, secondary] https://marketingscience.info/news-and-insights/mumbrella360-ehrenberg-bass-professor-says-youre-poorly-branding-if-youre-focusing-on-assets-over-your-brand

### 5.4 Existing platform: the Shopify App Store (RewardsPro's main channel) [D]

- **Built for Shopify** gives higher search ranking, a badge, a search filter, ad targeting by merchant plan, eligibility for the personalised homepage collection, priority review, and admin "Picked for you". Criteria include performance, ease of use, and "proven usefulness" (installs, review count and rating over a rolling window). Status is checked annually. https://shopify.dev/docs/apps/launch/built-for-shopify
- **Listing guidance:** complete every field; use a keyword list (Google Keyword Planner) without stuffing; cover spelling variants. Track listing traffic with Google Analytics or a Meta pixel. App Store search ads exist. Shopify also suggests webinars, community forums (not spammy), freemium, and partner-friendly plans. https://shopify.dev/docs/apps/launch/marketing
- Ranking factors are not published. Vendor consensus: the app name carries the most weight, then the subtitle and tags, plus click-through, install velocity and low uninstall rate. [D, secondary, vendor] https://blog.appjubilee.io/shopify-app-store-seo-rank-higher/

### 5.5 Founder-led manual recruitment

Paul Graham, "Do Things that Don't Scale" (July 2013): recruit users manually ("You can't wait for users to come to you"), delight the first ones, and consult closely for a single user. [D] https://paulgraham.com/ds.html
For launch directories and communities, see the curated list *Marketing for Founders* (19 sections: launch places, Product Hunt, Reddit, SEO/"LLM SEO", ads, affiliates, free-tool marketing, positioning, and more). [D] https://github.com/EdoStra/Marketing-for-Founders

**Initial inner-ring hypotheses** [I, to be tested, not decided]

| Brand | Inner ring (test first) | Why |
|---|---|---|
| RewardsPro | (1) App Store listing and keywords, (2) direct outreach to about 30 named TCG Shopify stores, (3) TCG-store community spaces | zero ARPU; niche wedge; listing has 0 reviews [O] |
| Cambridge TCG (data) | (1) SEO on card and price pages *with unique data*, (2) community (Discord/Reddit TCG), (3) "engineering as marketing" (free price tools/API) | its public face is open data [O 0.4] |

---

## 6. Funnel and measurement

### 6.1 AARRR and the North Star

- **AARRR** (Dave McClure, 2007): Acquisition, Activation, Retention, Referral, Revenue. Use one key metric per stage and watch stage-to-stage conversion for leaks. The RARRA variant puts retention first. [D, secondary] https://www.productplan.com/glossary/aarrr-framework ; https://www.amplitude.com/blog/pirate-metrics-framework.md
- **North Star:** "a single, crucial metric … that represents the value your product provides its customers", backed by 3–5 input metrics the team can move directly. [D] https://amplitude.com/books/north-star/defining-your-North-Star

### 6.2 Minimal metric set per focus brand (≤ 7 numbers) [I]

| Stage | RewardsPro (Shopify app) | Cambridge TCG (data site) |
|---|---|---|
| Acquisition | listing views → installs (Partner Dashboard) | organic sessions to card/price pages |
| Activation | % installs completing onboarding *and* issuing a first reward within 7 days | % sessions that search a card and view a price history |
| Retention | stores with ≥ 1 reward event in weeks 4–8 | returning visitors per month; API keys active at 30 days |
| Referral | reviews (unincentivised), mentions | inbound links, API citations |
| Revenue | n/a until Yu's pricing decision [D 0.8] | unknown [0.9] |
| North Star (candidate) | store credit issued to shoppers per week across active stores | weekly card lookups by returning users |
| Qualitative | interviews this month (target 4) | interviews this month (target 2) |

### 6.3 UTM discipline

Google Analytics supports `utm_id`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_source_platform`, `utm_term` and `utm_content`, plus `utm_creative_format` and `utm_marketing_tactic`, which are not reported yet. Always set source, medium and campaign. Values are case-sensitive, so "use lowercase as a standard practice" with a strict naming convention. [D] https://support.google.com/analytics/answer/10917952

**Template: UTM registry (one CSV the agents must use)** [I]
```
utm_source   : appstore | newsletter | reddit | discord | linkedin | x | partner-<name> | direct-outreach
utm_medium   : listing | email | social | community | referral | cpc | outreach
utm_campaign : yyyy-mm_<brand>_<theme>       e.g. 2026-11_rewardspro_tcg-store-credit
utm_content  : <asset id from DAM>            e.g. og-dark-v02
utm_id       : <calendar row id>
```
Shopify App Store caveat: listing traffic carries `surface_type` (e.g. `search`, `search_ad`) and `surface_detail`, but installs often appear as "direct" in GA4 because attribution is lost across the install redirect. Add UTMs to the links you control, and use Partner Dashboard install counts as the source of truth. [D, secondary, forum 2021–2024] https://community.shopify.dev/t/traffic-source-from-shopify/23515

### 6.4 Privacy-friendly analytics and UK law (state as of Oct 2026)

- **Data (Use and Access) Act 2025:** the main Part 5 provisions came into force on 5 Feb 2026 [D] https://www.gov.uk/guidance/data-use-and-access-act-2025-plans-for-commencement (updated 2026-10-12). Commentary says this included the PECR cookie changes [D, secondary] https://www.wiggin.co.uk/insight/key-provisions-of-the-data-use-and-access-act-2025-come-into-force/
- **ICO final storage-and-access guidance, 29 Apr 2026.** There are five exceptions, including **statistical purposes** and **appearance**. The statistical exception applies only when the *sole* purpose is collecting statistics about use of your service to improve it. You must still give "clear and comprehensive information" and "a simple means of objecting, free of charge". It **does not apply to online advertising**, including ad measurement or performance, or to monitoring individuals. A third-party analytics provider must be a **processor, not a joint controller**. Analytics tags under the exception must allow objection whether they run client-side or server-side. [D] https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/what-are-the-exceptions/ ; https://cy.ico.org.uk/about-the-ico/media-centre/news-and-blogs/2026/04/final-storage-and-access-technologies-guidance-published/
- **PECR fines** reportedly rose to the greater of £17.5 m or 4% of turnover. [D, secondary] https://brodies.com/insights/ip-technology-and-data/storage-and-access-technologies-ico-publishes-updated-guidance-on-the-use-of-cookies-and-other-tracking-technologies/
- **Options:**
  - **Cloudflare Web Analytics:** free; no cookies or localStorage; no fingerprinting; counts "visits" rather than unique users. Default enablement since 15 Oct 2025 excludes EU visitors unless changed. [D] https://developers.cloudflare.com/web-analytics/about/ ; https://blog.cloudflare.com/the-rum-diaries-enabling-web-analytics-by-default/ . Note [I]: the estate already uses Cloudflare for many zones, so this costs nothing to add.
  - **Plausible:** Starter $9/mo (10k pageviews), Growth $14/mo; "No cookies"; "made and hosted in the EU"; code public and self-hostable. [O] https://plausible.io (2026-10-20)
  - **Umami** (MIT, self-host) and **Fathom** (about $15/mo for 100k): [D, secondary, prices unverified] https://dev.to/vikasprogrammer/6-best-google-analytics-alternatives-in-2026-i-checked-every-price-2i5m
  - Even cookieless tools fall under the ICO's information-and-objection duty when they use the exception. Put an analytics paragraph and an opt-out in the privacy notice [I].
- **Ad pixels** (Meta, Google Ads conversion tracking) still need consent under the ICO guidance. A consent banner is needed only if you run them [I from the ICO text]. The ICO has advised DSIT on possible future advertising exceptions, but that is a proposal, not law. [D] https://ico.org.uk/media2/yefdqvk4/20260505-report-for-dsit-on-changes-to-regulation-6-pecr-for-online-advertising.pdf

### 6.5 Experiment loop

- **Hacking Growth** (Ellis and Brown): analyse → ideate → prioritise (ICE: Impact, Confidence, Ease) → test, run by a one-hour weekly meeting, with cycles of one to two weeks. Small teams start at one or two tests a week. ICE is a "good enough" relative guide; Itamar Gilad's Confidence Meter asks for evidence behind the confidence score. [D, secondary] https://www.shortform.com/pdf/hacking-growth-pdf-sean-ellis-and-morgan-brown ; https://www.productplan.com/glossary/ice-scoring-model
- **Low-volume reality [I]:** with about 0–50 installs, A/B tests cannot reach significance. Experiments should be *qualitative or directional*: "did 5 of 30 contacted stores reply?" or "did the new listing headline change listing-to-install rate over 4 weeks?" Pre-register a pass/fail threshold so a weak result can't be explained away afterwards.

**Template: experiment card** [I]
`id | brand | hypothesis ("If we …, then … because <JTBD insight>") | metric + baseline | pass threshold | ICE (1–10 each) | cost/time box | start/end | result | decision (kill / iterate / scale) | learning → which canvas/house field changes`

### 6.6 Search in the AI-answer era (Google, as of Oct 2026)

- Google's generative AI features in Search are "rooted in our core Search ranking and quality systems". Create non-commodity content with first-hand insight. "You don't need to create new machine readable files, AI text files, markup, or Markdown to appear in Google Search", so llms.txt is ignored by Google Search, though harmless for other services. No chunking or special AI writing style is needed. Use Merchant Center and Business Profile data. Be wary of "AEO/GEO" tools promising ranking. [D] https://developers.google.com/search/docs/fundamentals/ai-optimization-guide (updated 2026-07-10)
- **Scaled content abuse:** "many pages … generated for the primary purpose of manipulating search rankings". Since May 2026 Google says its spam policies also apply to generative AI responses. [D] https://developers.google.com/search/docs/essentials/spam-policies ; https://developers.google.com/search/updates
- **For Cambridge TCG's card and price pages [I]:** templated pages are safe when each page carries real, distinct data (prices, history, identity). Index only demand-backed pages, and don't let an agent mass-produce thin variants. [D, secondary] https://seojuice.com/blog/programmatic-seo/

---

## 7. The smallest viable weekly marketing routine (one person, about 5–6 hours plus agents) [I]

Built from the cadence sources (§4.3), the Hacking Growth weekly meeting (§6.5), PG's manual recruitment (§5.5) and the CMA autonomy tiers (§4.7). Scope it to **one focus brand at a time**.

| When | Human (Yu) | Agents | Output |
|---|---|---|---|
| **Mon 45 min: review** | Read the one-page metrics digest; pick 1–2 experiments (ICE); approve or kill last week's | Compile the digest from analytics, Partner Dashboard and the calendar (full autonomy, internal) | Updated experiment cards |
| **Tue 60 min: customers** | 1 customer/prospect conversation (switch interview or onboarding call) | Transcribe with consent, tag quotes push/pull/anxiety/habit, propose proof-bank rows | Interview notes, proof candidates |
| **Wed 90 min: make** | Record or write the week's source asset (or approve the agent draft built from the interview) | Draft derivatives from the brief: copy, ArtCraft visuals from tokens, captions, alt text, UTMs | Draft pack in DAM, status = QA |
| **Thu 45 min: approve** | QA gate (§4.6) and approve, edit or reject; record the approval | Run automated checks (contrast, claims-to-proof, fomoscan/rhetorlint, UTM lint) *before* Yu sees it | Approved assets; scheduled posts |
| **Fri 60 min: distribute and recruit** | 5–10 personal outreach messages or community replies (human-written or heavily human-edited) | Schedule approved posts (autonomy tier: scheduling only after approval) | Live assets, outreach log |
| **Monthly (2 h)** | Positioning sanity check; update the messaging house from new proof; choose next month's source theme | Pillar/channel performance roll-up | Revised canvas/house diffs |
| **Quarterly (half day)** | Bullseye re-rank; brand-tier review across the estate; kit audit | Inventory of all surfaces (OG, favicon, analytics present?) | Next quarter's inner ring |

Guardrails [I]: nothing outward (posting, emailing, outreach, ads, App Store listing edits) goes out without Yu's approval, matching the estate's ground rule on outward acts. Email marketing stays off until the deliverability and legal prerequisites in the RewardsPro memory note are met [D 0.8].

---

## 8. An agentic-era design: the "brand kernel" pipeline [I]

The new piece for the agentic era is not "AI writes posts". It is making the brand **machine-readable and testable**, so agents can produce variety without drift and every output can be checked before a human approves it.

```
                ┌──────────────── BRAND KERNEL (git repo, versioned, reviewed) ────────────────┐
                │ tokens (DTCG 2025.10 + resolver: brand × theme)   positioning canvas          │
                │ logo/icon masters (SVG)                            brand platform + voice     │
                │ messaging house                                     proof bank (claims→evidence)│
                │ UTM registry                                        QA rules (machine-checkable)│
                └───────────────────────────────┬───────────────────────────────────────────────┘
                                                │ pinned by git sha in every brief
 evidence (interviews, analytics) → BRIEF (yaml) → GENERATE (LLM copy; ArtCraft/vectorcraft renders from tokens)
        ▲                                         → AUTO-QA (contrast, claim⇄proof, fomoscan/rhetorlint, UTM lint, naming lint, AI-disclosure check)
        │                                         → HUMAN APPROVAL (Yu; logged)  → PUBLISH (scheduled)  → MEASURE (cookieless analytics + Partner Dashboard)
        └──────────────────────────────── weekly review / experiment cards ◄──────────────────────────┘
```

Design choices and why:
1. **The kernel is the source of truth, and assets are build products.** Rebrand by diff, roll back by git. This follows DTCG and Style Dictionary practice (§3.1).
2. **Claims are data.** An agent can only state what the proof bank holds. This turns DMCC, CAP and Shopify review rules into a lint step rather than vigilance (§1.6, §4.6).
3. **Autonomy is tiered by blast radius** (CMA, §4.7): agents autonomously compile, draft and check; a human approves anything public; strategy (canvas, platform, architecture, pricing) is human-led.
4. **One focus brand at a time** (Bullseye "focus", §5.1). The kernel supports N brands, but the weekly routine serves one.
5. **The estate already has organs for this:** fomoscan/rhetorlint as copy gates [D 0.10]; the estate map as the brand registry; Cloudflare zones for cookieless analytics; the collab board for claiming work.

---

## 9. Artefact template index (all above)

| Artefact | Section |
|---|---|
| JTBD switch interview guide | §1.2 |
| Positioning canvas | §1.3 |
| Brand platform one-pager | §1.4 |
| Messaging house | §1.5 |
| Proof bank schema | §1.6 |
| Brand architecture decision grid + tiers | §2 |
| Multi-brand token repo layout | §3.1 |
| Logo suite spec | §3.2 |
| Favicon set | §3.3 |
| Repurposing chain | §4.2 |
| Editorial calendar row | §4.4 |
| Creative brief (yaml) | §4.5 |
| Creative QA checklist | §4.6 |
| Asset naming + sidecar | §4.8 |
| Inner-ring channel hypotheses | §5.5 |
| Minimal metrics table | §6.2 |
| UTM registry | §6.3 |
| Experiment card | §6.5 |
| Weekly / monthly / quarterly routine | §7 |
| Brand kernel pipeline | §8 |

---

## 10. Open questions (unknowns left unknown)

1. Does the 2026-09-23 "commercial retirement" stand? The memory note says no Yu decision record exists and it conflicts with Yu's 2026-07-23 free-first decision. This decides whether *any* acquisition workflow should run for RewardsPro, and whether rewardspro.io's "records only" copy should change.
2. Where does Cambridge TCG's current revenue come from, given cambridgetcg.com says paid orders are retired and wholesaletcgdirect.com redirects? The answer changes which channels matter (marketplace listings? in-person?).
3. Which single brand is the focus for the next 90 days?
4. Should the RewardsPro listing keep "Raffles & Mystery Box" in its title while those mechanics await legal advice? (A listing edit is an outward act: Yu's call.)
5. Is "Cambridge TCG Limited" as RewardsPro's visible developer an asset (TCG-niche credibility) or a liability (off-category for general merchants)? Test this with merchants.
6. One spelling: "RewardsPro" or "Rewards Pro"?
7. Which analytics, if any, run on estate sites today? None appeared in the initial HTML of the two sites checked. Analytics injected later by JS, or server-side, was not checked.
8. Is the RewardsPro readiness gate met (dev-store end-to-end run, `shopify app deploy` of the pending changes)? The memory note dated 2026-10-19 says it was not yet.
9. Does Style Dictionary 5.7 (or Terrazzo) fully implement the DTCG resolver for multi-brand builds? Secondary sources say resolver support is incomplete. Test before relying on it.
10. Microenterprise exemption under the EAA, and Art. 50 deepfake duties: confirm against the primary texts if EU consumers are targeted.

## 11. What I did not do

- I did not run vectorcraft-cli or touch ~/.kingdom or ~/.local. The ArtCraft capabilities themselves are another key's subject.
- I did not open nngroup.com (503 today), the full CMI 2026 report, or the full *Traction* or *Obviously Awesome* texts. Claims from them are marked secondary.
- The WebFetch tool cached one public PDF (the CMA playbook) under `~/.claude/projects/-Users-yournameisai/b3c581a3-.../tool-results/`. The harness did this automatically; I wrote nothing else outside `scratchpad/mkt/`.
