# Research: marketing for the estate, condensed

Written 2026-10-20 by Claude Code agents for Yu. Nine read-only researchers wrote these findings; two
adversarial fact-checkers then re-read the load-bearing ones against primary sources. Nothing was
posted, sent or bought, and no AWS calls were made. This is research, not legal advice. The design is
in [README.md](README.md) and the asset specs are in [ASSETS.md](ASSETS.md).

**Tags.**

| Tag | Meaning |
|---|---|
| **[V]** | A fact-checker confirmed it against the primary source on 2026-10-20 |
| **[V-corr]** | A fact-checker corrected it; the corrected version is given |
| **[O]** | A researcher observed it today (a page, code or a CLI run) |
| **[D]** | Documented by the cited source; not re-checked |
| **[S]** | Secondary source only (trade press, vendor, law firm, search snippet) |
| **[U]** | Unverifiable: no primary source reached; don't rely on it |
| **[I]** | Inference |

Estate observations cite the 2026-10-20 research notes by name:
- marketing-workflow
- channels
- agentic-meta
- compliance
- honesty-tooling
- brands-commerce
- brands-agent-kingdom
- artcraft-layout
- artcraft-media
- the fact-checks verify-platform and verify-law-tools

The nine research notes and the two fact-checks are committed in
[research/2026-10-20/](research/2026-10-20/); raw page captures are not. They mention the agents'
scratchpad paths, which no longer exist. Where a primary URL exists, it is given here.

---

## 1. A marketing-workflow primer

### 1.1 The order of work

```
Evidence (talk to buyers)
 -> Positioning (who it is for, against what alternative, why it is better)
  -> Brand platform (promise, personality, voice)
   -> Messaging house (one umbrella line, three pillars, proof under each)
    -> Proof bank / claims ledger (every claim traced to evidence)
     -> Identity / brand kit (tokens, logo suite, icons, type)   <- colour theory and kits live here
      -> Content and channels
       -> Measurement and experiments -> back to Evidence
```

Each layer constrains the next. The usual failure is to start at the kit or at ads before positioning
exists; then every asset is decoration with nothing to say. ArtCraft is a kit-and-content tool: it
makes assets fast but cannot supply the positioning [I, marketing-workflow §1.1].

### 1.2 The artefacts, and what each contains

| Artefact | Contains | Source |
|---|---|---|
| **Switch interview guide** | 7 questions walking a recent switcher back through their decision: context, first thought, looking, the trigger, anxieties, habits, week one. Quotes tagged by the four forces. | Moesta and Spiek: a customer switches when push + pull > anxiety + habit, https://jobstobedone.org/the-four-forces/ [D] |
| **Positioning canvas** | Dunford's five components, in this order: competitive alternatives (including "do nothing"), unique capabilities, value, best-fit customers, market category. Name only alternatives you actually lose to. Don't use the fill-in-the-blank positioning statement. Re-check about every six months. | https://www.aprildunford.com/post/a-quickstart-guide-to-positioning (2021-03-15) [D] |
| **Brand platform** | Purpose, promise (provable), "onliness" (Neumeier), personality as "X but not Y", voice on four tone scales (funny–serious, formal–casual, respectful–irreverent, enthusiastic–matter-of-fact), words used and avoided. Voice stays fixed; tone flexes. | Mailchimp style guide (CC BY-NC) https://styleguide.mailchimp.com/voice-and-tone/ [D]; NN/g tone dimensions [S] |
| **Messaging house** | Roof: one umbrella line. Three pillars with no overlap, each with a headline, two sentences, proof ids and the objection it answers. A CTA ladder ("CTA" is call to action: "Install free", "See how store credit works"). | Practitioner guides [S] |
| **Proof bank / claims ledger** | One row per claim: wording, type, evidence link, date, consent (for quotes), review date, where used. Harry Dry's copy test: can I visualise it, can I falsify it, can nobody else say it? | [S] https://upgrow.io/blog/harry-dry-copywriting-3-rules |
| **Creative brief** | 1–2 pages: objective, audience, one-sentence proposition, reasons to believe (traceable), deliverables, mandatories, measure, approver. In the BetterBriefs survey, 80% of marketers thought they wrote good briefs, but only 10% of agencies agreed (self-reported). | https://ipa.co.uk/news/betterbriefs-compendium/ [D] |
| **Editorial calendar row** | id, brand, pillar, funnel stage, source asset, format, channel, date, owner, status (idea → brief → draft → QA → approved → scheduled → live → measured), proof ids, UTM, result | [I] |
| **UTM registry** | UTMs are link tags that tell analytics where a visit came from. Always set source, medium and campaign. Values are case-sensitive, so use lowercase. Example campaign: `2026-11_rewardspro_tcg-store-credit`. | https://support.google.com/analytics/answer/10917952 [D] |
| **Experiment card** | Hypothesis, metric and baseline, pass threshold fixed in advance, time box, result, decision (kill / iterate / scale), what it changes in the canvas | Hacking Growth via secondary summaries [S] |
| **Asset naming + sidecar** | Fixed date format, hyphen/underscore fields, a version; masters in git, exports rebuilt; a JSON sidecar per asset | DAM guidance [S] |

### 1.3 Brand architecture

- The spectrum runs: branded house → sub-brands → endorsed brands → house of brands (Aaker and
  Joachimsthaler, *California Management Review*, 2000) [D].
- Criteria [S, practitioner blogs]:
  - Heavy customer overlap favours one master brand.
  - Concentrated reputation risk favours separate names.
  - Separate brands cost more to run.
  - A hybrid needs strong parent equity to avoid confusion.
- The estate reading [I]: the estate's buyers barely overlap and its risk profiles differ, and one
  person cannot maintain about 20 full kits. So the fit is a house of brands for commerce, with tiers.

### 1.4 Choosing channels

- **Bullseye** (*Traction*, Weinberg and Mares) [D]:
  - brainstorm one idea per channel across 19 channels;
  - rank them A/B/C;
  - test about 3 cheaply in parallel;
  - focus on the winner until it saturates.

  Sources: https://brianbalfour.com/essays/traction-the-bullseye-framework (2014);
  https://demandcurve.com/newsletters/growth-newsletter-209 (2024).
- **Four fits** (Brian Balfour): "channels do not mold to products". A free app earns close to nothing
  per user, so it needs channels where each customer costs almost nothing to win: the App Store
  itself, community, content, partners and founder-led outreach. Paid ads make sense only once
  revenue exists. Source: https://brianbalfour.com/four-fits-growth-framework [D, I].
