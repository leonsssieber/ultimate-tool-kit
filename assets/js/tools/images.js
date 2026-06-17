// images.js — client-side image tools using Canvas. Fully local.
import {
  h, ICONS, Dropzone, toolShell, busy, resultCard, toast, field, select,
  rangeField, loadImage, canvasToBlob, downloadBlob, stripExt, formatBytes, fileChip, zipAndDownload, copyImageToClipboard,
} from '../core.js';
import * as pdfjsLib from 'pdfjs-dist';
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.7.76/build/pdf.worker.min.mjs';

const MIME = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
  bmp: 'image/bmp', gif: 'image/gif', avif: 'image/avif',
};

async function drawToCanvas(file, { maxW, maxH } = {}) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    let w = img.naturalWidth, hgt = img.naturalHeight;
    if (maxW || maxH) {
      const rW = maxW ? maxW / w : Infinity;
      const rH = maxH ? maxH / hgt : Infinity;
      const r = Math.min(rW, rH, 1);
      w = Math.round(w * r); hgt = Math.round(hgt * r);
    }
    const canvas = h('canvas', { width: w, height: hgt });
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, hgt);
    return canvas;
  } finally { URL.revokeObjectURL(url); }
}

/* ---------------- Image Converter ---------------- */
export const imageConverter = {
  id: 'image-converter',
  name: 'Image Converter',
  category: 'Image',
  icon: ICONS.image,
  description: 'Convert PNG, JPG, WEBP, BMP, GIF and more — with quality control.',
  keywords: 'png jpg jpeg webp bmp gif convert format change',
  render(root) {
    let files = [];
    let format = 'png';
    let quality = 0.92;
    const body = h('div', {});
    const out = h('div', { class: 'output' });

    const opts = h('div', { class: 'panel hidden' });
    const qualityField = rangeField('Quality', {
      min: 0.1, max: 1, step: 0.01, value: quality, suffix: '',
      onInput: (v) => { quality = v; },
    });

    function refreshOpts() {
      const showQ = format === 'jpg' || format === 'jpeg' || format === 'webp' || format === 'avif';
      qualityField.style.display = showQ ? '' : 'none';
    }

    const list = h('div', { class: 'chips' });
    function renderList() {
      list.innerHTML = '';
      files.forEach((f, i) => list.appendChild(fileChip(f, () => { files.splice(i, 1); renderList(); if (!files.length) opts.classList.add('hidden'); })));
    }

    const convertBtn = h('button', { class: 'btn btn--primary', onclick: run }, 'Convert ', h('span', { html: ICONS.download }));

    opts.append(
      field('Output format', select(
        [{ value: 'png', label: 'PNG' }, { value: 'jpg', label: 'JPG' }, { value: 'webp', label: 'WEBP' }, { value: 'avif', label: 'AVIF' }, { value: 'bmp', label: 'BMP' }],
        format, (v) => { format = v; refreshOpts(); },
      )),
      qualityField,
      list,
      h('div', { class: 'panel__actions' }, convertBtn),
    );
    refreshOpts();

    const dz = Dropzone({
      accept: 'image/*', multiple: true, label: 'Drop images here or click to browse',
      onFiles: (fs) => { files.push(...fs); renderList(); opts.classList.remove('hidden'); },
    });

    async function run() {
      if (!files.length) return toast('Add at least one image', 'error');
      out.innerHTML = '';
      const b = busy(out, 'Converting…');
      const results = [];
      try {
        for (let i = 0; i < files.length; i++) {
          b.msg(`Converting ${i + 1}/${files.length}…`);
          b.progress(i / files.length);
          const canvas = await drawToCanvas(files[i]);
          const mime = MIME[format];
          const blob = await canvasToBlob(canvas, mime, quality);
          if (!blob) throw new Error(`${format.toUpperCase()} output isn't supported by this browser.`);
          results.push({ blob, name: `${stripExt(files[i].name)}.${format}` });
        }
      } catch (e) {
        console.error(e); b.done(); return toast('Conversion failed: ' + e.message, 'error');
      }
      b.done();
      results.forEach(r => out.appendChild(resultCard({
        title: r.name, blob: r.blob, filename: r.name,
        previewUrl: URL.createObjectURL(r.blob), isImage: true,
      })));
      toast(`Converted ${results.length} image${results.length > 1 ? 's' : ''}`, 'success');
    }

    body.append(dz, opts, out);
    root.appendChild(toolShell(this, body));
  },
};

