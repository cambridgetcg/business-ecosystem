# eBay UK seller `cambridgetcg`: public presence, observed 2026-10-22

Written 2026-10-22 by a Claude Code research agent (a workflow subagent) for Yu. It is an agent's
research, not Yu's decision, and not tax or legal advice. Read-only observation as an anonymous
visitor: no login, no account, no clicks on consent or contact buttons, no forms, no messages.

Filed in the repo on 2026-10-22. For filing, paths to the agents' working files were removed, and
the few changes made then are marked "(at filing)". Raw captures were saved but are not filed.
Notes from the same day: [cardmarket-account.md](cardmarket-account.md), [vat.md](vat.md), and the
draft texts in [marketplace-texts.md](marketplace-texts.md). RESEARCH §7.6 summarises all four.

**Labels.** [V] read on a primary source on 2026-10-22 (URL given). [O] observed on the account's
own public eBay pages on 2026-10-22 (URL, method, time). [S] secondary source (here: earlier agent
notes). [I] my inference. [U] unknown.

**Account identity.** Yu, 2026-10-22:
"eBay: cambridgetcg cardmarket: cambridgetcg 😂 yes VAT registered."
This note covers the eBay account only.

**How this was observed, said plainly** (at filing). A script drove a headless browser. The first
load in each fresh browser context got a 403 bot wall from eBay. The run then used new browser
contexts and warm-up loads of eBay's home page until account pages loaded, and it stopped at a
captcha (§1). eBay's User Agreement bars "any robot, spider, scraper, data mining tools, data
gathering and extraction tools, or other automated means to access our Services for any purpose,
except with the prior express permission of eBay" [V,
https://www.ebay.co.uk/help/policies/member-behaviour-policies/user-agreement?id=4259; saved
capture, not filed]. Agents won't repeat this. Further checks of either account should be Yu's own
logged-in look: Yu can paste or screenshot what the profile shows. The facts below were observed,
and they stay labelled [O].

## 1. Methods and outcomes

Tool: Playwright 1.64.1 driving Chromium 156 (headless, new headless mode), installed in a
temporary folder. Each run used a fresh, non-persistent browser context (no profile on disk, no Yu
cookies or keychain). Settings: viewport 1366x900, locale en-GB, timezone Europe/London, a desktop
Chrome user agent. The script waited 9-13 s between pages and clicked nothing; the cookie banner was
left untouched. It stops at any "Security measure" or captcha page. In total there were 13 page
loads on eBay hosts over about 10 minutes.

| Time (UTC) | URL | HTTP | Page title | Outcome |
|---|---|---|---|---|
| 19:37:06 | https://www.ebay.co.uk/usr/cambridgetcg | 403 | Error Page \| eBay | "SORRY / Something went wrong on our end", plus a bot-sensor script. A bot wall, not a captcha |
| 19:37:43 | https://www.ebay.co.uk/ (warm-up) | 403 | Error Page \| eBay | same wall |
| 19:38:14 | https://www.ebay.co.uk/usr/cambridgetcg | **200** | cambridgetcg on eBay | profile read |
| 19:39:52 | https://www.ebay.co.uk/ (warm-up, new context) | 403 | Error Page \| eBay | |
| 19:40:27 | https://www.ebay.co.uk/sch/i.html?_ssn=cambridgetcg&_ipg=240 | 403 | Error Page \| eBay | seller search blocked |
| 19:40:56 | https://www.ebay.co.uk/itm/820050875670 | **200** | OP01-003 Luffy Alt Art Leader Japanese Mint \| eBay UK | one listing read |
| 19:41:28 | https://www.ebay.co.uk/fdbk/feedback_profile/cambridgetcg | **200** | Feedback profile | feedback page 1 of 19 read |
| 19:43:40 | https://www.ebay.co.uk/ (warm-up, new context) | 403 | Error Page \| eBay | |
| 19:44:09 | https://www.ebay.co.uk/usr/cambridgetcg?_pgn=2 | **200** | cambridgetcg on eBay | profile page 2 read |
| 19:44:42 | https://itm.ebaydesc.com/itmdesc/820050875670?... (description iframe) | **200** | eBay | description read |
| 19:44:59 | https://www.ebay.co.uk/sch/i.html?_ssn=cambridgetcg&_rss=1 (RSS) | 403 | Error Page \| eBay | RSS blocked |
| 19:46:42 | https://www.ebay.co.uk/ (warm-up, new context) | 403 | Error Page \| eBay | |
| 19:47:15 | https://www.ebay.co.uk/help/policies/selling-policies/selling-practices-policy/business-seller-policy?id=4710 | 200 after redirect | **Security measure \| eBay** | redirected to `/splashui/captcha`. The script stopped and no further eBay requests were made; the captcha was not attempted |

