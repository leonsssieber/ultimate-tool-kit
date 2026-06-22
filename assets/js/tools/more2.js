// more2.js — image effects + handy generators/converters. All local.
import {
  h, ICONS, toolShell, field, select, toast, Dropzone, busy, resultCard, downloadBlob,
  loadImage, canvasToBlob, stripExt, rangeField,
} from '../core.js';

const copy = (t) => { navigator.clipboard.writeText(t); toast('Copied', 'success'); };

/* ---------- one-shot CSS-filter image tools ---------- */
function filterTool({ id, name, description, keywords, filter, ext = 'png' }) {
  return {
    id, name, category: 'Image', icon: ICONS.image, description, keywords,
    render(root) {
      let file = null;
      const out = h('div', { class: 'output' });
      const panel = h('div', { class: 'panel hidden' });
      panel.append(h('div', { class: 'panel__actions' }, h('button', { class: 'btn btn--primary', onclick: run }, 'Apply')));
      const dz = Dropzone({ accept: 'image/*', onFiles: fs => { file = fs[0]; panel.classList.remove('hidden'); } });
      async function run() {
        if (!file) return toast('Add an image', 'error');
        out.innerHTML = ''; const b = busy(out, 'Processing…'); b.progress(null);
        try {
          const img = await loadImage(URL.createObjectURL(file));
          const cv = h('canvas', { width: img.naturalWidth, height: img.naturalHeight });
          const ctx = cv.getContext('2d'); ctx.filter = filter; ctx.drawImage(img, 0, 0);
          const blob = await canvasToBlob(cv, ext === 'jpg' ? 'image/jpeg' : 'image/png', 0.95);
          b.done(); out.appendChild(resultCard({ title: name, blob, filename: `${stripExt(file.name)}-${id}.${ext}`, previewUrl: URL.createObjectURL(blob), isImage: true })); toast('Done', 'success');
        } catch (e) { console.error(e); b.done(); toast('Failed: ' + e.message, 'error'); }
      }
      root.appendChild(toolShell(this, h('div', {}, dz, panel, out)));
    },
  };
}

export const imageInverter = filterTool({ id: 'image-invert', name: 'Image Inverter', description: 'Invert the colors of an image (photo negative effect).', keywords: 'invert image colors negative photo opposite reverse', filter: 'invert(1)' });
export const grayscale = filterTool({ id: 'image-grayscale', name: 'Grayscale / B&W', description: 'Convert an image to black & white.', keywords: 'grayscale black white bw monochrome desaturate', filter: 'grayscale(1)' });
export const sepia = filterTool({ id: 'image-sepia', name: 'Sepia Tone', description: 'Give a photo a warm vintage sepia look.', keywords: 'sepia vintage old photo warm tone filter', filter: 'sepia(1)' });

