# One Piece Card Game scanner and tracker: market scan (UK/EU view)

Written 2026-10-20 by a Claude Code research agent for Yu (Cambridge TCG Limited). This is an
agent's research, not Yu's decision, and **not legal advice**: where law, platform policy or
intellectual property comes up, it says what the documents say and leaves the legal reading to a
qualified adviser.

**Method.** Read-only web research. No logins, accounts, installs, purchases or paid APIs. Store data
comes from public pages: apps.apple.com (UK `gb` and US `us` storefronts) and play.google.com (UK
locale `hl=en_GB&gl=GB`), all fetched 2026-10-20. Apple shows only relative dates such as "2 days
ago" or a day and month with no year, so "latest version" dates are approximate. Google Play hides
review counts for small apps, so many cells read "count not shown". No buyer, reviewer or other
private individual is named. Review themes are summarised.

**Tags.** [D] a primary source I read today · [O] something I saw today on a live page (store
listings, the official card list, data files) · [S] a secondary source only (press, blog, vendor,
search snippet, Reddit mirror) · [U] no source reached · [I] my inference.

**How this fits the estate design** (README §3–5, §7–8 and ASSETS.md, read today). This page is
Scout work under the honest-by-design rules: a claims ledger, no engineered urgency, no
incentivised reviews, real product only, and no third-party IP in our assets. Agents draft and Yu
publishes. Nothing here is a verified claim until the Clerk and a second session check it.

---

## 0. The answer in brief

- **The market is crowded.** I found 30 or more Android apps and about 15 iOS apps that scan or
  track One Piece cards [O]. Multi-game giants hold the volume: Collectr has 68k US iOS ratings
  and 1m+ Android downloads, and TCGplayer, HoloDex and Shiny are also large [O]. The
  One-Piece-only leaders are small: OP.TCG has 100k+ Android downloads, and OP TCG Dex 50k+ [O].
- **Several features that look like gaps are already taken by someone.** Each of these exists
  somewhere today [O]:
  - offline scanning;
  - no account and no tracking;
  - unlimited free scans;
  - Cardmarket prices;
  - OCR of the set code with a printing picker;
  - English and Japanese coverage.
- **Data access is the binding constraint, not the scanner.** Cardmarket says it is not accepting
  new API applications [D]. TCGplayer's docs reportedly say the same [S]. eBay's sold-data API is a
  limited release [S]. Apple guideline 5.2.2 requires permission to display a third-party service's
  content [D].
- **IP is the second constraint.** The card art and the name "ONE PIECE" belong to others. Bandai's
  official card images carry a "SAMPLE" watermark [O]. I found no Bandai policy that permits apps
  to use card images [U].
- **What could still be honestly better:** UK and EU prices with their receipts (source, date,
  currency, spread, never blended); French and Chinese prints; Cardmarket-style condition records;
  and, the one nobody clearly owns, a scan-to-stock workflow for small UK sellers on eBay and
  Cardmarket, which is Cambridge TCG's own daily work [I].

---

## 1. Competitor landscape

### 1a. Multi-game apps that cover One Piece