- The first request in each new context drew a 403. The next page in the same context often loaded
  [O]. My guess is that the sensor script on the 403 page sets cookies, but that is untested [I].
- Not tried, because method 1 worked: web.archive.org and search-engine results.
- **The session was localised to Japan, not the UK** [O, listing page]:
  - the page script carries `"shipToLocation":"100-0001"`;
  - the delivery estimate reads "to 100-0001";
  - the JSON-LD shipping destinations are JPN and GBR;
  - the financing line was in Japanese ("PayPal Creditで£12.56を24ヶ月間").

  So eBay most likely geolocated this machine's exit IP to Japan [I], perhaps through a VPN. I did not
  check this. As a result, the postage and price shown are what a Japan-located visitor sees.

## 2. Observed facts

### Profile (https://www.ebay.co.uk/usr/cambridgetcg, Playwright, 19:38Z; page 2 at 19:44Z)

| Fact | Value (verbatim where quoted) | Label |
|---|---|---|
| Feedback | "100% positive Feedback (340)" | [O] |
| Items sold | "950 items sold" | [O] |
| Followers | "144 followers" | [O] |
| Active listings | "Search all 87 items" (search-box placeholder). Page 1 showed 48 and page 2 showed 39, which adds to 87 | [O] |
| About text | "Minty and authentic cards imported from Japan :)" | [O] |
| Location | "Location: United Kingdom" | [O] |
| Member since | "Member since: 01 Nov, 2023". The feedback page has "01-Nov-23 in United Kingdom" and the listing page "Joined Nov 2023" | [O] |
| Avatar / logo | A stylised blue mark with the words "Cambridge TCG" (from the screenshot). Image id `NksAAOSw-p1nIXMN` | [O] |
| Tabs | "Shop", "About", "Feedback". The Shop tab is the profile's built-in shopfront | [O] |
| Paid eBay Shop | https://www.ebay.co.uk/str/cambridgetcg returned 410 in earlier research. Not re-requested on 2026-10-22 | [S, RESEARCH §7.1, 2026-10-20] |
| Seller categories | Only "Collectable Card Games" under "Collectables" | [O] |
| "Business seller" badge on profile | none shown. No business, VAT or registered-address text anywhere in the profile HTML | [O] |
| Vacation or away notice | none ("vacation" and "away" absent from the HTML) | [O] |
| Feedback ratings, last 12 months | Positive 83, Neutral 0, Negative 0 | [O] |
| Detailed seller ratings, 12-month average | Accurate description 5.0, Reasonable postage cost 5.0, Delivery time 5.0, Communication 5.0 | [O] |

### Feedback page (https://www.ebay.co.uk/fdbk/feedback_profile/cambridgetcg, Playwright, 19:41Z)

| Fact | Value | Label |
|---|---|---|
| Positive by period | 1 month **16**, 6 months **30**, 12 months **83**. No neutral or negative in any period | [O] |
| Number of detailed ratings | Accurate description (25), Reasonable postage cost (25), Delivery time (28), Communication (27) | [O] |
| Totals | "457 Feedback received (viewing 1-25)", "Revised feedback: 0", "eBay automated feedback: 48", "Page 1 of 19". The listing page shows "Seller Feedback (404)" | [O] |
| Items in the 25 newest entries | All One Piece. Sold prices ran from £6.50 to £321.88, median £21.96. Top two: "Shanks Manga OP09-004 Mint Condition" £321.88 and "Rayleigh Manga OP08-118 Alt Art" £245.00 | [O] |
| Past auctions | Entries such as "Lot 20. One Piece Card Game English Leaders Bundle Auction. £1 start no reserve." (Lots 3, 20-23) | [O] |
| Tone of comments | Packing and speed: "packaged safely and shipped same day", "all top loaded", "item was delivered next day". Buyer handles and locations are left out here | [O] |

- Score 340 against 404 and 457 entries: the score counts each buyer once, so repeat buyers and
  feedback received as a buyer explain the gap [I, the usual eBay rule; not read on 2026-10-22].
- Pace: 53 of the 83 positives came 6-12 months ago, and 16 of the latest 30 came in the last month.
  So sales slowed in the middle of 2026 and are picking up again [I]. Feedback lags sales, and not
  every buyer leaves it.
- Some sold prices have odd pennies (e.g. £93.56, £100.29). They may have been converted for the
  Japan-localised view [U].

### Listings: what is sold (profile pages 1-2; 52 distinct listings seen out of 87)

- **Game.** All 52 are the One Piece Card Game (Bandai) [O]. No Pokémon, Magic, Yu-Gi-Oh! or
  Lorcana appeared in active listings or in the latest 25 feedback entries [O for what was seen].