/* ---------------- Image Adjustments ---------------- */
export const imageAdjust = {
  id: 'image-adjust', name: 'Image Adjustments', category: 'Image', icon: ICONS.image,
  description: 'Tune brightness, contrast, saturation, hue, blur and more with live preview.',
  keywords: 'image adjust brightness contrast saturation hue blur filter edit enhance',
  render(root) {
    let file = null, img = null;
    const f = { brightness: 100, contrast: 100, saturate: 100, 'hue-rotate': 0, sepia: 0, blur: 0, grayscale: 0, invert: 0 };
    const out = h('div', { class: 'output' });
    const preview = h('canvas', { class: 'preview-canvas' });
    const panel = h('div', { class: 'panel hidden' });
    function css() { return `brightness(${f.brightness}%) contrast(${f.contrast}%) saturate(${f.saturate}%) hue-rotate(${f['hue-rotate']}deg) sepia(${f.sepia}%) blur(${f.blur}px) grayscale(${f.grayscale}%) invert(${f.invert}%)`; }
    function draw() { if (!img) return; preview.width = img.naturalWidth; preview.height = img.naturalHeight; const ctx = preview.getContext('2d'); ctx.filter = css(); ctx.clearRect(0, 0, preview.width, preview.height); ctx.drawImage(img, 0, 0); }
    panel.append(
      rangeField('Brightness', { min: 0, max: 200, step: 1, value: 100, suffix: '%', onInput: v => { f.brightness = v; draw(); } }),
      rangeField('Contrast', { min: 0, max: 200, step: 1, value: 100, suffix: '%', onInput: v => { f.contrast = v; draw(); } }),
      rangeField('Saturation', { min: 0, max: 200, step: 1, value: 100, suffix: '%', onInput: v => { f.saturate = v; draw(); } }),
      rangeField('Hue', { min: 0, max: 360, step: 1, value: 0, suffix: '°', onInput: v => { f['hue-rotate'] = v; draw(); } }),
      rangeField('Sepia', { min: 0, max: 100, step: 1, value: 0, suffix: '%', onInput: v => { f.sepia = v; draw(); } }),
      rangeField('Blur', { min: 0, max: 20, step: 0.5, value: 0, suffix: 'px', onInput: v => { f.blur = v; draw(); } }),
      rangeField('Grayscale', { min: 0, max: 100, step: 1, value: 0, suffix: '%', onInput: v => { f.grayscale = v; draw(); } }),
      preview,
      h('div', { class: 'panel__actions' },
        h('button', { class: 'btn btn--primary', onclick: async () => { const blob = await canvasToBlob(preview, 'image/png'); out.innerHTML = ''; out.appendChild(resultCard({ title: 'adjusted', blob, filename: `${stripExt(file.name)}-edit.png`, previewUrl: URL.createObjectURL(blob), isImage: true })); toast('Exported', 'success'); } }, 'Export PNG')));
    const dz = Dropzone({ accept: 'image/*', onFiles: async fs => { file = fs[0]; img = await loadImage(URL.createObjectURL(file)); panel.classList.remove('hidden'); draw(); } });
    root.appendChild(toolShell(this, h('div', {}, dz, panel, out)));
  },
};

/* ---------------- Add Border / Frame ---------------- */
export const addBorder = {
  id: 'add-border', name: 'Add Border / Frame', category: 'Image', icon: ICONS.image,
  description: 'Add a solid color border or padding around an image.',
  keywords: 'border frame padding image margin add color polaroid',
  render(root) {
    let file = null, img = null, size = 5, color = '#ffffff';
    const out = h('div', { class: 'output' });
    const preview = h('canvas', { class: 'preview-canvas' });
    const panel = h('div', { class: 'panel hidden' });
    function draw() {
      if (!img) return;
      const b = Math.round(Math.min(img.naturalWidth, img.naturalHeight) * size / 100);
      preview.width = img.naturalWidth + b * 2; preview.height = img.naturalHeight + b * 2;
      const ctx = preview.getContext('2d'); ctx.fillStyle = color; ctx.fillRect(0, 0, preview.width, preview.height); ctx.drawImage(img, b, b);
    }
    panel.append(
      rangeField('Border thickness', { min: 0, max: 25, step: 0.5, value: size, suffix: '%', onInput: v => { size = v; draw(); } }),
      field('Border color', h('input', { type: 'color', value: color, oninput: e => { color = e.target.value; draw(); } })),
      preview,
      h('div', { class: 'panel__actions' }, h('button', { class: 'btn btn--primary', onclick: async () => { const blob = await canvasToBlob(preview, 'image/png'); out.innerHTML = ''; out.appendChild(resultCard({ title: 'bordered', blob, filename: `${stripExt(file.name)}-border.png`, previewUrl: URL.createObjectURL(blob), isImage: true })); } }, 'Export PNG')));
    const dz = Dropzone({ accept: 'image/*', onFiles: async fs => { file = fs[0]; img = await loadImage(URL.createObjectURL(file)); panel.classList.remove('hidden'); draw(); } });
    root.appendChild(toolShell(this, h('div', {}, dz, panel, out)));
  },
};

