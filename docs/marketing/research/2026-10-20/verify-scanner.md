# Fact-check: One Piece scanner research notes

A Claude Code fact-checker wrote this on 2026-10-20 for Yu (Cambridge TCG Limited). It is an agent's check, not Yu's decision.
**It is research, not legal advice.** Where law comes up, it says only what the text says.

**Notes checked**
- `mkt2/scanner-market.md` (abbreviated **M**)
- `mkt2/scanner-rules.md` (**R**)
- `mkt2/app-launch.md` (**L**)

**Method.** The checker chose 25 load-bearing claims and went back to each primary source, without relying on the note's quote. It then tried to refute each one. A further 20 spot checks follow the table.
- Pages were fetched with `curl`, and the text was extracted locally. Raw files are in `mkt2/vs/`.
- Two eBay help pages block scripted reads. Those were read through the WebFetch summariser, so their quotes come from a model's summary, and the table marks them that way.
- Everything was read-only. No logins, accounts, posts or purchases.
- Every source was fetched on **2026-10-20**.

**Verdicts**
- **confirmed:** the source says what the note says.
- **corrected:** the substance holds, but a detail, scope or date is wrong.
- **refuted:** the source contradicts the claim.
- **unverifiable:** the primary source could not be reached.

## Counts

| | Main table (25) | Spot checks (20) |
|---|---|---|
| confirmed | 16 | 19 (S18 also corrects L) |
| corrected | 5 | 1 |
| refuted | 2 | 0 |
| unverifiable | 2 | 0 |

---

## Main table

