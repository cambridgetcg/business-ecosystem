# ArtCraft suite: the layout, vector and document side (key: artcraft-layout)

Research notes for Yu's marketing exploration. Written 2026-10-20 (Europe/London) by a research
subagent (Claude Code, Opus 5.5). Read-only research, plus one small headless VectorCraft test
that wrote only into `scratchpad/mkt/vc-test/`.

**Basis labels.** Every claim is marked **[observed]** (I looked or ran it today), **[documented]**
(a source says so; I did not verify it myself) or **[inferred]** (my reasoning). Everything about
versions, issue counts, download counts and readiness is time-sensitive and dated 2026-10-20.

Working copies of the READMEs, roadmaps and docs I read are under
`scratchpad/mkt/artcraft-layout-src/`. The test outputs are under `scratchpad/mkt/vc-test/`.

---

## 0. The short version

- The eleven repos are real, very young and moving very fast. The apps were created between
  2026-09-30 and 2026-10-09; their first releases came out between 2026-10-02 and 2026-10-10, and
  new releases come every 1 to 4 days. **[observed]** (GitHub API, `repos/storytold/<app>/releases`)
- Each of the eight apps ships a signed and notarized universal macOS `.dmg` **and** a separate
  `<app>-cli-<ver>-macos-universal.zip`. **[observed]** (release asset lists). The CLIs expose the
  same command registry as the GUI, an MCP server (stdio), a headless batch mode and a JSON
  command catalogue. **[documented]** (READMEs). For VectorCraft I checked all of this by running it.
- Every app judges itself **alpha** or **pre-alpha**, and estimates it is about 47–65% "ready for
  real work" (see the table in §2). **[documented]** These are the projects' own figures. They count
  breadth honestly, but nobody has checked them independently.
- **What I verified first-hand with `vectorcraft-cli` 0.13.1:** headless, and with no window, an
  agent can make a 1200×630 OG card (PNG/JPG/WebP), a favicon/app-icon set (PNG at 16, 32, 180 and
  512, plus SVG), a palette as CSS custom properties and Adobe `.ase`, an outlined-text SVG, a
  PDF, and **a batch of on-brand social cards driven by CSV** (three variants from three rows in
  one run). It took well under a second. **[observed]**
- **Licensing is fine for commercial marketing output.** The code is MIT OR Apache-2.0, the bundled
  fonts are SIL OFL 1.1, and nothing I found restricts what you make with the apps. **[documented,
  plus inferred on outputs]** The one hard restriction: the **ArtCraft name and logos are
  trademarks**. Our marketing must not use them. **[documented]**
- **For the estate:** VectorCraft is ready today as an agent-drivable engine for brand kits and
  social graphics. DesignCraft (print, data merge, QR codes, IDML) and DeckCraft (PPTX decks) are
  promising, but I verified them only from their docs. PdfCraft is a good finishing tool (combine,
  watermark, optimise, set metadata). FigCraft suits landing-page mock-ups and code export.
  WordCraft, GridCraft and CADCraft are peripheral. Pin versions, keep a human approval gate in
  front of anything published, and keep a non-ArtCraft fallback ready. **[inferred]**

---

## 1. Suite-level facts

| Fact | Basis | Source |
|---|---|---|
| The org `storytold` holds the Craft apps beside older UE/voice repos (FakeYou/Storyteller lineage). | observed | `gh api orgs/storytold/repos` |
| macOS builds and CLIs are signed with Developer ID **Learning Machines LLC (DJ6XS33FX8)**; Windows builds with "Learning Machines Inc". | documented + observed | pdfcraft README "Signing identities"; `codesign -dv ~/.local/share/artcraft/vectorcraft-cli-0.13.1/vectorcraft-cli` → Authority=Developer ID Application: Learning Machines LLC (DJ6XS33FX8), timestamp 18 Oct 2026 |
| The installed `vectorcraft-cli` 0.13.1 zip matches the published SHA-256 (`fc2c1f01…59fc`). | observed | `https://github.com/storytold/vectorcraft/releases/download/v0.13.1/SHA256SUMS.txt` vs `~/.local/share/artcraft/INSTALLED.tsv` |
| The code licence is **MIT OR Apache-2.0**, and every repo has both LICENSE files. The GitHub API shows only "Apache-2.0", which is a detection artefact. | observed | repo root listings (`LICENSE-MIT`, `LICENSE-APACHE` in all 11); READMEs "License and credits" |
| The ArtCraft name, wordmark and "A" mark are trademarks, **not open source**. They may be used "only unmodified, and only as part of this repository", and must never appear in "advertising or marketing of anything other than VectorCraft". | documented | `storytold/vectorcraft/docs/brand/LICENSE-brand.txt` (each app carries the same file) |
| The apps are clean-room reimplementations of Illustrator, InDesign, Figma, PowerPoint, Acrobat, Word, Excel and AutoCAD workflows. | documented | each README and ROADMAP |
| Development is agent-heavy: ROADMAPs measure the remaining work in "Opus 5.5 agent hours"; FigCraft "was built in ~25 wall-clock hours by 4–6 parallel agents"; every repo has a `CLAUDE.md` and an `AGENTS.md`. | documented + observed | `figcraft/ROADMAP.md`; `vectorcraft/ROADMAP.md`; root file listings |
| Pace: VectorCraft had 524, 1,948 and 1,857 commits in its last three weeks; DesignCraft 296, 1,288 and 1,102. ROADMAPs mention waves of "about 90 community PRs" a day. | observed + documented | `gh api repos/storytold/<r>/stats/participation`; `vectorcraft/ROADMAP.md` header (updated 2026-10-19) |
| Contributors: vectorcraft 158, designcraft 89, figcraft 73, deckcraft 46, pdfcraft 246. | observed | `gh api repos/storytold/<r>/contributors --paginate` |
| Stars are extremely high for 3-week-old repos (vectorcraft 10,117; pdfcraft 16,469; photocraft 69,096). That reflects hype and attention, not maturity. | observed (counts) / inferred (meaning) | `gh api orgs/storytold/repos` |
| Downloads are real. VectorCraft v0.13.1: macOS dmg 33,718, Windows x64 msi 75,778, macOS CLI zip 1,718 (as of 2026-10-20). | observed | release asset `download_count` |
| getartcraft.com labels: VectorCraft, DesignCraft, DeckCraft, WordCraft, GridCraft and CADCraft are "In development"; PdfCraft and FigCraft are "Early alpha". Its pricing page sells **AI-generation credits for the ArtCraft studio** (Basic $10/mo, Pro $35/mo, Max $60/mo, with 20% off advertised); the Craft apps are free. | observed | `https://getartcraft.com/apps`, `https://getartcraft.com/pricing` (fetched 2026-10-20) |
| Homepage drift: the deckcraft repo's homepage `getartcraft.com/apps/slidecraft` returns **404**; `/apps/deckcraft` is the live page. pdfcraft's `/apps/printcraft` redirects to `/apps/pdfcraft`. | observed | curl of each URL, 2026-10-20 |
| Shared automation conventions across the suite: `--automation-read-root` and `--automation-write-root` confine an agent's file access ("PhotoCraft and the other Craft apps take the same ones"). | documented | `vectorcraft/docs/mcp.md` §Confining file access; deckcraft and wordcraft READMEs |
| The launcher's own "Thanks" table lists **12 community launchers** built before the official one. That shows strong community interest. | documented | `craft-launcher/README.md` |

