# Rules that bound AI-assisted marketing: UK seller with EU and US reach (as of 2026-10-20)

Key: `compliance`. Written by an agent (Claude, research subagent) on 2026-10-20 for Yu. This is
read-only research, not legal advice. Nothing was installed, posted or sent.

**Basis tags.** *observed* means I read the primary text or the repository myself today, and the
claim is what it says. *documented* means a source says so, often a secondary source such as a law
firm or vendor, or a page talking about facts beyond itself. *inferred* means my own reasoning.

Local extracts of three primary PDFs, made today with `pdftotext`, are in
`/private/tmp/claude-501/-Users-yournameisai/b3c581a3-a92d-4da1-b779-a0867505bf64/scratchpad/mkt/compliance-src/`:
- `eu-art50-guidelines.txt`: the Commission's Article 50 guidelines, C(2026) 5054 final, 20 July 2026.
- `cma208-fake-reviews.txt`: the CMA's fake reviews guidance (CMA208), 4 April 2025.
- `meta-2026-us-elections.txt`: Meta's 2026 US elections approach (PDF last modified 2026-02-19).

---

## 0. The short version: what an agent making marketing assets must hold

1. **Truth beats labels.** No label fixes a misleading asset. The ASA (29 May 2025), the EU guidelines
   (para 129) and TikTok's ad policy all say so. The rule that actually governs is: don't show a product,
   result, price, stock level or endorsement that isn't true.
2. **Product imagery for the EU.** An AI image that makes a real product look different from, better
   than, or of higher quality than reality is a **deepfake** under the EU AI Act. It must carry a visible
   label at first exposure (from 2 Aug 2026), and it is probably misleading advertising anyway. A real
   photo of the product on an AI background is fine as long as it doesn't mislead. Colour correction,
   re-scaling and aesthetic background swaps are treated as minor edits.
3. **Synthetic people need a label everywhere you advertise.** This covers realistic AI people,
   avatars, "customers" and influencers. Labelling is mandatory under EU Art 50(4) for EU audiences,
   under New York GBL §396-b (from 9 Jun 2026), on TikTok ads, and in YouTube's disclosure setting. In
   the UK it is likely needed to avoid misleading people. Never make a real or celebrity likeness without
   written permission.
4. **No fake, AI-written or sentiment-conditioned reviews or testimonials.** This holds in all three
   jurisdictions and on Shopify. You may incentivise *any honest* review only if the incentive is
   disclosed (UK) and not conditional on sentiment (US). For the RewardsPro listing on the Shopify App
   Store, offer **no incentive at all**.
5. **Urgency, scarcity and price claims must be literally true.** Countdown timers must not reset.
   "Only 3 left" must be real. The headline price must include every mandatory fee. UK DMCC penalties
   reach 10% of global turnover, and the CMA's first fine was £4.2m (April 2026).
6. **Email and SMS (UK).** UK consumers need consent or the soft opt-in. Sole-trader merchants count as
   individuals. Every message needs an opt-out and the sender's identity. US: CAN-SPAM opt-out within 10
   business days.
7. **Keep provenance metadata intact.** Google Merchant Center requires AI images to carry the IPTC
   `DigitalSourceType`. Re-encoding, for example through ffmpeg or some CDNs, strips C2PA. ArtCraft's
   editors cannot write C2PA yet (observed). So visible labels and a provenance ledger are what you can
   rely on.
8. **A human checks before publishing.** The CMA's AI-agent guidance (9 Mar 2026) says the business is
   liable for what its agent does and expects a human in the loop who reviews AI campaigns. The ASA
   says, in the words Lewis Silkin quoted, that automated tools do "not transfer responsibility". Human
   editorial review also exempts EU public-interest text from labelling.

---

## 1. EU AI Act, Article 50 (transparency)

### 1.1 Status and dates

| # | Claim | Basis | Source (date) |
|---|---|---|---|
| E1 | Article 50 applies from **2 August 2026** (Art 113). | observed | Guidelines para 153 (20 Jul 2026), local extract; Commission FAQ https://digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act (updated 24 Jul 2026) |
| E2 | The AI Omnibus, **Regulation (EU) 2026/1744**, entered into force on 27 Jul 2026. It gave **providers** of generative systems already on the market before 2 Aug 2026 until **2 Dec 2026** for the Art 50(2) machine-readable *marking* duty only. Deployer labelling (Art 50(4)) and chatbot disclosure (Art 50(1)) were not deferred. | observed (guidelines para 153 describes the grandfathering) + documented (OJ date and entry into force) | Guidelines para 153; https://www.euaiact.com/digital-omnibus-ai ; Steptoe via https://www.mondaq.com/technology/1824674/eu-ai-act-amendments-enter-into-force . I could not open the EUR-Lex text itself (empty fetch). |
| E3 | The Omnibus changed only Art 50(7), which is about codes of practice. Otherwise the Art 50 rules are unchanged. | documented | https://www.euaiact.com/digital-omnibus-ai |
| E4 | The Commission published final **guidelines on Art 50** on 20 Jul 2026, C(2026) 5054 final, after a draft on 8 May 2026. They are non-binding but steer national market-surveillance authorities. | observed (PDF header "Brussels, 20.7.2026 C(2026) 5054 final") + documented (draft date) | https://ai-act-service-desk.ec.europa.eu/sites/default/files/2026-07/guidelines_on_the_implementation_of_the_transparency_obligations_for_certain_ai_systems_under_article_50_of_the_ai_act_bzptwqhk0ikg1dtlddap41psfy_131215.pdf ; https://digital-strategy.ec.europa.eu/en/policies/guidelines-ai-transparency-obligations |
| E5 | The final **Code of Practice on marking and labelling AI-generated content** was published on 10 Jun 2026. It is voluntary and was assessed as adequate by the Commission and the AI Board. About 190 organisations had signed by the end of July 2026. Section 1 covers providers (marking); Section 2 covers deployers (labelling deepfakes and public-interest text). The EU publishes a set of icons deployers may use. | observed (Commission pages) | https://digital-strategy.ec.europa.eu/en/news/commission-publishes-code-practice-marking-and-labelling-ai-generated-content (updated 12 Jun 2026); https://digital-strategy.ec.europa.eu/en/policies/code-practice-ai-generated-content |
| E6 | Meta said on 28 Jul 2026 that it is signing the Code. | observed | https://about.fb.com/news/2026/07/meta-is-signing-the-eu-ai-act-code-of-practice-on-transparency-of-ai-generated-content/ |
| E7 | Fines for Art 50 breaches reach €15m or 3% of worldwide turnover, with proportionality for SMEs. | documented | Commission FAQ (above); McCann FitzGerald, 20 Aug 2026, https://www.mccannfitzgerald.com/knowledge/data-privacy-and-cyber-risk/ai-transparency-european-commissions-guidelines-on-article-50-part-2-deployer-obligations |