| App (developer) | Platforms | Scans OP? | Price source | Pricing model (UK store) | Rating: iOS GB / iOS US / Play UK | Notes and visible complaints |
|---|---|---|---|---|---|---|
| **TCGplayer** (TCGplayer, Inc.) | iOS 17+, Android [O] | Yes. "One Piece TCG" is in the supported list [O] | TCGplayer marketplace, USD [O] | Free; no IAP listed on iOS [O] | 4.3/179 · 4.2/17,182 · 3.2/14k reviews, 1m+ downloads, updated 2 Oct 2026 [O] | Scan into collections, shop the marketplace. GB reviews: prices only in US dollars, hard to find sellers who ship to the UK, scanner misreads background objects, lag [O]. Seller-side Scan & Identify added One Piece in Mar 2025 [S]. Privacy labels: contact info, photos and user ID are linked to you; no tracking [O]. |
| **Collectr** (Collectr Inc) | iOS 15.6+, Android 7+ [O][S] | Lists One Piece [O]; that OP scanning specifically works is not confirmed on the page [U] | TCGplayer, eBay and Cardmarket "depending on the product", refreshed every 1–2 days, per its help page as seen in a search snippet [S] | Free; PRO £7.99/month or £59.99/year; unlimited scanning needs PRO [O] | 4.9/5.7k · 4.9/68,252 · 4.8/44.1k reviews, 1m+ downloads, updated 17 Oct 2026 [O] | Raw, graded and sealed; GBP pricing praised in GB reviews [O]. Asks: master-set gaps, a bigger "+" button [O]. Location is linked to you (personalisation) [O]. |
| **Shiny** (Shiny Cardboard LLC) | iOS 16+, Android [O] | Yes, English and Japanese OP sets only [O] | eBay, TCGplayer, Cardmarket; "completed sales"; MYR/USD/EUR and more [O] | Free core and unlimited scanning; Pro £2.99/month, £39.99/year, lifetime £94.99–£114.99 [O] | 4.8/416 · 4.9/3,692 · 4.7/7.59k reviews, 100k+ downloads [O] | Centering tool, price alerts, trade analyser. Prices vary for obscure cards [O]. Privacy label: **identifiers are used to track you** [O]. |
| **HoloDex** (Mavelli) | Android (iOS not checked) [O] | Yes [O] | "Real-time" values, source not named [O] | IAP unlocks unlimited scans and AI grading [O] | Play: 4.7/26.8k reviews, 1m+ downloads [O] | Screenshots show Pokémon, Magic, Yu-Gi-Oh! and One Piece logos [O]. |
| **CollX** (CollX LLC) | iOS (US); the UK App Store page returns 404 [O] | Lists One Piece [O] | "Historical auction prices", USD [O] | Pro $9.99/month, Gold $24.99/month [O] | US 4.6/49,801 [O] | Sports-first. Complaints: wrong variant matches, stale prices, payout delays [O]. Probably not offered in the UK store [I]. |
| **Ludex** | iOS, Android [O] | **No.** Its TCGs are Pokémon, Magic and VeeFriends [O] | eBay completed sales [O] | £5.49–£24.99/month tiers [O] | 4.2/166 · 4.7/27,924 · 4.2/16.3k [O] | Included only to rule it out. A GB reviewer asked for pounds [O]. |
| **Dragon Shield** scanner apps | iOS | **None for One Piece found.** Separate apps exist for MTG, Pokémon and Yu-Gi-Oh! [S] | — | — | — | — |
| **CardNexus: TCG Store & Scanner** (CardNexus) | iPhone [O] | It sells One Piece. The scanner's game list doesn't name OP [O] | Cardmarket EUR for Europe, TCGplayer USD for North America [D] | Free marketplace [O] | 4.7/22 · 4.9/112 [O] | Scanning "in under 100 ms, even offline", and the scan becomes the listing. 10 currencies including GBP [O][D]. Identifiers used to track you [O]. The closest **EU-native** rival for sellers [I]. |
| **DeckTradr** (DeckTradr LLC) | Android [O] | Yes [O] | Several marketplaces; exports for TCGplayer and Shopify [O] | Unlimited scanning; paid Plus/Pro/Team tiers [O] | Play 3.9, 10k+ downloads [O] | An on-device index plus online verification. **Vendor POS** for card shows. An account is required [O]. |
| **ScanDex** (SandboxxGaming) | Android [O] | Yes, English and Japanese OP [O] | "Market estimates", eBay searches [O] | IAP [O] | Play 2.6, 5k+ downloads [O] | Bulk scan, binder-page scan, compares the scan with official art before saving [O]. |
| **TCG Card Scanner Card Value** (Identifier Studio) | Android [O] | Multi-TCG (OP not named in the snippet I read) [O] | — | Ads plus IAP [O] | Play 4.6/46.9k, 1m+ downloads [O] | A generic "AI scanner" utility [I]. |
| **TCG ID** (Youness Zaouda) | iOS [O] | Yes, added in v1.0.8 [O] | TCGplayer, eBay, PSA, Cardmarket [O] | Free tier of 3 scans a day; £6.99 Premium, £9.99 "Weekly Scans", £39.99 a year [O] | 4.0/2 · 4.1/49 [O] | "Instant grade" from a scan [O]. Diagnostics are used to track you [O]. |
| **TCG Stacked** (Minner Labs LLC) | iOS, Android [O] | The Play listing and website say OP [O]; the iOS description names only MTG and Pokémon [O] | Unnamed "trusted sources"; TCGplayer and eBay affiliate disclosure [O] | £5/month, £40/year, £80 lifetime [O] | 2.0/1 · 4.4/23 · Play 10k+ [O] | **The scanner needs internet** [O]. The single GB review mentions slowness and blank screens [O]. Usage data used to track you [O]. |

### 1b. One-Piece-only apps (all unofficial)