/* ---------------- Image Compressor ---------------- */
export const imageCompressor = {
  id: 'image-compressor',
  name: 'Image Compressor',
  category: 'Image',
  icon: ICONS.image,
  description: 'Shrink image file size while keeping it looking good.',
  keywords: 'compress reduce size optimize shrink smaller',
  render(root) {
    let files = [];
    let quality = 0.7;
    let maxDim = 0;
    const body = h('div', {});
    const out = h('div', { class: 'output' });
    const list = h('div', { class: 'chips' });
    const panel = h('div', { class: 'panel hidden' });

    function renderList() {
      list.innerHTML = '';
      files.forEach((f, i) => list.appendChild(fileChip(f, () => { files.splice(i, 1); renderList(); if (!files.length) panel.classList.add('hidden'); })));
    }

    panel.append(
      rangeField('Quality', { min: 0.1, max: 1, step: 0.05, value: quality, onInput: (v) => quality = v }),
      field('Max dimension (px, 0 = keep original)', h('input', {
        class: 'input', type: 'number', min: 0, value: 0, onchange: (e) => maxDim = parseInt(e.target.value) || 0,
      })),
      list,
      h('div', { class: 'panel__actions' }, h('button', { class: 'btn btn--primary', onclick: run }, 'Compress')),
    );

    const dz = Dropzone({
      accept: 'image/*', multiple: true,
      onFiles: (fs) => { files.push(...fs); renderList(); panel.classList.remove('hidden'); },
    });

    async function run() {
      if (!files.length) return toast('Add at least one image', 'error');
      out.innerHTML = '';
      const b = busy(out, 'Compressing…');
      const results = [];
      try {
        for (let i = 0; i < files.length; i++) {
          b.progress(i / files.length);
          const canvas = await drawToCanvas(files[i], maxDim ? { maxW: maxDim, maxH: maxDim } : {});
          // Use JPEG/WEBP for real compression; keep PNG transparency aware.
          const isPng = files[i].type === 'image/png';
          const mime = isPng ? 'image/webp' : 'image/jpeg';
          const ext = isPng ? 'webp' : 'jpg';
          const blob = await canvasToBlob(canvas, mime, quality);
          const saved = 1 - blob.size / files[i].size;
          results.push({ blob, name: `${stripExt(files[i].name)}-min.${ext}`, orig: files[i].size, saved });
        }
      } catch (e) { console.error(e); b.done(); return toast('Failed: ' + e.message, 'error'); }
      b.done();
      results.forEach(r => out.appendChild(resultCard({
        title: r.name, blob: r.blob, filename: r.name,
        previewUrl: URL.createObjectURL(r.blob), isImage: true,
        extra: h('p', { class: 'result__badge' }, `${formatBytes(r.orig)} → ${formatBytes(r.blob.size)} (${r.saved > 0 ? '−' + Math.round(r.saved * 100) : '+' + Math.round(-r.saved * 100)}%)`),
      })));
      toast('Done', 'success');
    }

    body.append(dz, panel, out);
    root.appendChild(toolShell(this, body));
  },
};

/* ---------------- Image Resizer ---------------- */
export const imageResizer = {
  id: 'image-resizer',
  name: 'Image Resizer',
  category: 'Image',
  icon: ICONS.image,
  description: 'Resize images to exact dimensions or by percentage, keeping aspect ratio.',
  keywords: 'resize scale dimensions width height percent',
  render(root) {
    let file = null;
    let width = 0, height = 0, lockAspect = true, natW = 0, natH = 0;
    const body = h('div', {});
    const out = h('div', { class: 'output' });
    const panel = h('div', { class: 'panel hidden' });

    const wInput = h('input', { class: 'input', type: 'number', min: 1, oninput: onW });
    const hInput = h('input', { class: 'input', type: 'number', min: 1, oninput: onH });
    function onW(e) { width = parseInt(e.target.value) || 0; if (lockAspect && natW) { height = Math.round(width * natH / natW); hInput.value = height; } }
    function onH(e) { height = parseInt(e.target.value) || 0; if (lockAspect && natH) { width = Math.round(height * natW / natH); wInput.value = width; } }

    panel.append(
      h('div', { class: 'grid-2' }, field('Width (px)', wInput), field('Height (px)', hInput)),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: true, onchange: (e) => lockAspect = e.target.checked }), ' Lock aspect ratio'),
      h('div', { class: 'panel__actions' }, h('button', { class: 'btn btn--primary', onclick: run }, 'Resize')),
    );

    const dz = Dropzone({
      accept: 'image/*',
      onFiles: async (fs) => {
        file = fs[0];
        const url = URL.createObjectURL(file);
        const img = await loadImage(url); URL.revokeObjectURL(url);
        natW = img.naturalWidth; natH = img.naturalHeight;
        width = natW; height = natH; wInput.value = natW; hInput.value = natH;
        panel.classList.remove('hidden');
        toast(`Loaded ${natW}×${natH}px`, 'info');
      },
    });

    async function run() {
      if (!file) return toast('Add an image', 'error');
      if (!width || !height) return toast('Set width and height', 'error');
      out.innerHTML = '';
      const b = busy(out, 'Resizing…'); b.progress(null);
      try {
        const url = URL.createObjectURL(file);
        const img = await loadImage(url); URL.revokeObjectURL(url);
        const canvas = h('canvas', { width, height });
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        const mime = file.type === 'image/png' ? 'image/png' : (file.type === 'image/webp' ? 'image/webp' : 'image/jpeg');
        const ext = mime === 'image/png' ? 'png' : (mime === 'image/webp' ? 'webp' : 'jpg');
        const blob = await canvasToBlob(canvas, mime, 0.95);
        b.done();
        out.appendChild(resultCard({ title: 'resized', blob, filename: `${stripExt(file.name)}-${width}x${height}.${ext}`, previewUrl: URL.createObjectURL(blob), isImage: true }));
      } catch (e) { console.error(e); b.done(); toast('Failed: ' + e.message, 'error'); }
    }

    body.append(dz, panel, out);
    root.appendChild(toolShell(this, body));
  },
};

