# ArtCraft media and AI-generation side: research notes (key: artcraft-media)

Written by an agent (Claude Code research subagent) on 2026-10-20 for Yu's marketing exploration.
Read-only research: GitHub REST reads via `gh api`, and public GET requests to getartcraft.com,
storyteller.ai, app.getartcraft.com and legislation.gov.uk. Nothing installed, downloaded (beyond
web pages and source files into this scratch folder), logged into or posted. No AWS calls.

Basis labels: **[O]** observed today (2026-10-20), **[D]** documented by the cited source,
**[I]** inferred (my reasoning). GitHub code search indexes default branches only, so a "not found"
from it is weak evidence.

Raw copies of the pages and files read are in
`/private/tmp/claude-501/-Users-yournameisai/b3c581a3-a92d-4da1-b779-a0867505bf64/scratchpad/mkt/raw/`.

---

## 1. Headline

There are two distinct halves under the ArtCraft name, and they behave very differently for a business.

1. **The Crafting Apps (PhotoCraft, LightCraft, EffectCraft, FilmCraft, SoundCraft).** These are
   local, offline, open-source (MIT OR Apache-2.0) Rust clones of Photoshop, Lightroom, After Effects,
   Premiere and Pro Tools. Each ships a signed and notarised macOS CLI zip, and every UI action is a
   command reachable from the CLI, a JSON control channel and an MCP server. No credits and no cloud
   are involved; brand files stay on the Mac. They are 2–3 weeks old (first releases 2026-10-02 to
   10-08), alpha or pre-alpha by their own account, and change by hundreds of commits a week. They
   are good for **deterministic, template-driven production**: resizing, grading, compositing
   product shots, CSV-driven ad variants, motion templates, captioned vertical video and audio stings.
2. **ArtCraft the AI app (desktop/web), plus the artcraft-services backend.** This is a
   credit-billed, cloud generation front end (Stripe; $10/$35/$60 per month as listed today) to
   about 62 third-party models, routed through aggregators (fal, CometAPI, Kinovi, MuAPI, OpenArt,
   GMI Cloud, Runway, Beeble, World Labs, Grok). It can also drive your own Sora, Grok, Midjourney,
   Runway, Higgsfield or World Labs consumer accounts by **extracting web-login cookies**, or a fal
   API key you supply. It has **no CLI or MCP** for agents. The only programmatic route is the Omni
   API, whose keys staff must enable per account. Inputs sent through the hosted path are uploaded
   to Storyteller/ArtCraft storage, where the code **defaults uploads and generated outputs to
   `Visibility::Public`**. I found no ArtCraft-specific terms of service. The only operator terms
   found (storyteller.ai/terms) are 2022 FakeYou-era terms, which grant the operator a perpetual,
   sublicensable licence over uploaded "Contributions", **including logos and trademarks**, for any
   commercial purpose.

**Implication [I]:** use the Crafting Apps as the agentic production line now. Treat ArtCraft AI
generation as an optional, human-approved and spend-capped step, only for non-confidential prompts
and assets, until Yu has read and accepted whatever terms actually govern it.

---

## 2. Repo-by-repo map

Release data come from `gh api repos/storytold/<repo>/releases` [O]. "Commits 7d" counts commits
since 2026-10-13T00:00Z [O]. Download counts and stars are the raw GitHub counters [O]. They are
implausibly high for 2–3-week-old repos (photocraft: 69,096 stars, created 2026-09-30; its v0.10.0
Windows MSI shows 115,157 downloads within 2 days), so **I do not treat them as adoption
evidence** [I].

