# Cardmarket seller `cambridgetcg`: presence check, 2026-10-22

Written 2026-10-22 by a Claude Code research agent (a workflow subagent, Opus 5.5) for Yu, between
19:34 and 20:00 UTC (20:34 to 21:00 BST). It is an agent's research, not Yu's decision, and not tax
or legal advice.

Filed in the repo on 2026-10-22. For filing, paths to the agents' working files were removed, and
the few changes made then are marked "(at filing)". Raw captures were saved but are not filed.
Notes from the same day: [ebay-account.md](ebay-account.md), [vat.md](vat.md), and the draft texts
in [marketplace-texts.md](marketplace-texts.md). RESEARCH §7.6 summarises all four.

**Bottom line: no field of the profile was observed.** Cardmarket's profile page put up a
Cloudflare Turnstile check ("Performing security verification", HTTP 403) for a fresh headless
Chromium. The task's rules say not to get past such a check, so I didn't try. None of the archives
or search indexes that answered holds a copy of the profile; several lookups timed out or were
refused (steps 2–5 below). (At filing: this line first said that no archive or index holds a copy.)
Every profile field below is therefore [U]. What I could read were Cardmarket's help pages and
General Terms, which say what a profile of each seller type must or will show.

Labels: [V] read on 2026-10-22 on a primary source (URL given); [O] seen on the account's own public
page; [S] secondary source; [I] inference; [U] unknown.

## Where the account details come from

- [S] Yu wrote on 2026-10-22, relayed by the workflow harness:
  "eBay: cambridgetcg cardmarket: cambridgetcg 😂 yes VAT registered." So the Cardmarket username is `cambridgetcg` and the business
  says it is VAT-registered. No VAT number or scheme was given.
- [S] From the task brief, not checked here: the company is believed to be Cambridge TCG Limited,
  company number 15680297. (At filing: [vat.md](vat.md) §1 read it at Companies House the same
  day.)

## What I tried, and what happened

Times are UTC, all on 2026-10-22. Captures were saved but are not filed.

1. **Playwright 1.64.1, headless Chromium 1248, fresh temporary profile** (19:36:32Z). UA was
   Chrome 141 on macOS, viewport 1366×900, locale en-GB. I visited only
   https://www.cardmarket.com/en/OnePiece/Users/cambridgetcg and waited 6 seconds.
   - **Outcome: HTTP 403, page title "Just a moment...".** The page read "Performing security
     verification … This website uses a security service to protect against malicious bots."
   - The page HTML contains `cf-turnstile`, `challenge-platform` and `cf_chl_*` markers. That makes
     it a Cloudflare managed challenge, not a page served by Cardmarket.
   - I stopped there. I didn't run a headed browser, use stealth plugins, click the widget, or
     visit the other game URLs. Every game path serves the same user page under the same Cloudflare
     zone, so the same result is expected for each [I].
   - Saved: the page's HTML, a screenshot and a visit log (saved capture, not filed).
2. **Wayback Machine (web.archive.org)**:
   - The CDX API (`matchType=prefix`) was asked about `www.cardmarket.com/{en,de,fr}/{OnePiece,
     Pokemon, Magic, YuGiOh, Lorcana, DragonBall, FleshAndBlood, Digimon, StarWarsUnlimited,
     Riftbound}/Users/cambridgetcg`. Every answer was either `[]` (no captures) or the error
     "Internet Archive: Temporarily Offline" / a timeout.
   - The `archive.org/wayback/available` API returned `"archived_snapshots": {}` for the en/
     OnePiece, Pokemon, Magic, YuGiOh, Lorcana, FleshAndBlood, Digimon, Riftbound and
     StarWarsUnlimited paths. One call got HTTP 429, so I slowed down and stopped soon after.
   - **Outcome: no snapshot of any profile URL exists** [V for the paths that answered]. The
     it/es paths and some de/fr paths went unchecked. (Saved captures, not filed.)
3. **Common Crawl index**:
   - CC-MAIN-2026-43 and CC-MAIN-2026-34 answered "No Captures found" for
     `www.cardmarket.com/en/Pokemon/Users/cambridgetcg`.
   - The other lookups got 504 Gateway Time-out. (Saved capture, not filed.)
4. **archive.today**: the timemap request was redirected to archive.li, which returned HTTP 429.
   I didn't retry. (Saved capture, not filed.)
5. **Search engines**:
   - DuckDuckGo HTML returned its "anomaly" bot page for both queries.
   - Bing returned unrelated results for `site:cardmarket.com cambridgetcg`. For
     `cambridgetcg cardmarket` it showed "One last step Please solve the challenge below"; I didn't
     solve it.
   - The built-in WebSearch tool (two queries) found no page that mentions a Cardmarket seller
     called cambridgetcg.
   - **Outcome: no indexed copy of the profile and no third-party link to it** [V for the queries
     run]. (Saved captures, not filed.)
6. **Cardmarket's public help site** (help.cardmarket.com): it answered HTTP 200 to plain HTTPS
   requests. I read the pages listed below (saved captures, not filed). The help root returned 404.

## Profile fields asked for: all [U]

None of the following was observed. Each one needs a look at the live page.

- seller type (Private, Professional or Powerseller)
- country
- member since
- number of sales
- rating (star) and evaluation counts
- articles for sale, in total and per game
- shipping methods
- About text
- imprint or legal info
- withdrawal policy
- terms
- privacy notice
- whether a VAT ID is shown
- logo or banner
- offer style: comments, languages, conditions, attached scans