- **Brand versus activation.** *Brand* work builds long-term memory; *activation* drives action now.
  The often-quoted 60/40 split is contested (Byron Sharp called it "terrible and misleading") [S]. For
  one person: keep the same colours, mark and phrasing from day one, and put nearly all effort into
  direct activation [I].
- **Founder-led recruitment.** "You can't wait for users to come to you." Source: Paul Graham, "Do
  Things that Don't Scale", 2013, https://paulgraham.com/ds.html [D].

### 1.5 Measuring

- **AARRR** is the stages Acquisition, Activation, Retention, Referral, Revenue, with one key metric
  per stage. A **North Star** is the single metric that best captures the value customers get [D,
  marketing-workflow §6.1].
- **Seven numbers or fewer per focus brand.** For RewardsPro:
  - listing views → installs;
  - onboarding completed with a first reward within 7 days;
  - stores active in weeks 4–8;
  - unincentivised reviews;
  - interviews this month.

  Revenue is not applicable while the app is free [I].
- **At low volume, A/B tests cannot reach significance.** Read every row, and fix a pass threshold
  in advance [I].
- **Shopify attribution caveat.** Installs often show as "direct" in analytics, because attribution
  is lost across the install redirect. Partner Dashboard counts are the truth. Source: a developer
  forum thread [S].
- **Analytics and UK law.** Corrected, see §3.1: the "statistical purposes" exception has
  conditions, and "cookieless" is not the test.
  - Cloudflare Web Analytics says it uses no cookies, no local storage and no fingerprinting, and
    counts visits, not unique users. https://developers.cloudflare.com/web-analytics/about/ [D]
  - The careful reading [I]: treat it as needing the exception's notice and a free way to object.
    UK GDPR applies either way.
  - Ad pixels (Meta, Google Ads conversion tracking) still need consent.

### 1.6 A weekly routine (one focus brand)

| When | Yu | Agents |
|---|---|---|
| Mon, 20–45 min | Read the one-page digest; pick what to try | Compile the digest from exports Yu provides and public pages |
| Tue, 60 min | One merchant conversation | Notes and tagged quotes (with consent) |
| Thu, 30–45 min | Approve, edit or reject the review pack | Gates run *before* Yu sees anything |
| Fri, 45–60 min | 5–10 personal messages; reply to what's waiting | Draft messages from verified claims only |
| Monthly | Positioning sanity check | Funnel, claim-expiry and entity-drift page |
| Quarterly | Re-rank channels; brand-tier review | Surface audit: OG, favicon, canonical, analytics |

The routine is assembled from practitioner sources [S] and adapted [I]. Nothing outward happens
without Yu.

### 1.7 How much autonomy agents get

The Canadian Marketing Association's *Managing AI Agents in Marketing* (August 2026) sets three tiers
[O, thecma.ca PDF]:

| Tier | Covers | Rule |
|---|---|---|
| Full autonomy | Data processing, reports, scheduling | Internal and low-risk only |
| Human in the loop | Drafts, campaign builds, variants | A person signs off before anything publishes |
| Human-led | Brand strategy, crisis, legal, planning | A person leads |

Its rule of thumb: "if it touches a customer's trust or your brand's public face, a human stays in
the loop." The estate's ground rule is stricter on outward acts, and the estate's rule applies.

---

## 2. The agentic era: evidence against hype

### 2.1 AI search

- **Google says no special work is needed.** Its "AI features and your website" page (updated
  2025-12-10) says there are "no additional requirements to appear in AI Overviews or AI Mode", "no
  special schema.org structured data", and no new AI text files. Source:
  https://developers.google.com/search/docs/appearance/ai-features [O]
- **Manipulating AI answers is spam.** Google's spam policies include "attempting to manipulate
  generative AI responses in Google Search". Source:
  https://developers.google.com/search/docs/essentials/spam-policies [V-corr]
  - The clarification dates from **May 2026** (the 15 May update-log entry), not August.
  - The page's 2026-08-28 date reflects an EEA site-reputation change.
- **Fact-check AI content.** Google's generative-AI guidance (updated 2026-10-01) says to fact-check
  all AI-generated content, including titles, alt text and structured data. Source:
  https://developers.google.com/search/docs/fundamentals/using-gen-ai-content [O]
- **GEO tricks have no stable effect.** Martinez, arXiv 2607.14035 (v1 2026-07-15, a preprint, not
  peer-reviewed) reviewed 45 studies and found "no reviewed technique shows a stable, longitudinal,
  cross-platform causal effect on organic discoverability". The only supported effect is on how
  already-retrieved content gets used [V].
- **Measurement is noisy.** Daily source overlap is about 0.34–0.42 (Jaccard). The survey suggests
  7–8 repeats per prompt [O, agentic-meta §1.2].
- **llms.txt shows no effect.** SE Ranking studied about 300,000 domains: 10.13% have the file, with
  no correlation to AI citations. The study is observational (page dated 2026-10-15). Source:
  https://seranking.com/blog/llms-txt/ [V]
- **Mentions correlate with AI visibility.** Ahrefs studied about 75,000 brands: branded web mentions
  correlate 0.664 with visibility in Google AI Overviews, against 0.218 for backlinks.
  - This is correlation only, and for AI Overviews only.
  - A follow-up on 2025-12-12 found 0.66–0.71 across ChatGPT, AI Mode and AI Overviews.
  - Sources: https://ahrefs.com/blog/ai-overview-brand-correlation/ and
    https://ahrefs.com/blog/ai-brand-visibility-correlations/ [V]
- **Fewer clicks, better visits.**
  - Pew (July 2025): people clicked a result 8% of the time when an AI summary showed, against 15%
    without one [S].
  - Adobe (2026-04-16, via TechCrunch): AI-referred US retail visits converted 42% better in March
    2026, but they are a small share of traffic [S].
- **Crawlers.**
  - The search-purpose bots are OAI-SearchBot (OpenAI), Claude-SearchBot and Claude-User (Anthropic)
    and PerplexityBot [D].
  - Cloudflare has blocked known AI crawlers by default on new domains since July 2025 [S].
  - cambridgetcg.com's robots.txt allows them. Whether Cloudflare lets them through needs Yu's
    dashboard [O, unknown].

### 2.2 Agentic commerce

