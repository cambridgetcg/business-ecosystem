# eBay UK as Cambridge TCG's sales and marketing channel

Research by a Claude Code agent (Scout role), 2026-10-20. Read-only web research: no logins, no
accounts, no posting, no purchases, no paid APIs. This is an agents' finding, not Yu's decision.
Where law comes up, this is research, not legal advice.

**Tags:** [D] = a primary source I read today (eBay's own help, policy or Seller Centre page, eBay
Inc. press room, EPN agreement, statute or regulator guidance). [O] = observed today on a live page.
[S] = secondary source only (press, blog, forum, search snippet). [U] = could not reach or confirm.
[I] = my inference.

**How the pages were read.** Mostly through a fetch tool that summarises pages; key numbers were
re-checked against the raw page text where I could download it (fees, Shop, search-manipulation and
feedback pages). After about eight plain downloads, eBay served a "Security measure | Please verify
yourself" page. I treated that as an answer and stopped downloading from eBay directly; I did not
try to get past it. eBay listing, member and search pages returned HTTP 403 to the fetch tool.

**Dates.** Almost no eBay help page shows an effective date: most show only "Copyright © 1995-2026".
So "[D]" below means "this is what the page said on 2026-10-20", not "this is the rule since date X".
The fees page is the exception ("Last updated on 30 September, 2026").

