# The One Piece scanner and tracker: design brief

Written 2026-10-20 by Claude Code agents for Yu. It is an agents' proposal, not Yu's decision, and
it is not legal advice. It fits [README.md](README.md) and [ASSETS.md](ASSETS.md). Evidence and tags
([V] confirmed, [V-corr] corrected, [O] observed, [D] documented, [S] secondary, [U] unverified,
[I] inference) are in RESEARCH §7.

Yu, 2026-10-20: "I am planning to spin off one piece card scanner and tracker for ios and android".

**Words used here.**
- **ASO:** app store optimisation, which means writing the store page so people find it.
- **Maker line:** the sentence saying who makes the app and what else they sell.
- **Privacy label / Data safety:** the Apple and Google forms that declare what data an app
  collects.
- **DPIA:** a written risk check on personal data, which the ICO's Children's Code expects.
- **EPN:** eBay Partner Network, eBay's affiliate scheme.
- **D-U-N-S:** a free business ID from Dun & Bradstreet.
- **G0–G6:** the gates in README §5.

## 1. What shapes the plan

- **eBay gives away what most scanners sell** [V]. Rolling out from 1 Sep 2026, its UK app scans
  One Piece cards free, with up to two years of eBay.co.uk sold prices. So the app can't lead with "what's it worth".
- **No free, licensed price source was found** [I]. Cardmarket's API is closed to new applicants
  [V], and its terms from 26 Nov 2026 need "prior written agreement" to show its cards and prices
  "on external websites" [V]. eBay's sold data goes to approved partners only [S]. JustTCG (a paid
  card-price API) sells commercial access at $19–$149 a month but bars rival price products [V].
- **The card art belongs to others** [V]; **the name very likely does** [S]. Bandai says its images and data "may not be
  reproduced without permission". About 15 iOS and over 30 Android apps already do this job [O].

## 2. Where it sits

- **Ring R1, Commerce.** Plain voice, no KINGDOM language, RhetorLint `--max 3`.
- **Its own name, endorsed by its maker.** R1 allows endorsement only through the maker's legal
  line. Proposed, pending §9 Q2: "Made by Cambridge TCG Limited". The app is a separate brand, not "Cambridge TCG Scanner".
  The stores show the maker anyway [V].
- **Ready to spin off** [I]. The maker line is one field in `kernel.toml`, so a later company of its
  own changes one line.
- **Kernel and records.**
  - The brand files live in the app's own repository (README §4).
  - The estate lane records the brand with sphere `independent`.
- **Links run one way: from the app to the shops** (§5). Nothing links back:
  - eBay listings can't link off eBay [V];
  - Cardmarket bans hyperlinks in offers [V].

## 3. Name and trade mark

**Store rules** [V]:
- 30 characters at most.
- Apple 4.1(c) bars "another developer's icon, brand, or product name in your app's icon or name".
- Google Play bars "#1", "Best" and price text in the title and icon, and bars implying an official
  link.
- Creating the app record reserves the name, which is Yu's act [D].

In the US register, ONE PIECE word marks belong to Shueisha [S, via Justia]; the UK and EU owners
were not checked [U]. Search the UK and EU registers (UKIPO, EUIPO)
before choosing; a new app name would sit in class 9, downloadable software [U/I].

**House rules** [I]:
- **Not in the name or icon:** "ONE PIECE", "OP", "OPTCG", words from the story (Haki, Grand
  Line, DON!!, Straw Hat) or pirate motifs. Competitors use them [V-corr], but tolerance is not
  permission.
- **No Bandai material:** no logo, typeface or card frame, and never "Official".
- **The game is named only descriptively:** "for the ONE PIECE Card Game", once, in the
  description.
- **The not-affiliated line** goes with it: "Independent app by Cambridge TCG Limited. Not
  affiliated with, endorsed or sponsored by Bandai, Shueisha, Toei Animation or Eiichiro Oda. ONE
  PIECE is a trademark of its owners."

**Naming patterns** (placeholders only; nothing searched yet):

| # | Pattern | Shape | For | Against |
|---|---|---|---|---|
| 1 | Coined word plus function | `<Coined>: Card Scanner` | Most distinctive; easiest to register; can grow to other games | Means nothing at first |
| 2 | Collector's-record word | `<Folio/Ledger-type word> Cards` | Signals careful records | Ordinary words collide; search hard |
| 3 | Endorsed in the name | `<Name> by Cambridge TCG` | Most transparent in search | Uses up the 30 characters |
| 4 | Function compound | `<Card/Print + Check/Count>` | Self-explanatory | Weak mark; many near-duplicates |
| 5 | House name (not advised) | `Cambridge TCG Scanner` | Fully transparent | Reads as a shop's ad (Apple 4.2.2); ties to the retired shop |

Agents' proposal: pattern 1 or 2, with the maker line on the listing, the About screen and the
landing page.

## 4. Honest positioning

This stays a hypothesis until 5–10 conversations with UK players and sellers (§8 week 2; README §4:
positioning waits for interviews) [I].
There are three candidates.