- **ChatGPT.** It is now a "discovery-focused referrer": buyers complete the purchase on the
  merchant's own checkout. Source:
  https://help.shopify.com/en/manual/online-sales-channels/agentic-storefronts/chatgpt [V]
  - The March 2026 retreat from Instant Checkout is dated only by trade press (Shopifreaks,
    2026-03-09). openai.com returned 403.
- **UCP (Universal Commerce Protocol)** [V-corr]. Sources: https://ucp.dev/ and
  https://github.com/Universal-Commerce-Protocol/ucp
  - It is active and co-developed by Google, Shopify, Etsy, Wayfair, Target, Walmart, Amazon,
    Microsoft, Meta, Salesforce and Stripe.
  - Releases run v2026-01-11 to v2026-08-25.
  - A **Loyalty extension** exists (merged 2026-05-19). It recognises existing members: tier,
    benefits and rewards earned. Redeemable balances and stored value are out of scope.
  - Google lists "account linking for loyalty programs" as upcoming.
  - Store counts ("about 8k") are [U]. A self-published tracker's "7% of test checkouts completed" is
    also [U].
- **Shopify AI channels** [V-corr]. Source:
  https://help.shopify.com/en/manual/online-sales-channels/agentic-storefronts/
  - **ChatGPT:** the store must sell to US customers, but may be based elsewhere.
  - **Google AI Mode / Gemini direct checkout:** the store must be US-based and sell to US buyers.
  - **Copilot direct checkout:** US buyers only.
  - **Meta:** US, Canada and Mexico.
  - Buyers elsewhere can still discover products and are sent to the store.
  - **"Loyalty or rewards experiences" checkout blocks are unsupported in Google AI Mode/Gemini and
    Copilot direct checkout.**
- **Shopify Agentic plan** [V-corr]. Source: https://www.shopify.com/agentic-plan
  - It is for businesses that don't use a Shopify online store.
  - It has no monthly fee, but it is not free: card rates apply per sale.
  - AI-channel selling is off until the merchant opts in, and business verification is required.
- **Agent-readable catalogues.** Shopify Catalog exposes UCP MCP endpoints (`search_catalog`,
  `get_product`), on by default for eligible merchants. Source:
  https://shopify.dev/docs/agents/catalog [O]

### 2.3 Sidekick and Built for Shopify

- **Sidekick app cards.** Sidekick shows up to three app cards for broad queries, or one highlighted
  card for a strong match. Source:
  https://shopify.dev/changelog/app-recommendations-in-sidekick-now-available (2025-09-17) [V-corr]
  - The cards are built from App Store listing content.
  - The Built for Shopify badge "improves search ranking in both the App Store and Sidekick".
- **Sidekick app extensions** opened 2026-06-17, with 18 partners, six of them named. Source:
  https://shopify.dev/changelog/sidekick-app-extensions-available-today [V-corr]
  - **Smile's loyalty extension** went live 2026-06-18.
  - **Yotpo's extension is for Reviews, not loyalty.**
  - One developer reports Sidekick "consistently suggests the same 2-3 apps per category"; this is
    an anecdote [O, community.shopify.dev].
- **Built for Shopify (BFS) eligibility** [V-corr]. Source:
  https://shopify.dev/docs/apps/launch/built-for-shopify/requirements
  - at least 50 net installs from active shops on paid plans (1.2.1);
  - at least five reviews (1.2.2);
  - a minimum recent rating; no number is published;
- admin performance at the 75th percentile with at least 100 calls per 28 days (LCP ≤2.5 s, CLS ≤0.1,
  INP ≤200 ms), the storefront Lighthouse score dropping by at most 10 points, and the latest App
  Bridge [D, channels §B]. Same source page.
- **"Paid plans" means the merchant's paid Shopify plan**, not the app's. Free-only apps hold the
  badge: Canva Connect, and RT: Disable Right Click. Dev and test stores don't count. So a free-only
  RewardsPro can qualify.
- **Rule 4.3.5:** don't mark AI features with the Sidekick icon or Shopify's "magic purple".
- **What BFS brings:** higher ranking, the badge, a search filter, eligibility for curated
  collections and "Picked for you", and priority review. Status is reviewed yearly. Source:
  https://shopify.dev/docs/apps/launch/built-for-shopify [D]

### 2.4 Agents in the workflow

- **"AI ads beat human designers when generation runs in a loop with brand checks"** (a 2026
  *Marketing Science* paper reported by EurekAlert on 2026-08-04): **[U]**. The fact-checker could
  not reach the paper. Don't use it until someone holds the paper and has checked it.
- **"Labelling ads as AI cuts clicks by about 31%"** (an NYU/Emory field test, reported by
  the-decoder.com): **[U]**. Don't use it.
- **Forrester (2026-06-03).** Most enterprises are adopting agentic AI, but few run it in real
  production. Its advice: "bounded tasks behind approval gates and rollback paths". [O]
  https://www.forrester.com/blogs/the-state-of-agentic-ai-in-2026-companies-are-chasing-few-are-catching/
- **Gartner (June 2025)** predicts that over 40% of agentic AI projects will be cancelled by the end
  of 2027 [S].
- **Google Pomelli** (free, experimental) builds on-brand assets from a website. It reportedly reached
  the UK around April 2026 [S]. A known caveat: it alters product details such as colours, logos and
  textures [S].
- **The CMA's AI-agent guidance** ("Using AI agents: complying with consumer law", 9 March 2026). A
  business is responsible for its AI agent's conduct, even when a third party built it. Tell
  customers they are dealing with AI where they could otherwise be misled. Source:
  https://www.gov.uk/government/publications/complying-with-consumer-law-when-using-ai-agents [V]

### 2.5 What follows [I]

1. **Be described accurately; don't chase rank.** That means:
   - one consistent entity description;
   - specific, dated facts;
   - crawlable pages;
   - real mentions earned from others.
2. **For a Shopify app, the agent channel is Sidekick.** It reads the listing, so the listing must be
   true and specific. Built for Shopify plus genuine reviews are what move it.
3. **Agent checkout is not a channel for RewardsPro now.** It is US-first, and loyalty blocks are
   unsupported in two of the channels. Track UCP Loyalty instead.
4. **Agents are good at bounded, checked production.** Unattended publishing is the bad case.

---

## 3. Rules: do and don't (UK first, then EU, US, platforms)

### 3.1 United Kingdom