| # | Claim (as the note states it) | Note:section | Verdict | What the source actually says (fetched 2026-10-20) | URL |
|---|---|---|---|---|---|
| 1 | Apple App Review Guidelines last updated 16 Oct 2026. 2.3.14 is a new rule on creative assets: no "references to other apps with an intent to mislead, unverifiable product claims, or specific or discounted pricing information". | R §1.3; L §1.3 | confirmed | The page reads "Last Updated: October 16, 2026". Apple's news item of 16 Oct 2026 says "2.3.14: New guideline covering creative assets". The quoted text is verbatim. | https://developer.apple.com/app-store/review/guidelines/ ; https://developer.apple.com/news/ |
| 2 | Apple naming rules: 4.1(c) bars "another developer's icon, brand, or product name in your app's icon or name, without approval from the developer". 2.3.7 caps names at 30 characters and bars packing metadata with trademarked terms. 5.2.1 bars protected third-party material without permission. | R §1.3; M §4a; L §1.3 | confirmed | All three are verbatim. 2.3.7 also says subtitles must not "reference other apps, or make unverifiable product claims". | https://developer.apple.com/app-store/review/guidelines/ |
| 3 | Apple 5.2.2: if the app displays content from a third-party service, the developer must be "specifically permitted"; "Authorization must be provided upon request". | M §2c; R §5.4; L §1.3 | confirmed | Verbatim. The guidelines page **does** carry a date (16 Oct 2026). M §2c says no date was captured; that is resolved. | same |
| 4 | Apple 4.3(b) rejects apps "indistinguishable from what's already widely available". | L §0.1; R §1.3 | confirmed | Verbatim. It goes on to say saturated categories need a "meaningfully different" offer. | same |
| 5 | Apple 2.3.3: more than half the screenshots for each device must show the app in use. | R §1.3; L §5 | confirmed | The guideline-reference page says App Review "will approve only those submissions where more than half of screenshots show the app in use". This is the hard constraint behind the card-art question. | https://developer.apple.com/help/app-review/guideline-reference/2-3-3-screenshots |
| 6 | Apple screenshots.<br>• Required: one set for "iPhone with Dynamic Island (medium display)", at 1179×2556 or 1206×2622.<br>• Large display: 1260×2736, 1290×2796 or 1320×2868.<br>• iPad 13-inch: required if the app runs on iPad.<br>• No alpha.<br>• iPhone Duo: 1398×2034 outer and 2007×2853 inner, required from April 2027 for apps built with the iOS 27.1 SDK. | R §6.1; L §5 | confirmed | All sizes and rules match. Caveat: Apple's page contradicts itself. Its "Required device sizes" list names only the medium iPhone slot. Its Face ID (large display) row still says "Required if app runs on iPhone and screenshots for iPhone with Dynamic Island (large display) aren't provided". L's [U] on this point is fair. Apple's news says iPhone Duo goes on sale 23 Oct 2026. | https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications ; https://developer.apple.com/news/ |
| 7 | App preview accepted resolution is 886×1920 portrait for the 6.1"–6.9" classes and iPhone Duo. | R §6.1; L §5 | confirmed | 886×1920 portrait and 1920×886 landscape are accepted for iPhone Duo and for the Dynamic Island and Face ID classes, large and medium. | https://developer.apple.com/help/app-store-connect/reference/app-information/app-preview-specifications |
| 8 | Play store icon: 512×512, 32-bit PNG, ≤1024 KB, full square, "Radius will be equivalent to 30% of icon size", no drop shadow. | R §6.2; L §5 | confirmed | Verbatim, including 30%. The icon page shows "Last updated 2026-10-20 UTC", so L's source list ("updated 2026-06-15") is out of date. | https://developer.android.com/distribute/google-play/resources/icon-design-specifications |
| 9 | Play screenshots and feature graphic.<br>• Screenshots: at least 2, up to 8 per device type, JPEG or 24-bit PNG with no alpha, 320–3840 px, long side at most twice the short side; at least 4 at ≥1080 px to be eligible for recommendations.<br>• Feature graphic: 1024×500, no alpha. | R §6.2; L §5 | confirmed | All verbatim. This also settles M §4c's [U] ("whether ['#1' badges] are allowed in screenshots wasn't checked"): the preview-assets page says screenshots must not include "content that reflects or suggests Google Play performance, ranking, accolades or awards, user testimonials, or price and promotional information … 'Best,' '#1,' 'Top,' 'New,' 'Free'…". | https://support.google.com/googleplay/android-developer/answer/9866151 |
| 10 | The Play preview video must show real use "within the first 10 s" and "≥80% user experience", and screenshot taglines take up "≤20% of the image". L §5 presents these as specs. | L §5 | corrected | The text exists, but under **"Highly recommended"** ("Aim for at least 80%…"; "Taglines should not take up more than 20%"). They are recommendations, not upload requirements. The hard video rules are a YouTube URL, embeddable and not age-restricted. | same |
| 11 | Play: personal accounts created after 13 Nov 2023 must run a closed test with at least 12 testers opted in continuously for 14 days. The page is silent on organisation accounts. | L §1.2 | confirmed | Verbatim. The page has no mention of "organization". The organisation exemption therefore rests on [S] only, as L says. | https://support.google.com/googleplay/android-developer/answer/14151465 |
| 12 | Google (blog, 24 Jun 2026): from 30 Jun 2026 in the US, EEA and UK, the service fee is 10% on the first $1M and on auto-renewing subscriptions, and Play billing adds a 5% billing fee. | R §5.2 | confirmed | Dated 24 June 2026, and the quotes match. Nuance: for other transactions the rate depends on whether the install is new or existing; the note omits this. | https://android-developers.googleblog.com/2026/06/play-expanded-billing.html |
| 13 | Apple EU terms (newsroom, 18 Aug 2026), effective 1 Oct 2026.<br>• In-app purchase: 26%, or 15% for the Small Business Program and subscriptions after year one.<br>• Alternative payment processing: 20%, or 10%.<br>• Link-out: 15%, or 10%.<br>• 5% Core Technology Commission.<br>• Payment options locked for 12 months.<br>• Under-18s get a parental gate; under-13s get no link-outs. | R §5.2 | confirmed | All verbatim. The commission applies to "digital goods and services". Physical cards stay under 3.1.3(e), which was checked as spot check S1. | https://www.apple.com/newsroom/2026/08/apple-announces-changes-for-apps-in-the-european-union/ |
| 14 | CMA (DMCC Act).<br>• Apple and Google designated with strategic market status (SMS) on 22 Oct 2025.<br>• Commitments "took effect 1 April 2026".<br>• Steering consultation from 30 Jun to 28 Jul 2026, with responses on 14 Aug 2026.<br>• No final steering decision yet. | R §5.2 | corrected | The Apple case page shows the final SMS decision on 22 Oct 2025 and "Final commitments **published**" on 1 Apr 2026, with no effective date stated. The steering consultation was launched on 30 Jun 2026 and responses were published on 14 Aug 2026. The closing date was not seen. No steering decision appears; the latest entry is the NFC consultation of 20 Oct 2026. **Google's designation was not checked** (separate case page) [U]. | https://www.gov.uk/cma-cases/sms-investigation-into-apples-mobile-platform |
| 15 | Cardmarket: "Currently, we are not accepting applications for access to the Cardmarket API." API users may not share credentials with a third party or third-party app. | M §0, §2c; R §3; L §0.3 | confirmed | Verbatim. The page adds that users may share credentials with "an in-house developer or a freelancer you have specifically hired, at your own risk". | https://help.cardmarket.com/en/cardmarket-api |
| 16 | Cardmarket General Terms (English translation "from 26/11/2026"):<br>• §9.1: the API is "only … for managing your own contents".<br>• "on external websites" is in bold, meaning an upcoming change.<br>• §9.2: an App Key for commercial app developers.<br>• §10.2: no dissemination of platform content.<br>• §3.4: users must be over 18.<br>R's summary also lists "Cardmarket's written agreement and App Key under §9" as a clean price route. | R §3, §4.6, Summary, Red line 4 | corrected | The quotes and the bold marking are accurate. Two problems:<br>(a) The terms have **no sub-numbers**. §9 has unnumbered "Users:" and "App Developers:" paragraphs, the dissemination ban sits in §10 "Illegal contents", and the age rule in §3 "Registration".<br>(b) The **App Key "temporarily (24 hours) grants the app full access to the data and rights of the user after the user has entered name and password"**. It is a delegated login for apps acting on a user's own account, not a licence to show prices. Listing it as a price route overreaches.<br>§10 also says "you are prohibited from using hyperlinks in your offers". That settles L §0.6's [U] about Cardmarket's link rules. L's method note says Cardmarket's terms "refused automated reads", but this page returned HTTP 200 today. | https://help.cardmarket.com/en/general-terms-and-conditions |
| 17 | eBay Buy APIs: "intended for eBay partners only"; you apply through the eBay Partner Network (EPN); approval is not guaranteed; the app "must implement affiliate tracking details". Display rules: eBay logo, eBay item image, seller user name, shipping called out, a User Agreement link, a privacy policy. | R §3 | corrected | The first three points are verbatim. But:<br>(a) The page says the app "must meet **one or both**" of two requirements: fully functional in sandbox, **or** affiliate tracking. Affiliate tracking is not always required.<br>(b) The display rules come from "User experience requirements for eBay **guest checkouts**" (view item, cart and checkout pages, plus a browse/search table that requires showing only fixed-price items and bars re-sorting). They are not general Browse display rules. | https://www.developer.ebay.com/api-docs/buy/buy-requirements.html |
| 18 | eBay Marketplace Insights (sold data) is a "(Limited Release) API available only to select developers approved by business units", covering up to 90 days. | M §2c; R §3; L §0.3 | unverifiable | The docs URL now redirects to a developer **sign-in page** whose return path is `/api-docs/marketplace-insights-private/…` [O]. That is consistent with restricted access, but the quoted text and the 90-day figure remain [S]. | https://developer.ebay.com/api-docs/buy/marketplace-insights/overview.html |
| 19 | TCGplayer: "We are no longer granting new API access at this time." | M §2c; R §3 | unverifiable | docs.tcgplayer.com and help.tcgplayer.com both returned 403. A search snippet attributes the sentence to the Getting Started page [S]. Keep the claim at [S]. | https://docs.tcgplayer.com/docs/getting-started |
| 20 | eBay's UK app scans One Piece cards free from 1 Sep 2026, with up to two years of eBay.co.uk sold data, "with no subscription fees or usage limits". | L §0.1, §3 | confirmed | eBay Inc. press release dated 1 Sep 2026; quotes verbatim. Two nuances:<br>• "Availability will roll out **from** 1 September 2026". Whether it is live for all users today was not observed.<br>• It is "Available to UK eBay **account holders**". eBay's User Agreement §5 says users "should be aged 18 or over", so under-18 players are not served [I].<br>The UK release does not mention scan-to-list. That was a 2021 US feature. | https://www.ebayinc.com/stories/press-room/uk/ebay-launches-price-guide-for-trading-cards-in-the-uk/ |
| 21 | EPN Network Agreement: published 24 Sep 2026 and binding existing partners from 28 Sep 2026. "You will not promote Participating Sites and Content using Software Applications without EPN's prior written approval." "eBay" may be used only descriptively. Disclosure must "clearly and prominently identify Promotional Content as advertising". | R §5.3 | confirmed | All verbatim, including the dates. The EPN disclosure FAQ also says in-app disclosure must be "above the fold" and not "tucked into a menu". | https://partnernetwork.ebay.com/page/network-agreement ; https://partnernetwork.ebay.com/resources/affiliate-disclosure-faq |
| 22 | JustTCG terms (last updated 14 Oct 2026): the free tier is personal and non-commercial; paid tiers may show current prices, history and percentage changes to end users; no data export as a dataset (§7.2); no "build a substitute or competing pricing product" (§7.3). Plans: $0, $19, $49 and $149. | R §3, §2.3 | confirmed | "Last updated: 10/14/2026". §7.1 to §7.3 match in substance. The exact §7.3 wording is "Build, train, or operate a pricing API or other product that serves as a substitute for or competitor to the Service". The note's quoted words are a paraphrase in quotation marks. Prices match ($19 Starter, $49 Professional, $149 Enterprise, all plus tax). One Piece Card Game is listed with 7k+ cards. | https://justtcg.com/terms ; https://justtcg.com/ |
| 23 | OP TCG Hub: "No account, tracking or analytics", and the note's honest counter-example. M lists it under "No account, no tracking". | M §1b, §2a, §4c | corrected | Its Play description does say "No account. No subscription. No tracking. No analytics." But the **Data safety section on the same page** says "This app may share these data types with third parties: Device or other IDs" and "may collect … Device or other IDs". It also "Contains ads", and its own sources list names Google AdMob. Its title is "OP TCG Hub: Collect, Hunt, SIM". The no-tracking claim is the developer's own words and is not consistent with its label, so it is not a clean exemplar. The 100+ downloads figure is confirmed. | https://play.google.com/store/apps/details?id=com.optcghub.app&hl=en_GB&gl=GB |
| 24 | Naming pattern: "'One Piece' stays out of the app name"; "OPTCG" or "OP TCG" appears instead; "One Piece TCG" appears only descriptively. | R §1.5 [I] | refuted | Apps observed today use "One Piece" in their names:<br>• The App Store's related list on BountyScan's page shows "Log Pose - for One Piece TCG".<br>• Haki's subtitle is "One Piece TCG Scanner & Prices".<br>• Nika TCG's subtitle is "Track your One Piece TCG".<br>M §4b independently lists "One Piece" spelled out in several store names. The two notes contradict each other, and M has the evidence. | https://apps.apple.com/gb/app/id6746102461 |
| 25 | Gap 1: "no app I found shows a **UK** sold price in GBP". | M §0, §2b(1), Positioning option 2 | refuted (as a market gap) | eBay's own app, launched on 1 Sep 2026 (row 20), shows "up to two years of first-party eBay sales data" from eBay.co.uk for One Piece cards, free and unlimited. M's competitor tables never include the eBay app. The narrower claim (no *independent* app shows several sources side by side, dated and unblended) may still hold, but it is unverified [I]. | https://www.ebayinc.com/stories/press-room/uk/ebay-launches-price-guide-for-trading-cards-in-the-uk/ |