/* ---------------- Chroma Key / Green Screen ---------------- */
export const chromaKey = {
  id: 'chroma-key',
  name: 'Chroma Key (Green Screen)',
  category: 'AI & Effects',
  icon: ICONS.wand,
  description: 'Remove a solid background color (green/blue screen) and export transparent PNG.',
  keywords: 'green screen chroma key transparent remove color blue screen',
  render(root) {
    let file = null, srcCanvas = null, keyColor = { r: 0, g: 177, b: 64 };
    let threshold = 110, smoothing = 30;
    const body = h('div', {});
    const out = h('div', { class: 'output' });
    const panel = h('div', { class: 'panel hidden' });
    const preview = h('canvas', { class: 'preview-canvas result__preview--checker' });

    const swatch = h('span', { class: 'swatch', style: { background: 'rgb(0,177,64)' } });
    const colorInput = h('input', { type: 'color', value: '#00b140', oninput: (e) => { keyColor = hexToRgb(e.target.value); swatch.style.background = e.target.value; apply(); } });

    panel.append(
      h('p', { class: 'hint' }, 'Tip: click the preview to pick the exact background color.'),
      field('Key color', h('div', { class: 'row' }, colorInput, swatch)),
      rangeField('Threshold', { min: 0, max: 255, step: 1, value: threshold, onInput: (v) => { threshold = v; apply(); } }),
      rangeField('Edge smoothing', { min: 0, max: 120, step: 1, value: smoothing, onInput: (v) => { smoothing = v; apply(); } }),
      preview,
      h('div', { class: 'panel__actions' }, h('button', { class: 'btn btn--primary', onclick: save }, 'Export transparent PNG')),
    );

    preview.addEventListener('click', (e) => {
      const rect = preview.getBoundingClientRect();
      const x = Math.floor((e.clientX - rect.left) / rect.width * srcCanvas.width);
      const y = Math.floor((e.clientY - rect.top) / rect.height * srcCanvas.height);
      const d = srcCanvas.getContext('2d').getImageData(x, y, 1, 1).data;
      keyColor = { r: d[0], g: d[1], b: d[2] };
      const hex = '#' + [d[0], d[1], d[2]].map(n => n.toString(16).padStart(2, '0')).join('');
      colorInput.value = hex; swatch.style.background = hex;
      apply();
    });

    const dz = Dropzone({
      accept: 'image/*',
      onFiles: async (fs) => {
        file = fs[0];
        srcCanvas = await drawToCanvas(file);
        panel.classList.remove('hidden');
        apply();
      },
    });

    function apply() {
      if (!srcCanvas) return;
      const w = srcCanvas.width, hgt = srcCanvas.height;
      preview.width = w; preview.height = hgt;
      const sctx = srcCanvas.getContext('2d');
      const img = sctx.getImageData(0, 0, w, hgt);
      const data = img.data;
      const out2 = new ImageData(w, hgt);
      const o = out2.data;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const dist = Math.sqrt((r - keyColor.r) ** 2 + (g - keyColor.g) ** 2 + (b - keyColor.b) ** 2);
        let alpha = 255;
        if (dist < threshold) alpha = 0;
        else if (dist < threshold + smoothing) alpha = Math.round(((dist - threshold) / smoothing) * 255);
        o[i] = r; o[i + 1] = g; o[i + 2] = b; o[i + 3] = alpha;
      }
      preview.getContext('2d').putImageData(out2, 0, 0);
    }

    async function save() {
      if (!srcCanvas) return toast('Add an image', 'error');
      const blob = await canvasToBlob(preview, 'image/png');
      out.innerHTML = '';
      out.appendChild(resultCard({ title: 'keyed', blob, filename: `${stripExt(file.name)}-transparent.png`, previewUrl: URL.createObjectURL(blob), isImage: true }));
      toast('Exported', 'success');
    }

    body.append(dz, panel, out);
    root.appendChild(toolShell(this, body));
  },
};

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/* ---------------- One-click format converters ---------------- */
function makeConverter({ id, name, from, toMime, toExt, accept, desc, quality = 0.92 }) {
  return {
    id, name, category: 'Image', icon: ICONS.image,
    description: desc, keywords: `${from} to ${toExt} convert image format ${id.replace(/-/g, ' ')}`,
    render(root) {
      let files = [];
      const out = h('div', { class: 'output' });
      const list = h('div', { class: 'chips' });
      const panel = h('div', { class: 'panel hidden' });
      const renderList = () => { list.innerHTML = ''; files.forEach((f, i) => list.appendChild(fileChip(f, () => { files.splice(i, 1); renderList(); if (!files.length) panel.classList.add('hidden'); }))); };
      panel.append(list, h('div', { class: 'panel__actions' }, h('button', { class: 'btn btn--primary', onclick: run }, `Convert to ${toExt.toUpperCase()}`)));
      const dz = Dropzone({ accept, multiple: true, label: `Drop ${from.toUpperCase()} images here`, onFiles: fs => { files.push(...fs); renderList(); panel.classList.remove('hidden'); } });
      async function run() {
        if (!files.length) return toast('Add an image', 'error');
        out.innerHTML = ''; const b = busy(out, 'Converting…'); const res = [];
        try { for (let i = 0; i < files.length; i++) { b.progress(i / files.length); const canvas = await drawToCanvas(files[i]); if (toMime === 'image/jpeg') { const c2 = h('canvas', { width: canvas.width, height: canvas.height }); const ctx = c2.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c2.width, c2.height); ctx.drawImage(canvas, 0, 0); res.push({ blob: await canvasToBlob(c2, toMime, quality), name: `${stripExt(files[i].name)}.${toExt}` }); } else res.push({ blob: await canvasToBlob(canvas, toMime, quality), name: `${stripExt(files[i].name)}.${toExt}` }); } }
        catch (e) { console.error(e); b.done(); return toast('Failed: ' + e.message, 'error'); }
        b.done(); res.forEach(r => out.appendChild(resultCard({ title: r.name, blob: r.blob, filename: r.name, previewUrl: URL.createObjectURL(r.blob), isImage: true }))); toast('Done', 'success');
      }
      root.appendChild(toolShell(this, h('div', {}, dz, panel, out)));
    },
  };
}
const formatPairs = [
  makeConverter({ id: 'jpg-to-png', name: 'JPG to PNG', from: 'jpg', toMime: 'image/png', toExt: 'png', accept: 'image/jpeg', desc: 'Lossless conversion from JPG to PNG.' }),
  makeConverter({ id: 'png-to-jpg', name: 'PNG to JPG', from: 'png', toMime: 'image/jpeg', toExt: 'jpg', accept: 'image/png', desc: 'Compact JPG (flattens transparency to white).' }),
  makeConverter({ id: 'jpg-to-webp', name: 'JPG to WebP', from: 'jpg', toMime: 'image/webp', toExt: 'webp', accept: 'image/jpeg', desc: 'Modern WebP format, ~30% smaller.' }),
  makeConverter({ id: 'png-to-webp', name: 'PNG to WebP', from: 'png', toMime: 'image/webp', toExt: 'webp', accept: 'image/png', desc: 'WebP with transparency support.' }),
  makeConverter({ id: 'webp-to-jpg', name: 'WebP to JPG', from: 'webp', toMime: 'image/jpeg', toExt: 'jpg', accept: 'image/webp', desc: 'Universal JPG compatibility.' }),
  makeConverter({ id: 'webp-to-png', name: 'WebP to PNG', from: 'webp', toMime: 'image/png', toExt: 'png', accept: 'image/webp', desc: 'Lossless PNG with transparency.' }),
];