| Repo | What it makes | Latest release | Cadence | macOS | Automation surface | Self-declared maturity |
|---|---|---|---|---|---|---|
| **artcraft** | AI image/video/3D "IDE for artists" (Tauri desktop app) | `artcraft-v0.41.0`, 2026-09-26 | 28 releases since 2025-07-14; 1 commit in last 7d | Universal DMG; macOS 12+ (download page) | **None for agents**: no CLI, no MCP in the desktop app. Backend has an Omni API (API key) and MCP-session auth endpoints (see §3.6) | No status badge; README lists 62 models |
| **artcraftx** | "Minimal desktop app for AI creation" | none | last push 2026-09-27; 0 commits 7d | build from source only | none found | "Early Experimental Release, Builds are Forthcoming" (README) |
| **craft-ai-integrations** | Shared AI connection layer for Craft apps (keys, providers, consent, ComfyUI) | none | created 2026-10-11; 46 commits 7d | n/a (library) | library crates only | "first draft… Nothing here is a final API"; **no real hosted provider verified**; no app has adopted it (docs/STATUS.md) |
| **artcraft-services** | Backend (`storyteller-web`, api.storyteller.ai), web app, website | none | 9 commits 7d | n/a | Omni API `/v1/omni_api/*`, app API `/v1/omni_gen/*`, `/v1/mcp/session/*` | licence shows `NOASSERTION` on GitHub |
| **photocraft** | Photoshop-style raster editor (layers, masks, type, PSD) | `v0.10.0`, 2026-10-18 | 12 releases since 2026-10-02; 1,017 commits 7d | Universal DMG + `photocraft-cli-0.10.0-macos-universal.zip` (signed, notarised) | **500+ commands**; `photocraft-cli run`, `batch`, `mcp`; loopback `--control`; MCP confined by `--automation-read-root/--automation-write-root` | "early alpha… not yet a Photoshop replacement" |
| **lightcraft** | Lightroom-style raw developer and library | `v0.9.1`, 2026-10-18 | 10 releases since 2026-10-02; 838 commits 7d | Universal DMG + CLI zip | `lightcraft-cli run/render/mcp`, `--control 7980`; MCP doc mentions no confinement flags | alpha; "~82% by feature count… ~61% day-to-day" (self-estimate) |
| **effectcraft** | After Effects-style motion graphics and compositing | `v0.11.1`, 2026-10-18 | 12 releases since 2026-10-02; 467 commits 7d | Universal DMG + CLI zip | `effectcraft-cli set/exec/render/render --template`, `mcp` (+ `.mcp.json`), JS `run_script`; confinement roots supported (refuse scripts while confined) | alpha; "first commit… 1 October 2026"; ~91% features, ~45% to replacing AE (estimate) |
| **filmcraft** | Premiere-style NLE: edit, colour, audio, captions | `v0.9.0`, 2026-10-18 | 10 releases since 2026-10-02; 241 commits 7d | Universal DMG + CLI zip | **650+ commands**; `filmcraft-cli exec/export/run/mcp`; bridge mode; **no folder confinement** ("can read and write wherever the user can") | alpha; 86% breadth, ~56% "ready for real work" (re-measured 2026-10-10) |
| **AniCraft** | "2D animation editor" | none | **empty repo** (no commits), created 2026-10-14 | none | none | placeholder |
| **soundcraft** | Pro Tools-style DAW (record, edit, mix, MIDI, synths) | `v0.8.0`, 2026-10-17 | 6 releases since 2026-10-08; 375 commits 7d | Universal DMG + CLI zip | `soundcraft-cli run … --bounce`, `app`, `mcp` with read/write roots | **pre-alpha**; "roughly 40% of the way to replacing it" |
| **spark** | 3D Gaussian-splat renderer for THREE.js | none in fork | fork of `sparkjsdev/spark` (MIT); fork last pushed 2025-11-20, upstream pushed 2026-10-20 | n/a (JS lib) | library | use upstream, not this fork [I] |

Sources: each repo's README via `gh api repos/storytold/<r>/readme`; releases API; commits API;
`docs/agents.md` (filmcraft, effectcraft); `docs/mcp.md` (photocraft, lightcraft, effectcraft,
soundcraft); craft-ai-integrations `docs/STATUS.md`.

### Formats (what each can take in and put out) [D]

- **PhotoCraft:** PSD/PSB read and write (round-trip render matches 307 of 309 psd-tools files); layered
  TIFF; reads PDN, ORA (read/write), KRA, SVG and Affinity (read-only); PNG, JPEG, WebP, GIF, BMP,
  TGA, ICO, QOI, EXR, HDR, FITS; HEIC read-only; AVIF write only with an optional build feature; no
  JPEG XL. CMYK and Lab, 8/16/32-bit, ICC colour management and soft proofing. (photocraft README)
- **LightCraft:** raw (DNG, CR2/CR3 partial, ARW, NEF, RAF, RW2, PEF, ORF partial, SRW partial).
  Export JPEG, PNG, TIFF, flat PSD, WebP, AVIF, JPEG XL, DNG, with **text or image watermark**,
  naming templates, batch, file-size limit and HDR gain-map JPEG. Contact-sheet PDF; slideshow export
  to PDF, JPEG sequence or **AV1 MP4/WebM** (no music). (lightcraft README)