---

## Spot checks (shorter; all fetched 2026-10-20)

| # | Claim | Note | Verdict | Source says | URL |
|---|---|---|---|---|---|
| S1 | Apple 3.1.3(e): physical goods must use purchase methods other than in-app purchase. 3.1.1: link-out restrictions do not apply on the US storefront. | R §5.1–5.2; L §4 | confirmed | Verbatim. | https://developer.apple.com/app-store/review/guidelines/ |
| S2 | Apple 5.1.2(i) requires disclosure "including with third-party AI" and explicit permission. | R §4.2 | confirmed | Verbatim. | same |
| S3 | Apple 5.6.1: use the provided API; the system shows the prompt at most 3 times in 365 days. | L §1.5 | confirmed | Guideline 5.6.1 is verbatim. StoreKit docs: "a maximum of three times within a 365-day period". | same; https://developer.apple.com/documentation/storekit/requesting-app-store-reviews |
| S4 | Texas SB 2420 applies from 4 Jun 2026 (Apple news, 3 Jun 2026). | R §4.4 | confirmed | "These changes will go into effect starting June 4, 2026". | https://developer.apple.com/news/ |
| S5 | iOS 26 SDK required since 28 Apr 2026. | R §6.1 | confirmed | "Starting April 28, 2026… iOS 26 & iPadOS 26 SDK or later". | https://developer.apple.com/news/ |
| S6 | Apple Developer Program costs 99 USD a year. Organisations need a D-U-N-S number, a domain email and a "publicly available and functional" website. The organisation name shows as seller. | L §1.2, §4 | confirmed | Verbatim. Apple adds that sites "that contain minimal content" "won't be accepted". cambridgetcg.com's retired-shop state may matter [I]. | https://developer.apple.com/programs/enroll/ |
| S7 | Play costs US$25 one-time. Organisation accounts display legal name, legal address, developer email and phone. | L §0.5, §1.2 | confirmed | Verbatim. | https://support.google.com/googleplay/android-developer/answer/6112435 ; …/answer/13628312 |
| S8 | Android developer verification starts 30 Sep 2026 in Brazil, Indonesia, Singapore and Thailand, then goes global in 2027. Play "automatically registers 99% of apps". | L §1.2 | confirmed | Verbatim. | https://developer.android.com/developer-verification |
| S9 | Google Play IP policy lists "Artwork or images from comic books, cartoons…", "Cover art for … video games", "Marketing images from movies, television, or video games" and "fan art indistinguishable…". | R §1.4; L §1.3 | confirmed | Verbatim. | https://support.google.com/googleplay/android-developer/answer/9888072 |
| S10 | Google Play metadata: title ≤30 characters; no emojis; no ALL CAPS unless part of the brand; no ranking or price text in title, icon or developer name; no "unattributed or anonymous user testimonials". | M §4a; R §1.4; L §1.3 | confirmed | Verbatim. "Don't use … a brand's logo without permission" appears in the policy's general guidance, not only in the rules for title and icon (M §4a frames it narrowly). | https://support.google.com/googleplay/android-developer/answer/9898842 |
| S11 | Cardmarket price-guide JSON: `price_guide_18.json` is One Piece and has no condition or language fields. | M §2b(4), §2c | confirmed | Created `2026-10-20T02:44:56+0200`; 13,412 rows. Fields: avg, low, trend, avg1, avg7, avg30 and their foil variants. The products file names category "One Piece Single". The terms of use are still unknown [U]; no Cardmarket page was found. | https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_18.json |
| S12 | eBay UK User Agreement: binds existing users from 10 Aug 2026; §5 "You should be aged 18 or over"; §3 bans "any robot, spider, scraper…". | R §3, §4.6 | confirmed (via WebFetch summary; raw page blocked by a "Security measure" page) | As stated. | https://www.ebay.co.uk/help/policies/member-behaviour-policies/user-agreement?id=4259 |
| S13 | eBay robots.txt: "Automated scraping, buy-for-me agents, LLM-driven bots … is strictly prohibited". | R §3 | corrected | The quoted bullet sits under "**Checkouts are strictly for human users**" and ends "any end-to-end flow that attempts to place orders without human review". The ellipsis drops the checkout scope. The file's header separately says "The use of robots or other automated means to access the eBay site without the express permission of eBay is strictly prohibited", which still supports the note's conclusion. | https://www.ebay.com/robots.txt |
| S14 | eBay UK links policy: "listings or item descriptions can't contain links that direct customers to any other site". | L §0.6 | confirmed (via WebFetch summary) | Verbatim. The exceptions are other eBay pages, product videos, eBay-approved freight services and legally required information. | https://www.ebay.co.uk/help/policies/listing-policies/links-policy?id=4248 |
| S15 | Bandai's IP notice (10 Jul 2026) bars unauthorised goods copied from card designs or using characters, and says it is not permission. The site footer reads "All images, text and data on this website may not be reproduced without permission." | M §2c; R §1.2; L §0.4 | confirmed | Verbatim. The notice is about **goods** sold or distributed and says they won't be allowed at official events. It says nothing about apps or enforcement action. R §1.6's "shows active enforcement on this game" is an inference [I] stretched beyond the text. | https://en.onepiece-cardgame.com/news/02_382.html ; https://en.onepiece-cardgame.com/ |
| S16 | UK law text:<br>• Trade Marks Act 1994 s.11(2)(c), quoted.<br>• DMCC Act Sch 20 paras 3, 12, 13, 25 and 30.<br>• Data (Use and Access) Act 2025 s.81 (UK GDPR Art 25(1A)–(1B)) and s.112 (PECR), both in force 5 Feb 2026 by SI 2026/82.<br>• UK GDPR Art 8(2A), inserted 29 Apr 2026 by the Children's Wellbeing and Schools Act 2026. | R §1.6, §4.1, §5.5; L §1.4, §1.5, §2.4 | confirmed | All verbatim on legislation.gov.uk. Sch 20 paras are "in force at 6.4.2025 by S.I. 2025/272", which upgrades the notes' [S] to [D]. Not legal advice. | https://www.legislation.gov.uk/ukpga/1994/26/section/11 ; …/ukpga/2024/13/schedule/20 ; …/ukpga/2025/18/section/81 ; …/section/112 ; …/eur/2016/679/article/8 |
| S17 | ICO Children's Code scope: "more probable than not"; a child is under 18; it also covers services not aimed at children but likely to be used by them. | M §2b(6); R §4.1 | confirmed | Verbatim. | https://ico.org.uk/…/services-covered-by-this-code/ |
| S18 | UK subscription-contract rules start in January 2027 (GOV.UK, 9 Aug 2026). Guidance was published 19 Oct 2026. | M §2b(6); R §5.2; **L open items** | confirmed. **L corrected:** it still says "one source says January 2027, others spring 2027 [S]". | The No. 10 release (9 Aug 2026): "New rules will now come into force in January 2027". DBT's guidance page: "Published: 19 October 2026". The primary sources settle the date; the April 2026 law-firm item ("spring 2027") is superseded. | https://www.gov.uk/government/news/pm-starts-roll-out-of-everyday-fixes-on-the-cost-of-living-ending-rip-off-discounts-and-subscription-traps ; https://www.gov.uk/government/publications/subscription-contracts |
| S19 | Competitor figures:<br>• Collectr: 68K US iOS ratings, 5.7k GB, 4.8 with 44.1k reviews and 1m+ on Play, PRO £7.99 a month or £59.99 a year.<br>• OP.TCG: 100k+ and 1.7k reviews on Play.<br>• TCGplayer: 3.2 with 14k reviews and 1m+ on Play.<br>• BountyScan: subtitle "Track Prices for One Piece TCG", "AI-generated approximations", £4.99 weekly or £24.99 yearly.<br>• DON!! Dex: "Data Not Collected". | M §1a–1b; R §1.5; L §3 | confirmed | All match. Caveats:<br>• Collectr shows "68K", not the exact 68,252.<br>• DON!! Dex's label is self-declared, yet its listing offers "Cloud backup (Premium)" and friend sharing. Treat labels as claims, not facts [I].<br>• BountyScan's label lists Location, Identifiers and Contact Info as linked data. | apps.apple.com/us/app/id1603892248 ; /gb/app/id1603892248 ; /gb/app/id6746102461 ; /gb/app/id6766064169 ; play.google.com …com.collectrinc.collectr, com.mikhaellopez.optcg, com.tcgplayer.tcgplayer |
| S20 | Market and events:<br>• Bandai Namco ONE PIECE IP sales: ¥139.5bn (FY2025.3), ¥139.3bn (FY2026.3), ¥140.0bn plan; Japan Toys & Hobby ¥94.2bn, ¥95.1bn, ¥96.0bn.<br>• Comprehensive Rules v1.2.1 (8/28/2026), rule 5-1-2-3 (at most 4 cards with the same number).<br>• BCG Fest London, 15–17 Jan 2027, ExCeL Halls 1–11.<br>• Pirates Party Vol. 3 runs 1 Sep to 31 Oct 2026.<br>• CMA207: published 4 Apr 2025, updated 18 Nov 2025. CMA208: 4 Apr 2025.<br>• ASA affiliate advice (22 Mar 2023): "may earn an affiliate commission" was "ambiguous and confusing".<br>• ASA price-comparison advice (4 Feb 2026): a non-independent site could be treated as advertising in its entirety. | M §3a, §2b(2), §3c; L §1.2; R §5.5 | confirmed | All match. The ASA affiliate advice dates from **2023** and cites rulings from 2014 and 2022. It predates 2025 and could change. | bandainamco.co.jp …/20260513_en_Complement.pdf ; en.onepiece-cardgame.com/pdf/rule_comprehensive.pdf ; …/events/bcgfest26-27-london.html ; gov.uk CMA207/CMA208 pages ; asa.org.uk affiliate-marketing and price-comparison advice |