**Advertising (ASA/CAP Code)**
- **No blanket duty to disclose AI use.** The test is whether the audience would be misled without
  disclosure, and disclosure cannot rescue a misleading ad. Source: ASA, 2025-05-29,
  https://www.asa.org.uk/news/disclosure-of-ai-in-advertising-striking-the-balance-between-creativity-and-responsibility.html
  [O]
- **The advertiser is responsible for AI output.** A realistic AI celebrity "endorsement" is likely
  a breach. Source: ASA, 2026-06-11 [O]
- **Rules that bind assets.** Source:
  https://www.asa.org.uk/type/non_broadcast/code_section/03.html [O]

  | Rule | Requires |
  |---|---|
  | 3.1 | Don't mislead |
  | 3.7 | Hold documentary evidence *before* an objective claim runs |
  | 3.11 | Don't exaggerate capability |
  | 3.30 | No false "limited time" |
  | 3.45 | Disclose incentivised reviews |
  | 3.46 | Don't cherry-pick reviews |
  | 3.47 | Hold evidence that testimonials are genuine |
  | 3.50 | Get permission for testimonials |
  | 3.52 | No unauthorised trust marks |
  | 3.23–3.24 | Rules on the word "free" |
  | 2.1 and 2.4 | Ads must be identifiable as ads |
  | Section 8 | Prize promotions: significant conditions, a free entry route, verifiable random draws |

**Consumer law (DMCC Act 2024, enforced directly by the CMA)**
- **In force since 6 April 2025** (SI 2025/272). Fake reviews and reviews that conceal an incentive
  are banned (Sch 20 para 13). The headline price must include all mandatory fees: the ban on *drip
  pricing* (s.230(4)). [V]
- **Reviews** (CMA guidance CMA208, 2025-04-04) [O]:
  - inviting all customers to review, without steering the sentiment, is fine;
  - discounts for five-star reviews are banned;
  - asking only satisfied customers to review ("review gating") is banned;
  - suppressing genuine negatives is banned.
- **Fines.** Penalties reach 10% of global turnover [D]. [V-corr]
  - The **first use** of the new fining powers was Euro Car Parks, £473,000 (published 2026-02-13),
    for failing to answer an information notice. It is under appeal.
  - The **first consumer-law penalty** was the AA, £4.2m (2026-04-15), for drip-pricing a £3 booking
    fee.
  - The CMA reports over £11.8m in fines since April 2026 (blog, 2026-10-14).
- **Open investigations.** On 2026-03-27 the CMA opened fake-review investigations into five
  businesses, including Pasta Evangelists, examined for discounts in exchange for 5-star reviews. As
  of 2026-10-14 there is no outcome, so imply no wrongdoing. Source:
  https://www.gov.uk/government/news/fake-and-misleading-reviews-5-businesses-under-cma-investigation
  [V]

**Data and email (PECR, UK GDPR, Data (Use and Access) Act 2025)**
- **The DUAA's PECR changes** came into force on 5 February 2026 (SI 2026/82). They added new
  storage-and-access exceptions, and the maximum PECR fine rose from £500,000 to £17.5m or 4% of
  turnover [V].
- **The ICO's statistical-purposes exception** (guidance finalised 2026-04-29) needs **all** of these
  [V-corr]:
  - the sole purpose is statistics on use of your own service, to improve it;
  - data is shared only with a processor helping with that;
  - users get clear, comprehensive information;
  - users get a simple, free way to object, and the storage or access stops if they do;
  - you don't rely on browser settings.

  It doesn't cover tracking individuals, cross-service monitoring or any ad use. "Cookieless" is not
  the test: pixels, local storage and fingerprinting all count. Source:
  https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/what-are-the-exceptions/
- **Email to individuals** needs consent or the *soft opt-in*: details collected during a sale, the
  marketing is for similar products, and there is an opt-out at collection and in every message.
  Never hide your identity. [O, ICO]
- **Business-to-business email.** Source:
  https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/business-to-business-marketing/
  [O]
  - Limited companies are outside the PECR email rule.
  - **Sole traders and some partnerships count as individuals.**
  - Named business emails are still personal data: you need a lawful basis, and people keep an
    absolute right to object.
- **Prize draws** avoid gambling licensing only with a genuine free entry route (Gambling Act 2005
  Sch 2) [D]. RewardsPro's own code comment explains why its points-paid raffles and mystery boxes are
  paused: no free entry route, published odds or age check [O, honesty-tooling §2.9].

**Do:**
- Hold evidence for every objective claim (CAP 3.7).
- Show the total price.
- Use real deadlines only.
- Invite *all* customers to review, in neutral words.
- Cold-email limited companies only, with your identity, an opt-out and a legitimate-interest note.
- Put an analytics paragraph and an objection route in the privacy notice.

**Don't:**
- Write or "improve" reviews with AI.
- Show only five-star reviews.
- Use restarting countdowns.
- Cold-email sole traders.
- Set ad cookies before consent.
- Run paid-entry chance draws.

### 3.2 European Union (reaches us where output is used in the EU)

- **Article 50 of the AI Act applies from 2 August 2026,** to every in-scope system, whenever it was
  placed on the market. Source: Commission guidelines C(2026) 5054 (2026-07-20), para 153 [V].
- **The AI Omnibus delayed only one duty** [V-corr]. Regulation (EU) 2026/1744 (OJ 2026-07-24):
  - providers whose generative systems were **already on the market before 2 August 2026** have until
    2 December 2026 for machine-readable marking;
  - systems placed on the market later must mark output from day one;
  - **deployer duties** (deepfake labels, public-interest text) and the chatbot disclosure were
    **not** deferred.
- **AI product images can be deepfakes.** The guidelines list as a deepfake an AI image that makes a
  product look different, more appealing or better than it really is. Source: C(2026) 5054, pp.
  34–37 [V]
  - The label must be visible or audible at first exposure. Machine-readable marks alone don't count
    (para 117).
  - Not deepfakes: aesthetic colour correction, background swaps or extensions, compositions of real
    products, rescaling, and a real product on an AI background, unless the ad misleads about the
    product.
  - A company that only commissions an agency is not the deployer; the agency is.
- **Reach to a UK business.** A third-country deployer is bound where EU use is foreseeable,
  "including by posting deep fakes on the globally accessible internet" (para 13) [O]. UK-only ad
  targeting reduces this exposure; an organic global post does not [I].
- **AI-written ad text** is outside the labelling duty, unless it informs the public on matters of
  public interest, or makes health, safety or sustainability claims without human editorial review [O].