/* ---------------- HEIC to JPG ---------------- */
export const heicToJpg = {
  id: 'heic-to-jpg', name: 'HEIC to JPG', category: 'Image', icon: ICONS.image,
  description: 'Convert iPhone HEIC/HEIF photos to standard JPG.',
  keywords: 'heic heif iphone photo to jpg convert apple',
  render(root) {
    let files = [];
    const out = h('div', { class: 'output' });
    const list = h('div', { class: 'chips' });
    const panel = h('div', { class: 'panel hidden' });
    const renderList = () => { list.innerHTML = ''; files.forEach((f, i) => list.appendChild(fileChip(f, () => { files.splice(i, 1); renderList(); if (!files.length) panel.classList.add('hidden'); }))); };
    panel.append(h('p', { class: 'hint' }, 'First run loads the HEIC decoder (~1 MB).'), list, h('div', { class: 'panel__actions' }, h('button', { class: 'btn btn--primary', onclick: run }, 'Convert to JPG')));
    const dz = Dropzone({ accept: '.heic,.heif,image/heic,image/heif', multiple: true, label: 'Drop HEIC photos here', onFiles: fs => { files.push(...fs); renderList(); panel.classList.remove('hidden'); } });
    async function run() {
      if (!files.length) return toast('Add a HEIC file', 'error');
      out.innerHTML = ''; const b = busy(out, 'Loading decoder…'); b.progress(null);
      let heic2any;
      try { heic2any = (await import('heic2any')).default; } catch (e) { b.done(); return toast('Could not load HEIC decoder.', 'error'); }
      const res = [];
      try { for (let i = 0; i < files.length; i++) { b.msg(`Converting ${i + 1}/${files.length}…`); const blob = await heic2any({ blob: files[i], toType: 'image/jpeg', quality: 0.92 }); res.push({ blob: Array.isArray(blob) ? blob[0] : blob, name: `${stripExt(files[i].name)}.jpg` }); } }
      catch (e) { console.error(e); b.done(); return toast('Failed: ' + (e.message || e), 'error'); }
      b.done(); res.forEach(r => out.appendChild(resultCard({ title: r.name, blob: r.blob, filename: r.name, previewUrl: URL.createObjectURL(r.blob), isImage: true }))); toast('Converted', 'success');
    }
    root.appendChild(toolShell(this, h('div', {}, dz, panel, out)));
  },
};

