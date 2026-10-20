# Channels: concrete playbooks for Cambridge TCG and RewardsPro

Research notes, key `channels`. Written 2026-10-20 by a read-only research subagent. An agent wrote this, not Yu.
Basis tags: **[O]** = observed today (I looked, 2026-10-20), **[D]** = documented (a source says so; date given where known),
**[I]** = inferred (my reasoning). Unknowns are left unknown. Prices, fees and rules are time-sensitive: re-check before acting.
Nothing here was posted, sent, bought or changed. Only public GETs and web searches were used.

Earlier captures reused: `scratchpad/gtm/` (2026-10-18: App Store search and competitor listings) and `scratchpad/verify-mkt/`
(2026-10-18: RewardsPro listing, shopify.dev requirements and best-practice pages, docs clone). New raw captures are in
`scratchpad/mkt/ch/`.

---

## 0. Premise check (read this first)

The brief says Cambridge TCG "is generating revenue" and RewardsPro is "the next growth bet". The public surfaces today do not
show either one open for business. **No channel work should go live until Yu has decided what each business sells now.**

| What | Finding | Basis / source |
|---|---|---|
| cambridgetcg.com | Title "Cambridge TCG — open-source TCG data infrastructure". A site-wide banner reads "New paid orders and subscriptions are retired. Existing records, settlement and refunds remain available through your account." Served by Vercel behind Cloudflare (`x-vercel-id` header). | [O] curl of https://cambridgetcg.com/ (capture `mkt/ch/ctcg.html`) |
| wholesaletcgdirect.com | 301 redirect to https://cambridgetcg.com/ | [O] curl |
| Shopify store 6e824e-a9.myshopify.com | Answered HTTP 429 (rate limited), so its status is **unknown** | [O] curl |
| Business history | Retail and trade-in desk closed 2026-07-06 ("collectors first"), 8 retail orders in total, zero trade-ins. Wholesale retired around 2026-07-05. Wholesale had priced Japanese cards "for UK streamer clients". | [D] `be-main/estate/curated/families/commerce-tcg.toml` (as_of 2026-10-17) |
| rewardspro.io | "New paid subscriptions and paid plan changes are retired." Raffles, mystery boxes and missions show "Customer flow paused". | [O] curl of https://rewardspro.io/ |
| docs.rewardspro.io | "New paid sign-ups, trials and upgrades are retired; older feature descriptions are not current offers or instructions to grow a business." | [O] curl of https://docs.rewardspro.io/ |
| RewardsPro App Store listing | Free plan, 0.0 rating, 0 reviews, launched 16 Dec 2025, developer Cambridge TCG Limited. The page title still advertises "Raffles & Mystery Box Rewards". 3 screenshots, 1 video. | [O] https://apps.shopify.com/rewards-pro (capture `mkt/ch/rp-listing.html`) |
| Origin of the "retired" wording | A 2026-09-23 commercial-retirement sweep across 7 repos was made by agent identities, and no Yu decision record exists. It contradicts Yu's 2026-07-23 free-first pricing decision. Marketing should wait until the DB is live, the P0s are closed, a dev-store end-to-end run passes, and Yu has recorded the retirement and pricing decisions. | [D] memory note `rewardspro-rebuild-2026-10-18.md` (an agent's note, dated 2026-10-18) |

[I] For RewardsPro, a merchant who clicks from the listing to rewardspro.io today reads "retired". That alone would cancel any
listing or ads work. **Making the listing, landing page and docs tell one true story comes before any reach work.** The same
applies to cambridgetcg.com if Cambridge TCG is meant to sell again.

[I] Where Cambridge TCG's revenue comes from today is unknown to me (eBay? Cardmarket? in-person? B2B?). The playbook below is
written as options for an **online-first, Japanese-card-specialist, solo-operated** UK seller, which is what the estate map
describes. Yu should say which of these channels are actually live.

---

## A. Cambridge TCG: channel playbooks

### A1. Marketplaces (fastest route to demand that already exists)

**eBay UK**
- Business-seller final value fee for Collectables is 10.9% plus a per-order fee: £0.30 on orders of £10 or less, £0.40 above £10. A 0.35% regulatory operating fee applies to the total sale. The page has no separate "Collectable Card Games" row, and "selected Collectables categories" get a 10p per-order fee up to £10 without saying which. Shop tiers: Basic £27/mo (250 free fixed-price listings), Featured £77/mo (1,500), Anchor £437/mo (unlimited). [D] https://www.ebay.co.uk/help/selling/fees-credits-invoices/fees-business-sellers-activated-managed-payments?id=4809 ("last updated 30 September 2026", fetched 10-20). The exact CCG-singles rate needs checking in eBay's fee calculator.
- The per-order fee on orders over £10 rose from £0.30 to £0.40 from 12 Feb 2026. [D] https://www.ebay.co.uk/sellercentre/news/2026-january/rate-card-change (via search) and https://www.valueaddedresource.net/ebay-raises-final-value-fees-in-uk-germany-2026/
- eBay launched a free UK **trading-card price guide** on 1 Sep 2026: scan a raw or graded card and see up to two years of eBay sales, plus PSA/CGC population data. It covers Pokémon, MTG, Yu-Gi-Oh!, One Piece and Lorcana. eBay says Pokémon got more than 6M searches on eBay.co.uk in July 2026, and One Piece searches rose 55% month on month in Jan 2026. [D] https://www.ebayinc.com/stories/press-room/uk/ebay-launches-price-guide-for-trading-cards-in-the-uk/
  - [I] Buyers now see comparable sales on every listing, so price transparency is near total. Compete on condition truth, photos, speed and trust rather than on price.