/* ---------------- Rounded Corners ---------------- */
export const roundedCorners = {
  id: 'rounded-corners', name: 'Rounded Corners', category: 'Image', icon: ICONS.image,
  description: 'Round the corners of an image and export a transparent PNG.',
  keywords: 'rounded corners image radius transparent png border-radius',
  render(root) {
    let file = null, img = null, radius = 12;
    const out = h('div', { class: 'output' });
    const preview = h('canvas', { class: 'preview-canvas result__preview--checker' });
    const panel = h('div', { class: 'panel hidden' });
    function draw() {
      if (!img) return;
      const w = img.naturalWidth, hh = img.naturalHeight;
      const r = Math.round(Math.min(w, hh) * radius / 100);
      preview.width = w; preview.height = hh; const ctx = preview.getContext('2d');
      ctx.clearRect(0, 0, w, hh); ctx.beginPath();
      ctx.moveTo(r, 0); ctx.arcTo(w, 0, w, hh, r); ctx.arcTo(w, hh, 0, hh, r); ctx.arcTo(0, hh, 0, 0, r); ctx.arcTo(0, 0, w, 0, r); ctx.closePath(); ctx.clip();
      ctx.drawImage(img, 0, 0);
    }
    panel.append(rangeField('Corner radius', { min: 0, max: 50, step: 1, value: radius, suffix: '%', onInput: v => { radius = v; draw(); } }), preview,
      h('div', { class: 'panel__actions' }, h('button', { class: 'btn btn--primary', onclick: async () => { const blob = await canvasToBlob(preview, 'image/png'); out.innerHTML = ''; out.appendChild(resultCard({ title: 'rounded', blob, filename: `${stripExt(file.name)}-rounded.png`, previewUrl: URL.createObjectURL(blob), isImage: true })); } }, 'Export PNG')));
    const dz = Dropzone({ accept: 'image/*', onFiles: async fs => { file = fs[0]; img = await loadImage(URL.createObjectURL(file)); panel.classList.remove('hidden'); draw(); } });
    root.appendChild(toolShell(this, h('div', {}, dz, panel, out)));
  },
};

/* ---------------- Roman Numeral Converter ---------------- */
export const romanNumerals = {
  id: 'roman-numerals', name: 'Roman Numeral Converter', category: 'Calculators', icon: ICONS.calc,
  description: 'Convert numbers (1–3999) to Roman numerals and back.',
  keywords: 'roman numerals convert number latin mcmxciv',
  render(root) {
    const ROM = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    const toRoman = n => { if (n < 1 || n > 3999) return '—'; let s = ''; for (const [v, r] of ROM) while (n >= v) { s += r; n -= v; } return s; };
    const map = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
    const fromRoman = s => { s = s.toUpperCase(); let n = 0; for (let i = 0; i < s.length; i++) { const c = map[s[i]], nx = map[s[i + 1]]; if (!c) return NaN; n += (nx && c < nx) ? -c : c; } return n; };
    const numIn = h('input', { class: 'input', type: 'number', value: 2024, oninput: e => romOut.textContent = toRoman(+e.target.value) });
    const romIn = h('input', { class: 'input mono', value: 'MMXXIV', oninput: e => { const n = fromRoman(e.target.value); numOut.textContent = isNaN(n) ? '—' : n; } });
    const romOut = h('div', { class: 'big-num' }, toRoman(2024)); const numOut = h('div', { class: 'big-num' }, '2024');
    root.appendChild(toolShell(this, h('div', {},
      h('div', { class: 'panel' }, field('Number → Roman', numIn), h('div', { class: 'calc-result' }, romOut)),
      h('div', { class: 'panel' }, field('Roman → Number', romIn), h('div', { class: 'calc-result' }, numOut)))));
  },
};

/* ---------------- Days Between Dates ---------------- */
export const daysBetween = {
  id: 'days-between', name: 'Days Between Dates', category: 'Calculators', icon: ICONS.clock,
  description: 'Count the days, weeks and months between two dates.',
  keywords: 'days between dates difference duration calculator weeks months',
  render(root) {
    const a = h('input', { class: 'input', type: 'date', oninput: calc });
    const b = h('input', { class: 'input', type: 'date', oninput: calc });
    a.value = new Date().toISOString().slice(0, 10);
    const stats = h('div', { class: 'stats' });
    function calc() {
      if (!a.value || !b.value) return;
      const days = Math.round(Math.abs(new Date(b.value) - new Date(a.value)) / 864e5);
      stats.innerHTML = '';
      stats.append(stat(days.toLocaleString(), 'Days'), stat(Math.floor(days / 7), 'Weeks'), stat((days / 30.44).toFixed(1), 'Months'), stat((days / 365.25).toFixed(2), 'Years'));
    }
    root.appendChild(toolShell(this, h('div', {}, h('div', { class: 'panel' }, h('div', { class: 'grid-2' }, field('From', a), field('To', b))), h('div', { class: 'output' }, stats)))); calc();
  },
};