Whether the account exists, or is active or on vacation, is also [U]. Yu's word is the only
evidence that it exists.

## What Cardmarket says a profile of each type shows or must hold ([V], read 2026-10-22)

**Seller types.** From https://help.cardmarket.com/en/new-user-guide: "Sellers fit into three
categories on Cardmarket: Private, Professional, and Power."
- "Professional sellers are businesses that operate on Cardmarket."
- "Powersellers are a special group of professional sellers chosen by Cardmarket".

**What a private profile shows.** From https://help.cardmarket.com/en/general-terms-and-conditions
§3: "a private user's first name, username and country of residence will be visible to other users
on the user's public profile page." That sentence is in bold on the page: an upcoming change in the
version from 26/11/2026, not necessarily today's rule. The same clause says nothing about what a commercial profile
shows [U].

**What a commercial profile must contain.** Same page, §3: "As a commercial user, you also
undertake to include a correct and complete About Us, General Terms and Conditions, a Privacy
Policy, and a Withdrawal Form in your profile."
- A commercial user also supplies "your company name, a telephone number, and documents relating to
  your business, including at least your business license, your commercial registration number if
  applicable, and a valid ID document".
- The page says this is a translation of the GTC "from 26/11/2026", with upcoming changes in bold,
  and that only the German version is legally binding.

**One account of each kind.** §3: "Each user may register a maximum of one user account for private
purposes and one account for commercial purposes."

**Commercial trading on a private account.** From https://help.cardmarket.com/en/TaxRequirements:
private sellers' activity is assessed by sales frequency and volume. If those suggest commercial
trading, "the account will be excluded from selling until a business registration is available."

**How to become a Professional.** From https://help.cardmarket.com/en/professional-seller-guide:
either open a new professional account, or ask support to convert a private account with its
evaluations. That needs a phone number and "a scan of your business registration/trade license"
(the new-account route also needs a photo ID).
- Only German professionals must give a VAT ID before buying or selling. "Non-German professionals
  within the EU still need to submit a VAT ID if they want to sell to users outside of their
  country." The guide states no rule for UK professionals [U].

**What professionals owe buyers.** Same guide:
- a 14-day right of return ("the right of revocation");
- a duty to refund lost orders unless a Cardmarket-certified shipping method is used;
- the right to create "personal shipping methods", which only professionals get.

**Rating badges.** From https://help.cardmarket.com/en/SellerRating:
- Outstanding: at least 36 evaluations, at least 97% very good, at most 1% neutral or bad.
- Very good: at least 36 evaluations, at least 92% very good.
- Good: at least 6 evaluations.
- "New seller (no star): less than 5 evaluations".
- Only the last 100 evaluations, or the last month if that holds more, count.

**Sealed limits and pre-sales.** From https://help.cardmarket.com/en/SellingShipmentsFAQ: "Only
professional sellers are allowed to offer more than two of any given sealed product or accessory."
Pre-sales need over a year of selling and at least 1,000 completed sales.

**VAT that Cardmarket collects.** From https://help.cardmarket.com/en/TaxRequirements:
- For a seller outside the EU selling to private EU customers, "Cardmarket collects the VAT on all
  shipments costing less than 150 €" (IOSS). From €150 the seller handles the VAT.
- For sellers outside the UK selling to private UK customers, Cardmarket collects VAT on orders of
  £135 or less (VOEC).
- So on Cambridge TCG's UK-to-UK sales, the VAT is its own to account for [I]. Not advice; check
  with an accountant.

**No links in offers.** From the GTC §10: "you are prohibited from using hyperlinks in your offers",
and from "disseminating or publicly reproducing contents of the online platform or of other users"
beyond the platform's intended use.

## Inferences, kept apart from facts

- [I] Yu says the business is VAT-registered, and it is believed to be a limited company. On that
  basis the GTC expects a **commercial (Professional)** account, carrying About Us, terms, a privacy
  policy and a withdrawal form. Whether `cambridgetcg` is Professional or Private is **not
  observed** [U].
- [I] If the account turns out to be Private while trading as a business, Cardmarket's own rule
  ("excluded from selling until a business registration is available") is the immediate risk. The
  UK consumer-law angle in RESEARCH §7.2 (DMCC Sch 20 para 25) is for a solicitor.
- [I] Earlier research said "Cardmarket's §10 bar[s] scraping". The §10 text read on 2026-10-22
  bars *disseminating or publicly reproducing* platform contents and hyperlinks in offers; no clause
  with the word "scraping" was seen. Rereading a public page once is unlikely to be what it aims
  at, but republishing profile data elsewhere might be.

## Gaps and the cleanest next step

- Every profile field is [U]: there is no archive, no index and no scripted view. Headless
  Chromium meets a Turnstile challenge, and passing it was out of bounds.
- The simplest truthful route [I]: Yu opens https://www.cardmarket.com/en/OnePiece/Users/cambridgetcg
  in Yu's own browser and shares a screenshot or the text. The Offers tab and the profile's legal and
  info tabs would cover the type, rating, articles, shipping, About, terms, privacy and withdrawal
  form. An agent should not use Yu's browser profile or cookies without Yu's word for that act.
  (At filing: the same goes for further checks of the eBay account; see
  [ebay-account.md](ebay-account.md).)
- Not checked: Wayback for the it/es paths and some de/fr paths; most Common Crawl collections
  (504s); Cardmarket's fee table and policy pages on www.cardmarket.com (behind the same
  challenge).