---

## 2. Per-tool map

Abbreviations: **MCP** = Model Context Protocol server (stdio); **ctrl** = JSON control channel to a
running GUI (`<app> --control PORT`); **batch** = headless `run`/`script` with export. Latest
tags and dates come from `gh api repos/storytold/<r>/releases` **[observed]**. Open-issue and PR
counts come from GitHub search on 2026-10-20 **[observed]**. Readiness percentages are each
project's own estimate **[documented]**.

### Summary table

| Tool | Makes | Latest (date) | Releases (since) | Open issues / open PRs / closed issues | Stage (self) | Ready-for-real-work (self) | macOS | CLI asset | MCP | Headless batch |
|---|---|---|---|---|---|---|---|---|---|---|
| **vectorcraft** | Illustrator-style vector art | v0.13.1 (2026-10-18) | 15 (v0.1.0 2026-10-02) | 479 / 253 / 678 | alpha | ~62% full; ~65% mainstream illustrator; ~75% essentials | universal dmg, signed+notarized | `vectorcraft-cli-0.13.1-macos-universal.zip` (+ CLI in Linux tarballs and Windows) | yes (verified CLI; MCP not run) | yes, **verified** |
| **designcraft** | InDesign-style page layout and publishing | v0.9.0 (2026-10-18) | 10 (2026-10-02) | 204 / 185 / 293 | **pre-alpha** (alpha "~5–7 h away") | ~47% | dmg | `designcraft-cli-0.9.0-macos-universal.zip` | yes | yes (`run`, `script`) |
| **figcraft** | Figma-style UI design and prototyping | v0.7.0 (2026-10-18) | 7 (v0.2.0 2026-10-10) | 84 / 76 / 209 | alpha | ~53% | dmg | `figcraft-cli-0.7.0-macos-universal.zip`; `figcraft-server` (Linux only) | yes | yes (`render`, `export`, `run`) |
| **deckcraft** | PowerPoint-style decks | v0.8.0 (2026-10-18) | 7 (2026-10-08) | 194 / 238 / 161 | alpha → beta | ~55% | dmg | `deckcraft-cli-0.8.0-macos-universal.zip` | yes | yes (`run`, `render`) |
| **pdfcraft** | Acrobat-style PDF workbench | v0.9.0 (2026-10-18) | 10 (2026-10-02) | 951 / 722 / 711 | alpha | ~49% pro / ~55% everyday / ~66% essentials | dmg | macOS zip **and Linux CLI tarballs** (x86_64, aarch64) | yes (opt-in, `--compact`) | yes (`run --script`) |
| **wordcraft** | Word-style word processor | v0.8.0 (2026-10-18) | 7 (2026-10-07) | 618 / 746 / 751 | alpha | ~60% | dmg | `wordcraft-cli-0.8.0-macos-universal.zip` | yes | yes (`convert`, `run`) |
| **gridcraft** | Excel-style spreadsheet | v0.8.0 (2026-10-18) | 7 (2026-10-08) | 539 / 638 / 401 | alpha | ~50% | dmg | `gridcraft-cli-0.8.0-macos-universal.zip` | yes | yes (`run`, `eval`, `cat`) |
| **cadcraft** | AutoCAD-style 2D/3D drafting | v0.8.0 (2026-10-17) | 7 (2026-10-08) | 346 / 353 / 439 | "early, fast development" | not stated in README | dmg | `cadcraft-cli-0.8.0-macos-universal.zip` | yes | yes (`run`, `convert`) |
| **craft-fonts** | shared font assets (build input) | no releases | 0 | 1 / 29 / 0 | n/a | n/a | n/a | none | no | no |
| **craft-libs** | shared Rust crates (pdf, cms colour, ui, print, settings, ai-core…) | no releases | 0 | 62 / 74 / 9 | n/a | n/a | n/a | none | no | no |
| **craft-launcher** | installer/updater for the suite | v0.5.1 (2026-10-18) | 10 (2026-10-10) | 277 / 137 / 132 | early alpha | n/a | dmg | **no CLI** | no | no |

