# One Piece card scanner and tracker: rules, IP and data constraints

Written 2026-10-20 by a Claude Code research agent (Scout role in `docs/marketing/README.md` §5) for Yu.
It is an agents' research note, not Yu's decision and **not legal advice**. Where law is involved, a
UK solicitor (IP and consumer law) should confirm before launch.

**Scope.** A ONE PIECE Card Game scanner and collection or price tracker for iOS and Android, published by
Cambridge TCG Limited (UK company 15680297). The company also sells cards on eBay and Cardmarket, which
is the source of the conflict-of-interest questions in §5.

**Tags.** Every claim carries one tag:
- **[D]** documented by a primary source I read today (platform policy, official docs, statute, regulator);
- **[O]** observed today on a live page;
- **[S]** secondary source only (press, blog, vendor, forum, or a search snippet of a page I could not open);
- **[U]** I could not reach a source, or found none;
- **[I]** my inference.

All sources were fetched on 2026-10-20 and are listed at the end. Platforms change rules without
notice, so every spec here needs a `review_after` date in gate G4 (ASSETS.md).

---

## 1. Intellectual property

### 1.1 Who owns what

- [O] The official English card game site's footer reads "©Eiichiro Oda/Shueisha" and "©Eiichiro
  Oda/Shueisha, Toei Animation", plus "All images, text and data on this website may not be reproduced
  without permission." Its notices are signed by the BANDAI Card Games Division.
- [O] Limitless TCG, a large fan database, credits card information and images to "Eiichiro
  Oda/Shueisha, Toei Animation and/or Bandai". It states it is not produced, endorsed or supported by,
  or affiliated with, any of them.
- [S] US register (via Justia): ONE PIECE word marks are owned by Kabushiki Kaisha Shueisha, including
  a Class 16 registration that lists playing cards.
- [U] UK and EU register owners of ONE PIECE and ONE PIECE CARD GAME were not checked; those registers are
  interactive search forms. Check the UKIPO "Search for a trade mark" and EUIPO eSearch before
  choosing a name.
- [I] The working picture has three layers:
  - the manga and its characters (Eiichiro Oda and Shueisha);
  - the anime (Toei Animation);
  - the card game product, card designs, card frame and logo (Bandai).

  Card illustrations are licensed works, so any use of card art touches all three layers.

### 1.2 Does Bandai publish fan-content or third-party tool guidelines?

- [O] The English card game site's footer links only Contact, Privacy Policy (bandai.co.jp), Cookie Policy
  and Global Entrance. It has no terms of use, site policy or fan-content guideline.
- [D] On 10 July 2026 Bandai published "Regulations Regarding the Protection of Intellectual Property
  Associated with ONE PIECE Card Game". It bars selling or distributing, without authorisation:
  - cards, accessories or goods derived from or copied from Bandai's card designs;
  - goods that incorporate ONE PIECE characters.

  It states that it gives no permission or consent and waives no rights. It says nothing about apps,
  software, card images or data.
- [S] Fan site onepiece.gg reports a "Clarification" attributed to Bandai Organized Play: the rule
  targets buying and selling, not players' use of fan-made items. [U] I could not find that
  clarification on the official site.
- [U] English and Japanese searches found no Bandai, Shueisha or Toei fan-content, streaming or
  third-party tool guideline for this card game.
  - [I] So there is no published permission to rely on, unlike the Wizards Fan Content Policy noted in
    ASSETS.md.
  - [I] Silence is not consent.
- [D] Bandai runs official apps in this space:
  - the BANDAI TCG+ app (tournaments, card search, deck building);
  - BANDAI TCG+ D, a web deck builder announced 31 July 2026: card search, deck building, top
    decklists and solo play. It requires a BANDAI TCG+ account.

  [D] The announcement does not mention collection tracking or prices.
- [I] Because Bandai's own apps are on the stores, an unofficial app that looks or sounds like them sits
  squarely within the impersonation rules below.

### 1.3 Apple App Store Review Guidelines (last updated 16 October 2026)

- [D] **5.2.1:** "Don't use protected third-party material such as trademarks, copyrighted works, or
  patented ideas in your app without permission, and don't include misleading, false, or copycat
  representations, names, or metadata in your app bundle or developer name."
- [D] **5.2.2:** "If your app uses, accesses, monetizes access to, or displays content from a third-party
  service, ensure that you are specifically permitted to do so under the service's terms of use.
  Authorization must be provided upon request."
- [D] **5.2 (intro):** an app may be removed if it uses content without permission. Rights holders file
  claims through Apple's web form.
- [D] **4.1(c):** "You cannot use another developer's icon, brand, or product name in your app's icon or
  name, without approval from the developer."
- [D] **2.3.7:** app names are limited to 30 characters, and developers must not "pack any of your metadata
  with trademarked terms, popular app names ... just to game the system". Subtitles must not
  "reference other apps".
- [D] **2.3.8:** "For Kids" and "For Children" are reserved for the Kids Category.
- [D] **2.3.14** (new on 16 October 2026): creative assets must not include "references to other apps with
  an intent to mislead, unverifiable product claims, or specific or discounted pricing information".
- [D] **2.3.3 screenshots:** more than half the screenshots for each device must show the app in use, and
  screenshots must not misrepresent the interface.
- [D] **4.3 (spam):** do not submit apps indistinguishable from what is already widely available.
  - [I] I counted at least eight One Piece scanner or tracker apps in today's searches, so the app needs a
    clear difference: honest sourcing, no tracking, UK and EU prices.
- [I] Reading 4.1(c) carefully: Bandai is itself an App Store developer, so "One Piece" or Bandai's logo
  in the app **name or icon** is the likeliest rejection or takedown trigger.

### 1.4 Google Play policies

- [D] **Intellectual Property:** "If your app uses another party's trademarks in a way that is likely to
  cause confusion, your app may be suspended." Listed copyright violations include:
  - "Artwork or images from comic books, cartoons, movies ... or television";
  - "Cover art for ... video games";
  - "Reproductions or 'fan art' indistinguishable from the original work".
- [D] **Impersonation:** "Don't imply that your app is related to or authorized by someone that it isn't."
  Listed violations include:
  - "App titles and icons that are so similar to those of existing products or services that users may
    be misled";
  - copying a business's logo to suggest an official app;
  - claiming "Official" status without rights.
- [D] **Metadata:**
  - the title is 30 characters or fewer;
  - "Don't use a celebrity's name or a brand's logo without permission";
  - no emojis, no ALL CAPS unless part of the brand, no "#1", "Best" or price or promotion text in the
    title, icon or developer name.
- [D] **Store graphics:** "Avoid trademarked characters or logos without proper permission."

### 1.5 How established third-party apps name themselves (US App Store, observed today)

