# VAT and Cambridge TCG's selling: what registration changes (2026-10-22)

Written 2026-10-22 by a Claude Code research agent for Yu. It is not Yu's decision and **not tax or
legal advice**: every scheme choice and every return figure is for Yu and the accountant. All reads
were public and logged out. Nothing was posted, bought, sent or logged into.

Filed in the repo on 2026-10-22. For filing, paths to the agents' working files were removed, and
the few changes made then are marked "(at filing)". Raw captures were saved but are not filed.
Notes from the same day: [ebay-account.md](ebay-account.md),
[cardmarket-account.md](cardmarket-account.md), and the draft texts in
[marketplace-texts.md](marketplace-texts.md). RESEARCH §7.6 summarises all four.

Yu, 2026-10-22, verbatim: "eBay: cambridgetcg cardmarket: cambridgetcg 😂 yes VAT registered."
The VAT scheme, VAT number and effective date of registration were not given.

**Labels.** [V] read on a primary source on 2026-10-22 (URL given). [O] observed on the account's own public
page. [S] secondary source (including our own 2026-10-20 notes when not re-read). [I] inference.
[U] unknown.

**Method.** gov.uk pages were read through the gov.uk content API (`/api/content/...`), and
legislation.gov.uk, Companies House, eBay help, Cardmarket help and news, Google and Apple pages
with `curl`, between 19:34 and 19:50 UTC. eBay's help pages answered 200 to curl today. Raw captures
of these public pages were saved but are not filed.

**Blocked today (not routed around):**
- `https://www.ebay.co.uk/usr/cambridgetcg` and the seller search `?_ssn=cambridgetcg`: HTTP 403
  "Error Page | eBay" (curl, 19:46 UTC).
- `https://www.cardmarket.com/en/OnePiece/Users/cambridgetcg` and the Cardmarket fee page: HTTP 403
  "Attention Required! | Cloudflare" (curl, 19:45 UTC).

