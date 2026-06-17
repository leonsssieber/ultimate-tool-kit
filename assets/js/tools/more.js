// more.js — extra tools across categories. All local.
import {
  h, ICONS, toolShell, field, select, toast, Dropzone, busy, resultCard, downloadBlob,
  loadImage, canvasToBlob, stripExt, rangeField, onCleanup,
} from '../core.js';

const copy = (t) => { navigator.clipboard.writeText(t); toast('Copied', 'success'); };
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ---------------- Text to Speech ---------------- */
export const textToSpeech = {
  id: 'text-to-speech', name: 'Text to Speech', category: 'Audio', icon: ICONS.audio,
  description: 'Read any text aloud using the voices installed on your device.',
  keywords: 'text to speech tts read aloud voice narrator speak',
  render(root) {
    let rate = 1, pitch = 1, voices = [];
    const ta = h('textarea', { class: 'input', rows: 5, value: 'Hello! This text is being read aloud by your browser.' });
    const voiceSel = h('select', { class: 'input' });
    function loadVoices() { voices = speechSynthesis.getVoices(); voiceSel.innerHTML = ''; voices.forEach((v, i) => voiceSel.appendChild(h('option', { value: i }, `${v.name} (${v.lang})`))); }
    loadVoices(); speechSynthesis.onvoiceschanged = loadVoices;
    function play() { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(ta.value); u.rate = rate; u.pitch = pitch; if (voices[voiceSel.value]) u.voice = voices[voiceSel.value]; speechSynthesis.speak(u); }
    onCleanup(() => { speechSynthesis.cancel(); speechSynthesis.onvoiceschanged = null; });
    root.appendChild(toolShell(this, h('div', {}, h('div', { class: 'panel' },
      field('Text', ta), field('Voice', voiceSel),
      rangeField('Speed', { min: 0.5, max: 2, step: 0.1, value: 1, suffix: '×', onInput: v => rate = v }),
      rangeField('Pitch', { min: 0, max: 2, step: 0.1, value: 1, onInput: v => pitch = v }),
      h('div', { class: 'panel__actions' }, h('button', { class: 'btn btn--primary', onclick: play }, '▶ Speak'), h('button', { class: 'btn', onclick: () => speechSynthesis.cancel() }, 'Stop'))))));
  },
};

/* ---------------- Regex Tester ---------------- */
export const regexTester = {
  id: 'regex-tester', name: 'Regex Tester', category: 'Text & Code', icon: ICONS.code,
  description: 'Test a regular expression against text with live highlighting and match groups.',
  keywords: 'regex regular expression test match pattern highlight groups',
  render(root) {
    const pat = h('input', { class: 'input mono', value: '\\b\\w+@\\w+\\.\\w+\\b', oninput: run });
    const flags = h('input', { class: 'input mono', value: 'g', style: { maxWidth: '120px' }, oninput: run });
    const ta = h('textarea', { class: 'input mono', rows: 6, value: 'Contact ada@mail.com or lin@site.org for details.', oninput: run });
    const hl = h('div', { class: 'md-preview', style: { whiteSpace: 'pre-wrap' } });
    const info = h('div', { class: 'calc-sub' }, '');
    function run() {
      try {
        const f = flags.value.includes('g') ? flags.value : flags.value + 'g';
        const re = new RegExp(pat.value, f);
        const text = ta.value; const matches = [...text.matchAll(re)];
        hl.innerHTML = esc(text).replace(re, m => `<mark>${esc(m)}</mark>`) || '(no text)';
        info.style.color = ''; info.textContent = `${matches.length} match${matches.length === 1 ? '' : 'es'}` + (matches[0] && matches[0].length > 1 ? ` · ${matches[0].length - 1} group(s) in first match` : '');
      } catch (e) { info.style.color = '#ff6d6d'; info.textContent = '✗ ' + e.message; }
    }
    root.appendChild(toolShell(this, h('div', {}, h('div', { class: 'panel' },
      h('div', { class: 'grid-2' }, field('Pattern', pat), field('Flags', flags)),
      field('Test text', ta), info, h('p', { class: 'field__label' }, 'Matches highlighted:'), hl)))); run();
  },
};

