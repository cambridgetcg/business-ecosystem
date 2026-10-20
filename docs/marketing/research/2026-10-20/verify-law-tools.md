# Fact-check: law and tools claims for the marketing design

Checked 2026-10-20 by an adversarial fact-check agent. Primary sources were read directly
(EUR-Lex/Publications Office text, Commission PDF, legislation.gov.uk, gov.uk, ICO, Federal
Register API, NY Senate, GitHub API, live getartcraft.com/storyteller.ai pages, platform help
pages). The web-search budget ran out partway through, so a few points are left as noted gaps.
Nothing here is legal advice.

Verdict key: confirmed = matches the primary source; corrected = partly wrong or overbroad,
precise statement given; refuted = wrong; unverifiable = no primary source reached.

---

## 1. EU AI Act Article 50, the AI Omnibus and the Commission guidelines

**1a. Article 50 applies from 2 August 2026: CONFIRMED.**
Article 113 AI Act; the Commission guidelines restate it at para 153: "Article 50 AI Act will apply
as from 2 August 2026", for all in-scope systems whenever placed on the market.
Source: Commission guidelines C(2026) 5054, 20.7.2026,
https://ai-act-service-desk.ec.europa.eu/sites/default/files/2026-07/guidelines_on_the_implementation_of_the_transparency_obligations_for_certain_ai_systems_under_article_50_of_the_ai_act_bzptwqhk0ikg1dtlddap41psfy_131215.pdf

**1b. Omnibus deferred provider marking to 2 Dec 2026, but not deployer labelling: CORRECTED (overbroad).**
Regulation (EU) 2026/1744 (Digital Omnibus on AI) is dated 8 July 2026. It was published in the OJ on
24.7.2026 and entered into force on the third day after publication. It adds Article 111(4):
"Providers of AI systems, including general-purpose AI systems, generating synthetic audio,
image, video or text content, that have been placed on the market before 2 August 2026 shall take
the necessary steps in order to comply with Article 50(2) by 2 December 2026."
- So the four-month grace period covers ONLY generative systems already on the market before
  2 Aug 2026 (recital 38). Generative systems placed on the market on or after 2 Aug 2026 must mark
  output from that day.
- Deployer duties (Art 50(4): deepfake and public-interest-text disclosure) and Art 50(1)
  interaction disclosure were not deferred. Guidelines para 153: partly interactive systems get
  the grace "only with regard to the marking obligation".