| App (developer) | Platforms | Price source and currency | Pricing model (UK store) | Rating: iOS GB / iOS US / Play UK | Scanner and notable features | Visible complaints |
|---|---|---|---|---|---|---|
| **OP.TCG** (Lops TCG) | iOS 15.3+, Android [O] | Cardmarket, TCGplayer, Yuyu-tei, eBay; JP/CN/KR market values; graded prices for PSA, BGS, CGC and others [O] | PLUS £4.99/month, £39.99/year, £99.99 lifetime; prices and the scanner need PLUS [O] | 4.8/25 · 4.6/159 · 4.3/1.7k reviews, **100k+ downloads** [O] | "20,000 references", Japanese and international versions, sealed product, graded, offline images, deck builder and meta, eBay and TCGplayer **affiliate** links [O] | Subscription too pricey; scanner works only some of the time; wants bulk add; wants to filter Cardmarket by seller location [O] |
| **OP TCG Dex** (Friedrich Fort Nicolas) | iOS 15.6+, Android [O] | TCGplayer and Cardmarket; currency converter in PRO [O] | PRO £1.49–£23.99, lifetime £71.99, remove ads £3.99 [O] | 4.6/10 · 4.5/183 · 4.2/408 reviews, **50k+** [O] | Unlimited scanning is PRO; scan an opponent's deck in offline battle mode; card text in EN/JP [O] | Vault total failed with thousands of cards (fixed) [O]. Identifiers and usage data used to track you [O]. |
| **Logia** (Vasil Blanco-Nunev) | iOS 17+, Android [O] | Cardmarket and TCGplayer, with fallback between them; PriceCharting history [O] | Plus £4.99/month, £39.99/year [O] | 4.9/12 · 4.6/101 · Play 4.0, 10k+ [O] | Bulk scan, scan into a binder pocket, separate alt-art filters, graded cards, EN/JP plus CN/FR Treasure Rares [O] | Release notes fix crashes, loading hangs and sync [O] |
| **Haki** (Julian Beck / BeckStudio) | iPhone (iOS 26.2+), Android [O] | TCGplayer for English prints; Cardmarket for EN and JP; eBay sold prices for JP [O] | Weekly £2.99–£6.00, monthly £7.99, yearly £29.99–£34.99 [O] | GB too few to show · 4.6/18 · Play 4.1/304 reviews, 1k+ [O] | "AI recognition and OCR", "variant-aware" (alt arts, manga rares, promos, parallels), stacks and binder pages, through sleeves [O] | None visible. Screenshot 1 uses a straw-hat silhouette: "STRAW HAT IDENTIFIER" [O] |
| **Log Pose** (Jared Thomas Kirk) | iOS (iPad-designed) [O] | Third-party markets with TCGplayer and Cardmarket links [O] | Plus adds the scanner and CSV; 50 free scans a month since late Sept [O] | 5.0/4 · 4.7/50 [O] | EN, JP, FR and CN database; cloud sync [O] | — |
| **OneCollector** (Ertan Armutcu) | iOS, Android [O] | Cardmarket and TCGplayer [O] | Pro £24.99 (£19.99 promo) [O] | 3.7/3 · 4.2/26 · Play 10k+ [O] | Multi mode scans up to 9 cards; EN/JP/FR sets [O] | Hung on the logo screen (old); wants bulk entry [O]. Usage data used to track you [O]. |
| **BountyScan** (Nikolay Strikhar) | iPhone (iOS 17+) [O] | GBP shown; "AI-generated approximations"; source not named [O] | Weekly £4.99 (3-day trial), yearly £24.99; scanning and prices need Premium [O] | Too few · 5/1 [O] | Live bulk scan, EN/JP [O] | — |
| **DON!! Dex** (KaruCode) | iOS 17+, Android [O] | Cardmarket (lowest price for value) and TCGplayer; EUR/USD/JPY [O] | Premium £1.99/month, £17.99/year, £24.99 lifetime [O] | Too few [O] | Each printing has its own art and price [O]. **"Data Not Collected"** label [O] | — |
| **Card Scanner for OPTCG** (Biographics) | iPhone (iOS 18+) [O] | Not named; GBP shown [O] | Weekly £9.99, yearly £9.99, lifetime £19.99 [O] | 1/1 · 3.8/5 [O] | Scanner and tracker both paid [O] | 1-star review: the free tier shows "0/0 scan remaining" [O] |
| **OP TCG Hub** (SergeantCS2) | Android [O] | TCGplayer via **TCGCSV**; fetch date and low–high spread shown [O] | Free, unlimited scanning; rewarded ads unlock new saves [O] | Play 4.5, 100+ [O] | **Reads the printed number, shows every printing that shares it, and asks when unsure.** Offline catalogue. No account, tracking or analytics. "Honest limits" section. Japanese prints not covered [O] | — |
| **OP Card Price** (Open Digital MY) | Android [O] | "Public marketplace listings" (TCGplayer named in the disclaimer); JP prices in yen from "a Japanese card shop" [O] | 5 free scans a day; weekly, yearly or lifetime Pro; **booster-pack simulator with "Berries" IAP** [O] | Play 1k+ [O] | Reads the card number; swipe to pick the print; switch EN/JP; no account; "wanted poster" bounty theme [O] | — |
| **OP TCG MX** (SergioFrancoDev) | Android [O] | "Market price"; **GBP**, EUR, USD and more [O] | 60 free scans a day; PRO subscription; AI assistant [O] | Play 4.6, 50+ [O] | All versions priced; 7–180-day charts [O] | — |
| **Grand Line Binder** (ZaniVert) | Android [O] | **Cardmarket** [O] | Free with ads [O] | Play 100+ [O] | "Identifies it instantly using OCR"; local storage, no account [O] | — |
| **CROCO** (Nesmothe) | Android [O] | Cardmarket prices "sourced from Limitless TCG", updated weekly [O] | Free, optional ad [O] | Play 50+ [O] | Tracks condition and **language** per card; exports Cardmarket wantlists [O] | — |
| **Grandfolio** (AristiDevs) | Android [O] | Prices tracked [O] | IAP [O] | Play 500+ [O] | "Identify the exact card and version" [O] | — |
| **One Piece TCG Value Scanner** (A3 Apps) | Android [O] | — | IAP [O] | Play 4.8, 500+ [O] | — | — |
| **Others seen** | — | — | — | — | OP Deck Builder (10k+), OPbox, OP TCG Deck Builder, OPTcg Database, OPTCG Collection, OPTCG Journey, BountyLog (match tracking) [O]. Also mentioned in r/OnePieceTCG posts: Mugi TCG (OCR variant detection, no JP yet), Kaizoku, NakamaTCG, TCGTracking, PriceCharting's scanner ("prices wildly inaccurate", one poster) [S] | — |
| **OPTCG Card Manager** (open source, morawietz.dev) | Android APK [D] | — | Free [D] | — | "The scanner scans the cards ID on the bottom right of each card"; the user picks the alt art; all resources offline [D] | — |

### 1c. Bandai's own apps

| App | Platforms | Does | Rating | Notes |
|---|---|---|---|---|
| **BANDAI TCG+** (BANDAI CO., LTD.) | iOS, Android [O] | Tournament search and entry, check-in, pairings, results, card search, deck building. A BNID is required. **No scanning or prices** [O] | iOS GB 2.7/35 · US 2.0/700 · Play 2.2/1.74k, 100k+ [O] | GB complaints: dated UI, lag, events missing, repeat pairings [O]. It is the official route into events, so don't compete with it [I]. |
| **BANDAI TCG+ D** | Web app, added to the home screen [D] | Card and deck search, deck builder, top decks, in-match tools, solo play, links decks to TCG+ [D] | — | Announced 31 Jul 2026. No collection, scanning or prices [D]. |
| **ONEPIECE CARDGAME Teaching app** | Android (iOS not checked) [O] | Tutorial play [O] | Play 3.9/1.65k, 500k+, updated 27 Oct 2025 [O] | Shows the game's casual reach [I] |

**Bandai's official card list** (en.onepiece-cardgame.com/cardlist) shows each printing with an id
such as `OP01-120`, `OP01-120_p1` or `OP01-120_p2`. The official images carry a large "SAMPLE"
watermark [O]. That explains the "SAMPLE" overlays in most competitors' screenshots [I].

### 1d. Pricing patterns

- **Weekly subscriptions with trials** appear in BountyScan (£4.99), Haki (£2.99–£6), TCG ID and
  Card Scanner for OPTCG (£9.99) [O]. A free tier with "0/0 scans" drew a 1-star review [O].
  Weekly-billed "AI scanner" utilities are a pattern an honest app should not copy [I].