Installed on this Mac today (by the other session; I only listed them): `vectorcraft-cli`
0.13.1, `designcraft-cli` 0.9.0, `figcraft-cli` 0.7.0, `photocraft-cli`, `effectcraft-cli` and
`lightcraft-cli`. **[observed]** (`ls ~/.local/bin`, `~/.local/share/artcraft/INSTALLED.tsv`). I ran
only `vectorcraft-cli`, as the brief allowed.

### 2.1 VectorCraft: vector illustration (the strongest fit)

- **Makes:** logos and wordmarks, icons, illustrations, posters, social graphics, and print
  artwork with PDF/X. Features include Pen, Pathfinder, Shape Builder, live effects, gradient
  mesh, perspective grid, image trace, symbols, **variables and data sets** (Illustrator-style
  variable data), Export for Screens, Package and Print with tiling. **[documented]** README and
  command catalogue.
- **Maturity:** v0.13.1 (2026-10-18), 15 releases in 16 days. Self-assessed alpha: "~88% of core
  menu items… exist… feature depth ~75%… ~65% ready for real work for a mainstream illustrator".
  ROADMAP (updated 2026-10-19) says beta is "~170–270 h away". **[documented]** README §Status,
  ROADMAP.md. It lists known gaps: reliable `.ai` exchange, an interaction-fidelity pass, more 3D,
  11 of 57 raster effects, scripting and generative AI. **[documented]**
- **Relevant open issues (2026-10-20):** #3209 "Font size and type muddle in .svg export" (SVG
  text sizes differ from PDF); #3191 ".vectorcraft files cannot be opened in Adobe Illustrator";
  #3188 "Clipped object disappears after sending back" (priority: high). **[observed]**
  `gh api repos/storytold/vectorcraft/issues`
- **macOS:** universal dmg and a universal CLI zip, both signed and notarized. **[documented +
  observed for the CLI signature]**
- **Automation surface:** **785 commands** in the catalogue (`vectorcraft-cli commands`; 126 are
  enabled with no document open). Namespaces include object (138), select (49), document (32),
  path (32), text (29), file (28), swatch (23), variable (12), dataset (12), assets (6) and
  webExport (4). **[observed]** The CLI subcommands are `mcp`, `run`, `commands`, `convert`,
  `info`, `bench` and `perf`. **[observed]** `--help`. MCP modes: remote (`--connect` to a running
  app) or `--headless`; **with no flag it first tries 127.0.0.1:7979 and only then falls back to
  headless**. **[documented]** `docs/mcp.md`. MCP tools include `command_list`, `command_run`
  (catches misspelt param keys), `command_batch` (≤256 steps, atomic option), `doc_inspect` and
  `render_preview` (an inline PNG, so the agent can look at its own work). **[documented]** It also
  offers `action.batch` over a folder or over **data sets** (≤500), `script.check` (static analysis
  of Illustrator `.jsx` scripts; running them is not supported), and `SOURCE_DATE_EPOCH` for
  byte-reproducible PNG and PDF output. **[documented]** `docs/mcp.md` §Reproducible output.
  `VECTORCRAFT_NO_PREFS=1` keeps runs stateless. **[documented and used]**
- **Formats.** Read: .vectorcraft, .drawcraft, .svg, .svgz, .pdf, .ai, .ait, .png, .jpg, .gif,
  .webp, .tif, .bmp, .psd, .psb, .vctemplate, .dxf, .emf, .wmf, .eps, .ps, .af, .afdesign, .afpub.
  Write: .vectorcraft, .svg, .svgz, .pdf, .ai (PDF-compatible or legacy v7), .png, .jpg, .gif,
  .webp, .tif, .bmp, .vctemplate, .txt, .dxf, .eps, .emf, .wmf, .tga, .psd. **[observed]**
  `vectorcraft-cli --help`. PDF standards: PDF/A-2b and PDF/X-1a, X-3 and X-4. **[documented]**
  `document.exportPdf` params. Swatch libraries save as `vcswatches`, `gpl`, **`ase`** or **`css`**.
  **[observed]** WebP is **lossless only** ("lossy WebP isn't available yet"). **[documented]**
  `document.export` params. There is **no `.ico` writer** in the format lists, so legacy favicons
  need another tool. **[observed]**
- **Fonts and licensing:** bundles Inter, JetBrains Mono, Source Sans 3 and Source Serif 4, all
  OFL-1.1. Release builds embed craft-fonts (Japanese, Simplified Chinese and Arabic faces, OFL-1.1).
  It also uses system fonts, and `text.addFontFiles` copies licensed fonts into its own Fonts
  folder. The default text font in my headless runs was Source Sans 3. **[documented +
  observed]** `ASSETS.md`; `info` output. `file.package` leaves out "fonts whose licence doesn't
  allow embedding". **[documented]**
- **Brand assets it could produce:** logos and wordmarks (outlined type, SVG/PDF/EPS/AI),
  favicon and app-icon PNG sets with SVG, social posts and OG images (with built-in "Social" and
  "Branding" document presets), business cards, letterheads, envelopes, posters, signage up to
  tiled large prints, packaging artwork (with DXF dielines from CADCraft), palette swatch files
  (ASE and CSS), and CSS snippets (`css.generate`). **[observed for OG, favicon, palette and CSV
  variants; documented for the rest]**