/* ---------------- Text ↔ Binary ---------------- */
export const textBinary = {
  id: 'text-binary', name: 'Text ↔ Binary', category: 'Text & Code', icon: ICONS.code,
  description: 'Convert text to 8-bit binary and back (UTF-8 aware).',
  keywords: 'text binary convert encode decode 8 bit ascii bits',
  render(root) {
    const ta = h('textarea', { class: 'input mono', rows: 5, value: 'Hi!' });
    const out = h('div', { class: 'textpreview' }, '—');
    const encode = () => { out.textContent = [...new TextEncoder().encode(ta.value)].map(b => b.toString(2).padStart(8, '0')).join(' '); };
    const decode = () => { try { const bytes = ta.value.trim().split(/\s+/).map(b => parseInt(b, 2)); out.textContent = new TextDecoder().decode(new Uint8Array(bytes)); } catch { toast('Invalid binary', 'error'); } };
    root.appendChild(toolShell(this, h('div', {}, h('div', { class: 'panel' }, field('Input', ta),
      h('div', { class: 'panel__actions' }, h('button', { class: 'btn btn--primary', onclick: encode }, 'Text → Binary'), h('button', { class: 'btn', onclick: decode }, 'Binary → Text'), h('button', { class: 'btn', onclick: () => copy(out.textContent) }, 'Copy')), out)))); encode();
  },
};

/* ---------------- Caesar / ROT13 Cipher ---------------- */
export const caesarCipher = {
  id: 'caesar-cipher', name: 'Caesar Cipher', category: 'Text & Code', icon: ICONS.code,
  description: 'Shift letters by N (or ROT13) to encode/decode simple ciphers.',
  keywords: 'caesar cipher rot13 shift encode decode encrypt letters',
  render(root) {
    let shift = 3;
    const ta = h('textarea', { class: 'input', rows: 4, value: 'Hello World' });
    const out = h('div', { class: 'textpreview' }, '—');
    const shiftFn = (s, n) => s.replace(/[a-z]/gi, c => { const base = c <= 'Z' ? 65 : 97; return String.fromCharCode((c.charCodeAt(0) - base + (n % 26) + 26) % 26 + base); });
    const run = (n) => { out.textContent = shiftFn(ta.value, n); };
    root.appendChild(toolShell(this, h('div', {}, h('div', { class: 'panel' }, field('Text', ta),
      rangeField('Shift', { min: 0, max: 25, step: 1, value: 3, onInput: v => { shift = v; run(shift); } }),
      h('div', { class: 'panel__actions' }, h('button', { class: 'btn btn--primary', onclick: () => run(shift) }, 'Encode'), h('button', { class: 'btn', onclick: () => run(-shift) }, 'Decode'), h('button', { class: 'btn', onclick: () => run(13) }, 'ROT13'), h('button', { class: 'btn', onclick: () => copy(out.textContent) }, 'Copy')), out)))); run(3);
  },
};

/* ---------------- UUID Generator ---------------- */
export const uuidGenerator = {
  id: 'uuid-generator', name: 'UUID Generator', category: 'Utilities', icon: ICONS.key,
  description: 'Generate cryptographically-random v4 UUIDs.',
  keywords: 'uuid guid generator random unique id v4',
  render(root) {
    let count = 5;
    const out = h('div', { class: 'textpreview' }, '');
    const gen = () => { out.textContent = Array.from({ length: count }, () => crypto.randomUUID()).join('\n'); };
    root.appendChild(toolShell(this, h('div', {}, h('div', { class: 'panel' },
      field('How many', h('input', { class: 'input', type: 'number', min: 1, max: 1000, value: 5, oninput: e => count = Math.max(1, Math.min(1000, +e.target.value || 1)) })),
      h('div', { class: 'panel__actions' }, h('button', { class: 'btn btn--primary', onclick: gen }, 'Generate'), h('button', { class: 'btn', onclick: () => copy(out.textContent) }, 'Copy all')), out)))); gen();
  },
};

/* ---------------- Aspect Ratio Calculator ---------------- */
export const aspectRatioCalc = {
  id: 'aspect-ratio', name: 'Aspect Ratio Calculator', category: 'Calculators', icon: ICONS.calc,
  description: 'Scale dimensions while keeping the same aspect ratio, and simplify ratios.',
  keywords: 'aspect ratio calculator resize proportion dimensions scale',
  render(root) {
    let ow = 1920, oh = 1080, nw = 1280;
    const owIn = h('input', { class: 'input', type: 'number', value: 1920, oninput: e => { ow = +e.target.value || 1; calc(); } });
    const ohIn = h('input', { class: 'input', type: 'number', value: 1080, oninput: e => { oh = +e.target.value || 1; calc(); } });
    const nwIn = h('input', { class: 'input', type: 'number', value: 1280, oninput: e => { nw = +e.target.value || 1; calc(); } });
    const nh = h('div', { class: 'big-num' }, '—'); const ratio = h('div', { class: 'calc-sub' }, '');
    function gcd(a, b) { return b ? gcd(b, a % b) : a; }
    function calc() { const newH = Math.round(nw * oh / ow); nh.textContent = `${nw} × ${newH}`; const g = gcd(ow, oh) || 1; ratio.textContent = `Ratio ${ow / g} : ${oh / g}  (${(ow / oh).toFixed(3)})`; }
    root.appendChild(toolShell(this, h('div', {}, h('div', { class: 'panel' },
      h('div', { class: 'grid-2' }, field('Original width', owIn), field('Original height', ohIn)),
      field('New width', nwIn)),
      h('div', { class: 'output' }, h('div', { class: 'calc-result' }, h('div', { class: 'calc-sub' }, 'New dimensions'), nh, ratio))))); calc();
  },
};