- **Authenticity Guarantee** for trading cards sold for £500 or more began rolling out in the UK from May 2026. [D] https://channelx.world/2026/05/ebay-launches-authenticity-guarantee-for-trading-cards-in-the-uk/ (via search)
- **Condition descriptors** for singles are Graded (grader and grade required, cert number optional) or Ungraded (card condition required). This replaced "Used" in 2023. [D] https://developer.ebay.com/api-docs/user-guides/static/mip-user-guide/mip-enum-condition-descriptor-ids.html and https://valueaddedresource.net/ebay-drops-used-trading-cards-moves-to-graded-or-ungraded (via search)
- **Photo rules:** up to 24 pictures; at least 500×500 px; about 1600×1600 recommended; 1:1 or 16:9 looks best; 12 MB maximum per file; no badges, logos, copyright notices or watermarks; white background usually best, though darker can suit reflective items; no stock photo when listing a used item. [D] https://www.ebay.co.uk/help/selling/listings/adding-pictures-listings?id=4148 (fetched 10-20, no date shown)
- **eBay Live** was in beta in the UK in June 2025 for selected Collectibles sellers, who joined via an interest form. I found no 2026 update. [D] https://channelx.world/2025/06/ebay-live-officially-launched-in-the-uk/ (via search). Current status is unknown.

**Cardmarket (EU, run from Germany)**
- A pro account needs a phone number, a photo ID scan and a business registration scan, and pro sellers can apply for pre-sale status. [D] https://help.cardmarket.com/en/professional-seller-guide (no date)
- The UK VAT mechanics are on Cardmarket's help pages: Cardmarket collects VAT on UK orders of £135 or less (VOEC number on invoices). For non-EU pros selling to EU private buyers, Cardmarket collects VAT below €150 (IOSS), and EU buyers pay at least a €3 customs charge on imports from non-EU pros. [D] https://help.cardmarket.com/en/TaxRequirements and https://news.cardmarket.com/en/FoW/eu-customs-fee-on-imports-costing-less-than-150-euros (via search)
- **Commission is not verified.** Third parties say about 5% plus a small fixed fee, and a competitor claims about 11% effective. [D-weak] https://www.cardpulse.club/blog/best-trading-card-marketplaces-europe and https://cardnexus.com/en/blog/cardnexus-marketplace-is-live
- The Cardmarket API is **not accepting new applications**, and existing users may not share credentials with third-party sync tools. [D] https://help.cardmarket.com/en/cardmarket-api (via search, undated). [I] So an agent cannot automate Cardmarket stock unless an API key already exists.

**TCGplayer**
- Not a route for a UK seller. International listing is open only to "US and Canadian based sellers" who meet volume and feedback thresholds. [D] https://help.tcgplayer.com/hc/en-us/articles/204638868-International-Order-Eligibility (via search). Whether a UK business can register at all is unknown, and I found nothing saying it can.

### A2. Live commerce

**Whatnot UK**
- UK commission for sports and TCG is 6.67% plus VAT at the standard tier. UK processing is 2.42% + £0.25 per order plus VAT, charged on the order total including shipping and tax. A limited promo cuts the fixed fee to £0.15 on subtotals of £10 or less. A new commission structure applied to existing sellers from 21 Sep 2026. VAT-registered sellers get monthly VAT invoices and use reverse charge. [D] help.whatnot.com articles 4847069165965, 42717152170381 and 46618222761229 (search snippets only: both WebFetch and curl returned 403 / Cloudflare challenge on 10-20, so this is **not fetched**). Third-party pages conflict (some say 8% / 2.9% + $0.30), so confirm in Seller Hub.
- Growth, company-reported: UK first-time buyers rose 374% year on year in 2025, and about two-thirds of UK Whatnot sellers' sales are live. [D] https://ro.fashionnetwork.com/news/Fast-growing-live-shopping-is-now-mainstream-claims-whatnot,1802802.html (Jan 2026)
- **Whatnot ↔ Shopify integration** (on the Shopify App Store from April 2026) syncs products, inventory and orders. [D] https://retailtimes.co.uk/shopify-launches-live-selling-as-mainstream-retail-channel/ (29 Apr 2026)
- [D-weak] A small base of 20–50 repeat buyers can sustain a seller, and the channel works best for "hot release-window product". https://fluf.io/channels/whatnot/sell-trading-cards/
- [I] **Fit:** strong for sealed Japanese product around JP release dates, with Yu (or a host) on camera. This is the one channel that needs a human face and live hours, so an agent cannot replace it.

**TikTok Shop UK**
- The "Gambling, Gifting and Surprise-based Product Guidelines" were updated 26 May 2026 [D] https://seller-uk.tiktok.com/university/essay?knowledge_id=1514396635760386 (fetched 10-20):
  - Surprise products are 18+, priced under £100, with no gambling words ("bet", "chance", "lottery"), no "win" or "prize" language, exact counts, and a duplicates disclosure.
  - Card breaks and surprise sets go in Collectibles. Only manufacturer-sealed, same-brand product. Bidding is capped at £500 per set, and the lowest-to-highest item value ratio must not exceed 1:10.
  - Probabilities must be shown. Buyers with fewer than 25 lifetime orders are limited to 8 break items a day, and 20 or more in a day triggers a 15-minute cool-off.
  - On livestream, all inventory must be shown on camera and TikTok's randomisation tool must be used.
  - Banned: Lucky Spin, Lucky Wheel, Lucky Draw, giveaway entries, floor/ceiling/average-value claims, and "investment" language.