---

## [D] or [O] claims with no URL, and traceability gaps

No [D] or [O] claim of substance lacks a source; each maps to a listed URL. The gaps are about traceability and secondary sources:

1. **M §1b Play rows aren't mapped to package ids.** The source list gives about 30 package ids but doesn't say which app each one is. For example, OP Card Price is `com.optcgscan.app`, CROCO is `com.hado98.OnePieceCollection` and "One Piece TCG Value Scanner" is `com.cardvaluepro.optcg.scanner`. The checker found this only by grepping the saved raw pages.
2. **L tags local, agent-written files as [D].** L1 (marketing README) and L2 (ASSETS) are agents' proposals, not primary sources. Examples: "Print orders spend money, so they need Yu's word [D L1]"; "Turning on any analytics is Yu's word (README §7) [D L1]". The method note declares this convention, but [D] makes agent proposals read as documented rules. Suggest a separate tag such as [L].
3. **[S] claims with no URL:**
   - R §3 tcgapi.dev plans;
   - R §4.1 "ICO updated its children's guidance on 15 May 2026";
   - R §2.3 OnePieceTCGEngCardList;
   - L §2.1 "March 2026 date comes from press";
   - L §3 TCGplayer help on misidentified reprints, and third-party crash reports;
   - L §5 Google badge sizing;
   - L §1.2 the waitlist "indie pattern";
   - M §3d Discord member counts (search snippets, no URLs).