### 1.2 Does it reach a UK business?

| # | Claim | Basis | Source |
|---|---|---|---|
| E8 | Art 2(1)(c) covers deployers in a third country "where the output produced by the AI system is used in the Union". | observed | https://artificialintelligenceact.eu/article/2/ |
| E9 | Guidelines para 13 say third-country deployers are bound where they **foresee** EU use, "including by posting deep fakes on the globally accessible internet". They are not bound where content reaches the EU through channels that are unforeseeable and outside their control. Worked example: a third-country company using AI to make a celebrity deepfake for an ad shown in the EU is a deployer. | observed | Guidelines para 13–14 (local extract, lines ~275–300) |
| E10 | A company using AI "under its authority" is the deployer, even when freelancers or contractors operate the tool (para 14). A company that only commissions an agency, without controlling whether or how the agency uses AI, is not the deployer. | observed | Guidelines para 14 |
| E11 | **For Yu:** agents run under Yu's authority, and marketing runs on the open web and EU-targetable ad platforms. So Yu's businesses are deployers for any EU-reaching deepfake output. Targeting UK-only on ad platforms reduces exposure; an organic global website or social post does not. | inferred | from E8–E10 |

### 1.3 What counts as a deepfake in marketing (the part that bites)

| # | Claim | Basis | Source |
|---|---|---|---|
| E12 | A deepfake (Art 3(60)) is AI-generated or manipulated image, audio or video "that resembles existing persons, **objects**, places, entities or events" and "would falsely appear to a person to be authentic or truthful". | observed | https://artificialintelligenceact.eu/article/3/ |
| E13 | **Is** a deepfake: "An AI-generated image of a product in advertisement or packaging that can affect the audience's perception and mislead as to the actual product appearance, characteristics or use (e.g. making the product appear not identical to the real product, more appealing or with improved quality than in real life)." Also: an AI video of a celebrity influencer in an advertising context. | observed | Guidelines, examples box after para 116 (local extract, lines ~1680–1690) |
| E14 | **Not** a deepfake: "A real product (e.g., a car) shown in an advertisement against an AI-generated background … as long as the ad is not likely to mislead the audience about the product's actual representation". Not a deepfake either: an AI video of talking mice in a cheese advert, or obviously fantastical scenes. | observed | Same box |
| E15 | Minor edits are unlikely to be deepfakes: "AI-powered colour correction, background extensions …, adjustments or replacements of backgrounds for clearly aesthetic purposes, compositions and arrangements of existing products, or re-scaling of images applied in product advertisements". | observed | Guidelines para 116 |
| E16 | The lighter regime for "evidently artistic, creative, satirical, fictional" work rarely helps ads. Content whose nature is "exclusively informative or commercial and is recognisable as such" is excluded. Ads "might be regarded as evidently creative … in certain, specific situations, but not in others". Not artistic: teleshopping-style deepfake humans demonstrating a product, or a "realistic synthetic influencer testing out a sponsored real product". | observed | Guidelines para 122–123 and the examples after para 124 |
| E17 | The label must be **visible or audible**, "clear and distinguishable", and given at the latest at first exposure, for each output and each person exposed. It must not sit only in terms, menus or a manual. Deployers "cannot rely on the machine-readable marking" (C2PA or watermarks) alone. For video people may join part-way, so a label only at the start may not be enough. | observed | Guidelines para 117, 141–143 |
| E18 | Where a very large platform offers a labelling tool, a deployer can use it to meet Art 50(4) *within that platform*, but stays responsible. | observed | Guidelines para 126 (local extract, lines ~1885–1894) |
| E19 | **AI text.** Labelling applies only to text published "with the purpose of informing the public on matters of public interest". Outside scope: "AI-manipulated text that is part of a company's advertisement or product descriptions (not including any claims related to e.g. health, consumer safety or sustainability)". Text with real human review and an editor who holds responsibility is exempt. | observed | Guidelines, examples after para 134 (local extract, lines ~1975–1990); FAQ |
| E20 | Content made before 2 Aug 2026 need not be labelled retroactively, but older text *published* after that date must be labelled if it is in scope. Relabelling older deepfakes is encouraged. | observed | Guidelines para 154 |
| E21 | Labelling a deepfake does not make it lawful. Misleading-advertising law, IP and trademark law, personality rights and GDPR still apply. | observed | Guidelines para 127–129 |

**Do / don't for the agent (EU reach):**
- DO keep real product photography as the hero of every product asset. AI may make the background, scene,
  lighting and layout. Log which pixels came from AI.
- DO put a visible "AI-generated" or "Made with AI" mark (the EU icon or equivalent) on any EU-reaching
  asset with realistic AI people, or with an AI-rendered product or event that could pass as real.
  Use the platform's AI label toggle as well, not instead.
- DON'T AI-render a real product (a booster box, a graded slab, a specific card) as a photoreal image,
  improve its condition or centring, or add holo or glow effects it doesn't have. That is a deepfake
  *and* misleading.
- DON'T rely on the "creative" carve-out for ads.
- DON'T make health, safety or sustainability claims with AI-written copy unless a human has reviewed
  them and holds editorial responsibility.