**Two corrections to the estate's marketing RESEARCH.md** (`be-main/docs/marketing/RESEARCH.md` §4.2):
- Regulatory operating fee: the live UK business fees page says **0.35%** [D], read from the raw page
  text today. RESEARCH.md records 0.42% as "[V-corr]". I found no source for 0.42% (a search found
  only Etsy's UK fee rising, to 0.48%) [S]. Treat 0.42% as unconfirmed until someone shows a source.
- Authenticity Guarantee for cards: the threshold is now **£250** on eBay's own UK pages [D], not
  £500. £500 was the threshold at the 6 May 2026 launch [D].

---

## 1. Store ("Shop") branding

eBay UK calls it a **Shop**, not a Store. All of it is edited in Seller Hub, under Shop then Edit
Shop [D, help 4090].

| Element | Spec on eBay UK's page | Tag |
|---|---|---|
| Logo | "300 x 300 pixels and less than 12MB" | [D] |
| Billboard (banner at the top of the shopfront; "a slogan or other features" allowed) | "1280 x 290 pixels and less than 12MB" | [D] |
| Clickable marketing banner (links to a promotion, a category or one listing; has a title and description) | "640 x 640 pixels and less than 12MB" | [D] |
| Featured categories | up to 6; square "300 x 300 pixels" image; each needs at least one active listing to show | [D] |
| Featured listings | up to 4 rows of up to 6 listings; manual row titles from a fixed list (Featured listings, Best Sellers, Popular Products, Holiday Collection, Items on Sale, Just In, Top Picks) or automated rows (newly listed, auctions ending soonest) | [D] |
| Shop description (About tab) | "1000 character limit"; auto-translated to the visitor's language | [D] |
| Shop policies (About tab) | Shipping, Returns, Warranty, Data Privacy Policy, Other; "4000 character limit" each; must apply to all listings in the Shop | [D] |
| Custom Shop categories | up to 300; an item can sit in 2 at no charge; no subcategories under a category that already holds listings | [D] |
| Shop video (About) | .MP4 or .MOV, under 150 MB; reviewed (usually about 48 hours); the first frame becomes the preview and must not be blurry | [D] |
| Shop name | "can't be web addresses" or include domain endings such as .com | [D, links policy 4248] |
| File formats for logo and billboard | not stated on the Shop page | [U] |
| How the billboard crops on mobile | not stated | [U] |

- Older third-party sources give the billboard as 1200 × 270 px (eBay Germany FAQ, community threads)
  [S]. The UK page says 1280 × 290 [D]. Use the UK figure.
- eBay's image guide recommends VistaCreate templates for Shop images [D, Shop page link]. Under the
  estate design, Shop images come from `artcraft-brand` and VectorCraft instead [I].
- Shop pages are covered by the images and text policy: no third-party images or text without the
  rights owner's written permission [D, help 4240]. So no Pokémon, One Piece or Dragon Ball art,
  characters or logos in the billboard, logo or banners [D plus house rule 2 in ASSETS.md].
- Shop subscription prices for business sellers (monthly): **Basic £27, Featured £77, Anchor £437**.
  Annual prices are not shown on that page. Basic includes 250 free fixed-price listings and 100 free
  7-day auction listings a month; extra fixed-price listings cost 10p on Basic and 30p with no Shop
  [D, fees 4809].

## 2. Listing images

**Picture policy** (help 4370) [D]:
- At least one photo, "at least 500 pixels on the longest side". eBay recommends more than one.
- Not allowed: photos that don't accurately represent the item; placeholder images used to convey
  messages; stock photos for used, damaged or defective items; added borders; "added text, artwork or
  marketing material"; "Watermarks of any type, including those used for ownership attributions".
- Penalties: removal, warning, restrictions, suspension.

**Adding pictures** (help 4148) [D]:
- Up to **24 pictures**. The page states no per-photo fee (the third-party summary says "for free")
  [D for 24; S for "free"].
- Minimum "500 x 500 pixels"; "we recommend images that are about 1600 x 1600"; uploader takes up to
  **12 MB** per image.
- Formats: JPEG, PNG, GIF, TIFF, BMP, WEBP, HEIC, AVIF.
- "photos in a 1:1 or 16:9 aspect ratio look best". White background generally best; darker can suit
  shiny items. Avoid flash and overhead light.
- No badges, logos, copyright notices or watermarks: they "can hurt search placement".
- Built-in editing: crop, rotate, brightness and contrast, background removal to solid white (web);
  in the app, also **AI-generated "Studio", "Surface" and "Outside" backgrounds**.
- Note the two pages word the minimum differently: "500 pixels on the longest side" (policy) versus
  "500 x 500" (how-to) [D]. Shooting at 1600 × 1600 meets both [I].

**Images and text policy** (help 4240) [D]: no images or text "copied from websites or internet
searches"; no manufacturer images "even if it is publicly available"; eBay catalogue images and
details are allowed; sellers "should take their own images and write their own descriptions". Covers
listings, Shop pages, product pages and member messages. AI images are not mentioned [D].

**Trading cards** (Seller Centre, selling trading cards) [D]:
- Photos: front, back, "any significant blemishes, and any grading labels"; white backdrop; "Turn off
  the flash. Use soft, diffused lighting."
- Condition for single cards is **Graded** or **Ungraded**, replacing "Used". Revised listings had
  to use it from **23 October 2023**. For API sellers, new listings needed it from that date and
  existing listings from **22 January 2024** [D]. These dates are before 2025, but the scheme is still
  current on today's pages [D].
- Graded: add grader, numerical grade, and certification number (recommended).
- Ungraded CCG tiers: Near Mint or Better; Lightly Played (Excellent); Moderately Played (Very good);
  Heavily Played (Poor).
- Developer docs [D]: graded = condition `LIKE_NEW` plus Professional Grader (27501) and Grade (27502)
  required, Certification Number (27503) optional, up to 30 characters. Ungraded = `USED_VERY_GOOD`
  plus Card Condition (40001). Categories 183050, 183454 (CCG singles) and 261328. The grader list
  includes PSA, BGS, CGC, SGC, TAG, ACE and others. The page doesn't name marketplaces [D]; that it
  applies to eBay UK is [I], supported by the UK Seller Centre text above.
- The full list of UK item specifics for CCG singles (Game, Set, Card Name, Card Number, Rarity,
  Language and so on) could not be read without the listing form or a login [U]. Live listing pages
  returned 403.

## 3. How buyers find listings (Best Match)

eBay UK's own words (help 4166) [D]: "There's no secret to improving your position in the Best Match
sort order." Factors it lists:
- "How closely the listing matches the buyer's search terms"
- "How popular the item is"
- "The price of the item"
- "The quality of your listing – description, photos, and so on"
- "How complete the listing is"
- "The listing terms of service, such as your return policy and handling time"
- "Your track record as a seller"

Its advice [D]:
- **Title:** "clear and concise... correct spelling and no more than 80 characters".
- Fill in **item specifics** and use eBay catalogue details where possible.
- Photos from every angle, flaws shown; competitive price and postage.
- Fixed price if you want items to show "for more than 10 days".
- Seller Centre: becoming **Top Rated** "improves visibility in search results across all listings";
  offer free or competitive postage, fast dispatch and a generous returns policy [D, listings-in-search].
- The page does not say Promoted Listings affect Best Match; weights are not published [D].

**Titles for card games** (Seller Centre, trading cards) [D]: in a logical order, give card or
character name, card number, set (and edition), special features (holo, full art), **language**,
franchise, and condition or grade. eBay's example: "Charizard 4/102 1st Edition Base Set Holo
English Pokemon Excellent". For pricing, eBay suggests checking Sold listings and comparing only
cards in the same condition.

**Search-manipulation policy** (help 4243) [D], which bites titles:
- No keywords "not directly related to the item"; "All the words in the listing need to be accurate".
- "Listings that make comparisons with other products are not allowed".
- "Listings that promote other listings are not allowed".
- "Listings can't include keywords with question marks"; leave unknown details out.
- No choice of different products, or mixed conditions, in one listing.
- eBay says these help "the best possible position in eBay's Best Match": list identical items as one
  multi-quantity fixed-price listing, and use variations.

## 4. Promotion tools for UK sellers in 2026 (one line each)

Eligibility for all Promoted Listings: "available to Above standard and Top rated sellers with recent
sales activity" [D, fees 4809]. **A new or dormant account may not qualify yet** [I].

| Tool | What it is and what it costs | Tag |
|---|---|---|
| Promoted Listings, **general** strategy | Pay per sale. Ad rate **2%–100%** of the total sale amount (item, postage, taxes and fees); charged only if the item sells within **30 days** of a click on the ad; last-click attribution; dynamic rate option. | [D, help 4164, 5295] |
| Promoted Listings, **priority** strategy | Pay per click (second-price auction; listing quality, keywords, bid, competition and a reserve price set the cost); daily budget; keyword targeting; can add video; reports direct and "halo" sales. | [D, 5295; Seller Centre] |
| **Promoted Offsite** | Pay per click on outside channels "like Google". Daily budget, up to 2× on busy days, never more than **30.4 × daily budget** a month (example: £10 a day = £304 a month cap), excluding VAT. Fixed-price listings only. | [D, help 5471] |
| **Promoted Shops** | Pay per click (second-price auction), target daily budget, monthly cap 30.4 × daily. Needs an active Shop subscription. Ads show Shop name, **logo**, a headline and top listings, on the home page and top of search. | [D, help 5472] |
| Flat-fee promotion (US "Promoted Listings Express" for auctions) | The UK fees page says some campaigns charge "an upfront, flat fee" [D], but I found no UK page for Express; its UK Seller Centre URL returned 404. | [U] |
| **Discounts Manager**: order discounts, multi-buy (volume pricing), coded coupons, sale events (markdowns), postage discounts | No fee stated. For business sellers it needs a **Shop subscription**. Fixed-price, Buy It Now listings only. After a sale-event price change, wait **14 days** before including the item in a new sale. Multi-buy covers up to 500 items. Coupons stack with sale events and postage discounts, not with order discounts or multi-buy. Buyers get the best single discount. | [D, help 4094] |
| Coded coupons | Shown on eBay (search, listing, checkout), or shared privately: "print and send a coupon with an order", social media, buyer groups. Expiry and minimum spend recommended. Codeless coupons: Australia's Seller Centre says coded coupons replaced them [S]; no UK page says so. | [D, Seller Centre coded coupons] |
| Private sellers | Since **20 January 2025**, coupons, sale events, order discounts and multi-buy are not available to private sellers. | [D, help 4090] |
| **Offers to buyers** | Private offer to watchers or people with the item in their basket; minimum 5% off; no extra fee (ad fees may still apply). Automated rule-based offers need a Shop subscription. | [D, Seller Centre] |
| **Shop newsletters** | Email to subscribers, followers and past buyers; 6 templates; a buyer gets at most one per 14 days; promotional sends need an active discount. No phone numbers, emails, off-eBay offers, links to non-eBay items or HTML/scripts. No fee stated. | [D, help 4654] |
| **AI listing tools** | AI bulk listing on desktop Seller Hub: upload batches of photos and get draft listings with category, title and item specifics, for review. Optional; no fee stated; the page has no date (its URL says 2025-january). App "Magical Listing" for private sellers in the US, UK and Germany [S]. AI photo backgrounds in the app [D, 4148]. eBay runs an "AI Activate" programme for UK sellers [D, July 2026 Seller News]. | [D] / [S] |
| **eBay Live** (livestream selling) | Sellers register; "a competitive new eBay Live rate card on 1 July [2026]", amounts not published on that page. eBay said it wanted streamers for trading cards (ChannelX, March 2026). | [D, July 2026 UK Seller News] / [S] |
| Fees, for context | Business final value fee **10.9%** for Collectables and for Toys & Games; per-order fee **£0.30** (≤£10) or **£0.40** (>£10), 10p (≤£10) in unnamed "selected Collectables categories"; regulatory operating fee **0.35%**; dispute fee £14; seller currency conversion rising to 2.75% from **1 Dec 2026** (international sites only). | [D, fees 4809, last updated 30 Sep 2026] |

## 5. Rules that bite marketing

**Links and contact details**
- Links policy (help 4248) [D]: listings "can't contain links that direct customers to a site other
  than eBay". Description links are allowed only to: other eBay pages (other items, Shop pages,
  Follow Seller, Messages); product videos from listed hosts (YouTube, Vimeo and others, specific to
  the item); eBay-approved freight services; legally required information. Allowed links must be
  HTTPS. Shop names can't be web addresses.