- **Scan caps:** Card Scanner for OPTCG allows 0, TCG ID 3 a day, OP Card Price 5 a day, Log Pose
  50 a month and OP TCG MX 60 a day. Unlimited free scans: Shiny, Ludex, DeckTradr, OP TCG Hub,
  CROCO, Grand Line Binder [O].
- **Affiliate income:** OP.TCG discloses the eBay Partner Network and TCGplayer [O]. TCG Stacked
  discloses TCGplayer and eBay [O].

---

## 2. Gaps and positioning (where a UK/EU-first app could be honestly better)

### 2a. What is already taken (so it is not a differentiator on its own)

| Feature | Who already does it |
|---|---|
| Cardmarket prices | Logia, OP.TCG, OP TCG Dex, Haki, DON!! Dex, Grand Line Binder, CROCO, OneCollector, Log Pose, CardNexus [O] |
| GBP display | Collectr (praised in GB reviews), OP TCG MX, TCG Stacked, BountyScan, CardNexus [O] |
| Offline scanning | CardNexus ("even offline"), OP TCG Hub, OPTCG Card Manager. DeckTradr has partial offline fallback [O][D] |
| No account, no tracking | DON!! Dex ("Data Not Collected"), OP TCG Hub, Grand Line Binder, OP Card Price [O] |
| Free, unlimited scanning | See §1d [O] |
| Japanese prints | OP.TCG, Logia, Haki, Shiny, ScanDex, OneCollector, Log Pose, OP Card Price [O] |
| "Honest" framing | OP TCG Hub: "valued honestly", fetch dates and spreads shown, a "WHAT IT DOES NOT DO" section [O] |

### 2b. Real gaps, ranked by how solid the evidence is

1. **UK prices with receipts.**
   - What competitors show: no app I found shows a **UK** sold price in GBP. Each shows USD
     (TCGplayer), EUR (Cardmarket), or a conversion of one of them [O]. TCGplayer's GB reviewers
     complain about dollars and US-only sellers [O]. OP.TCG users want to filter Cardmarket by seller
     location [O].
   - What an honest app could do [I]:
     - show each source separately with its date, currency and conversion rate;
     - never blend sources into one "value";
     - say "unknown" when a print has no market.
   - The blocker is data access (§2c).
2. **Printing-aware identification that asks instead of guessing.**
   - Why the number alone isn't enough: the Comprehensive Rules (v1.2.1, updated 8/28/2026) limit
     a deck to "no more than 4 cards with the same card number" (5-1-2-3) [D]. The official list
     gives a base card and its parallels one number, e.g. OP01-120, `_p1`, `_p2` [O]. On the
     official images, OP01-120 and its parallel print the same `OP01-120 SEC` code bottom-right [O].
   - What follows: OCR of the set code narrows a scan to a handful of printings, but it can't pick
     the printing alone [I]. That needs image matching or a question to the user.
   - Japanese and English prints share numbers too. OP Card Price offers "one tap switches between
     English and Japanese" when its scanner picks the wrong print [O].
   - So **OCR is a real advantage for One Piece, but competitors already use it.** OPTCG Card
     Manager reads "the cards ID on the bottom right" [D]. OP TCG Hub "reads the printed number" [O].
     Grand Line Binder uses "OCR" [O], Haki "AI image recognition and OCR" [O], and Mugi "OCR-based
     variant detection" [S].
   - One app puts the number "at the bottom left" [O]. The official images show it bottom-right
     [O], so that listing is wrong or refers to a different layout [I].
   - The number is small: it measured about 2–3% of card height in the official image I viewed
     [O]. That makes focus and glare the practical limits [I].
3. **French, Simplified Chinese and Korean prints.**
   - Bandai sells the game in Japanese, English, Simplified Chinese, Korean and French [D].
   - Coverage today:
     - FR: OneCollector and Log Pose [O];
     - CN: Log Pose, and OP.TCG's Asia section [O];
     - Logia: only Treasure Rares in CN and FR [O];
     - Shiny: EN and JP only [O].
   - French matters for an EU-first app, since France is a major Cardmarket market [I]. I didn't
     check Cardmarket's country data [U].
4. **Condition recorded the way European sellers grade.**
   - The free Cardmarket price-guide JSON has `avg`, `low`, `trend`, `avg1/7/30` and foil variants,
     with **no condition or language fields** [O]. TCGCSV says it "does not share information about
     SKUs" (condition and language), "so you will not be able to get prices for each condition" [D].
   - An honest app records condition beside the price without multiplying it in, as OP TCG Hub
     does [O]. A real per-condition price would need licensed data [I].
   - Cardmarket's grade names (Mint, Near Mint, Excellent, Good, Light Played, Played, Poor) are
     from memory. Cardmarket's site blocked my fetch (Cloudflare 403), so I couldn't confirm them
     today [I][U].
5. **A scan-to-stock workflow for small UK sellers on eBay and Cardmarket.**
   - What exists: DeckTradr has a vendor POS, exporting for TCGplayer, Shopify and CSV [O].
     CardNexus turns a scan into a listing on its own marketplace [O]. CROCO exports Cardmarket
     *wantlists* (buying, not stock) [O].
   - What's missing: I found no OP app that exports stock in **Cardmarket's or eBay UK's** listing
     formats [U]. I didn't verify that either format exists or accepts imports [U].
   - Fit: this is Cambridge TCG's own channel mix ("only ebay and cardmarket sales", Yu
     2026-10-20) [I].
6. **No dark patterns, and child-safe defaults.**
   - The UK subscription rules come into force in **January 2027**: up-front information, regular
     reminders, easier exit, and a 14-day cooling-off after a trial or renewal (GOV.UK, 9 Aug 2026)
     [D]. Earlier releases (April 2026) said spring 2027 [S]. How the rules apply to App Store and
     Play billing wasn't checked [U].
   - The ICO Children's code covers apps "likely to be accessed by" children. It sets high-privacy
     defaults, location off by default, data minimisation and no nudges toward weaker privacy [D].
   - Most OP apps are rated 4+ or 9+ [O], so the code plausibly applies [I] (not legal advice).
   - An app that avoids weekly plans, scan-count traps, tracking SDKs and pack simulators would
     stand apart from about half the field [I]. It would not be unique (§2a).