- The US policy (25 Jun 2026) banned 8 break formats (random team, draft, bounty, pull games and more). [D] https://ppc.land/tiktok-shop-kills-8-break-formats-and-bans-lucky-spins-under-gambling-rules/. That is US-only, but it signals direction. [I]
- UK commission: third parties say 9% from Sep 2024 [D-weak] https://channelx.world/2025/12/tiktok-shop-fees-to-rise-to-9-in-europe/. The official collectibles rate is **not verified**.
- [I] TikTok Shop UK is workable for sealed product, but every live and short video becomes a compliance artefact. An agent should run a copy lint (banned words, value claims) before anything airs.

**UK gambling law on breaks and raffles:** I found no Gambling Commission statement specific to card breaks [D: absence of results]. The general rules: a paid-entry chance draw is a lottery; free draws and genuine skill competitions sit outside the rules; a free entry route must not disadvantage free entrants. [D] council guidance summarising the Gambling Act 2005 s.14 / Sch.2, e.g. https://www.orkney.gov.uk/media/cb3bec40/free_draws_and_prize_competitions_guidance.pdf and https://www.hcrlaw.com/news-and-insights/prize-draws-and-competitions-dont-gamble-on-the-rules-and-regulations/. This matters for release-day "raffles" (and for RewardsPro, see B7). Get a solicitor's view before running anything chance-based.

### A3. Community: Discord, events, organised play

- **Discord** is described as the default UK collector hub, mainly because of real-time restock alerts and game channels. [D-weak] https://packratt.co.uk/guides/uk-tcg-community-2026
  - Branding sizes (third-party, they conflict): server icon 512×512 (min 128); banner 960×540 (needs Boost L2); invite splash 1920×1080 (Boost L1). [D-weak] https://www.krumzi.com/blog/discord-banner-size
  - [I] An agent can run alert bots (restock, pre-order windows, release reminders) from a release-calendar data file. Moderation and tone need a human.
- **Play! Pokémon store:** no cost to join. Stores can host Open Play (no certification needed), League Challenges, League Cups, Prereleases (for "eligible stores") and Friendly Tournaments, with TPCi marketing and prize support. The eligibility criteria are not on the page; apply via join.play.pokemon.com. [D] https://www.pokemon.com/uk/play-pokemon/organize/host-play-pokemon-events (fetched 10-20)
- **Wizards Play Network:** stores must operate from a "physically standalone retail location" and not share play space with another business. WPN Premium is being restructured into quarterly-measured tiers (Q4 2026 / Q1 2027). [D] https://wpn.wizards.com/wpn-retailer-policies and https://articles.starcitygames.com/magic-the-gathering/wizards-play-network-to-restructure-wpn-premium-into-new-tier-based-system/ (via search)
- **One Piece (Bandai):** stores register through **TCG+** (a Bandai Namco ID is required) to receive Store Tournament kits. Vol. 4 covers Oct–Dec 2026, with store sign-up in Aug–Oct. Treasure Cups became offline events from 2026. [D] https://en.onepiece-cardgame.com/events/store_tournament/ and https://en.onepiece-cardgame.com/events/2026/store_tournament_vol1 (via search)
- [I] An online-only seller cannot be a WPN store, and probably not a sanctioned Pokémon or One Piece venue. The community play is to **partner** with a local venue (sponsor prizes, run a stall at prereleases or card shows) and to own the online community.
- **Events to plan around** [D-weak, verify with organisers]:
  - Pokémon EUIC London, 19–21 Feb 2027; Birmingham Regional, 30–31 Jan 2027. https://serebii.net/playpokemon/2027/championships.shtml and https://www.dittobase.com/championships/events/london-2027
  - UK card shows: Birmingham 7 Nov, Edinburgh 14 Nov, London Collectors Showcase 21 Nov 2026; London Card Show XL 16 Apr 2027. https://www.cardpulse.club/card-shows/united-kingdom (data looked stale)
- **Google Business Profile:** online-only businesses are **not eligible**; a profile needs in-person customer contact. [D] https://support.google.com/business/answer/13763036

### A4. Short-form video and social

- **Specs:**
  - Reels, Stories, TikTok and Shorts are 1080×1920 (9:16) [D-weak, all third-party sources agree].
  - Instagram feed: 1080×1440 (3:4, matches the 2025 profile grid) or 1080×1350 (4:5). The sources conflict. https://skedsocial.com/blog/best-instagram-image-and-video-size-recommendations and https://www.post-bridge.com/blog/instagram-post-sizes
  - Safe zones: keep text out of roughly the top 14% and bottom 20% of 9:16 frames [D-weak].
  - TikTok in-feed ad spec: 9:16 at least 540×960; up to 10 min; 500 MB or less; mp4/mov; ad profile image 98×98 under 50 KB with the key element inside the central 66×66. [D] https://ads.tiktok.com/help/article/video-ads-specifications
  - YouTube thumbnails: the official page (fetched 10-20) says 3840×2160 for video (min width 640) and 2160×3840 for Shorts, JPG/PNG, 2 MB on mobile and 50 MB on desktop. [D] https://support.google.com/youtube/answer/72431. Third-party guides still say 1280×720. [I] Export 3840×2160 and check it still reads at small size.