| Listing | Name / subtitle | Uses "One Piece"? | Affiliation disclaimer | Other |
|---|---|---|---|---|
| OP TCG Dex | "OP TCG Dex: Card Scanner" / "Deck Builder & Price Tracker" | [O] Not in name or description, which uses "OP TCG" and "OP Card Game" | [O] None | [O] Rated 13+; contains ads; privacy label lists data used to track you |
| OneCollector | "OneCollector OPTCG Companion" / "Manage your OPTCG Cards" | [O] Not in name | [O] None | [O] Rated 4+; release notes name Cardmarket and TCGplayer as price sources |
| BountyScan | "BountyScan: OPTCG Collector" / "Track Prices for One Piece TCG" | [O] Only descriptively, in the subtitle, after "for" | [O] Yes: "independent, fan-made", not affiliated with or endorsed by the rights holders | [O] Rated 9+; says "Price estimates are AI-generated approximations" |

- [S] Other titles seen in search results: "Haki TCG Card Scanner & Price", "DON!! Dex OPTCG", "OP Deck
  Builder", "Log Pose - for OPTCG", TCG Stacked, and multi-game scanners such as Shiny.
- [I] The pattern:
  - "One Piece" stays out of the app name;
  - the fan abbreviation "OPTCG" or "OP TCG" appears instead;
  - "One Piece TCG" appears only descriptively ("for ...") in the subtitle or description.

  This shows what reviewers have let through. It does not prove the practice is lawful: these apps may
  simply not have been challenged. I did not inspect their icons or screenshots.
- [I] "OPTCG" is a fan abbreviation that points at the ONE PIECE CARD GAME mark. It lowers but does not
  remove risk, so treat it the same as the full name.

### 1.6 The law at a high level (research, not legal advice)

**UK trade marks: "honest practices"**
- [D] Trade Marks Act 1994 s.11(2)(c), as substituted from 14 January 2019 by SI 2018/825: a registered
  mark is not infringed by "the use of the trade mark for the purpose of identifying or referring to goods
  or services as those of the proprietor of that trade mark, in particular where that use is necessary to
  indicate the intended purpose of a product or service (in particular, as accessories or spare parts),
  provided the use is in accordance with honest practices in industrial or commercial matters."
  - [D] Section 11(2)(b) also protects indications of kind, quality and intended purpose, on the same
    honest-practices condition.
- [I] The EU counterpart is Article 14 of Directive (EU) 2015/2436, which was not re-read today.
- [I] Descriptive reference ("a scanner for ONE PIECE Card Game cards") is the kind of use s.11(2)(c)
  contemplates. Honest practice is undermined by:
  - using Bandai's logo, typeface or trade dress;
  - character art in the icon or listing;
  - wording that implies endorsement;
  - "Official".

**US: nominative fair use**
- [S] The Ninth Circuit test from *New Kids on the Block* (1992) has three parts:
  1. the product is not readily identifiable without the mark;
  2. only as much of the mark is used as is reasonably necessary;
  3. nothing suggests sponsorship or endorsement.
- [S] Other circuits apply different tests.

**Copyright exceptions**
- [D] CDPA 1988 s.30: fair dealing for criticism, review or quotation needs a sufficient acknowledgement
  and a work already made available to the public.
- [I] A commercial catalogue that shows every card image is unlikely to count as fair dealing for review
  or quotation, so it is not a safe basis for showing card art.

**Database right**
- [D] SI 1997/3032 reg. 13(1): database right subsists where there was "a substantial investment in
  obtaining, verifying or presenting the contents".
- [D] Reg. 16(2): "the repeated and systematic extraction or re-utilisation of insubstantial parts" can
  infringe.
- [I] Bandai's card list and the marketplaces' price databases are plausible database-right holders in
  the UK and EU. This matters for scraping (§2 and §3).

**Risk**
- [I] The main exposures:
  - rejection at review (Apple 4.1(c) and 5.2.1; Google Impersonation and IP);
  - post-launch takedown after a rights-holder complaint;
  - a strike against Cambridge TCG's developer accounts.

  A takedown is cheap for the rights holder and costly for us. Bandai's 10 July 2026 notice shows active
  enforcement on this game.

---

## 2. Card images and card data

### 2.1 Official images and text

- [O] The official card list (en.onepiece-cardgame.com/cardlist/) shows these fields: name, card number
  (`OP17-001`, `EB04-061`), rarity, cost or life, attribute, power, counter, colour, block, type, effect,
  trigger and set.
  - [O] Images load behind a placeholder.
  - [O] There is no API, no download and no terms link.
- [O] Footer: "All images, text and data on this website may not be reproduced without permission."
- [I] Hot-linking, caching or bundling official card images, or copying effect text wholesale, is
  reproduction without permission. It risks copyright and database-right claims, and it fails Apple
  5.2.1 and 5.2.2 and Google's IP policy (§1.3, §1.4).
- [I] Short factual identifiers, such as card number, set code, rarity and colour, carry far less risk
  than art and full effect text. Building the catalogue wholesale from Bandai's site still raises the
  database-right question. Safer options:
  - key the identifiers from physical cards Cambridge TCG owns;
  - or get Bandai's written permission or a licence.

### 2.2 Users' own photos

- [I] This is the safer default. The user photographs a card they own, and the image stays on their
  device as their collection record.
- [D] Processing done only on the device is not "collected" for Apple's privacy label or Google's Data
  safety form (§4).
- [I] A photo of a card is still a copy of Bandai's artwork. Private, on-device use by the owner is
  low-risk. The risk returns if the app uploads photos and shows them to other users, through shared
  collections or a public gallery. That also makes the app user-generated content:
  - [D] Apple 1.2 requires filtering, reporting, blocking and published contact details;
  - [S] the UK Online Safety Act would then apply (§4.6).

### 2.3 Community databases and APIs

| Source | What it is | Licence / terms | Reliability |
|---|---|---|---|
| optcgapi.com | Free card data and price API run by a single hobby maintainer | [O] No licence or terms published. [O] Its about page says data is "gathered through web scraping", covers sets "Active on TCG Player" (English only), and has "some limits" per day | [O] Started July 2024, API since September 2024; promo images "still missing"; two weeks of price history. [I] Scraped and unlicensed, so it grants us no rights |
| optcg-api (GitHub) | Self-hostable scraper and API | [O] Code is MIT, but "The MIT license on the code does not grant any rights to the data itself". [O] Data comes from Bandai's site, TCGplayer, dotgg and eBay listings. Images are proxied from the official site and TCGplayer's CDN, and some are eBay sellers' photos. [O] The hosted API serves only its own sites; non-commercial developer keys are available on request | [I] Not usable for a commercial app; the eBay seller photos alone are a problem |
| Limitless TCG (onepiece.limitlesstcg.com) | Fan card database with prices | [O] No API and no terms page. USD prices link to TCGplayer and EUR prices to Cardmarket, through a TCGplayer affiliate link | [I] A good reference for humans, not a data feed |
| OnePieceTCGEngCardList (GitHub) | JSON card list | [S] Last updated April 2024 | [I] Stale |
| JustTCG | Paid price and catalogue API | [O] Lists "One Piece Card Game" with 7k+ cards. [D] Terms dated 14 October 2026 (see §3) | [I] Commercial and supported, but prices come from unnamed "online marketplaces" |
| TCGCSV | Mirror of TCGplayer catalogue and prices | [O] "a public entrypoint for information from TCGplayer's API"; no terms or licence | [I] Its own right to redistribute is unclear and it gives us none |