- **EffectCraft:** render queue to H.264 MP4, ProRes MOV (with alpha), HEVC, AV1, WebM VP9 with alpha,
  PNG/JPEG/TIFF/EXR sequences, animated GIF, WAV/AIFF. **Lottie JSON / .lottie import and export.**
  `.ecproj` is versioned JSON. No `.aep` import. (effectcraft README)
- **FilmCraft:** own H.264 + AAC encoder (MP4); ProRes 422 HQ; DNxHR; MJPEG; PNG sequence; animated
  GIF; WAV. HEVC export only via hardware (VideoToolbox on macOS, 8-bit SDR). **No AV1 export.**
  Decodes HEVC, VP8/VP9, AV1, Opus, MP3/FLAC and more. Captions: SRT, WebVTT, SCC import/export, with
  burn-in. Interchange: FCP7 XML, FCPXML, OTIO, EDL, AAF, OMF; no `.prproj`. Export presets include
  **"Social Vertical 1080×1920"** (H.264, 12 Mbps), YouTube 1080p/4K and Vimeo
  (`crates/export/src/presets.rs`, lines 97–120). These are **local encode presets**: the only
  "TikTok" hit in code is the README screenshot caption [O], and I found no upload code.
- **SoundCraft:** WAV/BWF/RF64, AIFF, FLAC in and out; MP3, Ogg, AAC, ALAC, CAF and movie audio in only.
  **Bounce to WAV/AIFF/FLAC only** (no MP3/AAC), with dither and normalisation, reporting peak, true
  peak and **integrated LUFS**. CLAP, VST3 and AU plugins; built-in synths, drum synth and sampler.
  (soundcraft README)

### Local AI inside the Crafting Apps [D]

These are optional, local and downloaded on request, so no brand material leaves the Mac. Network
use is only for the download.

| App | Feature | Model | Size | Licence / gate | In official builds? |
|---|---|---|---|---|---|
| PhotoCraft | Select Subject, Remove Background (Quick Action) | **classical**, not ML ("ML backend not started", docs/roadmap.md M10; `crates/engine/src/cutout_cmds.rs`) | none | none | yes |
| LightCraft | Object/Describe masks | Meta **SAM 3** | ~3.4 GB | SAM License; HF repo **gated**; `segment.model.download` refuses without `acknowledged: true` | optional download (docs/ai-masks.md) |
| LightCraft | AI Denoise (Bayer raw) | user-installed weights | ? | ? | optional |
| EffectCraft | Roto Brush; face tracking | MobileSAM; MediaPipe Face Landmarker | 40 MB; 3.8 MB | (not checked) | optional download |
| FilmCraft | Transcribe, auto-captions | OpenAI **Whisper** tiny/base/small on candle (CPU) | n/a | MIT | **No.** Cargo feature `whisper` is off by default (`default = []` in `apps/filmcraft/Cargo.toml` and `apps/filmcraft-cli/Cargo.toml`); `packaging/macos/package.sh` builds without `--features` [O] → **source build needed** [I] |
| FilmCraft | Text-to-speech narration | Kokoro-82M (9 US-English voices) | 336 MB | weights Apache-2.0 per model card, but "repository has no LICENSE file" (crates/tts/README.md) | **No.** Feature `neural-voices` is off; release builds have only the "robotic" built-in formant voices (96.6% WER) |

Privacy [D]: EffectCraft README says "Private by default. No telemetry, and no network access unless
you ask for it." PhotoCraft's scorecard lists the update check as "missing… No update check in
crates" (`scorecard/distribution.toml`).

---

## 3. ArtCraft (the AI app) in depth

### 3.1 Models and providers [D]
README "Models and Providers Supported" (storytold/artcraft README, fetched 2026-10-20):
- **"ArtCraft" provider** (hosted, credit-billed): 62 models. Images: Nano Banana / 2 / Pro; GPT Image
  1.5 / 2 / 2.5 variants; FLUX.1 dev/schnell, 1.1 pro/ultra; Seedream 4–5. Video: Seedance 1.0–2.0;
  Kling 1.6–3.0; Veo 2–3.1; Sora 2/Pro (disabled); Vidu Q3; MiniMax H3; Flux 3. Audio: **Suno
  Music/Remix/Sounds/Sample**, Seed Audio 1.0. 3D: Hunyuan 3D, Tripo3D, Meshy 6, Rodin. Splats:
  Marble, TripoSplat. Some are marked disabled or restricted.
- Plus direct account routes: **Grok** (Imagine/Video), **Midjourney**, **Sora** (Sora 1/2, GPT
  Image 1), **World Labs** (Marble).