/* ---------------- AI / PDF to PNG ---------------- */
export const aiToPng = {
  id: 'ai-to-png', name: 'AI / EPS / PDF to PNG', category: 'Image', icon: ICONS.image,
  description: 'Render the first page of an Illustrator .ai or PDF file to PNG.',
  keywords: 'ai illustrator eps pdf to png convert vector render',
  render(root) {
    let file = null, scale = 2;
    const out = h('div', { class: 'output' });
    const panel = h('div', { class: 'panel hidden' });
    panel.append(h('p', { class: 'hint' }, 'Works with PDF-compatible .ai files (most modern Illustrator exports) and PDFs.'),
      rangeField('Resolution', { min: 1, max: 4, step: 0.5, value: scale, suffix: '×', onInput: v => scale = v }),
      h('div', { class: 'panel__actions' }, h('button', { class: 'btn btn--primary', onclick: run }, 'Convert to PNG')));
    const dz = Dropzone({ accept: '.ai,.pdf,application/pdf,application/illustrator', onFiles: fs => { file = fs[0]; panel.classList.remove('hidden'); } });
    async function run() {
      if (!file) return toast('Add a file', 'error');
      out.innerHTML = ''; const b = busy(out, 'Rendering…'); b.progress(null);
      try {
        const doc = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
        const page = await doc.getPage(1); const viewport = page.getViewport({ scale });
        const canvas = h('canvas', { width: viewport.width, height: viewport.height });
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        const blob = await canvasToBlob(canvas, 'image/png');
        b.done(); out.appendChild(resultCard({ title: 'png', blob, filename: `${stripExt(file.name)}.png`, previewUrl: URL.createObjectURL(blob), isImage: true })); toast('Done', 'success');
      } catch (e) { console.error(e); b.done(); toast('Could not render this file: ' + e.message, 'error'); }
    }
    root.appendChild(toolShell(this, h('div', {}, dz, panel, out)));
  },
};