- [I] Across all of these:
  - every free community source is scraped, unlicensed and run by one maintainer;
  - coverage is mostly English-only and thin on promos and Japanese sets;
  - any of them can vanish overnight;
  - none grants rights in Bandai's images.

---

## 3. Price data

| Source | Status for a new third-party app, 2026-10-20 | Scraping |
|---|---|---|
| **Cardmarket** | [D] "Currently, we are not accepting applications for access to the Cardmarket API." Existing API users may not share credentials with third parties. [D] General Terms (English translation "from 26/11/2026"; the German text binds; upcoming changes are in bold): §9.1 the API "may only be used for managing your own contents"; "The presentation of the trading cards and their respective prices on external websites require our prior written agreement" (the phrase "on external websites" is in bold, so it is an upcoming change); §9.2 commercial app developers "may receive a special App Key if requested"; §10.2 bars "disseminating or publicly reproducing contents of the online platform or of other users". [I] 26/11/2026 is probably when the new version takes effect | [O] cardmarket.com returned a Cloudflare "Sorry, you have been blocked" page (HTTP 403) to a scripted request for robots.txt today. [D] §10.2 plus database right make scraping a clear no |
| **TCGplayer** | [U] docs.tcgplayer.com returned 403 today. [S] Search snippets of its own Getting Started page, and 2026 third-party blogs, say it is "no longer granting" new API access. The Partner API was deprecated from 14 August 2023 | [S] Third-party guides say its terms bar scraping without permission; not read today |
| **eBay Browse API** (active listings) | [D] Buy APIs requirements: "The use of eBay's Buy APIs in production is intended for eBay partners only." You apply through the eBay Partner Network, approval is not guaranteed, contracts are signed, and the app "must implement affiliate tracking details". Display rules: show the eBay logo; use the eBay item image; show the seller user name; call out shipping separately; link to the User Agreement; publish a privacy policy. [S] An eBay developer-support forum reply says most Browse methods are open to approved partners with the base scope. [U] The Browse overview returned 403 today | [D] eBay UK User Agreement (existing users from 10 August 2026) bars "any robot, spider, scraper, data mining tools ... or other automated means" without prior express permission, and bypassing robot exclusion headers. [O] eBay's robots.txt "Robots & Agent Policy": "Automated scraping, buy-for-me agents, LLM-driven bots ... is strictly prohibited"; approved integrations "must use our official API" |
| **eBay Marketplace Insights API** (sold prices) | [S] Per a search snippet of developer.ebay.com: "Limited Release", open only to select developers approved by business units, returning sales history up to 90 days; latest version v1_beta.2.2 (2020-12-18). [I] Treat it as unavailable to a new small developer | as above |
| **eBay API License Agreement** | [U] The page returned 403 today. [S] EcommerceBytes (July 2025; the site has since closed) reported a new agreement dated 5 September 2025. Developers may not use eBay data to train AI or feed it into generative-AI tools. Pricing and market data sit in restricted APIs. Pricing tools must comply with deceptive-pricing law | — |
| **PriceCharting** | [U] API documentation returned 403 today. [S] A search snippet of its docs says API access is a paid-subscription feature using a 40-character token. Commercial display terms were not seen | [U] Terms not read |
| **JustTCG** | [O] Plans per month, plus tax: Free $0 (1,000 calls); Starter $19; Professional $49; Enterprise $149. [D] Terms (last updated 14 October 2026): the free tier is personal and non-commercial (§6, §7.1). Paid tiers may "show current prices, price history, and percentage changes to end users", cache while subscribed, and combine with other lawful sources (§7.1). Data may not be exported as a dataset (§7.2). No tier may resell the raw feed or "build a substitute or competing pricing product" (§7.3). [I] Ask JustTCG in writing whether a consumer price tracker counts as "competing" | n/a (licensed API) |
| **tcgapi.dev** | [S] Free, Hobby and Starter plans are non-commercial; Pro ($49.99) and Business ($99.99) include commercial use | — |
| **Cambridge TCG's own sales** | [I] The only price data the company fully controls. Own asking prices are not market prices, so label them as ours (§5.5) | — |

**Summary.**
- [I] For a commercial app in October 2026, the only clean price routes found are:
  1. a paid licensed API such as JustTCG, confirmed in writing for this use;
  2. eBay Buy APIs after EPN approval and contracts;
  3. Cardmarket's written agreement and App Key under §9.
- [I] Scraping any of these sites breaches their terms. It also risks database-right claims and Apple
  5.2.2 ("Authorization must be provided upon request").
- [I] Cambridge TCG's own Cardmarket or eBay seller API access is for managing its own stock. Repurposing
  it to power a public price feed conflicts with Cardmarket §9.1 and eBay's API terms.

---

## 4. Privacy and children

### 4.1 UK ICO Age Appropriate Design Code (the Children's Code)

**Scope**
- [D] It applies to information society services "likely to be accessed by children": "the possibility of
  this happening needs to be more probable than not."
  - [D] This includes services "that aren't specifically aimed or targeted at children, but are
    nonetheless likely to be used by under-18s".
  - [D] Free, ad-funded apps are covered.
  - [D] "A child is ... a person under 18."
- [S] It came into force on 2 September 2020, with conformance due by 2 September 2021.
- [I] A One Piece scanner is very likely in scope, given the franchise's young audience and competitors
  rated 4+ and 9+.

**[D] The 15 standards, abridged from the ICO's one-line summaries**
1. **Best interests of the child:** a primary consideration in design.
2. **DPIA:** assess and mitigate risks to children.
3. **Age-appropriate application:** a risk-based approach to users' ages.
4. **Transparency:** clear, age-appropriate privacy information.
5. **Detrimental use of data:** no uses shown to harm wellbeing.
6. **Policies and community standards:** uphold your own published terms.
7. **Default settings:** "high privacy" by default.
8. **Data minimisation:** collect and keep only what each feature needs.
9. **Data sharing:** none without a compelling reason.
10. **Geolocation:** off by default.
11. **Parental controls:** tell the child when they are monitored.
12. **Profiling:** off by default.
13. **Nudge techniques:** none that lead children to give more data or weaken privacy.
14. **Connected toys and devices.**
15. **Online tools:** prominent tools for exercising rights and reporting concerns.