- **Agent pipeline calls:** `file.new {preset}` → `shape.*` / `text.create {color,font,size,area}`
  → `paint.setFill` → `swatch.new {name}` → `variable.define` + `variable.bind` → `dataset.import
  {csv}` → `action.batch {source:"datasets", commands:[document.export {format:"png"}],
  destination:"folder"}` → `document.exportForScreens {formats:[…]}` → `swatch.library.save
  {format:"ase"|"css"}` → `file.info {copyrightNotice,…}`. QA with `render_preview` (MCP) or `info`.

### 2.2 DesignCraft: page layout and publishing

- **Makes:** multi-page layouts with spreads and parent pages, threaded text, a Knuth–Plass
  composer, tables, footnotes, indexes, hyperlinks, **Data Merge** (CSV, TSV or XLSX with text,
  image, **QR** and hyperlink placeholders), **Generate QR Code** (`object.qrCode`: URL, SMS, email,
  vCard business card) and EPUB. **[documented]** README, ROADMAP "Working today", `docs/agents.md`.
- **Maturity:** v0.9.0 (2026-10-18), 10 releases. Self-assessed **pre-alpha**: "next: alpha, ~5–7 h
  away… ready for real work is already ~47%". **[documented]** ROADMAP.md (reviewed 2026-10-11).
  Recent open issues include two marked critical ("not a DesignCraft document: duplicate item id",
  "I don't open file"), IDML/INDD import fidelity, and slow zoom on large documents.
  **[observed]** issues #1353, #1338, #1351, #1341.
- **macOS:** dmg and CLI zip. The CLI is installed on this Mac now. **[observed]**
- **Automation surface:** `designcraft-cli run | script | app | describe | commands | mcp`. Its
  scripts let a step use an earlier step's result (`"$0.story"`). `--export` writes .png, .jpg,
  .pdf, .designcraft, .idml, .epub, .html, .rtf and .txt. `data.merge {path|csv|rows}` creates a
  new merged document. **[documented]** `docs/agents.md`. There is also
  `color.extractTheme` (up to 5 colours from a placed image) and `swatch.addColorTheme`.
  **[documented]**
- **Formats:** in: native, IDML, INDD (via indd-utils), DOCX/RTF/TXT placement, images, PDF
  placement. Out: PDF (PDF/A-2b; **PDF/X-4** via `file.exportPdf {standard:"x4"}`, with
  "validation against a certified checker" still an open P0), IDML, **editable PPTX**
  (`file.exportPptx`), EPUB 3, PNG/JPG and HTML. **[documented]** ROADMAP lines 24, 59, 118, 197.
- **Fonts:** UI fonts Inter and JetBrains Mono (OFL). Document text uses system fonts plus
  craft-fonts in release builds. **[documented]** `ASSETS.md`, README.
- **Brand assets:** one-pagers and sell sheets, flyers, menus/price lists for the shop counter,
  **business cards with QR codes via data merge**, letterheads, product tags and shelf labels, a
  print-ready PDF for printers (PDF/X-4, not yet validated), a brochure/catalogue/zine, and a
  press-kit PDF. **[inferred from documented features]**
- **Agent calls:** `designcraft-cli script brand-onepager.dcs --in template.designcraft --export
  out.pdf --export out.png`; `data.merge {path:"wholesale-contacts.csv"}`; `object.qrCode`;
  `file.exportPdf {standard:"x4"}`; `file.exportIdml` (handoff to a human designer).

### 2.3 FigCraft: interface design and prototyping

- **Makes:** UI and landing-page design: frames, auto layout, components and variants, variables
  with modes (design tokens), prototypes, Dev Mode-style **code export (CSS, HTML, React, Leptos,
  SwiftUI, Compose)**, and PNG/JPG/WebP/SVG/PDF export. It has **8 starter templates, including
  "social post sizes", "landing page", "design system starter" and "icon set starter"**, which
  scripts can open via `file.newFromTemplate`. **[documented]** README.
- **Maturity:** v0.7.0 (2026-10-18), 7 releases. Self-assessed alpha: ~53% ready; menu breadth
  212/212; `.fig` import is best effort. **[documented]** ROADMAP.md. Open issue #912: the headless
  MCP `inspect_document` with allPages can emit more than 10 MiB and kill the server under the
  TypeScript MCP SDK. **[observed]**
- **Privacy note:** Share ▸ Online uploads the file to `collab.craftapps.dev` by default. It is
  stored **unencrypted on the server**, and the link is the only access control. **[documented]**
  README §Privacy. Do not use it for unreleased brand work. **[inferred]**
- **Automation:** `figcraft-cli info | export | convert | render | run | commands | mcp | plugin |
  perf`, a 400+ command registry, sandboxed WASM plugins, `export --bleed 3mm --crop-marks --cmyk`
  for print PDFs, and the same automation-root flags. **[documented]** README, `docs/cli.md`.
- **Fonts:** HarfRust shaping with craft-fonts and system fonts. The attribution lists Roboto,
  Montserrat, Lato, Open Sans, Poppins, Nunito Sans, Merriweather, Playfair Display, Source
  Sans/Serif, Carlito and Caladea under OFL-1.1. **[documented]** `ATTRIBUTION.md` line 29.
- **Brand assets:** landing-page and app-store screenshot mock-ups, an email header, a
  **design-token source of truth** (variables), component libraries for social templates, and
  hand-off code for web pages. **[inferred]**
- **Agent calls:** `file.newFromTemplate {template}`, variables/`autoLayout` commands, `figcraft-cli
  export page.figcraft -o out/ --format png --scale 2`, `figcraft-cli export … --node "Hero" -o
  hero.svg`.