/* ---------------- Image Grid Split ---------------- */
export const gridSplit = {
  id: 'grid-split', name: 'Image Grid Split', category: 'Image', icon: ICONS.image,
  description: 'Slice an image into a grid — copy or download any tile directly, or grab them all as a ZIP.',
  keywords: 'grid split slice instagram carousel tiles pieces cut',
  render(root) {
    let file = null, cols = 3, rows = 3;
    const out = h('div', { class: 'output' });
    const panel = h('div', { class: 'panel hidden' });
    panel.append(
      h('div', { class: 'grid-2' },
        field('Columns', h('input', { class: 'input', type: 'number', min: 1, max: 10, value: 3, onchange: e => cols = Math.max(1, Math.min(10, +e.target.value)) })),
        field('Rows', h('input', { class: 'input', type: 'number', min: 1, max: 10, value: 3, onchange: e => rows = Math.max(1, Math.min(10, +e.target.value)) }))),
      h('div', { class: 'panel__actions' }, h('button', { class: 'btn btn--primary', onclick: run }, 'Split into grid')));
    const dz = Dropzone({ accept: 'image/*', onFiles: fs => { file = fs[0]; panel.classList.remove('hidden'); } });
    async function run() {
      if (!file) return toast('Add an image', 'error');
      out.innerHTML = ''; const b = busy(out, 'Slicing…'); b.progress(null);
      try {
        const img = await loadImage(URL.createObjectURL(file));
        const tw = Math.floor(img.naturalWidth / cols), th = Math.floor(img.naturalHeight / rows);
        // Build tile canvases instantly; convert to PNG only when copied/downloaded.
        const tiles = [];
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          const cv = h('canvas', { width: tw, height: th, class: 'tile__img' });
          cv.getContext('2d').drawImage(img, c * tw, r * th, tw, th, 0, 0, tw, th);
          tiles.push({ r, c, cv, name: `${stripExt(file.name)}_r${r + 1}_c${c + 1}.png` });
        }
        b.done();
        out.appendChild(h('div', { class: 'panel__actions' },
          h('button', { class: 'btn btn--primary', onclick: async () => { const fz = await Promise.all(tiles.map(async t => ({ name: t.name, blob: await canvasToBlob(t.cv, 'image/png') }))); zipAndDownload(fz, `${stripExt(file.name)}-grid.zip`); } }, h('span', { html: ICONS.download }), ` Download all ${tiles.length} as ZIP`),
          h('span', { class: 'hint', style: { margin: '0', alignSelf: 'center' } }, 'Hover any tile to copy or download it')));
        const gridEl = h('div', { class: 'tile-grid', style: { gridTemplateColumns: `repeat(${cols}, 1fr)` } });
        tiles.forEach(t => {
          const copyB = h('button', { class: 'tile__btn', title: 'Copy this tile', html: ICONS.copy });
          copyB.addEventListener('click', async () => { try { await copyImageToClipboard(await canvasToBlob(t.cv, 'image/png')); copyB.classList.add('tile__btn--ok'); setTimeout(() => copyB.classList.remove('tile__btn--ok'), 1000); toast(`Tile ${t.r + 1},${t.c + 1} copied`, 'success'); } catch { toast('Copy not supported here', 'error'); } });
          const dlB = h('button', { class: 'tile__btn', title: 'Download this tile', html: ICONS.download });
          dlB.addEventListener('click', async () => downloadBlob(await canvasToBlob(t.cv, 'image/png'), t.name));
          gridEl.appendChild(h('div', { class: 'tile' }, t.cv, h('div', { class: 'tile__bar' }, copyB, dlB), h('span', { class: 'tile__pos' }, `${t.r + 1},${t.c + 1}`)));
        });
        out.appendChild(gridEl);
        toast('Split into ' + tiles.length + ' tiles', 'success');
      } catch (e) { console.error(e); b.done(); toast('Failed: ' + e.message, 'error'); }
    }
    root.appendChild(toolShell(this, h('div', {}, dz, panel, out)));
  },
};

