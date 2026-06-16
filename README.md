# 🧰 Ultimate Toolkit

A free, ad-free, all-in-one productivity website — convert files, edit media, remove
backgrounds, key out green screens and more. **Everything runs locally in your browser.**
Your files are never uploaded to any server.

Inspired by vert.sh / toolknit, but with more tools and a clean dark-mode UI.

> No build step. No framework. Just static files + ES modules loaded from CDNs.
> Drop it on GitHub Pages or Vercel and it works.

## ✨ Tools included

| Category | Tools |
|---|---|
| **Image** | Converter (PNG/JPG/WEBP/BMP), Compressor, Resizer |
| **AI & Effects** | AI Background Remover, Chroma Key (green screen) |
| **PDF** | Images → PDF, PDF → Images, Merge, Split/Extract, PDF → Text |
| **Documents** | Word → PDF, Word → Text/HTML |
| **Audio** | Converter (MP3/WAV/OGG/FLAC/M4A/AAC/OPUS), Noise Reduction, Vocal Remover, Trim |
| **Video** | Converter (MP4/WEBM/MOV/MKV/AVI), Video → GIF, Extract Audio, Trim |
| **Utilities** | QR Generator, Base64, Hash/Checksum, Text Tools |

## 🔒 How "local" works

- **Images, PDFs, QR, text, hashing** → native browser APIs (Canvas, WebCrypto, pdf-lib).
- **Audio/Video** → [`ffmpeg.wasm`](https://github.com/ffmpegwasm/ffmpeg.wasm) (single-threaded
  core, so no special server headers are needed — works even on GitHub Pages).
- **Background removal** → an ONNX model run in-browser via
  [`@imgly/background-removal`](https://github.com/imgly/background-removal-js).

The first time you use a media tool or the background remover, the browser downloads the
engine/model (cached afterwards, then fully offline).

### Honest limitations
- **Vocal remover** is a fast stereo "center-channel" trick (karaoke), **not** true AI stem
  separation (Demucs/Spleeter are too heavy for pure client-side). Quality varies by song.
- **PDF → Word** with perfect reflow is effectively impossible client-side, so we provide
  **PDF → Text** and **Word → PDF** instead.
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