4. **L §1.2 source mismatch.** It cites "a forum post" dating the 20→12 tester change, but S74 is Android Authority and a testers' blog, not a forum.

## Overreach and contradictions

**Legal or policy conclusions stated as certain.** This is not legal advice; each needs a solicitor.
- R §2.1: hot-linking or bundling official images "**is** reproduction without permission … and it **fails** Apple 5.2.1 and 5.2.2 and Google's IP policy". The reproduction point follows from the footer, but "fails" predicts a review outcome. Tagged [I] but phrased as fact.
- R §3 Summary: "Scraping any of these sites breaches their terms". This is supported for eBay (User Agreement §3, robots header) and Cardmarket (GTC §10). TCGplayer's and PriceCharting's terms were **not read** (403), so for them it is inference.
- R §1.6: Bandai's notice "shows active enforcement on this game". The notice covers physical goods and event admission only (S15).
- R §3 Summary and Ask list: Cardmarket's "App Key under §9" as a price route. The App Key is 24-hour delegated user access, not a display licence, and the API is closed to new applicants (row 16).

**[I] or [O] presented as a market fact.**
- M's Gap 1 (row 25), which is refuted.
- M's use of OP TCG Hub's self-description as evidence of a no-tracking app (row 23).
- R's naming pattern (row 24).

