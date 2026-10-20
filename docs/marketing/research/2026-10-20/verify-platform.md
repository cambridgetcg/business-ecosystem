# Platform fact-check (adversarial), 2026-10-20

Written by an agent (Claude, fact-check subagent). Read-only checks only: WebFetch, curl of public pages, gh api reads. Nothing was posted or changed anywhere.
Limit: the session's WebSearch budget ran out partway through. After that I only fetched known primary URLs and browsed listings (an arXiv month listing, GitHub). Items I could not reach are marked UNVERIFIABLE, not guessed.
Raw downloads are in `/private/tmp/claude-501/-Users-yournameisai/b3c581a3-a92d-4da1-b779-a0867505bf64/scratchpad/mkt/dl/`.

## 1. Built for Shopify (BFS) installs, reviews and rating: CORRECTED, and good news for a free app
- Primary text (BFS requirements 1.2.1–1.2.3), https://shopify.dev/docs/apps/launch/built-for-shopify/requirements (page undated; fetched 2026-10-20):
  - "Your app must have a minimum of 50 net installs from active shops on paid plans."
  - "Your app must have a minimum of five reviews."
  - "Your app must meet a minimum recent app rating threshold in the Shopify App Store." No number is published.
- "Paid plans" means the merchant's paid **Shopify** plan, not the app's paid plan. The evidence:
  - Free-only apps hold the BFS badge today. Canva Connect (Seguno) and RT: Disable Right Click (RoarTheme) both show the BFS badge, and their pricing reads only "Free". https://apps.shopify.com/canva-connect and https://apps.shopify.com/disable-mouse-right-click, fetched 2026-10-20.
  - The BFS app list filtered to free pricing shows 27 badged apps labelled plain "Free" on its first 6 pages. https://apps.shopify.com/app-groups/highlights/built-for-shopify?pricing=free
  - A reply that appears to come from Shopify (Alan_G, 2026-02-05) says: "BFS only tracks active/paid installs (not on dev shops)". https://community.shopify.dev/t/merchant-utility-doesnt-update/28919
- So "50 paid-plan installs" is wrong. The rule is 50 net installs from active, real merchant shops on paid Shopify plans. Development and test stores don't count. A free-only RewardsPro can qualify.
- Design note from the same page (4.3.5): an app must not use the Sidekick icon or a colour like Shopify's "magic purple" to mark AI features.

## 2. Sidekick app recommendations: CORRECTED (details)
- https://shopify.dev/changelog/app-recommendations-in-sidekick-now-available (posted 2025-09-17):
  - For broad queries Sidekick shows up to three app cards. For a strong single match it shows one highlighted card.
  - "Sidekick uses App Store listing content to render standardized app cards."
  - "Achieving the Built for Shopify badge improves search ranking in both the App Store and Sidekick."