**Law changes**
- [D] Data (Use and Access) Act 2025 s.81 inserts UK GDPR Art. 25(1A)–(1B). Services likely to be accessed
  by children must take into account "the children's higher protection matters". It has been in force
  since 5 February 2026 (SI 2026/82).
- [S] The ICO updated its children's guidance on 15 May 2026.
- [D] UK GDPR Art. 8(1): consent-based processing for an online service offered directly to a child is
  lawful from age 13; under 13 it needs parental consent.
  - [D] The Children's Wellbeing and Schools Act 2026 inserted Art. 8(2A) on 29 April 2026. It lets the
    Secretary of State change that age, or set another for specified services, within 13–16.
  - [I] Watch for regulations raising it.

### 4.2 Apple privacy labels, purpose strings and accounts

**Privacy labels**
- [D] "Collect" means "transmitting data off the device" beyond what is needed to service a request in
  real time.
- [D] "Data that is processed only on device is not 'collected'."
- [D] Third-party SDKs count, and an SDK can make the app a "tracking" app even if we never use it to
  track.
- [D] An upload feature for photos means declaring "Photos or Videos".
- [D] A privacy policy URL is required.

**Review guidelines**
- [D] **5.1.1(i):** a privacy policy in App Store Connect and inside the app, naming data, uses,
  third-party sharing, retention and deletion.
- [D] **5.1.1(ii):** consent is needed even for "anonymous" data; paid features must not depend on
  granting data access.
- [D] **5.1.1(v):** apps without significant account features must work without a login, and account
  creation requires in-app account deletion.
- [D] **5.1.2(i)** (current text): "You must clearly disclose where personal data will be shared with
  third parties, including with third-party AI, and obtain explicit permission before doing so."
  - [I] This applies if card recognition sends photos to a cloud vision or LLM model.

**Purpose strings**
- [D] They must name "the specific feature or outcome", in "one brief, complete sentence in active voice
  and sentence case", with a separate string per resource. They must be localised when the app is.