### 2.4 DeckCraft: presentations

- **Makes:** slide decks with masters, 11 layouts, **8 original themes**, theme colours and fonts
  (Customize Colors/Fonts landed 2026-10-14), 150+ shapes, charts, tables, SmartArt basics,
  transitions including Morph, presenter view, PPTX open and save, and export to PDF (slides,
  notes, handouts), PNG/JPEG, **animated GIF** and outline. **[documented]** README, ROADMAP.
- **Maturity:** v0.8.0 (2026-10-18). Alpha, ~55% ready; "PPTX has never been tested on a corpus of
  real decks". **[documented]** Open issues: charts saved without an embedded workbook (#1047,
  high); macOS can't open .pptx from Finder (#1048, critical); deckcraft-web 0.8.0 panics at
  startup (#1059). **[observed]**
- **Known format limits:** **SVG pictures can't be inserted** (an SVG embedded in a PPTX shows
  its PNG fallback); `.potx` is written as a `.pptx`; `.thmx` is unsupported. **[documented]**
  `docs/file-format-parity.md` lines 20, 25, 56. So supply logos to decks as PNG (or EMF).
  **[inferred]**
- **Automation:** `deckcraft-cli commands | run | render | mcp`. The MCP tools are
  `new_presentation`, `add_slide`, `set_text`, `insert_picture`, `insert_chart`, `render_slide`,
  `export` and others; `design.theme` sets the theme. **[documented]** `docs/mcp.md`.
- **Fonts:** themes use Montserrat, Lato, Open Sans, Roboto, Merriweather, Playfair Display,
  Poppins and Nunito Sans (OFL-1.1). Embedded PPTX fonts are read and written. **[documented]**
  `ATTRIBUTION.md` line 60; `file-format-parity.md` line 66.
- **Brand assets:** a RewardsPro pitch deck, a merchant onboarding deck, wholesale sales decks,
  short **animated GIF** loops of a deck for social posts, and PDF handouts. **[inferred]**
- **Agent calls:** `deckcraft-cli run --cmd 'slide.new={"layout":"titleOnly","title":"…"}' --save
  x.deckcraft`, `design.theme`, `file.export {path:"deck.pdf"}`, `file.export {path:"loop.gif",
  width, secondsPerSlide, loop}`.

### 2.5 PdfCraft: PDF workbench (a finishing tool, not an authoring tool)

- **Does:** view, organise, combine, split and extract; comments; fill and **author forms**;
  passwords/AES-256; redaction and sanitising; basic digital signatures; metadata; an
  accessibility checker; OCR (Latin). **[documented]** README "Good today".
- **Maturity:** v0.9.0 (2026-10-18). Alpha: ~55% everyday, ~49% pro. "no office-document-to-PDF,
  and .docx export that loses layout". Pages are drawn by the `hayro` crate for now. **[documented]**
  It has the most open issues of the set (951 open, 722 open PRs). **[observed]**
- **Automation:** `pdfcraft-cli info | text | edit | combine | extract | split | tools | run |
  mcp | ui`. Tools are JSON-Schema described. MCP is opt-in, with `--root` confinement and a
  `--compact` tool list. MCP tool names in its doc include `doc_watermark`, `doc_background`,
  `doc_create`, `doc_create_multiple`, `doc_optimize`, `doc_reduce`, `form_merge_data` and
  `sign_document`. **[documented]** README, `docs/mcp.md`. It is the only one of these apps with
  **Linux CLI tarballs** in its releases. **[observed]**
- **Licensing note:** the OCR models are **CC-BY-SA-4.0** (fetched by `cargo xtask models`; release
  builds include them). **[documented]** `ATTRIBUTION.md` lines 321–322. I see no restriction on
  the OCR text itself, but that is unknown rather than verified. **[inferred]**
- **Brand assets:** combining one-pagers into a **press kit or wholesale catalogue PDF**,
  stamping "Draft" or "Wholesale only" watermarks, password-protecting trade price lists, a
  fillable wholesale application form, metadata (title, author, keywords) for SEO of PDFs, and
  size optimisation for email. **[inferred from documented tools]**
- **Agent calls:** `pdfcraft-cli combine a.pdf b.pdf --out kit.pdf`; `pdfcraft-cli edit in.pdf
  --title "…" --out out.pdf`; `pdfcraft-cli run --script steps.json --root ./work --report`.

### 2.6 WordCraft: word processing

- **Makes:** documents with styles, tables, references and **mail merge from CSV**. It reads and
  writes .docx and .odt/.rtf/.html/**.md**/.tex/.txt, opens .doc, and exports PDF with real text.
  **[documented]** README.
- **Maturity:** v0.8.0, alpha, ~60% ready. **[documented]** 618 open issues and 746 open PRs.
  **[observed]**
- **Automation:** `wordcraft-cli convert | text | inspect | run --template … --cmd … | run
  --script job.json | mcp` with 422 commands; MCP tools include `batch`, `inspect_document` and
  `render_page`. **[documented]**
- **Brand assets:** press releases, letterheads (as a .docx template), outreach letters via mail
  merge, and Markdown→DOCX/PDF of blog or SEO copy. **[inferred]** `wordcraft-cli convert post.md
  post.pdf` looks like the simplest bridge from agent-written Markdown to a branded PDF.
  **[inferred]**

### 2.7 GridCraft: spreadsheets (peripheral to brand, useful to marketing ops)