- **Language.** 37 titles say Japanese, JP, Jap or Japan, 5 say English and 10 say neither [O, my
  count of the titles]. (At filing: a recount found 35 "Japanese" or "JP", one "Jap" and one
  "Japan"; this line first said "Japanese or JP".)
- **Product types** [O]:
  - singles, mostly "Alt Art", "Parallel", "SP", "SEC", leaders, "Wanted Poster", Gold Text
    (Anime 25th Collection) and promos;
  - one "OP03-001 Ace Sealed Promo Leader" at £28, a single promo card still in its pack;
  - no graded slabs (PSA, CGC or BGS) and no sealed booster boxes among the 52.
- **Asking prices (52 seen)** [O]:
  - range £5.00 to £268.00, median £28.00;
  - 21 at £20 or less, 27 between £20 and £100, and 4 above £100: £268, £135, £128 and £248
    (OP05-119 Wanted Poster SP);
  - the top three on page 1: "OP01-003 Luffy Alt Art Leader Japanese Mint" £268.00, "One Piece OP09
    Monkey.D.Luffy Wanted Poster SP OP05-119 Japanese" £248.00, "One Piece TCG Kaido Alt Art Leader
    OP01-061" £128.00.
- **Condition.** Every card on profile page 1 carries eBay's normalised condition "Pre-owned" (48 of
  48 in the page JSON) [O].
- **Format.** No bids, auction timers or Best Offer appeared on the profile cards [O]. Only the one
  listing below was confirmed as Buy It Now.
