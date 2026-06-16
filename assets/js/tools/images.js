// images.js — client-side image tools using Canvas. Fully local.
import {
  h, ICONS, Dropzone, toolShell, busy, resultCard, toast, field, select,
  rangeField, loadImage, canvasToBlob, downloadBlob, stripExt, formatBytes, fileChip,
} from '../core.js';

const MIME = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
  bmp: 'image/bmp', gif: 'image/gif',
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
      const showQ = format === 'jpg' || format === 'jpeg' || format === 'webp';
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
        [{ value: 'png', label: 'PNG' }, { value: 'jpg', label: 'JPG' }, { value: 'webp', label: 'WEBP' }, { value: 'bmp', label: 'BMP' }],
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

export default [imageConverter, imageCompressor, imageResizer, chromaKey];