- XLSX native, 500+ functions, charts, pivot tables; MCP tools such as `read_range`,
  `write_range`, `insert_chart` and `evaluate_formula`; `gridcraft-cli eval`, `cat` and `run`.
  **[documented]** Alpha, ~50% ready. **[documented]** **Bundles no fonts**; it uses system fonts.
  **[documented]**
- **Marketing use:** the campaign calendar and asset tracker, **the CSV that drives VectorCraft
  data sets and DesignCraft data merge**, and simple performance charts exported as images for
  reports. **[inferred]**

### 2.8 CADCraft: drafting (niche for brand)

- DXF read/write (R12–2018) and DWG read/write (R2000) via acadrust; export to PDF plotting, SVG and
  PNG; `cadcraft-cli info | convert | run | mcp`; MCP tools `command_line` (type AutoCAD commands)
  and `render`. **[documented]** README. Fonts: system fonts and its own stroke font, plus
  craft-fonts in release builds. **[documented]**
- **Brand use:** **packaging dielines** (booster or sleeve boxes, display stands), shop-fit and
  signage dimension drawings, and event/stall floor plans. The dieline goes as DXF into VectorCraft
  (which reads DXF) for artwork. **[inferred]**

### 2.9 craft-fonts

- Holds only OFL-1.1 fonts for CJK, Arabic, Thai and Georgian coverage: BIZ UDPGothic, Shippori
  Mincho, BIZ UDMincho, Noto Sans CJK SC, Noto Sans Arabic, Noto Sans Thai and Noto Sans Georgian.
  It is an optional build input, and release builds embed it. **[documented]** README. It contains
  **no Latin display or brand typefaces**, so a brand font is a separate choice Yu has to make.
  **[inferred]**

### 2.10 craft-libs

- Shared crates: `craft-pdf` (PDF parse, raster and guarded authoring), **`craft-cms`** (ICC v2/v4
  colour management, soft proofing, gamut checks, built-in sRGB, Display P3 and synthetic coated
  CMYK), `craft-print` (CUPS/Windows), `craft-ui`, `craft-settings`, `craft-atomic` and
  `craft-ai-core` (the AI connection/consent data model). **[documented]** README. No releases.
  **[observed]** The practical point for marketing is consistent CMYK proofing across VectorCraft
  and DesignCraft. **[inferred]**

### 2.11 craft-launcher

- A GUI installer and updater (menu-bar app) that checks SHA-256 against each release and installs
  to `/Applications`. Early alpha, v0.5.1 (2026-10-18). **It has no CLI or MCP**, so it plays no
  part in an agent pipeline. **[documented + observed (no CLI asset)]**

---

## 3. First-hand verification: `vectorcraft-cli` 0.13.1 (2026-10-20, 13:27–13:30 BST)

Environment: `VECTORCRAFT_NO_PREFS=1`, cwd and all outputs in `scratchpad/mkt/vc-test/`. Before
the runs I confirmed that no `~/Library/Application Support/VectorCraft` folder existed, and the
runs created none. I did not run `mcp`.

| Test | Commands (abridged) | Result | Basis |
|---|---|---|---|
| Catalogue | `vectorcraft-cli commands > commands.json` | 785 commands, 402 KB JSON, each with `id/label/menu/params/enabled/disabled_reason/shortcut/host` | observed |
| Presets | `run --cmd file.newPresets --params '{"category":"Social"}'` / `"Branding"` | Social: 1080², 1080×1350, 1200×630, 1080×1920 story, 1000×1500, 1500×500 cover, 1640×624 page cover, 2560×1440 banner, and more. Branding: Logo 1000², business card 3.5×2 in and 85×55 mm, letterhead Letter/A4, envelope DL/#10 | observed |
| Palette swatch | `file.new` → 3× `shape.rectangle` + `paint.setFill` → `text.create` → `swatch.addUsedColors` → `--export .svg .png .pdf .vectorcraft` | All four files written in **0.12 s** total; clean SVG paths with hex fills | observed |
| OG card + palette files + harmony | `color.harmony {rule:"splitComplementary"}`; `file.new {preset:"Social Landscape Post 1200×630"}`; shapes; `text.create {color, area:{fit:"shrinkText"}}`; `swatch.library.save` to `.css` and `.ase`; `document.exportForScreens` to png/jpg/webp | 1200×630 PNG (17 KB), JPG (32 KB), WebP (18 KB, lossless); `palette.css` (`:root` custom properties) and `palette.ase` (binary); harmony returned a 3-colour scheme plus a 5-step tint/shade grid | observed |
| Favicon / app-icon set | `file.new {preset:"Logo 1000×1000"}`; ellipse; `text.create`; `type.createOutlines`; `document.exportForScreens {formats:[png w16, w32, w180, w512, svg]}` | 16/32/180/512 PNGs plus SVG written in one call. No `.ico` format is available | observed |
| **CSV-driven variants** | text frames → `variable.define` + `variable.bind` → `dataset.import {csv:"name,headline,price\n…"}` (3 rows) → `action.batch {source:"datasets", commands:[document.export {format:"png"}], destination:"folder"}` | **3 distinct 1080×1080 PNG cards** ("New booster box in stock / £89.99", etc.) plus a `.vectorcraft` copy of each. The text (including £ and %) came out correctly | observed |
| Outlined SVG | `convert swatch.vectorcraft swatch-outlined.svg --outline-text --decimals 2` | SVG with glyphs as paths and 0 `<text>` elements, so it renders the same without the font installed | observed |
| Inspect | `info swatch.vectorcraft` | JSON with artboards, fonts (family, resolved, missing-glyph count), object kinds, File Info (author, copyright fields) | observed |