/* ---------------- Discount Calculator ---------------- */
export const discountCalc = {
  id: 'discount-calc', name: 'Discount Calculator', category: 'Calculators', icon: ICONS.calc,
  description: 'Work out the sale price and how much you save.',
  keywords: 'discount sale price percent off savings calculator shopping',
  render(root) {
    const price = h('input', { class: 'input', type: 'number', value: 80, oninput: calc });
    const pct = h('input', { class: 'input', type: 'number', value: 25, oninput: calc });
    const big = h('div', { class: 'big-num' }, ''); const sub = h('div', { class: 'calc-sub' }, '');
    function calc() { const p = +price.value, d = +pct.value; const save = p * d / 100; big.textContent = '$' + (p - save).toFixed(2); sub.textContent = `You save $${save.toFixed(2)}`; }
    root.appendChild(toolShell(this, h('div', {}, h('div', { class: 'panel' }, h('div', { class: 'grid-2' }, field('Original price ($)', price), field('Discount (%)', pct))),
      h('div', { class: 'output' }, h('div', { class: 'calc-result' }, h('div', { class: 'calc-sub' }, 'Final price'), big, sub))))); calc();
  },
};

/* ---------------- Time Zone Converter ---------------- */
export const timezoneConverter = {
  id: 'timezone-converter', name: 'Time Zone Converter', category: 'Time', icon: ICONS.clock,
  description: 'Convert a date & time from one time zone to another.',
  keywords: 'timezone converter time zone convert utc gmt meeting world',
  render(root) {
    const zones = Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone') : ['UTC', 'America/New_York', 'Europe/London', 'Asia/Tokyo'];
    const tzOffset = (date, tz) => { const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(date).reduce((a, x) => (a[x.type] = x.value, a), {}); return (Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - date.getTime()) / 60000; };
    const dt = h('input', { class: 'input', type: 'datetime-local', oninput: calc });
    const fromSel = select(zones, Intl.DateTimeFormat().resolvedOptions().timeZone, () => calc());
    const toSel = select(zones, 'Asia/Tokyo', () => calc());
    const out = h('div', { class: 'big-num' }, '—'); const sub = h('div', { class: 'calc-sub' }, '');
    dt.value = new Date().toISOString().slice(0, 16);
    function calc() {
      if (!dt.value) return;
      const [d, t] = dt.value.split('T'); const [Y, Mo, D] = d.split('-').map(Number); const [H, Mi] = t.split(':').map(Number);
      let guess = Date.UTC(Y, Mo - 1, D, H, Mi);
      const off = tzOffset(new Date(guess), fromSel.value); const instant = new Date(guess - off * 60000);
      out.textContent = new Intl.DateTimeFormat('en-GB', { timeZone: toSel.value, dateStyle: 'medium', timeStyle: 'short' }).format(instant);
      sub.textContent = `${toSel.value.replace(/_/g, ' ')}`;
    }
    root.appendChild(toolShell(this, h('div', {}, h('div', { class: 'panel' }, field('Date & time', dt), h('div', { class: 'grid-2' }, field('From zone', fromSel), field('To zone', toSel))),
      h('div', { class: 'output' }, h('div', { class: 'calc-result' }, out, sub))))); calc();
  },
};