/* ---------------- Event Countdown ---------------- */
export const eventCountdown = {
  id: 'event-countdown', name: 'Event Countdown', category: 'Time', icon: ICONS.clock,
  description: 'Live countdown to any future date and time.',
  keywords: 'countdown event date timer days until new year birthday deadline',
  render(root) {
    let target = null, timer = null;
    const name = h('input', { class: 'input', value: 'New Year', placeholder: 'Event name' });
    const dt = h('input', { class: 'input', type: 'datetime-local' });
    const disp = h('div', { class: 'timer-display' }, '—');
    const label = h('div', { class: 'calc-sub' }, 'Pick a date');
    function tick() {
      if (!target) return;
      let diff = Math.max(0, target - Date.now());
      const d = Math.floor(diff / 864e5); diff %= 864e5;
      const hh = Math.floor(diff / 36e5); diff %= 36e5;
      const m = Math.floor(diff / 6e4); const s = Math.floor((diff % 6e4) / 1000);
      disp.textContent = `${d}d ${String(hh).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      label.textContent = (target - Date.now() <= 0) ? `🎉 ${name.value || 'Event'} is here!` : `until ${name.value || 'the event'}`;
    }
    dt.addEventListener('change', () => { target = dt.value ? new Date(dt.value).getTime() : null; tick(); });
    timer = setInterval(tick, 1000); onCleanup(() => clearInterval(timer));
    root.appendChild(toolShell(this, h('div', {}, h('div', { class: 'panel center' },
      h('div', { class: 'grid-2', style: { width: '100%' } }, field('Event name', name), field('Date & time', dt)),
      disp, label))));
  },
};

/* ---------------- Color Palette Extractor ---------------- */
export const colorPalette = {
  id: 'color-palette', name: 'Color Palette Extractor', category: 'Creative', icon: ICONS.palette,
  description: 'Pull the dominant colors out of any image as a palette.',
  keywords: 'color palette extract dominant image swatches scheme picker',
  render(root) {
    let file = null, n = 6;
    const out = h('div', { class: 'output' });
    const panel = h('div', { class: 'panel hidden' });
    const swatches = h('div', { class: 'palette-row' });
    panel.append(rangeField('Colors', { min: 3, max: 12, step: 1, value: n, onInput: v => { n = v; run(); } }), swatches);
    const dz = Dropzone({ accept: 'image/*', onFiles: fs => { file = fs[0]; panel.classList.remove('hidden'); run(); } });
    async function run() {
      if (!file) return;
      const img = await loadImage(URL.createObjectURL(file));
      const s = 64; const cv = h('canvas', { width: s, height: s }); const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0, s, s);
      const d = ctx.getImageData(0, 0, s, s).data; const buckets = {};
      for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 128) continue; const key = `${d[i] >> 5},${d[i + 1] >> 5},${d[i + 2] >> 5}`; (buckets[key] = buckets[key] || { c: 0, r: 0, g: 0, b: 0 }); const o = buckets[key]; o.c++; o.r += d[i]; o.g += d[i + 1]; o.b += d[i + 2]; }
      const top = Object.values(buckets).sort((a, b) => b.c - a.c).slice(0, n).map(o => `#${[o.r, o.g, o.b].map(v => Math.round(v / o.c).toString(16).padStart(2, '0')).join('')}`);
      swatches.innerHTML = '';
      top.forEach(c => swatches.appendChild(h('div', { class: 'palette-sw', style: { background: c }, title: c + ' (click to copy)', onclick: () => copy(c) })));
    }
    root.appendChild(toolShell(this, h('div', {}, dz, panel, out)));
  },
};