A bot wall is a refusal, so no headless browser was tried against it. **Neither account was
observed. No [O] claims exist in this note.** (At filing: a separate run observed the eBay account
the same day with a headless browser. [ebay-account.md](ebay-account.md) says how, and why agents
won't repeat it.)

---

## 1. Companies House: the record matches

https://find-and-update.company-information.service.gov.uk/company/15680297, read with curl at
2026-10-22 19:34 UTC [V]. The page itself warns: "Companies House does not check the accuracy of the
information filed".

| Field | Value (verbatim) |
|---|---|
| Registered name | "CAMBRIDGE TCG LIMITED" (matches "Cambridge TCG Limited") |
| Company number | "15680297" |
| Status | "Active" |
| Type | "Private limited Company" |
| Registered office | "60 Tottenham Court Road Suite 4583a, Fitzrovia, London, United Kingdom, W1T 2EW" |
| Incorporated | "25 April 2024" |
| SIC codes | "47650 - Retail sale of games and toys in specialised stores"; "47910 - Retail sale via mail order houses or via Internet"; "62012 - Business and domestic software development" |
| Accounts | next made up to "30 April 2026", due by "31 January 2027"; last made up to "30 April 2025" |
| Confirmation statement | last dated "26 March 2026"; next due by "9 April 2027" |

- The number carries no SC or NI prefix and the office is in London, so the company is very likely
  registered in England and Wales. That is what reg. 25 asks a company to state [I]. (At filing: the
  certificate of incorporation in the filing history, fetched once with curl on 2026-10-22, says
  "the situation of its registered office is in England and Wales" [V; saved capture, not filed].)
- The suite-numbered office reads like a serviced or virtual address [I]. HMRC says a business that
  "has a registered, serviced or virtual office" is, by that alone, "unlikely" to show UK
  establishment for marketplace VAT. UK establishment depends on where the business is actually run
  from. Where Cambridge TCG is run from is [U].
  https://www.gov.uk/guidance/charging-vat-when-using-an-online-marketplace-to-sell-goods-to-customers-in-the-uk
  [V]

## 2. eBay UK fees: VAT is added, and it is reclaimable

**The facts:**
- **Fee basis** [V]: business fees are quoted net of VAT: "All fees displayed on this page are
  exclusive of VAT" (last updated "30 September, 2026").
  https://www.ebay.co.uk/help/selling/fees-credits-invoices/fees-business-sellers?id=4809
- **Rates** [V]:
  - Final value fee: "Collectables" (#1) and "Toys & Games" (#220) are both 10.9%.
  - Per-order fee: "For orders £10.00 or less the per-order fee is £0.30, for orders over £10.00 the
    per-order fee is £0.40".
  - Regulatory operating fee: "0.35%, calculated on the total amount of the sale".
- **The fee base includes the VAT** [V]. The final value fee is charged on "the total amount of the
  sale (which includes the item price, postage, and any applicable taxes)". So eBay charges its fee
  on the VAT inside your price as well [I].
- **The VAT rate on fees** [V]. eBay's private-seller page says "All fees displayed on this page are
  inclusive of VAT at 20%". https://www.ebay.co.uk/help/selling/fees-credits-invoices/understanding-invoice?id=4822
  (it serves "Fees for private sellers").
  - (At filing.) The same page says: "It's now free for UK-based private sellers to sell on eBay
    ... You won't pay final value fees or regulatory operating fees when your items sell" [V]. So
    the business fees above are fees a private account doesn't pay [I].
- **eBay's supplier is a UK entity** [V]: "If you reside in the United Kingdom, you are entering into
  a contract with eBay (UK) Limited ... VAT number GB 365 6085 76" (in force for existing users from
  10 August 2026). https://www.ebay.co.uk/help/policies/member-behaviour-policies/user-agreement?id=4259
  - So the VAT on fees is ordinary UK VAT at 20% from a UK supplier, not a reverse charge [I].
- **eBay leaves the fee VAT to you** [V]: "it's up to you to pay VAT on selling fees".
  https://www.ebay.co.uk/help/selling/fees-credits-invoices/taxes-import-charges?id=4121
- **HMRC lets you reclaim it** [V]. Input tax is "the VAT you're charged on your business purchases
  and expenses". You can reclaim it where it relates to taxable supplies, and "you must hold valid
  evidence that you have received a taxable supply". VAT Notice 700 §10.1, §10.2 and §10.6:
  https://www.gov.uk/guidance/vat-guide-notice-700
  - eBay's fees serve taxable sales, so their VAT is reclaimable input tax on the strength of eBay's
    fee invoice [I].
  - Whether Seller Hub's monthly invoice shows the VAT separately needs a login, so it is [U].
- **The VAT fraction** [V]: "with VAT at 20% the VAT fraction is: 20⁄120 ... which is the same as
  one-sixth" (Notice 700 §7.3.1).

**Correcting RESEARCH.md §7.1.** The line "Without VAT registration (status unknown), the effective
final value fee is about 13.1%" was 10.9% × 1.2 = 13.08%. That applies only to a seller who cannot
reclaim VAT. Cambridge TCG is registered, so the fee cost is the **net** rate. Registration's real
effect is **output VAT on the sale**, not the fees [I].

**Worked example: one £20 card, free postage, so the total sale is £20, UK buyer.** All figures are
[I] arithmetic on the [V] rates above.

| Line | Amount |
|---|---|
| Final value fee, 10.9% × £20 | £2.18 |
| Per-order fee (order over £10) | £0.40 |
| Regulatory operating fee, 0.35% × £20 | £0.07 |
| **eBay fees, net** | **£2.65 (13.25% of the sale)** |
| UK VAT added at 20% | £0.53 |
| Charged by eBay, gross | £3.18 (15.9%) |
| Reclaimed as input tax (Box 4) | −£0.53 |
| **Fee cost to a VAT-registered seller** | **£2.65** |

**Output VAT on the same £20 sale.** Prices are VAT-inclusive, so the VAT is a fraction of the price
[I]:
- **Standard rate:** £20 × 1/6 = **£3.33** owed to HMRC, leaving £16.67 net revenue.
- **Margin scheme**, for a card bought from a private individual: VAT = (sale − purchase) × 1/6.
  - Bought for £8: (£20 − £8)/6 = **£2.00**.
  - Bought for £15: **£0.83**.
  - Bought for £20 or more: **£0**. A loss on one item is not offset under the item-by-item scheme
    [I]; Global Accounting does carry negative margins forward (§5).

**Take-home on that £20 card bought for £8**, before postage and packing [I]:

| Treatment | Take-home | Working |
|---|---|---|
| Standard-rated | £6.02 | 20 − 3.33 − 2.65 − 8 |
| Margin scheme | £7.35 | 20 − 2.00 − 2.65 − 8 |
| Counterfactual: not registered | £8.82 | 20 − 3.18 − 8 |

**Postage you charge is taxable too** [V]. When you post goods, "the charge made to you by Royal Mail
may be exempt, but your charge to your customer is taxable even if it's exactly equal to the charge
made to you by Royal Mail" (Notice 700 §8.3). A paid-postage line therefore carries 1/6 output VAT
while the stamp may carry no input VAT [I].

## 3. eBay business-seller duties tied to VAT

- **The VAT number must be shown** [V]:
  - "It's mandatory that you display your VAT identification number on the eBay site in connection
    with your listings. This can be done by updating your business seller information page."
    https://www.ebay.co.uk/help/listings/default/vat-obligations-uk-eu?id=4650
  - The business seller policy also asks for "A VAT number, if the business's online activities are
    subject to VAT", plus "Clear information about price, including any shipping or delivery
    charges and tax".
    https://www.ebay.co.uk/help/policies/selling-policies/business-sellers-policy?id=4710
  - eBay asks that "Your business name matches the details on file with the responsible tax
    authorities" (help 4650) [V]. Use "Cambridge TCG Limited", as at Companies House [I].
  - Whether the number is already shown on the account is [U] (the profile returned 403).
- **The VAT number on our own website** [V]: The Electronic Commerce (EC Directive) Regulations 2002,
  reg. 6(1)(g), require "where the service provider undertakes an activity that is subject to value
  added tax, the identification number". Reg. 6(2) requires prices to "indicate whether they are
  inclusive of tax and delivery costs".
  https://www.legislation.gov.uk/uksi/2002/2013/regulation/6
  - This plainly reaches cambridgetcg.com. Whether a marketplace storefront counts as our own
    "information society service" is [I]; eBay requires the number anyway.
- **Prices to consumers include VAT** [V]:
  - Price Marking Order 2004, art. 4(1): a trader offering a product to a consumer "shall indicate the
    selling price". Art. 1(2) defines that as "the final price to be paid for a unit of a product ...
    including VAT and all other taxes".
    https://www.legislation.gov.uk/uksi/2004/102/article/4 ;
    https://www.legislation.gov.uk/uksi/2004/102/article/1
  - DMCC Act 2024 s.230(4): "the total price of a product includes any fees, taxes, charges or other
    payments that the consumer will necessarily incur" (in force since 6.4.2025).
    https://www.legislation.gov.uk/ukpga/2024/13/section/230
  - eBay: "All prices on eBay.co.uk will be displayed inclusive of UK VAT" (help 4650). And: "include
    VAT in the price. You may not add VAT to the final price after a buyer has won or bought an item"
    (help 4121).
- **Who accounts for VAT on UK-to-UK eBay sales: Cambridge TCG** [V]. eBay's table row "Inside UK |
  Any value | Inside UK" reads **"No"** under "eBay to collect UK VAT on sales" (help 4650).
- **VAT invoices to buyers: the seller issues them**, except where eBay collected the VAT:
  - [V] Where eBay collected the VAT, "eBay will issue the invoice to the buyer ... Sellers should not
    issue separate VAT invoices in these cases" (help 4650). That covers imports of £135 or less and
    EU orders up to €150, not our UK-to-UK sales [I].
  - [V] "Sellers may be required to collect VAT in cases where eBay is not obliged to collect VAT, for
    example if the buyer is a VAT registered buyer. In these cases, eBay will provide you with the
    buyer's details" (help 4650).
  - [V] HMRC, Notice 700 §16.2.1: "Whenever you supply standard-rated or reduced-rated goods or
    services to another VAT-registered person, you must give that person a VAT invoice". Also, "You
    do not need to issue VAT invoices for supplies to customers who are not VAT registered."
  - [V] §16.6.2: "If you make retail sales, you should give your customer a VAT invoice if asked for
    one." A simplified retailer's invoice is allowed up to £250.
  - [V] §16.2.2: "You must not issue VAT invoices for any goods sold under one of the VAT second-hand
    schemes". Margin sales use the margin invoice described in §5.
  - [S] eBay community posts describe printing an invoice with the VAT ID from Seller Hub ("print
    invoices and more"). This was not confirmed on an eBay help page.
    https://community.ebay.co.uk/t5/Business-Seller-Board/How-do-I-create-a-VAT-invoice-for-a-buyer/m-p/7534700
- **The VAT-rate field on listings** [V] (help 4650):
  - VAT-registered sellers may give "a gross price and separate VAT rate".
  - "Margin sellers may also leave the VAT rate blank".
  - For GB-to-EU sales (exports), eBay uses the rate "to calculate the net price displayed to buyers".
  - "eBay cannot legally apply margin schemes" where eBay itself collects VAT.
- **Making Tax Digital** [V]: "All VAT-registered businesses should now be signed up for Making Tax
  Digital for VAT." https://www.gov.uk/charge-reclaim-record-vat

## 4. Cardmarket

- **The operator and its tax IDs** [V]:
  - The English page translates the GTC "from 26/11/2026" (a future-dated version) of "Sammelkartenmarkt
    GmbH und Co. KG, Nordkapstr. 4, 10439 Berlin", "Sales tax identification number DE256122758".
    https://help.cardmarket.com/en/general-terms-and-conditions
  - Cardmarket also holds a UK VAT number: "Cardmarket's UK VAT Number: 378 6773 30".
    https://help.cardmarket.com/en/TaxRequirements
- **A VAT ID on the profile is not named; an About Us is required:**
  - [V] GTC §3: "As a commercial user, you also undertake to include a correct and complete About Us,
    General Terms and Conditions, a Privacy Policy, and a Withdrawal Form in your profile."
  - No Cardmarket page read today requires a UK seller's VAT ID on the profile. The Professional
    Seller Guide's VAT ID rules name only German and EU sellers.
    https://help.cardmarket.com/en/professional-seller-guide
  - Whether the profile already shows a VAT ID is [U] (403).
  - Putting the VAT number in the About Us imprint is the careful reading (E-Commerce Regs reg.
    6(1)(g), §3) [I].
- **The commission and how it is invoiced:**
  - [V] "You will receive payment, minus the 5% sales commission".
    https://help.cardmarket.com/en/SellingShipmentsFAQ
  - [V] GTC §5: "the Provider charges the seller with a fee depending on the value of the merchandise,
    which is directly withheld".
  - Whether Cardmarket's commission invoice to a UK professional shows German VAT, UK VAT or none is
    **[U]**. No public page says; the invoice needs a login.
  - [V] HMRC: for B2B services "the supply is made where the customer belongs" (Notice 741A §6.3).
    The reverse charge applies where "the place of supply is the UK", "the supplier belongs outside
    the UK" and "you belong in the UK", and "It applies if your supplier belongs outside the UK even
    if they have a UK VAT registration number" (§5.1).
    https://www.gov.uk/guidance/vat-place-of-supply-of-services-notice-741a
  - [V] The mechanics: "credit your VAT account with an amount of output tax, calculated on the full
    value of the supply ... and at the same time debit your VAT account with the input tax"
    (Box 1, Box 4, and the full value in Boxes 6 and 7; §5.2).
  - [V] If the supplier invoices UK VAT anyway, "you must still apply the reverse charge as it is not
    an optional adjustment" (§5.17).
  - [I] A Berlin company charging commission to a UK VAT-registered company is a reverse-charge
    service. On a £20 sale, commission is £1.00, with £0.20 output and £0.20 input: no net cost.
    German VAT on that invoice, if any, would not be reclaimable on the UK return. That is a question
    for the accountant.
- **UK-to-UK sales: Cambridge TCG accounts for the VAT:**
  - [V] Cardmarket collects UK VAT only "When a professional seller with a VAT ID number from outside
    of the United Kingdom sells to a private customer in the UK ... 135 £ per consignment" (Tax
    Requirements).
  - [V] HMRC: marketplaces are liable for imports of £135 or less and for "goods of any value that
    are located in the UK at the point of sale and sold by an overseas business".
    https://www.gov.uk/guidance/vat-and-overseas-goods-sold-to-customers-in-the-uk-using-online-marketplaces
  - [I] So for a UK-established seller shipping from UK stock, the VAT is Cambridge TCG's, as
    RESEARCH §7.2 inferred. The listed price is the VAT-inclusive price: GTC §7, "The respective item
    price is the final price, including any applicable VAT."
  - [V] B2B sales: "If one professional user sells to another professional, the seller has to issue an
    invoice on the buyer's request."
- **UK-to-EU sales:**
  - [V] Cardmarket: "When a professional seller from outside the EU sells to a private customer in the
    EU, the threshold is 150 € per consignment, excluding shipping. Cardmarket collects the VAT on all
    shipments costing less than 150 €, and sellers must add Cardmarket's IOSS number on the package /
    envelope". At €150 or more "the seller is responsible for the VAT". (Tax Requirements. The news
    of 24.12.2025 says "up to 150 euros"; the two wordings differ at exactly €150.)
    https://news.cardmarket.com/en/Magic/cardmarket-will-collect-vat-on-professional-to-private-imports-in-the-eu
  - [V] eBay does the same for "orders with a value up to EUR 150 ... shipped from outside of the EU
    to consumer buyers in the EU" (help 4650).
  - [I] Under EU law this makes the platform the deemed supplier. The articles were not read today.
  - **The UK side is an export** [V]: "Goods exported by post may be zero-rated if they are direct
    exports and you hold the necessary evidence of posting to an address outside the UK" (Notice 703
    §7.6). Acceptable evidence includes a stamped certificate of posting (C&E132 or P326) or a Royal
    Mail collection manifest. The goods must be exported, and the evidence obtained, within 3 months
    (§3.5, which has force of law). Keep it "for 6 years" (§6.7).
    https://www.gov.uk/guidance/vat-on-goods-exported-from-the-uk-notice-703
  - [V] Margin-scheme goods that are exported: "insert 'nil' in the VAT due column of your stockbook".
    https://www.gov.uk/guidance/check-if-you-can-use-a-vat-margin-scheme-if-you-import-from-or-export-to-countries-outside-the-uk
  - [V] That page also warns that a sale through an agent "acting in their own name" is two supplies.
    Cardmarket's GTC §7 says the contract is "between seller and buyer", which points to a direct
    export by us [I]. How the EU deemed-supplier rule sits with UK zero-rating is a question for the
    accountant.
