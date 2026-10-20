# Agentic-era marketing landscape, October 2026 (key: agentic-meta)

Written 2026-10-20 by a research subagent for Yu. It records research and an agent's proposal;
nothing here is Yu's decision. Read-only work: public GET requests, `gh api` reads and web search.
Nothing was installed, posted or changed. No AWS calls.

Evidence tags used throughout:
- **[O] observed**: I looked at it today (2026-10-20). The source is the URL or file I read.
- **[D] documented**: a source says so. Primary sources are marked *primary*; trade press,
  vendor blogs and law-firm notes are marked *secondary*.
- **[I] inferred**: my reasoning. It may be wrong.

Raw captures I made (GET only) are in
`/private/tmp/claude-501/-Users-yournameisai/b3c581a3-a92d-4da1-b779-a0867505bf64/scratchpad/mkt/agentic-meta-raw/`.

---

## 0. Read this first: the estate's own state conflicts with the brief

The brief says Cambridge TCG is a revenue-generating Shopify merchant and RewardsPro is the next
growth bet. What I could see today doesn't match that, and the marketing plan depends on which is
true.

- [O] `cambridgetcg.com` is a Next.js app on Vercel behind Cloudflare, not a Shopify storefront
  (response headers `x-powered-by: Next.js`, `x-vercel-id`, `server: cloudflare`, fetched
  2026-10-20). `wholesaletcgdirect.com` answers `301` to `https://cambridgetcg.com/`.
- [O] The homepage `<title>` and meta description read "Cambridge TCG — open-source TCG data
  infrastructure" / "Building open-source tools and shared standards for card identity, images,
  prices and market data." The homepage has no JSON-LD. Source: `agentic-meta-raw/ctcg_home.html`.
- [O] `cambridgetcg.com/llms.txt` says "New paid commerce is retired; existing account records,
  agreements and remedies retain their own access and release rules." Source:
  `agentic-meta-raw/ctcg_llms_txt`.
- [D] The estate map (as_of 2026-10-18; clone at commit 15d7b7a) says the retail shop and trade-in
  desk closed on 2026-07-06 after "8 retail orders in total, zero trade-ins".
  wholesaletcgdirect.com was retired around 2026-07-05. On cambridgetcg.com, "new listings, bids
  and checkout answer 410 since 2026-09-23", and goods-sales is "unknown until the sales channel
  is named". Sources: `be-main/estate/curated/families/commerce-tcg.toml` line 4;
  `be-main/estate/curated/capabilities.toml` (cambridge-tcg-monorepo, cambridge-tcg,
  shopifytheme_tcg entries).
- [O] On the RewardsPro landing page (`rewardspro.io`), the JSON-LD description reads "Explore
  loyalty systems and existing records. New paid subscriptions are retired." The body says "New
  paid subscriptions and paid plan changes are retired." Missions, raffles and mystery boxes show
  "Customer flow paused". Source: `agentic-meta-raw/rp_` (homepage capture).
- [O] The Shopify App Store listing `apps.shopify.com/rewards-pro` shows: developer Cambridge TCG
  Limited, launched 2025-12-16, rating 0.0 with 0 reviews, pricing "Free", no Built for Shopify
  badge, category "Loyalty and rewards".
- [D] Estate map: RewardsPro production "New paid subscriptions retired on 2026-09-23; the App
  Store listing is live". rewardspro-marketing (outreach scheduler) was "retired on 2026-09-23".
  Source: `be-main/estate/curated/capabilities.toml`.
- [O] No repository in the estate map has `marketing-outreach` in use. It is only "designed"
  (first-customer-push, fomoengine, saas-marketing-suite and -template) or "retired"
  (rewardspro-marketing). Source: grep of `capabilities.toml`.
- [I] So, as the public sees it today: Cambridge TCG presents as a data-infrastructure project
  with commerce retired, and RewardsPro tells new merchants that paid plans are retired. Any
  outward marketing would first need Yu to decide what each brand is selling now and to whom.
  Otherwise agents and humans will faithfully repeat "retired". The rest of this document applies
  whichever way Yu decides, and section 8 marks where the decision matters.

---

## 1. AI search and generative engine optimization (GEO/AEO)

### 1.1 How the engines pick and cite sources (what is documented)

**Google AI Overviews and AI Mode**
- [O, primary] Google's "AI features and your website" page (last updated 2025-12-10) says:
  "There are no additional requirements to appear in AI Overviews or AI Mode, nor other special
  optimizations necessary"; "There's also no special schema.org structured data that you need to
  add"; site owners need not create new machine-readable or AI text files. A page must be indexed
  and eligible for a snippet. Both features may use "query fan-out" (many related sub-searches).
  Traffic counts in Search Console under "Web". Controls are nosnippet, data-nosnippet,
  max-snippet and noindex, plus Google-Extended for other Google AI uses.
  https://developers.google.com/search/docs/appearance/ai-features
- [O, primary] Google's spam policies (last updated 2026-08-28) now count "attempting to
  manipulate generative AI responses in Google Search" as spam. Scaled content abuse includes
  "Using generative AI tools or other similar tools to generate many pages without adding value
  for users". https://developers.google.com/search/docs/essentials/spam-policies
- [O, primary] Google's generative-AI content guidance (last updated 2026-10-01) says to "manually
  factcheck and review all AI-generated content for accuracy and trustworthiness before
  publishing", including titles, meta descriptions, structured data and alt text. For Merchant
  Center: "AI-generated images must contain metadata using the IPTC DigitalSourceType"
  (TrainedAlgorithmicMedia), and AI-generated product titles and descriptions must be "specified
  separately and labeled as AI-generated".
  https://developers.google.com/search/docs/fundamentals/using-gen-ai-content