- [S] `NSCameraUsageDescription` "is required if your app uses APIs that access the device's camera"
  (search snippet of Apple's documentation).
- [I] An example, usable only if true: "The camera reads the card you hold up so the app can find its set
  number; the photo stays on your iPhone unless you save it."

### 4.3 Google Play Data safety, permissions and Families

**Data safety and accounts**
- [D] Every published app must complete Data safety, even one that collects nothing, and link a privacy
  policy.
- [D] "'Collect' means transmitting data from your app off a user's device"; on-device and ephemeral
  processing are exempt; SDK data counts.
- [D] Apps with account creation must offer an in-app deletion path and a web link for deletion
  requests. This has been enforced since 31 May 2024.

**Runtime permissions**
- [D] Request in context.
- [D] Explain the reason when `shouldShowRequestPermissionRationale` says to.
- [D] Degrade gracefully, and "don't link to system settings in an effort to convince the user".
- [I] CAMERA is a runtime (dangerous) permission; the page did not list it.

**Families policy**
- [D] Every app declares its target audience in the Play Console.
- [D] If children are among the target audiences:
  - use only Families self-certified ads SDKs, with no interest-based ads or remarketing;
  - child-only apps must not send the advertising ID or request location;
  - COPPA and GDPR compliance is required.
- [D] Mixed-audience apps need "a neutral age screen".

**Apple Kids Category**
- [D] Apple 1.3: Kids Category apps may not link out or offer purchases outside a parental gate, and should
  have no third-party analytics or advertising.
- [I] A price tracker with marketplace links does not belong in the Kids Category. Rate it honestly
  instead.

### 4.4 United States (high level)

**COPPA**
- [D] It applies to services directed to children under 13, or with actual knowledge of collecting from
  them.
- [D] Foreign services "directed to children in the United States" are covered.
- [D] Personal information includes persistent identifiers and "a photograph ... where such file contains
  a child's image".
- [D] Mixed-audience services may age-screen but "may not block children".
- [S] The Federal Register says the amended Rule took effect 23 June 2025, with compliance by 22 April
  2026. It requires separate parental consent before disclosing children's data to third parties for
  targeted advertising.
- [S] The FTC issued an age-verification policy statement in February 2026.

**State app-store age laws**
- [O] Apple's developer news lists "Update for Apps Distributed in Texas" (3 June 2026): Texas SB 2420
  requirements took effect 4 June 2026, with the Declared Age Range and Significant Change APIs.
- [S] Google says SB 2420 is in effect after an appeals court stayed the December 2025 injunction. Play Age
  Signals (beta) returns signals for eligible Texas users.
- [I] A US launch needs age-signal handling. Launching in the UK and EU first defers that work.

### 4.5 What changes with accounts, analytics or ads

| Feature | What it triggers |
|---|---|
| None: on-device scan and collection, no SDKs | [I] Smallest footprint. [D] Still needs a privacy policy and labels, which can say "not collected". [I] The Children's Code still applies to any data that does leave the device, such as crash reports or price API calls carrying an IP address |
| Accounts or cloud sync | [D] In-app deletion (Apple 5.1.1(v)) plus a web deletion link (Google). [I] A DPIA, high-privacy defaults, minimal profile fields and no public profiles by default (Code standards 2, 7, 8) |
| Analytics SDK | [D] Declared in both stores' labels. [I] Consent before non-essential analytics under the Children's Code and UK PECR; prefer first-party, aggregate, opt-in analytics. Turning analytics on is Yu's call (README §7) |
| Ads | [D] Apple ATT for tracking; Google Families SDKs and an age screen; COPPA consent for under-13 US users. [I] Profiling off by default (Code standard 12). Recommend no ads |
| Cloud card recognition | [D] Apple 5.1.2(i) explicit permission for sharing with third-party AI. [I] On-device recognition avoids it |
| Sharing, chat or comments | [D] Apple 1.2 UGC tools. [S] The Online Safety Act user-to-user duties: a children's access assessment and, if likely accessed, a children's risk assessment and safety duties (Ofcom: assessments due 16 April 2025 and 24 July 2025; safety duties from 25 July 2025). [I] Leave these out of v1 |

### 4.6 Children and the marketplaces

- [D] eBay UK User Agreement §5: "You should be aged 18 or over to access and use eBay."
- [D] Cardmarket GTC §3.4: "All natural and legally competent persons above 18 years of age, as well as
  legal persons can register as a user."
- [I] An app likely used by under-18s should not push buy links at them. Options:
  - hide marketplace links by default;
  - show them only after an honest age question;
  - show "ask a parent" copy.

  This also follows the Children's Code nudge standard (13) and DMCC Schedule 20 para 30 (§5.5).

---

## 5. Store and money rules

### 5.1 Linking out to marketplaces for physical cards

- [D] Apple 3.1.3(e): for "physical goods or services that will be consumed outside of the app, you must
  use purchase methods other than in-app purchase".
- [D] Google Payments policy §3.1: Play billing "must not be used" where payment is "for the purchase or
  rental of physical goods".
- [I] Links to eBay or Cardmarket listings of physical cards fall outside both in-app purchase systems,
  and no store commission applies to them.
- [D] Apple 4.2.2: "Other than catalogs, apps shouldn't primarily be marketing materials, advertisements,
  web clippings, content aggregators, or a collection of links."
  - [I] The scanner and collection features must stand alone. A tracker whose main purpose is routing
    users to Cambridge TCG's listings invites a 4.2.2 rejection.
- [D] Apple 5.6: apps must never "trick them into making unwanted purchases ... or engage in any other
  manipulative practices".

### 5.2 Paid features or subscriptions inside the app

- [D] Apple 3.1.1: unlocking features or subscriptions requires in-app purchase.
- [D] Apple 3.1.1(a) and 3.1.3: other storefronts bar buttons or links to other purchase methods, but
  "except for the United States storefront, where this prohibition does not apply".
- [D] **EU** (Apple newsroom, 18 August 2026), effective 1 October 2026: one set of EU terms.
  - In-app purchase: 26% standard, 15% for most developers including the Small Business Program, and 15%
    for auto-renewing subscriptions after year one.
  - Alternative payment processing: 20%, or 10% for small business.
  - Link-out: 15%, or 10% for small business.
  - A 5% Core Technology Commission applies outside the App Store.
  - Payment options are locked for 12 months.
  - Users under 18 must pass a parental gate before alternative payments or link-outs; users under 13
    get no link-outs; Kids Category apps get no links.
- [I] Apple's Small Business Program rate outside the EU was not re-checked today.
- [D] **UK (DMCC Act):**
  - the CMA designated Apple and Google with strategic market status in mobile platforms on 22 October
    2025;
  - commitments on fair app review, ranking and developer data took effect 1 April 2026;
  - a steering conduct requirement for Apple was consulted on from 30 June to 28 July 2026, and responses
    were published 14 August 2026;
  - the case page shows no final steering decision today.
- [S] The proposal would let developers link to external sites, with "fair and reasonable" fees and one
  neutral interstitial.
- [I] Until it is imposed, UK storefront apps follow the general anti-steering rule for digital goods.
- [D] **Google** (Android Developers Blog, 24 June 2026): from 30 June 2026 in the US, EEA and UK, the
  service fee is separated from the billing fee.
  - The service fee is 10% on the first $1M of annual earnings and on auto-renewing subscriptions.
  - The billing fee is 5% when using Play billing.
  - The billing choice program, open to UK and EEA developers, allows alternative billing or links to
    the developer's website.
- [S] Google's US external content links program: fee reporting deadline 1 December 2026.
- [S] **UK subscription contracts regime** (DMCC Part 4 Ch. 2): draft government guidance and a CMA blog
  (14 October 2026) point to January 2027.
  - [D] The guidance was published 19 October 2026.
  - [I] The regulations are not yet made, so the date may move.

### 5.3 eBay Partner Network (affiliate links)

**The Agreement** (published 24 September 2026; binds existing partners from 28 September 2026)
- [D] Exhibit A §2.4: "You will not promote Participating Sites and Content using Software Applications
  without EPN's prior written approval."
- [D] §2.4.3: compensation is withheld for traffic through unapproved Software Applications.
- [D] §3.2 bars clicks "when you or your Agents click on your own Promotional Content".
- [D] §2.1 bars rewards or incentives for qualifying events without approval.
- [D] Cookie-stuffing and auto-redirects are banned.
- [D] "Your Promotional Methods must clearly and prominently identify Promotional Content as advertising."
- [D] "You may use 'eBay' only in a descriptive manner."

**Disclosure FAQ**
- [D] In apps, the disclosure must be "above the fold", not "tucked into a menu".
- [D] Linking to a separate disclosure page is not enough.
- [D] For the ASA, "affiliate" alone has been found insufficient.

**Own listings**
- [U] No explicit EPN text was found on commissions when the buyer purchases from the affiliate's own
  eBay listings.
- [S] A 2020 ChannelX post described an eBay.com fee credit for sellers who drive buyers to their own
  items, US only and possibly outdated.
- [I] Ask EPN in writing before earning commission on Cambridge TCG's own listings, and disclose it either
  way.

**Cardmarket**
- [S] Cardmarket has a referral scheme with small, capped payouts (a search snippet shows a €10 a month
  cap for private users). [U] Its help page returned 404 today.

### 5.4 Data-source contracts are also store rules

- [D] Apple 5.2.2: "Authorization must be provided upon request".
- [I] Each price source in §3 needs a written basis that can be shown to App Review: an API contract,
  terms that permit the use, or a written agreement.

### 5.5 Conflict of interest: the publisher also sells cards (UK)

**DMCC Act 2024, Part 4 Chapter 1**
- [S] In force since 6 April 2025.
- [D] CMA207 guidance, published 4 April 2025 and updated 18 November 2025:
  - "A commercial practice involves a misleading omission if it fails to identify its commercial
    intent, unless this is already apparent from the context."
  - Material information is "information that the average consumer needs to take an informed
    transactional decision".
  - Price comparison websites are responsible for the invitations to purchase they present.
- [D] s.247: where a group is "particularly vulnerable" because of "their age", the average consumer is
  "an average member of the group".

**Banned practices in Schedule 20**
- [D] Para 25: "Falsely claiming or creating the false impression that the trader is not acting for
  purposes" of its business.
- [D] Para 12: paid editorial not made clear.
- [D] Para 13: fake reviews, and reviews that conceal incentives.
- [D] Para 30: "a direct appeal to children to buy advertised products".
- [D] Para 7: false limited-time claims.
- [D] Para 3: unauthorised trust marks.

**CAP Code**
- [D] 2.1: "Marketing communications must be obviously identifiable as such."
- [D] 2.3: they must not imply the marketer is acting as a consumer, and "must make clear their commercial
  intent, if that is not apparent from the context".
- [D] 2.4 covers advertorials.
- [S] The Code covers claims "on a marketer's own website and in other non-paid for space online under
  their control (e.g. their social media accounts and apps)" when directly connected with supplying
  goods (ASA remit guidance).

**ASA advice on price comparison sites** (4 February 2026)
- [D] Paid prominence in results falls within the Code.
- [D] If a site "is not independent", for example closely connected to the companies it compares, "the
  whole site, including its results, could potentially be treated as advertising" (citing the LCE Ltd
  ruling of 8 January 2014).

**ASA advice on affiliate marketing** (22 March 2023)
- [D] Affiliate content is likely an ad "in its entirety".
- [D] Use "(Ad)" labels.
- [D] "may earn an affiliate commission" was found "ambiguous and confusing".
- [D] Brand and affiliate are both responsible.