/* ---------------- Circle Crop ---------------- */
export const circleCrop = {
  id: 'circle-crop', name: 'Circle Crop', category: 'Image', icon: ICONS.circle,
  description: 'Crop an image into a circle with a transparent background.',
  keywords: 'circle crop round avatar profile picture transparent',
  render(root) {
    let file = null;
    const out = h('div', { class: 'output' });
    const panel = h('div', { class: 'panel hidden' });
    panel.append(h('p', { class: 'hint' }, 'The largest centered circle is used. Square images work best.'), h('div', { class: 'panel__actions' }, h('button', { class: 'btn btn--primary', onclick: run }, 'Crop to circle')));
    const dz = Dropzone({ accept: 'image/*', onFiles: fs => { file = fs[0]; panel.classList.remove('hidden'); } });
    async function run() {
      if (!file) return toast('Add an image', 'error');
      out.innerHTML = ''; const b = busy(out, 'Cropping…'); b.progress(null);
      try {
        const img = await loadImage(URL.createObjectURL(file));
        const size = Math.min(img.naturalWidth, img.naturalHeight);
        const cv = h('canvas', { width: size, height: size }); const ctx = cv.getContext('2d');
        ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
        ctx.drawImage(img, (img.naturalWidth - size) / 2, (img.naturalHeight - size) / 2, size, size, 0, 0, size, size);
        const blob = await canvasToBlob(cv, 'image/png');
        b.done(); out.appendChild(resultCard({ title: 'circle', blob, filename: `${stripExt(file.name)}-circle.png`, previewUrl: URL.createObjectURL(blob), isImage: true })); toast('Done', 'success');
      } catch (e) { console.error(e); b.done(); toast('Failed: ' + e.message, 'error'); }
    }
    root.appendChild(toolShell(this, h('div', {}, dz, panel, out)));
  },
};

/* ---------------- Flip & Rotate ---------------- */
export const flipRotate = {
  id: 'flip-rotate', name: 'Flip & Rotate Image', category: 'Image', icon: ICONS.rotate,
  description: 'Mirror horizontally/vertically and rotate by 90/180/270°.',
  keywords: 'flip rotate mirror image transform turn 90 180 270',
  render(root) {
    let file = null, img = null, rot = 0, flipH = false, flipV = false;
    const out = h('div', { class: 'output' });
    const preview = h('canvas', { class: 'preview-canvas' });
    const panel = h('div', { class: 'panel hidden' });
    function paint() {
      if (!img) return;
      const swap = rot % 180 !== 0;
      const w = swap ? img.naturalHeight : img.naturalWidth, hgt = swap ? img.naturalWidth : img.naturalHeight;
      preview.width = w; preview.height = hgt; const ctx = preview.getContext('2d');
      ctx.save(); ctx.translate(w / 2, hgt / 2); ctx.rotate(rot * Math.PI / 180); ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2); ctx.restore();
    }
    panel.append(h('div', { class: 'btn-row' },
      h('button', { class: 'btn', onclick: () => { rot = (rot + 270) % 360; paint(); } }, '↺ 90°'),
      h('button', { class: 'btn', onclick: () => { rot = (rot + 90) % 360; paint(); } }, '↻ 90°'),
      h('button', { class: 'btn', onclick: () => { flipH = !flipH; paint(); } }, '⇆ Flip H'),
      h('button', { class: 'btn', onclick: () => { flipV = !flipV; paint(); } }, '⇅ Flip V'),
    ), preview, h('div', { class: 'panel__actions' }, h('button', { class: 'btn btn--primary', onclick: save }, 'Export PNG')));
    const dz = Dropzone({ accept: 'image/*', onFiles: async fs => { file = fs[0]; img = await loadImage(URL.createObjectURL(file)); rot = 0; flipH = flipV = false; panel.classList.remove('hidden'); paint(); } });
    async function save() { if (!img) return; const blob = await canvasToBlob(preview, file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', 0.95); out.innerHTML = ''; out.appendChild(resultCard({ title: 'transformed', blob, filename: `${stripExt(file.name)}-edit.png`, previewUrl: URL.createObjectURL(blob), isImage: true })); toast('Exported', 'success'); }
    root.appendChild(toolShell(this, h('div', {}, dz, panel, out)));
  },
};

/* ---------------- SVG → PNG ---------------- */
export const svgToPng = {
  id: 'svg-to-png', name: 'SVG → PNG', category: 'Image', icon: ICONS.image,
  description: 'Rasterize an SVG vector file to a PNG at any resolution.',
  keywords: 'svg to png raster vector convert image scale',
  render(root) {
    let file = null, scale = 2;
    const out = h('div', { class: 'output' });
    const panel = h('div', { class: 'panel hidden' });
    panel.append(rangeField('Scale', { min: 1, max: 6, step: 0.5, value: scale, suffix: '×', onInput: v => scale = v }),
      h('div', { class: 'panel__actions' }, h('button', { class: 'btn btn--primary', onclick: run }, 'Convert to PNG')));
    const dz = Dropzone({ accept: '.svg,image/svg+xml', onFiles: fs => { file = fs[0]; panel.classList.remove('hidden'); } });
    async function run() {
      if (!file) return toast('Add an SVG', 'error');
      out.innerHTML = ''; const b = busy(out, 'Rasterizing…'); b.progress(null);
      try {
        const text = await file.text();
        const url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }));
        const img = await loadImage(url); URL.revokeObjectURL(url);
        const w = Math.max(1, Math.round((img.naturalWidth || 300) * scale));
        const hgt = Math.max(1, Math.round((img.naturalHeight || 300) * scale));
        const canvas = h('canvas', { width: w, height: hgt });
        canvas.getContext('2d').drawImage(img, 0, 0, w, hgt);
        const blob = await canvasToBlob(canvas, 'image/png');
        b.done(); out.appendChild(resultCard({ title: 'png', blob, filename: `${stripExt(file.name)}.png`, previewUrl: URL.createObjectURL(blob), isImage: true })); toast('Done', 'success');
      } catch (e) { console.error(e); b.done(); toast('Failed: ' + e.message, 'error'); }
    }
    root.appendChild(toolShell(this, h('div', {}, dz, panel, out)));
  },
};