- [I] Formats that suit a Japanese-card specialist:
  - JP-vs-EN comparisons (OP-17 shipped in Japan on 22 Aug and in English on 28 Aug 2026 [D-weak] https://samuraiswordtokyo.com/blogs/news/op-17-japanese-vs-english)
  - "What's in a Japanese box" (pack and card counts)
  - condition-grading explainers (centering, whitening)
  - release-day pulls (with TikTok's wording rules)
  - price-data stories from the cambridgetcg.com open price commons (truthful, citable, a natural fit with the site's data identity)

### A5. Search: SEO for singles and sealed, Google free listings, agentic surfaces

- **Google Merchant Center image rules** (fetched 10-20):
  - **at least 500×500 for all products starting 31 Jan 2027**; ~1500×1500 recommended; 16 MB and 64 MP maximum
  - no watermarks, promotional overlays, condition labels, borders, placeholders or added logos
  - the product should fill 75–90% of the frame

  [D] https://support.google.com/merchants/answer/6324350
- **GTIN:** recommended whenever the manufacturer assigned one; for used or vintage products, give it if possible and set condition to used. [D] https://support.google.com/merchants/answer/6324461. [I] Sealed Japanese product carries JAN barcodes (EAN-13 format); verify against GS1 before relying on that. Raw singles have no GTIN.
- **Content API for Shopping** reached sunset on 18 Aug 2026 (intermittent 410s from 1 Sep 2026, full shutdown early 2027); the successor is the **Merchant API**. Feeds by scheduled fetch, upload or Sheets are unaffected. [D] https://developers.google.com/shopping-content/guides/sunset (via search). [I] Any agent feed tool must target the Merchant API.
- **Agentic storefronts (Shopify):**
  - Participating channels are ChatGPT (sends buyers to your store's checkout), Google AI Mode and Gemini, Microsoft Copilot, and Meta surfaces including Muse.
  - Products reach them through Shopify Catalog, the Google & YouTube channel, or Merchant Center.
  - It is "active by default for eligible stores", but eligibility (including the UK) is not stated.

  [D] https://help.shopify.com/en/manual/online-sales-channels/agentic-storefronts (fetched 10-20). Announced 10 Dec 2025: https://www.shopify.com/news/winter-26-edition-agentic-storefronts. Third parties say direct AI checkout is US-first [D-weak]. UK status is **unknown**.
- [I] **SEO for singles** means one URL per printing, with:
  - set code and card number in the title and URL (e.g. "OP09-118 … Japanese")
  - language, rarity and condition as structured attributes
  - Product/Offer structured data
  - real photos of the exact copy for high-value cards

  Sealed SEO means the product name in JP and EN, the JAN, the release date, and pre-order pages published early. cambridgetcg.com already has a card-identity and price-data layer (`/api/v1`, `llms.txt`) [O robots.txt]. That machine-readable product truth is what both search engines and AI agents now consume.

### A6. Email and SMS (owned audience)

- UK PECR: marketing email and SMS to individuals needs consent, except under the **soft opt-in**. That covers existing customers who bought (or negotiated to buy) a similar product, provided an opt-out was given at collection and in every message. It does not cover bought-in lists. [D] https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/electronic-and-telephone-marketing/electronic-mail-marketing/ (fetched 10-20; the page says it is "under review" after the Data (Use and Access) Act 2025).
- The DUAA 2025 raised the maximum PECR fine from £500k to £17.5m or 4% of global turnover. [D-weak] law-firm commentary, e.g. https://www.mills-reeve.com/publications/will-change-to-laws-on-charity-marketing-boost-fundraising/
- [I] Highest-value automated emails for a card shop: pre-order opens, release-day stock, restock of a watched card, "your graded card is back", and a monthly price-movement digest from the price commons.
  - An agent can draft and segment these. Sending is an outward act and needs Yu's word per campaign or a standing rule.
  - Design widths of about 600 px are an industry convention [I], not a standard I verified.

### A7. Product photography standard (cards)

- **Platform rules to design around:**
  - eBay: no overlays or watermarks; 1600×1600; front, back and flaws.
  - Google: no overlays or borders; at least 500×500 from 31 Jan 2027.
  - TCGplayer requires photos of the exact item for graded, signed and non-English listings. [D] https://help.tcgplayer.com/hc/en-us/articles/360000111167
- **Grading vocabulary buyers use:** PSA 10 needs centering of about 55/45 front and 75/25 back; PSA 9 about 60/40 front and 90/10 back. [D-weak] PSA's own page returned 403; the figures come from a reproduction at https://www.gamestop.com/psa and several secondary sources (one forum quotes 55/45 to 60/40 for the front, so this is unresolved).
- [I] **House standard (proposal):**
  - **Raw singles over about £20:** a front and back scan or photo on a neutral matte background; one raking-light angle shot for holo scratches and print lines; corner and edge close-ups; a centering overlay rendered as a **separate** image, never on the main image.
  - **Graded slabs:** front and back of the slab, plus a cert-number close-up.
  - **Sealed:** front, back and seal close-up, plus a JAN/barcode shot (not as the main image).
  - Shoot once at high resolution and let an agent derive every channel size from the master.
  - Forum advice for foils: angle the card, don't add light, and avoid flash. [D-weak] https://geekydomain.com/blogs/guides/how-to-photograph-cards-for-sale-gear-lighting-technique

### A8. Seasonal calendar (next ~120 days; verify against official pages)

| Date | Event | Basis |
|---|---|---|
| 24 Oct 2026 | Pokémon *Mega Evolution—Delta Reign* prereleases start | [D-weak] https://www.pokeguardian.com/3231721_pokemon-tcg-mega-evolution-delta-reign-revealed (via search) |
| 6 Nov 2026 | *Delta Reign* (EN) release; it maps to JP *Storm Emeralda*, released 31 Jul 2026 | same |
| 13 Nov 2026 | MTG *Star Trek* release (the last main MTG set of 2026) | [D] https://magic.wizards.com/en/news/announcements/everything-announced-for-magic-the-gathering-in-2026 (via search) |
| 27 Nov 2026 | Reported, unannounced JP Pokémon item | [D-weak] https://samuraiswordtokyo.com/blogs/news/when-is-the-next-pokemon-set-japan-and-english-dates |
| late Nov | Black Friday / Cyber Monday | [I] |
| Oct–Dec 2026 | One Piece Store Tournament Vol. 4 | [D] en.onepiece-cardgame.com (via search) |
| Jan 2027 | Rumoured EN Pokémon set (*Aura Seeker*); unconfirmed | [D-weak] https://pokennoisseur.ca/tools/release-calendar |
| 30–31 Jan 2027 | Pokémon Birmingham Regional | [D-weak] serebii |
| 5 Feb 2027 | MTG *Nauctis: The Sunken Realm* | [D-weak] https://www.vice.com/en/article/magic-all-2027-set-release-dates-revealed/ |
| 19–21 Feb 2027 | Pokémon EUIC, London | [D-weak] serebii / dittobase |
| 27 Feb | Pokémon Day (annual) | [I, general knowledge; verify] |

[I] The calendar should be a data file (date, game, language, product, source URL, confidence, checked-on). An agent re-checks it weekly against official pages (pokemon.com, pokemon-card.com, magic.wizards.com, en.onepiece-cardgame.com), and every content, email and Discord job keys off it.

### A9. Wholesale / B2B (if revived)

- [D] tcg-wholesale sold Japanese cards "in VAT-exclusive GBP for UK streamer clients" (commerce-tcg.toml).
- [I] The buyers are the Whatnot and TikTok UK sellers themselves. Marketing there means direct outreach, a price sheet, allocation fairness and reliable JP release-day supply, not ads. The UK seller benchmark "Sports Trading Cards UK" shows 3,940 reviews and 40k+ items sold on Whatnot [D-weak] https://www.whatnot.com/en-GB/user/sportstradingcardsuk (via search). Lists of such sellers are prospects. Contacting them is an outward act.

### A10. Cambridge TCG asset matrix

| Channel | Assets | Spec | Basis |
|---|---|---|---|
| eBay | listing photos; condition descriptors; shop banner (spec not checked) | ≥500², ~1600² rec., 1:1/16:9, ≤12 MB, ≤24, no overlays | [D] ebay.co.uk help 4148 |
| Google Merchant / AI shopping surfaces | main + additional images; feed attributes (GTIN where it exists, condition, language) | ≥500² (all, from 31 Jan 2027), ~1500² rec., no overlays/borders | [D] Merchant help 6324350 |
| Instagram | feed stills/carousels; Reels; Stories | 1080×1440 or 1080×1350; 1080×1920 | [D-weak] third-party |
| TikTok / TikTok Shop | 9:16 video; product images; break listing text with probabilities | 9:16 ≥540×960 (ads); UK surprise-set rules | [D] TikTok ads help; TikTok UK guideline 26/05/2026 |
| YouTube | Shorts; long-form; thumbnails | 3840×2160 / 2160×3840 thumbs, JPG/PNG | [D] YouTube help 72431 |
| Whatnot | show thumbnail, title, schedule (specs not verified) | unknown | — |
| Discord | icon, banner, invite splash, role/emoji art | 512² / 960×540 / 1920×1080 | [D-weak] |
| Website / OG | OG/Twitter card | 1200×630 (what cambridgetcg.com uses today) | [O] ctcg.html meta |
| Email | header, product blocks, footer with opt-out | ~600 px wide (convention) | [I] |
| Events / shows | table banner, price cards, QR to Discord or price commons | print sizes per venue | [I] |

**IP caution for generated brand art (relevant to ArtCraft):**
- Wizards' Fan Content Policy (the version found is dated 15 Nov 2017) requires fan content to be free and bars use of Wizards logos and trademarks. [D] https://company.wizards.com/en/legal/fancontentpolicy (via search)
- I found no official Pokémon Company guidance on retailer use of artwork or logos.
- [I] Use ArtCraft for Cambridge TCG's **own** brand system (marks, patterns, layouts, public-domain art like the Sharaku print already on the site [O]) and for compositing **your own product photos**. Do not generate Pokémon or One Piece characters or logos.

---

## B. RewardsPro: channel playbook for a Shopify app with zero users

### B0. Readiness gates (before any outreach) [D memory note + O today + I]
1. Yu records the retirement and pricing decision (the 2026-09-23 "retired" sweep has no Yu record).
2. Listing, rewardspro.io and docs tell one consistent story [O: they contradict today].
3. The listing promises only what works. The title says "Raffles & Mystery Box", but rewardspro.io shows those flows "paused" [O]. App Store requirement 2 says "Apps must deliver on the features described in their app store listing", and 4.3 requires "accurate and truthful" listings [D] https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements (capture 10-18).
4. P0s closed and a dev-store end-to-end run passes [D memory note].
5. Marketing email stays off until the unsubscribe and sender authentication are in place [D memory note].

### B1. App Store listing optimisation: fields and specs
From the 10-18 captures of https://shopify.dev/docs/apps/launch/shopify-app-store/best-practices and the app-store-requirements page [D]:

- **App name:** 30 characters or fewer, leading with the distinctive brand, and matching or similar to the TOML name (req 4.1.1). [O/D] The listing says "RewardsPro" and memory says the app identity is "Rewards Pro"; that is probably "similar", but check.
- **App icon:** 1200×1200 JPEG/PNG, bold and simple, padded square (Shopify rounds the corners). No text, no screenshots, no Shopify trademarks.
- **Feature media:** a promotional (not instructional) video of 2–3 minutes with screencast limited to 25%; or a 1600×900 (16:9) feature image with one focal point, contrast of 4.5:1 or better, alt text, no Shopify logos, and not repeating the subtitle.
- **Screenshots:** 1600×900, 3–6 desktop, at least one of the app UI; crop browser chrome; alt text; no PII, pricing, reviews or outcome guarantees; add mobile/POS views if supported. Every image must be unique (req 4.4.5), and the image standards have been enforced since 26 Mar 2026 [D] https://shopify.dev/changelog/clearer-standards-for-app-listing-images (via search).
- **Text fields:**
  - App introduction: 100 characters.
  - App details: 500 characters.
  - Feature list: up to 80 characters per feature.
  - Integrations: up to 6.
  - Search terms: up to 5, complete words, one idea each.
  - Categories, plus up to 25 structured features per category.
  - App card subtitle: benefit-led with no keyword stuffing (req 4.4.1). **Its character limit is not verified**; a third party says about 80.
  - SEO title tag and meta description.
- **Prohibitions:**
  - no statistics or data, and no "the first/the best/the only" (4.3.3/4.3.4)
  - no reviews or testimonials in the listing or images (4.3.6/4.3.7)
  - no pricing outside Pricing details (4.2)
  - no Shopify marks in graphics (4.4.3)
  - stats belong "on your website and landing pages instead" (4.4.1)
- **Translations:** an English primary listing is auto-translated into 8 languages (pt-BR, da, nl, fr, de, zh-CN, es, sv). Shopify says translated listings "convert up to 4x better in non-English markets".
- **Install eligibility:** set the sales-channel and geography criteria to avoid ineligible installs and bad reviews.
- **Demo store URL**, and a review screencast (in English, step by step) with test credentials (4.5.3–4.5.5).

**Current listing gaps, observed:**
- The video is 16 s, published 2025-10-20, with 4 views as of 10-18 [O capture `verify-mkt/yt.html`]. The guidance asks for 2–3 min promotional.
- There are 3 screenshots (the minimum), each letterboxed with black bars. One shows a real-looking non-example Gmail test address in the customer column, against the "avoid PII" guidance. Tier names are inconsistently capitalised (bronze, silver, Gold, Ultimate) [O `verify-mkt/shots/shot1-2.jpeg`].
- Only English is listed. "Works with" shows only Customer accounts, and no integrations are listed [O].
- The data-access list is broad: edit products, orders, store credit and the Online Store theme [O]. [I] Merchants read this; justify each scope in the privacy policy and docs, and trim any the rebuilt app no longer needs.

### B2. Reviews, honestly
- Only merchants with the app installed can review, or within 45 days of uninstalling.
  - Reviews must pass Shopify trust checks before they publish.
  - The overall rating is weighted toward recent, useful, trustworthy reviews.
  - Positive reviews lift search and category placement.

  [D] https://shopify.dev/docs/apps/launch/marketing/manage-app-reviews (fetched 10-20)
- **How to ask:**
  - neutral wording only; never ask for a *positive* review
  - not during onboarding or install, and never interrupting a workflow
  - after a support interaction works well
  - offer a "don't ask again" option
  - no unsolicited review-request emails
  - mechanics: the App Bridge Reviews API, or a deep link with `#modal-show=WriteReviewModal`

  [D] same page
- **Incentives are forbidden** (req 1.3.1: neither offering nor withholding features). Since 6–7 Jul 2026 incentivisation gets "a significant portion" of an app's reviews removed, and untrusted-review detection is being backfilled. [D] https://shopify.dev/changelog/strengthening-trust-in-app-store-reviews (fetched 10-20). [D memory] The non-deployed rewardspro-production repo "still holds review-incentive code": it must never ship.
- **Reply** to every review via the Partner Dashboard; merchants can then edit their review [D].
- [I] **The honest trigger:** show the review modal once, after a real value moment, e.g. the first cashback credited to a real customer, or 14+ days with active tiers. Track that it is shown at most once and that opt-outs are respected.

### B3. Built for Shopify (BFS): a 3–6-month goal, not a launch tactic
- **Prerequisites:** at least 50 net installs from active shops on paid plans, at least 5 reviews, a minimum recent rating (number not published), and good partner standing.
- **Admin performance** at p75 with ≥100 calls per 28 days: LCP ≤2.5 s, CLS ≤0.1, INP ≤200 ms. Storefront: the Lighthouse score may drop by at most 10 points.
- **Integration and design:** latest App Bridge, ID-token auth, theme app extensions, Polaris-like UI, no outcome guarantees.

  [D] https://shopify.dev/docs/apps/launch/built-for-shopify/requirements (fetched 10-20)
- **Benefits:** badge and listing highlight, a BFS search filter, a search ranking boost, eligibility for homepage/category collections and the admin "Picked for you" modal, story pages, a priority review queue, and ad targeting by merchant plan. Status is reviewed annually, with 60 days to fix a lapse. [D] https://shopify.dev/docs/apps/launch/built-for-shopify (fetched 10-20)
- [D-weak] A third party claims an average 49% install lift within 14 days of earning BFS: https://blog.appjubilee.io/ultimate-guide-shopify-app-store-visibility
- [O] In the 10-18 searches for "store credit cashback" and "trade in store credit", the BFS badge was on most top results (Koin, Redeemly, Froonze, Essent, Dollarback). Gap check: [I] BFS has no loyalty-specific category criteria [D: not listed on the page], so the general criteria apply.

### B4. Search and ads inside the App Store
- Search now leans on **behavioural data** (how merchants interact with results), which reduces the value of keyword stuffing (changelog posts from Feb and Apr, year not captured). [D] https://shopify.dev/changelog/increasing-search-relevance-with-behavioral-data-in-the-shopify-app-store (via search)
- **App Store ads:**
  - The model is CPC, first-price auctions. Search ads are bid per keyword, and "keywords cost less for highly relevant apps".
  - Placements: search 4 desktop / 3 mobile; category 4 / 2; homepage 4 / 4.
  - Only published apps, from Partners in good standing. Budgets are a daily maximum in USD.
  - Minimum bids are not stated.

  [D] https://shopify.dev/docs/apps/launch/marketing/advertising (fetched 10-20)
- [D-weak] An agency says to start ads only after 5–10 genuine reviews and a listing conversion rate above 10%, at about $500–700/mo: https://www.bigmoves.marketing/shopify-app-growth/case-studies-shopify. A developer thread reports "Very Low Relevance" ad scores for new apps: https://community.shopify.dev/t/has-anyone-faced-very-low-relevance-for-almost-every-keyword-in-shopify-app-store-ads/36375. Ad spend is Yu's call (money).
- **Revenue share:** 0% on the first US$1M of **lifetime** earnings (earnings before 1 Jan 2025 not counted), 15% above that, effective 16 Jun 2025. [D] https://shopify.dev/changelog/update-to-shopifys-app-developer-revenue-share (via search)

### B5. Partners, agencies, community, content
- [D-weak] Developers report that first installs "rarely come from the app store" but from stores the founder already knows, and that "one agency relationship can be twenty installs". https://community.shopify.dev/t/got-approved-3-weeks-ago-what-actually-worked-for-your-first-50-installs/37237 (via search)
- **Incumbent partner programmes, for reference:**
  - Smile: agency and tech tracks, "revenue-sharing opportunities", co-selling. [D] https://smile.io/partners
  - LoyaltyLion: Registered, Gold and Platinum tiers tied to client MRR ($699) and mutual clients; its general referral reward is a one-off bill credit capped at £500. [D] https://help.loyaltylion.com/en/articles/6359306-about-the-loyaltylion-agency-partner-program and https://loyaltylion.com/referral-program-terms-of-service (via search)
- **Shopify Community forum:** unsolicited self-promotion counts as spam outside the designated board. [D] https://community.shopify.com/faq (via search). r/shopify is promotion-free [D-weak]. [I] Contribute by answering store-credit, tier and loyalty-setup questions, with no links unless asked.
- [I] **Content that compounds:**
  - comparison pages on rewardspro.io (stats and claims are allowed there, not on the listing)
  - setup guides ("cashback via Shopify store credit", "paid VIP membership products")
  - a TCG-shop loyalty guide written from Cambridge TCG's own operating experience, kept truthful about the 8-order history
- **Integration partners (TCG niche)** [O, 10-18 captures]:
  - The "tcg" search returned apps such as TCG Importer (8 reviews), Synq (3), Kori, PowerList, Hobby TCG Trade-In and NeoSatoshi.
  - "pokemon" returned Furloop (trade-in/consign), LGS Forge and Double Holo, all with 0–8 reviews, and no loyalty incumbent appeared.
  - [I] Trade-in apps that pay out store credit pair naturally with store-credit cashback. A documented integration with one of them is a listing "Integration" and a co-marketing route.

### B6. Competitive positioning
Captured 2026-10-18 (`gtm/listings.txt`), [O at capture]. Prices in USD.

| App | Reviews / rating | Launched | Free tier | Paid entry → top |
|---|---|---|---|---|
| Smile | 4,639 / 4.9 | 2014 | ≤200 orders/mo | $15 → $199 |
| Joy | 1,791 / 4.9 | 2021 | ≤250 | $29 → $499 |
| Rivo | 1,441 / 4.7 | 2021 | ≤200 | $15 → $499 (Scale capped $499) |
| Appstle Loyalty | 1,433 / 5.0 | 2023 | ≤250 | $10 → $100 |
| Yotpo Loyalty | 971 / 4.7 | 2015 | <100 orders | $199 |
| LoyaltyLion | 541 / 4.6 | 2014 | ≤400 | $199 |
| Essent | 493 / 5.0 | Nov 2024 | ≤250 loyalty-influenced | $10 → $79 |
| Koin (store credit) | 180 / 5.0 | Dec 2024 | — | — |
| YOYO (paid membership + cashback) | 174 / 5.0 | Apr 2025 | ≤100 | — |
| GiftKart (cashback) | 114 / 4.9 | 2021 | dev stores | $99 → $199 |
| Redeemly (store-credit cashback) | 86 / 4.9 | Oct 2024 | ≤50 | $19 → $29 |
| **RewardsPro** | **0 / –** | Dec 2025 | Free | none listed |

- [I] The headline differentiator (cashback through native Shopify store credit, plus paid VIP membership products) is **no longer unique**. Koin, Redeemly, GiftKart, Froonze, Essent and YOYO all claim store credit or cashback, and YOYO claims paid memberships too.
- [I] Young apps reached about 90–500 reviews in 18–24 months (Koin about 8/mo, YOYO about 10/mo, Essent about 21/mo, counted after the July 2026 purge). So the bar is beatable.
- [I] **Positioning that is true and defensible:** "store-credit cashback and VIP tiers for card and collectibles shops". It is built and run by a UK TCG company (the developer name already says Cambridge TCG Limited), fits trade-in-to-credit workflows, and handles release-day demand. The 10-18 capture includes a Koin review from a comic shop ("we use store credit on a daily basis"), which suggests the collectibles segment values store credit [O capture].
- [I] Do not position on raffles or mystery boxes until a solicitor clears the UK legal shape (see A2) and the customer flows are live.

### B7. Launch tactics with zero reviews (honest set)
[I] Ordered by expected yield per hour, given the evidence above:
1. **Fix truth first:** gates B0, then refresh the listing assets (B1): a 2–3 min video, 5–6 clean screenshots including the storefront widget and mobile, and real alt text.
2. **Design-partner programme:** 5–10 hand-picked Shopify TCG and collectibles stores. Yu or an agent drafts a personal note to each; Yu sends. Free, with white-glove setup, asking only for feedback and a neutral review *if* they get value. No incentive tied to the review (1.3.1).
3. **Integration with one TCG trade-in or inventory app,** then co-announce it.
4. **Content and comparison pages** on rewardspro.io, plus 3–5 helpful Community answers a week.
5. **App Store search ads,** only after about 5 genuine reviews, and only with Yu's budget approval.
6. **BFS application** once 50 paid-plan installs and 5 reviews exist and the performance thresholds pass.
7. **Agency outreach** after BFS or a few case studies; a partner page with a simple referral arrangement (money terms are Yu's call).

### B8. RewardsPro asset matrix

| Surface | Asset | Spec / rule | Basis |
|---|---|---|---|
| App Store | Icon | 1200×1200, no text or Shopify marks | [D] best-practices (10-18) |
| App Store | Feature video **or** feature image | 2–3 min promo (≤25% screencast) **or** 1600×900, alt text | [D] |
| App Store | Screenshots ×3–6 (+ mobile/POS) | 1600×900, unique, no PII, pricing, reviews or claims | [D] |
| App Store | Name / intro / details / features / search terms / integrations | 30 / 100 / 500 / 80-per-feature / 5 / 6 | [D] |
| App Store | Translated listings | auto-translated into 8 languages; custom ones override | [D] |
| App Store review | Review screencast + test creds | English, step by step | [D] req 4.5.3–4.5.5 |
| In-app | Review prompt | App Bridge Reviews API, neutral, post-value, opt-out | [D] manage-app-reviews |
| Storefront | Widget branding | standard attribution 24×24 unless customers interact with branded elements (loyalty qualifies) | [D] best-practices (10-18) |
| Ads | Search, category, homepage ads | CPC; no creative spec published | [D] advertising docs |
| Website | Landing, comparison and guide pages, docs, OG 1200×630 | stats allowed here, kept truthful | [D] req 4.4.1; [I] |
| Content | Setup videos (YouTube), blog, Community answers | — | [I] |

---

## C. What this means for an agentic marketing design [I]

1. **Channel specs as data, validators as guards.** Keep one machine-readable spec per channel: sizes, limits, banned words and claims, and image prohibitions such as "no overlays" (Google, eBay), "no stats or reviews" (Shopify listing) and "no gambling words or value claims" (TikTok UK). Every generated asset is linted against its spec before a human sees it. This is the "mechanism over sentence" approach.
2. **One master, many derivatives.** Shoot or scan each card and product once at high resolution, and let agents (ArtCraft-style tools) derive each channel's crops and sizes from the matrix, with no overlays on marketplace or Merchant images.
3. **Calendar-driven jobs.** A sourced release calendar (A8) triggers pre-order pages, Discord alerts, email drafts and short-video scripts, re-verified weekly against official pages.
4. **Humans keep the outward acts.** Agents draft. Yu publishes or sends: posts, emails, listing submissions, ad spend, outreach and live streams (which need Yu's face and time anyway).
5. **Truth before reach.** The first agent task for both businesses is consistency between public surfaces (listing ↔ landing ↔ docs ↔ site banner), because the current contradictions would cancel any paid or organic reach.
6. **Agent-readable commerce is the new SEO.** Structured product data (Catalog, Merchant API, llms.txt, the price API) feeds ChatGPT, Gemini, Copilot and Meta shopping surfaces. cambridgetcg.com already leans this way.

## D. Open questions (for Yu)
- Which channel earns Cambridge TCG's revenue today? The public site says paid orders are retired, and wholesale redirects.
- Does Yu reverse or keep the 2026-09-23 "retired" wording on cambridgetcg.com, rewardspro.io and the RewardsPro docs? No Yu decision record exists.
- Is there, or will there be, a physical play space? WPN requires a standalone store; Play! Pokémon and Bandai eligibility details were not published.
- Is the Shopify store 6e824e-a9 still open? It returned 429 today.
- Are Shopify agentic storefronts available to UK stores? Not stated by Shopify.
- What is the legal status of RewardsPro raffles and mystery boxes, and of any release-day raffles, under the UK Gambling Act? Solicitor advice is recommended before relaunch.
- Unverified rates: the eBay UK CCG-singles FVF, the Cardmarket commission, TikTok Shop UK collectibles commission, and Whatnot UK (the help page was blocked by Cloudflare) — and the App Store subtitle limit.
- Will Yu go on camera for live commerce, and how many hours a week?
