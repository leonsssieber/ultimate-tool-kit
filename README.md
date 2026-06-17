# 🧰 Ultimate Toolkit

A free, ad-free, all-in-one productivity website — convert files, edit media, remove
backgrounds, key out green screens and more. **Everything runs locally in your browser.**
Your files are never uploaded to any server.

Inspired by vert.sh / toolknit, but with more tools and a clean dark-mode UI.

> No build step. No framework. Just static files + ES modules loaded from CDNs.
> Drop it on GitHub Pages or Vercel and it works.

## ✨ Tools included (110+ across 15 categories)

| Category | Tools |
|---|---|
| **Image** | Converter (PNG/JPG/WebP/AVIF/BMP), Compressor, Resizer (+social presets), JPG↔PNG / WebP one-click converters, HEIC→JPG, AI/EPS/PDF→PNG, SVG→PNG, Image→ICO favicon, **Grid / Page Split (equal grid or A4-style aspect tiling)**, Circle Crop, Flip & Rotate, Watermark, Remove EXIF/metadata |
| **PDF** | Images→PDF, PDF→Images, Merge, Split/Extract, Compress, PDF→Text, PDF→Word |
| **Documents** | Word→PDF, Word→Text/HTML, Markdown→PDF, HTML→PDF |
| **Data** | CSV→JSON, JSON→CSV, JSON↔YAML, CSV→Markdown table, Number Base, CSV→Excel, Excel→CSV |
| **Audio** | Converter (MP3/WAV/OGG/FLAC/M4A/AAC/OPUS), Noise Reduction, Vocal Remover, Trim, Change Speed, Reverse, Adjust Volume, Noise Generator, Metronome, Visualizer, BPM Detector, Text-to-Speech |
| **Video** | Converter, Compress, Video→GIF, GIF→Video, Images→Video slideshow, Screenshot, Extract Audio, Mute, Trim |
| **AI & Effects** | AI Background Remover, Chroma Key (green screen) |
| **Text & Code** | Lorem Ipsum, Fancy Text, Morse Code, JSON Formatter, Text Diff, Markdown Editor, Image→ASCII, URL Encode/Decode, HTML Entities, Regex Tester, Text↔Binary, Caesar/ROT13 |
| **Calculators** | Age, Unit, Percentage, BMI, Tip, Mortgage/Loan, Meeting Cost, Aspect Ratio |
| **Time** | Stopwatch, Countdown, Pomodoro, World Clock, Timestamp Converter, Event Countdown |
| **Creative** | Color Picker, Gradient Generator, Whiteboard, Signature Maker, Pixel Art, CSV Chart Maker, Color Palette Extractor, Contrast Checker |
| **Tests** | Typing Speed, Keyboard Tester, Reaction Time, CPS (live), Aim Trainer, Mic & Camera Test |
| **Weird Converters** | Image↔Audio, Any File↔Image, Secret Text↔Image — *reversible* lossless round-trips |
| **Fun** | Random Spinner, Coin Flip, Dice Roller |
| **Utilities** | QR Generator, QR Reader, Base64, Hash/Checksum (MD5+SHA), Text Tools, Password Generator, UUID Generator |

## 🔒 How "local" works

- **Images, PDFs, QR, text, hashing** → native browser APIs (Canvas, WebCrypto, pdf-lib).
- **Audio/Video** → [`ffmpeg.wasm`](https://github.com/ffmpegwasm/ffmpeg.wasm) (single-threaded
  core, so no special server headers are needed — works even on GitHub Pages).
- **Background removal** → an ONNX model run in-browser via
  [`@imgly/background-removal`](https://github.com/imgly/background-removal-js).

The first time you use a media tool or the background remover, the browser downloads the
engine/model (cached afterwards, then fully offline).

Other on-demand libraries (loaded only when their tool is used): `marked` (Markdown),
`heic2any` (HEIC), `spark-md5` (MD5), `mammoth` (Word), `html2pdf.js` (Word→PDF), `qrcode`.

### Honest limitations
- **Vocal remover** is a fast stereo "center-channel" trick (karaoke), **not** true AI stem
  separation (Demucs/Spleeter are too heavy for pure client-side). Quality varies by song.
- **PDF → Word** extracts the text into an editable `.docx`; complex visual layouts/columns
  are flattened (true reflow conversion isn't possible offline).
- **Compress PDF** re-renders pages as images, so text stops being selectable — best for
  scanned/image-heavy PDFs.
- **BPM Detector** is an estimate (autocorrelation) — best on music with a steady beat.
- **AI/EPS→PNG** works with PDF-compatible `.ai` files (most modern Illustrator exports).
- **Weird Converters** are exact, reversible round-trips (a file's bytes are packed into a
  lossless WAV or PNG, then decoded back). They only round-trip if the encoded carrier stays
  uncompressed — e.g. don't run the WAV through an MP3 encoder or re-save the PNG as JPG.
- Large videos can be slow with the single-threaded engine (see "faster video" below).

## 🚀 Deploy

### GitHub Pages
1. Create a repo and push these files.
2. Repo **Settings → Pages → Build and deployment → Source: Deploy from a branch**,
   pick `main` / `/ (root)`.
3. Done — your site is at `https://<user>.github.io/<repo>/`.
   (The included `.nojekyll` file makes sure the `assets/` folder is served as-is.)

### Vercel
1. Import the repo at [vercel.com/new](https://vercel.com/new) (or run `vercel` in this folder).
2. Framework preset: **Other** (no build command, output dir = root). `vercel.json` is included.
3. Deploy.

### Run locally
Because it uses ES modules, open it through a server (not `file://`):
```bash
npx serve .
# or
python -m http.server 8080
```
Then visit the printed URL.

## ⚡ Optional: faster video on Vercel
The single-threaded ffmpeg core is used for max compatibility. For multi-threaded (faster)
video on Vercel, add cross-origin isolation headers in `vercel.json`:
```json
{ "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
{ "key": "Cross-Origin-Embedder-Policy", "value": "require-corp" }
```
then switch `CORE_BASE` in `assets/js/tools/media.js` to the `@ffmpeg/core-mt` package.
(Not enabled by default because `require-corp` can block third-party CDN imports unless every
resource sends the right CORP headers.)

## 🧩 Add your own tool
1. Create `assets/js/tools/mytool.js` exporting a tool object:
   ```js
   export const myTool = {
     id: 'my-tool', name: 'My Tool', category: 'Utilities',
     icon: ICONS.tools, description: '…', keywords: '…',
     render(root) { /* build UI into root */ },
   };
   export default [myTool];
   ```
2. Import it in `assets/js/app.js` and spread it into the `TOOLS` array.

## License
MIT — do whatever you want.