**[I] What this means in practice**
1. **Say who makes it, up front.** Show it in the store listing, on the first screen and on the price
   screen: "Made by Cambridge TCG Limited. We sell cards on eBay and Cardmarket." This removes any
   impression of an independent tool (Sch. 20 para 25; CAP 2.3).
2. **Market price is not our price.** Show market prices with:
   - the named source;
   - the date and time of the data;
   - the sample (for example, "eBay sold listings, last 30 days, n=12").

   Never present Cambridge TCG's asking price as "value".
3. **Mark our listings.** Label them "Our listing (Cambridge TCG)". Never rank them above others by
   default, and never use them as the only "buy" option. Otherwise the whole app risks being treated as
   an ad.
4. **Label affiliate links.** Put "Ad – we earn a commission" next to the link, not in a menu.
5. **No pressure, especially for children.** No "prices rising", countdowns or "sell now" prompts. Keep
   buy links off by default for likely under-18s (§4.6; Sch. 20 paras 7 and 30; Code standard 13). Gate
   G2 (`fomo_scan`) applies to in-app copy too.
6. **Honest reviews.** No incentivised or prompted-for-reward reviews (Sch. 20 para 13). Use only Apple's
   review API (5.6.1).
7. **Ledger every claim.** Each claim ("live prices", "covers every set", "accurate") goes into
   `claims.toml` with its evidence and a `review_after` date. The retired "daily price guide" claim
   (collection stopped 12 July 2026) is the cautionary case.

---

## 6. App store asset specs (as of 2026-10-20)

### 6.1 Apple

**App icon**
- [D] HIG app-icons page (change log: 8 June 2026 "Refined guidance for Liquid Glass"; 9 June 2025
  layered icons):
  - iOS, iPadOS and macOS use a square 1024×1024 px layout, layered;
  - appearances are default, dark, clear light, clear dark, tinted light and tinted dark;
  - the system masks the corners, so supply "square layers";
  - colour spaces are sRGB, Gray Gamma 2.2 and Display P3;
  - Icon Composer (with Xcode) builds the layered icon;
  - "Prefer illustrations to photos";
  - "Include text only when it's essential".
- [D] The Xcode docs say a single 1024×1024 image generates all iOS variants, and a dark variant uses a
  transparent background.
- [S] The App Store marketing icon must be opaque with no alpha. Apple Developer Forums report upload
  error ITMS-90717 for transparent or alpha icons, including some exported from Icon Composer. [U] I
  found no current Apple doc page stating it.
  - [I] Export RGB with no alpha; gate G5 already checks RGB vs RGBA.

**Screenshots** (App Store Connect specifications page)

| Slot | Status [D] | Portrait px [D] |
|---|---|---|
| iPhone, Dynamic Island (medium display) | **Required**: at least one | 1179×2556 or 1206×2622 |
| iPhone, Dynamic Island (large display) | Optional; scaled down if omitted | 1260×2736, 1290×2796 or 1320×2868 |
| iPhone, Face ID (large display) | "Required if app runs on iPhone and screenshots for iPhone with Dynamic Island (large display) aren't provided" | 1284×2778 or 1242×2688 |
| iPad 13-inch | **Required if the app runs on iPad** | 2064×2752 or 2048×2732 |
| iPhone Duo | Optional now. "Starting in April 2027, screenshots will be required for any app using the iOS 27.1 SDK or later" | Outer 1398×2034; inner 2007×2853 |

- [D] Landscape versions swap width and height.
- [D] 1–10 screenshots per device size, in .jpeg, .jpg or .png, with "no alpha channels or
  transparencies".
- [D] iPhone Duo goes on sale 23 October 2026.
- [I] Practical set: six iPhone shots at 1320×2868 and 1206×2622, plus a 13-inch iPad set only if the
  app ships on iPad. App Store Connect shows the required slots at upload.

**App previews** [D]
- Up to 3 per device size and language.
- 15–30 seconds, at most 500 MB.
- H.264 (.mov, .m4v, .mp4; 10–12 Mbps) or ProRes 422 HQ (.mov).
- At most 30 fps; stereo AAC 256 kbps at 44.1 or 48 kHz.
- Accepted resolutions:
  - iPhone 6.1"–6.9" classes and iPhone Duo: 886×1920 portrait, 1920×886 landscape;
  - iPhone 5.5": 1080×1920;
  - iPad 13" and 11": 1200×1600 portrait, 1600×1200 landscape.
- [I] FilmCraft is not installed (ASSETS.md), so plan previews later.

**Other Apple items**
- [D] New creative assets (product page header and search-result images or video) arrived on 5 October
  2026, along with an App Store Connect preview tool and Asset Library. Guideline 2.3.14 governs them.
  [U] The creative-assets spec page was not read today.
- [O] Apple developer news: uploads have needed the iOS 26 SDK since 28 April 2026 and will need the iOS 27
  SDK from April 2027. The age-rating questionnaire's social-media questions are required from September
  2026.

### 6.2 Google Play

**Listing graphics** (Play Console preview-assets page)
- [D] **App icon:** 512×512, 32-bit PNG with alpha, at most 1024 KB. "Do not include badges or text that
  suggest ranking, price, Google Play categories".
- [D] Icon design page (last updated 2026-10-20):
  - "Full square – Google Play dynamically handles masking. Radius will be equivalent to 30% of icon
    size";
  - sRGB;
  - no drop shadow;
  - prefer a background with no transparency.
  - [I] Older templates may use a different radius, so follow the page.
- [D] **Feature graphic:** 1024×500, JPEG or 24-bit PNG with no alpha. Keep the logo and app name out of
  the crop zones, and avoid pure white, black or dark grey backgrounds.
- [D] **Screenshots:**
  - at least 2 across device types, up to 8 per device type;
  - JPEG or 24-bit PNG with no alpha;
  - each side 320–3840 px, with the long side at most twice the short side;
  - for promotion eligibility, at least 4 at 1080 px or more (portrait 1080×1920, or landscape
    1920×1080);
  - tablets and Chromebooks: 4 recommended, at 1080–7680 px.
- [D] **Preview video:** a YouTube URL, public or unlisted, ads off, embeddable, not age-restricted.
  Only the first 30 seconds autoplay.
- [D] **Content rules:** avoid "trademarked characters or logos without proper permission", "Best",
  "#1", "Top" and "New", device pictures and store badges. Alt text is 140 characters or fewer.

**Adaptive icon in the app** (Android Developers page, last updated 2026-09-22)
- [D] Foreground and background layers, each 108×108 dp; the outer 18 dp is reserved for masks and
  effects.
- [D] A 66×66 dp safe zone; the logo is at least 48×48 dp.
- [D] An optional monochrome layer for themed icons (Android 13+). "Starting with Android 16 QPR 2,
  Android automatically themes app icons for apps that don't provide their own."
- [I] Provide the monochrome layer so the automatic theme does not decide how the icon looks.

### 6.3 Fit with the marketing catalogue