- **Other EU rules** [D]:
  - Fines reach €15m or 3% of turnover, with proportionality for SMEs.
  - The green-claims rules (Directive 2024/825) apply from 2026-09-27.
  - A Digital Fairness Act is expected; its timing is unverified.

### 3.3 United States

- **FTC rule on reviews and testimonials** (16 CFR 465), effective 2024-10-21. It bans fake reviews,
  sentiment-conditioned review incentives, undisclosed insider reviews and review suppression [V].
  Incentives are allowed only if not tied to sentiment, and should be disclosed [O, FTC Q&A].
- **Endorsement Guides:** put "#ad" first in a post; a disclosure in the comments is not enough [O].
- **CAN-SPAM:** every commercial email needs an opt-out, honoured within 10 business days, and a
  physical address [D].
- **New York synthetic performers.** From 2026-06-09 (the date is calculated), an ad must
  conspicuously disclose a synthetic performer the creator knows about. Penalties are $1,000, then
  $5,000. Audio-only ads and translation-only uses are exempt [V].
- **US marketing SMS:** consent law (TCPA) is in flux, so hold off until consent capture is designed
  [S].

### 3.4 Platforms

**Shopify App Store.** Source:
https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements [V]

| Rule | Says |
|---|---|
| 1.3 | Honest reviews. Published 2026-07-06, effective 2026-07-07. Incentivised reviews were always against policy. |
| 1.3.1 | No incentives, and no withholding of features, for reviews, whether in the app or outside it |
| Consequences | Removal of "a significant portion" of reviews, demotion or delisting, or termination of the Partner account. Shopify is also unpublishing reviews that fail authenticity checks. |
| 4.3.3, 4.3.4 | No statistics, and no "first, best or only" |
| 4.3.6, 4.3.7 | No reviews or testimonials in the listing |
| 4.2.2, 4.2.3 | Pricing only in the pricing section |
| 4.4.3 | No Shopify marks in images [D, not fact-checked] |
| 4.1, 4.1.1 | One consistent app name; the listing name matches or is similar to the app's TOML name [D, not fact-checked] |

**Google Merchant Center** [V]:
- Images at least 500×500 from 2027-01-31; no overlays, watermarks or superimposed logos. Source:
  https://support.google.com/merchants/answer/6324350
- AI-generated images must carry metadata such as IPTC `DigitalSourceType` TrainedAlgorithmicMedia,
  and that metadata must not be stripped.
- The **Content API for Shopping** reached sunset on 2026-08-18. Calls without an extension
  intermittently return HTTP 410 from 2026-09-01, and it fully shuts down in early 2027. Any feed
  tool must use the **Merchant API**.

**eBay** [O, compliance P16–P17]:
- No pictures that misrepresent the item.
- No stock photos for used items.
- No added borders, text or watermarks.
- No third-party images or text without permission.

**TikTok:**
- Ads with undisclosed AI-generated content are "rejected or restricted". TikTok's AIGC label, or
  your own disclaimer, counts as disclosure. Minor edits are exempt. Source:
  https://ads.tiktok.com/help/article/tiktok-ads-policy-misleading-and-false-content (April 2026) [V]
- TikTok Shop UK (2026-08-28): base AI output on real product images; don't add glow, change size or
  invent features [O].
- TikTok Shop UK surprise products (2026-05-26) [O]:
  - 18+ only, under £100;
  - no "win", "chance" or "investment" wording;
  - show probabilities;
  - Lucky Spin and similar mechanics are banned.

**YouTube:** creators must disclose realistic AI content. YouTube may auto-label content made with its
own tools, content with C2PA data, or content it detects [V].

**Google Ads:** an AI-content label setting arrived on 2026-07-09. Visible on-ad overlays appear only
for campaigns targeting the EU, India or New York, and using the setting "doesn't guarantee
compliance" [V].

**Meta** [V-corr]:
- Meta labels ads made or significantly edited with **Meta's own** AI tools.
- Detection of third-party AI is rolling out gradually.
- Advertisers must self-disclose only for social-issue, election and political ads.

**Cardmarket:** no published rule on image content or AI was found [O].

### 3.5 Content provenance (C2PA)

- **No Craft app writes C2PA content credentials.** PhotoCraft issue #1050 is open, PR #6956 would
  only read them, and no Cargo.lock contains a c2pa crate [V].
- **Pipelines strip it.** Re-encoding with ffmpeg strips C2PA, and Cloudflare Images keeps it only
  with a per-zone toggle [O].
- **So the reliable layers are visible labels, platform toggles and our own sidecar record** [I].

---

## 4. Channel facts

### 4.1 RewardsPro (a Shopify app)