/* ---------------- Case Converter ---------------- */
export const caseConverter = {
  id: 'case-converter', name: 'Case Converter', category: 'Text & Code', icon: ICONS.type,
  description: 'Convert text between camelCase, snake_case, kebab-case, Title Case and more.',
  keywords: 'case converter camelcase snake kebab pascal title sentence upper lower',
  render(root) {
    const ta = h('textarea', { class: 'input', rows: 3, value: 'Hello World Example' });
    const list = h('div', {});
    const words = s => s.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_\-]+/g, ' ').trim().split(/\s+/).filter(Boolean);
    const cases = {
      'UPPERCASE': s => s.toUpperCase(), 'lowercase': s => s.toLowerCase(),
      'Title Case': s => words(s).map(w => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(' '),
      'Sentence case': s => { const l = s.toLowerCase(); return l.charAt(0).toUpperCase() + l.slice(1); },
      'camelCase': s => words(s).map((w, i) => i ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase()).join(''),
      'PascalCase': s => words(s).map(w => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(''),
      'snake_case': s => words(s).map(w => w.toLowerCase()).join('_'),
      'kebab-case': s => words(s).map(w => w.toLowerCase()).join('-'),
      'CONSTANT_CASE': s => words(s).map(w => w.toUpperCase()).join('_'),
    };
    function render() { list.innerHTML = ''; Object.entries(cases).forEach(([k, fn]) => { const v = fn(ta.value); list.appendChild(h('div', { class: 'color-val', onclick: () => copy(v) }, h('span', { class: 'color-val__k', style: { minWidth: '130px' } }, k), h('span', { class: 'color-val__v' }, v), h('span', { class: 'color-val__copy' }, 'copy'))); }); }
    ta.addEventListener('input', render);
    root.appendChild(toolShell(this, h('div', {}, h('div', { class: 'panel' }, field('Text', ta), list)))); render();
  },
};