### 1.4 Adjacent EU rules worth knowing

| # | Claim | Basis | Source |
|---|---|---|---|
| E22 | The Empowering Consumers for the Green Transition Directive (2024/825) applies from **27 Sep 2026**. It covers vague environmental claims ("eco-friendly" without proof) and sustainability labels not based on a certification scheme. | documented | https://transition-pathways.europa.eu/legislation/directive-eu-2024825-empowering-consumer-green-transition ; CMS https://cms.law/en/int/legal-updates/recent-publication-of-directive-2024-825-on-empowering-consumers-for-the-green-transition |
| E23 | A Digital Fairness Act is expected, aimed at dark patterns, influencer marketing and unfair personalisation. Sources say the proposal is due in Q3 or Q4 2026; I found no published proposal. | documented (unverified timing) | https://www.mccannfitzgerald.com/knowledge/technology-and-innovation/digital-fairness-act-tackling-problematic-online-practices ; https://www.mlex.com/mlex/data-privacy-security/articles/2275804/eu-digital-fairness-act-set-for-early-2026-with-consumer-protection-in-focus |

---

## 2. United Kingdom

### 2.1 ASA / CAP Code and AI

| # | Claim | Basis | Source (date) |
|---|---|---|---|
| U1 | There is **no blanket UK legal requirement** to disclose AI use in ads. CAP's two questions: "Is the audience likely to be misled if the use of AI is not disclosed?" and "is the disclosure clarifying the ad's message or contradicting it?" | observed | ASA/CAP, 29 May 2025, https://www.asa.org.uk/news/disclosure-of-ai-in-advertising-striking-the-balance-between-creativity-and-responsibility.html |
| U2 | "disclosure alone is very unlikely to mitigate the harm caused by a fundamentally misleading message". Example: an AI image showing a cosmetic's effect that real use wouldn't achieve is misleading even if disclosed. Routine edits, such as removing background elements, are treated like traditional post-production. | observed | same |
| U3 | The CAP Code is media-neutral. An AI celebrity "endorsement" that looks real enough to mislead is likely a breach. The advertiser is responsible for AI output. Automated tools (Google auto-generated ads in Stripe & Stare) don't move responsibility. | observed | ASA, 11 Jun 2026, https://www.asa.org.uk/news/ai-and-deepfakes-four-things-advertisers-need-to-know-before-they-hit-run.html |
| U4 | CAP rules that bind assets: 3.1 (must not materially mislead); 3.7 (documentary evidence for objective claims); 3.11 (no exaggerating capability or performance); 3.30 (no false "limited time"); 3.45 (make clear where consumer reviews were incentivised); 3.46 (no cherry-picking reviews); 3.47 (hold evidence that testimonials are genuine); 3.50 (permission for testimonials); 3.52 (no unauthorised trust marks); 3.23–3.24 ("free"). | observed | https://www.asa.org.uk/type/non_broadcast/code_section/03.html |
| U5 | 2.1 "Marketing communications must be obviously identifiable as such". 2.3: don't pose as a consumer. 2.4: label advertorials. Influencer posts need "#ad" under CAP influencer guidance. | observed | https://www.asa.org.uk/type/non_broadcast/code_section/02.html |
| U6 | Prize promotions (CAP Section 8): state significant conditions (8.17: how to enter, free-entry route, closing date, prizes, eligibility, promoter name and address); draw winners by chance with verifiable randomness or independent supervision (8.24); award prizes as described, normally within 30 days (8.15.1); keep gifts and prizes clearly distinct (8.19). | observed | https://www.asa.org.uk/type/non_broadcast/code_section/08.html |
| U7 | 2026 ASA rulings on AI ads: a robot-toy ad (WiggyDog, about March 2026) upheld for exaggerating realism and function; an AI character in a gambling ad (Midnite, 16 Sep 2026) looked under 25. | documented | https://www.resultsense.com/news/2026-03-26-robot-puppy-facebook-ad-banned-asa/ ; https://cms.law/en/gbr/legal-updates/asa-rules-that-ai-generated-character-in-gambling-ad-appeared-to-be-under-25 |

### 2.2 DMCC Act 2024 (CMA direct enforcement)