- "Planned": Kling, Google, Runway, Luma; interest in OpenArt and Freepik subscriptions.

### 3.2 How each route authenticates and who pays [O, code]
`crates/desktop/artcraft/src/core/providers/credentials/provider_credential_key.rs` (artcraft, main):
- **API keys (yours):** `FalApiKey`, `ReplicateApiKey`, stored as plain files `fal.api_key.txt` and
  `replicate.api_key.txt` in the app credentials dir. Only the fal route is implemented for image
  generation (`handle_api_providers.rs`: other providers return `NotYetImplemented`).
- **Web logins (your consumer accounts):** `GrokWebLogin`, `HiggsfieldWebLogin`, `MidjourneyLogin`,
  `RunwayWebLogin` (plus Sora and World Labs login windows under `services/`). The app opens the
  provider's site in a webview and **extracts its cookies** (e.g.
  `services/grok/windows/grok_login_window/grok_login_webview_extract_cookies.rs` reads
  `https://grok.com` cookies into a cookie store). It then calls consumer endpoints
  (`grok_consumer_client`, `midjourney_client` websocket, `openai_sora_client`).
  [I] Driving consumer web accounts this way is usually outside the providers' API terms and risks
  account suspension. I could not verify Midjourney's current terms: a plain GET of
  docs.midjourney.com returned **403** today.
- **ArtCraft hosted ("ArtCraft" provider):** session login to Storyteller. The server "checks the
  user's access and credits… calculates the cost, bills the wallet" (artcraft-services README).
  Stripe billing. The Omni API returns **`402 Payment required`** on insufficient credits
  (`_docs/artcraft_omni_api.md`).
- **Background removal** in ArtCraft is hosted too: ArtCraft API → fal `rembg_remove_background`,
  which has a `cost.rs` (artcraft `crates/api_clients/fal_client/...`). This contrasts with
  PhotoCraft's free local Remove Background.

### 3.3 Where brand material goes on the hosted path [O, code] → [I]
1. **Inputs are uploaded to Storyteller/ArtCraft storage** (MySQL metadata plus S3/R2 objects; CDN
   `cdn-2.fakeyou.com`; API `api.storyteller.ai`) (artcraft-services README; Omni API guide: "The
   server downloads each URL, stores it as a media file on your account").
2. **Default visibility is Public.** `Visibility::default()` returns `Public`
   (`crates/schema/public/enums/src/common/visibility.rs` L69–71). The image-upload handler uses the
   form value, else the user's preference, else that default (`upload_image_media_file_handler.rs`
   L182–185). Generation jobs hard-code `creator_set_visibility: Visibility::Public` for fal
   image/video, Kinovi image and Kinovi audio jobs (`omni_gen/generate/*/insert_db_job/*.rs`). The
   enum doc says Public entities "are able to be listed in public lists", while `Hidden` means
   "available to non-logged-in users as long as they have the URL".
   [I] So unreleased creative or product shots could be listable unless the account preference is set
   to Private. Whether any current public gallery actually lists them is **unknown**.
