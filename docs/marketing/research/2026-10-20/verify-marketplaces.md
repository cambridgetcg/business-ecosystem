# Fact-check: ebay.md and cardmarket.md

An adversarial fact-check by a Claude Code agent (Checker role), dated 2026-10-20. It is research by
an agent, not a decision by Yu, and it is not legal or tax advice. I did not edit the two notes.

## How I checked

- I re-fetched every primary source below myself on 2026-10-20 and tried to refute each claim.
- **eBay.** A single direct download of an eBay help page returned eBay's "Security measure" page.
  I treated that as eBay's answer and made no further direct downloads from www.ebay.co.uk. I read
  eBay help and Seller Centre pages through WebFetch instead, which works through a summarising
  model. eBay quotes below therefore come from that tool's quoted output and not from raw HTML.
  partnernetwork.ebay.com and developer.ebay.com answered normally, so I read their raw text.
- **Cardmarket.** www.cardmarket.com returned HTTP 403 to one WebFetch attempt, and I stopped
  there. help.cardmarket.com, news.cardmarket.com, insight.cardmarket.com, apiv2.cardmarket.com,
  downloads.s3.cardmarket.com and the help shipping-cost API all answered with raw text, which I
  read in full.
- **Law.** I read the raw text on legislation.gov.uk (data.xml) and gov.uk, the raw EC PDF, and the
  ASA page through WebFetch.
- **Verdicts.** *Confirmed*: the source says what the note says. *Corrected*: the core is right,
  but a figure, a scope or a material omission is wrong. *Refuted*: the source contradicts the
  claim. *Unverifiable*: I could not find the claim in the cited source.

## Counts (the 25 load-bearing claims)

| Confirmed | Corrected | Refuted | Unverifiable |
|---|---|---|---|
| 17 | 6 | 1 | 1 |

I also spot-checked 15 further claims, and all of them held (see the list after the table).

## Claims table

All rows were fetched on 2026-10-20.

