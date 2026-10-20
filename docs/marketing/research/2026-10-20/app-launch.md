# Launching a One Piece card scanner and tracker: an honest, low-budget workflow

Written 2026-10-20 by a Claude Code research agent for Yu (Cambridge TCG Limited). It is an agent's
research and proposal, not Yu's decision. **This is research, not legal advice.** Where law is
involved (UK consumer law, PECR/UK GDPR, trade marks, copyright), a solicitor should confirm before
anything goes out.

It fits the estate marketing design in `be-main/docs/marketing` (README §3–5, §7–8; ASSETS.md):
claims ledger, gates G0–G6, review packs, agents draft and Yu publishes, Craft CLIs render
locally, no ArtCraft cloud app or ArtCraft trademark, no third-party IP in our assets, real product
only, no engineered urgency, no incentivised reviews.

**Tags.** [D] documented by a primary source read today · [O] observed today on a live page ·
[S] secondary source only · [U] could not reach or confirm · [I] my inference. `Sn` points to the
source list at the end. `L1`–`L3` are local files read today (the marketing README and ASSETS, and
the artcraft-brand skill's references); local tool facts are tagged [D] with an L source.

**Method note.** Most web pages were read through a fetch tool that summarises pages with a small
model; quotes below are what it returned. Apple developer docs were also read as Apple's own JSON
text, and the CMA208 PDF was read in full text. Reddit, redditinc.com, TikTok support, Cardmarket's
T&Cs and the UK IPO journal refused automated reads (403/blocked), so those points are [U] or [S].

---

## 0. The facts that shape everything (read first)

1. **eBay's own app now scans One Piece cards in the UK, free.** From 1 September 2026 the eBay app
   scans raw and some graded cards (Pokémon, Magic, Yu-Gi-Oh!, One Piece, Lorcana) and shows up to
   two years of eBay.co.uk sold data, "with no subscription fees or usage limits" [D S58]. The
   TCGplayer app (eBay-owned) also scans and shows market prices [D S61]. A new scanner must be
   meaningfully different: Apple rejects apps "indistinguishable from what's already widely
   available" (guideline 4.3(b)) [D S7].
2. **The niche is already crowded.** At least BountyScan, OP TCG Dex, TCG Stacked, Haki TCG,
   OneCollector and Shiny cover One Piece scanning or prices [S]. Two listings were checked today
   [O S63, S64].
3. **Price data has no open door yet.** Cambridge TCG's price guide stopped collecting on
   2026-07-12 (brief) [I]. Cardmarket says "Currently, we are not accepting applications for access
   to the Cardmarket API" [D S68]. eBay's sold-data API (Marketplace Insights) is a Limited Release
   for approved developers [S S69]. TCGplayer's API status could not be read (403) [U]. So "tracker"
   price claims stay out of every asset until a lawful source exists (gate G0/G1) [I].
4. **Card images are someone else's IP.** Bandai's One Piece Card Game site says "All images, text
   and data on this website may not be reproduced without permission" [D S53]. Its IP notice of
   10 July 2026 bars unauthorised goods "derived from or copied from card designs" or using the
   franchise's characters, and says the notice is not permission [D S54]. The ONE PIECE word mark
   is owned by Kabushiki Kaisha Shueisha, designated to the UK on 10 January 2025 in classes 16 and
   28, which include trading card games, per a UK IPO journal entry seen only in search results
   [S S71]. This decides naming (§4) and which screenshots are possible (§5).
5. **The maker is disclosed whatever the brand.** An organisation's legal name shows as seller on
   the App Store [D S35]. Google Play shows an organisation's legal name, legal address, developer
   email and phone [D S2]. In the EU, Apple publishes a trader's D-U-N-S address, phone and email
   [D S36]. A "stand-alone" brand cannot hide Cambridge TCG, and should not try (§4) [I].
6. **eBay listings cannot point to the app.** eBay UK: "listings or item descriptions can't contain
   links that direct customers to any other site," with narrow exceptions [D S60]. Any tie-back
   runs from the app to the shop, never the other way. Cardmarket's rules on this could not be read
   [U].

---

## 1. The workflow, pre-launch to post-launch (2025–2026 practice)

### 1.1 Phases at a glance

| Phase | Goal | Key rules (tagged below) | Gate |
|---|---|---|---|
| 0 Decide | Brand, name, IP route, data sources, account type | §0, §4 | G0 Ready: build works, data sources lawful |
| 1 Validate | Prove a few dozen players want it | TestFlight, Play closed test, waitlist | Pre-set thresholds, fixed in advance |
| 2 Listing (ASO) | A truthful store page that converts | Apple 2.3.x, Play metadata policy | G1–G5 + review pack |
| 3 Launch | Reach players where they already gather | Community rules, ad labelling law | G2 pressure, G4 channel |
| 4 Reviews | Genuine ratings, asked neutrally | Apple 5.6.1, Play policy, CMA208 | G4 |
| 5 Measure | Learn without tracking people | ATT, PECR, store consoles | G6 privacy |

### 1.2 Validation

**Talk to players first.** Five to ten short, consented conversations with One Piece players at
local store events tell you what eBay's free scanner fails to do for them [I]. Bandai's TCG+ app
lists tournaments at nearby stores, so it is the public map of where players meet [D S56]. Bandai's
"Pirates Party 2026 Vol. 3" runs 1 September to 31 October 2026 "in stores across all Western
regions" [D S53].

**Waitlist.** A one-page site with an email sign-up is the usual 2025–2026 indie pattern [S]. Make it
consent-first: one purpose stated ("we'll email you once when it launches"), double opt-in, a
privacy notice, and deletion on request [I]. Many players are under 18, so the ICO Children's code
likely applies (see §2.4) [S S77].

**Apple TestFlight.**
- Up to 100 internal and 10,000 external testers [D S5].
- External testing needs Beta App Review, but only for the first build [D S6].
- Builds expire after 90 days [D S6].
- A public link can be shared in communities, with criteria such as device and OS version [D S5].
- Testers can send screenshots and feedback, and crash reports arrive automatically [D S5].

**Google Play closed testing.**
- **Personal accounts created after 13 November 2023** must run a closed test with **at least 12
  testers opted in continuously for at least 14 days** before production access [D S1]. The rule
  started at 20 testers and was later cut to 12; a forum post dates the change to about
  11 December 2024, with no official announcement found [S S74].
- New personal accounts also verify an Android device in the Play Console app ("starting in early
  2024") [D S3].
- **Organisation accounts.** Google's page names only personal accounts, so it is silent on
  organisations [D S1]. Secondary sources say organisation accounts are exempt [S S74].
  Organisation accounts need a D-U-N-S number (free from Dun & Bradstreet), and their legal name
  and address must match that profile [D S2].
- Fee: "US$25 one-time" [D S3].
- **Recommendation:** register as an organisation under Cambridge TCG Limited, and run a 12-tester,
  14-day closed test anyway. It is good practice, and it protects the launch if the account type
  is ever questioned [I].
- **Android developer verification** begins 30 September 2026 in Brazil, Indonesia, Singapore and
  Thailand, and expands globally in 2027. Google Play "automatically registers 99% of apps" [D S4].
  The UK is not yet in scope; re-check in Q1 2027 [I].

**Pre-orders and pre-registration.**
- The App Store allows a pre-order 2–180 days before release for a new app. App Review must approve
  the app before the pre-order is published, and Apple doesn't notify customers if the date
  slips [D S34].
- Apple has a dedicated "Pre-order on the App Store" badge for that period [D S37].
- Google Play pre-registration notifies or auto-installs for users who registered [D S33].
  Personal accounts must first meet the testing rule [D S33].

**Apple Developer Program:** US$99 per membership year [D S35]. Organisation enrolment needs:
- a D-U-N-S number;
- a work email on the company's domain;
- a public, functional website [D S35].

### 1.3 Store listing (ASO)

**Apple product page limits** [D S13]:
- name 30 characters;
- subtitle 30;
- promotional text 170 (changeable without a new build);
- keywords 100, comma-separated.

**Apple's rules that bite** [D S7 unless noted]:
- 2.3.7: "don't try to pack any of your metadata with trademarked terms, popular app names, pricing
  information"; subtitles may not "make unverifiable product claims".
- 4.1(c): "You cannot use another developer's icon, brand, or product name in your app's icon or
  name, without approval".
- 5.2.1: "Don't use protected third-party material such as trademarks, copyrighted works... without
  permission".
- 5.2.2: if the app "displays content from a third-party service," you must be "specifically
  permitted to do so under the service's terms of use".
- The product-page guidance repeats: don't use "trademarked terms... competing app names" in
  keywords [D S13].
- The guidelines page said "Last Updated: October 16, 2026" [D S7].

**Google Play** [D S20, S12]:
- title 30 characters; short description 80; full description 4,000;
- no emojis or repeated special characters;
- no ALL CAPS unless part of the brand;
- nothing that indicates "store performance or ranking" ("#1", "Best of Play");
- nothing that indicates price or promotion ("free for limited time only");
- no "unattributed or anonymous user testimonials" in the description.

Play's IP policy: "Don't use another party's trademarks, such as logos or brand names without
permission," and it lists "marketing images from movies, television, or video games" as common
violations [D S40].

**Name uniqueness:** an App Store name can be used by one app per localization. A trade-mark owner
can claim a name another developer uses [D S39]. No name reservation was documented [D S39].

**Page testing:** custom product pages (each with a unique URL) and product page optimisation
(alternate icons, screenshots and previews shown to random users) exist on Apple [D S13].

**What competitors do (observed, not a licence to copy)** [O]:
- BountyScan's subtitle reads "Track Prices for One Piece TCG", with a fan-made, not-affiliated
  disclaimer naming Bandai Namco [O S63].
- OP TCG Dex avoids the words "One Piece" and uses "OP TCG" [O S64].

Uneven enforcement is not permission. The honest route is an original name, with the game named
only descriptively in the description and a not-affiliated line, after a trade-mark check [I];
not legal advice.

### 1.4 Launch channels

**Reddit.**
- reddit.com and redditinc.com refused automated reads, so neither the Reddit Rules nor
  r/OnePieceTCG's rules were read [U].
- Secondary sources say each community sets its own self-promotion rules and that disclosed
  founder posts fare better than undisclosed ones [S].
- Proposal [I]: read the sidebar rules, message the moderators first, and disclose "I work for the
  company that makes this, and it also sells cards on eBay and Cardmarket". Post once, where the
  mods say. After that, answer questions, with no link unless asked (as ASSETS C7).

**Discord.** Server rules are local and were not checked [U]. Same approach: ask the mods first,
disclose, post once [I].

**YouTube and TikTok creators in the One Piece niche.**
- CAP rule 2.1: "Marketing communications must be obviously identifiable as such." Rule 2.3 bans
  implying the marketer is "acting as a consumer" [D S44].
- The DMCC Act's banned practices include advertorials that hide payment (Schedule 20 para 12) and
  "falsely representing oneself as a consumer" (para 25) [D S42].
- The ASA/CMA influencer guide is the third edition (23 March 2023) and says it will be updated for
  the DMCC Act. Its detailed rules were not read today [D S45].
- ASA affiliate advice (22 March 2023): "#ad" or "(Ad)" upfront is likely clear, while "*affiliate",
  "#collab" and bottom-of-post disclaimers are unlikely to be enough [D S46].
- YouTube requires creators to tick the paid promotion option, which shows viewers a label [D S47].
- TikTok's disclosure page did not load [U].
- Proposal [I]:
  - Offer creators free access, with no conditions on what they say.
  - Ask them to disclose the free access with their platform's tool and "Ad" wherever our
    relationship isn't obvious.
  - Never ask creators for an App Store rating (§1.5).
  - Never send them scripts.

**Local game stores (LGS).** Ask store owners before leaving anything [I]. A printed A6 card with a
QR code to the landing page is cheap (DesignCraft QR is documented, not tested [D L2]). Print orders
spend money, so they need Yu's word [D L1].

**UK events.**
- **BANDAI CARD GAMES Fest 26-27 in LONDON**, 15–17 January 2027, ExCeL London Halls 1–11
  [D S55]:
  - entry needs a pre-registered tournament ticket;
  - it hosts the Championship Europe Finals Season 2 and a Last Chance Qualifier [D S55];
  - rules on vendors or promotion were not on the page [U];
  - any on-site promotion needs the organiser's written permission (Yu's word) [I].
- **MCM London:** 23–25 October 2026, ExCeL [S S76]. That is too soon to promote anything, but
  useful for listening if Yu goes [I].
- **UK Games Expo:** 4–6 June 2027, NEC Birmingham. Exhibitor bookings were due to open in October
  [S S75].

**Owned channels.**
- Cambridge TCG's eBay listings can't link out [D S60].
- A printed insert in eBay or Cardmarket parcels ("made by the same team: a free collection app")
  is outside the eBay links policy as written [I]. Check eBay's off-platform-offers rules and
  Cardmarket's terms first [U].
- Don't email former web-shop customers unless they gave marketing consent that covers this. The
  PECR "soft opt-in" covers only "similar products," and an app may not qualify [I]; not legal
  advice.

### 1.5 Reviews and ratings (no incentives, ever)

**Apple.**
- 5.6.1: "Use the provided API to prompt users to review your app... we will disallow custom review
  prompts" [D S7].
- The Section 3 introduction threatens expulsion for "paid, incentivized, filtered, or fake
  feedback" [D S7].
- The system shows the prompt "a maximum of three times within a 365-day period" [D S9, S8].
- Don't request a review "immediately when a user launches your app" or "as the result of a user
  action" [D S9].
- A settings-screen "Rate" link may use the `action=write-review` deep link [D S9].
- The HIG suggests "at least a week or two between requests" [D S8].
- APIs: `RequestReviewAction` (SwiftUI), `SKStoreReviewController`/`AppStore.requestReview`
  [D S9].

**Google Play In-App Review API** (page updated 2026-01-30):
- No questions before or during the card, "including... 'Do you like the app?'" [D S10].
- No call-to-action button that triggers the API [D S10].
- Don't alter or overlay the card [D S10].
- The quota is undisclosed and may change [D S10].
- Play policy: "Don't offer rewards or incentives for ratings or reviews" and "Don't use deceptive
  pop-ups or force users to rate your app" [D S11].

**UK law.** DMCC Act Schedule 20 para 13 bans fake reviews, concealed incentivised reviews, and
publishing reviews "in a misleading way" [D S42]. It took effect on 6 April 2025 [S S78]. CMA208
(4 April 2025) says [D S43]:
- **Neutral asking is fine.** "merely emailing customers generally to ask if they wish to provide a
  review, is not prohibited" (3.6).
- **Asking only happy users is not.** Cherry-picking includes "encouraging just those who are
  satisfied to leave reviews" (4.5).
- **Staff reviews count as commissioned.** Commissioning "could include a trader requesting a member
  of staff to write a review" (2.10).
- **Incentives are legal only if disclosed** (3.7). The app stores ban them anyway, so the house
  rule is: never.

The CMA opened its first five DMCC review investigations on 27 March 2026 [S S78].

**House rule [I]:**
- one system prompt, after a real value moment (for example the 20th card logged), never during
  onboarding;
- a passive "Rate" link in settings;
- no staff, family or tester-for-favour reviews;
- Yu replies to every review in his own words.

### 1.6 Paid ads (high level, not in the first 90 days)

**Apple Ads.**
- Apple renamed Search Ads to Apple Ads in April 2025 [S S72].
- Placements: Today tab, Search tab, search results, product pages [D S29].
- Advanced is cost-per-tap [D S29].
- Basic is pay-per-install, with a monthly budget per app, at the top of search results only
  [D S30].
- A US$100 credit is offered to eligible new accounts [D S29].
- One vendor puts 2025 global averages at about $2.25 per tap and $3.76 per acquisition across the
  top 15 categories, with no UK or utilities cut seen [S S73].

**Google App campaigns.**
- Placements: Search, Play, YouTube, Display and Discover [D S31].
- Google advises "a daily campaign budget that's at least 50 times your target CPI" (£2 → £100 a
  day), with a 7–14 day learning phase [D S32].
- That is far beyond "almost no budget" [I].

**Recommendation [I]:** no paid ads before about 10 genuine ratings and a measured organic
conversion rate. Then, at most, a small Apple Ads Basic test, with spend capped by Yu in writing.

---

## 2. Measurement without invasive tracking

### 2.1 What the stores measure for you (no code, no ATT)

**App Store Connect Analytics** [D S21]:
- impressions, product page views, conversion rate (downloads ÷ unique impressions), and first-time
  downloads vs redownloads;
- sources: App Store Search, Browse, App Referrers, Web Referrers;
- custom product pages, page tests, in-app events and pre-orders;
- the March 2026 update added cohorts (by download date, source and offer) and peer benchmarks
  (download-to-paid conversion and proceeds per download) [D S21]; the March 2026 date comes from
  press [S];
- usage (sessions, active devices, retention) counts only users who "agreed to share their
  diagnostics and usage information" [D S21].

**Campaign links** (`pt=` provider token, `ct=` campaign token of up to 30 characters):
- give per-campaign downloads and conversion [D S22];
- each metric needs at least 5 in the date range, and a campaign appears only after first-time
  downloads from at least five people [D S22];
- small rows may be withheld [D S22].

That threshold is the privacy design we want: we learn which post worked, never who installed [I].

**Play Console acquisition reports** [D S23]:
- store listing visitors and acquisitions by source (Play search, Play explore, ads and referrals,
  not attributed);
- `utm_source` and `utm_campaign` from links to the listing;
- small groups fold into "Other";
- since June 2026 the primary metric counts unique Install, Open or Pre-register clicks.

### 2.2 Privacy-preserving attribution

- **ATT applies only to "tracking"**: linking app data with "other companies' apps, websites, or
  offline properties for targeted advertising or advertising measurement," or sharing with data
  brokers [D S25].
- The IDFV may be used "for analytics across apps from the same content provider" without ATT
  [D S25].
- An SDK that pools our data with others' for ads counts as tracking even if we don't use it that
  way [D S25].
- **AdAttributionKit** (the successor to SKAdNetwork) sends Apple-signed postbacks with no user- or
  device-specific data, subject to privacy thresholds [D S26]. It matters only if we buy ads
  through ad networks, which we don't plan to [I].
- **Play Install Referrer API** gives the referrer URL, click and install timestamps, and the
  install version [D S24]. We should *not* read it in-app for campaign attribution (§2.4), and can
  rely on Play Console's aggregated UTM view instead [I].

### 2.3 What we can and cannot know

| Can know (aggregate) | Cannot know (by design) |
|---|---|
| Impressions → page views → downloads, by source and campaign link (Apple); visitors → installs by UTM (Play) | Which person came from which post |
| Retention and sessions from opted-in iOS users; Play's own retention reports | Whether a given app user later bought from Cambridge TCG on eBay or Cardmarket |
| Ratings and review text (public) | Anything a user didn't choose to share |
| Optionally, first-party counters with a notice and an off switch (e.g. scans per day) | Ad-style funnels across apps or sites |

The tie-back to eBay and Cardmarket stays unmeasured at person level. At most, compare Cambridge
TCG's own aggregate One Piece sales before and after launch, knowing it proves nothing causal [I].

### 2.4 UK rules for in-app measurement (not legal advice)

- **PECR covers apps.** The rules "cover any use of storage and access technologies" and are "not
  limited to particular environments," with SDKs named as the developer's responsibility [D S50].
- **There is a statistical exception.** The Data (Use and Access) Act 2025 s.112 rewrote PECR
  reg 6. It came "in force at 5.2.2026 in so far as not already in force" (SI 2026/82) [D S51]. The
  ICO's finalised guidance (updated 29 April 2026) lists a statistical-purposes exception [D S48].
  Its conditions are [D S49]:
  - "clear and comprehensive information";
  - "a simple means of objecting, free of charge";
  - use only to improve the service;
  - any provider acting as a processor;
  - data aggregated.
- **Advertising is excluded.** The exception "does not apply to purposes related to online
  advertising," including ad measurement [D S49]. Measuring clicks to our own shop is close to
  advertising measurement, so treat it as needing consent, or don't measure it [I].
- **Children's code.** It applies to information society services "likely to be accessed by"
  under-18s and has applied since 2 September 2021 [S S77]. Standards include "high privacy" by
  default, data minimisation, geolocation off by default, and no nudge techniques [D S52].
- **Store disclosures cover SDKs.** Apple's privacy details and Play's Data safety form must cover
  third-party SDKs [D S27, S28]. Every Play app must file Data safety, even one that collects
  nothing [D S28].

**Measurement v0 (proposal) [I]:**
- no third-party analytics or ads SDK;
- no ATT prompt (none needed);
- store consoles, Apple campaign links and Play UTM links only;
- optional on-device counters sent in aggregate, with a settings toggle "Don't count my usage" and
  a one-line notice;
- no location;
- crash data from the platforms' own reporting.

Turning on any analytics is Yu's word (README §7) [D L1].

---

## 3. TCG sellers and card shops that built apps or tools: what happened

**UK card shop with its own app feeding its shop: none found.** Searches for Magic Madhouse, Chaos
Cards and Total Cards turned up no apps [U]. The patterns below come from marketplaces, an
accessory brand and independents.

| Who | What they built | How it feeds the business | Went well | Went badly or open |
|---|---|---|---|---|
| **eBay** (marketplace) | 2021 US: Price Guide + Collection, list-from-collection, scan to list "up to 50% faster" [D S59]. 2026 UK: free scanning incl. One Piece, 2 years of sold data [D S58] | Collection → listing on eBay | Free, no limits; uses its own sold data [D S58] | It now competes directly with any small scanner [I] |
| **TCGplayer** (eBay-owned marketplace) | Free scan app: market price per card; "Level 4 sellers" import scans into inventory [D S61] | Scanning → selling on TCGplayer | Seller inventory pipeline [D S61] | Its own help says reprinted art can be misidentified [S]; third parties report crashes [S] |
| **Dragon Shield / Arcane Tinmen** (sleeve maker) | One scanner app per game, named "MTG Scanner - Dragon Shield"; prices from TCGplayer, CardMarket, CardKingdom, MTGMintCard; free plus subscriptions (£1.79–£39.99 IAP listed) [O S62] | Brand halo for accessories; not a shop link | 4.5★ from 142 GB ratings; label "Data Not Linked to You" [O S62] | Several overlapping subscription tiers on one listing [O S62] |
| **ManaBox ↔ Mana Pool** (independent app + marketplace) | Mana Pool imports ManaBox CSV exports for selling [S S67] | Interoperability, not lock-in | Simple export bridge [S] | — |
| **CardCastle → CardBot** | Began as a scanning app; "stores pushed back on the idea of using an app to scan cards," so it built a sorting machine [S S66] | Store inventory tooling | 180+ units, near sold out (in a promotional piece) [S S66] | App scanning didn't fit stores' workflow [S S66] |
| **TCG Stacked** (independent) | Scanner and prices; footer discloses TCGplayer and eBay Partner Network commissions; uses TCGplayer-hosted images [O S65] | Affiliate commission | Disclosure exists [O] | A footer disclosure is weaker than ASA's "Ad"-upfront advice [D S46, I] |
| **One Piece niche apps** | BountyScan: weekly £4.99 (3-day trial) or yearly £24.99; data linked incl. coarse location, email, photos [O S63]. OP TCG Dex: ads; "Data Used to Track You" [O S64] | Subscriptions and ads | Fast to market | Privacy labels are a weak spot, and a real opening for a no-tracking app [I] |
| **Bandai (official)** | Bandai TCG+: events, entry, deck registration, check-in [D S56]; Teaching App in the browser [D S57] | Organised play | Official | Don't duplicate events or decks [I] |

**Lessons [I]:**
1. Platforms give scanning away free. A shop's app wins only on something they don't do:
   - Japanese/English printing and variant identity (cambridgetcg.com already publishes SKU
     standards [O S70]);
   - a condition checklist (the site has a no-sign-in border-ratio tool [O S70]);
   - private, offline, no-account collections;
   - clean CSV export a collector can take anywhere.
2. Endorsed naming ("X – Dragon Shield") works for a maker whose main business is something else.
3. Disclose money ties prominently, not in a footer.
4. Scanner accuracy on reprints and alt-arts is the main reputational risk. Test it, publish the
   test set and numbers, and don't claim beyond them.

---

## 4. Brand architecture: Cambridge TCG name, endorsed brand, or stand-alone?

**Cambridge TCG today** [O S70]:
- The homepage banner says "New paid orders and subscriptions are retired."
- The site describes itself as "open-source TCG data infrastructure."
- It has collector tools for existing accounts, and the price guide stopped on 2026-07-12 (brief).
- The footer carries a KINGDOM-register line, "Welcome to all existence — from any substrate, any
  cadence, any dimension." README §3 keeps that language off customer journeys [D L1].
- Revenue is now eBay and Cardmarket sales only (Yu, 2026-10-20).

| Option | For | Against |
|---|---|---|
| **A. Cambridge TCG name** ("Cambridge TCG Scanner") | Maximum transparency; reuses any name recognition from eBay/Cardmarket buyers [I] | Reads as a shop app, inviting the "covert ad" reading and Apple 4.2.2 ("apps shouldn't primarily be marketing materials") [D S7]. Ties the app to a retired web shop and a site with mixed-register copy [O S70]. Hard to spin off later [I]. |
| **B. Endorsed brand** ("<OriginalName>" + "made by Cambridge TCG" on the listing, About screen and landing page) | Honest about the maker; seller line shows Cambridge TCG Limited anyway [D S35]; lets the app earn its own trust; matches "spin off"; easy to move to a new entity later [I] | Two names to look after; the endorsement must be prominent, not small print [I] |
| **C. Stand-alone** (no Cambridge TCG mention) | Cleanest for a future sale or spin-out [I] | Cannot hide the maker: the seller name and Play/EU trader details show it [D S2, S35, S36]. Looks evasive once noticed, and the app would point at its maker's shop without saying so: CAP 2.1/2.3 and DMCC Sch 20 paras 12 and 25 risk [D S42, S44; I] |

**Recommendation (agents' proposal): B, endorsed** [I].
- The name is original and does not use "One Piece" or "OP".
- The subtitle says what it does (for example "Card scanner & collection").
- The description says "for the ONE PIECE CARD GAME by Bandai" once, plus a not-affiliated line,
  after a UK IPO search and ideally a solicitor's view [I]. Apple's 2.3.7, 4.1(c) and 5.2.1 and
  Play's IP policy are the rules in play [D S7, S40].
- The app sits in README ring R1 (commerce, plain voice, no KINGDOM language). It doesn't link into
  R3, so its landing page should not sit inside a page whose footer carries the R3 line [D L1; I].
- **Separate company or not** is Yu's call. A new legal entity needs its own D-U-N-S, Apple
  membership (US$99/yr) and Play account (US$25) [D S35, S3], and it would show its own address
  [D S2] [I].

**Conflict-of-interest guard (the "not a covert ad" rules) [I], each a G1/G4 check:**
1. **Say who makes it.** "Made by Cambridge TCG Limited, which sells One Piece cards on eBay and
   Cardmarket", on About, the landing page, and any screen with prices.
2. **Neutral prices.** Price figures come from named sources with dates. Our own listings never
   appear inside price results or "deals", and are never ranked or highlighted.
3. **One labelled door.** At most one "Our shop (Ad)" entry in a menu, off the main flow, opening
   eBay or Cardmarket. Linking out to buy physical goods is allowed (Apple 3.1.3(e)) [D S7].
4. **No push or email promotion** of the shop without separate opt-in, and none to likely
   under-18s (Children's code nudge standard) [D S52; I].
5. **No affiliate earnings** on others' listings unless labelled "Ad". Never on our own [D S46; I].
6. **No shop listings, prices or offers in store assets** (Apple 2.3.7; Play promo rules) [D S7, S12].
7. **No urgency or scarcity wording** anywhere (G2 `fomo_scan`) [D L1].

---

## 5. Launch asset list and what the local Craft CLIs can make

**Installed CLIs:** VectorCraft 0.13.1, PhotoCraft 0.10.0, DesignCraft 0.9.0, FigCraft 0.7.0,
EffectCraft 0.11.1, LightCraft 0.9.1. FilmCraft is **not installed** [D L2, L3].

| Asset | Spec (source) | Make with | Real capture needed? | Gate |
|---|---|---|---|---|
| **iOS app icon** | 1024×1024; layered (background + foreground), with default, dark, clear and tinted variants; Icon Composer (ships with Xcode) builds it; layers as SVG/PDF, text outlined; square, unmasked; no app screenshots in icons [D S18] | VectorCraft draws the SVG master and layers; Apple's Icon Composer assembles the `.icon`; `artcraft-brand` builds web icons from the same mark [D L3] | No | G5; Yu approves look |
| **Android launcher icon** | Adaptive layers 108×108 dp; logo inside the inner 66×66 dp; monochrome layer for themed icons (Android 13+; auto-themed from Android 16 QPR 2); vectors preferred [D S19] | VectorCraft SVG → Android Studio vector drawables [I] | No | G5 |
| **Play store icon** | 512×512 32-bit PNG, sRGB, ≤1024 KB, full square (Play masks 30% radius), no drop shadow, no ranking or deal badges [D S17] | VectorCraft exact raster [D L3] | No | G4, G5 |
| **iPhone screenshots** | 1–10 per size, JPEG/PNG, **no alpha**. Required: "iPhone with Dynamic Island (medium display)" (1206×2622 or 1179×2556). Large display 1320×2868 / 1290×2796 / 1260×2736; if absent, the Face ID large size (1284×2778) is required [D S14]. Whether one set alone passes is [U]: upload 6.9" and 6.3" sets. Must "show the app in use"; text overlays allowed [D S7 2.3.3] | **Real captures from the real build**, framed with captions: PhotoCraft `file.placeEmbedded` + `type.create` (documented) [D L3]. DesignCraft merge leaks alpha 254 at edges, so flatten to RGB [D L3]. VectorCraft placement is **unverified** [D L2] | **Yes** | G1, G4, G5, G6 |
| **iPad screenshots** | 2064×2752 or 2048×2732, only if the app runs on iPad [D S14] | Same | Yes | Same |
| **Play phone screenshots** | 2–8 per device type; JPEG/24-bit PNG; sides 320–3840 px, long side ≤2× short side. For recommendation eligibility: 4+ at ≥1080 px, 9:16 = 1080×1920. Taglines ≤20% of the image; no "Best", "#1", "Free" or "Download now"; nothing time-sensitive [D S16] | Same pipeline, re-exported | Yes | G1, G4 |
| **Play feature graphic** | 1024×500, JPEG or 24-bit PNG (no alpha), key elements central, no device imagery or store badges [D S16] | VectorCraft or PhotoCraft (exact sizes) [D L3] | No | G1, G5 |
| **App Store preview video** | Up to 3, 15–30 s, ≤500 MB, H.264 or ProRes 422 HQ, ≤30 fps; 886×1920 for 6.9"/6.5" [D S15]; "may only use video screen captures of the app itself," with narration and overlays allowed [D S7 2.3.4]; footage "captured on the device" [D S13]; autoplays muted [D S13] | Screen recording on device; trim and encode with ffmpeg [I]. FilmCraft not installed [D L2]. Keep EffectCraft animation out of the store preview [I] | **Yes** | G1–G3 on captions |
| **Play preview video** | Public or unlisted YouTube URL, embeddable, not age-restricted, monetisation off; real use within the first 10 s, ≥80% user experience [D S16] | Same capture | Yes | Same |
| **Landing page** | One page: what it does, what it doesn't, maker line, privacy notice, waitlist (then store badges). Apple badge: official artwork, unmodified, ≥40 px high on screen, App Store badge first when several [D S37]. Google badge same size or larger than others [S]. Smart App Banner [D S38]. OG 1200×630 [D L2] | `artcraft-brand` kit: favicons, web icons, OG card, colour tokens, head snippet [D L3]; plain HTML | No (screenshots reused) | G1–G6; publishing, DNS and analytics are Yu's word [D L1] |
| **Press kit** | Fact sheet from verified claims; icon, lockups, 4–6 screenshots, the preview video; company line; business contact only; not-affiliated line; no card art unless licensed [I] | DesignCraft one-pager PDF [D L3] + a zip | Screenshots, yes | G1–G3, G6 |
| **Social cards** | 1080×1350, 1080×1920 story; OG 1200×630; text out of the top ~14% and bottom ~20% of 9:16 [S per L2] | VectorCraft data sets (one card per CSV row, tested) or PhotoCraft Variables [D L2] | Only if showing UI | G1–G6 |
| **Motion (logo sting, landing micro-animation)** | Lottie + MP4/WebM [D L2] | EffectCraft (verified Lottie/MP4/WebM/GIF from an SVG master) [D L3] | No | G5, G6 |
| **Short social video (TikTok, Shorts)** | 9:16 1080×1920 [S per L2] | Real screen recording + ffmpeg; EffectCraft end card [I] | **Yes** | G1–G3, G6 |
| **LGS / event A6 card** | Venue or printer sizes [U] | DesignCraft data merge + QR (documented, not tested) [D L2] | No | G1–G5; printing is money, Yu's word |

**The hard asset question: card art in screenshots** [I]. A scanner's honest screenshot shows a card
being scanned, but that card's art belongs to Bandai/Shueisha [D S53, S54], and Play lists video-game
marketing images as a common violation [D S40]. Options for Yu:
- **(a) Ask first.** Ask Bandai's European licensing team, in writing, for permission to show card
  images in the app and its store assets (Yu sends it).
- **(b) Hide the art in assets.** Until there's an answer, assets show screens where art isn't
  central (collection list, condition checklist, export), and scan frames with the art pixelated
  and a visible caption "card artwork hidden".
- **(c) Don't decide alone.** Ship nothing that relies on art until (a) is settled.

The same question applies to card images *inside* the app. That is a product decision before it is
a marketing one.

**Seed claims for `claims.toml` (each needs evidence before use)** [I]:
- "Free to download";
- "No ads";
- "No tracking" (matches the privacy label);
- "Works without an account";
- "Exports your collection as CSV";
- an identification accuracy figure, only from a published test set;
- no price-freshness claim until a lawful data source exists.

---

## A 90-day plan (20 October 2026 → 18 January 2027)

Owner: **AGENT** (drafts, research, local renders, gates; nothing outward) or **YU**. Items marked
**YU'S WORD** are outward acts (README §7, ground line 2): publishing, posting, sending, spending,
account changes, DNS. The launch week moves if G0 (a working build with lawful data and image
sources) is not met; marketing does not outrun the product [I].

| Week (2026–27) | Work | Owner | Needs Yu's word |
|---|---|---|---|
| W1 · 20–26 Oct | Decision pack covering: brand option (§4), conflict guard, measurement v0, IP route for card art, data-source status. Claims ledger v0. UK IPO search on 5 candidate names (read-only). Collab-board claim for the work. | AGENT | Yu chooses A/B/C, the name shortlist, and whether to spin out an entity. **YU'S WORD:** attending MCM London 23–25 Oct as a listener (optional) |
| W2 · 27 Oct–2 Nov | Interview guide and consent script (§1.2). Teardown of 6 competitor listings (public only) and eBay's scanner. Positioning draft: what eBay's free scanner doesn't do. | AGENT | **YU'S WORD + hand:** 5–10 player conversations at store events (Pirates Party ends 31 Oct) |
| W3 · 3–9 Nov | Landing page + waitlist (double opt-in, privacy notice, Children's-code check) as a local review pack. | AGENT | **YU'S WORD:** publish the landing page, domain or DNS, form provider |
| W4 · 10–16 Nov | Account route checklist: D-U-N-S, Apple org enrolment, Play org account. Draft the Bandai permission letter. | AGENT drafts | **YU'S WORD + money:** Apple US$99/yr, Play US$25, enrolment and verification (Yu's hand); **send** the Bandai letter |
| W5 · 17–23 Nov | TestFlight internal group. Play closed-test track. Tester recruitment post drafts (waitlist email, one per community after mods agree). | AGENT | **YU'S WORD:** create app records (reserves the name); send the waitlist email; each community post |
| W6 · 24–30 Nov | External TestFlight (first build goes to Beta App Review). Play closed test starts the 14-day clock with 12+ testers. Feedback triage. | AGENT + Yu | **YU'S WORD:** submit the first external build; public TestFlight link |
| W7 · 1–7 Dec | Accuracy test set (owned physical cards, no art in public outputs) and published numbers. Seed claims verified or dropped. | AGENT (Checker ≠ Maker) | — |
| W8 · 8–14 Dec | Store assets: icon (VectorCraft + Icon Composer), screenshots (Yu captures on device, PhotoCraft frames), feature graphic, preview video, listing text in both stores. Gates G1–G6. Review pack. | AGENT; Yu captures | **YU'S WORD:** approve the pack bytes |
| W9 · 15–21 Dec | Privacy label and Data safety answers. Age rating answers. EU trader details (if EU distribution). Press kit. Creator shortlist (public channel info only). | AGENT drafts | **YU'S WORD:** submit for App Review / Play review; trader phone and email to publish; EU distribution yes or no |
| W10 · 22–28 Dec | Quiet week: fix review feedback. No launch over the holidays. | AGENT | Resubmits are Yu's hand |
| W11 · 29 Dec–4 Jan | Optional App Store pre-order and Play pre-registration once approved. LGS A6 card proof. Creator offer drafts (free access, no conditions, disclosure asked). | AGENT | **YU'S WORD:** pre-order or pre-registration; printing; each creator message |
| W12 · 5–11 Jan | **Launch** if G0 holds: release, then landing page badges live. One disclosed post per community where mods agreed. Waitlist one-time email. Campaign links (`ct=`) and UTM links per channel. | Yu publishes; AGENT prepares | **YU'S WORD:** release; every post and email |
| W13 · 12–18 Jan | BCG Fest London 15–17 Jan: attend as a player or visitor if ticketed; promote only with the organiser's written OK. Review replies. Digest #1: funnel by source, crashes, ratings, claim expiries, corrections. | Yu; AGENT digest | **YU'S WORD:** any on-site promotion; review replies (Yu writes) |

**Thresholds fixed now (agents' proposal) [I]:**
- by W5: 100 waitlist sign-ups;
- by W7: 25 active testers across both stores;
- by day 90: 300 installs, week-1 retention measured, at least 5 genuine ratings, zero incentivised.

Missing one is information, not a reason to push harder: no urgency copy, ever.

**Not in these 90 days [I]:** paid ads; affiliate links; a second game; push notifications for the
shop; events booths (UK Games Expo, 4–6 June 2027, can be decided in Q1).

**Open items not confirmed today:**
- r/OnePieceTCG and Discord rules [U];
- TikTok disclosure tooling [U];
- Cardmarket T&Cs on external links [U];
- TCGplayer API status [U];
- whether one iPhone screenshot set satisfies App Store Connect [U];
- whether Play organisation accounts are formally exempt from closed testing [S only];
- DMCC subscription-contract rules, relevant if freemium subscriptions launch: one source says
  January 2027, others spring 2027 [S].

---

## Sources (all fetched 2026-10-20)

Platform: Apple
- S5 https://developer.apple.com/testflight/
- S6 https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview
- S7 https://developer.apple.com/app-store/review/guidelines/ (page says "Last Updated: October 16, 2026")
- S8 https://developer.apple.com/design/human-interface-guidelines/ratings-and-reviews (read via Apple JSON)
- S9 https://developer.apple.com/documentation/storekit/requesting-app-store-reviews (read via Apple JSON)
- S13 https://developer.apple.com/app-store/product-page/
- S14 https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications
- S15 https://developer.apple.com/help/app-store-connect/reference/app-information/app-preview-specifications
- S18 https://developer.apple.com/design/human-interface-guidelines/app-icons (read via Apple JSON)
- S21 https://developer.apple.com/app-store-connect/analytics/
- S22 https://developer.apple.com/help/app-store-connect/view-app-analytics/manage-campaigns
- S25 https://developer.apple.com/app-store/user-privacy-and-data-use/
- S26 https://developer.apple.com/documentation/adattributionkit (read via Apple JSON)
- S27 https://developer.apple.com/app-store/app-privacy-details/
- S29 https://ads.apple.com/app-store
- S30 https://ads.apple.com/app-store/basic
- S34 https://developer.apple.com/app-store/pre-orders/
- S35 https://developer.apple.com/programs/enroll/
- S36 https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements
- S37 https://developer.apple.com/app-store/marketing/guidelines/
- S38 https://developer.apple.com/documentation/webkit/promoting-apps-with-smart-app-banners (read via Apple JSON)
- S39 https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app

Platform: Google
- S1 https://support.google.com/googleplay/android-developer/answer/14151465
- S2 https://support.google.com/googleplay/android-developer/answer/13628312
- S3 https://support.google.com/googleplay/android-developer/answer/6112435
- S4 https://developer.android.com/developer-verification
- S10 https://developer.android.com/guide/playcore/in-app-review (updated 2026-01-30)
- S11 https://support.google.com/googleplay/android-developer/answer/9898684
- S12 https://support.google.com/googleplay/android-developer/answer/9898842
- S16 https://support.google.com/googleplay/android-developer/answer/9866151
- S17 https://developer.android.com/distribute/google-play/resources/icon-design-specifications (updated 2026-06-15)
- S19 https://developer.android.com/develop/ui/views/launch/icon_design_adaptive (updated 2026-09-22)
- S20 https://support.google.com/googleplay/android-developer/answer/9859152
- S23 https://support.google.com/googleplay/android-developer/answer/9859173
- S24 https://developer.android.com/google/play/installreferrer (updated 2025-07-21)
- S28 https://support.google.com/googleplay/android-developer/answer/10787469
- S31 https://support.google.com/google-ads/answer/6247380
- S32 https://support.google.com/adwords/answer/6167156?hl=en-GB
- S33 https://support.google.com/googleplay/android-developer/answer/9859454
- S40 https://support.google.com/googleplay/android-developer/answer/9888072
- S41 https://support.google.com/googleplay/android-developer/answer/9888689
- S47 https://support.google.com/youtube/answer/154235

UK law and regulators
- S42 https://www.legislation.gov.uk/ukpga/2024/13/schedule/20 (DMCC Act 2024, Sch 20)
- S43 https://www.gov.uk/government/publications/fake-reviews-cma208 and PDF https://assets.publishing.service.gov.uk/media/67eeb64fe9c76fa33048c790/CMA208_-_Fake_reviews_guidance.pdf (dated 4 April 2025; read in full text)
- S44 https://www.asa.org.uk/type/non_broadcast/code_section/02.html (CAP Code s.2)
- S45 https://www.asa.org.uk/resource/influencers-guide.html (3rd ed., 23 March 2023)
- S46 https://www.asa.org.uk/advice-online/affiliate-marketing.html (22 March 2023)
- S48 https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/ (updated 29 April 2026)
- S49 …/guidance-on-the-use-of-storage-and-access-technologies/what-are-the-exceptions/
- S50 …/guidance-on-the-use-of-storage-and-access-technologies/what-are-the-pecr-rules/
- S51 https://www.legislation.gov.uk/ukpga/2025/18/section/112
- S52 https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/

Bandai / One Piece Card Game
- S53 https://en.onepiece-cardgame.com/
- S54 https://en.onepiece-cardgame.com/news/02_382.html (10 July 2026)
- S55 https://en.onepiece-cardgame.com/events/bcgfest26-27-london.html
- S56 https://lp.bandai-tcg-plus.com/en/
- S57 https://app.onepiece-cardgame.com/en/

Marketplaces and apps
- S58 https://www.ebayinc.com/stories/press-room/uk/ebay-launches-price-guide-for-trading-cards-in-the-uk/ (from 1 Sept 2026)
- S59 https://ebayinc.com/stories/news/ebay-launches-new-trading-cards-experience-bringing-price-guide-collection-features-to-enthusiasts (29 July 2021)
- S60 https://www.ebay.co.uk/help/policies/listing-policies/links-policy?id=4248
- S61 https://seller.tcgplayer.com/mobile-app
- S62 https://apps.apple.com/gb/app/mtg-scanner-dragon-shield/id1460657155 [O]
- S63 https://apps.apple.com/gb/app/id6746102461 (BountyScan) [O]
- S64 https://apps.apple.com/gb/app/id6478655491 (OP TCG Dex) [O]
- S65 https://www.tcgstacked.com/onepiece/card-scanner-app [O]
- S66 https://manapool.com/library/selling/2024/03/22/cardbot-cardcastle.html (22 March 2024; promotional)
- S67 https://support.manapool.com/hc/en-us/articles/26131255560855 (search snippet only)
- S68 https://help.cardmarket.com/en/cardmarket-api
- S69 https://developer.ebay.com/api-docs/buy/marketplace-insights/overview.html (search snippet only)
- S70 https://cambridgetcg.com/ , /services , /roadmap , /llms.txt [O]

Secondary
- S71 https://www.ipo.gov.uk/t-tmj/tm-journals/2025-025/WO0000001846565.html (search snippet; page 403)
- S72 https://appleinsider.com/articles/25/04/14/apple-rebrands-its-advertising-business-as-apple-ads ; https://searchengineland.com/apple-ads-what-to-know-463194
- S73 https://splitmetrics.com/apple-ads-search-results-benchmarks-2026/executive-summary
- S74 https://www.androidauthority.com/google-play-app-testing-requirement-3510580 ; https://www.testerscommunity.com/blog/google-play-closed-testing-requirements-2026
- S75 https://www.ukgamesexpo.co.uk/exhibit/
- S76 https://www.excel.london/VISITOR/whats-on/mcm-comic-con-2026
- S77 https://www.orrick.com/en/Insights/2021/07/The-UKs-Age-Appropriate-Design-Code-Comes-into-Force-in-September-2021
- S78 https://cms.law/en/gbr/legal-updates/no-more-faux-five-stars-the-dmcc-act-bans-fake-reviews ; https://www.hsfkramer.com/notes/crt/2026-03/cma-launches-first-investigations-into-fake-and-misleading-reviews
- Subscriptions timing: https://www.lewissilkin.com/insights/2026/04/02/consumer-law-update-subscriptions-regime-delayed-again-to-spring-2027-102mops

Local (read 2026-10-20)
- L1 `be-main/docs/marketing/README.md` §3–5, §7–8
- L2 `be-main/docs/marketing/ASSETS.md`
- L3 `~/.kingdom/tools/artcraft-brand/SKILL.md` and `references/apps.md`