/* ---------------- Slugify ---------------- */
export const slugify = {
  id: 'slugify', name: 'Slug Generator', category: 'Text & Code', icon: ICONS.code,
  description: 'Turn a title into a clean URL slug.',
  keywords: 'slug url slugify seo permalink convert hyphen',
  render(root) {
    const ta = h('input', { class: 'input', value: 'My Awesome Blog Post! (2026)' });
    const out = h('div', { class: 'textpreview' }, '');
    const diacritics = new RegExp('[\\u0300-\\u036f]', 'g');
    const slug = s => s.toLowerCase().normalize('NFKD').replace(diacritics, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const run = () => out.textContent = slug(ta.value);
    ta.addEventListener('input', run);
    root.appendChild(toolShell(this, h('div', {}, h('div', { class: 'panel' }, field('Title', ta), out, h('div', { class: 'panel__actions' }, h('button', { class: 'btn', onclick: () => copy(out.textContent) }, 'Copy')))))); run();
  },
};

/* ---------------- Box Shadow Generator ---------------- */
export const boxShadow = {
  id: 'box-shadow', name: 'CSS Box Shadow Generator', category: 'Creative', icon: ICONS.palette,
  description: 'Design a CSS box-shadow visually and copy the code.',
  keywords: 'box shadow css generator drop shadow design code',
  render(root) {
    let x = 0, y = 10, blur = 25, spread = -5, color = '#000000', opacity = 30, inset = false;
    const box = h('div', { class: 'shadow-box' });
    const code = h('div', { class: 'textpreview' });
    function hexA() { const a = Math.round(opacity / 100 * 255).toString(16).padStart(2, '0'); return color + a; }
    function css() { return `${inset ? 'inset ' : ''}${x}px ${y}px ${blur}px ${spread}px ${hexA()}`; }
    function draw() { box.style.boxShadow = css(); code.textContent = `box-shadow: ${css()};`; }
    const panel = h('div', { class: 'panel' },
      h('div', { class: 'shadow-stage' }, box),
      rangeField('Offset X', { min: -50, max: 50, step: 1, value: x, suffix: 'px', onInput: v => { x = v; draw(); } }),
      rangeField('Offset Y', { min: -50, max: 50, step: 1, value: y, suffix: 'px', onInput: v => { y = v; draw(); } }),
      rangeField('Blur', { min: 0, max: 100, step: 1, value: blur, suffix: 'px', onInput: v => { blur = v; draw(); } }),
      rangeField('Spread', { min: -50, max: 50, step: 1, value: spread, suffix: 'px', onInput: v => { spread = v; draw(); } }),
      rangeField('Opacity', { min: 0, max: 100, step: 1, value: opacity, suffix: '%', onInput: v => { opacity = v; draw(); } }),
      h('div', { class: 'grid-2' }, field('Shadow color', h('input', { type: 'color', value: color, oninput: e => { color = e.target.value; draw(); } })), h('label', { class: 'check' }, h('input', { type: 'checkbox', onchange: e => { inset = e.target.checked; draw(); } }), ' Inset')),
      code, h('div', { class: 'panel__actions' }, h('button', { class: 'btn btn--primary', onclick: () => copy(`box-shadow: ${css()};`) }, 'Copy CSS')));
    root.appendChild(toolShell(this, h('div', {}, panel))); draw();
  },
};

/* ---------------- Random Number Generator ---------------- */
export const randomNumber = {
  id: 'random-number', name: 'Random Number Generator', category: 'Fun', icon: ICONS.dice,
  description: 'Generate random numbers in a range, optionally unique.',
  keywords: 'random number generator range pick lottery dice unique',
  render(root) {
    let min = 1, max = 100, count = 1, unique = false;
    const out = h('div', { class: 'big-num' }, '');
    function gen() {
      const lo = Math.min(min, max), hi = Math.max(min, max);
      if (unique && count > (hi - lo + 1)) return toast('Range too small for that many unique numbers', 'error');
      const nums = []; const used = new Set();
      while (nums.length < count) { const n = lo + Math.floor(Math.random() * (hi - lo + 1)); if (unique) { if (used.has(n)) continue; used.add(n); } nums.push(n); }
      out.textContent = nums.join(', ');
    }
    root.appendChild(toolShell(this, h('div', {}, h('div', { class: 'panel' },
      h('div', { class: 'grid-2' }, field('Min', h('input', { class: 'input', type: 'number', value: 1, oninput: e => min = +e.target.value })), field('Max', h('input', { class: 'input', type: 'number', value: 100, oninput: e => max = +e.target.value }))),
      field('How many', h('input', { class: 'input', type: 'number', min: 1, value: 1, oninput: e => count = Math.max(1, +e.target.value || 1) })),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', onchange: e => unique = e.target.checked }), ' Unique numbers only'),
      h('div', { class: 'panel__actions' }, h('button', { class: 'btn btn--primary', onclick: gen }, 'Generate'), h('button', { class: 'btn', onclick: () => copy(out.textContent) }, 'Copy'))),
      h('div', { class: 'output' }, h('div', { class: 'calc-result' }, out))))); gen();
  },
};

/* ---------------- List Randomizer ---------------- */
export const listShuffle = {
  id: 'list-shuffle', name: 'List Randomizer / Picker', category: 'Fun', icon: ICONS.shuffle,
  description: 'Shuffle a list into random order, or pick a random winner.',
  keywords: 'list randomizer shuffle pick random order winner raffle name picker',
  render(root) {
    const ta = h('textarea', { class: 'input', rows: 8, value: 'Alice\nBob\nCharlie\nDana\nElla' });
    const out = h('div', { class: 'textpreview' }, '');
    const lines = () => ta.value.split('\n').map(s => s.trim()).filter(Boolean);
    const shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
    root.appendChild(toolShell(this, h('div', {}, h('div', { class: 'panel' }, field('Items (one per line)', ta),
      h('div', { class: 'panel__actions' },
        h('button', { class: 'btn btn--primary', onclick: () => out.textContent = shuffle(lines()).join('\n') }, 'Shuffle'),
        h('button', { class: 'btn', onclick: () => { const l = lines(); out.textContent = l.length ? '🏆 ' + l[Math.floor(Math.random() * l.length)] : '—'; } }, 'Pick a winner'),
        h('button', { class: 'btn', onclick: () => copy(out.textContent) }, 'Copy')), out))));
  },
};

function stat(numv, label) { return h('div', { class: 'stat' }, h('span', { class: 'stat__num' }, String(numv)), h('span', { class: 'stat__label' }, label)); }

export default [imageInverter, grayscale, sepia, imageAdjust, addBorder, roundedCorners, romanNumerals, daysBetween, discountCalc, timezoneConverter, caseConverter, slugify, boxShadow, randomNumber, listShuffle];