| # | Claim (as the note states it) | Note: section | Verdict | What the source actually says | URL |
|---|---|---|---|---|---|
| 1 | Regulatory operating fee is **0.35%**; RESEARCH.md's 0.42% has "no source" and should be corrected to 0.35% | ebay: preamble, §4 fees row, Implication 10 | **corrected** | Business page: "regulatory operating fee of 0.35%" and "All fees displayed on this page are exclusive of VAT." Private-seller fees page (last updated 30 Sep 2026): "regulatory operating fee of 0.42%" and "All fees displayed on this page are inclusive of VAT at 20%." 0.35% × 1.2 = 0.42%. Both figures are eBay's own; they differ only in VAT basis. RESEARCH.md should be relabelled "0.42% incl. VAT" rather than overwritten. | https://www.ebay.co.uk/help/selling/fees-credits-invoices/fees-business-sellers?id=4809 ; https://www.ebay.co.uk/sellercentre/private/fees |
| 2 | Business FVF 10.9% (Collectables; Toys & Games); per-order fee £0.30 (≤£10) or £0.40 (>£10); 10p in selected Collectables categories; dispute fee £14; currency conversion 2.75% from 1 Dec 2026 | ebay §4 fees row | **corrected** (the figures are right; the VAT basis is missing) | Every figure matches, and the conversion charge is 2.5% now. The page says all its fees are **exclusive of VAT**. The note never says so. If Cambridge TCG is not VAT-registered (unknown), it cannot reclaim VAT on fees, so the effective rates are about 13.08% FVF, 0.42% ROF and £0.36/£0.48 per order [I]. The 10p rate applies to "Listings created on or after 1 February 2022 in selected Collectables categories"; whether CCG singles qualify is [U]. | https://www.ebay.co.uk/help/selling/fees-credits-invoices/fees-business-sellers?id=4809 |
| 3 | Shop subscriptions (monthly): Basic £27, Featured £77, Anchor £437; Basic includes 250 free fixed-price listings; extra fixed-price listings cost 10p on Basic and 30p with no Shop | ebay §1 | confirmed | "£27" / "£77" / "£437"; "250"; "30p" / "10p". Extra auction listings: 30p with no Shop, 15p on Basic. I did not see the "100 free auction listings" figure in the tool's output [U]. | https://www.ebay.co.uk/help/selling/fees-credits-invoices/fees-business-sellers?id=4809 |
| 4 | Shop specs: logo 300×300 <12MB; billboard 1280×290 <12MB; marketing banner 640×640 <12MB; up to 6 featured categories at 300×300; description 1,000 characters; policies 4,000 characters | ebay §1, Implication 2 | confirmed | Matches word for word. eBay states no file format or mobile crop (the note marks both [U]). | https://www.ebay.co.uk/help/selling/ebay-stores/managing-ebay-shop?id=4090 |
| 5 | Listing photos: up to 24; minimum 500×500; about 1600×1600 recommended; 12 MB; JPEG, PNG and others; 1:1 or 16:9; no borders, added text or watermarks; badges and logos "can hurt search placement" | ebay §2, Implication 3 | confirmed (one small misquote) | Matches, except that the text in quotation marks is not eBay's: the page says badges, logos and so on "can affect your listing's placement in search results". The picture policy requires "at least 500 pixels on the longest side" and bans "Watermarks of any type", added borders and "added text, artwork or marketing material". It does not mention AI. | https://www.ebay.co.uk/help/selling/listings/adding-pictures-listings?id=4148 ; https://www.ebay.co.uk/help/policies/listing-policies/picture-policy?id=4370 |
| 6 | Authenticity Guarantee: £250 or more (excluding postage); single cards; raw and graded; graders PSA, SGC, CGC, CSG, BGS; seller pays postage to the authenticator; no opt-out; UK seller to UK buyer; launched 6 May 2026 at £500 | ebay §6, Implications 7 and 10 | confirmed | Seller page: "listed or sold at £250 or more (exclusive of postage)"; "The cost of postage to the Authenticators is not covered by eBay"; "There is no opt in or opt out option". Help 4644 lists Beckett, PSA, CGC and SGC and **omits CSG**, so the two pages differ on CSG. The seller page says listings that offer collection stay eligible unless the buyer picks collection. Press release dated "May 6, 2026": "£500 and above". | https://pages.ebay.co.uk/authenticity-guarantee-tradingcards-seller/ ; https://www.ebay.co.uk/help/selling/selling-tools/ebay-authenticity-guarantee?id=4644 ; https://www.ebayinc.com/stories/press-room/uk/ebay-launches-authenticity-guarantee-for-trading-cards-in-the-uk/ |
| 7 | eBay UK price guide (1 Sep 2026): free; "Scan cards"; covers One Piece; up to 2 years of UK sales including Best Offers; PSA and CGC population data; refreshed within 24 hours; One Piece searches up 55% month on month in January 2026 | ebay §6, Implication 9 | confirmed | "Sep 1, 2026"; covers Pokémon, MTG, Yu-Gi-Oh!, One Piece and Lorcana; "no subscription fees or usage limits"; searches up 55% in January 2026 against December 2025 (eBay's own figure). | https://www.ebayinc.com/stories/press-room/uk/ebay-launches-price-guide-for-trading-cards-in-the-uk/ |
| 8 | Links policy: no links off eBay; allowed links are eBay pages, product videos, approved freight and legally required information; HTTPS only; Shop names can't be web addresses | ebay §5 | confirmed | "listings or products can't contain links that direct customers to a site other than eBay" (even when not clickable); "Links that we allow must use secure HTTPS"; Shop names can't include ".com" and similar. The page says nothing about the business-seller information block. | https://www.ebay.co.uk/help/policies/listing-policies/links-policy?id=4248 |
| 9 | Off-eBay policy: the contact-sharing ban is pre-sale; "After-sale contact and packaging inserts are not addressed on that page [U]" | ebay §5 | **corrected** | The page also bans "Use contact information obtained through an eBay transaction to offer to buy or sell an item outside of eBay" (no time limit), "In any communications with another eBay member, refer to or promote external websites that facilitate sales outside of eBay", and "Offer catalogues or other items that are used to order items directly outside of eBay". Inserts are not named, but these clauses reach after-sale contact and plausibly printed inserts [I]. The note's practical advice (eBay-only inserts) is right, and the rules behind it are stronger than the note says. | https://www.ebay.co.uk/help/policies/payment-policies/offering-buy-sell-outside-ebay-policy?id=4272 |
| 10 | Promotions: general Promoted Listings at 2%–100% of the total sale amount, charged on a sale within 30 days of a click, last-click attribution; eligibility "Above standard and Top rated sellers with recent sales activity"; Offsite is pay per click, up to 2× the daily budget, capped at 30.4× daily (£10 a day gives £304), excluding VAT, fixed price only; Discounts Manager needs a Shop subscription for business sellers; coded coupons can be printed into an order | ebay §4, Implications 2, 5 and 6 | confirmed | All match. 4164 says ad interactions such as watchlist and add-to-cart count as clicks. Coupons "are not stackable with other discounts such as order discount and volume pricing". Coupon page: "Print a coded coupon note" from Seller Hub Orders. Help 5295 does not mention a daily budget for the priority strategy (the note cites "Seller Centre" as well, which I did not re-read). | https://www.ebay.co.uk/help/selling/ebay-advertising/promoted-listings/general-campaign-strategy?id=4164 ; https://www.ebay.co.uk/help/selling/ebay-advertising/promoted-listings-overview?id=5295 ; https://www.ebay.co.uk/help/selling/ebay-advertising/promoted-offsite?id=5471 ; https://www.ebay.co.uk/help/selling/selling-tools/discounts-manager?id=4094 ; https://www.ebay.co.uk/sellercentre/grow-your-sales/using-promotions-to-boost-your-sales/coded-coupons/ |
| 11 | EPN Agreement (published 24 Sep 2026; existing partners from 28 Sep 2026): Software Applications need EPN's prior written approval; compensation is withheld otherwise; self-clicks are invalid; no promotional content on eBay itself; disclosure example. "No clause bans an eBay seller from linking to its own listings [D, by absence]" | ebay §7, Implication 9 | **corrected** (material omission) | Every quoted clause is present in the raw text. Omitted: "**If you wish to create your own Promotional Content, you must first obtain EPN's prior written approval**". Promotional Content is defined as "Buttons, banners, widgets, text, Software Applications and other creative content", so self-made banners and copy need approval too, not only the app. Also omitted: "Improper Influence: You may not make your own advertising claims." The ban on the Advertiser site names "your listings, your 'About Me' page, or your store". "[D, by absence]" is an inference and should be tagged [I]. Exhibit C (Ambassador Program) sits in this global agreement with no regional limit in its text, so the note's "[S] US-only" claim is not supported by the primary source. | https://partnernetwork.ebay.com/page/network-agreement |
| 12 | DMCC Act from 6 April 2025: fake reviews and reviews that conceal incentivisation are banned; false "limited time" claims banned; drip pricing banned; CMA207 updated 18 Nov 2025 | ebay §5 | confirmed | CMA207: "Updated 18 November 2025"; the provisions "apply to commercial practices which happen from 6 April 2025 onwards"; drip pricing "is prohibited". Sch. 20 para 13: fake review, or one "that conceals the fact it has been incentivised"; para 7: false limited-time claims. See overreach item 3 for how the note applies this. | https://www.gov.uk/government/publications/unfair-commercial-practices-cma207/unfair-commercial-practices ; https://www.legislation.gov.uk/ukpga/2024/13/schedule/20 |
| 13 | ASA affiliate guidance (22 Mar 2023): label "Ad" up front; "*affiliate", "#collab", "may earn an affiliate commission", or disclosure only in About, FAQ or Terms are not enough | ebay §7 | confirmed (dated 2023) | Matches. The page is dated "22 Mar 2023", older than 2025, and may have been updated. | https://www.asa.org.uk/advice-online/affiliate-marketing.html |
| 14 | Cardmarket sales commission 5% | cardmarket §1 fees | confirmed (the rate by seller type is unverifiable) | Selling FAQ: "You will receive payment, minus the 5% sales commission". The fee table (/Policies/Fees) returned 403 to me as well, so whether the rate differs by seller type, any cap, and whether shipping is included all stay [U]. | https://help.cardmarket.com/en/SellingShipmentsFAQ |
| 15 | Offers are sorted lowest price first, regardless of seller status; shipping is factored in where provided | cardmarket §2 | confirmed | Selling FAQ: "We order articles by the lowest price first regardless of the seller's status". Buying FAQ: "By default ... factoring in shipping whenever shipping costs are provided. Users can adjust this". | https://help.cardmarket.com/en/SellingShipmentsFAQ ; https://help.cardmarket.com/en/BuyingPaymentsFAQ |
| 16 | "Any order over €25 from an EU seller to a UK buyer costs at least about €28 in tracked post. From Cambridge TCG it costs €4.87": a "real, structural price advantage" | cardmarket §2 [I], Implications 1 and 6 | **REFUTED** | The €4.87 (UK→UK) and €27.99 (Germany→UK DHL Paket) figures are correct. Germany is the exception, though. Cheapest tracked option to the UK in Cardmarket's own widget today: Austria €6.85 (registered letter, ≤50 g, max €100); France €8.15 (Lettre Suivie, ≤100 g, max €50); Netherlands €12.05; Italy €12.80; Spain €16.04; Poland €19.66; Ireland €20.00; Germany €27.99; Belgium €82.15. Professional sellers may also add their own cheaper shipping methods (Professional Seller Guide). The UK advantage is real but ranges from about €2 to €23 depending on the seller's country. | https://help.cardmarket.com/api/shippingCosts?locale=en&fromCountry=1&toCountry=13 (Austria; Germany=7, France=12, Netherlands=23, Italy=17, Spain=10, Poland=25, Ireland=16, Belgium=2) ; https://help.cardmarket.com/en/professional-seller-guide |
| 17 | Tracked shipping is mandatory over €25, for "some" shipments over €10 from a new seller, for sellers with "too many" shipments not yet arrived, and for loss rates over 2%; seller-rating thresholds (36 evaluations, 97% and 92%, and so on); the Trustee Service applies over €25 and to a new seller's first five sales | cardmarket §2 | confirmed | Matches the ShippingCosts, SellerRating and New User Guide text word for word. The Trustee fee is paid by the buyer: 0.5% by default, or 1% "if the postal insurance value is less than the shipment value". | https://help.cardmarket.com/en/ShippingCosts ; https://help.cardmarket.com/en/SellerRating ; https://help.cardmarket.com/en/new-user-guide ; https://help.cardmarket.com/en/BuyingPaymentsFAQ |
| 18 | A professional account needs a telephone number, a photo ID scan and a business registration or trade licence; a converted private account keeps its evaluations; VAT ID rules cover Germany and other EU sellers only; private accounts are "excluded from selling until a business registration is available" when trading looks commercial | cardmarket §1 | confirmed | Matches. The page names no UK document and has no UK VAT rule (the note marks both [U] and [I]). | https://help.cardmarket.com/en/professional-seller-guide ; https://help.cardmarket.com/en/TaxRequirements |
| 19 | EU VAT through IOSS since January 2026 (≤€150 excluding shipping, non-EU professional seller to private EU buyer, Cardmarket's IOSS number on the package); EU €3 customs duty from 1 July 2026, plus a handling fee "at the latest by November 2026"; Cardmarket collects UK VAT only on non-UK professional sellers' sales to private UK buyers at £135 or less | cardmarket §1 | confirmed (minor) | News of 24.12.2025: "Starting in January 2026 ... up to 150 euros, excluding shipping". The Tax page says the seller is responsible at "150 € or more" (the note says "Above €150"). EC Q&A of 26 March 2026: "temporary customs duty of €3 on items ... from 1 July 2026. At the latest by November 2026, a handling fee will also apply." Its amount is set by a delegated act and is [U] today. News of 08.06.2026: "at least a three euro customs charge"; Cardmarket does not collect it. UK: "a professional seller with a VAT ID number from outside of the United Kingdom ... 135 £ or less". | https://news.cardmarket.com/en/Magic/cardmarket-will-collect-vat-on-professional-to-private-imports-in-the-eu ; https://help.cardmarket.com/en/TaxRequirements ; https://ec.europa.eu/commission/presscorner/api/files/document/print/en/qanda_26_736/QANDA_26_736_EN.pdf ; https://news.cardmarket.com/en/OnePiece/eu-customs-fee-on-imports-costing-less-than-150-euros |
| 20 | Right-of-withdrawal button from 18 June 2026 when the buyer's or seller's address is in the EU; professional sellers must show a withdrawal policy; UK CCR 2013 reg. 30 gives 14 days from delivery | cardmarket §1 | confirmed (minor) | News of 20.05.2026: "We will add the right of withdrawal button on June 18th"; "professional sellers must have a right of withdrawal policy visible on their Cardmarket profile". Reg. 30(3): the period ends 14 days after the goods "come into the physical possession of" the consumer. The note says the button "may not appear on UK-to-UK shipments". Under the stated criteria it will **not** appear [D]. Cardmarket's help adds that withdrawing buyers "cover any associated shipping costs for the return". | https://news.cardmarket.com/en/Pokemon/right-of-withdrawal-button-coming-to-shipment-pages ; https://help.cardmarket.com/en/right-of-withdrawal ; https://www.legislation.gov.uk/uksi/2013/3134/regulation/30 |
| 21 | API closed to new applications; access restricted to professional sellers and subject to manual approval; a Dedicated App may not "constantly only request the public Marketplace resources"; credentials may be shared with an in-house developer or a hired freelancer but not with stock-sync software; the price-guide endpoint was deprecated 05.06.2024; rate limits (2020–21); base URL apiv2 by 1 May 2026 | cardmarket §5 | confirmed | Matches the raw text. The rate-limit entries date from 2020–21 and may have changed. The 100,000 limit reads "100.000 requests per," with a word missing, and the note's "[day]" is an inference. | https://help.cardmarket.com/en/cardmarket-api ; https://apiv2.cardmarket.com/ws/documentation/API:Auth_Overview ; https://apiv2.cardmarket.com/ws/documentation/API_2.0:PriceGuide ; https://apiv2.cardmarket.com/ws/documentation |
| 22 | "Revoked users can reapply at the end of the following month [D]" | cardmarket §5 | **unverifiable** | Not on the cited Cardmarket API help page, which only says misuse "could lead to your API access being revoked". Also not on the Auth Overview or the API news log. The search found no "reapply", "re-apply" or "following month". | https://help.cardmarket.com/en/cardmarket-api ; https://apiv2.cardmarket.com/ws/documentation/API:Auth_Overview |
| 23 | Price guide and catalogue are public files ("use them however you see fit", State of Cardmarket 2024); price_guide_18.json has 13,412 rows, 12,958 with a trend price, created 2026-10-20 | cardmarket §4–5, Implications 5 and 9 | confirmed (2024 caveat stands) | The quote is exact. It is a forward-looking 2024 announcement ("We expect this feature to be available in Q2"), not a licence. My download: createdAt 2026-10-20T02:44:56+0200, 13,412 rows, 12,958 with trend, fields avg, low, trend, avg1, avg7, avg30 (each with a foil variant). The Data page and T&Cs remain unread [U]. | https://insight.cardmarket.com/en/Articles/the-state-of-cardmarket-2024 ; https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_18.json |
| 24 | "Cardmarket's 35 supported countries include the United Kingdom [D, User Account FAQ; O, help API]" | cardmarket §1 | **corrected** | The User Account FAQ lists **32** countries, the UK among them. The help API returns 35 entries, which include "INVALID_ID", Japan and Singapore. The UK being supported holds. | https://help.cardmarket.com/en/UserAccountFAQ ; https://help.cardmarket.com/api/countries?locale=en |
| 25 | How Japanese One Piece cards are catalogued is [U] (an open question for Yu) | cardmarket §4, Open questions | **corrected** (partly answerable) | The Selling FAQ, which the note already cites, answers part of it. To "Is it possible to sell Asia-specific or OCG cards on Cardmarket?" it says: "Once the respective Asian or OCG expansion is available on Cardmarket, you may list them. If the expansion or card is not available, do not list the product under any circumstance, even if you leave a comment explaining it." So Japanese cards never go on English-edition pages. Whether every Japanese One Piece set has its own expansion is still [U]. | https://help.cardmarket.com/en/SellingShipmentsFAQ |

## Further spot-checks (all confirmed, 2026-10-20)

- **eBay business seller policy** (4710, via WebFetch only). Register if "they sell items they have
  bought to resell"; give full contact details, a VAT number and trade bodies; 14-day withdrawal;
  faulty items returned within 30 days for a full refund. Business sellers "can't" charge restocking
  fees, keep the original shipping, or charge buyers return shipping. The page does not mention a
  company number. That last bullet is stricter than CCR 2013, which lets a trader pass return costs
  to the consumer [I; not legal advice]. Because I could only see a summary, someone should read the
  raw text in a browser.
- **SI 2015/17 reg. 25.** Business letters, order forms and "its websites" must show the part of the
  UK of registration, the registered number and the registered office. The text is current on
  legislation.gov.uk.
- **DMCCA Sch. 20 para 25.** "Falsely claiming or creating the false impression that the trader is
  not acting for purposes relating to the trader's business".
- **eBay trading-card condition scheme.** It applies from 23 Oct 2023 (API sellers' existing listings
  from 22 Jan 2024). The tiers and the "Charizard 4/102 ..." title example match. Developer docs:
  LIKE_NEW with 27501/27502, optional 27503 "Maximum length: 30", and USED_VERY_GOOD with 40001,
  for categories 183050, 183454 and 261328. The word "required" for 27501/27502 does not appear on
  that page.
- **https://www.ebay.co.uk/str/cambridgetcg** returned HTTP 410 Gone.
- **eBay feedback manipulation (4231).** No "compensation, benefit or incentive in exchange for
  positive feedback". The page carries no date.
- **Cardmarket.**
  - Packaging fee: €0.30 / €0.50 / €1.00.
  - CN22: "Toys", HS code 95044000.
  - DAC7: reported to BZSt above 30 transactions or €2,000 a year; legal entities report company
    name, address, Commercial Register Number and tax ID.
  - Powerseller: yearly review (news 01.08.2025), first review 1 Feb 2026, capped at 100 (Insight
    2026).
  - Pre-sales: at least 1,000 sales as a professional and at least one year.
  - The AffiliateProgram page returns 404.
  - The Downloads brand terms ("sole property") match.
  - One Piece joined Cardmarket on 23.01.2023.
- **cambridgetcg.com/api/v1/sources.** The Cardmarket entry has "redistribute": false, reviewed
  uses member-display, member-api and member-download, and the 2026-09-08 import. Neither llms.txt
  nor the homepage links to eBay or Cardmarket.

## [D] or [O] claims with no URL, or the wrong kind of evidence

1. cardmarket §2: "Sellers must ship within seven days of payment [D, Shipment Hasn't Arrived page]".
   The page is not in the Sources list, I could not find it (four likely slugs returned 404), and
   no downloaded help page has this sentence. Unverified.
2. cardmarket §5: "Revoked users can reapply ... [D, Cardmarket API page]". The URL is given, but the
   claim is not on that page (row 22).
3. ebay §8: "found no matching seller or Shop [O, via search results]". No engine, query or URL is
   recorded. A search engine's silence is [S]-grade evidence, not an observation.
4. ebay §4: "Codeless coupons: Australia's Seller Centre says coded coupons replaced them [S]". No URL
   is listed.
5. ebay §1: "eBay's image guide recommends VistaCreate templates [D, Shop page link]". The linked
   guide's URL is not listed.
6. ebay §7: "[D, by absence]" is not documentation. It should be [I].
7. cardmarket Implication 9: `contact@cardmarket.com` carries no tag or source. The address does
   appear on https://help.cardmarket.com/en/UserAccountFAQ, so cite that page.

## Overreach: inferences presented as fact, and legal conclusions stated as certain

1. **The 0.42% "correction"** (ebay preamble and Implication 10). The note states that RESEARCH.md
   is wrong and that it "found no source for 0.42%". eBay's own private-seller fees page shows 0.42%,
   VAT-inclusive (row 1). Both the "correction" and the ledger edit it proposes should be withdrawn.
   RESEARCH.md needs only a VAT-basis label.
2. **"Structural price advantage" for UK buyers** (cardmarket §2 [I], Implications 1 and 6). The
   note generalises from one origin country, Germany, to "any ... EU seller", and the claim is
   refuted (row 16). Implication 1's "€4.87 against at least about €28 from EU sellers" must not
   reach any asset or ledger row as written.
3. **"DMCC Act banned practice 13"** cited as banning any incentive tied to feedback (ebay
   Implication 8). Para 13 bans fake reviews and reviews that *conceal* that they were incentivised;
   it does not ban incentives as such. eBay's policy 4231 is the stricter rule. The house rule ("no
   incentive ever") is fine as a choice, but it should not be attributed to the statute. Not legal
   advice.
4. **"Trading as a business without saying so is unlawful in the UK"** (a bold heading in cardmarket
   §1). This is a legal conclusion stated as certain. Para 25 targets *falsely* creating the
   impression of not trading. The "[I; not legal advice]" tag covers only the sentence after the
   heading. The heading should be hedged.
5. **"The eBay Shop cannot point to cambridgetcg.com or to the planned app"** (bold, ebay §5,
   tagged [I]).
   - Listings and descriptions clearly cannot link off eBay.
   - The links policy does allow links to "legally required information".
   - Whether a website address may appear in the business-seller information block is [U].
   - The off-eBay policy targets sales outside eBay. A scanner app that sells nothing is a less
     clear case [I].

   The sentence should be hedged.
6. **"Daily public files are the realistic legal route to price data"** (cardmarket §5 [I]).
   "Legal" is a legal conclusion resting on a 2024 announcement, with the Data page and the T&Cs
   unread. The note does say this elsewhere, but this sentence reads as settled.
7. **"This is an R1-to-R1 link, which the one-way link rule allows"** (cardmarket Implication 8).
   README §3 and §7 mark the one-way link rule as needing Yu's word. Stating what the rule "allows"
   treats a pending proposal as settled.
8. **EPN "Ask EPN in writing first [I]"** (ebay §7). This understates the requirement. Under the
   agreement's own text, prior written approval is *required* for any self-created Promotional
   Content and for Software Applications (row 11). It is not a courtesy.

## Dates older than 2025 that the decisions lean on

- ASA affiliate advice: 22 Mar 2023.
- State of Cardmarket ("however you see fit"): 2024.
- Cardmarket API rate limits: 2020–21.
- The plan for Know-Your-Customer checks on sellers: March 2024 (its status today is [U]).
- eBay CCG condition dates: 2023–24 (still current on today's page).
- eBay vault sale to PSA: April 2024.

Each of these should carry a `review_after` date in any claims-ledger row built from it.

## What the notes got right

Both notes keep their tags honestly, and both name their blocks (eBay's security page and
Cardmarket's 403) instead of guessing. All the pixel specs and policy quotes I could re-read held.
The two large problems are the shipping-cost generalisation and the 0.42% "correction", plus the
EPN omission, which matters for the app.