Source: OJ L 2026/1744, 24.7.2026, http://publications.europa.eu/resource/celex/32026R1744
(also https://eur-lex.europa.eu/eli/reg/2026/1744/oj/eng); guidelines para 153 (above).

**1c. Guidelines (20 July 2026) treat AI product images that look different or better as deepfakes needing a visible label: CONFIRMED, with limits.**
C(2026) 5054 final is dated Brussels, 20.7.2026 (Commission news item also dated 20 July 2026).
It lists as an example of a deep fake under Art 3(60): "An AI-generated image of a product in
advertisement or packaging that can affect the audience's perception and mislead as to the actual
product appearance, characteristics or use (e.g. making the product appear not identical to the
real product, more appealing or with improved quality than in real life)."
Para 117 says deployer labels must be "understandable and perceivable by natural persons
(e.g. with visible or audible labels)". Deployers "cannot rely on the machine-readable marking"
of Art 50(2).
Limits that matter for marketing:
- Para 116: AI colour correction, background extensions or replacements "for clearly aesthetic
  purposes", compositions of existing products, and re-scaling in product ads or packaging are
  "likely to have only a minor impact", so they are not deepfakes.
- A real product against an AI-generated background is NOT a deepfake "as long as the ad is not
  likely to mislead the audience about the product's actual representation".
- A company that merely commissions an agency, without controlling whether and how the agency
  uses AI, is not the deployer. The agency is.
- The test is objective. No intent to deceive is needed.
- The guidelines are a Commission interpretation, not binding law.
Sources: guidelines PDF (above) pp. 34–37 and para 117;
https://digital-strategy.ec.europa.eu/en/news/commission-publishes-guidelines-transparency-obligations-providers-and-deployers-certain-ai-systems (20 Jul 2026)

---

## 2. UK DMCC Act and the CMA

**2a. Unfair commercial practices provisions in force 6 April 2025, covering fake reviews, concealed incentivised reviews and drip pricing: CONFIRMED.**
SI 2025/272 (made 4 March 2025), reg 2(3): Chapter 1 of Part 4 is in force from 6 April 2025,
"except sections 232, 234 and 235". Reg 2(11) brings in Schedule 20.
- Sch 20 para 13 bans fake reviews and reviews that conceal they were incentivised.
  "Commissioning" includes "incentivising by any means".
- s.230(4): the total price includes all mandatory fees. This is the drip-pricing rule.
Sources: https://www.legislation.gov.uk/uksi/2025/272/made ;
https://www.legislation.gov.uk/ukpga/2024/13/schedule/20 ;
https://www.legislation.gov.uk/ukpga/2024/13/section/230

**2b. First CMA DMCC fine was £4.2m in April 2026: CORRECTED.**
- The first use of the new fining powers was Euro Car Parks: £473,000, published 13 Feb 2026
  (Final Enforcement Notice 10 Dec 2025). It was for failing to answer an information notice, and
  is under appeal.
- The AA fine of £4.2m (from £7m, after a 40% settlement discount), published 15 April 2026, is
  "the first financial penalty the CMA has imposed for a breach of consumer law using its new
  enforcement powers". It was for drip pricing a £3 booking fee, plus over £760,000 of refunds.
- Later: the CMA blog of 14 Oct 2026 reports over £11.8m in fines since April 2026, including
  Gold's Gym, Wayfair and Buy It Direct.
Sources: https://www.gov.uk/government/news/cma-fines-euro-car-parks-473k-for-failure-to-comply-with-legal-information-notice (13 Feb 2026);
https://www.gov.uk/government/news/cma-orders-the-aa-and-bsm-driving-schools-to-refund-learner-drivers-over-drip-pricing (15 Apr 2026);
https://competitionandmarkets.blog.gov.uk/2026/10/14/direct-consumer-enforcement-18-months-on/ (14 Oct 2026)

**2c. Five fake-review investigations opened 27 March 2026, including discounts for 5-star reviews: CONFIRMED.**
The targets are Autotrader/Feefo, Dignity, Just Eat and Pasta Evangelists. Pasta Evangelists is
the one examined for whether "customers were offered discounts on future orders in exchange for
leaving 5-star reviews". There is no outcome yet (CMA blog, 14 Oct 2026), so no infringement
should be implied.
Source: https://www.gov.uk/government/news/fake-and-misleading-reviews-5-businesses-under-cma-investigation (27 Mar 2026)

**2d. CMA guidance on AI agents dated 9 March 2026: CONFIRMED.**
Title: "Using AI agents: complying with consumer law", CMA, published 9 March 2026. The business
is responsible for its AI agent's conduct, including a vendor-built agent. Label the agent where a
customer could think they are talking to a person.
Source: https://www.gov.uk/government/publications/complying-with-consumer-law-when-using-ai-agents (9 Mar 2026)

---

## 3. UK Data (Use and Access) Act 2025, PECR and the ICO

**3a. PECR changes (analytics exception, higher fines) in force 5 February 2026: CONFIRMED.**
SI 2026/82 (Commencement No. 6), reg 2, brings these into force on 5 Feb 2026:
- s.112 and Sch 12 (the storage and access exceptions);
- s.115 and Sch 13 (the Commissioner's enforcement powers for PECR).
Sch 13 para 18 applies DPA 2018 s.157 penalty maxima to PECR regs 5–8, 14 and 19–24. The higher
maximum (s.157(5)) is £17.5m or 4% of worldwide turnover, replacing the old £500,000 cap. I read
s.157 and a summary of para 18, not the consolidated modified text.
Sources: https://www.legislation.gov.uk/uksi/2026/82/regulation/2/made ;
https://www.legislation.gov.uk/ukpga/2025/18/schedule/13 ;
https://www.legislation.gov.uk/ukpga/2018/12/section/157

**3b. ICO final guidance (April 2026) lets cookieless or analytics-only measurement run without consent if users are informed and can object: CORRECTED (needs conditions).**
The ICO finalised its storage and access technologies guidance on 29 April 2026. The "statistical
purposes" exception (new PECR Sch A1 para 5) needs ALL of these:
- the sole purpose is statistics on use of YOUR service, to improve it;
- the data is not shared except with someone helping make those improvements (a processor,
  not a joint controller);
- users get clear and comprehensive information;
- users get a simple, free means to object (for example a toggle that is on by default), and
  the storage or access stops if they object;
- you don't rely on browser settings to infer non-objection.
It does not cover tracking or profiling individuals, cross-service monitoring, or any ad use.
Mixed-purpose tools need consent. "Cookieless" is not the test: the rule covers any storage or
access on the device (cookies, pixels, local storage, fingerprinting). Measurement that never
touches the device is outside reg 6 but still under UK GDPR.
Sources: https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/ (updated 29 Apr 2026);
https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/what-are-the-exceptions/ ;
https://www.legislation.gov.uk/ukpga/2025/18/schedule/12

---

## 4. United States

**4a. FTC rule on fake reviews and testimonials (16 CFR 465), effective 21 Oct 2024: CONFIRMED.**
Federal Register doc 2024-18519, 89 FR 68077, published 22 Aug 2024: "This rule is effective
October 21, 2024." §465.2(a) covers reviews that misrepresent that the reviewer exists or had
experience with the product, whatever tool made them.
Sources: https://www.federalregister.gov/api/v1/documents/2024-18519.json ;
https://www.ecfr.gov/current/title-16/chapter-I/subchapter-D/part-465

**4b. New York requires disclosure of synthetic performers in ads from 9 June 2026: CONFIRMED.**
S.8420-A was signed on 11 Dec 2025 as Chapter 617. It takes effect on the 180th day after it became
law, which is 9 June 2026 (my calculation). Scope:
- applies to a person creating an ad for a commercial purpose with ACTUAL KNOWLEDGE of a
  synthetic performer; the disclosure must be conspicuous;
- penalties are $1,000 for a first violation and $5,000 for later ones;
- exempt: audio-only ads, AI used solely for language translation, and ads for expressive works
  (consistent use); the advertising media themselves are not liable.
Gap: I did not find a later chapter amendment, and searches were limited.
Source: https://www.nysenate.gov/legislation/bills/2025/S8420/amendment/A

---

## 5. ArtCraft Crafting Apps (GitHub org storytold), via the GitHub API on 2026-10-20

Repos checked: vectorcraft, photocraft, designcraft, figcraft, effectcraft, lightcraft, filmcraft,
deckcraft, pdfcraft.

**5a. Licensed MIT OR Apache-2.0: CONFIRMED.**
In all 9 repos, Cargo.toml has `license = "MIT OR Apache-2.0"`, LICENSE-MIT and LICENSE-APACHE
are present, and NOTICE says "MIT License or the Apache License, Version 2.0, at your option".
Caveats:
- GitHub's license detector shows only Apache-2.0 for these repos.
- Bundled third-party assets keep their own licences (for example OFL fonts, ISC Lucide icons,
  and BSD-3 libfacedetection weights in PhotoCraft). See each NOTICE and ATTRIBUTION file.

**5b. Each release ships an `<app>-cli` with an MCP server: CONFIRMED, with a packaging caveat.**
- Every release of all 9 repos has an `<app>-cli-*` asset: vectorcraft 15/15, photocraft 12/12,
  designcraft 10/10, figcraft 7/7, effectcraft 12/12, lightcraft 10/10, filmcraft 10/10,
  deckcraft 7/7, pdfcraft 10/10.
- The CLI asset is macOS universal only, except pdfcraft (also Linux x86_64 and aarch64).
  FigCraft also ships a figcraft-server.
- Each README documents an MCP server via `<app>-cli mcp` (stdio), and each CLI source mentions
  MCP. I did not run the binaries.
Latest releases (2026-10-18): vectorcraft v0.13.1, photocraft v0.10.0, designcraft v0.9.0,
figcraft v0.7.0, effectcraft v0.11.1, lightcraft v0.9.1, filmcraft v0.9.0, deckcraft v0.8.0,
pdfcraft v0.9.0.

**5c. ArtCraft name and logos are trademarks, not to be used in our marketing: CONFIRMED.**
NOTICE and docs/brand/LICENSE-brand.txt, present in all 9 repos, say the marks are owned by the
ArtCraft Team and are not open source. The permission is limited to copies of the repo and the
app itself. "Neither the marks nor the ArtCraft name appear in the name, logo, icon, domain,
social media handle, app-store listing, advertising or marketing of anything other than
[the app]." Use must never suggest endorsement. A modified version may say in plain text that it
is "based on <App> by the ArtCraft team". Any other use needs written permission. The licence
covers the ArtCraft marks, not the app names (PhotoCraft etc.), which are not addressed there.

**5d. No Craft app writes C2PA yet; PhotoCraft issue #1050 open: CONFIRMED.**
- #1050 "feat(io): attach and inspect C2PA Content Credentials on export and open" is open
  (created 2026-10-08, updated 2026-10-16). It says "Nothing in the tree creates, interprets or
  verifies a manifest today".
- PR #6956 is open and unmerged. It covers read/verify on open only; "Signing on export is left
  for a follow-up PR".
- None of the 9 Cargo.lock files contains a c2pa crate.
- Org code search finds C2PA only in PhotoCraft and FilmCraft docs. ArtCraft's backend
  (artcraft-services, video_info) reads C2PA from Veo/Sora videos but does not write it.

---

## 6. ArtCraft AI app: backend visibility and terms

**6a. Backend defaults uploads and outputs to public: CONFIRMED in source (deployed behaviour not verified).**
In storytold/artcraft-services (main):
- `crates/schema/public/enums/src/common/visibility.rs` has `impl Default for Visibility { fn
  default() -> Self { Self::Public } }`. "Public" means it can be listed in public lists.
- Upload handlers (image, video, audio, generic) use the visibility in the request, else the
  user's preferred visibility, else `Visibility::default()` (Public).
- Generation jobs (for example `omni_gen/generate/image/insert_db_job/insert_fal_job.rs`)
  hardcode `creator_set_visibility: Visibility::Public`.
- A change-visibility endpoint exists. The repo licence is NOASSERTION.

**6b. Only operator terms found are the 2022 storyteller.ai/FakeYou terms with a broad licence over uploads: CONFIRMED (as of 2026-10-20).**
- getartcraft.com (home, /pricing, /faq, /support, /download, /press-kit) links no terms or
  privacy policy.
- /terms, /privacy, /tos, /terms-of-service, /privacy-policy and /legal all return 404.
- The app.getartcraft.com bundle has no terms or privacy link.
- The contact address on the site is hello@storyteller.ai.
- https://storyteller.ai/terms (page title "Fakeyou.com | Terms and Conditions", identical to
  fakeyou.com/terms) is "Last updated November 18, 2022". The operator is Learning Machines, Inc
  d/b/a Storyteller.
- Its §10 Contribution License grants "an unrestricted, unlimited, irrevocable, perpetual,
  non-exclusive, transferable, royalty-free, fully-paid, worldwide right, and license to host,
  use, copy, reproduce, disclose, sell, resell, publish ... and distribute such Contributions
  (including, without limitation, your image and voice)", including derivatives and sublicences.
- The privacy statement is also dated 18 Nov 2022.
- Whether these terms legally bind ArtCraft users is unclear. They are not linked from ArtCraft.

---

## 7. Platform AI labels

**7a. TikTok rejects ads with undisclosed AI-generated content: CONFIRMED.**
The Misleading and false content ad policy (last updated April 2026) says: "If we identify
AI-generated content that has not been disclosed, your ad will be rejected or restricted."
- Disclosure can be TikTok's AIGC label or your own clear disclaimer, caption, watermark or sticker.
- Minor AI edits (lighting, colour, background removal, denoise) are not "significant".
- The Ads Manager disclaimer page (Sept 2025) lists the AI-generated disclaimer as mandatory for
  fully AI-generated or significantly AI-modified media.
Sources: https://ads.tiktok.com/help/article/tiktok-ads-policy-misleading-and-false-content ;
https://ads.tiktok.com/help/article/about-ad-disclaimers-in-tiktok-ads-manager

**7b. YouTube auto-labels some AI content: CONFIRMED (organic uploads).**
Creators must disclose realistic altered or synthetic content. YouTube "may automatically apply
an AI label" in three cases: content made with YouTube's GenAI tools, content with C2PA metadata,
and content its systems detect. Labels from YouTube tools or C2PA can't be removed by the creator.
The page does not address ads, and it is undated.
Source: https://support.google.com/youtube/answer/14328491

**7c. Google Ads added an AI-content label setting in July 2026: CONFIRMED.**
Policy update posted 9 July 2026. The setting rolls out gradually through July 2026 across Google
Ads, DV360, CM360, Merchant Center and Ads Editor.
- Labelled ads show a disclosure in My Ad Center's "How this ad was made" panel.
- Visible on-ad overlays appear only for campaigns targeting the EU, India and New York.
- Google may auto-label assets made by Google AI tools.
- Using the setting "doesn't guarantee compliance". Election ads still use the separate "Altered
  or synthetic content" checkbox.
Sources: https://support.google.com/adspolicy/answer/17257106 (9 Jul 2026);
https://support.google.com/google-ads/answer/17140115 ;
https://blog.google/products/ads-commerce/google-ads-ai-transparency-labels/ (9 Jul 2026)

**7d. Meta labels AI content in ads: CORRECTED (narrower).**
- Meta adds an "AI info" label (in "About this ad", or next to "Sponsored" when there is a
  photorealistic AI human) to ads created or significantly edited with META's own generative AI
  ad tools. Minor edits are exempt.
- Meta "will also begin" detecting third-party AI via industry-standard signals (newsroom post
  updated 1 Jun 2026), but rollout is gradual.
- A help-centre page still says ads made with third-party tools are not labelled.
- Advertiser self-disclosure is required only for social issue, election and political ads.
  Undisclosed ads are rejected, and from 1 June 2026 automated detection also adds "AI Info"
  there.
Sources: https://about.fb.com/news/2025/02/gen-ai-transparency-metas-ads-products/ (3 Feb 2025, updated 1 Jun 2026);
https://transparency.meta.com/policies/ad-standards/SIEP-advertising/SIEP ;
https://www.meta.com/help/artificial-intelligence/355108217670024/

---

## Gaps

- I did not read the consolidated text of DPA s.157 as modified for PECR. The fine level rests on
  Sch 13 para 18 plus s.157(5).
- I did not search for later NY chapter amendments to S.8420-A.
- ArtCraft's deployed backend behaviour is unverified. Only source code on main was read.
- Platform policy pages change without notice. Re-check them before publishing claims about them.