- [O, primary] The Search Status Dashboard lists these 2026 ranking updates: spam updates on
  24 Mar, 24 Jun, 18 Aug and 24 Sep (the September one ran about 13.7 days); core updates on
  27 Mar and 21 May; a Discover update on 5 Feb.
  https://status.search.google.com/products/rGHU1u87FJnkP6W2GwMi/history
- [D, secondary] AI Mode reached the UK around 2025-07-28.
  https://searchengineland.com/google-releases-ai-mode-in-the-uk-459611

**ChatGPT search and shopping**
- [D, primary via search snippet] OpenAI's crawler docs say OAI-SearchBot "is used to surface
  websites in search results in ChatGPT's search features". They recommend allowing it in
  robots.txt and allowing OpenAI's IP ranges. It is separate from GPTBot, which is for training.
  https://developers.openai.com/docs/gptbot (direct fetch not attempted. The help center
  returned 403.)
- [D, primary via search summary] OpenAI's help article on shopping says product results are
  "chosen independently" and are not ads. Merchants are ranked by availability, price, quality and
  whether they make or primarily sell the item. Shopify merchants are fed automatically via
  Shopify Catalog, and other merchants can apply to send a product feed.
  https://help.openai.com/en/articles/11128490 (the direct fetch returned 403, so I couldn't
  verify the wording myself)
- [D, secondary] ChatGPT retrieval is a hybrid: Bing-class retrieval plus OpenAI's own index and
  other providers. The weighting is undisclosed and the evidence comes from vendors.
  https://peec.ai/blog/chatgpt-built-its-own-search-index
- [D, secondary] OpenAI's advertiser guidance warns that bot protection (for example Cloudflare)
  can block OpenAI crawlers unless they are allowlisted. https://help.openai.com/en/articles/20001243

**Claude**
- [D, primary via search] Anthropic's help center lists three robots tokens: ClaudeBot
  (training), Claude-User (fetches pages for a user's question) and Claude-SearchBot (search
  quality). Blocking either of the last two may reduce visibility in Claude's search answers.
  https://support.claude.com/en/articles/8896518
- [D, secondary] Claude's web search uses Brave Search, from Anthropic's subprocessor list
  (2025-03), and Simon Willison matched the results.
  https://simonwillison.net/2025/Mar/21/anthropic-use-brave/ . A second provider (turbopuffer)
  is reported only by secondary sources.

**Perplexity**
- [D, secondary] I found no official description of how Perplexity selects sources. Vendor data
  says it tracks Google results more closely than ChatGPT does. Perplexity pays publishers through
  Comet Plus (80% revenue pool) for invited publishers.
  https://www.axios.com/2025/08/26/perplexity-comet-plus-subscription
- [D, secondary] Perplexity "Instant Buy" with PayPal launched in November 2025 for US users.
  Merchants are reached through PayPal, and the "5,000+ merchants" figure is unverified.
  https://www.pymnts.com/artificial-intelligence-2/2025/paypal-and-perplexity-debut-instant-buy-ahead-of-black-friday-shopping

### 1.2 What measurably helps, graded by evidence

The best single evidence source I found is a critical survey of 45 GEO studies (Martinez,
arXiv:2607.14035, 2026-07-15) [O]. https://arxiv.org/html/2607.14035v1
- [O] Central conclusion: "no reviewed technique shows a stable, longitudinal, cross-platform
  causal effect on organic discoverability." Confidence on traffic and conversion effects: "very
  low". "Claims about GEO return on investment clearly outstrip the academic evidence."
- [O] The best-supported factors under controlled conditions are query–document relevance and
  context position ("the two most robust factors"). Adding quotations and statistics helped in the
  original GEO paper (Aggarwal et al. 2024, about 41% relative gain on one metric), but only inside
  a fixed five-document context. The often-quoted "40% visibility boost" is "rejected as a
  general claim".
- [O] Moderate support: extractable evidence, explicit prices and recent dates, and document
  structure (heterogeneous). Weak, null or negative: an authoritative tone, keyword stuffing, and
  fixed recipes.
- [O] Measurement is very noisy. Daily source-overlap Jaccard is about 0.34–0.42. AI Overviews'
  cited pages overlapped only 18% across two months, against 45% for organic. In one setup, 57.8%
  of ChatGPT runs didn't trigger web search at all. The survey suggests 7–8 repetitions per
  prompt.
- [O] Attacks work in the lab (preference manipulation raised a fictitious product's
  recommendation rate from 34.0% to 59.4%), and defenses exist. Google now classes such
  manipulation as spam (see 1.1).
- [D, secondary but large-sample] Off-site mentions matter. Ahrefs (75k brands, 2025-05-26) found
  branded web mentions correlate 0.664 with AI Overview brand visibility, against about 0.218 for
  backlinks. This is correlation, not causation. https://ahrefs.com/blog/ai-overview-brand-correlation/
- [D, secondary] Fewer clicks. Pew (July 2025) found people clicked a traditional result 8% of
  the time when an AI summary appeared and 15% when none did. Ahrefs (data from December 2025,
  published February 2026) reported a 58% lower CTR for the top result when an AI Overview shows.
  https://www.medianama.com/2026/02/223-google-ai-overviews-click-through-rates-58-study/
- [D, primary via TechCrunch] Fewer visits, but better ones. Adobe (2026-04-16): AI traffic to US
  retail rose 393% year on year in Q1 2026, converted 42% better than non-AI traffic in March 2026
  (it was 38% worse in March 2025), and earned 37% more revenue per visit. About 34% of retail
  product pages "can't be properly accessed by AI". Absolute share is still small (a secondary
  source puts it at roughly 0.1–0.2% of sessions).
  https://techcrunch.com/2026/04/16/ai-traffic-to-us-retailers-rose-393-in-q1-and-its-boosting-their-revenue-too/