/* ---------------- Color Contrast Checker ---------------- */
export const contrastChecker = {
  id: 'contrast-checker', name: 'Color Contrast Checker', category: 'Creative', icon: ICONS.palette,
  description: 'Check WCAG contrast ratio between a text and background color.',
  keywords: 'contrast checker wcag accessibility color ratio aa aaa readable',
  render(root) {
    let fg = '#ffffff', bg = '#3b71ff';
    const preview = h('div', { class: 'contrast-preview' }, 'Sample text — Aa');
    const big = h('div', { class: 'big-num' }, ''); const grades = h('div', { class: 'stats' });
    const lum = (hex) => { const n = parseInt(hex.slice(1), 16); const a = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]; };
    function calc() {
      const l1 = lum(fg), l2 = lum(bg); const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      preview.style.color = fg; preview.style.background = bg;
      big.textContent = ratio.toFixed(2) + ' : 1';
      const g = (ok) => ok ? '✓ Pass' : '✗ Fail';
      grades.innerHTML = '';
      grades.append(stat(g(ratio >= 4.5), 'AA normal'), stat(g(ratio >= 3), 'AA large'), stat(g(ratio >= 7), 'AAA normal'), stat(g(ratio >= 4.5), 'AAA large'));
    }
    function stat(v, l) { return h('div', { class: 'stat' }, h('span', { class: 'stat__num', style: { fontSize: '16px', color: v.startsWith('✓') ? '#41d18f' : '#ff6d6d' } }, v), h('span', { class: 'stat__label' }, l)); }
    root.appendChild(toolShell(this, h('div', {}, h('div', { class: 'panel' },
      h('div', { class: 'grid-2' }, field('Text color', h('input', { type: 'color', value: fg, oninput: e => { fg = e.target.value; calc(); } })), field('Background', h('input', { type: 'color', value: bg, oninput: e => { bg = e.target.value; calc(); } }))),
      preview, h('div', { class: 'calc-result' }, h('div', { class: 'calc-sub' }, 'Contrast ratio'), big), grades)))); calc();
  },
};

/* ---------------- Image Watermark ---------------- */
export const imageWatermark = {
  id: 'image-watermark', name: 'Image Watermark', category: 'Image', icon: ICONS.image,
  description: 'Add a text watermark to an image, with position, size and opacity.',
  keywords: 'watermark image text overlay copyright brand stamp',
  render(root) {
    let file = null, img = null, text = '© Your Name', size = 5, opacity = 0.5, pos = 'br', color = '#ffffff';
    const out = h('div', { class: 'output' });
    const preview = h('canvas', { class: 'preview-canvas' });
    const panel = h('div', { class: 'panel hidden' });
    function draw() {
      if (!img) return;
      preview.width = img.naturalWidth; preview.height = img.naturalHeight;
      const ctx = preview.getContext('2d'); ctx.drawImage(img, 0, 0);
      const fs = Math.round(img.naturalWidth * size / 100);
      ctx.font = `bold ${fs}px Inter, sans-serif`; ctx.globalAlpha = opacity; ctx.fillStyle = color;
      ctx.textBaseline = 'middle'; const m = ctx.measureText(text); const pad = fs * 0.5;
      const positions = { tl: [pad + m.width / 2, pad + fs / 2], tr: [preview.width - pad - m.width / 2, pad + fs / 2], bl: [pad + m.width / 2, preview.height - pad - fs / 2], br: [preview.width - pad - m.width / 2, preview.height - pad - fs / 2], center: [preview.width / 2, preview.height / 2] };
      ctx.textAlign = 'center'; const [x, y] = positions[pos]; ctx.fillText(text, x, y); ctx.globalAlpha = 1;
    }
    panel.append(
      field('Watermark text', h('input', { class: 'input', value: text, oninput: e => { text = e.target.value; draw(); } })),
      h('div', { class: 'grid-2' }, field('Position', select([{ value: 'br', label: 'Bottom right' }, { value: 'bl', label: 'Bottom left' }, { value: 'tr', label: 'Top right' }, { value: 'tl', label: 'Top left' }, { value: 'center', label: 'Center' }], pos, v => { pos = v; draw(); })), field('Color', h('input', { type: 'color', value: color, oninput: e => { color = e.target.value; draw(); } }))),
      rangeField('Size', { min: 2, max: 15, step: 0.5, value: size, suffix: '%', onInput: v => { size = v; draw(); } }),
      rangeField('Opacity', { min: 0.1, max: 1, step: 0.05, value: opacity, onInput: v => { opacity = v; draw(); } }),
      preview,
      h('div', { class: 'panel__actions' }, h('button', { class: 'btn btn--primary', onclick: async () => { const blob = await canvasToBlob(preview, 'image/png'); out.innerHTML = ''; out.appendChild(resultCard({ title: 'watermarked', blob, filename: `${stripExt(file.name)}-wm.png`, previewUrl: URL.createObjectURL(blob), isImage: true })); toast('Done', 'success'); } }, 'Export PNG')));
    const dz = Dropzone({ accept: 'image/*', onFiles: async fs => { file = fs[0]; img = await loadImage(URL.createObjectURL(file)); panel.classList.remove('hidden'); draw(); } });
    root.appendChild(toolShell(this, h('div', {}, dz, panel, out)));
  },
};