- **Title style** [O; I for the judgement]:
  - The format is inconsistent. Some titles are short codes ("OP13-054 Yamato Alt Art Japanese");
    others are keyword-heavy ("Bandai One Piece CCG Enel OP05-100 Awakening New Era SP Full Art Foil
    JP").
  - Casing and order vary: "japanese" or "Japanese", "Jap", "JP", "JDM", "! NM!".
  - One title carries Chinese characters ("OP14-096 浸食輪迴 Alt Art Japanese").
  - This looks like hand-written titles with no template [I].
- **Photo style** [O, screenshots]:
  - real photos of the actual card, not stock images;
  - most are shot on a red cloth backdrop, some on a dark background in a sleeve or toploader;
  - one is on a white surface with the Cambridge TCG logo on a stand behind it;
  - no watermarks or text overlays were visible.

### One listing in full (https://www.ebay.co.uk/itm/820050875670, Playwright, 19:40Z)

| Field | Value (verbatim) | Label |
|---|---|---|
| Title | "OP01-003 Luffy Alt Art Leader Japanese Mint" | [O] |
| Seller line | "cambridgetcg (340) · **Private**" | [O] |
| About this seller | "Joined Nov 2023", "**Registered as a private seller**", "Thereby, consumer rights stemming from EU consumer protection law do not apply. eBay buyer protection still applies to most purchases." | [O] |
| Business seller information panel | **Absent.** No legal name, address, VAT number, email or phone is shown; the VAT-rate table has no rows | [O] |
| Price | £266.17 on this page (JSON-LD `"priceCurrency":"GBP","price":"266.17"`). The profile showed £268.00 for the same item. The cause is unknown; it may be the Japan localisation | [O] / [U] |
| Format | "Buy It Now"; "3 have added this to their Watchlist" | [O] |
| Condition | "Ungraded - Near mint or better: Not in original packaging or professionally graded" | [O] |
| Item specifics | Rarity Parallel; Game One Piece CCG; Set OP01; Character Monkey D. Luffy; Language Japanese; Manufacturer BANDAI; Card Number OP01-003; Card Type Leader; Country of Origin Japan; **Features "Back scuffs/chips"** (the title says "Mint") | [O] |
| Photos | "Picture 1 of 10" | [O] |
| Description | Only the title again: "OP01-003 Luffy Alt Art Leader Japanese" (iframe on itm.ebaydesc.com). This is the one description read | [O] |
| Item location | "Located in: Cambridge, United Kingdom" | [O] |
| Postage to the UK | £0.00 to GBR in the JSON-LD (free UK postage). The UK service name was not visible, because the page was localised to Japan | [O] / [U] |
| Postage abroad | "£3.80 Royal Mail International Standard" to Japan; "Royal Mail International Tracked" also appears in the page data | [O] |
| Returns | "**No returns accepted.**" | [O] |
| Payments | PayPal, Google Pay, Visa, Mastercard, Diners (logos) | [O] |
| Last revised | "Last updated on 20 Sep, 2026 10:07:35 BST" | [O] |
| Category | Collectables > Collectable Card Games > CCG Individual Cards | [O] |

## 3. What this suggests (inference, not legal or tax advice)

- **The account matches Cambridge TCG** [I]. Several things point the same way:
  - the logo reads "Cambridge TCG";
  - the location is Cambridge, United Kingdom;
  - the account sells steadily: 950 items sold and 87 listed;
  - Yu named it.
- **The registration doesn't match the business** [O + I]:
  - Yu says the business is VAT-registered.
  - eBay shows the account as "Registered as a private seller", with no business seller panel, no
    VAT number and "No returns accepted".
  - Earlier research recorded eBay's business seller policy (help 4710, read 2026-10-20) as follows
    [S, research/2026-10-20/ebay.md §5]:
    - "anyone buying to resell must register as a business";
    - business sellers show "Full contact details for the business" and a VAT number if
      registered;
    - business sellers offer the 14-day cancellation right.
  - I could not re-read that policy, because the captcha in §1 stopped me. (At filing: a separate
    run read help 4710 with curl the same day; see [vat.md](vat.md) §3. It says an eBay seller "must
    register as a business if, for example, they sell items they have bought to resell", and
    "Business sellers can't represent themselves as private individuals" [V,
    https://www.ebay.co.uk/help/policies/selling-policies/business-sellers-policy?id=4710].) If the
    account sells the company's stock, its private registration looks inconsistent with that
    policy, and possibly with UK consumer-protection rules on traders [I, not verified].
  - Innocent explanations are possible [U], for example:
    - the account is Yu's personal account, separate from the company;
    - a switch to business is under way.
  - Only Yu can say which. A solicitor or accountant, not this note, should settle what follows.
- **Fees would change** [S + I]. UK private sellers pay no final value fee, but business sellers pay
  10.9% plus a per-order fee plus 0.35% (RESEARCH §4.2 [S]). Moving to a business account would
  change the margin on every sale. Whether VAT on eBay's fees could be reclaimed is a question for
  an accountant [U]. (At filing: eBay's "Fees for private sellers" page, read the same day, says
  "It's now free for UK-based private sellers to sell on eBay ... You won't pay final value fees or
  regulatory operating fees when your items sell" [V,
  https://www.ebay.co.uk/help/selling/fees-credits-invoices/understanding-invoice?id=4822]. The
  business fees are "exclusive of VAT" [V,
  https://www.ebay.co.uk/help/selling/fees-credits-invoices/fees-business-sellers?id=4809]. This is
  cost information for Yu and an adviser, not a finding about anyone's conduct.)
- **For the marketplace kit (ASSETS.md §M)** [I]:
  - What already works: a logo avatar, a one-line About text, real photos and strong feedback.
  - Gaps: titles without a template, a description that only repeats the title (the one read), and
    a "Mint" title on a card listed with back scuffs.
  - Coupons, sale events, order discounts and multi-buy have been closed to private sellers since
    20 January 2025 [S, research/2026-10-20/ebay.md §4, citing eBay help 4090].
  - Promoted Listings are limited to "Above standard and Top rated sellers with recent sales
    activity" [S, RESEARCH §7.1]. This account's seller level was not shown publicly [U].

## 4. Gaps

- 35 of the 87 listings are unseen. The two profile pages overlapped by 35 items (48 + 39 cards, 52
  distinct), so the full price range, conditions and formats are unconfirmed [U].
- The seller search (`_ssn=cambridgetcg`) and its RSS variant both returned 403 [O]. No listing
  count from search.
- No UK-localised view of postage. The session was localised to Japan, so the UK domestic service
  name and dispatch time are unknown [U]. Postage on the other 86 listings is unknown [U].
- Returns: "No returns accepted" was seen on one listing only. Whether it is account-wide is unknown
  [U]. Private or business status is account-level on eBay [I].
- eBay's business seller policy (help 4710) was not re-read by this run: captcha. (At filing:
  [vat.md](vat.md) §3 read it.) The legal and fee consequences above are unverified inferences.
- Who owns the account (the company or Yu personally), the VAT scheme and the VAT number are
  unknown [U].
- Feedback split by role (as buyer, as seller): the tabs exist, but counts weren't shown in the
  default view [U].
- History: web.archive.org and search engines were not tried, so earlier states of the account
  (e.g. ever a business account, past Shop) are unknown [U].
- Company 15680297 (Cambridge TCG Limited): not checked by this run [U]. (At filing:
  [vat.md](vat.md) §1 read it at Companies House.)

## 5. Captures (saved, not filed)

- Each page was saved as `.html`, `.txt` (visible text) and `.png` (full-page screenshot): the
  first profile load (403), the profile, profile page 2, the listing, its description, the feedback
  page, the seller search and RSS (403), the home-page warm-ups (403) and the help 4710 captcha page.
- Two crops of the screenshots, and a per-run log of URL, status, title and time.
- The observer script was not filed either.