### 1.3 llms.txt: adoption and effect

- [D, secondary] SE Ranking (about 300k domains; reported 2025-11-20) found llms.txt on 10.13% of
  domains and no correlation with AI citations. Removing it improved their model.
  https://www.searchenginejournal.com/llms-txt-shows-no-clear-effect-on-ai-citations-based-on-300k-domains/561542/
- [D, secondary] An Ahrefs log study is reported as finding that 97% of 137,210 llms.txt files got
  zero requests in May 2026. Of the few requests that came, GPTBot and Claude Code were the top
  named fetchers. Google's Search team says it ignores the file. The page was updated 2026-09-19,
  and I didn't find the primary Ahrefs report. https://nytroseo.com/does-llms-txt-help-2026-evidence
- [O, primary] Google's AI-features page says no "new machine-readable or AI text files" are
  needed (see 1.1).
- [O, primary] A counter-signal: Chrome Lighthouse now has an "agentic" audit group with three
  audits. They check that llms.txt follows llmstxt.org format, that the accessibility tree is
  well-formed (agents read it), and that an Agentic Resource Discovery (ARD) manifest is valid
  (added 2026-08-31). Sources: `GoogleChrome/lighthouse` `core/audits/agentic/` (llms-txt.js,
  agent-accessibility-tree.js, ard-schema.js); releases v13.3.0 (2026-05-07) through v13.5.0
  (2026-09-18).
- [I] Verdict: llms.txt is cheap and harmless and mainly helps coding and browser agents read
  docs. It is not a citation lever. Accessibility, crawlability and real content come first.
- [O] cambridgetcg.com already has a 188-line llms.txt and a robots.txt that welcomes GPTBot,
  ClaudeBot, PerplexityBot and CCBot (with the same disallows and `Crawl-delay: 2`). It doesn't
  name OAI-SearchBot, Claude-SearchBot or Claude-User, but those fall under `User-agent: *`
  `Allow: /`. Whether Cloudflare's bot settings let them through is unknown (see open questions).
  Sources: `agentic-meta-raw/ctcg_robots_txt`, `ctcg_llms_txt`.
- [D, secondary] Cloudflare blocked known AI crawlers by default on new domains from July 2025. A
  function-based scheme was announced in July 2026 for 2026-09-15: training and agent crawlers are
  blocked on ad-supported pages, and search crawlers are allowed.
  https://www.helpnetsecurity.com/2026/07/02/cloudflare-ai-crawler-controls/

---

## 2. Agentic commerce protocols and storefronts

### 2.1 State of each piece (October 2026)

| Piece | Status as seen | Tag / source |
|---|---|---|
| **OpenAI ACP / Instant Checkout** | ACP spec is "beta", maintained by OpenAI and Stripe. Versions run 2025-09-29 to 2026-04-17, the last repo push was 2026-07-18, and it has 1,581 stars. Instant Checkout was scaled back in March 2026: ChatGPT now does discovery, and purchase completes on the merchant's site or app (OpenAI post "Powering Product Discovery in ChatGPT", 2026-03-24, which I couldn't fetch because of a 403). | [O] github.com/agentic-commerce-protocol/agentic-commerce-protocol ; [D, secondary] https://www.checkout.com/blog/openai-agentic-commerce-shift , https://www.digitalapplied.com/blog/ai-agentic-commerce-discover-in-ai-buy-on-site-2026 |
| **Google UCP** | Co-developed by Google and Shopify and announced 2026-01-11 at NRF. Shopping co-developers include Etsy, Wayfair, Target, Walmart, Amazon, Microsoft, Meta, Salesforce and Stripe. Capabilities: catalog, cart, checkout, identity linking (OAuth 2.0), order, and payments via AP2. MCP and A2A are supported. The repo is active (3,435 stars, pushed 2026-10-20). | [O] https://ucp.dev/ ; [O] github.com/Universal-Commerce-Protocol/ucp |
| **UCP loyalty** | A Loyalty extension spec exists on main (memberships, tiers, benefits, rewards; "redeemable balances and stored value" are explicitly excluded). The roadmap lists "Loyalty & Member benefits" as upcoming. Adoption of identity linking was 11 stores in June 2026. | [O] `docs/specification/common/extensions/loyalty.md` (last commit 2026-10-19), `docs/documentation/roadmap.md` ; [D, secondary/self-published] https://ucpchecker.com/blog/state-of-agentic-commerce-june-2026 |
| **UCP adoption** | 8,259 verified UCP stores as of 2026-06-13, about 99% of them Shopify, and fewer than 70 on all other platforms combined. Of 633 test sessions that reached checkout, 46 completed (about 7%). | [D, self-published] ucpchecker.com (above) |
| **Google AI Mode / Gemini checkout** | Universal Cart was announced at I/O on 2026-05-19, and UCP checkout is said to be expanding to Canada and Australia, then the UK (no date). In September 2026, eligible US Shopify merchants were auto-enrolled for native checkout, with opt-out. A Merchant Center UCP hub for other platforms is a US rollout behind an interest form. | [D, secondary] https://techcrunch.com/2026/05/19/googles-new-universal-cart-wants-to-follow-your-entire-shopping-journey-across-the-internet/ ; https://www.seroundtable.com/google-native-checkout-emails-42140.html |
| **AP2** | Google's agent payments mandates (verifiable credentials). In UCP it is an optional mandate extension, with 3 adopters in June 2026. | [O] ucp.dev ; [D] ucpchecker (above) |
| **Shopify Agentic Storefronts** | Announced 2026-03-24 and on by default: "Products become discoverable in ChatGPT by default via Agentic Storefronts". Channels are ChatGPT (in-app browser checkout on the merchant site), Copilot ("thousands of merchants"), and AI Mode/Gemini for select brands. No fees beyond standard processing. **Purchasing is US buyers only**, for stores anywhere that sell to US buyers (Shopify UK page, updated 2026-06-18). | [O, primary] https://shopify.com/news/agentic-commerce-momentum ; https://www.shopify.com/uk/blog/how-agentic-commerce-works |
| **Shopify Agentic plan** | For brands **not** on Shopify: add products to Shopify Catalog and sell across AI channels. Publicly available, no monthly fee, and standard payment rates where Shopify checkout is used. | [O, primary] same two Shopify pages |
| **Shopify Catalog for agents** | Global Catalog `catalog.shopify.com/api/ucp/mcp` and per-store `{store}/api/ucp/mcp`, with tools `search_catalog`, `lookup_catalog` and `get_product`. "By default, Global Catalog queries return products from any eligible merchant." Promoted placements are planned. Shopify claims Catalog-powered AI searches "convert at 2x" scraped data (unverified vendor claim). | [O, primary] https://shopify.dev/docs/agents/catalog ; https://www.shopify.com/news/spring-26-edition-dev |
| **Shopify Knowledge Base app** | Free app where merchants review the FAQs that AI shopping agents use. Rated about 3.6–3.9 on roughly 10 reviews. | [D, primary listing via search] https://help.shopify.com/en/manual/promoting-marketing/knowledge-base |
| **Visa** | Trusted Agent Protocol (with Cloudflare, from October 2025) uses Web Bot Auth signatures. Intelligent Commerce Connect (2026-04-08) is in pilot with select partners and has no UK statement. On 2026-07-02, Visa said agents were completing live purchases with "over 30 European issuers", naming Barclays, HSBC UK, Lloyds, NatWest, Nationwide and Vanquis, at lastminute.com, Frasers, Cleverbridge and BrickDepot. lastminute's CEO: "Early days". | [O, primary] https://investor.visa.com/news/news-details/2026/Visa-Opens-the-Door-to-AI-Driven-Shopping-for-Businesses-Worldwide/default.aspx ; https://www.visa.co.uk/about-visa/newsroom/press-releases.3457328.html |
| **Mastercard Agent Pay** | Building on Web Bot Auth. It is in production in some Asian markets, with no UK status found. | [D, secondary] https://www.digitalcommerce360.com/2026/04/02/visa-mastercard-in-agentic-commerce/ |
| **Agent access disputes** | In Amazon v Perplexity (Comet), a preliminary injunction was granted on 2026-03-06. The Ninth Circuit vacated it in August 2026, describing the agent as a user's tool, and the case is back in district court. | [D, secondary] https://www.retail-insight-network.com/newsletters/us-court-overturns-amazon-injunction-perplexity |