### 2c. Constraints any UK/EU-first app must face first

- **Price data access.**
  - **Cardmarket API:** "Currently, we are not accepting applications for access to the Cardmarket
    API." Existing users may "**not** share your dedicated API credentials with a third party or
    third-party app/software" [D]. So Cambridge TCG's own seller API access (if it has any; not
    checked [U]) could not legitimately power a public app [I].
  - **Cardmarket price files:** public JSON files exist at `downloads.s3.cardmarket.com`
    (`price_guide_18.json`, `products_singles_18.json`; id 18 = One Piece; created 2026-10-20) [O].
    I found no Cardmarket page saying what the files may be used for: their terms are unknown [U].
  - **TCGplayer:** "We are no longer granting new API access at this time", per a search snippet of
    docs.tcgplayer.com. The page itself was blocked to me [S]. Apps that use TCGplayer prices now go
    through TCGCSV, a one-person, Patreon-funded mirror [D] (OP TCG Hub says so [O]). Its
    durability and licence position are unclear [I].
  - **eBay:** the Marketplace Insights API (sold items, up to 90 days) is a "(Limited Release) API
    available only to select developers approved by business units", per search snippets of
    developer.ebay.com. The docs page itself would not render [S].
  - **Apple guideline 5.2.2:** "If your app uses, accesses, monetizes access to, or displays content
    from a third-party service, ensure that you are specifically permitted to do so under the
    service's terms of use. Authorization must be provided upon request." [D] (page read
    2026-10-20; no "last updated" date in the captured text).
- **Card images and the name.**
  - **Bandai's IP notice:** "Regulations Regarding the Protection of Intellectual Property
    Associated with ONE PIECE Card Game" (10 Jul 2026) covers unauthorised physical goods and adds
    "These regulations do not signify formal permission or consent" [D].
  - **Images:** I found **no** Bandai policy allowing apps or sites to use card images [U]. Every
    competitor shows card art and carries an "unofficial / not affiliated" disclaimer [O]. Live in
    the stores is not the same as permitted [I].
  - **Our own rules:** ASSETS rule 2 ("No third-party IP as brand art") means our store screenshots
    can't lean on card art the way competitors' do. That is a Yu decision, best preceded by asking
    Bandai [I].
- **Conflict of interest.** Cambridge TCG sells on eBay and Cardmarket. A price app from a seller
  must disclose that in each price claim (`commercial_interest`, README §4) and never rank its own
  listings without saying so [I].

---

## 3. Market signals

### 3a. Size and growth (primary sources)

Bandai Namco Financial Highlights, "Sales of IPs", ¥ billion, all ONE PIECE products, not only the
card game [D]:

| Fiscal year (to 31 March) | Groupwide ONE PIECE | Toys and Hobby, Japan, ONE PIECE |
|---|---|---|
| FY2023.3 (card game launched July 2022) | 86.3 | 31.9 |
| FY2024.3 | 112.1 | 60.3 |
| FY2025.3 | 139.5 | 94.2 |
| FY2026.3 | 139.3 | 95.1 |
| FY2027.3 plan | 140.0 | 96.0 |
| Q1 FY2027.3 (to Jun 2026) vs Q1 FY2026.3 | 37.8 vs 32.8 | 27.5 vs 22.1 |

Sources: `20260513_en_Complement.pdf`, `en_20260806_Highlights.pdf`, `en_20250508_Complement_2.pdf`,
`en_20240509_Complement_2.pdf` [D].

- **Reading the table.** Japan Toys & Hobby ONE PIECE sales roughly tripled from FY2023.3 to
  FY2025.3, then flattened [D]. That the card game drove most of it is my inference [I]. Bandai
  Namco's own newsletter says the game's "resounding success [contributed] greatly to business
  performance in FY2025.3" [D]. Bandai Namco publishes **no card-game-only revenue figure** that I
  found [U].
- **Newsletter No. 80** (IR library, about 2025, undated) [D]:
  - 1,800 different cards released by then;
  - available in Japanese, English, Simplified Chinese, Korean and French;
  - Europe and North America's TCG market is "three times larger than that of Japan";
  - the game "currently ranks fifth in the region's market share";
  - some products are to release in Europe and North America first.
- **May 2026 results presentation:** "Continued strong popularity of ONE PIECE Card Game both
  around the world" [D].
- **Shipments:** past **1 billion cards** worldwide by summer 2023 (gamebiz, 10 Aug 2023) [S]. This
  is old; no newer cumulative figure was found [U].
- **Japan market context:** "Cards, Trading cards" in the Japan toy market grew from ¥277.4bn
  (FY2024.3) to ¥302.5bn (FY2025.3), +9.0%, at suggested retail prices (Bandai Namco Fact Book 2025)
  [D].
- **Ranking claims are weak.**
  - A retailer blog says One Piece passed Yu-Gi-Oh! as the #3 TCG by sales in late 2025 [S].
  - The newest ICv2 hobby-channel chart found was Fall 2022 (One Piece 6th in the hobby channel)
    [S]. It is old and may have changed.
- **Google Trends:** not reached, so no figure is cited [U].
- **Name clash:** Bandai sold a *different* "One Piece TCG" in 2005 (ICv2, 2005) [S]. Its old
  listings can pollute searches for "One Piece TCG" [I].

### 3b. App-market proxies (observed 2026-10-20)

- Volume in the OP-specific apps is modest: the largest is OP.TCG at 100k+ Play downloads and 1.7k
  reviews [O]. Bandai's tutorial app has 500k+ [O].
- UK App Store rating counts for OP-only apps are tiny: 3 to 25 ratings each (§1b) [O].
- **Inference:** the UK slice of this niche is small. Expect a UK-first app to need the EU, or the
  English-speaking world, to be viable [I].