**The listing today** (https://apps.shopify.com/rewards-pro) [O]:
- Free; 0 reviews; launched 2025-12-16; developer Cambridge TCG Limited; no BFS badge.
- Its title still says "Raffles & Mystery Box Rewards".
- 3 letterboxed screenshots, one showing a real-looking test Gmail address; tier names in
  inconsistent case.
- A 16-second video with 4 views (as of 2026-10-18).
- Unverified feature claims: "real-time balances" and "Sell VIP Memberships as Products".

**The other surfaces.** rewardspro.io and the docs say paid plans are "retired"; the site spells the
name "Rewards Pro". There are four visual identities. Sources: brands-commerce §1, honesty-tooling
§2.9 [O].

**App Store search positions** (2026-10-18 captures) [D, brands-commerce §1a]:

| Query | Position |
|---|---|
| rewardspro | #1 |
| tcg | #18 |
| raffle | #23 |
| cashback rewards | #32 |
| cashback | #43 |
| mystery box | #70 |
| rewards pro | #103 |
| loyalty | #355 |
| store credit, vip tiers, trading cards | not found in the pages captured |

**Competitors** (2026-10-18 captures, USD) [O at capture, channels §B6]:

| App | Reviews | Free tier | Paid from |
|---|---|---|---|
| Smile | 4,639 | ≤200 orders/mo | $15 |
| Joy | 1,791 | ≤250 | $29 |
| Rivo | 1,441 | ≤200 | $15 |
| Appstle | 1,433 | ≤250 | $10 |
| LoyaltyLion | 541 | ≤400 | $199 |
| Essent | 493 | ≤250 | $10 |
| Koin | 180 | — | — |
| YOYO | 174 | ≤100 | — |
| Redeemly | 86 | ≤50 | $19 |

Store-credit cashback is **no longer unique**: Koin, Redeemly, GiftKart, Essent and YOYO claim it.
Young apps reached about 90–500 reviews in 18–24 months [I].

**Positioning hypothesis** [I]: "store-credit cashback and VIP tiers for card and collectibles shops".
- It rests on weak signals: the "tcg" search at #18, and one comic shop's review of a store-credit app
  ("we use store credit on a daily basis").
- Interviews must test it.

**Reviews in practice.** Source: https://shopify.dev/docs/apps/launch/marketing/manage-app-reviews [D]
- Only merchants who installed the app can review, or within 45 days of uninstalling.
- Ask after a real value moment, in neutral words; never during onboarding.
- No unsolicited review emails.
- Reply to every review.

**App Store ads:** pay-per-click auctions, published apps only, budgets in USD. An agency suggests
waiting for about 5–10 genuine reviews before spending [S].

**First installs.** One developer thread says they "rarely come from the app store" but from stores
the founder knows [S, anecdote].

**Revenue share:** 0% on the first US$1M of lifetime earnings, effective 2025-06-16 [S].

**Partners in the TCG niche** [O at 2026-10-18 capture]: TCG trade-in and inventory apps (TCG Importer,
Synq, Hobby TCG Trade-In, Furloop), each with 0–8 reviews. A documented integration with one of them
is a natural co-marketing route [I].

### 4.2 Cambridge TCG

**State** [D, ledger `be-business-facts`; O, brands-commerce §2]:
- Retail and the trade-in desk closed 2026-07-06, after 8 retail orders and zero trade-ins.
- Wholesale retired around 2026-07-05; wholesaletcgdirect.com redirects to cambridgetcg.com.
- New listings, bids and checkout have answered 410 since 2026-09-23.
- eBay shows 0 listings.
- The site presents "open-source TCG data infrastructure", with a "paid orders are retired" banner.
- On 2026-10-18 Yu said "TCG is generating revenue now" (quoted in ledger `be-business-facts`). No
  record shows the channel, so this stays open until Yu names it.

**Options, if a channel opens:**

| Channel | Fact | Tag |
|---|---|---|
| eBay UK, business sellers | 10.9% final value fee in Collectables and Toys & Games (CCG), plus £0.30 per order ≤£10 or £0.40 above (10p in some Collectables categories), plus a 0.42% regulatory operating fee. UK *private* sellers pay no final value fee. https://www.ebay.co.uk/help/selling/fees-credits-invoices/fees-business-sellers?id=4809 | [V-corr]; an earlier note said 0.35% |
| eBay price guide | Free, UK and US, TCG only (Pokémon EN/JP, Magic, Yu-Gi-Oh!, One Piece, Lorcana), up to two years of sold data plus PSA/CGC population data, app scanning. https://pages.ebay.co.uk/price-guide/ | [V]. The "1 September 2026" launch date is [U] |
| eBay Authenticity Guarantee | Cards of £500 or more, UK from May 2026 | [S] |
| Cardmarket (EU) | API closed to new applications. Commission unverified (about 5% plus a fee per third parties). VAT collected on UK orders ≤£135. | [D] / [S] |
| TCGplayer | International listing only for US and Canadian sellers | [D] |
| Whatnot UK | 6.67% + VAT commission, plus processing of 2.42% + £0.25. Seen only in search snippets (the pages blocked fetches), so confirm in Seller Hub. Its Shopify integration arrived April 2026. | [S] |
| TikTok Shop UK | Surprise-product and AIGC rules (§3.4). The collectibles commission is unverified. | [O] / [U] |
| Organised play | Play! Pokémon stores join free. The Wizards Play Network needs a standalone physical store. One Piece stores register through Bandai TCG+. An online-only seller partners with a venue instead. | [D] |
| Google Business Profile | Online-only businesses are not eligible | [D] |
| Google Merchant Center | Image rules in §3.4. A feed must use the Merchant API. | [V] |
| Shopify agentic storefronts | Don't apply: cambridgetcg.com is not a Shopify store (it is Next.js on Vercel) | [O] |

**Release calendar** (verify against official pages before use) [S]:
- Pokémon *Mega Evolution—Delta Reign* (EN) on 2026-11-06.
- MTG *Star Trek* on 2026-11-13.
- Pokémon EUIC London on 19–21 February 2027.
- UK card shows on 7, 14 and 21 November 2026; that data looked stale.

---

## 5. ArtCraft: maturity and risks

### 5.1 Two different things share the name

- **The Craft apps** are local Rust clones of Illustrator, InDesign, Figma, PowerPoint, Acrobat,
  Photoshop, Lightroom, After Effects, Premiere and Pro Tools, from github.com/storytold. They are
  licensed MIT OR Apache-2.0: all 9 checked repos declare it [V] (SoundCraft not checked). Bundled assets keep their own
  licences (OFL fonts, ISC icons). Every release ships an `<app>-cli` (93 of 93 releases). The CLI
  build is macOS universal only, except PdfCraft, which also ships Linux. Each README documents
  `<app>-cli mcp` [V].
- **ArtCraft the AI app** is a cloud front end, billed in credits ($10, $35 or $60 a month as listed
  on 2026-10-20), to about 62 third-party models through aggregators [O]. It has no CLI or MCP for
  agents.
  - Uploads and outputs default to **Public** in its source code; generation jobs hard-code Public
    [V; deployed behaviour unverified].
  - getartcraft.com links no terms or privacy policy, and its terms paths return 404 [V].
  - The only operator terms found (storyteller.ai, "Fakeyou.com | Terms and Conditions", last updated
    2022-11-18) grant an "unrestricted, unlimited, irrevocable, perpetual … sublicensable" licence
    over contributions [V]. Whether they bind ArtCraft users is unclear.
  - Some routes extract web-login cookies from consumer accounts (Grok, Midjourney and others), and
    bring-your-own API keys are stored as plain text files [O, code].
  - **Not for brand material.**
- **Trademarks.** The ArtCraft name, wordmark and mark are not open source. They may not appear in
  marketing for anything other than the app itself, nor suggest endorsement. A derived work may say
  "based on <App> by the ArtCraft team" [V].

### 5.2 The apps

Self-assessed figures are each project's own; nobody has checked them independently.

| App | Makes | Latest (2026-10-18) | Stage, self-assessed "ready for real work" | Installed here | Notes |
|---|---|---|---|---|---|
| VectorCraft | Vector art, logos, social, print | v0.13.1 | Alpha, about 62–65% | Yes, 0.13.1 | 785 commands; data sets plus batch; PDF/X; **no ICO writer**; WebP lossless only |
| PhotoCraft | Raster editing, compositing | v0.10.0 | Early alpha | Yes, 0.10.0 | Variables and data sets with image replacement; classical background removal; PSD round trip |
| DesignCraft | Page layout, data merge, QR | v0.9.0 | **Pre-alpha**, about 47% | Yes, 0.9.0 | PDF/X-4 not validated; two critical open issues |
| FigCraft | UI and landing mock-ups, tokens, code export | v0.7.0 | Alpha, about 53% | Yes, 0.7.0 | Online sharing uploads **unencrypted** to a server; don't use for unreleased work |
| EffectCraft | Motion, Lottie | v0.11.1 | Alpha | Yes, 0.11.1 | Template renders; Lottie export proven in the ai-love run |
| LightCraft | Raw develop, batch export | v0.9.1 | Alpha, about 61% day-to-day | Yes, 0.9.1 | Watermarks on export (not for marketplaces) |
| FilmCraft | Video editing, captions | v0.9.0 | Alpha, about 56% | **No** | "Social Vertical 1080×1920" preset; Whisper and TTS not in release builds; **no folder confinement** |
| DeckCraft | Decks, PPTX, GIF | v0.8.0 | Alpha, about 55% | **No** | Cannot insert SVG; "PPTX has never been tested on a corpus of real decks" |
| PdfCraft | PDF finishing | v0.9.0 | Alpha, about 49–55% | **No** | Combine, watermark, metadata; OCR models CC BY-SA |
| SoundCraft | Audio stings | v0.8.0 (2026-10-17) | Pre-alpha, about 40% | **No** | Bounces WAV, AIFF or FLAC only, with a LUFS report |

Sources: GitHub API reads and READMEs [V/D, artcraft-layout §2, artcraft-media §2];
`~/.local/share/artcraft/INSTALLED.tsv` [O].

### 5.3 Verified headless today (vectorcraft-cli 0.13.1, 2026-10-20) [O]

- A 1200×630 card in PNG, JPG and WebP.
- Favicon PNGs at 16, 32, 180 and 512, plus SVG, in one call.
- `palette.css` and `palette.ase`.
- An outlined SVG with 0 `<text>` elements.
- Three distinct 1080×1080 cards from three CSV rows. "£" and "%" rendered correctly.

All of it in under a second, writing only to the test folder.

**Gotchas found:**
- objects inherit the last fill;
- swatch exports include 53 default swatches;
- batch files are named "Untitled";
- Export for Screens adds both a scale token and a suffix to names;
- MCP with no flag attaches to a running app first.

### 5.4 Lessons from the 2026-10-09 ai-love brand kit run

That run used VectorCraft 0.7.0, PhotoCraft 0.5.0 and EffectCraft 0.6.0. It built 255 share cards in
37 seconds to 2 minutes with zero failures, plus marks, favicons and a 10.7 KB Lottie reveal, with
byte-identical rebuilds. Some bugs it found are fixed on newer releases; re-check before relying on a
workaround.

**Guardrails.** The run's guardrails (assert every selection, export single artboards with
`selectedOnly`, clear default strokes, pin `created`, check RGB against RGBA, and others) now live
with the `artcraft-brand` skill, re-checked per installed version; `~/.kingdom/tools/artcraft-brand/SKILL.md` points to them.
Follow the skill rather than this summary. The field report itself is `brand/ARTCRAFT-FIELD-REPORT.md` in
cambridgetcg/youspeak.

