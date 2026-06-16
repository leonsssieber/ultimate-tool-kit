// creative.js — design & creative tools. All local.
import { h, ICONS, toolShell, field, select, toast, downloadBlob, canvasToBlob, Dropzone, loadImage, rangeField, stripExt, onCleanup, resultCard } from '../core.js';

const CAT = 'Creative';
const copy = (txt) => { navigator.clipboard.writeText(txt); toast('Copied', 'success'); };

/* ---------------- Color Picker ---------------- */
export const colorPicker = {
  id: 'color-picker', name: 'Color Picker', category: CAT, icon: ICONS.palette,
  description: 'Pick a color and get HEX, RGB, HSL plus tints and shades.',
  keywords: 'color picker hex rgb hsl palette tint shade convert',
  render(root) {
    let hex = '#3b71ff';
    const big = h('input', { type: 'color', value: hex, class: 'color-big', oninput: e => { hex = e.target.value; paint(); } });
    const vals = h('div', { class: 'color-vals' });
    const swatches = h('div', { class: 'palette-row' });
    function hexToRgb(x) { const n = parseInt(x.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
    function rgbToHsl(r, g, b) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h_ = 0, s = 0, l = (mx + mn) / 2; if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h_ = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h_ *= 60; } return [Math.round(h_), Math.round(s * 100), Math.round(l * 100)]; }
    function shade(x, p) { let [r, g, b] = hexToRgb(x); r = Math.round(r + (p < 0 ? r : 255 - r) * p); g = Math.round(g + (p < 0 ? g : 255 - g) * p); b = Math.round(b + (p < 0 ? b : 255 - b) * p); return '#' + [r, g, b].map(n => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')).join(''); }
    function paint() {
      const [r, g, b] = hexToRgb(hex), [hh, s, l] = rgbToHsl(r, g, b);
      vals.innerHTML = '';
      [['HEX', hex.toUpperCase()], ['RGB', `rgb(${r}, ${g}, ${b})`], ['HSL', `hsl(${hh}, ${s}%, ${l}%)`]].forEach(([k, v]) =>
        vals.appendChild(h('div', { class: 'color-val', onclick: () => copy(v) }, h('span', { class: 'color-val__k' }, k), h('span', { class: 'color-val__v' }, v), h('span', { class: 'color-val__copy' }, 'copy'))));
      swatches.innerHTML = '';
      [-0.6, -0.3, 0, 0.3, 0.6].forEach(p => { const c = p === 0 ? hex : shade(hex, p); swatches.appendChild(h('div', { class: 'palette-sw', style: { background: c }, title: c, onclick: () => copy(c) })); });
    }
    paint();
    root.appendChild(toolShell(this, h('div', {}, h('div', { class: 'panel' }, h('div', { class: 'color-pick-row' }, big, h('div', { style: { flex: 1 } }, vals)),
      h('p', { class: 'field__label', style: { marginTop: '14px' } }, 'Tints & shades (click to copy)'), swatches))));
  },
};

/* ---------------- Gradient Generator ---------------- */
export const gradientGenerator = {
  id: 'gradient-generator', name: 'CSS Gradient Generator', category: CAT, icon: ICONS.palette,
  description: 'Build linear/radial CSS gradients and copy the code.',
  keywords: 'gradient css linear radial color generator background',
  render(root) {
    let c1 = '#3b71ff', c2 = '#b06dff', angle = 135, type = 'linear';
    const preview = h('div', { class: 'gradient-preview' });
    const code = h('div', { class: 'textpreview' });
    function css() { return type === 'linear' ? `linear-gradient(${angle}deg, ${c1}, ${c2})` : `radial-gradient(circle, ${c1}, ${c2})`; }
    function paint() { preview.style.background = css(); code.textContent = `background: ${css()};`; }
    paint();
    root.appendChild(toolShell(this, h('div', {}, h('div', { class: 'panel' }, preview,
      field('Type', select(['linear', 'radial'], type, v => { type = v; paint(); })),
      h('div', { class: 'grid-2' }, field('Color 1', h('input', { type: 'color', value: c1, oninput: e => { c1 = e.target.value; paint(); } })), field('Color 2', h('input', { type: 'color', value: c2, oninput: e => { c2 = e.target.value; paint(); } }))),
      rangeField('Angle', { min: 0, max: 360, step: 1, value: angle, suffix: '°', onInput: v => { angle = v; paint(); } }),
      code, h('div', { class: 'panel__actions' }, h('button', { class: 'btn btn--primary', onclick: () => copy(`background: ${css()};`) }, 'Copy CSS'))))));
  },
};

/* ---------------- Whiteboard ---------------- */
export const whiteboard = {
  id: 'whiteboard', name: 'Whiteboard', category: CAT, icon: ICONS.pen,
  description: 'A simple canvas to draw, sketch and annotate — export as PNG.',
  keywords: 'whiteboard draw sketch annotate canvas paint pen',
  render(root) {
    let color = '#ffffff', size = 4, drawing = false, last = null;
    const canvas = h('canvas', { class: 'draw-canvas', width: 1000, height: 600 });
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0d0e12'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    function pos(e) { const r = canvas.getBoundingClientRect(); const t = e.touches ? e.touches[0] : e; return { x: (t.clientX - r.left) / r.width * canvas.width, y: (t.clientY - r.top) / r.height * canvas.height }; }
    function start(e) { drawing = true; last = pos(e); e.preventDefault(); }
    function move(e) { if (!drawing) return; const p = pos(e); ctx.strokeStyle = color; ctx.lineWidth = size; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke(); last = p; e.preventDefault(); }
    function end() { drawing = false; }
    canvas.addEventListener('mousedown', start); canvas.addEventListener('mousemove', move); window.addEventListener('mouseup', end);
    canvas.addEventListener('touchstart', start); canvas.addEventListener('touchmove', move); canvas.addEventListener('touchend', end);
    onCleanup(() => window.removeEventListener('mouseup', end));
    const tools = h('div', { class: 'panel__actions' },
      h('input', { type: 'color', value: color, oninput: e => color = e.target.value }),
      field('', h('input', { type: 'range', class: 'range', min: 1, max: 40, value: size, style: { width: '120px' }, oninput: e => size = +e.target.value })),
      h('button', { class: 'btn', onclick: () => { color = '#0d0e12'; toast('Eraser on', 'info'); } }, 'Eraser'),
      h('button', { class: 'btn', onclick: () => { ctx.fillStyle = '#0d0e12'; ctx.fillRect(0, 0, canvas.width, canvas.height); } }, 'Clear'),
      h('button', { class: 'btn btn--primary', onclick: () => canvas.toBlob(b => downloadBlob(b, 'whiteboard.png')) }, 'Download PNG'),
    );
    root.appendChild(toolShell(this, h('div', {}, h('div', { class: 'panel' }, canvas, tools))));
  },
};

/* ---------------- Signature Maker ---------------- */
export const signatureMaker = {
  id: 'signature-maker', name: 'Signature Maker', category: CAT, icon: ICONS.pen,
  description: 'Draw or type your signature and export a transparent PNG.',
  keywords: 'signature maker draw sign transparent png document',
  render(root) {
    let color = '#000000', size = 3, drawing = false, last = null;
    const canvas = h('canvas', { class: 'draw-canvas draw-canvas--checker', width: 700, height: 250 });
    const ctx = canvas.getContext('2d');
    function pos(e) { const r = canvas.getBoundingClientRect(); const t = e.touches ? e.touches[0] : e; return { x: (t.clientX - r.left) / r.width * canvas.width, y: (t.clientY - r.top) / r.height * canvas.height }; }
    function start(e) { drawing = true; last = pos(e); e.preventDefault(); }
    function move(e) { if (!drawing) return; const p = pos(e); ctx.strokeStyle = color; ctx.lineWidth = size; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke(); last = p; e.preventDefault(); }
    function end() { drawing = false; }
    canvas.addEventListener('mousedown', start); canvas.addEventListener('mousemove', move); window.addEventListener('mouseup', end);
    canvas.addEventListener('touchstart', start); canvas.addEventListener('touchmove', move); canvas.addEventListener('touchend', end);
    onCleanup(() => window.removeEventListener('mouseup', end));
    const typed = h('input', { class: 'input', placeholder: 'Or type a signature…', oninput: e => { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = color; ctx.font = 'italic 64px "Brush Script MT", "Segoe Script", cursive'; ctx.textBaseline = 'middle'; ctx.fillText(e.target.value, 30, canvas.height / 2); } });
    const tools = h('div', { class: 'panel__actions' },
      h('input', { type: 'color', value: color, oninput: e => color = e.target.value }),
      h('button', { class: 'btn', onclick: () => ctx.clearRect(0, 0, canvas.width, canvas.height) }, 'Clear'),
      h('button', { class: 'btn btn--primary', onclick: () => canvas.toBlob(b => downloadBlob(b, 'signature.png')) }, 'Download transparent PNG'),
    );
    root.appendChild(toolShell(this, h('div', {}, h('div', { class: 'panel' }, canvas, field('', typed), tools))));
  },
};

/* ---------------- Pixel Art Converter ---------------- */
export const pixelArt = {
  id: 'pixel-art', name: 'Pixel Art Converter', category: CAT, icon: ICONS.image,
  description: 'Turn any image into retro pixel art with adjustable block size.',
  keywords: 'pixel art retro 8bit convert image pixelate',
  render(root) {
    let img = null, pixel = 12, levels = 0;
    const out = h('div', { class: 'output' });
    const canvas = h('canvas', { class: 'preview-canvas' });
    const panel = h('div', { class: 'panel hidden' });
    function render() {
      if (!img) return;
      const w = img.naturalWidth, hgt = img.naturalHeight;
      canvas.width = w; canvas.height = hgt;
      const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
      const sw = Math.max(1, Math.round(w / pixel)), sh = Math.max(1, Math.round(hgt / pixel));
      const tmp = h('canvas', { width: sw, height: sh }); const tctx = tmp.getContext('2d');
      tctx.drawImage(img, 0, 0, sw, sh);
      if (levels) { const id = tctx.getImageData(0, 0, sw, sh); const d = id.data; const step = 255 / (levels - 1); for (let i = 0; i < d.length; i++) if (i % 4 !== 3) d[i] = Math.round(Math.round(d[i] / step) * step); tctx.putImageData(id, 0, 0); }
      ctx.drawImage(tmp, 0, 0, sw, sh, 0, 0, w, hgt);
    }
    panel.append(
      rangeField('Pixel size', { min: 2, max: 40, step: 1, value: pixel, suffix: 'px', onInput: v => { pixel = v; render(); } }),
      field('Color palette', select([{ value: 0, label: 'Full color' }, { value: 4, label: '4 levels' }, { value: 3, label: '3 levels' }, { value: 2, label: '2 levels' }], 0, v => { levels = +v; render(); })),
      canvas,
      h('div', { class: 'panel__actions' }, h('button', { class: 'btn btn--primary', onclick: async () => { const b = await canvasToBlob(canvas, 'image/png'); out.innerHTML = ''; out.appendChild(resultCard({ title: 'pixel', blob: b, filename: 'pixel-art.png', previewUrl: URL.createObjectURL(b), isImage: true })); } }, 'Export PNG')),
    );
    const dz = Dropzone({ accept: 'image/*', onFiles: async fs => { const url = URL.createObjectURL(fs[0]); img = await loadImage(url); panel.classList.remove('hidden'); render(); } });
    root.appendChild(toolShell(this, h('div', {}, dz, panel, out)));
  },
};

/* ---------------- CSV Chart Maker ---------------- */
export const csvChart = {
  id: 'csv-chart', name: 'CSV Chart Maker', category: CAT, icon: ICONS.calc,
  description: 'Paste CSV data and render a bar or line chart, export as PNG.',
  keywords: 'csv chart graph bar line data visualize export png',
  render(root) {
    let type = 'bar';
    const ta = h('textarea', { class: 'input', rows: 6, placeholder: 'label,value\nJan,120\nFeb,200\nMar,150\nApr,90', oninput: draw });
    ta.value = 'Jan,120\nFeb,200\nMar,150\nApr,90\nMay,240';
    const canvas = h('canvas', { class: 'preview-canvas', width: 800, height: 420 });
    function draw() {
      const rows = ta.value.trim().split('\n').map(l => l.split(',')).filter(r => r.length >= 2 && !isNaN(parseFloat(r[1])));
      const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, 800, 420);
      const css = getComputedStyle(document.documentElement);
      const accent = css.getPropertyValue('--accent').trim() || '#3b71ff';
      const text = css.getPropertyValue('--text-2').trim() || '#999';
      if (!rows.length) return;
      const vals = rows.map(r => parseFloat(r[1])); const max = Math.max(...vals, 1);
      const pad = 50, W = 800 - pad * 2, H = 420 - pad * 2;
      ctx.strokeStyle = text + '55'; ctx.fillStyle = text; ctx.font = '12px Inter, sans-serif';
      ctx.beginPath(); ctx.moveTo(pad, pad); ctx.lineTo(pad, pad + H); ctx.lineTo(pad + W, pad + H); ctx.stroke();
      if (type === 'bar') {
        const bw = W / rows.length * 0.6, gap = W / rows.length;
        rows.forEach((r, i) => { const bh = vals[i] / max * H; const x = pad + i * gap + (gap - bw) / 2; ctx.fillStyle = accent; ctx.fillRect(x, pad + H - bh, bw, bh); ctx.fillStyle = text; ctx.textAlign = 'center'; ctx.fillText(r[0], x + bw / 2, pad + H + 16); ctx.fillText(vals[i], x + bw / 2, pad + H - bh - 6); });
      } else {
        ctx.strokeStyle = accent; ctx.lineWidth = 2.5; ctx.beginPath();
        rows.forEach((r, i) => { const x = pad + i / (rows.length - 1 || 1) * W; const y = pad + H - vals[i] / max * H; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
        ctx.stroke(); ctx.fillStyle = accent;
        rows.forEach((r, i) => { const x = pad + i / (rows.length - 1 || 1) * W; const y = pad + H - vals[i] / max * H; ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill(); ctx.fillStyle = text; ctx.textAlign = 'center'; ctx.fillText(r[0], x, pad + H + 16); ctx.fillStyle = accent; });
      }
    }
    const body = h('div', {}, h('div', { class: 'panel' },
      field('CSV data (label,value per line)', ta),
      field('Chart type', select(['bar', 'line'], type, v => { type = v; draw(); })),
      canvas,
      h('div', { class: 'panel__actions' }, h('button', { class: 'btn btn--primary', onclick: () => canvas.toBlob(b => downloadBlob(b, 'chart.png')) }, 'Download PNG'))));
    root.appendChild(toolShell(this, body)); setTimeout(draw, 0);
  },
};

export default [colorPicker, gradientGenerator, whiteboard, signatureMaker, pixelArt, csvChart];