/* ---------------- Image → ICO (favicon) ---------------- */
export const imageToIco = {
  id: 'image-to-ico', name: 'Image → ICO (Favicon)', category: 'Image', icon: ICONS.image,
  description: 'Create a multi-size .ico favicon from any image.',
  keywords: 'ico favicon icon convert image png to ico website',
  render(root) {
    let file = null, sizes = [16, 32, 48];
    const out = h('div', { class: 'output' });
    const panel = h('div', { class: 'panel hidden' });
    const opts = [16, 32, 48, 64, 128, 256];
    const checks = h('div', { class: 'btn-row' });
    opts.forEach(s => checks.appendChild(h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: sizes.includes(s), onchange: e => { if (e.target.checked) sizes.push(s); else sizes = sizes.filter(x => x !== s); } }), ` ${s}px`)));
    panel.append(h('p', { class: 'field__label' }, 'Sizes to include'), checks, h('div', { class: 'panel__actions' }, h('button', { class: 'btn btn--primary', onclick: run }, 'Create .ico')));
    const dz = Dropzone({ accept: 'image/*', onFiles: fs => { file = fs[0]; panel.classList.remove('hidden'); } });
    async function run() {
      if (!file) return toast('Add an image', 'error');
      if (!sizes.length) return toast('Pick at least one size', 'error');
      out.innerHTML = ''; const b = busy(out, 'Building icon…'); b.progress(null);
      try {
        const img = await loadImage(URL.createObjectURL(file));
        const pngs = [];
        for (const s of [...sizes].sort((a, c) => a - c)) {
          const cv = h('canvas', { width: s, height: s }); cv.getContext('2d').drawImage(img, 0, 0, s, s);
          pngs.push({ size: s, bytes: new Uint8Array(await (await canvasToBlob(cv, 'image/png')).arrayBuffer()) });
        }
        // ICO header (6) + dir entries (16 each) + PNG payloads
        const count = pngs.length;
        let offset = 6 + count * 16;
        const header = new Uint8Array(6 + count * 16);
        const dv = new DataView(header.buffer);
        dv.setUint16(0, 0, true); dv.setUint16(2, 1, true); dv.setUint16(4, count, true);
        pngs.forEach((p, i) => {
          const e = 6 + i * 16;
          header[e] = p.size >= 256 ? 0 : p.size; header[e + 1] = p.size >= 256 ? 0 : p.size;
          header[e + 2] = 0; header[e + 3] = 0;
          dv.setUint16(e + 4, 1, true); dv.setUint16(e + 6, 32, true);
          dv.setUint32(e + 8, p.bytes.length, true); dv.setUint32(e + 12, offset, true);
          offset += p.bytes.length;
        });
        const blob = new Blob([header, ...pngs.map(p => p.bytes)], { type: 'image/x-icon' });
        b.done(); out.appendChild(resultCard({ title: 'ico', blob, filename: `${stripExt(file.name)}.ico`, previewUrl: 'x', isImage: false })); toast('Favicon created', 'success');
      } catch (e) { console.error(e); b.done(); toast('Failed: ' + e.message, 'error'); }
    }
    root.appendChild(toolShell(this, h('div', {}, dz, panel, out)));
  },
};

export default [imageConverter, imageCompressor, imageResizer, ...formatPairs, heicToJpg, aiToPng, svgToPng, imageToIco, gridSplit, circleCrop, flipRotate, chromaKey];
