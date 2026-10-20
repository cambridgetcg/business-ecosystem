# Cardmarket as a Cambridge TCG sales and marketing channel

Research note written 2026-10-20 by a Claude Code research agent for Yu. It is an agent's research,
not Yu's decision, and **not legal or tax advice**: where law or tax appears, a qualified adviser
should confirm it before anyone relies on it.

Scope: Yu said on 2026-10-20, verbatim: "For now only ebay and cardmarket sales. I am planning to
spin off one piece card scanner and tracker for ios and android". This note covers Cardmarket only.
It fits the estate marketing design in `be-main/docs/marketing` (README §3–5, §7–8; ASSETS.md):
honest by design, real product only, no engineered urgency, no incentivised reviews, no third-party
IP in our assets, agents draft and Yu publishes.

## Tags and method

| Tag | Meaning |
|---|---|
| [D] | Documented by a primary source I read today (Cardmarket's help, news or Insight pages, its API docs, a statute, an EU institution) |
| [O] | Observed today on a live page or live file |
| [S] | Secondary source only (third-party site, search snippet, a partner's article) |
| [U] | Could not reach a source, or no source found |
| [I] | My inference |

- **Fetched:** every URL below was fetched on 2026-10-20 unless marked otherwise.
- **The main site blocked me.** `www.cardmarket.com` returned HTTP 403 "Sorry, you have been
  blocked" (Cloudflare) to both curl and WebFetch [O]. That covers product pages, user profiles, the
  fee table (`/Policies/Fees`), the General Terms and Conditions and the data-download pages. I did
  not try to get round the block. The Wayback Machine returned HTTP 429 for every request, so
  archived copies were not read either [O].
- **What I could read:** `help.cardmarket.com`, `news.cardmarket.com`, `insight.cardmarket.com`, the
  API docs at `apiv2.cardmarket.com`, and Cardmarket's public data files on
  `downloads.s3.cardmarket.com` all answered.
- **Consequence:** anything that only the fee table, the T&Cs or a profile page would settle is
  marked [U]. **Yu, in a normal logged-out browser, should read those three pages before relying on
  this note** (listed under "Open questions").
- **Rules kept:** no logins, accounts, posts, messages, purchases, paid APIs or app downloads. No
  private individual's data was recorded. Powerseller usernames that Cardmarket publishes were seen
  but are not copied here.

---

## 1. Seller account types, what a UK company needs, and fees

### Account types

Cardmarket has three seller categories: **Private**, **Professional** and **Power** [D, New User
Guide].
- **Private sellers** "are casual sellers" [D].
- **Professional sellers** "are businesses that operate on Cardmarket" [D].
- **Powersellers** are "a special group of professional sellers chosen by Cardmarket" [D].

**Private accounts are capped when trading looks commercial.** Cardmarket judges this by sales
frequency and turnover "in EUR or GBP". If those indicate commercial activity, "the account will be
excluded from selling until a business registration is available" [D, Tax Requirements].

**Other limits on private sellers** [D, New User Guide and Selling FAQ]:
- at most two offers of any one sealed product or accessory;
- no pre-sales;
- no "Sellers with the Most Cards" listing, which shows only professional sellers
  (see [§2](#2-how-buyers-choose-sellers)).

**Powerseller status changed in 2025–26.**
- Cardmarket announced on 2025-08-01 that Powerseller status would be awarded by a yearly review
  instead of by application [D].
- The expectations include:
  - "clear communication in their public profile (About Us, Privacy Policy, and Terms of
    Revocation)";
  - customer service in English;
  - being "one of the top sellers on the platform".
- The first review was 2026-02-01 [D].
- The "Class of Powersellers 2026" article (2026-02-23) says only 100 businesses can hold the
  status at a time. Selection weighs:
  - customer service;
  - legal compliance;
  - sales volume;
  - location [D].
- Powerseller status is not a realistic near-term target for Cambridge TCG [I].

### What a UK limited company needs

**To open a professional account** [D, Professional Seller Guide]:
- choose "professional seller" at registration;
- provide a telephone number, a photo ID scan, and a scan of "a business registration or trade
  license";
- Cardmarket then reviews the application before activating the account.
- For Cambridge TCG Limited, the business registration would presumably be its Companies House
  registration (company 15680297), but Cardmarket names no UK document [I].

**An existing private account can be converted** by asking support. Converting keeps the account's
evaluations [D].

**VAT ID rules on that page cover only EU sellers:**
- German pros must have a VAT ID [D].
- Non-German EU pros need one to sell outside their own country [D].
- The page says nothing about UK pros needing a VAT number [U].
- Whether Cambridge TCG is VAT-registered is not known to me [U].

**Seller activation:** Cardmarket sends "two bank transfers" (SEPA) to verify the account, usually
within about four business days [D, Selling FAQ].

**Know-your-customer checks for sellers** were announced as planned in March 2024 [D, State of
Cardmarket 2024]. Their current state is [U]. This is older than 2025 and may have changed.

**One account only.** Cardmarket allows neither multiple accounts nor shared accounts [D, User
Account FAQ].

**Username rules** [D, Netiquette page]:
- 5–20 characters;
- letters, digits and dashes only;
- only support can change it.
- "CambridgeTCG" (12 characters) would fit the rules [I]. Whether that name is free is unknown [U].

**Trading as a business without saying so is unlawful in the UK.** Since 6 April 2025, falsely
"creating the false impression that the trader is not acting for purposes relating to the trader's
business" is a banned practice under the Digital Markets, Competition and Consumers Act 2024,
Schedule 20, paragraph 25 [D]. Together with Cardmarket's own private-seller limits, this means a
limited company should sell on a **professional** account [I; not legal advice].

### Fees and commission

| Item | What I found | Tag |
|---|---|---|
| Sales commission | Sellers receive payment "minus the 5% sales commission". Payment arrives when the seller confirms shipping (untracked), or when the buyer confirms arrival (tracked). | [D] Selling FAQ |
| Commission by seller type, cap, whether shipping is included | Not stated in any page I could read. The fee table at `www.cardmarket.com/en/Policies/Fees` returned 403. | [U] |
| Trustee Service fee | Charged to the **buyer**: 0.5% of merchandise value by default, or 1% "if the postal insurance value is less than the shipment value" | [D] Buying FAQ |
| Packaging fee added to the shipping price | €0.30 for a letter under 100 g; €0.50 for a letter over 100 g or a registered letter; €1.00 for a parcel | [D] Shipping Costs page. Who keeps it is not stated [U]; probably the seller, as part of shipping [I] |
| Withdrawal and payout fees | Not found | [U] |
| PayPal deposits and coupons | Become "non-withdrawable" credit | [D] Buying FAQ |
| Third-party claims | "about 5% plus a small fixed fee" (earlier estate note, citing cardpulse.club). A competitor, CardNexus, claims an effective take of about 11% once instant-credit and trustee fees are added. A 2026 guide mentions an optional "MKM Pro" subscription of about €10 a month. | [S], unverified. The last two come from interested or unclear sources. |

### Currency and post-Brexit specifics

**Currency.**
- The help centre publishes the EUR/GBP rate "used on Cardmarket for all currencies used on user
  accounts": 1 EUR = 0.84245 GBP, updated 2026-10-20 02:40 [D]. So GBP-denominated accounts exist
  [I].
- The shipping calculator shows UK postage in £ and the buyer's price in € [O].

**The UK is a Cardmarket country.** Cardmarket's 35 supported countries include the United Kingdom
[D, User Account FAQ; O, the help API's country list].

**UK to EU: customs paperwork and VAT.**
- Shipments leaving the EU need a CN22. Cardmarket says to choose content type "Other", describe
  the goods as "Toys" and use HS code 95044000 [D, Selling FAQ].
- **EU VAT on UK-to-EU sales** (IOSS, the EU's VAT one-stop shop for imports):
  - Since January 2026, Cardmarket collects EU VAT on shipments from professional sellers outside
    the EU to private EU buyers, up to €150 excluding shipping [D, news 2025-12-24].
  - The seller must put Cardmarket's IOSS number on the package. It is shown on the shipment page
    [D, Tax Requirements].
  - Above €150, the seller is responsible for the VAT [D].
  - These shipments carry a warning label that buyers see before adding them to the cart, and
    buyers see the VAT before committing to buy [D, news 2025-12-24].
- **EU customs duty since 1 July 2026:**
  - The EU applies "a temporary customs duty of €3 on items contained in these small parcels" under
    €150 [D, European Commission Q&A of 26 March 2026].
  - Cardmarket tells buyers to expect "at least a three euro customs charge" on imports from
    professional sellers outside the EU. Buyers pay it at pickup, and Cardmarket does not collect it
    [D, news 2026-06-08].
  - The Commission also says a handling fee will apply "at the latest by November 2026" [D]. Its
    amount is unknown to me [U].
- **UK VAT, and invoices to business buyers:**
  - Cardmarket collects UK VAT (as a VOEC) only when a professional seller **outside** the UK sells
    to a private UK customer, at £135 or less [D, Tax Requirements; news 2021-06-25].
  - It does not collect VAT on UK-to-UK sales. Those fall under Cambridge TCG's own VAT position
    [I; not tax advice].
  - Cardmarket's terms, as quoted on its help page, make the listed item price "the final price,
    including any applicable VAT" [D].
- **Seller sales data reported for tax:**
  - Cardmarket reports sellers above 30 transactions or €2,000 a year to Germany's tax office
    (BZSt), under the EU's DAC7 rules (DPI/DAC7/PStTG).
  - For a business it reports the company name, address, register number and tax ID [D].
  - BZSt forwards the data to "the relevant local authority". How that reaches HMRC for a UK company
    is [U].

**Buyers' right to cancel and return.**
- Cardmarket added a "Right of Withdrawal" button on 2026-06-18 (announced 2026-05-20) [D].
- It applies to private-buyer and professional-seller shipments where "the buyer's or the seller's
  Cardmarket address is in the EU", up to 14 days after delivery [D].
- Professional sellers "must have a right of withdrawal policy visible on their Cardmarket profile"
  [D].
- For UK buyers, the UK Consumer Contracts Regulations 2013 (regulation 30) give a 14-day
  cancellation period that ends 14 days after delivery [D].
- Cardmarket's button may not appear on UK-to-UK shipments, but the legal right still applies
  [I; not legal advice].

---

## 2. How buyers choose sellers

**Offers are sorted by price.**
- The Selling FAQ says: "We order articles by the lowest price first regardless of the seller's
  status on Cardmarket. Users can filter out some articles, but it does not influence the order of
  the results" [D].
- The Buying FAQ adds: "factoring in shipping whenever shipping costs are provided" [D].
- I found no paid placement or promoted listing for sellers [U]. If none exists, ranking can't be
  bought; only price, filters and reputation move an offer [I].

**Filters.**
- Product pages have filters for "language, seller type, and a bunch more" [D, New User Guide].
- The exact filter list (country, condition, minimum rating and so on) is on product pages, which
  returned 403 [U].
- The Shopping Wizard's filters are documented (below).

**Seller inventory filters.** Since 2026-09-10, a seller's inventory page has:
- multi-select filters for expansion, rarity and language;
- sorting across the whole inventory;
- no 300-item limit [D, news 2026-09-10; Insight 9/2026].

This makes a deep, well-catalogued single-game inventory easier to browse [I].

**Shopping Wizard (the cart optimiser)** [D, Shopping Wizard page]:
- It runs on a buyer's Wants list.
- Filters: seller location, seller type, minimum seller reputation, average delivery time, and
  whether to include pre-sales.
- Strategies: "Reduce Price" or "Reduce Shipments".
- A buyer can use it ten times a day, and needs six completed purchases before using
  "Add All to Cart".

**"Sellers with the Most Cards"** sits at the end of a Wants list. It "find[s] which professional
sellers have most or all of the cards on your wants list" [D]. Buyers need six or more completed
purchases to buy from it [D].

**Seller rating** [D, Evaluations and Seller Rating page]:
- It counts only general evaluations from the last 100 evaluations or the last month, whichever is
  greater.
- "Unsent and lost shipments will negatively affect your seller rank".

| Rank | Requirement |
|---|---|
| Outstanding (gold star on blue) | At least 36 evaluations, at least 97% "very good", at most 1% neutral or bad |
| Very good (gold star) | At least 36 evaluations, at least 92% very good, at most 3% neutral or bad |
| Good (silver star) | At least 6 evaluations, at most 4% neutral, at most 2% bad |
| New (no star) | Fewer than 5 evaluations, no neutral or negative ones |

- Sellers with worse statistics show a red dot: "We do not recommend buying from these sellers"
  [D].
- Sellers can ask for an evaluation below "Very Good" to be cancelled within 14 days, then appeal
  [D].
- Cardmarket notes that "buyers will almost always evaluate shipments as 'Very Good'" [D, New User
  Guide].

**Trustee Service (payment protection)** [D, Trustee Service page and New User Guide]:
- On tracked shipments, Cardmarket holds the payment until the buyer confirms arrival.
- It applies "on orders costing more than 25 euros and for the first five sales made by any new
  seller".
- If a buyer doesn't confirm, Cardmarket can confirm arrival after a 7-day deadline. A lost tracked
  shipment triggers a postal investigation that can take up to 3 months.

**Tracked shipping is mandatory** [D, Shipping Costs page] for:
- any shipment worth more than €25;
- "some shipments worth more than 10,00 € from a new seller";
- sellers with "too many" shipments sent but not arrived;
- sellers with a loss rate above 2%.

**Delivery time is visible to buyers.** Buyers can filter on average delivery time (Wizard) [D].
Sellers must ship within seven days of payment [D, Shipment Hasn't Arrived page]. The Seller Guide
says to reply within 24 hours, and calls more than two working days unacceptable [D].

### Live shipping costs from the UK

Cardmarket's own shipping-cost widget gives these figures [O, `help.cardmarket.com/api/shippingCosts`]:

| Route | Cheapest untracked | Cheapest tracked |
|---|---|---|
| UK → Germany or France | Int. Standard Letter €4.93 (stamp £3.60), max value €25 | €19.99 (Int. Standard Small Parcel, ≤250 g, max €100), or €20.12 (Int. Tracked, £250 compensation) |
| UK → UK | 2nd Class letter €1.44 (£0.91) | Signed Large Letter (2nd Class Signed For) €4.87 (£3.55), max €200; Special Delivery from €13.06 |
| Germany → Germany | Standardbrief €1.25 | Einschreiben Einwurf €3.95, max €100 |
| Germany → UK | Letter €1.55, max €25 | DHL Paket €27.99 |

[I] What the shipping figures mean for Cambridge TCG:
- **UK buyers.** Any order over €25 from an EU seller to a UK buyer costs at least about €28 in
  tracked post. From Cambridge TCG it costs €4.87. Cambridge TCG has a real, structural price
  advantage with UK buyers.
- **EU buyers.** For EU buyers the reverse holds, plus import VAT (shown at checkout) and a customs
  charge of at least €3 at pickup. EU sales will mostly be low-value letters (under €25) or rare
  cards that EU sellers don't stock.

---

## 3. What a seller can brand or say

**Profile legal texts.**
- Professional sellers must show a right of withdrawal policy on their profile [D].
- Powersellers are expected to have "About Us, Privacy Policy, and Terms of Revocation" in their
  public profile [D].
- A German legal-text vendor (Händlerbund) sells Cardmarket legal-text packages [S]. Another German
  guide (IT-Recht Kanzlei) describes a "legal information" tab with fields for imprint, terms,
  privacy and withdrawal [S]. The current menu labels are [U].

**Logo, avatar, shop banner, free "about" text.** No help page I could read documents these [U].
Profile pages returned 403.

**External links or contact details in profiles or comments:**
- No rule found [U]. The General T&Cs, where such a rule would live, returned 403.
- The Netiquette page says: do not ask for someone's personal information (phone number, financial
  information and so on) [D].
- The Seller Guide says buyer communication should happen on Cardmarket, in English by default [D].
- Until the T&Cs are read, assume no off-platform contact or links in comments [I].

**Listing comments** [D, Seller Guide]:
- They should rarely be needed, and must be in "simple English".
- They may not override the "machine-readable" data (name, set, language, grading, foil, signed,
  altered).
- Listing on the wrong product page "will lead to serious problems".
- "When in doubt, use a lower grading."
- A one-grade dispute (NM against EX) is usually settled with a refund of about 10% of the card's
  value.
- Cardmarket does not recommend the "Mint" grade. If a buyer complains, the seller must prove it
  [D, Selling FAQ].

**Photos.**
- Since 2023-09-19, users can attach scans to existing articles [D, news].
- An altered card "should only be put up for sale alongside an image of the modified card" [D,
  Card Condition page].
- No published Cardmarket rule on image content, watermarks or AI images was found [U]. The earlier
  estate research found the same.
- Product-page images belong to Cardmarket's catalogue. The API documentation says their URL is
  "only valid for 1hr" [D, API Product entity]. Those images show publishers' card art, so we should
  never reuse them [I].

**Promotions that exist:**
- Professional sellers may set "personal shipping methods", including "free shipping on purchases
  above X value" [D, Professional Seller Guide]. Store pickup and product-specific methods are not
  allowed [D].
- **Pre-sales** need at least 1,000 completed sales as a professional seller, at least a year as a
  professional, and a support-ticket application. Failing a pre-sale date loses the privilege [D,
  Pre-Sales page]. Cambridge TCG is not eligible yet [I].
- **Cardmarket coupons** are platform credit that buyers redeem. They are not a seller discount
  tool [D, Buying FAQ].
- I found no seller-run discount codes, sales events, advertising or promoted listings [U].
- I found no "Sell to Cardmarket" buylist. Cardmarket describes itself as peer-to-peer [S, search;
  D, Arrived Orders page: "You aren't buying from us"].
- **Cardmarket's own brand:**
  - The Downloads page offers Cardmarket logos and banners.
  - By downloading them you "acknowledge and agree that all rights to the brands of
    Sammelkartenmarkt GmbH & Co. KG are our sole property" [D].
  - No permission for seller co-branding is stated [U].
- **Product safety information:** under the EU General Product Safety Regulation, Cardmarket shows
  manufacturer and distributor details on product pages. Bandai Namco Entertainment Europe (Lyon)
  is listed for the One Piece Card Game [D, Insight 1/2026; manufacturer list].

---

## 4. The One Piece Card Game on Cardmarket

**On Cardmarket since 23 January 2023.** "Starting today, One Piece is on Cardmarket!" [D, news
"One Piece Joins Cardmarket!", 23.01.2023]. Cardmarket's 2024 review says One Piece and Lorcana
"brought a lot of new users to Cardmarket" in 2023 [D, State of Cardmarket 2024, 2024-03-25;
older than 2025].

**Catalogue size**, from Cardmarket's official files for game 18 [O]:
- `products_singles_18.json`, created 2026-10-20 14:24 CEST:
  - 12,613 singles;
  - 149 distinct expansion IDs;
  - earliest `dateAdded` 2022-12-28 (catalogue preparation);
  - singles added per year: 8 (2022), 2,341 (2023), 3,454 (2024), 3,839 (2025), 2,971 (2026 so
    far).
- `products_nonsingles_18.json`: 799 sealed and other products, earliest added 2023-01-09:
  - 270 boosters;
  - 182 lots;
  - 132 promo products;
  - 109 preconstructed decks;
  - 106 booster boxes.

**Recent catalogue additions:**
- January 2026: 324 One Piece cards [D, Insight 1/2026].
- September 2026: "Set Sail Deck Set (28 cards)" [D, Insight 9/2026].

**How widely it is traded:**
- Cardmarket publishes no trade volume, order count or share by game that I could find [U].
- The price files carry aggregates, not sale counts [O]. The `avg1` field is present on exactly as
  many products as `avg7`, so it cannot be read as "sold yesterday" [O, I].
- Comparison of catalogue coverage on 2026-10-20 [O] (this measures catalogue size, not trading
  volume):

  | Game | Products in price guide | With a trend price |
  |---|---|---|
  | Magic | 128,295 | 112,276 |
  | Yu-Gi-Oh! | 89,801 | 79,710 |
  | Pokémon | 79,804 | 68,205 |
  | One Piece | 13,412 | 12,958 |

- Cardmarket Grading (Cardmarket's own grading service, launched 2021) reported "more and more
  Lorcana and One Piece" submissions [D, Insight 2023-11-16; older than 2025].
- A third party says One Piece ranked #3 by GMV on TCGplayer in Q4 2025 and Q1 2026. That is US
  data from another marketplace [S].

**Price data shown:**
- The Selling FAQ defines Cardmarket's price suggestions [D]:
  - **LOW:** "the lowest available price";
  - **AVG:** "average price of all current offers";
  - **SELL:** "average sale price in the last 28 days";
  - **TREND:** "based on a linear regression of the last 28 selling days".
- The public One Piece price file has these fields per product, each also for foil [O]:
  - `avg`, `low` and `trend`;
  - `avg1`, `avg7` and `avg30`.
- These are product-level aggregates across conditions and languages [I]. Cambridge TCG's own
  methodology already warns against reading them as condition- or language-specific values [O,
  cambridgetcg.com/methodology/member-pricing].
- How Japanese-language One Piece cards are catalogued (separate pages or a language attribute) is
  [U]. For Pokémon, Japanese cards have separate product pages, and listing them on western pages
  gets them removed [D, Pokémon listing guide]. Whether One Piece works the same way is unconfirmed.

---

## 5. Cardmarket API, data access and terms

**The API is closed to new applications.** "Currently, we are not accepting applications for access
to the Cardmarket API" [D, Cardmarket API page, undated]. "API applications and access are
restricted to professional sellers and subject to a manual approval process" [D, API auth overview,
undated].

**App types** [D, API auth overview]:
- **Dedicated app.** For the developer's own account only. Cardmarket "explicitely do[es] not
  allow" a dedicated app that constantly requests only public marketplace resources (products,
  articles, prices) on consecutive days.
- **3rd-party app.** Serves other users. Only commercial accounts can apply, with a detailed reason,
  and Cardmarket verifies each one.
- **Widget app.** Named in the price-guide endpoint's notes. It is not described further.

**Credentials may not be shared:**
- Existing users may not share API credentials with third-party software, "especially not" software
  that adjusts stock (for example stock sync).
- An in-house developer or a hired freelancer is allowed.
- Misuse can mean revocation [D, Cardmarket API page].
- Revoked users can reapply at the end of the following month [D].

**Rate limits** (from the API news log, all older than 2025, so they may have changed) [D]:
- 600 requests a minute (2020-11-25).
- Marketplace requests are capped at 30,000 a day within the overall limit; "professionals have a
  request limit of 100.000 requests per [day]" (2020-12-15).
- Stock and marketplace groups allow one request at a time per IP (2021-04-15).
- Another user's stock returns at most 1,000 articles (2021-04-29).
- Other users' offer exports: 100 users per 23 hours (2023-06-22).
- Base URL moved to `apiv2.cardmarket.com`, to be adopted by 2026-05-01 [D, 2026-01-30].

**The price guide and product catalogue moved out of the API:**
- The API price-guide endpoint "was deprecated on 05.06.2024 as this feature was made generally
  available via the website" [D].
- The State of Cardmarket 2024 article (Robert Giel, 2024-03-25) says the price guide and product
  catalogue "will become publicly available to all users, without the need to have access to our
  API. This means you can always access and download them on demand and use them however you see
  fit. Do you want to fetch Cardmarket prices for your own website or app? ... All of this will be
  possible soon, no approval or API access needed" [D]. It is dated 2024, so it is older than 2025
  and may have changed.
- The files are live today. For One Piece, the public JSON files on `downloads.s3.cardmarket.com`
  were all created on 2026-10-20 [O]:
  - `productCatalog/priceGuide/price_guide_18.json`: 13,412 rows;
  - `productCatalog/productList/products_singles_18.json`;
  - `productCatalog/productList/products_nonsingles_18.json`.
- The website page that offers them (`/en/Magic/Data/Price-Guide`, per Cambridge TCG's own source
  record) returned 403. **Any terms printed beside the download, and the General T&Cs, are
  unread [U].**

**Cambridge TCG already uses these files:**
- Its public source registry (`cambridgetcg.com/api/v1/sources`) has a Cardmarket entry [O]:
  - "access": "public-file", "license": "proprietary", "redistribute": false;
  - a first One Piece member-price import "in production on 2026-09-08 UTC", with manual collection
    only;
  - reviewed uses: member display, member API and member download, with attribution.
- Its methodology page records the "however you see fit" statement as its basis, and says this is
  "not permission to scrape Cardmarket or use its separately restricted API" [O].
- [I] Two things are worth reconciling in the owning lane:
  - `"redistribute": false` sits beside reviewed member-download use;
  - the evidence is a 2024 announcement, not the current terms.

[I] What this means for the planned One Piece scanner and tracker (iOS/Android):
- **Price data.** Daily public files are the realistic legal route to price data, because the API
  is closed. They give product-level LOW, AVG, TREND and AVG1/7/30 in EUR, and no per-condition or
  per-language prices.
- **No scraping.** Scraping the site is not an option. The site blocks automated clients, and the
  T&Cs are unread.
- **Before launch**, Yu (by hand, logged out, in a browser):
  - reads the Data page and the T&Cs;
  - asks Cardmarket in writing whether redistribution inside a free or paid mobile app is
    acceptable, and on what attribution.
- **No Cardmarket logo, and no claim or implication of partnership** without permission.
- **No Cardmarket product images.** They are short-lived URLs and show publishers' card art.
- **Card identification.** Use the user's own camera image and card numbers (such as OP01-001). Do
  not ship Bandai card art in the app's marketing.

---

## 6. Affiliate and partner programmes

**Affiliate programme: status unknown.**
- `help.cardmarket.com/en/AffiliateProgram` returns 404 today [O].
- A search snippet of that page described bonuses of 50% or 15% of the referred user's commission,
  capped at €5 per referral, with "monthly affiliate income ... limited to 10,00 €". It also gave a
  separate small bonus for professional sellers referring private users [S, undated].
- With the page gone, treat the programme as unavailable or changed [I].

**Partner apps.** The "Partner Apps and Services" page lists two business partners [D]:
- TCG PowerTools, "a professional inventory manager for Cardmarket";
- Scryfall, a Magic search engine.

**Data partnerships.**
- EDHREC announced on 2026-02-10 that "Cardmarket shares price data with EDHREC". Its links to
  Cardmarket carry `utm_source=edhrec` tags; no affiliate terms are described [S, EDHREC's own
  article].
- mtg.wiki says Cardmarket partnered with Scryfall in July 2025 [S].
- [I] So Cardmarket does do data partnerships with useful apps. A One Piece tracker with real users
  could ask, later.

**Event sponsorship.** For events in Europe [D]:
- at least 100 participants;
- apply at least six weeks before, in English;
- no weekly or local-store events;
- no online events.

Not directly useful for an online-only seller [I].

---

## 7. Cambridge TCG's public Cardmarket profile

**Not found.**
- `www.cardmarket.com` (where user profiles live) returned 403 to every request [O].
- A web search for "CambridgeTCG", "Cambridge-TCG" and "Cambridge TCG" on cardmarket.com returned
  nothing [S].
- `cambridgetcg.com` and its `llms.txt` contain no link to a Cardmarket shop. The only Cardmarket
  mention is as a price-data source [O].
- So I can't say whether a profile exists, or give its name, country, sales count or rating.

**Yu can supply the username**, and anyone with a normal browser can then read the public profile.
No profile facts are recorded here.

---

## Implications for Cambridge TCG

The facts behind these moves:
- Ranking is price first, with no paid placement found.
- Trust comes from the evaluation star and tracked delivery.
- Shipping from the UK favours UK buyers strongly.
- So on Cardmarket, marketing means accurate listings, fair prices, real scans and fast,
  well-handled orders, aimed first at UK buyers.

Each move is low cost and honest. Agents draft; Yu publishes or decides.

1. **Sell as a professional account named for the company, UK buyers first.**
   - Open or convert to a Professional account in Cambridge TCG Limited's name, with an ASCII
     username such as `CambridgeTCG` if free.
   - Start with UK delivery, where Cambridge TCG's tracked cost is €4.87 against at least about €28
     from EU sellers.
   - Add EU buyers later, for letters under €25, once import VAT and customs handling (the IOSS
     label, the CN22, HS 95044000) has been run once by hand.
   - *Assets:* a recorded decision (Yu's word); the company documents Cardmarket names (phone, photo
     ID, business registration). Nothing is published.
2. **Write the profile's legal and "about" texts honestly.**
   - Cover the right-of-withdrawal policy (UK CCR 2013 and EU), an imprint (company name, number
     15680297, registered office), terms and a privacy notice.
   - Add one plain entity sentence that matches the C1 entity card, with no claims beyond the
     ledger.
   - *Assets:* four short text blocks and one entity sentence, as claims-ledger rows, gated by
     `rhetorlint` and `fomo_scan`. A solicitor glance is advisable. Yu pastes them.
3. **Use real scans on every article worth about £20 or more.**
   - Shoot front and back on a neutral background, per ASSETS.md B9.
   - Only crop, exposure and colour correction are allowed. No AI, no watermark, no text overlay.
   - Attach scans with Cardmarket's article-scan feature (since 2023).
   - *Assets:* a scan template (size and background), a LightCraft batch-export preset and a naming
     rule; the existing condition checklist on cambridgetcg.com.
4. **Grade strictly and write comments from a phrasebook.**
   - Follow Cardmarket's guide: one grade lower when in doubt, never "Mint".
   - Use 10–15 simple-English comment phrases ("Light whitening on back corner, see scan").
   - Never let a comment contradict the structured fields.
   - *Assets:* a one-page phrasebook and a grading checklist. Text only.
5. **Price from Cardmarket's own public price file.**
   - A small local script reads `price_guide_18.json` and `products_singles_18.json` once a day.
   - It flags Cambridge TCG stock priced far from TREND or AVG30, and suggests prices only.
   - Yu sets prices by hand. Nothing touches the API (closed) or scrapes the site.
   - *Assets:* one script and a CSV; a source note quoting the 2024 "however you see fit" statement
     with its date.
6. **Ship tracked for anything over €25, and answer within 24 hours.**
   - Use UK Signed Large Letter for UK orders.
   - Send tracking numbers through Cardmarket's message system, as it recommends.
   - Keep the loss rate under 2%.
   - *Assets:* neutral message templates: shipped (with tracking), problem before shipping, partial
     refund (10% rule of thumb), withdrawal request.
   - Ask only "please confirm arrival when it arrives". Never ask for a "Very Good" evaluation,
     never offer anything for one, and never mention evaluations at all, in line with no
     incentivised reviews.
7. **Measure trust privately.**
   - Keep one private weekly row, with no buyer names: sales, evaluations so far against the 36
     needed for a star, disputes, average reply time, average dispatch time, losses.
   - *Assets:* a private tracker under the kernel's git-ignored `private/` folder.
8. **Make cambridgetcg.com tell the truth about where Cambridge TCG sells.**
   - Add one "Where we sell" line linking the eBay and Cardmarket profiles. This is an R1-to-R1
     link, which the one-way link rule allows.
   - Remove the retired shop, "Daily Spin" and "daily price guide" claims (ASSETS.md, maintain
     tier).
   - *Assets:* a PR to the Cambridge TCG lane; Yu merges.
9. **Settle the data basis before the One Piece scanner/tracker uses Cardmarket prices.**
   - Yu reads the Data page and the T&Cs logged out.
   - Yu emails Cardmarket support (`contact@cardmarket.com`) to ask whether showing price-guide
     values in a mobile app is acceptable, and with what attribution. This is Yu's act.
   - Reconcile the `"redistribute": false` source record.
   - Plan for EUR, product-level, not condition- or language-specific prices, labelled "Cardmarket
     price guide, daily; not affiliated".
   - *Assets:* a claims-ledger row; an attribution string; an app data-source page draft.
10. **What not to do yet:**
    - **Pre-sales.** Not eligible until a year and 1,000 sales.
    - **Powerseller ambitions.**
    - **Cardmarket logos in our material.** Their brand terms are restrictive.
    - **Any off-platform contact or links in comments** until the T&Cs are read.
    - **AI-made product images.**
    - **Bandai card art in brand material.**

## Open questions for Yu (each needs a normal browser or Yu's own knowledge)

- **Fee table.** Commission by seller type, any cap, whether shipping is included, and payout fees:
  `https://www.cardmarket.com/en/Magic/Policies/Fees`.
- **General T&Cs.** Off-platform contact and links, data use, images:
  `https://www.cardmarket.com/en/Magic/Policies/GeneralTermsAndConditions`.
- **Data-download page and its terms:** `https://www.cardmarket.com/en/Magic/Data/Price-Guide` and
  `.../Data/Product-List`.
- **Account details.** Does Cambridge TCG already have a Cardmarket account, and under what
  username? Is the company VAT-registered?
- **One Piece languages.** Are Japanese One Piece cards separate products on Cardmarket, or a
  language attribute? This matters if Cambridge TCG sells Japanese cards.

## Sources (all fetched 2026-10-20)

Cardmarket help centre (`help.cardmarket.com`):
- https://help.cardmarket.com/en/professional-seller-guide
- https://help.cardmarket.com/en/new-user-guide
- https://help.cardmarket.com/en/TaxRequirements
- https://help.cardmarket.com/en/SellingShipmentsFAQ (embedded answers, incl. "5% sales commission", offer sort order, price suggestions, CN22)
- https://help.cardmarket.com/en/BuyingPaymentsFAQ (trustee fee, tracked thresholds, sort order)
- https://help.cardmarket.com/en/UserAccountFAQ (countries, one account only)
- https://help.cardmarket.com/en/SellerGuide
- https://help.cardmarket.com/en/SellerRating
- https://help.cardmarket.com/en/TrusteeService
- https://help.cardmarket.com/en/ShippingCosts and its widget data https://help.cardmarket.com/api/shippingCosts?locale=en&fromCountry=13&toCountry=7 (also toCountry=12, 13; fromCountry=7 to 7 and 13), https://help.cardmarket.com/api/countries
- https://help.cardmarket.com/en/ShoppingWizard
- https://help.cardmarket.com/en/shopping-features-from-wants
- https://help.cardmarket.com/en/PreSales
- https://help.cardmarket.com/en/NetiquetteUsernamesPasswords
- https://help.cardmarket.com/en/right-of-withdrawal
- https://help.cardmarket.com/en/ArrivedOrders
- https://help.cardmarket.com/en/CardCondition
- https://help.cardmarket.com/en/finding-and-listing-pokemon-cards
- https://help.cardmarket.com/en/CurrencyExchangeRates
- https://help.cardmarket.com/en/Downloads
- https://help.cardmarket.com/en/EventSponsorship
- https://help.cardmarket.com/en/api-partnerships
- https://help.cardmarket.com/en/cardmarket-api
- https://help.cardmarket.com/en/manufacturer-list
- https://help.cardmarket.com/en/AffiliateProgram (404)

Cardmarket news and Insight:
- https://news.cardmarket.com/en/Magic/One-Piece-Joins-Cardmarket (23.01.2023)
- https://news.cardmarket.com/en/Magic/changes-to-powerseller-requirements (01.08.2025)
- https://news.cardmarket.com/en/Magic/cardmarket-will-collect-vat-on-professional-to-private-imports-in-the-eu (24.12.2025)
- https://news.cardmarket.com/en/OnePiece/eu-customs-fee-on-imports-costing-less-than-150-euros (08.06.2026)
- https://news.cardmarket.com/en/Pokemon/right-of-withdrawal-button-coming-to-shipment-pages (20.05.2026)
- https://news.cardmarket.com/en/OnePiece/new-seller-inventory-filters-now-available-to-everyone (10.09.2026)
- https://news.cardmarket.com/en/Magic/cardmarket-users-can-now-add-scans-to-existing-articles (19.09.2023)
- https://news.cardmarket.com/en/Pokemon/VAT-Rules-For-Professional-Sellers-On-Cardmarket (25.06.2021)
- https://news.cardmarket.com/en/FoW/new-seller-icons-on-cardmarket (14.05.2024)
- https://insight.cardmarket.com/en/Articles/the-state-of-cardmarket-2024 (2024-03-25)
- https://insight.cardmarket.com/en/Articles/powersellers-2026 (2026-02-23)
- https://insight.cardmarket.com/en/Articles/whats-new-at-cardmarket-9-2026 (2026-10-05)
- https://insight.cardmarket.com/en/Articles/whats-new-at-cardmarket-1-2026 (2026-02-02)
- https://insight.cardmarket.com/en/Articles/a-look-at-the-cardmarket-grading-live-event (2023-11-16)

Cardmarket API documentation:
- https://apiv2.cardmarket.com/ws/documentation (news log, 2018–2026)
- https://apiv2.cardmarket.com/ws/documentation/API:Auth_Overview
- https://apiv2.cardmarket.com/ws/documentation/API_2.0:PriceGuide
- https://apiv2.cardmarket.com/ws/documentation/API_2.0:Entities:Product

Cardmarket public data files (read for metadata and counts only; not redistributed):
- https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_18.json (also _1, _3, _6, for counts)
- https://downloads.s3.cardmarket.com/productCatalog/productList/products_singles_18.json
- https://downloads.s3.cardmarket.com/productCatalog/productList/products_nonsingles_18.json

Blocked or unreachable [U]:
- https://www.cardmarket.com/en/Magic/Policies/Fees
- https://www.cardmarket.com/en/Magic/Policies/GeneralTermsAndConditions
- https://www.cardmarket.com/en/OnePiece
- web.archive.org (HTTP 429)

Law and regulators:
- https://www.legislation.gov.uk/ukpga/2024/13/schedule/20 (DMCCA 2024 Sch 20 para 25, in force 6.4.2025)
- https://www.legislation.gov.uk/uksi/2013/3134/regulation/30 (Consumer Contracts Regulations 2013, reg 30)
- https://ec.europa.eu/commission/presscorner/api/files/document/print/en/qanda_26_736/QANDA_26_736_EN.pdf (EU Customs Reform Q&A, 26 March 2026)
- consilium.europa.eu pages returned 403 [U]

Cambridge TCG's own public pages:
- https://cambridgetcg.com/llms.txt
- https://cambridgetcg.com/api/v1/sources
- https://cambridgetcg.com/methodology/member-pricing

Secondary sources [S]:
- https://www.cardpulse.club/blog/cardmarket-complete-guide-2026 (updated 2026-07-15)
- https://edhrec.com/articles/introducing-the-cardmarket-x-edhrec-partnership-for-eu-users (2026-02-10)
- https://mtg.wiki/page/Cardmarket
- https://www.misprint.com/posts/one-piece-tcg-overtook-yugioh-number-3
- https://www.haendlerbund.de/de/verkaufsplattformen/cardmarket
- https://www.it-recht-kanzlei.de/handlungsanleitung-rechtstexte-bei-cardmarket-einbinden.html
- Search snippets for help.cardmarket.com/en/AffiliateProgram and cardnexus.com