- Smile: its Sidekick app extension went live on 2026-06-18 (https://blog.smile.io/loyalty-data-on-demand-smile-launches-its-sidekick-app-extension-for-shopify). Smile is a named launch partner in https://shopify.dev/changelog/sidekick-app-extensions-available-today (2026-06-17), which says there were 18 partners and names 6.
- Yotpo: Yotpo says it is "one of the first app extension partners for Sidekick", but its extension is for **Yotpo Reviews**, not loyalty (https://www.yotpo.com/blog/commerce-teams-dont-need-more-data-they-need-better-answers/, last updated 2026-06-24). Shopify's launch post does not name Yotpo.

## 3. App Store listing specs: CONFIRMED with precision
Source: https://shopify.dev/docs/apps/launch/shopify-app-store/best-practices (fetched 2026-10-20). Rule numbers below are from https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements.
- App icon: 1200 x 1200 px, JPEG or PNG, square with padding (corners are rounded automatically). No text, no screenshots, no Shopify trademarks.
- Screenshots: 1600 x 900 px (16:9), 3–6 desktop screenshots, at least one showing the app's UI. Mobile or POS screenshots only if the app is mobile-responsive or works with POS. Alt text is required. No pricing, reviews, outcome guarantees or personal data (PII) in images.
- Feature media: a video of 2–3 minutes is recommended. It should be promotional, with screencast footage at most 25% of it. Otherwise use a static feature image at 1600 x 900.
- Text limits: App introduction 100 characters, App details 500 characters, Feature list up to 80 characters per feature, App name 30 characters maximum. Up to 5 search terms.
- Content rules (requirements):
  - 4.3.3 and 4.3.4: no statistics or data in the listing or its images, "verifiable and unverifiable", and avoid "the first / the best / the only".
  - 4.3.6 and 4.3.7: no reviews or testimonials.
  - 4.2.2 and 4.2.3: pricing only in the Pricing details section.

## 4. Review incentives: CORRECTED
- Incentivised reviews were always against policy. On 2026-07-06 Shopify published requirement 1.3, "Always use honest and transparent review practices". The page metadata gives an effective date of 2026-07-07. Sources: https://shopify.dev/changelog/strengthening-trust-in-app-store-reviews and https://shopify.dev/changelog/updated-app-store-requirements-13-always-use-honest-and-transparent-review-practices
- Consequences: removal of "a portion" (the blog says "a significant portion") of reviews, demotion or delisting, or termination of the Partner account. It is not removal of all reviews.
- Rule 1.3.1: "It is forbidden to offer incentives or withhold features in exchange for reviews, regardless of whether this occurs through the app or external channels."
- Separately, Shopify is gradually unpublishing reviews that fail its authenticity bar.

## 5. Agentic commerce
- **OpenAI.** Trade press dated 2026-03-09 (Shopifreaks, citing The Information) quotes an OpenAI spokesperson: "Instant Checkout is moving to Apps." I couldn't reach openai.com (403).
  - Shopify's primary help page confirms the current state. ChatGPT is a "discovery-focused referrer", and buyers complete purchase on the merchant's own online-store checkout in ChatGPT's in-app browser (or a new tab on web). https://help.shopify.com/en/manual/online-sales-channels/agentic-storefronts/chatgpt
- **UCP: CORRECTED.**
  - It is not just Google and Shopify. ucp.dev lists Shopping co-developers Google, Shopify, Etsy, Wayfair, Target, Walmart, Amazon, Microsoft, Meta, Salesforce and Stripe.
  - The spec is active: releases v2026-01-11, v2026-01-23, v2026-04-08 and v2026-08-25, with the repo pushed 2026-10-20 (https://github.com/Universal-Commerce-Protocol/ucp).
  - The Loyalty extension exists. PR #340 merged 2026-05-19 and is announced in the v2026-08-25 release notes; the spec is at docs/specification/common/extensions/loyalty.md.
  - What the extension covers: recognising existing members (tier, benefits, rewards earned). Redeemable balances and stored value are out of scope.
  - Google's own UCP page lists "account linking for loyalty programs" as an upcoming feature (https://developers.google.com/merchant/ucp).
  - "About 8k stores": UNVERIFIABLE. No primary source gives a store count.
- **US-only buyers: CORRECTED.** Direct-checkout rules per channel, from the help pages under https://help.shopify.com/en/manual/online-sales-channels/agentic-storefronts/:
  - ChatGPT: the store must sell to US customers, but the store can be based outside the US.
  - Google AI Mode and Gemini direct checkout: the store must be US-based and sell to US customers.
  - Microsoft Copilot direct checkout: shown only to US-based customers.
  - Meta: US, Canada and Mexico.
  - Buyers outside these countries can still discover products and get redirected to the online store.
  - Shopify charges no channel fee; standard payment processing applies.
  - **Key for RewardsPro:** "Loyalty or rewards experiences" checkout blocks are UNSUPPORTED in Google AI Mode/Gemini and Copilot direct checkout.
- **Agentic plan: CORRECTED.** It is for businesses without a Shopify online store. "Only pay when your products sell. No monthly fee." Card rates apply; the page fetched from a Japan IP showed "3.55% + 0 JPY", and rates vary by region. Direct selling is off by default, and business verification is required. https://www.shopify.com/agentic-plan

## 6. GEO evidence
- **45-study survey: CONFIRMED.** arXiv 2607.14035, "Optimizing Visibility in Generative Engines: A Critical Survey of Generative Engine Optimization (2023-2026)", Olivier Martinez, single author, v1 2026-07-15.
  - It is a preprint, not peer-reviewed.
  - It finds "no reviewed technique shows a stable, longitudinal, cross-platform causal effect on organic discoverability". The only supported causal effect is on content that has already been retrieved.
- **llms.txt: CONFIRMED with caveats.** SE Ranking, a vendor study of about 300,000 domains, found 10.13% have llms.txt and saw no correlation with AI citations; removing the variable improved their XGBoost model. The study is observational. Page datePublished 2026-10-15. https://seranking.com/blog/llms-txt/
- **Google: CORRECTED date.** The spam policy intro now covers "attempting to manipulate generative AI responses in Google Search". The documentation update log puts this clarification in **May 2026**, under the May 15 entry next to the new generative-AI optimisation guide. It was not August. The August 28 change was to the site reputation policy for the EEA. Sources: https://developers.google.com/search/docs/essentials/spam-policies (last updated 2026-08-28) and https://developers.google.com/search/updates
- **Ahrefs: CONFIRMED with precision.** The study is https://ahrefs.com/blog/ai-overview-brand-correlation/ (published 2025-05-26), covering about 75k brands with Spearman correlations.
  - Brand web mentions 0.664 vs number of backlinks 0.218. That is about 0.22, so the figure is right.
  - It measured **Google AI Overviews only**, and these are correlations, not causes.
  - Ahrefs' follow-up on 2025-12-12 (https://ahrefs.com/blog/ai-brand-visibility-correlations/) gives brand-mention correlations of 0.66–0.71 across ChatGPT, AI Mode and AI Overviews.

## 7. Marketing Science AI ads paper, and the 31% label field test: UNVERIFIABLE
pubsonline.informs.org returned 403, and the search budget was gone. I found no primary source, so neither should be used without the paper in hand.

## 8. Google Merchant Center: CONFIRMED with precision
Image source: https://support.google.com/merchants/answer/6324350 (fetched 2026-10-20).
- "new image size requirements of at least 500 x 500 pixels for all products beginning January 31, 2027". At least 1500 x 1500 is recommended. Maximum 64 MP and 16 MB.
- No post-production text, marketing callouts, graphics, watermarks, barcode/QR overlays or superimposed logos.
- "All images created using generative AI must contain meta data indicating that the image was AI-generated (for example, the IPTC DigitalSourceType TrainedAlgorithmicMedia ...)". Don't strip it.

Content API for Shopping: https://developers.google.com/shopping-content/guides/sunset (last updated 2026-09-10).
- Sunset on 2026-08-18.
- From 2026-09-01, calls without an extension sometimes fail with HTTP 410.
- Full shutdown is planned for "early 2027". Migrate to the Merchant API.

## 9. eBay UK
- **Price Guide: CONFIRMED except the date.** https://pages.ebay.co.uk/price-guide/
  - Free to use, with no usage limits. Available in the UK and US.
  - Covers TCG only: Pokémon (English and Japanese), Magic: The Gathering, Yu-Gi-Oh!, One Piece and Lorcana. Sports cards are not supported yet.
  - Scanning is app-only. It uses up to two years of eBay sales, PSA/CGC population reports and Card Ladder. It is "rolling out gradually across the UK".
  - The "1 Sep 2026" launch date is UNVERIFIABLE; the page doesn't state it.
- **Fees: CORRECTED scope.** https://www.ebay.co.uk/help/selling/fees-credits-invoices/fees-business-sellers?id=4809
  - **Business sellers**: Collectables (#1) 10.9%; Toys & Games (#220, which covers CCG) 10.9%; Sports Memorabilia 10.9%.
  - On top of that: a per-order fee of £0.30 for orders of £10 or less, £0.40 above £10; a reduced 10p for orders up to £10 in selected Collectables categories; and a regulatory operating fee of 0.42%.
  - **UK private sellers pay no final value fee** (excluding motors; fees apply over 300 listings a month, for upgrades or for overseas delivery). https://www.ebay.co.uk/help/selling/fees-credits-invoices/private-seller-fees?id=4822

## 10. DTCG format: CONFIRMED with precision
- "Design Tokens Format Module 2025.10, Final Community Group Report, 28 October 2025". It is "considered stable", and the latest published version is still 2025.10.
- It is **not a W3C Standard** nor on the Standards Track; it is a Community Group report.
- Source: https://www.designtokens.org/tr/2025.10/format/