| # | Claim | Basis | Source (date) |
|---|---|---|---|
| U8 | The DMCC unfair-commercial-practices provisions apply to conduct from **6 Apr 2025**. Fake reviews and concealed incentivised reviews are banned practice 13 in Schedule 20. | observed | CMA208 (4 Apr 2025), local extract; CMA207 https://www.gov.uk/government/publications/unfair-commercial-practices-cma207/unfair-commercial-practices (updated 18 Nov 2025) |
| U9 | Incentivised reviews are allowed **only if** the trader tells consumers the review was incentivised **and** the review reflects a genuine experience (CMA208 para 3.7). Inviting all customers to review "without predetermining the contents or sentiment" is fine (para 3.6). Banned: discounts for a five-star review; asking for five-star reviews on social media; paying for bot-written reviews. | observed | CMA208 paras 3.6–3.7 and examples (local extract, lines ~395–440) |
| U10 | Cherry-picking is banned, including "encouraging just those who are satisfied to leave reviews" (review gating) and suppressing genuine negatives (para 4.4–4.5). Anyone who publishes reviews, including on their own site, must take reasonable steps against banned reviews, including fixing "AI-generated review summaries" built on them. | observed | CMA208 paras 4.3–4.5, 8.2–8.3, ~8.22 |
| U11 | Drip pricing is banned: the invitation to purchase must show the **total price including mandatory fees**. False "limited time" claims are banned practice 7; a countdown timer that "restarts" is unlawful. A true "Be quick! We've sold 10 in the last 5 mins" can still mislead when stock is plentiful. | observed | CMA207 chapters 1, 3–5 |
| U12 | First substantive DMCC fine: **AA Driving School / BSM, £4.2m** (after a 40% settlement discount from £7m) plus £760k in refunds, for a £3 booking fee missing from the upfront price. Announced 15 Apr 2026. | observed (gov.uk release) | https://www.gov.uk/government/news/cma-orders-the-aa-and-bsm-driving-schools-to-refund-learner-drivers-over-drip-pricing |
| U13 | Five **fake-review investigations** opened on 27 Mar 2026: Autotrader, Feefo, Dignity, Just Eat and **Pasta Evangelists** ("Whether customers were offered discounts on future orders in exchange for leaving 5-star reviews"). Still open on 14 Oct 2026. | observed | https://www.gov.uk/government/news/fake-and-misleading-reviews-5-businesses-under-cma-investigation ; https://competitionandmarkets.blog.gov.uk/2026/10/14/direct-consumer-enforcement-18-months-on/ |
| U14 | As of 14 Oct 2026: fines of over £11.8m and over £2.3m in redress since April 2026. Gold's Gym, Wayfair and Buy It Direct paid over £6m between them. Priorities: drip pricing, "misleading time limited offers", fake reviews, misleading discounts, delivery-fee disclosure. "New technology does not change their responsibility to comply with consumer law." | observed | CMA blog, 14 Oct 2026 (above) |
| U15 | The maximum penalty is 10% of global turnover (or £300k if greater). | documented | https://www.fieldfisher.com/en/insights/first-financial-penalty-under-new-consumer-enforcement-regime-from-guidance-to-enforcement ; CMA AI-agents guidance |
| U16 | **CMA guidance "Complying with consumer law when using AI agents" (9 Mar 2026).** "you are responsible for what an AI agent does", even if a third party built it. Test before deployment, monitor, keep "a human in the loop". Worked example on a marketing campaign: the agent failed to make influencers label endorsements. The fix: "Someone with appropriate experience should review any AI-generated marketing campaign regularly" and "quickly refine the relevant prompts and workflows". Consider labelling AI agents that customers deal with. | observed | https://www.gov.uk/government/publications/complying-with-consumer-law-when-using-ai-agents/complying-with-consumer-law-when-using-ai-agents |
| U17 | The CMA says it uses agentic AI itself to find breaches. | documented | search summary citing gov.uk "Agentic AI and consumers" https://www.gov.uk/government/publications/agentic-ai-and-consumers/agentic-ai-and-consumers (not opened in full) |
| U18 | Government consultation "later this autumn" (2026) on adding fake "was" prices to the banned list. A new subscription-contracts regime "starts in January" according to the CMA's 14 Oct 2026 post; the year isn't stated, and January 2027 is my inference. | documented | Jones Day / Winston Taylor via search; CMA blog 14 Oct 2026 |

### 2.3 UK GDPR, PECR and the Data (Use and Access) Act 2025

| # | Claim | Basis | Source (date) |
|---|---|---|---|
| U19 | **SI 2026/82** (DUAA Commencement No. 6) brought s.112 (storage and access, i.e. cookies), s.114 (charity soft opt-in) and s.115 (PECR enforcement, aligning fines with UK GDPR) into force on **5 Feb 2026**. | observed | https://www.legislation.gov.uk/uksi/2026/82/made |
| U20 | The ICO says all DUAA data-protection provisions were in force by 19 Jun 2026. The Act clarifies that direct marketing *can* be a legitimate interest; it is not one of the new "recognised" legitimate interests. | observed | https://ico.org.uk/about-the-ico/what-we-do/legislation-we-cover/data-use-and-access-act-2025/the-data-use-and-access-act-2025-what-does-it-mean-for-organisations/ (updated 19 Jun 2026) |
| U21 | Cookies: five exceptions now apply, including **statistical purposes** (analytics, "sole purpose" of improving the service) and **appearance**. Both require clear information and an easy way to object. Analytics used for advertising falls outside the exception. Advertising and cross-site tracking still need consent. | documented (ICO pages via search; ICO guidance reported final in April 2026) | https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/what-are-the-exceptions/ |
| U22 | The maximum PECR fine is now £17.5m or 4% of turnover (UK GDPR level). | documented | https://usercentrics.com/knowledge-hub/data-use-and-access-act-2025-duaa-compliance/ (secondary); consistent with s.115 commencement (U19) |
| U23 | Email and SMS to **individual subscribers** need consent (a clear affirmative action, no pre-ticked boxes) or the **soft opt-in**. The soft opt-in needs: details obtained from the person, during a sale or negotiation, marketing only your own similar products, and an opt-out at collection *and* in every message. You must not hide your identity, and you must give a valid opt-out address. | observed | https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-direct-marketing-using-electronic-mail/how-do-we-comply-with-the-pecr-electronic-mail-marketing-rules/ |
| U24 | **B2B:** the PECR email rule doesn't apply to corporate subscribers (limited companies), but **sole traders and some partnerships count as individuals**. When unsure, treat the recipient as an individual. Named business emails are still personal data under UK GDPR (lawful basis plus an absolute right to object). If you buy lists, you must tell people you hold their data. | observed | https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/business-to-business-marketing/ (page notes it is under review for DUAA) |
| U25 | The ICO fined a company (Allay) £225,000 in January 2026 because it had no simple way to refuse marketing, which meant it could not rely on the soft opt-in. | documented | https://ico.org.uk/about-the-ico/media-centre/news-and-blogs/2026/01/fines-of-225-000-for-nuisance-marketing-messages/ (search summary) |
| U26 | UK prize draws avoid gambling licensing only with a genuine free entry route, such as first-class post (Gambling Act 2005 Sch 2). The DCMS voluntary Prize Draw Operators Code dates from November 2025, with an implementation deadline of 20 May 2026. | documented | https://www.gov.uk/government/publications/voluntary-code-of-good-practice-for-prize-draw-operators/voluntary-code-of-good-practice-for-prize-draw-operators ; https://cms.law/en/gbr/legal-updates/dcms-publishes-voluntary-code-of-good-practice-for-prize-draw-operators |