**Upstream.** Eight issues were filed on 2026-10-09 (vectorcraft #784–788, photocraft #1926,
effectcraft #440–441).

### 5.5 Risks [D/I]

- **Pace.** VectorCraft had about 1,900 commits a week recently. Command parameters change between
  releases, so pin versions, smoke-test every upgrade, and keep the CSV-and-template contract
  renderable by a non-ArtCraft fallback.
- **Popularity numbers aren't quality.** Star counts (10k to 69k in three weeks) are not a quality
  signal.
- **Exchange with outside designers and printers is weak.** There is no reliable `.ai` round trip,
  and PDF/X output is not validated, so preflight anything for a printer independently.
- **The installed recipes are old.** The YOUSPEAK and artbitrage recipes were built on VectorCraft
  0.7.0 and have not been re-run on 0.13.1.

---

## 6. Estate brand inventory (observed 2026-10-20)

### 6.1 What is selling

- **Almost nothing.** Commerce sites say paid offers are retired: cambridgetcg.com, rewardspro.io,
  agenttool.dev and axiepro.io.
- **The RewardsPro listing** is the one live offer, and it is free.
- **Free with no account:** fomoengine, captioneer, mindicraft and cashloom.
- **Retired on 2026-09-23:** every `marketing-outreach` record in the estate map is "designed only" or
  "retired". rewardspro-marketing, first-customer-push and others were retired by an agent sweep that
  has no Yu decision record.
- Sources: brands-agent-kingdom §0, brands-commerce §0, be-main `estate/curated/capabilities.toml`
  [O/D].

### 6.2 Identity and plumbing

- **There are 16+ identities and no shared mark.** The palettes form five clusters [O,
  brands-agent-kingdom §3]:

  | Cluster | Look | Members |
  |---|---|---|
  | Warm paper book | The de facto house style: paper, ink, one ember accent, serif | agenttool, mindicraft, fomoengine, captioneer, artbitrage by day |
  | Night hall, gilded | Dark ground, gold lamp, vermilion seal, CJK serif | thekingdom.dev, ai-love, sinovai, mythseal |
  | Rose love-letter | Rose and paper | chillspace and we-are |
  | Crypto neon | Violet and acid green | zerone.ai |
  | Template SaaS | Tailwind and Geist defaults | axiepro.io |

- **Shared motifs:** door, lamp, seal, circle-and-centre. The voice is shared too: gentle,
  consent-first, and openly honest about the state of things ("Honest state", "Nothing is invented").
- **Missing plumbing:**
  - 10 of 15 live agent/kingdom sites have no `og:image`;
  - four have no favicon;
  - fomoengine.io and axiepro.io serve the stock Next.js favicon;
  - no site links a social profile;
  - none captures email;
  - no analytics script appears in the HTML of the commerce sites checked; only the App Store
    listing carries an analytics tag [O].
- **Commerce-specific gaps** [O, brands-commerce §1–3]:

  | Brand | Gaps |
  |---|---|
  | RewardsPro | 4 looks, 2 spellings; no `og:image`; data-URI favicon; no `llms.txt` |
  | Cambridge TCG | 4 looks, 2 marks; `og:image` 1702×630 while declaring 1200×630; Twitter image 1500×500; 285 KB `favicon.ico`; no home canonical; no server-rendered JSON-LD; sitemap still lists retired pages; `/rewards` still renders "Pack Opening — Daily Spin" |
  | prices.cambridgetcg.com | Still says "Free daily price guide" and "Shop", though collection stopped 2026-07-12 |
  | TaxSorted | Live and coherent, but no OG, canonical or JSON-LD; Vercel default favicon |

- **Strong points to build on:**
  - artbitrage has the group's most complete icon set and best share cards, made with ArtCraft.
  - ai-love.cc has a full kit, a seal page and JSON-LD.
  - cambridgetcg.com has excellent agent surfaces (llms.txt, OpenAPI, MCP docs). Its MCP is custom
    JSON-RPC, not standard MCP, so standard clients can't connect.
  - cambridgetcg.com's credited Met Open Access Sharaku print is a rights-clean visual language.

### 6.3 Risks and flags

- **Two money domains are down.** zerone.money and legible.money return HTTP 424 from Codeberg Pages,
  and the hub still links to them [O].
- **Brand safety.** chillspace.love opens with a personal letter, not customer-facing material.
  thekingdom.dev links to it and also lists Cambridge TCG [O]. This is the reason for the proposed
  one-way link rule.
- **Voice bleed.** "Love is the design" appears in rewardspro.io's footer, and KINGDOM text sits in
  cambridgetcg.com's robots.txt and llms.txt. AI summaries of "what is Cambridge TCG" read these
  [O/I].
- **Name collisions:** Cashluom (near CashLoom), Zerion and ZeroNet (near Zerone), and Artbit. Owning
  a domain is not trademark clearance [O].
- **Stale hub text.** thekingdom.dev still calls Artbitrage "wine & cigar arbitrage" and FOMOEngine
  "the signal-scanner" [O].
- **Repository visibility mismatch.** The mythseal repository answers the unauthenticated GitHub API
  (public), while its README says private. This is a flag only; changing visibility is Yu's act [O].
  Reported to the lane that owns the ledger item `forge-visibility` (the names-only scan of public
  repos), because a repo believed private may hold credentials.

### 6.4 Existing creative assets

- **The YOUSPEAK font, glyphs and seal kit.** It is CC BY-SA 4.0, so it is a poor base for a
  commercial trademark and stays in R3 [O].
- **The artbitrage collection.** CC0 and public-domain works with provenance [O].
- **agenttool's "one hearth" theme tokens** (2026-10-17). These are the natural seed for R2 [O].
- **The citizens codex** (54 entries drawn from many traditions). It needs a cultural-sensitivity
  review before any commercial use [I].
- **mythseal.** An original Eastern-fantasy card game. It is the estate brand closest to a card
  audience [O].
- **nen-artifacts.** Derived from Hunter × Hunter; keep it out of commercial assets [O].

### 6.5 Honesty tools (the gates' raw material)

| Tool | State on 2026-10-20 | Gate use and limits |
|---|---|---|
| fomoscan (`fomo_scan`, api.fomoengine.io) | Live, free. 11 rules. Text or HTML only; URL fetch is paused. | Pressure gate. Scores: honest copy 8, pressured 34–52. Misses counted social proof and price-rise threats. Cites FTC/CMA/EU, not CAP or DMCC. |
| fomoengine Shield | 13 dark-pattern categories | Offer and flow gate. Its optional AI pass sends text to a model provider, so use rules-only for drafts. |
| Attention Lab API | Catalogue live; brief API blocks missing proof or scarcity (`blocked:true`) | The brief contract; descriptive comparisons, never "winners" |
| RhetorLint | Local CLI 0.2.0 on main (22 rules); npm `latest` is older (CLI 0.1.1), and publishing is Yu's call | Wording gate (`--max`, SARIF). Not a truth detector. Missed "The best … app" and "spots are limited" in a test. |
| Truth Release | Example, runs offline. One sourced claim becomes 7 social-channel drafts and stops at "prepared, not approved, not published". | Claim format and approval boundary. No email, listing or ads channel yet. |
| Claim Feedback | Live example page | Correction door |
| whitehack-scan 0.10.0 | Published | Checks that code backs product claims (`cache-as-live` for "real-time") |
| kingdom_research_plan / check | Live | Bounded substantiation for empirical claims. Does not prove truth. |
| kingdom_commons | Live | Rights-clean imagery sources |
| XENIA rights 0.1 | Pinned | No manufactured urgency; consent; data care; provenance; repair |
| RewardsPro code | `CHANCE_MECHANICS_PAUSED = true`; marketing consent defaults off; SUBSCRIBED-only; signed unsubscribe | The model consent and legal gate. A "raffle psychology" service is present but paused. |

Source: honesty-tooling §1–§5 [O/D].

**The gap is a claims ledger.** Both scanners refuse to judge truth by design, and both scored the
listing's description 0.

### 6.6 What earlier marketing attempts teach

- **rewardspro-marketing** (2026-03 to 09-23) [O/D, brands-commerce §5]:
  - Its "wave engine" was keyed to installs while installs were 0.
  - It needed several paid accounts.
  - Its copy claimed things later decisions contradicted ("14-day free trial").
  - It planned "3 months Pro for a review", which Shopify forbids.
  - Reusable: the rule "never put text in generated images; composite it deterministically".
- **first-customer-push** stalled at the steps that needed Yu's hand [O].
- **saas-marketing-suite** was over-built for zero users, is AWS-bound (D6), and has a FOMO module
  that contradicts the estate's own anti-FOMO tool [O/I].
- **claude-design-bridge** (monorepo) is the most reusable pattern: a design-system handoff, then a
  generator, then a deterministic 12-check scorer, then a human gate [O].

### 6.7 Facts only Yu holds

- **Cambridge TCG's earning channel** (`be-business-facts`, parked).
- **Whether any social accounts exist** beyond the @CambridgeTCG YouTube channel. Its one video
  appears unlisted.
- **Who reads the listing's analytics property.**
- **Cloudflare bot settings** on rewardspro.io and cambridgetcg.com.
- **Whether the Shopify store behind ShopifyTheme_TCG is still open.** It returned HTTP 429 on
  2026-10-20.