- **The €3 EU duty from 1 July 2026:**
  - [V] The European Commission: "a temporary customs duty of €3 on items contained in these small
    parcels entering the EU ... from 1 July 2026", and "At the latest by November 2026, a handling fee
    will also apply" (Q&A, 26 March 2026).
    https://ec.europa.eu/commission/presscorner/api/files/document/print/en/qanda_26_736/QANDA_26_736_EN.pdf
  - [V] Cardmarket: buyers "will have to pay at least a three euro customs charge"; "Cardmarket is not
    involved in collecting or forwarding theses customs charges" (news, 08.06.2026).
    https://news.cardmarket.com/en/OnePiece/eu-customs-fee-on-imports-costing-less-than-150-euros
  - [V] eBay: "The customs duty applies per item type rather than per package". eBay International
    Shipping collects it at checkout (help 4121).
  - [I] On Cardmarket, an EU buyer of a €5 single from us pays the price, EU VAT and at least €3 at
    pickup. EU sellers carry none of that, so EU demand for our low-value singles will be thin.
- **Switzerland** [V]: "Swiss law requires platforms like Cardmarket to collect and forward 8,1% VAT on
  all sales shipped to Switzerland or Liechtenstein" (Tax Requirements). The UK side is again an
  export [I].

## 5. The second-hand margin scheme: eligibility, records, pricing (no scheme chosen here)