1. **Printing-aware collection.**
   - Read the set code and *ask* which printing it is when a number is shared.
   - Record condition and language for each copy, across English, Japanese, French and Chinese
     prints.
   - Work offline, with no account and no tracking.
   - It serves under-18s, whom eBay and Cardmarket turn away.
2. **Scan-to-stock for small sellers.**
   - Bulk scan, confirm the printing, and export for eBay UK and Cardmarket.
   - Cambridge TCG can truthfully say it built this for its own work.
   - Whether those import formats exist is [U].
3. **Prices with receipts, later.** Each source is shown separately and dated, never blended. This
   needs a written licence first.

Draft entity sentence (unverified): "`<Name>` is an independent card scanner and collection app for
the ONE PIECE Card Game, made by Cambridge TCG Limited, a UK company that also sells cards on eBay
and Cardmarket."

**Claims it must never make:**
- "Official", "approved" or "partner" of Bandai, Shueisha, Toei, eBay or Cardmarket.
- One blended "value". Never show our own asking price as a market price.
- "Live", "real-time" or "daily" prices; "every card"; an accuracy figure without a published
  test set. The retired "Free daily price guide" is the warning.
- "#1", "Best", "Top", "New", "fastest", user counts or testimonials in store assets. On Play
  also "Free".
- "No tracking", unless the privacy label and every SDK prove it.
- "Grade", "AI grade" or "authenticated". Say "condition notes".
- Profit, "flip", "prices rising", "sell now", pack opening, "win" or "chance".
- Any figure built from eBay data without an approved eBay API.

## 5. The conflict-of-interest rule

The maker also sells cards. UK rules require commercial intent to be clear: failing to identify it
can be a misleading omission (CMA207). DMCC Sch 20 bans paid editorial that isn't made clear (para
12) and falsely implying you are not trading (para 25), and separately bans direct appeals to
children to buy (para 30). The CAP Code (advertising self-regulation) requires marketing to be
identifiable (2.1, 2.3). The ASA says a comparison site that "is not independent" may be an ad "in
its entirety" [V]. Not legal advice. So:

1. **The maker line** appears on the listing, the first screen, About and every price screen: "Made
   by Cambridge TCG Limited. We sell cards on eBay and Cardmarket."
2. **Prices are neutral.** Each shows its source, date, currency and sample size. Our listings never
   appear in price results and are never ranked first.
3. **One labelled door.** At most one "Our shop (Ad)" menu entry, off the main flow. Buying physical
   cards outside the app is allowed (Apple 3.1.3(e)) [V].
4. **No affiliate links in v1.**
   - Later ones need EPN's written approval and an "Ad" label beside them [V].
   - Never earn commission on our own listings.
5. **Under-18s.** Marketplace links are off by default, behind an honest age question. There is no
   push or email promotion of the shop.
6. **No tie-back.** App data is never matched to our buyers.
7. **Ledger.** Every claim carries `commercial_interest = "Cambridge TCG Limited sells ONE PIECE
   cards on eBay and Cardmarket."`

G4 checks rules 1–5 on every pack.

## 6. Assets and specs

Specs are [V] unless marked [D] (documented, not re-checked). Each enters G4 with `review_after = 2027-01-20`.

| Asset | Spec |
|---|---|
| Mark and web kit | `artcraft-brand` from `brand.json`: SVG master and lockups, favicons, apple-touch-icon 180 (opaque), icons 192/512, maskable 512, manifest, 1200×630 share card [D] |
| iOS icon | 1024×1024, layered, in default, dark, clear and tinted versions; assembled in Apple's Icon Composer [D]; uploaded opaque, without alpha [S] |
| Android icon | Adaptive layers of 108×108 dp; logo inside the 66×66 dp safe zone; a monochrome layer [D] |
| Play icon | 512×512 32-bit PNG, 1024 KB at most, full square, no shadow or badges |
| Play feature graphic | 1024×500 JPEG or 24-bit PNG, no alpha |
| iPhone screenshots | 1206×2622 (required slot) and 1320×2868; 1–10 each [D]; no alpha; over half show the app in use (2.3.3). Apple's page contradicts itself on the large slot, so supply both |
| Play screenshots | 2–8; 320–3840 px; long side at most twice the short side; 4 at 1080×1920 for recommendations; no ranking, testimonial or price text |
| App preview | 886×1920; 15–30 s, 30 fps at most, 500 MB at most [D]; app screen capture only. Play: a YouTube URL |
| Store text | Apple: name 30, subtitle 30, promotional text 170, keywords 100. Play: title 30, short 80, full 4,000 [D] |
| Privacy | Policy URL, Apple label, Play Data safety (required even if nothing is collected), one-sentence camera purpose string [D] |
| Demo cards | Original designs with no characters, for screenshots until Bandai answers |
| Landing page and press kit | Maker line; what it does and doesn't; privacy notice; unmodified store badges; fact sheet from verified claims; no card art |