**Gotchas I hit or found [observed]:**
1. A new object inherits the **last fill used**. `text.create` without `color` came out
   near-white (#F4F1EA) because the last rectangle used that colour. Always pass `color` (or
   `paint.setFill`) explicitly.
2. Swatch-library exports include the **default swatches** (53 entries) and give unnamed colours
   names like `R=31 G=58 B=95` (CSS var `--r\=31-g\=58-b\=95`). For a clean token file, create
   swatches with `swatch.new {name:"brand-navy",…}` and pass `names:[…]` to
   `swatch.library.save`.
3. In `action.batch` over data sets, `destination:"folder"` also saves a `.vectorcraft` per data
   set, and the file stem was `Untitled` even though I passed `name`/`title` to `file.new`. Name
   the files explicitly or rename them afterwards. `overrideExport` without `format` wrote
   `.vectorcraft`; with `format:"png"` it wrote PNGs.
4. The Export-for-Screens name pattern adds both a scale token and a suffix (`icon-16w-16.png`), so
   choose one of them.
5. Two quirks are **documented** rather than observed: the MCP server with no flag attaches to a
   running app on port 7979 first, so pass `--headless` plus the automation roots in pipelines.
   And SVG text sizing may differ from PDF (#3209), so outline the text in logo and social SVGs.

---

## 4. Brand-asset × tool matrix

Legend: ✅ verified headless today · ● documented, agent-drivable · ○ possible but secondary
or by hand · — not a fit.

| Asset | VectorCraft | DesignCraft | FigCraft | DeckCraft | PdfCraft | WordCraft | GridCraft | CADCraft |
|---|---|---|---|---|---|---|---|---|
| Logo / wordmark (SVG, PDF, EPS, AI) | ✅ (outlined SVG, PDF) | ○ | ● | — | — | — | — | — |
| Favicon / app-icon PNG set (+SVG) | ✅ (no .ico) | — | ● | — | — | — | — | — |
| Palette / tokens (ASE, CSS, GPL) | ✅ | ● (`color.extractTheme`) | ● (variables) | ○ (theme colours) | — | — | — | — |
| Social posts and stories | ✅ (presets) | ○ | ● (template) | ○ (GIF) | — | — | — | — |
| OG / link-preview images | ✅ | ○ | ● | — | — | — | — | — |
| CSV-driven promo variants | ✅ (data sets + batch) | ● (data merge) | ○ | — | ○ (`form_merge_data`) | ● (mail merge) | ● (the CSV source) | — |
| Business cards with QR | ○ (preset; no QR command seen) | ● (`object.qrCode` + merge) | — | — | — | — | — | — |
| Letterhead / envelopes | ● (presets) | ● | — | — | — | ● (.docx template) | — | — |
| One-pager / sell sheet / flyer | ● | ● (best fit) | ● | ○ | ○ (finish) | ○ | — | — |
| Pitch / sales deck | — | ○ (PPTX export) | ○ | ● (PPTX, PDF) | ○ (combine) | — | ○ (charts) | — |
| Print-ready PDF for a printer | ● (PDF/X-1a/3/4) | ● (PDF/X-4, unvalidated) | ● (bleed, CMYK) | — | ○ (check) | — | — | ○ |
| Packaging artwork and dielines | ● (art; reads DXF) | ○ | — | — | — | — | — | ● (dieline) |
| Signage / large posters | ● (tiling, PDF/X) | ○ | — | — | — | — | — | ○ (dimensions) |
| Press kit PDF | ○ | ● | — | ○ | ● (combine, metadata) | ● (release text) | — | — |
| Landing-page / app-store mock-ups | ○ | — | ● (code export) | — | — | — | — | — |
| Animated loop for social | ○ (GIF out) | — | ○ (prototype) | ● (GIF export) | — | — | — | — |

(EffectCraft and FilmCraft are better for motion, but they belong to another key, outside this
brief.) **[inferred]**

---

## 5. A sketch of an agentic pipeline: "brand kit as code" **[inferred design]**

1. **The source of truth is a small, versioned brand file per business** (Cambridge TCG,
   RewardsPro): named colours, the type pair, logo source SVG, voice and tagline, and per-channel
   size presets. It lives in the repo that owns the brand, not inside the tools.
2. **Kit build (VectorCraft, headless, confined, stateless):**
   `VECTORCRAFT_NO_PREFS=1 SOURCE_DATE_EPOCH=<fixed> vectorcraft-cli run …`, or the MCP server
   started with `mcp --headless --automation-read-root brand/ --automation-write-root brand/out/`.
   It makes: logo SVG (outlined), PDF and EPS; favicon/app-icon PNGs; `palette.ase` and
   `palette.css`; letterhead and business-card PDFs; and OG and social templates saved as
   `.vctemplate` with variables bound. Reproducible output means the generated files diff cleanly
   in git.
3. **Campaign build:** an agent writes the copy rows (headline, offer, CTA, URL, image path) into a
   CSV that a person can review. `dataset.import` + `action.batch {source:"datasets"}` render one
   card per row per size, and `render_preview` gives the agent a visual check (contrast, overflow:
   `text.create` and `dataset.select` report `overflow` ids).
4. **Print and sales collateral:** DesignCraft `data.merge` (QR to a tracked UTM link) for cards,
   flyers and shelf talkers, then `file.exportPdf {standard:"x4"}`. DeckCraft builds decks (PNG
   logos), and PdfCraft combines, watermarks and optimises the press kit and trade catalogue.
5. **The human gate:** nothing posts or prints automatically. Publishing, ad spend and printing
   orders are outward acts and need Yu's approval for that act. Assets go to a review folder or
   board first.
6. **Fallback:** keep the CSV plus template contract tool-agnostic, so the same rows can drive a
   non-ArtCraft renderer (HTML/CSS screenshotting, or Affinity/Illustrator by hand) if an ArtCraft
   release regresses.

---

## 6. Licensing and fonts: what matters for commercial marketing

- **Outputs:** MIT and Apache-2.0 govern the software, not what you make with it. I found no
  output, watermark or commercial-use restriction in any README or brand licence. **[documented
  (licences) + inferred (no output clause)]**
- **Bundled fonts** (Inter, Source Sans 3, Source Serif 4, JetBrains Mono, Noto, BIZ UD, Roboto,
  Montserrat, Lato, Open Sans, Poppins, Nunito Sans, Merriweather, Playfair Display, Carlito,
  Caladea) are **SIL OFL 1.1**. OFL allows use in commercial artwork and embedding in documents;
  it restricts selling the font files themselves. **[documented (licence names) + inferred
  (OFL terms from general knowledge, not re-read today)]**
- **The ArtCraft trademark** cannot appear in our marketing, ads, listings or domains. A plain-text
  "made with VectorCraft" credit is unclear under the brand licence, which addresses forks and
  derived works, not credits. **[documented + inferred]**
- **PdfCraft OCR models** are CC-BY-SA-4.0. **[documented]**
- **FigCraft online sharing** stores files unencrypted on a public server by default.
  **[documented]**
- **craft-ai-integrations** (an interim AI layer with "connections, keys, providers") exists. Any
  AI feature inside the apps would bring API keys and paid tokens into play, which needs separate
  authority. **[observed (repo description) + inferred]**

---

## 7. Risks and signals

- **Velocity is the risk.** Thousands of commits a week, and community PR waves of about 90 a day.
  Regressions are likely, and command parameters may change between releases (for example,
  `designcraft data.merge` changed to "now creates a new document", and the old `spread` parameter
  became an error). **Pin exact versions and checksums, and re-run a smoke test of the pipeline on
  every upgrade.** **[documented + inferred]**
- **Self-assessed readiness of 47–65%** is honest, but nobody has checked it independently;
  "hasn't been checked against real design documents" (FigCraft) and "PPTX has never been tested on
  a corpus of real decks" (DeckCraft). **[documented]**
- **Interchange with outside designers and printers** is weak: no reliable `.ai` round trip, IDML
  and INDD import fidelity issues, DeckCraft unable to insert SVG, and DesignCraft PDF/X-4 not
  validated. For anything going to a commercial printer, check the PDF with an independent
  preflight tool. **[documented + inferred]**
- **Star counts** (10k–69k in 3 weeks) are not a quality signal. Download counts are a better
  measure of real use. **[observed + inferred]**
- **What I did not verify:** the MCP servers (deliberately not run), the DesignCraft, FigCraft,
  DeckCraft, PdfCraft, WordCraft, GridCraft and CADCraft CLIs (not run, per the brief), GUI
  behaviour on macOS, CMYK/PDF-X correctness, and font-licence handling in `file.package`.
  **[observed: not done]**

---

## 8. Open questions for Yu or a later session

1. Do Cambridge TCG and RewardsPro already have source logo files (SVG/AI/PDF) and named brand
   colours and fonts, or does this start from scratch? (I found no brand-kit record in
   `business-ecosystem/estate`, and the only `marketing-outreach` record that was ever operating,
   `rewardspro-marketing`, was retired 2026-09-23.)
2. Which channels come first (Instagram/TikTok for TCG, the Shopify App Store listing and
   merchant outreach for RewardsPro)? That decides which preset sizes the kit must cover.
3. Who prints (local printer or online service), and what PDF standard do they accept? That
   decides whether VectorCraft PDF/X-1a/X-4 is enough.
4. Should the brand-kit-as-code source live in each business's own repo or in a shared estate
   folder? That is a question of ownership and placement.
5. Is a plain-text "made with VectorCraft" credit wanted, or acceptable under ArtCraft's brand
   licence? (Unclear; only ArtCraft can answer.)
6. Will the other session's install pin versions? Upgrades every 2–4 days would break unpinned
   scripts.

---

## Sources

- GitHub API (2026-10-20): `orgs/storytold/repos`; `repos/storytold/{vectorcraft,designcraft,figcraft,deckcraft,pdfcraft,wordcraft,gridcraft,cadcraft,craft-fonts,craft-libs,craft-launcher}` (+ `/releases`, `/readme`, `/contents`, `/stats/participation`, `/contributors`, `/issues`); search/issues counts.
- Repo files: README.md, ROADMAP.md, ASSETS.md / ATTRIBUTION.md and docs/brand/LICENSE-brand.txt of each app; `vectorcraft/docs/{mcp,development,releasing}.md`; `designcraft/docs/{agents,mcp}.md`; `figcraft/docs/cli.md`; `deckcraft/docs/{mcp,file-format-parity}.md`; `pdfcraft/docs/{mcp,cli-batch}.md`.
- Issues: vectorcraft #3209, #3191, #3188; designcraft #1353, #1351, #1341, #1338; deckcraft #1059, #1048, #1047; figcraft #912.
- Web: https://getartcraft.com/, /apps, /apps/vectorcraft, /apps/designcraft, /pricing (fetched 2026-10-20).
- Local: `~/.local/bin/vectorcraft-cli` (0.13.1), `~/.local/share/artcraft/INSTALLED.tsv` (read only); test outputs in `scratchpad/mkt/vc-test/`.
- Estate: `scratchpad/be-main/estate/vocab/facets.toml` (facet definition), `estate/curated/capabilities.toml` (marketing-outreach records).