- Offering to buy or sell outside eBay (help 4272) [D]: before a sale, buyers and sellers may not
  "Share or request direct contact information": name, addresses, phone, email, social media ID,
  messenger ID, "External website addresses (URLs)", payment details. After-sale contact and
  packaging inserts are not addressed on that page [U]. The coded-coupons page explicitly allows
  printing an **eBay coupon** into an order [D]. Putting a website or app link in the parcel is
  untested territory [I]; keep inserts to eBay-only offers.
- Shop newsletters may not carry phone numbers, emails or links to non-eBay items [D, 4654].
- Result [I]: the eBay Shop **cannot point to cambridgetcg.com or to the planned app**. Cross-promotion
  must run the other way, from the site or app into eBay.

**Feedback**
- Manipulation policy (help 4231) [D]: no "discounts, free items or any other form of compensation,
  benefit or incentive in exchange for positive feedback"; no buying, selling or trading feedback;
  no inflating through repeat purchases. A secondary report says the Australian version was updated
  on 10 Oct 2025 to make the incentive ban explicit [S]; the UK page shows no date.
- Feedback policy (help 4208) [D]: eBay removes feedback used to extort another member (its example is
  a buyer threatening a negative unless sent extras). "Creating, soliciting or using fake, misleading
  or manipulated feedback is not allowed."