/* ---------------- Remove Image Metadata (EXIF) ---------------- */
export const removeExif = {
  id: 'remove-exif', name: 'Remove Image Metadata', category: 'Image', icon: ICONS.image,
  description: 'Strip EXIF/GPS metadata from a photo by re-encoding it (privacy).',
  keywords: 'exif metadata remove strip gps privacy photo clean location',
  render(root) {
    let file = null, keepFormat = true;
    const out = h('div', { class: 'output' });
    const panel = h('div', { class: 'panel hidden' });
    panel.append(h('p', { class: 'hint' }, 'Re-encodes the image so embedded EXIF/GPS/camera data is dropped.'),
      h('div', { class: 'panel__actions' }, h('button', { class: 'btn btn--primary', onclick: run }, 'Strip metadata')));
    const dz = Dropzone({ accept: 'image/jpeg,image/png,image/webp', onFiles: fs => { file = fs[0]; panel.classList.remove('hidden'); } });
    async function run() {
      if (!file) return toast('Add an image', 'error');
      out.innerHTML = ''; const b = busy(out, 'Cleaning…'); b.progress(null);
      try {
        const img = await loadImage(URL.createObjectURL(file));
        const cv = h('canvas', { width: img.naturalWidth, height: img.naturalHeight });
        cv.getContext('2d').drawImage(img, 0, 0);
        const isPng = file.type === 'image/png';
        const blob = await canvasToBlob(cv, isPng ? 'image/png' : 'image/jpeg', 0.95);
        b.done();
        out.appendChild(resultCard({ title: 'clean', blob, filename: `${stripExt(file.name)}-clean.${isPng ? 'png' : 'jpg'}`, previewUrl: URL.createObjectURL(blob), isImage: true }));
        toast('Metadata removed', 'success');
      } catch (e) { console.error(e); b.done(); toast('Failed: ' + e.message, 'error'); }
    }
    root.appendChild(toolShell(this, h('div', {}, dz, panel, out)));
  },
};

/* ---------------- QR Code Reader ---------------- */
export const qrReader = {
  id: 'qr-reader', name: 'QR Code Reader', category: 'Utilities', icon: ICONS.qr,
  description: 'Scan a QR code from an image and read its contents.',
  keywords: 'qr code reader scan decode image read barcode',
  render(root) {
    let file = null;
    const out = h('div', { class: 'output' });
    const panel = h('div', { class: 'panel hidden' });
    panel.append(h('div', { class: 'panel__actions' }, h('button', { class: 'btn btn--primary', onclick: run }, 'Read QR code')));
    const dz = Dropzone({ accept: 'image/*', onFiles: fs => { file = fs[0]; panel.classList.remove('hidden'); } });
    async function run() {
      if (!file) return toast('Add an image', 'error');
      out.innerHTML = ''; const b = busy(out, 'Scanning…'); b.progress(null);
      try {
        const jsQR = (await import('jsqr')).default;
        const img = await loadImage(URL.createObjectURL(file));
        const cv = h('canvas', { width: img.naturalWidth, height: img.naturalHeight });
        cv.getContext('2d').drawImage(img, 0, 0);
        const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height);
        const code = jsQR(d.data, cv.width, cv.height);
        b.done();
        if (!code) return toast('No QR code found in that image', 'error');
        const isUrl = /^https?:\/\//i.test(code.data);
        out.appendChild(h('div', { class: 'panel' },
          h('p', { class: 'field__label' }, 'Decoded content:'),
          h('pre', { class: 'textpreview' }, code.data),
          h('div', { class: 'panel__actions' },
            h('button', { class: 'btn btn--primary', onclick: () => copy(code.data) }, 'Copy'),
            isUrl ? h('a', { class: 'btn', href: code.data, target: '_blank', rel: 'noopener' }, 'Open link') : null)));
        toast('QR decoded', 'success');
      } catch (e) { console.error(e); b.done(); toast('Failed: ' + e.message, 'error'); }
    }
    root.appendChild(toolShell(this, h('div', {}, dz, panel, out)));
  },
};

export default [textToSpeech, regexTester, textBinary, caesarCipher, uuidGenerator, aspectRatioCalc, eventCountdown, colorPalette, contrastChecker, imageWatermark, removeExif, qrReader];