- [I] All store art follows ASSETS.md rule 2: no ONE PIECE characters, card art or logos in the icon,
  feature graphic, creative assets or screenshot overlays. The icon is our own mark, built through
  `artcraft-brand`.
- [I] Screenshots must show the app in use (Apple 2.3.3), yet every real card shows licensed art. Options,
  safest first:
  1. our own placeholder "demo cards" with no characters, made with VectorCraft and clearly not Bandai
     designs;
  2. the scan UI with the card area blurred;
  3. real cards only with Bandai's written permission.

  Never use AI to render a real card (ASSETS.md rule 1).
- [I] Add the specs above to gate G4 data with `review_after: 2027-01-20`. The iPhone Duo requirement
  (April 2027) and the creative-asset specs both need a re-check.

---

## Red lines and safe defaults

**Red lines (do not cross without the named permission)**
1. No ONE PIECE, ONE PIECE CARD GAME or Bandai logo, character, card art or trade dress in the app name,
   icon, feature graphic, creative assets or marketing, and no "Official". Only Bandai's licence lifts
   this.
2. No reproduction of official card images or full card text from Bandai's site, whether bundled, cached
   or hot-linked. The site says "may not be reproduced without permission". Only Bandai's written
   permission lifts this.
3. No scraping of Cardmarket, eBay, TCGplayer or PriceCharting, and no use of scraped community feeds
   (optcgapi.com, optcg-api, TCGCSV) as a commercial price source. Every price source needs a contract or
   terms that permit this use, and it must be showable to App Review (5.2.2).
4. No using Cambridge TCG's own seller API credentials to power a public price feed. They are for
   managing its own stock (Cardmarket §9.1).
5. No hidden commercial interest. Never present our own listing price as "market value", rank our
   listings first, or use affiliate links without an adjacent "Ad" label.
6. No pressure selling or buy prompts aimed at likely under-18s. eBay and Cardmarket require users to be
   18 or over.
7. No ads, third-party tracking or cloud upload of user photos in v1. Each would trigger ATT, Families,
   COPPA, 5.1.2(i) and Children's Code duties. Turning on analytics is Yu's call.

**Safe defaults**
- **Name:** own brand only, with ONE PIECE Card Game named descriptively ("for ...") in the subtitle or
  description. Add a plain disclaimer: "Independent app by Cambridge TCG Limited. Not affiliated with,
  endorsed or sponsored by Bandai, Shueisha, Toei Animation or Eiichiro Oda. ONE PIECE is a trademark of
  its owners." Check the UK and EU registers first.
- **Data:**
  - on-device scanning and an on-device collection;
  - the catalogue holds identifiers only (number, set, rarity, colour), keyed from cards we own;
  - users' own photos stay on the device;
  - no account in v1.
- **Prices:**
  - one licensed paid API, with a written yes for this use;
  - every price shows its source, timestamp and sample size;
  - an empty state when there is no data, never an estimate dressed as a price;
  - "AI estimate" only if labelled as one and never from eBay data.
- **Links:**
  - marketplace links off by default, behind an honest age question;
  - "Ad" labels;
  - our own listings labelled "Our listing" and never preferred;
  - EPN app approval in writing before any eBay affiliate link.
- **Privacy:**
  - privacy policy and labels that truthfully say "data not collected" where that holds;
  - a DPIA before launch, using the Children's Code as the checklist;
  - geolocation and profiling off;
  - specific, localised purpose strings.
- **Stores:**
  - age-rate honestly, not in the Kids Category;
  - UK and EU launch first; a US launch waits for age-signal handling;
  - assets per §6, through the claims ledger and gates G1–G6;
  - Yu publishes.

**Ask in writing before building (agents can draft each request; Yu sends)**
- Bandai: a licence, or permission for card images and an app name.
- Cardmarket: written agreement and an App Key under §9.
- EPN: approval of the app, and a ruling on commissions from our own listings.
- JustTCG: does a consumer tracker count as a "competing pricing product"?
- A UK solicitor: the name, the disclaimer, the conflict-of-interest copy, and the Children's Code DPIA.

---

## Sources (all fetched 2026-10-20)

**IP and app stores**
- Apple App Review Guidelines (last updated 16 Oct 2026): https://developer.apple.com/app-store/review/guidelines/
- Apple Developer news (guideline, asset, SDK and Texas items): https://developer.apple.com/news/
- Apple, guideline 2.3.3 screenshots: https://developer.apple.com/help/app-review/guideline-reference/2-3-3-screenshots
- Apple, purpose strings (5.1.1): https://developer.apple.com/help/app-review/guideline-reference/5-1-1-purpose-strings
- Apple, NSCameraUsageDescription (search snippet only): https://developer.apple.com/documentation/bundleresources/information-property-list/nscamerausagedescription
- Apple, App privacy details: https://developer.apple.com/app-store/app-privacy-details/
- Google Play, Intellectual Property: https://support.google.com/googleplay/android-developer/answer/9888072
- Google Play, Impersonation: https://support.google.com/googleplay/android-developer/answer/9888374
- Google Play, Metadata: https://support.google.com/googleplay/android-developer/answer/9898842
- Bandai, official ONE PIECE Card Game site (EN): https://en.onepiece-cardgame.com/
- Bandai, card list: https://en.onepiece-cardgame.com/cardlist/
- Bandai, IP regulations notice (10 Jul 2026): https://en.onepiece-cardgame.com/news/02_382.html
- Bandai, BANDAI TCG+ D notice (31 Jul 2026): https://en.onepiece-cardgame.com/news/02_412.html
- onepiece.gg, regulations and "clarification" (secondary): https://onepiece.gg/regulations-regarding-the-protection-of-intellectual-property-associated-with-one-piece-card-game-2/
- Justia, Shueisha ONE PIECE marks (secondary, US): https://trademark.justia.com/781/77/one-78177855.html

**Competitor listings**
- OP TCG Dex: https://apps.apple.com/app/id6478655491
- OneCollector: https://apps.apple.com/app/id6499045389
- BountyScan: https://apps.apple.com/us/app/id6746102461

**UK law**
- Trade Marks Act 1994 s.11: https://www.legislation.gov.uk/ukpga/1994/26/section/11
- CDPA 1988 s.30: https://www.legislation.gov.uk/ukpga/1988/48/section/30
- Copyright and Rights in Databases Regulations 1997, reg. 13: https://www.legislation.gov.uk/uksi/1997/3032/regulation/13
- Copyright and Rights in Databases Regulations 1997, reg. 16: https://www.legislation.gov.uk/uksi/1997/3032/regulation/16
- Nominative use overview (secondary): https://en.wikipedia.org/wiki/Nominative_use

**Card data**
- optcgapi.com: https://optcgapi.com/
- optcgapi.com, about: https://optcgapi.com/about/general
- optcg-api (GitHub): https://github.com/arjunkai/optcg-api
- Limitless TCG: https://onepiece.limitlesstcg.com/cards
- TCGCSV: https://tcgcsv.com/