- UK law [D, CMA207, updated 18 Nov 2025]: since **6 April 2025** the DMCC Act bans fake reviews and
  any "consumer review that conceals the fact it has been incentivised", false "limited time"
  claims, and drip pricing (mandatory charges must be in the headline price). This is research, not
  legal advice.

**Duplicates and keyword spam**
- Duplicate listings (help 4255) [D]: no more than one fixed-price listing of an identical item at a
  time, including in different categories or under other usernames. Identical auctions are allowed
  only with the same start price, reserve, title and description and no Buy It Now; only one without
  bids is visible at a time.
- Search manipulation: see §3.

**Business-seller disclosures, returns and VAT**
- Business seller policy (help 4710) [D]:
  - anyone buying to resell must register as a business;
  - give "Full contact details for the business", a VAT number if registered, and any trade body or
    authorisation scheme, shown in each listing's business-seller information;
  - a returns policy, with the **14-day** cancellation right (Consumer Contracts Regulations) and
    faulty goods accepted within **30 days** for a full refund (Consumer Rights Act 2015);
  - no restocking fees; original postage refunded on returns; buyers not charged return postage;
  - clear prices including postage and tax.
- Companies law [D, SI 2015/17 reg. 25]: a company must show on its websites its part of the UK of
  registration, registered number and registered office. Whether an eBay Shop counts as the company's
  "website" is not settled by anything I read [I]. Showing them in the business-seller information
  costs nothing. Not legal advice.
- VAT (help 4650) [D]:
  - "All prices on eBay.co.uk will be displayed inclusive of UK VAT";
  - VAT-registered sellers enter a gross price and VAT rate; margin-scheme sellers leave the rate
    blank;
  - showing the VAT ID through the business-seller information is "mandatory" for VAT-registered
    sellers;
  - the business name should match HMRC and Companies House records;
  - where eBay collects the VAT (for example imports of £135 or less), eBay invoices the buyer and the
    seller must not issue a separate VAT invoice.

## 6. Trading-card programmes in the UK (October 2026)

**Authenticity Guarantee (AG)** [D, Seller Centre AG page and help 4644]:
- **£250 or more** (excluding postage). That covers Buy It Now at £250 or more even if a Best Offer
  under £250 is accepted, and auctions that end at £250 or more.