### 2.2 What Cambridge TCG and RewardsPro can actually use today

- [I] **Cambridge TCG (as observed: not on Shopify, commerce retired).** Agentic Storefronts
  doesn't apply, because it needs a Shopify store. If commerce reopens:
  - The Shopify Agentic plan is the low-effort route into ChatGPT, Copilot and Gemini
    discovery, but purchase through these channels is for **US buyers only** today [O, Shopify UK
    page]. For a UK card shop selling mostly to UK buyers, the near-term value is
    discovery and brand mentions, not agent checkout.
  - Organic AI discovery (ChatGPT shopping, AI Mode) still works through ordinary crawlable
    product pages, structured data and, for Google, Merchant Center feeds. None of that needs a
    protocol integration [D, Google AI-features page; OpenAI help via search].
  - [D] Visa and card-network agent payments work through the acquirer or PSP. There is nothing for
    a small merchant to build today. Cloudflare and Akamai implement Trusted Agent Protocol
    verification, and cambridgetcg.com is already behind Cloudflare [O, headers].
- [I] **RewardsPro (a Shopify app vendor).** The agentic levers are on the merchant side of Shopify,
  not in ChatGPT:
  - [O, primary] Sidekick recommends apps in chat (changelog 2025-09-17): "up to three relevant
    app cards" for broad queries, built from App Store listing content. "Achieving the Built for
    Shopify badge improves search ranking in both the App Store and Sidekick."
    https://shopify.dev/changelog/app-recommendations-in-sidekick-now-available
  - [O, primary] Built for Shopify needs **50 net installs from active paid-plan shops and 5
    reviews**, plus performance thresholds.
    https://shopify.dev/docs/apps/launch/built-for-shopify/requirements . RewardsPro has 0
    reviews today [O].
  - [O] One developer reports (2026-04-06, anecdote with no Shopify reply) that Sidekick "consistently
    suggests the same 2-3 apps per category".
    https://community.shopify.dev/t/sidekick-ai-is-killing-app-store-discovery-always-recommends-the-same-top-3-apps/32988
  - [O, primary] Sidekick App Extensions (Spring '26, 2026-06-17) are open to any developer. Data
    extensions surface app data in Sidekick (the example given is loyalty stats), and action
    extensions stage changes for merchant confirmation. Smile, Yotpo, Klaviyo and Judge.me were
    launch partners, and Smile and Yotpo are direct loyalty competitors.
    https://www.shopify.com/news/spring-26-edition-dev . [D, secondary] Each extension
    `description` has a 256-token limit and must not promote, cross-sell or ask for reviews.
    That makes the description copywriting for an agent router.
  - [O, primary] Shopify App Pricing replaces Managed Pricing and the legacy Billing API (Spring
    '26). This matters if paid plans return.
  - [O] The UCP Loyalty extension (tiers, benefits, rewards visible during agent checkout) maps
    directly onto RewardsPro's tiers and cashback model. It is a real but early differentiator,
    with 11 identity-linking adopters in June. [I] It is worth tracking or contributing to, but
    building for it before having 50 installs would be premature.
  - [O, primary] Shopify's App Store requirement 1.3 forbids incentivised or fake app reviews,
    with removal or delisting as the penalty. https://shopify.dev/changelog/updated-app-store-requirements-13-always-use-honest-and-transparent-review-practices

---

## 3. Marketing *to* agents: catalogs, MCP and agent marketplaces as distribution

- [O, primary] Shopify Catalog and its UCP MCP endpoints are the largest agent-readable catalog in
  practice (see 2.1). On Shopify, products are included by default.
- [D, secondary] OpenAI opened ChatGPT app submissions (Apps SDK, which needs an MCP server) on
  2025-12-17, with a directory and review against published guidelines.
  https://venturebeat.com/technology/openai-now-accepting-chatgpt-app-submissions-from-third-party-devs-launches .
  The distribution value claims come mostly from agencies selling builds.
- [D, secondary] The official MCP Registry has been in preview since about 2025-09-08, with API
  v0.1, and server counts disagree (5k to 17k). Entries aren't checked against repository
  contents. https://pub.towardsai.net/mcp-registries-in-mid-2026-one-upstream-won-2ce541b92036
- [O] cambridgetcg.com already publishes many agent doors: a manifest, OpenAPI, `.well-known`
  MCP documentation, `agent.txt` and llms.txt. Its own llms.txt says the transport is "custom
  JSON-RPC over HTTPS POST, not MCP Streamable HTTP or HTTP+SSE; the stdio bridge for native MCP
  clients is not publicly distributed yet". [I] So standard MCP clients and registries can't
  connect to it as an MCP server today. Agent doors only market if a standard client can use them.
- [O] robots.txt and llms.txt on cambridgetcg.com also carry philosophical and doctrinal text
  addressed to agents (a "love-letter" at `/api/v1/dear-agents`, a "Sophia invitation", "Welcome to
  all existence ... from all dimensions"). [I] This is Yu's to keep. For marketing, the only point
  is that AI systems summarising "what is Cambridge TCG" read these files and the homepage. Today
  they will meet a data-infrastructure and philosophy project, not a card shop or app vendor. Entity
  consistency (one clear description everywhere) is among the few factors with any support (1.2).
- [I] For a small estate, "marketing to agents" reduces to:
  1. Being crawlable by search-purpose bots (robots plus the Cloudflare setting).
  2. One consistent entity description.
  3. Clean product and offer data where something is sold.
  4. App Store listing quality and Built for Shopify for RewardsPro.
  5. Optionally, a standards-conformant MCP or UCP surface when there is something to buy.
  New bespoke agent doors without standard clients have little distribution value. This matches the
  estate's own earlier finding that demand, not doors, is the constraint (MEMORY index: "Agent
  participation 2026-07 ... a DEMAND problem ... trap = building more doors").

---

## 4. Agents *in* the marketing workflow: what works, and what is hype

### 4.1 Evidence that AI creative can perform

- [O, primary, peer-reviewed] Daviet (INSEAD) and Nishimura (Wisconsin) in *Marketing Science*
  (DOI 10.1287/mksc.2024.1130; press release 2026-08-04) used an active-learning system that jointly
  optimised predicted performance and **brand alignment**. Designs were checked against brand
  standards before field testing. In a live Instagram campaign it reached a mean CTR of 0.98%,
  against 0.78% for aesthetics-only AI and 0.65% for a human designer. Eighteen months later, with
  no retraining, it scored 3.38% against 3.24% for the human campaign. https://www.eurekalert.org/news-releases/1141025
  - [I] The lesson is that an AI pipeline wins when it is a *loop* (generate, brand check, test,
    learn), not a one-shot generator.
- [D, secondary] Lee et al. (NYU and Emory; reported 2025-12-20) ran a Google Display field test.
  Fully AI-generated ads got +19% CTR over the human control, AI-*modified* human ads did no better
  or worse, and **labelling ads as AI-generated cut CTR by about 31.5%**.
  https://the-decoder.com/telling-consumers-an-ad-is-ai-generated-cuts-clicks-by-31-percent-study-finds/
- [D, secondary] Taboola with Columbia, Harvard, TUM and CMU (2026, observational): AI ads were
  comparable to human ads under tight controls, and AI ads that *didn't look AI-made* did best.
  https://www.taboola.com/press-releases/genai-ads-study-2026/
- [D, secondary] Consumer mood: brands such as Aerie and Equinox advertise *against* "AI slop". An
  Ipsos and Syracuse study (May 2026) is reported as finding that only 13% of viewers could
  confidently spot an AI ad. The backlash reads as being about perceived effort and craft more
  than detection. https://www.marketingbrew.com/stories/2026/01/28/brands-using-generative-ai-almond-breeze-equinox-dollar-shave-club

### 4.2 Evidence on agentic AI programmes in general

- [O, primary] Forrester (2026-06-03): "Three-quarters of enterprise leaders tell us they're
  adopting agentic AI", but only "a small minority" run it in meaningful production. Scaling
  "fails on task complexity, not agent count". Their recommendation is "bounded tasks behind
  approval gates and rollback paths", with identity and policy enforced in code.
  https://www.forrester.com/blogs/the-state-of-agentic-ai-in-2026-companies-are-chasing-few-are-catching/
- [D, secondary] Gartner (June 2025) predicts that over 40% of agentic AI projects will be
  cancelled by the end of 2027. It counts only about 130 "real" agentic vendors among thousands
  ("agent washing"). https://www.outlookbusiness.com/deeptech/artificial-intelligence/over-40-of-agentic-ai-projects-will-be-scrapped-by-2027-says-gartner

### 4.3 Tools relevant to a one-person estate

- [O, primary] Google Pomelli (Labs and DeepMind, 2025-10-28) builds a "Business DNA" (tone,
  fonts, imagery, palette) from a website and generates on-brand social and ad assets. It launched
  in the US, CA, AU and NZ. [D, secondary] It reached the UK, EEA and Switzerland around April
  2026, added Photoshoot (product imagery) and Animate (Veo 3.1 clips), and is testing Catalog and
  Websites. It is free while experimental. A known caveat is that it alters product details such
  as colours, logos and textures.
  https://blog.google/innovation-and-ai/models-and-research/google-labs/pomelli/ ;
  https://www.testingcatalog.com/google-tests-catalog-and-website-generation-for-pomelli-experiment.md
- [D, primary press] Adobe Brand Intelligence (April 2026) learns brand rules from approvals and
  rejections. Canva launched brand-intelligence agents the same day. These suit enterprises.
  https://news.adobe.com/news/2026/04/adobe-introduces-brand-intelligence
- [D, secondary] Meta Advantage+ is moving to end-to-end automated campaigns (URL in, creative and
  targeting out). Its ROAS claims are Meta-sourced and unverified, and I found no documented
  brand-guardrail controls. https://www.forbes.com/sites/terdawn-deboe/2026/04/25/meta-will-run-your-entire-ad-campaign-with-ai-should-you-let-it/
- [O] **ArtCraft (github.com/storytold)** is a family of Rust "Craft" apps (VectorCraft,
  PhotoCraft, FilmCraft, EffectCraft, DesignCraft, FigCraft, DeckCraft, AniCraft and others), all
  pushed 2026-10-18 to 20. PhotoCraft, VectorCraft, PdfCraft, GridCraft and WordCraft ship
  CLI/MCP servers. PhotoCraft's roadmap M11: "An agent completes 10 scripted edit tasks via MCP";
  **C2PA is "pending"** (#1050). Sources: `gh api orgs/storytold/repos`;
  `storytold/photocraft` `docs/roadmap.md`, `docs/mcp.md`.
  - [I] ArtCraft fits deterministic production best: templates, resizes, layouts and exports driven
    by agents from brand tokens. A generative model's look doesn't drift there, because the vector
    template carries the brand. Content credentials need a separate step until C2PA lands.

### 4.4 Failure modes, with evidence

| Failure | Evidence |
|---|---|
| Brand drift (wrong colours or logo, changed product details) | [D] Pomelli caveat (above). [O] The Marketing Science study needed explicit brand checks to win. |
| Hallucinated or unsupported claims | [O, primary] Google: "Generative models don't retrieve facts", so fact-check everything. [D] *Moffatt v Air Canada* 2024 BCCRT 149 held the firm liable for its chatbot's wrong statement (the "separate entity" defence was rejected). https://www.americanbar.org/groups/business_law/resources/business-law-today/2024-february/bc-tribunal-confirms-companies-remain-liable-information-provided-ai-chatbot/ |
| Scaled AI pages penalised | [O, primary] Google scaled content abuse policy and four spam updates in 2026 (1.1). |
| AI labelling lowers response | [D] -31.5% CTR when labelled (NYU/Emory). [I] Hiding AI use isn't the answer where disclosure is required. Use AI where it isn't the face of the message, and keep humans and real photos for trust moments. |
| Fake or incentivised reviews | [D, secondary] UK DMCC Act: fake reviews and concealed incentivised reviews are banned practices from April 2025. The CMA opened five review investigations on 2026-03-27, including reviews incentivised by discounts. Fines run up to 10% of turnover. https://www.taylorwessing.com/en/insights-and-events/insights/2026/03/the-cma-steps-up-its-fight-against-fake-reviews ; [O] Shopify App Store requirement 1.3 (2.2). |
| Measuring noise as signal | [O] GEO survey: 0.34–0.42 daily Jaccard, so repeated sampling is needed (1.2). |
| Agent projects stalling | [O] Forrester; [D] Gartner (4.2). |

---

## 5. What changes for brand: trust, provenance, verifiable claims

- [D, secondary] UK ads (ASA/CAP): there are no AI-specific rules and no blanket duty to disclose AI
  use. CAP's test is whether the audience would be misled without disclosure. A disclosure cannot
  rescue a misleading ad. CAP Code rule 3.7 requires documentary evidence *before* an objective
  claim runs. https://www.rpclegal.com/snapshots/advertising-and-marketing/summer-2025/cap-issues-guidance-on-use-of-ai-in-ads/
- [D, primary FAQ via search] EU AI Act Article 50 transparency duties apply from 2026-08-02, with no
  retroactive labelling. The final Code of Practice covers provider marking (50(2)) and deployer
  labelling of deepfakes and public-interest text (50(4)). Routine ad copy is less clearly covered
  than synthetic images, audio and video. https://digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act .
  [I] This matters if the estate markets to EU buyers.
- [O, primary] Google Merchant Center requires IPTC `DigitalSourceType` metadata on AI-generated
  product images and labels on AI-generated product text (1.1).
- [D, secondary] C2PA Content Credentials: LinkedIn shows credentials, Google reads them in "About
  this image", and OpenAI is reported to sign images. Many platforms still strip metadata.
  https://editorsweblog.org/2026/04/12/c2pa-adoption-tracker-platforms-content-credentials-2026
- [I] "Show the work" becomes the brand asset in an agent-mediated market. Agents and AI search
  favour verifiable specifics (prices, dates, statistics, quotations; see 1.2). Regulators require
  evidence before claims (CAP 3.7, DMCC). Humans discount content that looks AI-made (4.1).
  Practical forms:
  - a public claims page where each claim links to its evidence and date;
  - original data that others cite (Cambridge TCG already publishes pack contents and odds at
    `/pulls/*` and price standards [O, llms.txt]);
  - transparent pricing;
  - real photos of real stock;
  - provenance metadata on generated images.
- [I] Earned mentions (communities, creators, press, Reddit-style threads) are the strongest
  correlate of AI visibility (Ahrefs 0.664). That is ordinary PR and community work, so no agent
  shortcut exists, and manipulating it is now spam (Google) or illegal (DMCC fake reviews).

---

## 6. Evidence versus hype, side by side

| Claim you'll hear | Evidence verdict (as of 2026-10-20) |
|---|---|
| "GEO tactics boost AI visibility by 40%" | **Rejected as general** (arXiv 2607.14035). There is lab-only evidence for statistics and quotations. |
| "Add llms.txt to get cited" | **No effect found** (SE Ranking ~300k domains; Google ignores it). It helps doc-reading agents only. |
| "Schema/structured data gets you into AI Overviews" | **Google says not needed** for AI features. It still matters for rich results, Merchant Center and agent parsing [I]. |
| "Brand mentions drive AI visibility" | **Correlational support** (Ahrefs 0.664). Not shown causal. |
| "AI traffic converts better" | **Supported in US retail** (Adobe Q1 2026: +42%), but the share is still tiny. |
| "Agent checkout is the future, integrate now" | **Mixed.** OpenAI retreated from Instant Checkout. UCP is growing (~8k stores, ~99% Shopify), but test checkouts completed about 7% of the time, and channels are US-buyers-only for Shopify. |
| "AI creative beats humans" | **Supported in specific setups** (peer-reviewed Marketing Science, with a brand-aligned loop). Labelling cuts CTR. Crafted human work keeps a trust premium. |
| "Agents will run your marketing" | **Hype for now.** Forrester and Gartner show small production share and high cancellation. Bounded tasks behind approval gates are what works. |
| "Catalog AI search converts 2x" | **Vendor claim** (Shopify), unverified. |
| "Sidekick will send you installs" | **Favours incumbents.** Built for Shopify and reviews raise ranking, and one developer anecdote reports a "same top 3" loop. |

---

## 7. Proposed agentic marketing design for the estate

[I] This whole section is an agent's proposal for Yu to accept, change or decline. It follows Yu's
stated shape (truth, transparency, simple, modular, no forcing) and the ground's line 2: anything
outward needs Yu's word.

**Step zero (Yu, about an hour, needs no tools).** For each brand, write one positioning card:
*who it's for → the problem → the promise → the proof (with links) → what we sell now and the
price → what we won't say.* Without it, every agent will amplify the current "retired" message
(section 0).

**The pipeline: six small modules, each replaceable.**

1. **Brand source of truth (a repo folder, human-owned).**
   - `brand.toml`: colour and type tokens, logo files, clear-space rules, voice do/don't list,
     banned words (for example urgency phrases).
   - `claims.toml`: every claim we may make, with its evidence URL or file, date, owner and expiry.
   This is the "show the work" core, and agents only *read* it.
2. **Agent-readable surfaces (marketing to agents).**
   - One consistent entity description across homepage meta, Organization JSON-LD, llms.txt, App
     Store listing and social bios.
   - Crawlability for OAI-SearchBot, Claude-SearchBot, Claude-User, PerplexityBot and Googlebot,
     checked at robots *and* Cloudflare level. Search Console and Bing Webmaster Tools.
   - For RewardsPro: listing copy, Sidekick extension descriptions (256 tokens for an agent
     router) and the Built for Shopify path.
   - Standard MCP or UCP only when something is for sale.
3. **Production (agents in the workflow).**
   - Deterministic first: ArtCraft CLI/MCP renders templates from `brand.toml` (social cards,
     product cards, App Store screenshots, OG images, banner sizes).
   - Generative second: imagery or video only where it adds value, never for product truth (real
     photos of real cards).
   - Each generated image gets IPTC `DigitalSourceType`, and C2PA when tooling allows.
   - Pomelli can serve as a free UK-available comparison baseline.
4. **Automated gates (cheap, mechanical).**
   - (a) Brand lint: palette, fonts and logo checked against tokens. This is deterministic on
     vector output.
   - (b) Claims lint: extract every factual claim and require a match in `claims.toml`. An
     unmatched claim blocks the asset.
   - (c) Rhetoric lint: the estate's own RhetorLint and fomo-scan, which reject engineered
     urgency. They are listed in MEMORY.md, and fomoscan's x402 API "answered on 2026-10-18" per
     the estate map.
   - (d) Policy: CAP 3.7 evidence, DMCC reviews, Shopify 1.3, Google scaled content and Merchant
     Center AI labels.
   - (e) Accessibility, which doubles as agent-readability (Lighthouse agentic audits).
5. **Human approval (Yu).** A queue shows each asset with its claims, evidence links and lint
   results. Nothing publishes without Yu's yes. Approvals and rejections become examples for the
   next run (the Adobe-style learning loop, kept as plain files).
6. **Measure and learn.**
   - Search Console, Bing, Shopify Partner installs, Adobe-style AI referral tagging (UTMs and
     referrer).
   - A fixed AI-visibility prompt panel, run monthly, 7–8 repetitions per prompt per engine,
     recording citations. Treat it as noisy.
   - A one-page monthly note: what shipped, what moved, what to stop.

**What to do first (if Yu reopens selling).**
- RewardsPro:
  1. Fix the landing message and the App Store listing to match the decided offer.
  2. Earn the first 5 honest reviews and 50 paid installs through direct human outreach to a
     narrow niche (for example hobby and TCG shops, where Yu has domain credibility). Never
     incentivise reviews.
  3. Then Built for Shopify and a Sidekick data extension.
  4. Track the UCP Loyalty extension.
- Cambridge TCG:
  1. Decide the entity (shop, market, or data commons).
  2. Make one consistent description.
  3. Promote the original data assets (pull rates, price standards) to collector communities.
     Earned mentions are the evidence-backed lever.
  4. Consider Shopify's Agentic plan only if selling to US buyers.

---

## 8. Assets worth creating (human-facing and agent-facing)

[I] A catalogue derived from the above. ArtCraft fit is my judgement from its repo list.

| Asset | For | Tool fit |
|---|---|---|
| Brand kit (logo lockups, palette, type, icon set) as vector source plus tokens | humans and agents | VectorCraft, DesignCraft |
| Social and OG card templates (1:1, 4:5, 16:9, 1.91:1) | humans | VectorCraft or DesignCraft templates, batch via CLI |
| App Store screenshots and feature graphics for RewardsPro | humans plus Sidekick cards (built from listing) | FigCraft, PhotoCraft |
| Short explainer video or animation (15–30 s) | humans | FilmCraft, EffectCraft, AniCraft |
| One-page deck or PDF for merchant outreach | humans (B2B) | DeckCraft, PdfCraft |
| Claims page with evidence links | humans, agents, regulators | web page |
| Original data visuals (pull rates, price index charts) | humans plus AI citations | GridCraft plus VectorCraft |
| Organization, Product and SoftwareApplication JSON-LD; consistent meta | agents and search | code |
| Sidekick extension descriptions, App Store listing copy, `extensions_summary` | agent routers | copy (human-written, linted) |
| Shopify Knowledge Base FAQs (if on Shopify) | AI shopping agents | Shopify admin |
| llms.txt (low priority, keep accurate) | coding and browser agents | text |

---

## 9. Open questions (unknowns left unknown)

1. Where does Cambridge TCG's current revenue come from? The brief says it generates revenue, while
   the estate map (2026-10-18) and the live site say retail closed on 2026-07-06 and checkout
   answers 410. Is there a still-open Shopify store or eBay channel I couldn't see?
2. Is RewardsPro reopening paid plans? The landing page and listing (observed today) say paid plans
   are retired and the price is "Free". The memory index says retirement is "undecided" with an
   "honest-monetization branch".
3. Do Cloudflare's AI crawler or bot settings on cambridgetcg.com and rewardspro.io let search-purpose
   bots (OAI-SearchBot, Claude-SearchBot, PerplexityBot) through? This can't be verified without the
   dashboard. I didn't spoof user agents.
4. When will Shopify's AI channels open to UK buyers, and when will Google's UCP checkout reach the
   UK? There are no dates in any source.
5. Is ChatGPT self-serve Ads Manager open to UK advertisers? Sources conflict: a June 2026 report
   says rep-only, later blogs say self-serve.
6. Is Pomelli available in the UK? This rests on secondary reports from April 2026 only.
7. What does OpenAI's March 2026 shopping post say exactly? It returned 403, so I relied on
   secondary reports.
8. Which audience matters most: UK collectors, US buyers, or Shopify merchants worldwide? This
   decides which channels count.

---

## 10. Source list (as consulted 2026-10-20)

Primary, read today:
- https://developers.google.com/search/docs/appearance/ai-features (updated 2025-12-10)
- https://developers.google.com/search/docs/essentials/spam-policies (updated 2026-08-28)
- https://developers.google.com/search/docs/fundamentals/using-gen-ai-content (updated 2026-10-01)
- https://status.search.google.com/products/rGHU1u87FJnkP6W2GwMi/history
- https://www.shopify.com/uk/blog/how-agentic-commerce-works (updated 2026-06-18)
- https://shopify.com/news/agentic-commerce-momentum (2026-03-24)
- https://www.shopify.com/news/spring-26-edition-dev (2026-06-17)
- https://shopify.dev/docs/agents/catalog
- https://shopify.dev/changelog/app-recommendations-in-sidekick-now-available (2025-09-17)
- https://shopify.dev/docs/apps/launch/built-for-shopify/requirements
- https://ucp.dev/ ; github.com/Universal-Commerce-Protocol/ucp (loyalty.md, roadmap.md)
- github.com/agentic-commerce-protocol/agentic-commerce-protocol (README, spec/)
- github.com/GoogleChrome/lighthouse core/audits/agentic/*
- github.com/storytold (repo list; photocraft docs/roadmap.md, docs/mcp.md)
- https://investor.visa.com/... Intelligent Commerce Connect (2026-04-08)
- https://www.visa.co.uk/about-visa/newsroom/press-releases.3457328.html (2026-07-02)
- https://blog.google/innovation-and-ai/models-and-research/google-labs/pomelli/ (2025-10-28)
- https://www.forrester.com/blogs/the-state-of-agentic-ai-in-2026-companies-are-chasing-few-are-catching/ (2026-06-03)
- https://arxiv.org/html/2607.14035v1 (2026-07-15)
- https://www.eurekalert.org/news-releases/1141025 (Marketing Science; 2026-08-04)
- https://apps.shopify.com/rewards-pro ; https://rewardspro.io/ ; https://cambridgetcg.com/ (robots, llms.txt, sitemap, headers)
- be-main clone: estate/curated/capabilities.toml, families/commerce-tcg.toml, vocab/facets.toml

Secondary, read today (treat figures with care): techcrunch.com (Adobe 2026-04-16; Universal
Cart 2026-05-19), the-decoder.com (NYU/Emory), searchenginejournal.com (llms.txt study; UCP
update), nytroseo.com, ucpchecker.com, community.shopify.dev, thekeyword.co (ChatGPT ads UK
2026-06-08), testingcatalog.com (Pomelli EU/UK), helpnetsecurity.com (Cloudflare), law-firm notes
on CAP, DMCC and the EU AI Act, ahrefs.com (75k brands), medianama.com (Ahrefs CTR).