**Price data**
- Cardmarket, API help: https://help.cardmarket.com/en/cardmarket-api
- Cardmarket, General Terms: https://help.cardmarket.com/en/general-terms-and-conditions
- cardmarket.com robots.txt (403 Cloudflare block observed): https://www.cardmarket.com/robots.txt
- TCGplayer, Getting Started (403; search snippets only): https://docs.tcgplayer.com/docs/getting-started
- TCGplayer, Partner API Deprecation (snippet only): https://docs.tcgplayer.com/docs/partner-api-deprecation
- eBay, Buy APIs requirements: https://www.developer.ebay.com/api-docs/buy/buy-requirements.html
- eBay, Marketplace Insights (search snippet): https://developer.ebay.com/api-docs/buy/marketplace-insights/overview.html
- eBay, API License Agreement (403): https://developer.ebay.com/join/api-license-agreement
- EcommerceBytes, July 2025 (secondary; site closed): https://www.ecommercebytes.com/2025/07/18/ebay-restricts-developers-from-using-its-data-to-train-ai/
- eBay UK User Agreement: https://www.ebay.co.uk/help/policies/member-behaviour-policies/user-agreement?id=4259
- eBay robots.txt: https://www.ebay.com/robots.txt
- eBay Partner Network, legal: https://partnernetwork.ebay.com/legal
- eBay Partner Network, Network Agreement: https://partnernetwork.ebay.com/page/network-agreement
- eBay Partner Network, Affiliate Disclosure FAQ: https://partnernetwork.ebay.com/resources/affiliate-disclosure-faq
- ChannelX, 2020 (secondary): https://channelx.world/2020/06/how-to-get-0-final-values-fees-on-ebay-com/
- PriceCharting API documentation (403; snippet only): https://www.pricecharting.com/api-documentation
- JustTCG: https://justtcg.com/
- JustTCG terms: https://justtcg.com/terms

**Privacy and children**
- ICO, Children's Code: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/
- ICO, Code standards: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/code-standards/
- ICO, services covered: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/services-covered-by-this-code/
- Data (Use and Access) Act 2025 s.81: https://www.legislation.gov.uk/ukpga/2025/18/section/81
- UK GDPR Art. 8: https://www.legislation.gov.uk/eur/2016/679/article/8
- Google Play, Data safety: https://support.google.com/googleplay/android-developer/answer/10787469
- Google Play, account deletion: https://support.google.com/googleplay/android-developer/answer/13327111
- Google Play, Families: https://support.google.com/googleplay/android-developer/answer/9893335
- Android, requesting permissions: https://developer.android.com/training/permissions/requesting
- FTC, COPPA FAQ: https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions
- Federal Register, COPPA Rule (search snippet): https://www.federalregister.gov/documents/2025/04/22/2025-05904/childrens-online-privacy-protection-rule
- Google, US state app store bills (search snippet): https://support.google.com/googleplay/android-developer/answer/16569691
- Ofcom, children's access assessment (search snippet): https://www.ofcom.org.uk/online-safety/illegal-and-harmful-content/childrens-access-assessment-duties-under-the-online-safety-act
- Children's Code commencement (secondary): https://www.reedsmith.com/our-insights/blogs/viewpoints/102gdhd/age-appropriate-design-code-transition-period-starts-next-month/

**Store money rules and UK consumer law**
- Apple newsroom, EU changes (18 Aug 2026): https://www.apple.com/newsroom/2026/08/apple-announces-changes-for-apps-in-the-european-union/
- CMA, Apple SMS case: https://www.gov.uk/cma-cases/sms-investigation-into-apples-mobile-platform
- CMA, commitments (10 Feb 2026): https://www.gov.uk/government/news/cma-secures-commitments-from-apple-and-google-to-improve-fairness-in-app-store-processes-and-enhance-ios-interoperability
- CMA, steering consultation: https://connect.cma.gov.uk/consultations/proposed-steering-cr-apple/
- Android Developers Blog, 24 Jun 2026: https://android-developers.googleblog.com/2026/06/play-expanded-billing.html
- Google Play, Payments policy: https://support.google.com/googleplay/android-developer/answer/9858738
- Google, US external content links (search snippet): https://support.google.com/googleplay/android-developer/answer/16470497
- DMCC Act 2024, Schedule 20: https://www.legislation.gov.uk/ukpga/2024/13/schedule/20
- DMCC Act 2024, s.246: https://www.legislation.gov.uk/ukpga/2024/13/section/246
- DMCC Act 2024, s.247: https://www.legislation.gov.uk/ukpga/2024/13/section/247
- CMA207 publication page: https://www.gov.uk/government/publications/unfair-commercial-practices-cma207
- CMA207 guidance: https://www.gov.uk/government/publications/unfair-commercial-practices-cma207/unfair-commercial-practices
- Subscription contracts guidance: https://www.gov.uk/government/publications/subscription-contracts
- CMA blog, 14 Oct 2026 (search snippet): https://competitionandmarkets.blog.gov.uk/2026/10/14/direct-consumer-enforcement-18-months-on/
- CAP Code section 2: https://www.asa.org.uk/type/non_broadcast/code_section/02.html
- CAP Code scope (search snippet): https://www.asa.org.uk/type/non_broadcast/code_folder/scope-of-the-code.html
- ASA, affiliate marketing: https://www.asa.org.uk/advice-online/affiliate-marketing.html
- ASA, search engines and price comparison sites: https://www.asa.org.uk/advice-online/remit-search-engines-and-price-comparison-websites.html

**Asset specs**
- Apple, screenshot specifications: https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications
- Apple, app preview specifications: https://developer.apple.com/help/app-store-connect/reference/app-information/app-preview-specifications
- Apple HIG, app icons (JSON): https://developer.apple.com/tutorials/data/design/human-interface-guidelines/app-icons.json
- Xcode, configuring your app icon (JSON): https://developer.apple.com/tutorials/data/documentation/xcode/configuring-your-app-icon.json
- Apple Developer Forums, ITMS-90717 (secondary): https://developer.apple.com/forums/thread/86829
- Google Play, preview assets: https://support.google.com/googleplay/android-developer/answer/9866151
- Google Play, icon design specifications: https://developer.android.com/distribute/google-play/resources/icon-design-specifications
- Android, adaptive icons: https://developer.android.com/develop/ui/views/launch/icon_design_adaptive

**Not reached today [U]:**
- UKIPO and EUIPO trade mark registers;
- TCGplayer docs (403);
- eBay API License Agreement and Browse overview (403);
- PriceCharting API docs (403);
- Cardmarket main site and robots.txt (Cloudflare block);
- Cardmarket affiliate help page (404);
- Apple creative-assets spec page (not opened).