**Contradictions between the notes**

| Topic | One note says | The other says | Today's check |
|---|---|---|---|
| Cardmarket terms | R: read and quoted | L: "refused automated reads" | Readable (HTTP 200) |
| Subscription rules start date | M and R: January 2027 [D] | L: "January vs spring 2027 [S]" | GOV.UK settles it: January 2027 |
| r/OnePieceTCG rules | M: quoted from a Redlib mirror [S] | L: "not read [U]" | Not re-checked; Reddit blocks this network |
| Date on the Apple guidelines page | M: "no last updated date" | R and L: 16 Oct 2026 | The page shows 16 Oct 2026 |
| Play icon page date | R: 2026-10-20 | L: 2026-06-15 | Shows 2026-10-20 today |
| eBay's UK scanner | L: "the facts that shape everything" (§0.1) | M: absent from all competitor tables and gap analysis | — |

**Pre-2025 or dated items to re-check before use**
- ASA affiliate advice (2023);
- the LCE ruling cited by the ASA (2014);
- the ChannelX post on eBay fee credits (2020);
- EcommerceBytes on eBay's API licence (July 2025; the site has closed);
- Marketplace Insights "latest version 2020-12-18".

## Suggested fixes, in priority order

1. **M**: add the eBay app (UK price guide, 1 Sep 2026) to §1a and §2a. Rewrite Gap 1 and Positioning option 2 against it. The surviving angles are multi-source with receipts, and under-18 players who can't hold eBay accounts [I].
2. **R §3**: drop "App Key under §9" as a price route. Say the Cardmarket route is a written agreement, if Cardmarket offers one. Fix the eBay Buy API "one or both" wording and scope the display rules to guest checkout.
3. **M §2a, §4c**: stop using OP TCG Hub as the no-tracking exemplar, or note its Data safety label (Device IDs shared with third parties; AdMob).
4. **R §1.5**: replace the naming-pattern [I] with M §4b's observed names.
5. **L**: update the subscription date to January 2027 [D]. Mark Play's 10 s / 80% / 20% items as recommendations. Correct the Cardmarket-blocked method note, and resolve §0.6 with GTC §10 (no hyperlinks in offers).
6. **R §5.2**: change "took effect 1 April 2026" to "final commitments published 1 April 2026". Mark Google's designation as not checked.
7. **All notes**: drop the invented sub-numbers (§9.1, §9.2, §10.2, §3.4) from Cardmarket citations.

## Sources fetched by this checker (2026-10-20)

Raw copies are in `mkt2/vs/` (HTML, JSON, and PDFs in `vs/pdf/`). Pages that blocked scripted reads:

| Page | Result |
|---|---|
| eBay links policy, eBay UK User Agreement | Read via the WebFetch summary |
| docs.tcgplayer.com, help.tcgplayer.com | 403 |
| developer.ebay.com API License Agreement | 403 |
| UK IPO journal | 403 |
| Ofcom | 403 |
| eBay Marketplace Insights | Redirect to sign-in |

The UK and EU trade-mark registers were not searched; that stays [U] in all notes.