3. **Then to an aggregator, then the model vendor.** Backend API clients: `fal_client`,
   `comet_api_client` ("proxies a variety of third-party generative models… for Doubao Seedance
   2.0"), `kinovi_web_client` (kinovi.ai credits), `muapi_client`, `openart_client`,
   `gmicloud_client`, `runwayml_client`, `beeble_client`, `worldlabs_api_client`, `grok_api_client`
   (artcraft-services `crates/api_clients/`). [I] That is three parties (ArtCraft, aggregator, model
   vendor), each with its own retention terms, none reviewed here.
   The getartcraft.com home page (fetched 2026-10-20) says "no aggregator middleman". The code
   routes through aggregators, so the marketing copy and the evidence disagree [O].
4. **Even with your own fal key**, input images are first resolved to ArtCraft-CDN URLs
   (`map_media_file_tokens_to_cdn_urls`), and when signed in a **prompt record is written to the
   ArtCraft backend** (`create_prompt_record`, "Fails open") (`handle_api_providers.rs`). [I] fal
   fetches those URLs without ArtCraft auth, so they must be fetchable by URL.
5. **Auto-upgrade spending:** the fal route sets
   `request_mismatch_mitigation_strategy: RequestMismatchMitigationStrategy::PayMoreUpgrade`. [I] A
   mismatched request may be silently upgraded to a pricier configuration on your key.

### 3.4 Pricing (getartcraft.com/pricing, fetched 2026-10-20, USD) [O]
- Basic **$10/mo** (shown $8 with a "limited-time" 20% off): 1,000 credits/mo ≈ 250 Nano Banana images,
  ≈ 63 s of Seedance 2.0 video, ≈ 45 s of Kling 3.0 Pro.
- Pro **$35/mo** ($28): 3,750 credits ≈ 234 s of Seedance 2.0.
- Max **$60/mo** ($48): 6,600 credits ≈ 413 s of Seedance 2.0.
- Enterprise: custom. One-time credit packs "never expire". "Credits refunded if a generation fails".
- Footnote: "ArtCraft can be used without paying for a subscription. You can bring your own compute
  and third-party subscriptions."
- [I] The promotional urgency ("ends soon") is a FOMO pattern; prices may change. Backend code
  pins provider promo rates with "no automatic date-based switch" (Kinovi Wan 3.0 costs doc, "Last
  verified 2026-09-18").

### 3.5 Rights, licences and terms [O] / [D]
- **Software:** ArtCraft desktop is MIT OR Apache-2.0 (README). The ArtCraft name and logos are
  trademarks, "not covered by this license" (photocraft README, brand section).
- **No ArtCraft-specific Terms of Service or Privacy Policy found.** getartcraft.com `/terms`, `/tos`,
  `/terms-of-service`, `/privacy` and `/legal` returned **404** today [O]. app.getartcraft.com/terms
  returns only a JS app shell (content unknown) [O]. GitHub code search found no terms link in the
  ArtCraft or website frontends [O, weak].
- **storyteller.ai/terms** (200 today) serves a page titled **"Fakeyou.com | Terms and Conditions"**,
  "Last updated November 18, 2022", from **Learning Machines, Inc, doing business as Storyteller**,
  governed by Georgia (USA) law [O]. It says:
  - "You may not use Storyteller AI deepfakes for commercial use (unless otherwise stated…)".
  - Site Content is for "personal, non-commercial use".
  - **Contribution licence (§10):** by posting Contributions you grant "an unrestricted, unlimited,
    irrevocable, perpetual, non-exclusive, transferable, royalty-free, fully-paid, worldwide right,
    and license to host, use, copy, reproduce, … sell, resell, publish … distribute such
    Contributions … for any purpose, commercial, advertising, or otherwise … and grant and authorize
    sublicenses", explicitly including "trade names, logos, and personal and commercial images you
    provide". "You retain full ownership."
  - [I] **Whether these 2022 terms govern ArtCraft today is unknown.** If they do, uploading a Cambridge
    TCG or RewardsPro logo or product shot would license it broadly to the operator. Treat this as a
    blocker for brand uploads until clarified in writing (email hello@storyteller.ai, the contact on
    getartcraft.com).
- **Output ownership:** no ArtCraft statement found. It would then depend on each upstream vendor's
  terms (not reviewed here) and on law. UK CDPA 1988 s9(3) [O, legislation.gov.uk]: for a
  computer-generated work "the author shall be taken to be the person by whom the arrangements
  necessary for the creation of the work are undertaken". Whether that still holds after the UK's
  AI-and-copyright consultation is unverified here.
- **IP caution for Cambridge TCG [I]:** card art and logos (Pokémon, Magic, etc.) belong to third
  parties. Feeding them to generators or making AI derivatives of them is riskier than photographing
  the product as sold.

### 3.6 Agent surfaces for the AI app [O]
- **No CLI or MCP in the desktop app.** Code search found MCP only as backend session types.
- **Omni API** (`_docs/artcraft_omni_api.md`): `POST https://api.storyteller.ai/v1/omni_api/generate/video`
  (e.g. `model: seedance_2p0`, `aspect_ratio: tall_nine_by_sixteen`, `duration_seconds`,
  `start_frame_image_url`, `reference_*_urls`, required `idempotency_token`), then poll
  `GET /v1/omni_api/job_status/job/{token}`. Keys are prefixed `artcraft_api_`. **"API access is gated
  per account. Contact the Artcraft team to enable it."** Image generation and uploads are also
  listed (artcraft-services README).
- **MCP sessions:** `/v1/mcp/session/{create,refresh,revoke,list,{token}/delete}`, added 2026-08-27
  (commit "mcp sessions (#1917)"). Omni-gen handlers accept them (`mcp_session_tests.rs`). **No public
  MCP server binary or docs found**, so this is presumably a hosted MCP in progress [I].
- **craft-ai-integrations** would let Craft apps call providers directly with your own keys (OpenAI-
  compatible, BFL FLUX, Vertex Gemini images, BytePlus Seedance, ArtCraft Omni, local ComfyUI). It is
  unverified against any real provider and not adopted by any app (docs/STATUS.md).
  [I] This would be the cleaner future path, since it skips the ArtCraft storage and aggregator hops.

### 3.7 Content provenance (C2PA) [O]
- artcraft-services `crates/lib/video_info` **reads** C2PA and AIGC metadata from Seedance, Veo and Sora
  (C2PA) and Dreamina and Kling (`ilst`) videos. It notes that an ffmpeg re-encode "strips C2PA
  manifests and AIGC metadata".
- **No Craft app writes C2PA.** PhotoCraft lists C2PA as R/W "no" (#1050) in
  `docs/file-format-parity.md` and "pending" in its roadmap. FilmCraft's parity doc lists C2PA content
  credentials as missing.
- [I] Editing a provider's C2PA-labelled AI video in FilmCraft/EffectCraft and re-exporting will
  almost certainly drop the provenance label. Platforms' AI-labelling rules and the EU AI Act Art. 50
  transparency duties were **not checked in this pass**, so add a manual "AI-generated" disclosure
  step whenever generated footage is used.

### 3.8 Local vs cloud [O]
ArtCraft desktop generation is cloud-only. Code search found no ComfyUI or ONNX in
`crates/desktop` (weak evidence). The roadmap goal "Remove dependence on ArtCraft hosted services"
(ROADMAP.md) implies it currently depends on them. The DMG shrank from 871 MB (v0.32.0) to 95 MB
(v0.37.0) because of "move assets out of build to decrease binary size (#1712)", not because local
models were removed.

---

## 4. Promotional assets: what each tool could make for the estate

"Spend" means money leaves an account. "3P" means brand material goes to a third party.

| Asset | Business use | Tool | What an agent calls | Spend | 3P |
|---|---|---|---|---|---|
| Product photo develop and batch export (cards, sealed boxes, accessories) | Cambridge TCG listings, wholesale catalogue | **LightCraft** | `lightcraft-cli run --import shoot/ develop.set control=light.exposure value=0.3 app.export path=out.jpg longEdge=2048`, or `lightcraft-cli render in.dng -o out.jpg --preset <name>`; watermark on export; `export.contactSheet` for wholesale PDFs | no | no |
| Product cut-outs and retouch | clean white or brand backgrounds | **PhotoCraft** (classical Remove Background, healing, Content-Aware) | MCP `command_run` with the cut-out command (find id via `command_list filter=background`), `photocraft-cli batch --actions retouch.json --in raw --out clean` | no | no |
| Same, higher-quality AI matte | difficult foils and sleeves | ArtCraft background removal (fal rembg) **or** LightCraft SAM 3 local | ArtCraft UI (no agent API), or `segment.model.download {"acknowledged":true}` once Yu accepts Meta's licence | ArtCraft: yes (credits) | ArtCraft: **yes** |
| **Ad and social variants from one template** (price tiles, "New in", "Back in stock", preorder banners; RewardsPro feature cards) | Instagram 1080×1350, Stories 1080×1920, Shopify banners, App Store screenshots | **PhotoCraft Variables / Data Sets** | `file.import.variableDataSets {path: products.csv}` (header = variable names; values = text, true/false visibility, or **image path** for pixel replacement), then `file.export.dataSetsAsFiles {dir, format:"png"}` (`crates/engine/src/variables_cmds.rs`) | no | no |
| Lifestyle composites (product in a scene) | hero images, ads | **ArtCraft** (2D/3D compositing, Nano Banana / GPT Image edit) | UI, or the Omni API (staff-gated) | **yes** | **yes**: product shots and logo uploaded (default Public) |
| Motion graphics: animated price tags, logo sting, lower-thirds, "pack opening" reveal frame, RewardsPro points animation | Reels, TikTok, YouTube Shorts, web | **EffectCraft** Essential Graphics templates | Build once, `essential.exportTemplate`; then `effectcraft-cli render --template promo.ectemplate --values row.json --out promo_[#####].png --format png` per variant; or `effectcraft-cli render promo.ecproj --comp Main --out promo.mov --format prores` | no | no |
| Web micro-animations | RewardsPro landing page, Shopify theme | **EffectCraft → Lottie** | `effectcraft-cli exec file.exportLottie '{"comp":"Main","path":"main.json"}' main.ecproj` | no | no |
| Short-form vertical video (unboxings, restocks, app demo) with burned-in captions | Reels, TikTok, Shorts | **FilmCraft** | `filmcraft-cli --project p.fcproj --save import a.mov sting.wav`; `exec timeline.place …`; captions via `transcript.set` (bring a transcript JSON) → `transcript.createCaptions`; `export out.mp4 --preset "Social Vertical 1080×1920"` | no | no (local Whisper needs a source build with `--features whisper`) |
| App demo voice-over | RewardsPro explainer | FilmCraft Kokoro TTS (source build), or a human VO | `tts.*` commands | no | no |
| AI b-roll / image-to-video | ad openers | ArtCraft (Seedance, Kling, Veo…) | Omni API `POST /v1/omni_api/generate/video` | **yes** (~63 s of Seedance 2.0 per $10 Basic month) | **yes** |
| Audio stings, jingles, background beds | video intros and outros, ads | **SoundCraft** (built-in synths, sampler, MIDI) | `soundcraft-cli run --cmd 'mix.volume={…}' --cmd 'mix.insert={…}' --bounce sting.wav`; check LUFS in the bounce report | no | no |
| AI music | longer beds | ArtCraft → Suno models | ArtCraft UI | **yes** | **yes**; [I] check Suno commercial terms first |
| Loudness-correct final mix | platform delivery | FilmCraft EBU R128 meters, true-peak limiter | export | no | no |

---

## 5. A local-first agent pipeline sketch [I]

```
products.csv (from Shopify export, by a human or a read-only agent)
  └─ LightCraft  : develop + batch export product photos  (lightcraft-cli run …)
  └─ PhotoCraft  : template.psd + Variables → per-product PNGs (dataSetsAsFiles), sizes per channel
  └─ EffectCraft : promo.ectemplate + values.json → animated tiles / stings (render --template)
  └─ SoundCraft  : sting.wav (bounce, LUFS reported)
  └─ FilmCraft   : assemble vertical cut + captions → Social Vertical 1080×1920 MP4
  └─ human review gate (brand, claims, IP, AI-disclosure) → scheduling/posting (outside ArtCraft)
```
- Run MCP servers **confined**: `--automation-read-root <brand-kit+inputs> --automation-write-root <out>`
  for PhotoCraft, EffectCraft and SoundCraft. FilmCraft has no confinement, so run it via the CLI on
  explicit paths. LightCraft confinement is unknown.
- **Pin versions.** Hundreds of commits a week means command ids and parameters can shift. Record
  `<app>-cli --version` with every render, and keep golden-frame checks (`render_frame`).
- Keep any ArtCraft AI step behind an explicit, per-job human approval with a credit cap. Use only
  non-confidential prompts, and no logos or unreleased product shots, until the terms question
  (§3.5) is answered.

---

## 6. Flags

**Spends money**
- ArtCraft subscriptions and credit packs (Stripe); Omni API generations (402 when out of credits).
- Your own fal or Replicate keys through ArtCraft (with the `PayMoreUpgrade` strategy on fal).
- Your consumer accounts (Sora, Grok, Midjourney, Runway, Higgsfield, World Labs) via cookie-driven
  web logins: their quotas or credits, plus [I] account-suspension risk.
- ArtCraft hosted background removal (fal rembg, costed).
- The Craft apps spend nothing. Optional model downloads are free but large (SAM 3 is 3.4 GB).

**Sends brand material to third parties**
- Anything on the ArtCraft hosted path goes to ArtCraft storage (default **Public**), then an
  aggregator (fal, CometAPI, Kinovi, MuAPI, OpenArt, GMI Cloud, Runway, Beeble, World Labs, Grok
  API), then the model vendor.
- The BYO fal-key path still uses ArtCraft CDN URLs for inputs and logs prompts to ArtCraft when
  signed in.
- Web-login routes send material straight to OpenAI (Sora), xAI (Grok), Midjourney and others under
  your consumer account.
- Legacy storyteller.ai terms (if they apply) grant a perpetual, sublicensable licence over uploads,
  including logos.

**Safety and quality**
- BYO API keys are stored as plaintext `.txt` files in the ArtCraft app data dir [O, code]. Use a
  dedicated low-limit key if ever used.
- FilmCraft MCP has no filesystem confinement. EffectCraft `run_script` executes JS (refused when
  confined).
- No C2PA writing anywhere, and re-encoding strips provider C2PA, so disclose AI use manually.
- Maturity figures are **self-reported**, and FilmCraft states it is "largely built by" agents.
  Parity percentages measure presence, not reliability.

---

## 7. Open questions
1. Which terms of service and privacy policy actually govern ArtCraft (app.getartcraft.com and the
   desktop app) today? Are the 2022 storyteller.ai/FakeYou terms (non-commercial clause; broad
   contribution licence incl. logos) still applicable? Who owns the outputs?
2. Can an account set default visibility to Private, and do public galleries or listings exist for
   ArtCraft media today?
3. Would ArtCraft staff enable Omni API access for a small business, and is there a hosted MCP
   endpoint coming (MCP-session auth exists since 2026-08-27)?
4. Retention and training terms at each aggregator (fal, CometAPI, Kinovi, MuAPI, OpenArt, GMI Cloud)
   and each model vendor.
5. Does EffectCraft template mode render straight to MP4 or ProRes? (Only PNG output is tested in
   `apps/effectcraft-cli/tests/qa_template.rs`.)
6. Does LightCraft's MCP support read/write roots? (Not mentioned in docs/mcp.md.)
7. Will official FilmCraft builds ever ship Whisper and Kokoro, or must the estate build from source?
8. Are the very high star and download counters organic? (Irrelevant to tool use; relevant if
   anyone cites them as social proof.)
9. Platform AI-label rules (Meta, TikTok, YouTube) and EU AI Act Art. 50 timing for marketing that
   uses AI footage: not checked here.

## 8. Source index (all fetched 2026-10-20)
- GitHub: `orgs/storytold/repos`; `repos/storytold/{artcraft,artcraftx,craft-ai-integrations,artcraft-services,photocraft,lightcraft,effectcraft,filmcraft,AniCraft,soundcraft,spark}` (readme, releases, commits)
- artcraft: `README.md`, `ROADMAP.md`, `_docs/artcraft_omni_api.md`, `crates/desktop/artcraft/src/core/providers/credentials/provider_credential_key.rs`, `.../generate_image/providers/artcraft_router/handle_api_providers.rs`, `.../services/grok/windows/grok_login_window/grok_login_webview_extract_cookies.rs`, `crates/api_clients/` listing, compare `artcraft-v0.32.0...artcraft-v0.37.0`
- artcraft-services: `README.md`, `crates/api_clients/` listing, `comet_api_client/src/lib.rs`, `kinovi_web_client/costs_wan_3p0.md`, `crates/schema/public/enums/src/common/visibility.rs`, `.../media_files/upload/upload_image_media_file_handler.rs`, `.../omni_gen/generate/{image,video,audio}/insert_db_job/*.rs`, `.../routes/application_routes/mcp_session_routes.rs`, `.../mcp_sessions/create_mcp_session_handler.rs`, `crates/lib/video_info/src/lib.rs`
- craft-ai-integrations: `README.md`, `docs/STATUS.md`
- photocraft: `README.md`, `docs/mcp.md`, `docs/roadmap.md`, `docs/gaps.md`, `docs/file-format-parity.md`, `crates/engine/src/cutout_cmds.rs`, `crates/engine/src/variables_cmds.rs`, `scorecard/distribution.toml`
- lightcraft: `README.md`, `docs/mcp.md`, `docs/ai-masks.md`
- effectcraft: `README.md`, `docs/agents.md`, `docs/mcp.md`, `apps/effectcraft-cli/tests/qa_template.rs`
- filmcraft: `README.md`, `docs/agents.md`, `docs/transcripts.md`, `crates/tts/README.md`, `crates/export/src/presets.rs`, `apps/filmcraft/Cargo.toml`, `apps/filmcraft-cli/Cargo.toml`, `crates/engine/Cargo.toml`, `packaging/macos/package.sh`, `.github/workflows/release.yml`; `storytold/craft-common-actions/.github/workflows/release.yml`
- soundcraft: `README.md`, `docs/mcp.md`
- Web: https://getartcraft.com/ , /pricing , /download , /faq , /apps ; https://getartcraft.com/{terms,tos,terms-of-service,privacy,legal} (404); https://app.getartcraft.com/terms (JS shell); https://storyteller.ai/terms ; https://www.legislation.gov.uk/ukpga/1988/48/section/9 ; https://docs.midjourney.com/... (403)
- Estate context: `be-main/estate/vocab/facets.toml` (marketing-outreach in "grow"); `be-main/estate/curated/capabilities.toml` (rewardspro-marketing: marketing-outreach "retired"; saas-marketing-suite/template: "designed only")