- **Single cards only**, in Collectible Card Game Single Cards, Sports and Non-Sport singles. Lots,
  sets, decks, boxes and packs are excluded.
- Raw and graded both qualify. Accepted graders: PSA, SGC, CGC Trading Cards, CSG, BGS/Beckett. Cards
  slabbed by GMA, HGA, KSA, WCG or GBA are not eligible.
- PSA inspects and does not grade or re-grade. eBay pays for authentication and onward tracked
  delivery; **the seller pays postage to the authenticator**.
- One item per order, so no combined postage. **No opt-out.** UK seller to UK buyer only. No
  collection or PO Box delivery.
- History: launched **6 May 2026** at £500 or more, free to buyers and sellers [D, eBay Inc. press
  release]. The £250 figure is on today's pages, but they carry no date. A secondary source says the
  change was in the October 2026 Seller News [S].

**eBay Vault** [D, eBay Inc., 10 Apr 2024]: eBay agreed to sell the eBay vault to PSA in 2024. The
release covers US customers only. I found no UK vault service on eBay UK [U]. The 2024 date predates
2025, so it may have changed. A secondary source says buyers of graded cards could add PSA Vault
storage at checkout from November 2025, region unstated [S].

**eBay price guide** [D, eBay Inc., 1 Sep 2026]: free, UK, in the app ("Scan cards"), covering
Pokémon, Magic, Yu-Gi-Oh!, **One Piece** and Lorcana. It uses up to two years of eBay UK sales
(including accepted Best Offers), PSA and CGC population data, and data refreshed within 24 hours.
Listings show "See insights". The same release says One Piece searches rose 55% month on month in
January 2026 [D, eBay's own claim].

**Graded-card listing rules:** see §2 (Graded or Ungraded condition; grader, grade, optional cert
number; photograph the grading label).

## 7. eBay Partner Network (EPN, affiliate)

Source: the EPN Network Agreement, "published on the Network website on September 24th, 2026", in
force for existing partners from 28 Sept 2026 [D]. It covers eBay UK among its sites and can pay in
GBP [D].

- **Own listings.** No clause bans an eBay seller from linking to its own listings or earning on
  them [D, by absence]. But:
  - "clicks or impressions generated when you or your Agents click on your own Promotional Content"
    are invalid activity [D];
  - EPN decides invalid activity "in its sole discretion" [D];
  - promotion to a personal network is allowed only for the buyers' "personal use, and not for
    resale" [D].

  So EPN links to Cambridge TCG's own listings are not clearly prohibited, are uncertain, and would
  bring a conflict of interest to disclose [I]. Ask EPN in writing first [I].
- **Apps.** "You will not promote Participating Sites and Content using Software Applications
  without EPN's prior written approval", and EPN "will withhold all compensation for traffic directed
  through Software Applications not approved by EPN" [D]. Approved apps may only open eBay on "a
  user's deliberate and voluntary click" on "a clearly-labeled Link" [D]. **The iOS/Android scanner
  app would need EPN's written approval before any EPN link in it earns** [I, from the clause].
- **Not on eBay.** Promotional content "placed on an Advertiser website itself" (for example in
  listings) is prohibited, except approved browser extensions [D].
- **Disclosure.** Promotions must "clearly and prominently identify Promotional Content as
  advertising" and, where the law requires, disclose the economic interest. EPN's example: "As an
  eBay Partner Network Affiliate, I earn from qualifying purchases" [D].
- **UK advertising rules** [D, ASA advice on affiliate marketing, 22 Mar 2023]: affiliate content
  must be "obviously identifiable as advertising", labelled up front, before people click: "Ad",
  "(Ad)", "#Ad". These are **not enough**: "*affiliate" alone, "#collab", "may earn an affiliate
  commission", or disclosure only in About, FAQ or Terms. EPN's example sentence alone may fall short
  of ASA guidance unless an "Ad" label sits next to the links [I]. The guidance dates from 2023 and
  may have been updated [U].
- **Commission rates.** The UK rate card for collectibles was not reachable [U]. Australia's and
  France's pages say collectibles earn 1–4% depending on subcategory [S].
- **Ambassador programme.** Secondary sources say eBay's newer Ambassador programme is US-only and
  that the old seller incentive (a final value fee credit on self-referred sales) was dropped [S].

## 8. Cambridge TCG's public eBay presence

- A web search for "Cambridge TCG" and "cambridgetcg" on ebay.co.uk found **no matching seller or
  Shop** [O, via search results]. Close names belong to unrelated sellers; I recorded none of their
  details.
- `https://www.ebay.co.uk/str/cambridgetcg` returned **HTTP 410 Gone** [O]. That shows no live Shop at
  that slug today. It does not prove there never was one, or that the account has another name [I].
- `https://www.ebay.co.uk/usr/cambridgetcg` and seller search `_ssn=cambridgetcg` returned **HTTP 403**
  (blocked for automated fetches) [U].
- cambridgetcg.com's homepage and `llms.txt` contain **no eBay or Cardmarket link** [O]. The site
  presents itself as "open-source TCG data infrastructure" and says "New paid commerce is retired" [O].
- The estate record (ledger `be-business-facts`, as quoted in RESEARCH.md §4.2 and design-reach.md)
  says "eBay shows 0 listings". It also says the old Lambda pipeline pushed prices to Shopify and eBay
  until the shop closed on 2026-07-06 (`estate/curated/families/commerce-tcg.toml`) [dated note, not
  re-verified]. The record gives no eBay username.
- **Store name, feedback score, item count: unknown [U].** Yu can settle it with one fact, the eBay
  username, after which the public profile can be read without logging in.

---

## Implications for Cambridge TCG

These are proposals to put to Yu, honest and low-cost first. Anything that spends money, edits a
listing or changes the account is Yu's hand (README §7). Assets come from `artcraft-brand` and the
pinned Craft CLIs; text is composited, never generated; no licensed card art in brand assets.

1. **Business identity first (no cost).** Confirm the account is registered as a business. Fill the
   business-seller information with Cambridge TCG Limited, company number 15680297, registered office
   and part of the UK of registration (reg. 25), a contact email, and the VAT number if registered.
   Match the name to Companies House and HMRC. Returns: at least the 14-day cancellation right and
   30 days for faulty goods; no restocking fee. *Assets:* none; one ledger claim per fact.
2. **A truthful Shop kit (Basic Shop £27 a month, Yu's call).** A subscription unlocks the Discounts
   Manager, coupons, automated offers, Promoted Shops and newsletters. *Assets:*
   - logo 300×300 PNG;
   - billboard 1280×290, a plain slogan, text kept to the central area because mobile cropping is
     unconfirmed;
   - marketing banner 640×640;
   - up to 6 category tiles at 300×300 (One Piece, Pokémon, Dragon Ball, Graded, Sealed, Japanese
     singles), made from shapes and type with no character art;
   - About text of 1,000 characters or fewer (what we sell, where cards come from, how we grade
     condition, with no "best" or "cheapest" claims), and policies of 4,000 characters or fewer
     each.

   Every file must be under 12 MB.
3. **A house photo standard that eBay already wants.**
   - Masters at 1600×1600 (1:1), JPEG under 12 MB, shot on a neutral or white matte background with
     diffused light and no flash.
   - Raw singles: front, back and flaw close-ups.
   - Graded: front, back and a cert-label close-up.
   - Sealed: front, back and seal.
   - No borders, text, logos or watermarks.
   - Don't use eBay's AI "Studio/Surface/Outside" backgrounds, or anything beyond crop, exposure and
     colour (ASSETS rule 1).

   LightCraft batch-exports the set. *Assets:* a shot list and one reference set per product type.
4. **Title and condition templates per game.** For example: `[Card name] [number] [set] [features]
   Japanese One Piece Card Game [NM / PSA 10]`, 80 characters or fewer. Put the language early,
   because Cambridge TCG sells Japanese cards [I]. No "?", no "like" or "not", no unrelated franchise
   words. Graded: grader, grade and cert number. Ungraded: the CCG condition tier, with a plain
   in-description mapping to the condition guide on our site, without linking to it. *Assets:* a CSV
   template and a checker for G4 (80 characters, banned tokens).
5. **Free promotions before paid ones.**
   - Offers to buyers (5% minimum).
   - One coded coupon printed on a parcel insert, with a real expiry stated plainly and no tie to
     feedback.
   - Multi-buy on multi-quantity sealed listings.
   - At most one Shop newsletter every 14 days, only when there is something new.

   *Assets:* an A6 or DL insert (print size to confirm with the printer) carrying an eBay coupon code
   and no URLs; a newsletter header made to eBay's template (size unconfirmed [U]). All go through G2
   (`fomo_scan`) and G3.
6. **Paid ads only after eligibility and a baseline (Yu's word for spend).** When the account is
   "Above standard" with recent sales, test the **general** strategy (pay per sale) at a low fixed rate
   on 10–20 listings for 30 days, and compare against unpromoted listings. Leave priority, Offsite and
   Promoted Shops (pay per click) until margins are known. For Offsite, the cap is 30.4 × the daily
   budget. *Assets:* none beyond the logo (Promoted Shops reuses the 300×300 logo).
7. **Authenticity Guarantee as plain fact, not a badge.** Singles at £250 or more go to PSA
   automatically: budget the tracked postage, one card per order. Don't add our own "authenticated" or
   "guaranteed" wording; eBay shows its badge. *Assets:* none.
8. **Feedback and reviews by mechanism.** Use eBay's own reminders only. No incentive, coupon or
   discount is ever tied to feedback (eBay policy and DMCC Act banned practice 13). Add a G1/G2 rule
   that blocks any insert or message pairing "feedback" with an offer. *Assets:* none.
9. **The One Piece scanner and tracker app: the incumbent and the rules.**
   - eBay's free UK price guide already scans One Piece cards and shows two years of UK sales [D], so
     the app needs a reason to exist beyond prices. Japanese-edition coverage, collection tracking
     and honest condition help are candidates [I].
   - eBay listings and the Shop can't link to the app, so promotion runs from the app and site into
     eBay.
   - Any EPN link in the app needs EPN's prior written approval and an up-front "Ad" label (ASA). If
     it points to Cambridge TCG's own listings, the app should say so next to the link.
   - *Assets:* an app-store icon and screenshots come later, under the app's own kit.
10. **Fix the estate's ledger.** Correct RESEARCH.md §4.2: the regulatory operating fee is 0.35%
    (not 0.42%), and the AG threshold is £250 (not £500). Add `review_after` dates, because eBay pages
    carry no effective dates. Ask Yu for the eBay username so §8 can be observed rather than inferred.

## Sources (all fetched 2026-10-20)

eBay UK help and Seller Centre (primary):
- Managing your eBay Shop (Shop branding specs; private-seller changes from 20 Jan 2025): https://www.ebay.co.uk/help/selling/ebay-stores/managing-ebay-shop?id=4090
- Picture policy: https://www.ebay.co.uk/help/policies/listing-policies/picture-policy?id=4370
- Adding pictures to your listings: https://www.ebay.co.uk/help/selling/listings/adding-pictures-listings?id=4148
- Images, videos and text policy: https://www.ebay.co.uk/help/policies/listing-policies/images-text-policy?id=4240
- Optimising listings for Best Match: https://www.ebay.co.uk/help/selling/listings/listing-tips/optimising-listings-best-match?id=4166
- Seller Centre, listings in search: https://www.ebay.co.uk/sellercentre/listings/listings-in-search
- Seller Centre, selling trading cards: https://www.ebay.co.uk/sellercentre/selling/selling-trading-cards and https://ebay.co.uk/sellercentre/selling/what-to-sell/trading-cards
- Search manipulation policy: https://www.ebay.co.uk/help/policies/listing-policies/search-browse-manipulation-policy?id=4243
- Duplicate listings policy: https://www.ebay.co.uk/help/policies/listing-policies/duplicate-listings-policy?id=4255
- Links policy: https://www.ebay.co.uk/help/policies/listing-policies/links-policy?id=4248
- Offering to buy or sell outside eBay: https://www.ebay.co.uk/help/policies/payment-policies/offering-buy-sell-outside-ebay-policy?id=4272
- Feedback manipulation policy: https://www.ebay.co.uk/help/policies/feedback-policies/feedback-manipulation-policy?id=4231
- Feedback policy: https://www.ebay.co.uk/help/policies/feedback-policies/feedback-policy?id=4208
- Business seller policy: https://www.ebay.co.uk/help/policies/selling-policies/selling-practices-policy/business-seller-policy?id=4710
- VAT obligations: https://www.ebay.co.uk/help/listings/default/vat-obligations-uk-eu?id=4650
- Fees for business sellers (last updated 30 Sep 2026): https://www.ebay.co.uk/help/selling/fees-credits-invoices/fees-business-sellers?id=4809
- Promoted Listings overview: https://www.ebay.co.uk/help/selling/ebay-advertising/promoted-listings-overview?id=5295
- General campaign strategy: https://www.ebay.co.uk/help/selling/ebay-advertising/promoted-listings/general-campaign-strategy?id=4164
- Seller Centre, Promoted Listings: https://www.ebay.co.uk/sellercentre/grow-your-sales/ebay-advertising/promoted-listings
- Promoted Offsite: https://www.ebay.co.uk/help/selling/ebay-advertising/promoted-offsite?id=5471
- Promoted Shops: https://www.ebay.co.uk/help/selling/ebay-advertising/promoted-shops?id=5472
- Discounts Manager: https://www.ebay.co.uk/help/selling/selling-tools/discounts-manager?id=4094
- Seller Centre, coded coupons: https://www.ebay.co.uk/sellercentre/grow-your-sales/using-promotions-to-boost-your-sales/coded-coupons/
- Seller Centre, Offer to Buyers and Best Offer: https://www.ebay.co.uk/sellercentre/grow-your-sales/using-discounts-to-boost-your-sales/offer-to-buyers-best-offer
- Shop newsletters: https://www.ebay.co.uk/help/selling/selling-tools/ebay-shop-newsletters?id=4654
- Seller Centre, AI bulk listing tool: https://ebay.co.uk/sellercentre/news/2025-january/ai-bulk-listings
- Seller Centre, July 2026 UK news (eBay Live rate card, AI Activate): https://www.ebay.co.uk/sellercentre/news/july-uk-leaders-2026
- Authenticity Guarantee for trading cards (seller page): https://pages.ebay.co.uk/authenticity-guarantee-tradingcards-seller/
- Authenticity Guarantee help: https://www.ebay.co.uk/help/selling/selling-tools/ebay-authenticity-guarantee?id=4644

eBay Inc. and developer (primary):
- AG launch in the UK, 6 May 2026: https://www.ebayinc.com/stories/press-room/uk/ebay-launches-authenticity-guarantee-for-trading-cards-in-the-uk/
- Price guide launch in the UK, 1 Sep 2026: https://www.ebayinc.com/stories/press-room/uk/ebay-launches-price-guide-for-trading-cards-in-the-uk/
- eBay and Collectors deal (vault to PSA), 10 Apr 2024: https://www.ebayinc.com/stories/news/ebay-collectors-enter-into-commercial-agreement-sign-deals-for-acquisition-of-goldin-by-ebay-and-acquisition-of-the-ebay-vault-by-psa/
- Trading-card condition descriptors: https://developer.ebay.com/api-docs/user-guides/static/mip-user-guide/mip-enum-condition-descriptor-ids-for-trading-cards.html
- EPN Network Agreement (published 24 Sep 2026): https://partnernetwork.ebay.com/page/network-agreement

Law and regulators (primary; research, not legal advice):
- Company, LLP and Business Names (Trading Disclosures) Regulations 2015, reg. 25: https://www.legislation.gov.uk/uksi/2015/17/regulation/25
- CMA207 unfair commercial practices guidance (updated 18 Nov 2025): https://www.gov.uk/government/publications/unfair-commercial-practices-cma207/unfair-commercial-practices
- ASA advice, affiliate marketing (22 Mar 2023): https://www.asa.org.uk/advice-online/affiliate-marketing.html

Secondary (marked [S] where used):
- CardGrade on AG at £250 (7 Oct 2026): https://cardgrade.io/blog/ebay-uk-card-authentication-250-october-2026
- Value Added Resource, October 2026 Seller News: https://www.valueaddedresource.net/ebay-october-2026-seller-news/
- Value Added Resource, Ambassador programme and EPN seller incentive: https://www.valueaddedresource.net/ebay-expands-ambassador-affiliate-program/
- ChannelX on eBay Live sign-ups (March 2026): https://channelx.world/2026/03/sign-up-to-sell-on-ebay-live-new-categories/
- Retail Systems and ChannelX on Magical Listing (April 2025): https://retail-systems.com/rs/eBay_rolls_out_ai_product_listing_tool_on_mobile.php
- Billboard 1200×270 (older): https://pages.ebay.de/stores/new/faqs.html

Observed [O], 2026-10-20: https://www.ebay.co.uk/str/cambridgetcg (HTTP 410);
https://www.ebay.co.uk/usr/cambridgetcg (HTTP 403); https://cambridgetcg.com/ and
https://cambridgetcg.com/llms.txt (no eBay or Cardmarket links).