**Notice 718 is withdrawn.** The task named "Notice 718 and 718/1".
- [V] Notice 718 ("The Margin and Global Accounting Scheme") was "withdrawn and has been replaced by
  updated guidance" on 2021-12-23. Its replacements are https://www.gov.uk/vat-margin-schemes and
  https://www.gov.uk/guidance/using-the-global-accounting-vat-margin-scheme. (The withdrawal notice
  was read through the content API for `/guidance/the-margin-and-global-accounting-scheme-vat-notice-718`.)
- [V] **Notice 718/1 is not about cards.** It is "The VAT Margin Scheme on second-hand cars and other
  vehicles" (HMRC manual VATMARG01050), so it does not apply.

**Eligibility:**
- [V] "You can choose to use a margin scheme when you sell: second-hand goods ... collectors' items".
  "You cannot use a margin scheme for: any item you bought for which you were charged VAT".
  https://www.gov.uk/vat-margin-schemes
- [V] Second-hand goods are "Goods that can still be used, or which could be used after repair". The
  legal definition in the Special Provisions Order 1995 is "tangible movable property that is
  suitable for further use as it is or after repair".
- [V] HMRC's staff manual adds: "In borderline cases, it might help to look to the purpose of the
  relief and consider whether the goods have previously borne irrecoverable VAT".
  https://www.gov.uk/hmrc-internal-manuals/vat-margin-schemes/vatmarg02100 . The manual's
  introduction (VATMARG01050) says it "should not be relied upon by businesses".