**Do / don't for the agent (UK):**
- DO run a claims check on every asset. Each objective claim ("fastest", "graded 10", "sealed", "only 2
  left", "£X saving") needs a linked evidence record (CAP 3.7).
- DO show the full price including fees on the first screen. Make "was" prices real past selling prices.
  Countdown timers only for deadlines that really end.
- DO email review invitations to *all* buyers in neutral wording. If an incentive exists, it applies to
  any review and the review carries a visible "incentivised" tag.
- DON'T write reviews, testimonials or "customer" quotes with AI. DON'T paraphrase real reviews into
  better ones. DON'T show only five-star reviews in a way that misrepresents the average.
- DON'T cold-email sole-trader merchants. Most small Shopify merchants may be sole traders (inferred).
  Cold B2B email to limited companies is allowed with clear identity and opt-out, and still requires
  UK GDPR legitimate-interest balancing.
- DON'T set advertising or tracking cookies before consent. First-party analytics can now rely on the
  statistical exception, with notice and an easy objection.

---

## 3. United States

| # | Claim | Basis | Source (date) |
|---|---|---|---|
| S1 | The FTC **Consumer Reviews and Testimonials Rule** (16 CFR Part 465) has been effective since **21 Oct 2024**. It bans fake or false reviews and testimonials (the FTC release says this includes AI-generated ones), buying reviews conditioned on sentiment, undisclosed insider reviews, company-controlled "independent" review sites, review suppression, and buying fake social-media indicators. | observed (FTC Q&A) + documented (press release subtitle mentions AI) | https://www.ftc.gov/business-guidance/resources/consumer-reviews-testimonials-rule-questions-answers ; https://www.ftc.gov/news-events/news/press-releases/2024/08/federal-trade-commission-announces-final-rule-banning-fake-reviews-testimonials |
| S2 | The FTC Q&A: "The rule does not prohibit giving incentives for reviews, as long as there isn't an express or implied requirement that the reviews have to express a particular sentiment." Failing to disclose incentives can still breach the FTC Act under the Endorsement Guides (16 CFR 255.5). There is "no blanket prohibition on the use of AI-generated avatars in marketing", but an avatar testimonial is prohibited if the testimonial is fake or false. | observed | FTC Q&A (above) |
| S3 | On **22 Dec 2025** the FTC sent warning letters to 10 companies. Civil penalties reach **$53,088 per violation** (the 2026 inflation adjustment is unverified). | observed | https://www.ftc.gov/business-guidance/blog/2025/12/warning-letter-or-ten-businesses-comply-ftcs-consumer-review-rule |
| S4 | The FTC set aside its earlier Rytr order (an AI review-writing tool), citing the AI Action Plan. Selling an AI review *generator* is therefore no longer precedent, but *using* fake reviews remains banned under S1. | documented | FTC press-release listing via search; https://www.ftc.gov/news-events/news/press-releases/2024/12/ftc-approves-final-order-against-rytr-seller-ai-testimonial-review-service-providing-subscribers |
| S5 | **Endorsement Guides** (revised 2023): disclose material connections clearly and conspicuously. Starting a post with "Ad:" or "#ad" works; a disclosure in comments does not. Tagging a brand is not a disclosure. When an endorser's results are atypical, show what results are generally expected. | observed | https://www.ftc.gov/business-guidance/resources/ftcs-endorsement-guides |
| S6 | **CAN-SPAM:** no opt-in required, including B2B. Requirements: an opt-out mechanism honoured within **10 business days**, a clear opt-out notice, and no deceptive headers or subjects. Up to $53,088 per email. Both the advertiser and the sender can be liable. | documented (FTC guide via search) | https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business |
| S7 | **New York GBL §396-b** has been in force since **9 Jun 2026** (signed 11 Dec 2025). Ads featuring a "synthetic performer" need a conspicuous disclosure when the advertiser knows one is used. Penalties: $1,000 for the first violation, then $5,000. Expressive works, audio-only ads and translation-only uses are exempt. | documented | https://www.kelleydrye.com/viewpoints/blogs/ad-law-access/ny-synthetic-performer-law-goes-into-effect ; https://www.cooley.com/news/insight/2026/2026-01-29-new-york-enacts-synthetic-performer-disclosure-law-for-advertisements-including-those-using-generative-ai |
| S8 | **California SB 942** (AI Transparency Act, delayed by AB 853 to 2 Aug 2026) puts duties on *providers* of GenAI systems with more than 1M monthly users; platform and device duties follow in 2027–28. It doesn't directly bind a small advertiser. | documented (secondary, statute not read) | https://infobytes.orrick.com/2025-10-17/california-delays-its-ai-transparency-act-and-passes-new-content-laws/ |
| S9 | **TCPA (US SMS)** is in flux in 2026. The 11th Circuit vacated the FCC one-to-one consent rule. The 5th Circuit (Feb 2026) and D. Md. (Mar 2026) rejected the FCC's written-consent requirement, and some courts say texts aren't "calls". Prudent course: get express written consent before any US marketing SMS. | documented (law-firm summaries) | https://www.mayerbrown.com/zh-hans/insights/publications/2026/03/fifth-circuit-panel-allows-prior-express-oral-consent-for-telemarketing-calls-under-the-telephone-consumer-protection-act ; https://www.womblebonddickinson.com/us/insights/blogs/maryland-district-court-rejects-fcc-prior-express-written-consent-requirement-under |

**Do / don't for the agent (US reach):** label synthetic performers in any ad that can reach New York.
Put "#ad" first in sponsored posts. Never condition an incentive on stars. Include an opt-out and a
physical address in every commercial email. Hold off on US SMS until consent capture is designed.

---

## 4. Platform rules

### 4.1 Meta (Facebook, Instagram)

| # | Claim | Basis | Source (date) |
|---|---|---|---|
| P1 | Ad images created or significantly edited with **Meta's own** generative tools get an "AI info" label, in the three-dot menu. For realistic AI people it can appear next to "Sponsored". Minor edits (resizing, colour) aren't labelled, and rollout is gradual. The page *as rendered for me today (Japanese locale)* left third-party-tool ads out. The English search excerpt of the same page includes "ad images created or edited using third-party AI tools". The locale versions appear to differ. | observed (JP render) / documented (EN excerpt) | https://www.meta.com/help/artificial-intelligence/355108217670024/ |
| P2 | Secondary sources and a search summary say that from **1 Jun 2026** Meta also auto-detects ads made with **third-party** AI through industry signals (C2PA/IPTC), adding detail in a new "About this ad" tool. This is consistent with the EN excerpt in P1, but I could not open a dated Meta primary text for it. Plan as if third-party AI ads *will* be labelled by Meta. | documented (unverified primary) | https://commonthreadco.com/blogs/coachs-corner/meta-ai-ad-labels-mandatory-disclosure-ecommerce-2026 ; https://almcorp.com/news/meta-ai-labels-facebook-instagram-ads-disclosure-2026/ |
| P3 | Organic content: Meta uses C2PA and other industry signals to apply "AI info". It *requires* self-disclosure for photorealistic video or realistic audio and may apply penalties. Social-issue and political ads must self-disclose AI use. | observed | Meta 2026 US elections PDF (local extract, lines 93–95, 135–145) |

### 4.2 TikTok

| # | Claim | Basis | Source (date) |
|---|---|---|---|
| P4 | **TikTok Ads policy** (last updated April 2026): significantly edited media and AIGC "is allowed" if labelled with the AIGC label or your own disclaimer, caption, watermark or sticker. "If we identify AI-generated content that has not been disclosed, your ad will be rejected or restricted." Lighting, background removal and denoising are minor. No public-figure likeness without permission. No exaggerated results, and no before/after comparisons that create false impressions. Ad and landing page must match. | observed | https://ads.tiktok.com/help/article/tiktok-ads-policy-misleading-and-false-content |
| P5 | **TikTok Shop UK AIGC rules** (28 Aug 2026): disclose "whenever AI materially contributes" to visuals, voice, avatars or demonstrations. Don't use AI to change product size, invent features, add glow effects, or animate products unrealistically. "always base AI output on real product images". No AI celebrity or authority figures, "even if content is properly labeled". | observed | https://seller-uk.tiktok.com/university/essay?knowledge_id=5234615598237462 |
| P6 | Organic content: realistic AI content must carry the creator's AI label. TikTok auto-labels content that carries C2PA Content Credentials or was made with TikTok AI effects. | documented | TikTok support and newsroom via search: https://newsroom.tiktok.com/en-us/new-labels-for-disclosing-ai-generated-content ; the support URL redirected to an empty page today |

### 4.3 YouTube and Google

| # | Claim | Basis | Source (date) |
|---|---|---|---|
| P7 | **YouTube (27 May 2026):** creators must disclose realistic AI. Realistic AI content gets a label under the player (long-form) or an overlay (Shorts). From May 2026 YouTube auto-labels undisclosed photorealistic AI. Labels from YouTube's own tools (Veo, Dream Screen), or from C2PA metadata showing fully generative content, can't be removed. | observed | https://blog.youtube/news-and-events/improving-ai-labels-viewers-creators/ |
| P8 | **Google Ads (July 2026):** advertisers may add visible AI labels to image and video creatives without breaching text-overlay or watermark rules. An "AI label" setting rolls out across Google Ads, DV360, CM360, Merchant Center and Ads Editor. Google names the **EU, India and New York** as requiring labels; visible overlays show on campaigns targeting them. Google may auto-label assets from its own AI tools, and "labels cannot be overwritten". Using the setting "doesn't guarantee compliance". Keep your own labels away from the very edges and opt out of image enhancements that crop. | observed | https://support.google.com/adspolicy/answer/17257106?hl=en ; https://support.google.com/google-ads/answer/17140115 |
| P9 | Google Ads embeds SynthID and C2PA in images and videos generated with Google Ads tools. Google prohibits misleading ads "whether created with AI or not". | documented / observed | https://support.google.com/google-ads/answer/17140115 ; https://blog.google/products/ads-commerce/google-ads-ai-transparency-labels/ |
| P10 | **Merchant Center image rules:** "All images created using generative AI must contain meta data indicating that the image was AI-generated". Don't remove IPTC `DigitalSourceType` (TrainedAlgorithmicMedia, CompositeSynthetic, AlgorithmicMedia). "Accurately display the product". No promotional text, watermarks or borders. No placeholder or generic images. No upscaling. A minimum of 500×500 px is enforced from **31 Jan 2027**. | observed | https://support.google.com/merchants/answer/7052112?hl=en |
| P11 | **Merchant Center misrepresentation:** no unavailable offers, no improbable claims, no false identity or contact details, the total price including taxes and fees, and clear returns. Some breaches lead to suspension without warning. | observed | https://support.google.com/merchants/answer/6150127?hl=en |

### 4.4 Shopify App Store (RewardsPro)

| # | Claim | Basis | Source (date) |
|---|---|---|---|
| P12 | Requirement **1.3**: fake or incentivised reviews are prohibited. **1.3.1**: ask in neutral language, and do not offer incentives or withhold features in exchange for reviews, in-app or externally. Penalties: review removal, demotion, delisting, or Partner account termination. Admin, Sidekick and checkout extensions can't be used to request reviews or promote apps (2.2.6, 2.2.9, 5.6.2–5.6.3). | observed | https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements |
| P13 | Since 7 Jul 2026 (changelog of 6 Jul): a dedicated incentivisation requirement. Apps caught get "a significant portion" of reviews removed, and stronger detection is unpublishing untrusted reviews. "A simple 'How's your experience? Leave a review' after the merchant has used your app is fine. Offering anything in return is not." | observed | https://shopify.dev/changelog/strengthening-trust-in-app-store-reviews |
| P14 | Listing content: no statistics, data, guarantees or superlatives such as "the best" (4.3.3, 4.3.4). Pricing goes only in the pricing section, never in images or the icon (4.2.2–4.2.3). No reviews or testimonials in the listing or images (4.3.6–4.3.7). Images must show the actual UI, each unique, with no logo-only images (4.4.4–4.4.5). No Shopify trademarks in icon, banner or screenshots (4.4.3). Only factual information, and no false purchase notifications (1.1.4). An English screencast is required (4.5.3). Nothing specific on AI-generated listing art. | observed | same page |
| P15 | Shopify's guidance says not to ask for reviews during onboarding or installation, or by unsolicited emails. | documented | https://shopify.dev/docs/apps/launch/marketing/manage-app-reviews (search summary) |

### 4.5 Marketplaces for trading cards

| # | Claim | Basis | Source (date) |
|---|---|---|---|
| P16 | **eBay picture policy:** prohibited are photos that don't accurately represent the item, stock photos for used, damaged or defective items, added borders, added text, artwork or marketing, and watermarks of any kind. At least one image must be 500 px or more on its longest side. Breaches can lead to removal, restriction or suspension. Nothing AI-specific is stated. | observed (page rendered in Japanese locale) | https://www.ebay.com/help/policies/listing-policies/picture-policy?id=4370 |
| P17 | **eBay images and text policy:** no third-party images or text without written permission, including manufacturer images. Sellers should take their own photos and write their own text. | observed | https://www.ebay.com/help/policies/listing-policies/images-text-policy?id=4240 |
| P18 | **Cardmarket:** sellers may attach scans to listings (since 19 Sep 2023). The Seller Guide demands the correct product page, strict grading ("When in doubt, use a lower grading"), and comments only for things like damage, which cannot override the structured data. I found **no published Cardmarket rule on AI images or image content**; the general T&Cs returned 403. | observed / unknown | https://news.cardmarket.com/en/Magic/cardmarket-users-can-now-add-scans-to-existing-articles ; https://help.cardmarket.com/en/SellerGuide |
| P19 | For card listings on every marketplace, the only safe image is a real photo or scan of the exact item, unedited except for crop and exposure. AI enhancement of a single card's condition, centring or surface is misrepresentation. | inferred | from P16–P18, E13, U4 |

---

## 5. Content provenance (C2PA / Content Credentials)

| # | Claim | Basis | Source (date) |
|---|---|---|---|
| C1 | **Writers (generators):** OpenAI adds C2PA and, since its 19 May 2026 post, Google's SynthID to images. SynthID was extended to audio on 31 Jul 2026 and to text in the EU on 5 Oct 2026 "to comply with the EU AI Act". Google Ads tools embed SynthID and C2PA. ArtCraft's own provenance parser reads C2PA from Veo, Sora and Seedance video, and Kling and Dreamina AIGC tags (see C6). | documented / observed | https://openai.com/index/advancing-content-provenance/ ; https://help.openai.com/en/articles/8912793-provenance-signals-content-credentials-synthid-in-openai-generated-content ; P9 |
| C2 | **Capture devices:** Google Pixel 10 signs camera photos with C2PA. Sony PXW-Z300 brings Content Credentials to pro video. The CAI has "more than 6,000 members", a C2PA conformance programme now exists, and the CAWG 1.2 spec has been released. | documented | CAI, 18 Jan 2026, https://contentauthenticity.org/blog/the-state-of-content-authenticity-in-2026 |
| C3 | **Readers / displayers:** LinkedIn shows a C2PA icon on images and video carrying Content Credentials, including sponsored single-image and video ads when the media is uploaded through Campaign Manager or a Company Page. In select countries uploaders can self-attest AI. YouTube reads C2PA for permanent labels (P7). TikTok auto-labels on C2PA (P6). Meta uses C2PA among its signals (P3). Google "About this image" shows C2PA AI info in Images, Lens and Circle to Search. | observed (LinkedIn, YouTube, Meta) / documented (TikTok, Google) | https://www.linkedin.com/help/linkedin/answer/a6282984 ; https://blog.google/technology/ai/google-gen-ai-content-transparency-c2pa/ |
| C4 | **Pipes that strip it:** Cloudflare Images keeps credentials only when the per-zone "Preserve Content Credentials" toggle is on. Polish reportedly strips them. Re-encoding with ffmpeg strips C2PA (ArtCraft code comment). Upload recompression on social platforms often strips manifests. | observed (Cloudflare docs) / documented | https://developers.cloudflare.com/images/transform-images/preserve-content-credentials/ ; https://community.cloudflare.com/t/preserve-content-credentials-or-a-metadata-bypass-for-c2pa-for-cloudflare-polis/945630 |
| C5 | The EU Code of Practice doesn't mandate C2PA. It asks for layered marking (metadata, watermark, detection), because any single marker can be stripped. Deployers can't rely on machine-readable marks for Art 50(4) anyway (E17). | documented | https://www.jonesday.com/en/insights/2026/06/european-commission-publishes-final-code-of-practice-on-marking-and-labelling-aigenerated-content ; Guidelines para 117 |
| C6 | **ArtCraft today (observed, gh api, 2026-10-20):** PhotoCraft issue #1050 "attach and inspect C2PA Content Credentials on export and open" is **open** (created 8 Oct, updated 16 Oct 2026). Its body says "Nothing in the tree creates, interprets or verifies a manifest today"; the flat exporter writes EXIF, XMP and DPI. PhotoCraft's `docs/file-format-parity.md` lists C2PA R/W as "no". FilmCraft has a `media.validateContentCredentials` setting (default off) in `crates/engine/src/settings.rs`. A code search of VectorCraft found no C2PA. `artcraft-services/crates/lib/video_info` parses C2PA and AIGC provenance from Seedance, Veo, Sora, Dreamina and Kling video, and notes that `Lavf…` (ffmpeg) re-encoding strips C2PA. | observed | https://github.com/storytold/photocraft/issues/1050 ; https://github.com/storytold/photocraft/blob/main/docs/file-format-parity.md ; https://github.com/storytold/filmcraft/blob/main/crates/engine/src/settings.rs ; https://github.com/storytold/artcraft-services/blob/main/crates/lib/video_info/src/lib.rs |
| C7 | Consequence: an asset generated by OpenAI or Google and then finished in a Craft app or re-encoded will probably lose its C2PA and SynthID-metadata signal (SynthID pixel watermarks may survive some edits). Whether PhotoCraft's XMP pass-through keeps the IPTC `DigitalSourceType` that Merchant Center needs is unverified. | inferred / unknown | from C1, C4, C6, P10 |

---

## 6. Implications for an agentic marketing design (the estate)

These are inferred recommendations built on the evidence above.

1. **Put a compliance gate in the pipeline as a mechanism, not a sentence.** Every asset gets a
   manifest (JSON next to the file) holding: `jurisdictions` (UK / EU / US-NY / US-other), `channel`
   (Meta, TikTok, Google Ads, Merchant Center, eBay, Cardmarket, Shopify App Store, email),
   `ai_involvement` (none / assistive-edit / AI background on a real product / synthetic person /
   synthetic product), `claims[]` with an evidence link each, `reviews_used[]` with provenance,
   `price_shown_total`, `urgency_claims[]` with an end date or stock source, `label_applied`, and
   `human_reviewer` plus timestamp. A linter refuses to publish when a rule fails: a synthetic person
   without a label for EU or NY, a product rendered by AI, a claim without evidence, a timer without a
   real deadline, a review without provenance. RhetorLint (`captioneer`) is a candidate home for the
   copy-side rules.
2. **Use a human approval step as the default for every outward asset.** It satisfies the CMA AI-agent
   guidance (U16), the EU text exemption (E19) and the ASA's accountability stance (U3). Agents draft;
   Yu or a named reviewer approves; the approval is logged.
3. **Treat product truth as a hard rule.** For TCG: real photos and scans only, for the item and for the
   condition. AI is allowed for backgrounds, layout, typography and brand illustration that doesn't
   depict a real product or person. No AI art of Pokémon, One Piece or other licensed IP characters:
   that is IP risk under guidelines para 128 and eBay VeRO (inferred).
4. **Label in a layered way.** A visible on-asset mark for EU-reaching realistic content, plus the
   platform toggle (Meta, TikTok, YouTube, Google AI label), plus preserved metadata (IPTC
   `DigitalSourceType` / C2PA) where the tools write it. The provenance ledger is the source of truth,
   because pipelines strip metadata.
5. **Draw firm lines for RewardsPro.** (a) On the Shopify App Store: no incentive or feature gating for
   reviews; ask neutrally after real use, never during onboarding. (b) As a product: any "points for
   reviews" feature RewardsPro offers *merchants* must, by design, reward *any* review regardless of
   stars, auto-disclose "incentivised" on the published review, and never filter by sentiment. Otherwise
   it hands merchants a DMCC banned practice (Pasta Evangelists, U13) and an FTC 465.4 breach.
   (c) Any prize-draw feature needs a free entry route and CAP 8.17 terms.
6. **Outreach to Shopify merchants.** Prefer inbound and Shopify-native channels (the App Store listing,
   content, partner directories). Cold email only to identified limited companies, with identity,
   opt-out and a legitimate-interest assessment. Never to sole traders without consent (U24). For the
   EU, national ePrivacy rules may need consent even for B2B (not researched; open question).
7. **Use UK-only targeting as a lever.** Restricting ad targeting to the UK removes EU AI Act and NY
   synthetic-performer duties for those ads. It does not cover organic posts on global platforms
   (E9).

---

## 7. Open questions / unknowns

- The EUR-Lex text of Regulation (EU) 2026/1744 was not read directly (fetch empty). The 2 Dec 2026
  grandfathering comes from the Commission guidelines (para 153) and secondary sources.
- Meta: is third-party-AI ad auto-detection (said to start 1 Jun 2026) live in the UK and EU? Is there
  an advertiser self-disclosure toggle for EU AI Act purposes? Locale versions of the help page
  differ, and no dated primary text was found (P1, P2).
- TikTok support page redirected to an empty page today. Organic-label rules are documented only via
  the newsroom and search.
- Cardmarket: no official rule found on image content, AI images or advertising in listings; the T&Cs
  page returned 403.
- Does PhotoCraft or VectorCraft carry IPTC `DigitalSourceType` XMP through export? Not tested. Testing
  needs a local run, which I left to the session doing the install.
- EU member-state ePrivacy rules for B2B cold email (e.g. Germany) were not researched.
- The FTC 2026 inflation-adjusted penalty figure is unverified ($53,088 is the 2025 figure cited).
- UK subscription-contracts regime: exact commencement, and whether it touches RewardsPro, which bills
  merchants (B2B), so probably not (inferred).
- **Estate conflict:** this brief says Cambridge TCG "is generating revenue". The estate survey
  (`estate/curated/families/commerce-tcg.toml`, as_of 2026-10-17) says the retail shop and trade-in desk
  closed on 2026-07-06 and that cambridgetcg.com is now a peer-to-peer collectors' market and price
  commons. Which channels actually sell today decides which platform rules matter most.

## 8. Method and what I did not do

Public GET requests and `gh api` reads only. WebSearch was used for discovery, then primary pages were
fetched where possible: the EU Commission (FAQ, Code page, guidelines PDF), legislation.gov.uk, gov.uk
(CMA), the ICO, asa.org.uk, ftc.gov, support.google.com, blog.youtube, ads.tiktok.com, the TikTok Shop UK
academy, shopify.dev, ebay.com, help.cardmarket.com and linkedin.com/help. PDFs were extracted locally
with `pdftotext` into
`/private/tmp/claude-501/-Users-yournameisai/b3c581a3-a92d-4da1-b779-a0867505bf64/scratchpad/mkt/compliance-src/`.
No logins, posts or installs. Nothing under `~/.kingdom` or `~/.local` was touched. No AWS calls. I met
no credentials.