## 7. Craft CLIs and device captures

- **The Craft CLIs make:**
  - the mark and web kit (`artcraft-brand`);
  - icon rasters checked for RGB against RGBA, the feature graphic, demo cards and social cards from
    CSV rows (VectorCraft);
  - screenshot frames and captions (PhotoCraft `file.placeEmbedded`; flatten to RGB);
  - a logo sting (EffectCraft);
  - a fact sheet (DesignCraft).

  Placing screenshots inside VectorCraft is unverified [D, ASSETS].
- **Other local tools:** Icon Composer (Xcode) for the layered iOS icon; Android Studio for the
  adaptive icon [I]; ffmpeg for previews (FilmCraft isn't installed).
- **Device captures (Yu's hand, from the real build):** every store screenshot, the app previews,
  short social clips, and the accuracy test set (owned cards, never published with art).
- **Never:** AI-rendered cards, Bandai art, or ArtCraft's cloud app.

## 8. A 90-day plan (20 Oct 2026 to 18 Jan 2027)

**AGENT** work stays local. **YU'S WORD** marks an outward act. Building the app is the engineering
lane's job. Launch waits for G0, which for the scanner means all of these:
- a working build;
- a written basis for every data and image source, which App Review can be shown;
- a trade-mark search;
- a DPIA.

| Weeks | Work | Owner | Yu's word |
|---|---|---|---|
| 1 | Decision pack (§9), claims ledger v0, register and store-name searches | AGENT | Yu answers §9 |
| 2 | Interview guide; teardown of eBay's scanner and 6 rivals; letters to Bandai, Cardmarket and JustTCG drafted | AGENT; Yu talks to 5–10 players (Bandai's Pirates Party store events run to 31 Oct) | **Send the letters** |
| 3–4 | Positioning; name shortlist; mark and kit pack; account checklist; landing page and waitlist (double opt-in) as a local pack; DPIA draft | AGENT | **Money and accounts:** D-U-N-S, Apple $99, Play $25; the name; domain and landing page |
| 5–6 | Demo cards; accuracy protocol; TestFlight (Apple's beta testing) and Play closed test (12 testers, 14 days) | AGENT; engineering | **App records; recruitment posts (moderators first); first external build** |
| 7 | Accuracy test on owned cards; seed claims verified or dropped (Checker ≠ Maker) | AGENT | — |
| 8 | Icon, screenshots, feature graphic, listing text; gates G1–G6; review pack | AGENT; Yu captures | **Approve the pack** |
| 9–10 | Privacy policy, labels, age rating, press kit; review fixes; no holiday launch | AGENT | **Submit; EU distribution** |
| 11 | Optional pre-order, only once G0 holds; creator offers (free access, no conditions, disclosure asked) | AGENT | **Each offer** |
| 12 | **Launch if G0 holds.** One disclosed post per agreeing community; one waitlist email | Yu | **Release; every post and email** |
| 13 | BANDAI CARD GAMES Fest London (15–17 Jan): listen; promote only with the organiser's written yes. Digest #1 | Yu; AGENT | **Any promotion; review replies** |

If Bandai or Cardmarket haven't answered by week 8, ship v1 without card images and without prices.

**Targets fixed now (agents' proposal):**
- 25 active testers by week 7.
- Four weeks after launch: 300 installs, week-1 retention measured, and at least 5 genuine ratings,
  none of them incentivised.

A missed target is information, never a reason for urgency.

## 9. Questions only Yu can answer

1. **Focus.** README allows one focus brand, and today that is RewardsPro. Does the scanner take
   that place, share it or wait?
2. **Company.** Spin off under Cambridge TCG Limited, or form a new company (its own D-U-N-S
   number and store accounts)?
3. **Audience.** Players and collectors first, or small sellers?
4. **Japanese cards.** Does Cambridge TCG sell them? Observed 2026-10-22: 37 of the 52 eBay
   listings seen are titled Japanese, JP, Jap or Japan, all One Piece [O, 2026-10-22; RESEARCH
   §7.6]. Whether the scanner leads with Japanese prints stays Yu's call.
5. **Budget.** $99 a year and $25; a price API ($19–$149 a month at JustTCG); a solicitor to review
   the name, the disclaimer and the DPIA.
6. **Letters.** Will you send the requests to Bandai, Cardmarket and JustTCG, and later to EPN?
7. **Screenshots.** Use demo cards now, or wait for Bandai?
8. **Pricing model.** Free, or paid? A subscription brings in the UK subscription rules from January
   2027. VAT: Apple and Google account for UK VAT on app sales and in-app purchases, and Google's
   service fee may need self-assessment [V, 2026-10-22], meaning the reverse charge [I]. Direct web
   sales would carry Cambridge TCG's own 20% UK VAT [I] (RESEARCH §7.6).
9. **Website.** Apple refuses organisations whose site has "minimal content" [V]. Is the
   retired-shop cambridgetcg.com enough, or does the app need its own site?
10. **Analytics.** None, or aggregate on-device counters with an off switch?