### 3c. Tournaments and the UK and EU scene

- **Official regionals in the UK**, all run by Organized Play Events Ltd [D]:

  | Event | Venue | Dates |
  |---|---|---|
  | 26-27 Season 1 | WV Active Aldersley, Wolverhampton | 18–19 Jul 2026 |
  | 26-27 Season 2 | Lee Valley Athletics Centre, London | 3–4 Oct 2026 |
  | 26-27 Season 2 | Ashton Gate Stadium, Bristol | 21–22 Nov 2026 |

  - Season 2 lists 13 European events in total [D].
  - The Bristol ticket page shows a **768-player cap**, £38 entry, and main and spectator tickets
    **sold out** [O].
  - An Edinburgh regional (Royal Highland Centre, cap 1,024) appears in search results only; its
    page returned 404 [S][U].
- **Prize thresholds:** "Regionals with 800 or more players will give 32 invites"; a Top 512 prize
  applies when an event is "for 1024 players or more" [D].
- **BANDAI CARD GAMES Fest 26-27 in LONDON:** ExCeL, 15–17 Jan 2027. It hosts the "Championship
  26-27 Europe Finals Season 2" and a Last Chance Qualifier; entry needs a pre-registered ticket
  [D]. This is the biggest UK moment in the next quarter [I].
- **Conventions on the EU calendar** (demo events): Spiel Essen and Paris Games Week (both 22–25 Oct
  2026), and Lucca (28 Oct–1 Nov 2026) [D].

### 3d. Online communities

Reddit blocks this network, so the figures below come from a Redlib mirror [S].

- **r/OnePieceTCG: about 204k.** The mirror labels the number "Members Active".
  - Rule 4: "No Buy/Sell/Trade".
  - Rule 8: "Self-promotion is not allowed more often than once every 3 days", and promoters should
    be active in the sub.
  - **Rule 9 bans anyone who takes part in profiteering subreddits.** The listed subs include
    r/OnePieceTCGFinance and several "invest" subs [S].
  - App-developer posts in the last year mostly scored 0–5. The most-commented were open "what
    features do you want?" threads (15–30 comments) [S].
  - **Inference:** a portfolio, profit and "flip" framing would put off the main community. A
    player and collector framing fits it [I].
- **r/OnePieceTCGFinance: about 31.6k.** It sells advertising and runs affiliate links. Its weekly
  thread asks answerers to disclose commercial interests [S]. Reaching it would alienate
  r/OnePieceTCG [I].
- **r/OnePieceTCGUK** exists but is nearly empty: "17" is shown, with posts from Jan to Apr 2026
  [S].
- **Discord:** "TCG Match Making" has about 53k members (English, ranked OP play), One Piece TCG DACH
  about 3.9k, VIVRECARD (French OPTCG) about 1.4k [S]. I found no UK-specific OP Discord [U].

---

## 4. App Store Optimisation for this niche

### 4a. Platform limits (primary)

| Field | Apple | Google Play |
|---|---|---|
| App name / title | 30 characters | 30 characters |
| Subtitle / short description | Subtitle: 30 characters | Short description: 80 characters |
| Keywords | 100-character keyword field | none |
| Promotional text | 170 characters | — |
| Full description | — | 4,000 characters |
| Screenshots | Up to 10; the first 1–3 show in search results when there is no preview | — |

Sources: Apple's product page (developer.apple.com/app-store/product-page/) [D]; Play's limits
"apply to both full-width and half-width characters" (support answer 9859152) [D].

- **Apple 2.3.7:** "don't try to pack any of your metadata with trademarked terms, popular app
  names, pricing information...". Subtitles must not "reference other apps, or make unverifiable
  product claims" [D].
- **Apple 4.1(c):** "You cannot use another developer's icon, brand, or product name in your app's
  icon or name, without approval" [D].
- **Apple 5.2.1:** "Don't use protected third-party material such as trademarks, copyrighted works
  ... without permission" [D].
- **Google Play metadata policy** bans these in the title, icon and developer name [D]:
  - "No.1"/"Popular"-type ranking claims;
  - price or promotion text;
  - "Editor's choice" and "New" programme badges;
  - emojis and repeated special characters;
  - ALL CAPS, except in a brand name;
  - "a brand's logo without permission".

### 4b. What competitors put in names and subtitles (observed)

- **Words in names:** "OPTCG" (OneCollector, BountyScan, Logia iOS, DON!! Dex, Card Scanner for
  OPTCG, Grand Line Binder, OPbox), "OP TCG" (OP TCG Dex, Haki, OP TCG MX, OP TCG Hub), and
  "Card Scanner", "Scanner", "Price/Prices", "Tracker", "Collector", "Deck Builder", "Value",
  "Portfolio" [O].
- **"One Piece" spelled out** in the store name: Log Pose (iOS name "Log Pose - for One Piece TCG"),
  Logia on Play ("Logia: for One Piece Card Game"), Grandfolio, One Piece TCG Value Scanner, One
  Piece Cards TCG Price, CROCO [O].