- [V] Collectors' items are pieces "of zoological, botanical, mineralogical, anatomical, historical,
  archaeological, palaeontological, ethnographic, numismatic or philatelic interest" (VATA 1994
  s.21(5)(c), https://www.legislation.gov.uk/ukpga/1994/23/section/21). gov.uk adds: "Not all items
  that can be collected are eligible".
- **What this means for each kind of stock** [I]:
  - Modern trading cards fit "second-hand goods" more naturally than "collectors' items".
  - A single bought from a private individual is a used good that has already borne irrecoverable VAT
    in the consumer's pack, so it reads as margin-eligible.
  - **Not eligible:** a single Cambridge TCG pulls from sealed product it bought with VAT.
  - **Not eligible:** sealed product from distributors, invoiced with VAT. It is standard-rated, and
    its input VAT is reclaimable.
  - **Not eligible:** goods Cambridge TCG imports itself, such as Japanese product from Japan. [V] "You
    cannot use a margin scheme when you ... import goods other than works of art, collectors' items
    or antiques into the UK."
    https://www.gov.uk/guidance/check-if-you-can-use-a-vat-margin-scheme-if-you-import-from-or-export-to-countries-outside-the-uk The import VAT is ordinary reclaimable input tax [I].
  - Whether HMRC accepts the singles reading is for the accountant, or for an HMRC ruling ([V]
    "Contact HM Revenue and Customs (HMRC) if you're not sure about a particular item").