- **In-universe One Piece words as brand names:** Haki, Log Pose, Logia, Grand Line, DON!!,
  Bounty, Ohara (Haki's package id), "Straw Hat" (Haki's first screenshot), "SUUUUUUPER" (OP TCG
  Dex's first screenshot) [O].
- **Likely keyword cluster** [I] (from names, subtitles and descriptions, not measured search
  volume [U]): one piece card scanner, optcg, op tcg, one piece tcg price, card value, collection
  tracker, deck builder, japanese one piece cards, alt art / parallel / manga rare, cardmarket
  price, card price checker.

**Trademark note (separate from ASO, not legal advice).**
- Every OP app carries an "unofficial / not affiliated with Bandai, Shueisha, Toei Animation"
  disclaimer [O].
- Many use "OPTCG"/"OP TCG" rather than "ONE PIECE" in the name. Whether that is deliberate
  trademark avoidance is my inference [I].
- I didn't check who holds the "ONE PIECE" marks in the UK or EU; the UKIPO and EUIPO searches were
  not attempted [U].
- In-universe terms may also be protected or strongly associated with the franchise [U].
- An app name built from Cambridge TCG's own words, with "for One Piece Card Game" only as a
  descriptive reference in the description, is the careful reading. A trademark adviser should
  confirm it [I].

### 4c. Screenshot styles that dominate

I viewed the first 4 Play screenshots of 10 apps [O]:

- **A bold 2–5-word caption above a phone frame** on a strong brand colour (blue, red or black),
  e.g. "Scan any card instantly", "Check market Prices!", "THE ULTIMATE SCANNER EXPERIENCE" [O].
- **Official card art front and centre**, usually with Bandai's "SAMPLE" watermark still visible
  [O].
- **Big portfolio totals as the hero number:** $21,642.47, $16,080.57, $53,548.43, $156,494.99
  [O]. Price chips on single cards ($1,250, $3,999.47) [O].
- **Social-proof badges:** "250K+ USERS" (OP.TCG), a "#1 OPTCG COLLECTION APP" laurel (Logia),
  "FASTEST OP SCANNER" with stars (Haki) [O]. On Play, "No.1"-type claims are barred in the title
  and icon by the policy above [D]. Whether they are allowed in screenshots wasn't checked [U].
- **Franchise motifs:** a straw-hat silhouette, a wanted-poster "bounty", "SUUUUUUPER", and a
  booster-pack simulator with paid "Berries" [O].
- **The honest counter-example is OP TCG Hub:** "ONE NUMBER. EVERY PRINTING." / "the scanner
  shows every printing a number shares, and asks when it can't be sure" [O].
- **Fit with our rules** [I]:
  - Inflated sample portfolios, "#1" laurels and pack simulators fail the estate gates: G1 claims,
    G2 pressure, and G4's raffle and mystery-box rule.
  - Showing card art conflicts with ASSETS rule 2.
  - An honest set would show the real UI with real (permitted) data: the printing-picker question,
    the source and date line under a price, and an "unknown" state.

---

## Positioning options

Each option is an agents' proposal for Yu to weigh. None is verified or decided.

1. **"The UK seller's scanner": scan-to-stock for small sellers on eBay and Cardmarket.**
   - **Serves:** UK and EU hobby sellers and small shops who list One Piece singles on eBay UK and
     Cardmarket, the same two channels Cambridge TCG now sells through.
   - **Why:**
     - Gap 5 is the one no OP competitor clearly fills [U]. CardNexus and DeckTradr serve their own
       marketplace or US channels [O].
     - Cambridge TCG can honestly say it built the tool for its own listing work. That claim is
       checkable, so it can go in the ledger [I].
     - Bulk scan, printing confirmation, Cardmarket-style condition and language per copy, and
       export in each channel's import format are concrete and testable claims [I].
   - **Risks:**
     - It needs verified eBay and Cardmarket import formats [U], and price data it may use (§2c).
     - The conflict of interest must be disclosed.
     - The audience is small.
2. **"Prices with receipts": a GBP and EUR collector tracker that shows its sources.**
   - **Serves:** UK and EU collectors and players who distrust dollar-converted "values".
   - **Why:**
     - TCGplayer's UK reviewers ask for pounds and UK sellers [O].
     - OP TCG Hub shows the honest style works, but it is TCGplayer-only, USD and no Japanese [O].
     - The offer: each price shows its source, date, currency and conversion, side by side and
       never blended. "Unknown" when there is no market. No weekly plans, no scan traps, no
       tracking. EN, JP and FR prints.
   - **Risks:**
     - It stands or falls on a licence to show Cardmarket (and possibly eBay) data [U]. Without
       one, Apple 5.2.2 alone could block it [D].
     - The field is crowded: about 15 OP-only apps [O].
3. **"Player-first companion": a printing-aware collection and deck app for UK and EU players,
   with child-safe defaults.**
   - **Serves:** UK and EU players, including teens, and local game stores ahead of regionals and
     the London Fest (Jan 2027).
   - **Why:**
     - r/OnePieceTCG bans profiteering and caps self-promotion [S]. A player framing fits the
       largest community; a portfolio framing does not [I].
     - Bandai's own tools rate poorly (TCG+ 2.2 on Play, 2.7 iOS GB) but own tournament entry [O],
       so complement them rather than copy them [I].
     - Offline OCR with "ask when unsure", French and Chinese print coverage, an official-event
       calendar linking to Bandai, and ICO Children's-code defaults are honest and buildable [I].
   - **Risks:**
     - Weakest revenue case.
     - The same card-image IP question as the others.

**Before any of these** [I]:
- Ask Bandai about card-image use in an app.
- Ask Cardmarket about data licensing, including what the public JSON files may be used for.
- Have about 10 conversations with UK sellers and players (README §4 keeps positioning empty until
  interviews exist).
- Get trademark advice on the name.

---

## Sources (all fetched 2026-10-20)

**App Store pages** (apps.apple.com/gb/app/id… and /us/app/id…):
- TCGplayer 1247645833
- Collectr 1603892248
- Shiny 6593663349
- OP TCG Dex 6478655491
- OP.TCG 6584513689
- Logia 6743872871
- Haki 6757640385
- BountyScan 6746102461
- OneCollector 6499045389
- TCG Stacked 6745709195
- DON!! Dex 6766064169
- Card Scanner for OPTCG 6747088496
- BANDAI TCG+ 1599299476
- Ludex 1616691213
- CollX 1581164444 (GB returns 404)
- TCG ID 6756274382
- Log Pose 6720759559
- CardNexus 6746067537
- Dex (Pokémon only) 1555489854
- "CardMarket" 6738538935: an unrelated finance app, not Cardmarket's

**Google Play** (play.google.com/store/apps/details?id=…&hl=en_GB&gl=GB):
- com.tcgplayer.tcgplayer, com.collectrinc.collectr, io.getshiny.shiny, com.getholodex.app
- com.ludexmobile, com.mikhaellopez.optcg, com.optcgdex.optcgdex, com.logia.android
- com.julianbeck.oharaop, com.ertanarmutcu.OneCollector, com.xavierclaire.don_dex
- com.optcghub.app, com.optcgscan.app, com.optcg.mx, com.grandlinebinder.app
- com.hado98.OnePieceCollection, com.aristidevs.optcgtracker, com.cardvaluepro.optcg.scanner
- com.decktradr.app, com.sandboxxgaming.scandex, com.tcgstacked.app
- com.bandai.bandaitcgplus, com.bandai.onepiece.card.gameteachingf
- app.biiscuit.opdb, com.optcgbox.irg, com.grand_line_deck, com.lrdesign.opdatabase
- com.rdev.optcg_collection, com.ginithekid.optcgtracker, app.bountylog.android
- com.ai.tcg.card.scanner.collector.identifier.value.tracker.price.shop, com.lbmobil.tcgscan
- com.innoapp.tcgscan
- Play search pages for "one piece card scanner", "optcg", "one piece tcg", "tcg card scanner",
  "bandai tcg"

**Developer and vendor sites:**
- https://www.tcgstacked.com/onepiece/card-scanner-app
- https://www.tcgstacked.com/mobile-app/one-piece
- https://morawietz.dev/projects/optcg-card-manager/
- https://help.cardnexus.com/articles/2287029-understanding-prices
- https://tcgcsv.com/
- https://seller.tcgplayer.com/blog/roca-and-scan-identify-support-one-piece-card-game-and-disney-lorcana
  (search snippet only) [S]
- Collectr's prices page, getcollectr.notion.site (search snippet only; the page needs JavaScript)
  [S]

**Bandai and Bandai Namco:**
- https://en.onepiece-cardgame.com/cardlist/?series=569101 (card ids, and the image OP01-120 / _p1)
- https://en.onepiece-cardgame.com/pdf/rule_comprehensive.pdf (v1.2.1, updated 8/28/2026)
- https://en.onepiece-cardgame.com/news/02_382.html (IP regulations, 10 Jul 2026)
- https://en.onepiece-cardgame.com/news/02_412.html (BANDAI TCG+ D, 31 Jul 2026)
- https://en.onepiece-cardgame.com/events/
- https://en.onepiece-cardgame.com/events/regional-season1-26-27.html
- https://en.onepiece-cardgame.com/events/regional-season2-26-27.html
- https://en.onepiece-cardgame.com/events/bcgfest26-27-london.html
- https://www.bandainamco.co.jp/en/ir/library/financialstatements.html
- https://www.bandainamco.co.jp/files/ir/financialstatements/pdf/20260513_en_Complement.pdf
- https://www.bandainamco.co.jp/files/ir/financialstatements/pdf/en_20260806_Highlights.pdf
- https://www.bandainamco.co.jp/files/ir/financialstatements/pdf/en_20250508_Complement_2.pdf
- https://www.bandainamco.co.jp/files/ir/financialstatements/pdf/en_20240509_Complement_2.pdf
- https://www.bandainamco.co.jp/files/ir/financialstatements/pdf/en_20260513_presentation.pdf
- https://www.bandainamco.co.jp/files/ir/financialstatements/pdf/en_20250805_presentation.pdf
- http://www.bandainamco.co.jp/en/ir/library/assets/pdf/2025/factbook2025_en.pdf
- https://www.bandainamco.co.jp/en/ir/library/newsletter80_special.html

**Data and platform policy:**
- https://help.cardmarket.com/en/cardmarket-api
- https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_18.json (first 400
  bytes)
- https://downloads.s3.cardmarket.com/productCatalog/productList/products_singles_18.json (first
  400 bytes)
- docs.tcgplayer.com/docs/getting-started (blocked by a firewall; search snippet only) [S]
- developer.ebay.com/api-docs/buy/marketplace-insights/overview.html (needs JavaScript; search
  snippet only) [S]
- https://developer.apple.com/app-store/review/guidelines/
- https://developer.apple.com/app-store/product-page/
- https://support.google.com/googleplay/android-developer/answer/9898842
- https://support.google.com/googleplay/android-developer/answer/9859152

**UK law and regulators:**
- https://www.gov.uk/government/news/pm-starts-roll-out-of-everyday-fixes-on-the-cost-of-living-ending-rip-off-discounts-and-subscription-traps
  (9 Aug 2026)
- https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/
- Law-firm notes on the subscription timetable: stephensonharwood.com, osborneclarke.com,
  taylorwessing.com [S]

**Events and communities:**
- https://tickets.organizedplay.events/Event/Index/178 (Bristol)
- https://onepiece.gg/championship-26-27-regionals-season-1/ [S]
- https://onepiece.gg/championship-26-27-regionals-season-2/ [S]
- https://redlib.groet-infra.nl/r/OnePieceTCG [S]
- https://redlib.groet-infra.nl/r/OnePieceTCGFinance [S]
- https://redlib.groet-infra.nl/r/OnePieceTCGUK [S]
- Redlib search of r/OnePieceTCG for "app scanner" [S]
- discord.com/servers listings, via search snippets [S]
- royalhighlandcentre.co.uk Edinburgh page (404; search snippet only) [S][U]

**Older and secondary:**
- https://gamebiz.jp/news/373223 (10 Aug 2023) [S]
- https://icv2.com/print/article/7021 (2005 One Piece TCG) [S]
- ICv2 Top Collectible Games Fall 2022 (search snippet only) [S]
- pushas.com.au blog (search snippet only) [S]

**Not reached** [U]:
- reddit.com (blocked: 403 "network policy")
- cardmarket.com (Cloudflare 403)
- Google Trends
- UKIPO and EUIPO trademark search