**Records (the margin scheme; [V], https://www.gov.uk/vat-margin-schemes, keeping-records part):**
- **The scheme is optional.** "You can start using a margin scheme at any time by keeping the correct
  records ... You do not have to register."
- **Stockbook.** "a stockbook that tracks each item sold under the margin scheme individually". For
  each item it records:
  - the stock number, purchase date, purchase invoice number, purchase price and "Name of seller";
  - the sale date, sales invoice number, selling price and "Name of buyer";
  - the description, the margin, and the "VAT due (16.67% or one-sixth)".
- **Purchase invoice** (when buying from a private person, you may write it yourself): the date,
  "seller's name and address", your name and address, the invoice number "unless you made out the
  purchase invoice yourself", a description, and the "total price".
- **Sales invoice to the buyer:**
  - your name, address and VAT number;
  - the buyer's name and address;
  - the stockbook number, the invoice number and a description;
  - "total price - you must not show VAT separately";
  - the words "margin scheme - second hand goods".
- **Keeping and losing records.** Keep them for 6 years. "You'll have to pay VAT on the full selling
  price of each item if you do not meet all the scheme's requirements."
- **Overheads.** These can't go into the margin; reclaim them normally. That includes eBay fees,
  Cardmarket's reverse charge, and packaging.
- **The VAT return.** Box 1 gets the margin VAT. Box 6 gets the full selling price less the margin
  VAT. Box 7 gets the full purchase price.

**Global Accounting (simplified; [V],
https://www.gov.uk/guidance/using-the-global-accounting-vat-margin-scheme):**
- **What it is.** It is for those who "buy and sell bulk volume, low value goods" or "are unable to
  maintain the records required of a standard margin scheme". VAT is due on total eligible sales minus
  total eligible purchases for the period, times 1/6.
- **Item limit.** "You cannot use the scheme if an individual item has a purchase value of over £500."
- **Bulk lots.** These may be split and sold separately. Records must be "up to date and clearly
  distinguishable from any other records"; the description must be specific ("'assorted goods' is
  not acceptable").
- **Losses.** "You must carry the negative margin forward". A closing adjustment is due when you
  leave the scheme.
- **Exports** are taken out of the scheme's purchase total.

**Why the choice matters for marketplace prices** [I]:
- Cardmarket sorts offers "by the lowest price first regardless of the seller's status" ([S], RESEARCH
  §7.2, fact-checked 2026-10-20). A private or unregistered seller's £20 price is all theirs. A
  standard-rated £20 price gives up £3.33.
- The margin scheme narrows that gap, the most where the buy-in was close to the sale price.
  Standard-rated sealed product competes with other VAT-registered shops on the same footing.
- The scheme sets a price floor per card, so it shapes every "fair price" claim in the marketing kit.
- eBay's VAT-rate field (§3) only changes what EU buyers see. UK buyers always see one VAT-inclusive
  price.

## 6. The scanner app, and parcel coupons

**App sales: the stores account for UK VAT:**
- [V] HMRC: "If you supply digital services to consumers via a third party platform or marketplace,
  the digital platform is responsible for accounting for VAT on the supply instead of you."
  https://www.gov.uk/guidance/the-vat-rules-if-you-supply-digital-services-to-private-consumers
- [V] Google Play: "As the merchant of record for transactions with customers in the United Kingdom,
  Google is responsible for determining, charging and remitting VAT for all paid apps and in-app
  purchases of digital content and services by UK customers using Google Play's billing system."
  Also: "If you are based in the United Kingdom, local VAT will not apply to the service fee payable
  from you to Google but you may need to self-assess VAT."
  https://support.google.com/googleplay/android-developer/answer/138000?hl=en-GB
  - [I] "Self-assess" means the reverse charge on Google's fee (Notice 741A §5).
- [V] Apple's Developer Program License Agreement (DPLA dated October 13, 2026; the Exhibits to
  Schedules 2 and 3 quoted here last updated August 27, 2026):
  - Exhibit A §2, which serves Schedules 2 and 3 (paid apps): "You appoint Apple Distribution
    International Ltd., as Your commissionaire", with "United Kingdom" listed.
  - Exhibit B §1: "If taxes apply, Apple shall collect and remit to the competent tax authorities the
    taxes ... located in the following regions", with "United Kingdom" listed.
  - https://developer.apple.com/support/terms/apple-developer-program-license-agreement/
- [I] Cambridge TCG's own supply is then to the store as a business, not to UK consumers. How it goes
  on the VAT return is for the accountant.
- [I] Selling subscriptions directly on the web, for example by card on cambridgetcg.com, would make
  Cambridge TCG the supplier, charging UK VAT at 20%.

**Coupons and parcel inserts (eBay coded coupons, ASSETS M7):**
- [V] Notice 700/7 §7.2: "there is no VAT due on the coupon provided the goods themselves are sold at
  their normal price."
- [V] At redemption, VAT is due on "the amount due from the customer" (§7.3). Notice 700 §7.3.2(a):
  "the tax value is based on the discounted amount".
- [V] A free gift in the parcel needs no output VAT while gifts to one person cost no more than "£50,
  excluding VAT, in any 12-month period" (Notice 700/7 §2.3).
  https://www.gov.uk/guidance/business-promotions-and-vat-notice-7007
- [I] Under the margin scheme a coupon lowers the selling price, and so the margin.

---

## What changes in our docs

1. **RESEARCH.md §7.1, fees bullet.** Replace "Without VAT registration (status unknown), the effective
   final value fee is about 13.1% [I]" with:
   > Cambridge TCG is VAT-registered (Yu, 2026-10-22). eBay (UK) Limited adds UK VAT at 20% to
   > business fees [I], and that VAT is reclaimable input tax [I]. The fee cost is therefore net: 10.9% +
   > £0.40 per order over £10 + 0.35%, or £2.65 on a £20 order (13.25%). Registration's real cost is
   > output VAT on the sale: £3.33 of a £20 standard-rated price, or 1/6 of the margin under the
   > margin scheme.

   (At filing: the two [I] tags were added. Both steps are inferences built from [V] facts, and the
   filed RESEARCH §7.1 tags them [I], for the accountant.)
2. **RESEARCH.md §4.2 State; §7.1 and §7.2 "Presence".**
   - The usernames are eBay "cambridgetcg" and Cardmarket "cambridgetcg" (Yu's word).
   - The profiles still answer 403, so they are unobserved. (At filing: the eBay profile was
     observed by a separate run; see [ebay-account.md](ebay-account.md).)
   - Companies House confirms CAMBRIDGE TCG LIMITED, 15680297, Active (§1). Drop "unverified" from the
     company number in ASSETS M1.
3. **RESEARCH.md §4.2 table, eBay row.** Add "VAT at 20% is added to business fees and is reclaimable
   by a VAT-registered seller". Delete the "cost a fifth more" assumption in README §10. Mark
   verify-marketplaces row 2's "13.08%" as superseded.
4. **RESEARCH.md §6.7.** VAT status is answered. Still only Yu's: the VAT number, the effective date and
   the scheme.
5. **RESEARCH.md §7.2, tax bullet.**
   - UK-to-UK VAT is Cambridge TCG's: upgrade to [V] using HMRC's marketplace guidance and eBay's table.
   - Add: Cardmarket and eBay collect EU VAT on B2C sales of €150 or less. The UK side is a zero-rated
     export only with proof of posting within 3 months.
   - Add: Cardmarket's 5% commission is a reverse-charge service.
   - Add: Switzerland is collected by Cardmarket.
6. **ASSETS M1 (eBay business-seller information).**
   - Change "the VAT number if registered" to **"the VAT number (eBay: 'mandatory')"**.
   - The business name must match HMRC and Companies House: "Cambridge TCG Limited".
   - Add "Registered in England and Wales" once confirmed (§1, [I]). (At filing: confirmed by the
     certificate of incorporation, §1.)
7. **ASSETS M4 (Cardmarket About Us).** Add the VAT number to the imprint, after the company name, number
   and registered office.
8. **ASSETS, rules for every asset.** Add one: **consumer prices are VAT-inclusive. Never "+VAT", and
   never add VAT after the sale** (PMO 2004 art. 4; DMCC s.230(4); eBay help 4121; Cardmarket GTC §7).
   Price comparisons in copy must compare like with like.
9. **ASSETS M7 (parcel insert).** Add one line: the coupon itself carries no VAT, VAT is due on the
   discounted amount, and free gifts are limited to £50 per person per year.
10. **SCANNER.md.** Add: the stores account for UK VAT on app sales and in-app purchases. Google's
    service fee may need self-assessment (the reverse charge). Direct web sales would carry our own
    20% UK VAT [I]. (At filing: this first said the fee "is self-assessed"; Google's page says "you
    may need to self-assess VAT".)

## Questions for Yu and the accountant

1. **The VAT basics.** What is the VAT number, and what is the effective date of registration? Is
   the number already in eBay's business-seller information, and does the name on HMRC's record read
   "Cambridge TCG Limited"?
2. **The scheme, by stock type.** Which treatment should each kind of stock get: standard rating
   only, the item-by-item margin scheme, or Global Accounting? The stock types are singles bought
   from private sellers, singles pulled from our own VAT-invoiced sealed product, sealed product, and
   our own imports. What purchase records already exist for stock bought before registration?
3. **Commission invoices.** Do Cardmarket's commission invoices show German VAT, UK VAT or none? Is
   the reverse charge being entered (and later, Google's service fee)?
4. **EU and Swiss sales.** Do we ship to the EU or Switzerland at all? If so, how are these sales
   treated on the UK return: IOSS deemed-supplier sales via Cardmarket and eBay, and zero-rating with
   proof of posting? Does the €3-per-item duty make EU singles worth keeping?
5. **Invoices per order.** Under the chosen scheme, which invoice does each marketplace order need: a
   margin invoice to every buyer, or a VAT invoice to VAT-registered buyers? Which tool issues it?

## Gaps

- Neither marketplace account was observed (403 on both). So it is [U] whether the VAT number,
  business details or About Us are already shown.
- Cardmarket's fee table (403) and its commission invoices (login) were not read. The VAT treatment of
  the commission as invoiced is [U].
- eBay's Seller Hub fee invoice and VAT-invoice tooling were not seen (login). Only community posts
  [S] were found.
- The EU deemed-supplier articles (VAT Directive) were not read. Their link to UK export zero-rating
  is [I].
- No HMRC ruling on trading cards as "second-hand goods" was found. Eligibility is [I].
- The customs classification of trading cards (heading 9504 or 9705) was not checked [U].
