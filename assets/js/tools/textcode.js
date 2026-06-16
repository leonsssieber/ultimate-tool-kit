// textcode.js — text, code & data tools. All local.
import { h, ICONS, toolShell, field, select, toast, downloadBlob, Dropzone, loadImage, rangeField } from '../core.js';

const CAT = 'Text & Code';
const copy = (t) => { navigator.clipboard.writeText(t); toast('Copied', 'success'); };
const copyBtn = (getter) => h('button', { class: 'btn', onclick: () => copy(getter()) }, 'Copy');

/* ---------------- Lorem Ipsum ---------------- */
export const loremIpsum = {
  id: 'lorem-ipsum', name: 'Lorem Ipsum Generator', category: CAT, icon: ICONS.doc,
  description: 'Generate placeholder text by paragraphs, sentences or words.',
  keywords: 'lorem ipsum placeholder text dummy filler generator',
  render(root) {
    const WORDS = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum'.split(' ');
    let amount = 4, unit = 'paragraphs';
    const out = h('div', { class: 'textpreview' });
    const rword = () => WORDS[Math.floor(Math.random() * WORDS.length)];
    const sentence = () => { const n = 8 + Math.floor(Math.random() * 10); let s = Array.from({ length: n }, rword).join(' '); return s[0].toUpperCase() + s.slice(1) + '.'; };
    function gen() {
      let txt = '';
      if (unit === 'words') txt = Array.from({ length: amount }, rword).join(' ');
      else if (unit === 'sentences') txt = Array.from({ length: amount }, sentence).join(' ');
      else txt = Array.from({ length: amount }, () => Array.from({ length: 3 + Math.floor(Math.random() * 3) }, sentence).join(' ')).join('\n\n');
      out.textContent = txt;
    }
    const body = h('div', {}, h('div', { class: 'panel' },
      h('div', { class: 'grid-2' }, field('Amount', h('input', { class: 'input', type: 'number', min: 1, value: 4, oninput: e => { amount = +e.target.value || 1; gen(); } })),
        field('Unit', select(['paragraphs', 'sentences', 'words'], unit, v => { unit = v; gen(); }))),
      out, h('div', { class: 'panel__actions' }, copyBtn(() => out.textContent), h('button', { class: 'btn btn--primary', onclick: gen }, 'Regenerate'))));
    root.appendChild(toolShell(this, body)); gen();
  },
};

/* ---------------- Fancy Text ---------------- */
export const fancyText = {
  id: 'fancy-text', name: 'Fancy Text Generator', category: CAT, icon: ICONS.type,
  description: 'Turn text into 𝔣𝔞𝔫𝔠𝔶 unicode fonts to copy & paste.',
  keywords: 'fancy text unicode fonts cool aesthetic copy paste bold italic',
  render(root) {
    const offset = (base) => (s) => [...s].map(c => { const i = c.charCodeAt(0); if (c >= 'a' && c <= 'z') return String.fromCodePoint(base.l + i - 97); if (c >= 'A' && c <= 'Z') return String.fromCodePoint(base.u + i - 65); return c; }).join('');
    const styles = {
      'Bold': offset({ u: 0x1D400, l: 0x1D41A }), 'Italic': offset({ u: 0x1D434, l: 0x1D44E }),
      'Bold Italic': offset({ u: 0x1D468, l: 0x1D482 }), 'Script': offset({ u: 0x1D49C, l: 0x1D4B6 }),
      'Fraktur': offset({ u: 0x1D504, l: 0x1D51E }), 'Double-struck': offset({ u: 0x1D538, l: 0x1D552 }),
      'Monospace': offset({ u: 0x1D670, l: 0x1D68A }), 'Sans Bold': offset({ u: 0x1D5D4, l: 0x1D5EE }),
      'Circled': (s) => [...s].map(c => /[a-z]/.test(c) ? String.fromCodePoint(0x24D0 + c.charCodeAt(0) - 97) : /[A-Z]/.test(c) ? String.fromCodePoint(0x24B6 + c.charCodeAt(0) - 65) : c).join(''),
      'Fullwidth': (s) => [...s].map(c => c === ' ' ? '　' : c.charCodeAt(0) >= 33 && c.charCodeAt(0) <= 126 ? String.fromCodePoint(c.charCodeAt(0) + 0xFEE0) : c).join(''),
      'Strike': (s) => [...s].map(c => c + '̶').join(''),
      'Upside down': (s) => { const m = "ɐqɔpǝɟƃɥᴉɾʞlɯuodbɹsʇnʌʍxʎz"; return [...s.toLowerCase()].map(c => /[a-z]/.test(c) ? m[c.charCodeAt(0) - 97] : c).reverse().join(''); },
    };
    const list = h('div', {});
    const input = h('input', { class: 'input', value: 'Hello World', oninput: render });
    function render() { list.innerHTML = ''; Object.entries(styles).forEach(([name, fn]) => { const v = fn(input.value); list.appendChild(h('div', { class: 'color-val', onclick: () => copy(v) }, h('span', { class: 'color-val__k', style: { minWidth: '110px' } }, name), h('span', { class: 'color-val__v' }, v), h('span', { class: 'color-val__copy' }, 'copy'))); }); }
    root.appendChild(toolShell(this, h('div', {}, h('div', { class: 'panel' }, field('Your text', input), list)))); render();
  },
};

/* ---------------- Morse Code ---------------- */
export const morseCode = {
  id: 'morse-code', name: 'Morse Code Translator', category: CAT, icon: ICONS.code,
  description: 'Translate text ↔ Morse code, with audio playback.',
  keywords: 'morse code translator text encode decode beep audio',
  render(root) {
    const M = { A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..', 0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.', '.': '.-.-.-', ',': '--..--', '?': '..--..', '!': '-.-.--', '/': '-..-.', '@': '.--.-.', ' ': '/' };
    const R = Object.fromEntries(Object.entries(M).map(([k, v]) => [v, k]));
    const ta = h('textarea', { class: 'input', rows: 4, value: 'SOS', oninput: enc });
    const out = h('div', { class: 'textpreview' });
    function enc() { out.textContent = [...ta.value.toUpperCase()].map(c => M[c] ?? '').join(' '); }
    function dec() { out.textContent = ta.value.trim().split(' ').map(c => R[c] ?? (c === '/' ? ' ' : '')).join(''); }
    async function play() {
      const code = out.textContent || [...ta.value.toUpperCase()].map(c => M[c] ?? '').join(' ');
      const ac = new (window.AudioContext || window.webkitAudioContext)(); let t = ac.currentTime; const u = 0.08;
      for (const sym of code) { if (sym === '.' || sym === '-') { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = 600; o.connect(g); g.connect(ac.destination); const d = sym === '.' ? u : u * 3; g.gain.setValueAtTime(0.3, t); o.start(t); o.stop(t + d); t += d + u; } else t += u * (sym === '/' ? 7 : 3); }
      setTimeout(() => ac.close(), (t - ac.currentTime + 0.5) * 1000);
    }
    root.appendChild(toolShell(this, h('div', {}, h('div', { class: 'panel' }, field('Text or Morse', ta),
      h('div', { class: 'panel__actions' }, h('button', { class: 'btn btn--primary', onclick: enc }, 'Text → Morse'), h('button', { class: 'btn', onclick: dec }, 'Morse → Text'), h('button', { class: 'btn', onclick: play }, '▶ Play sound')),
      out, h('div', { class: 'panel__actions' }, copyBtn(() => out.textContent)))))); enc();
  },
};

/* ---------------- JSON Formatter ---------------- */
export const jsonFormatter = {
  id: 'json-formatter', name: 'JSON Formatter', category: CAT, icon: ICONS.code,
  description: 'Beautify, validate or minify JSON with error reporting.',
  keywords: 'json formatter beautify validate minify pretty print lint',
  render(root) {
    const ta = h('textarea', { class: 'input mono', rows: 14, placeholder: '{"hello":"world"}', spellcheck: false });
    ta.value = '{"name":"toolkit","tools":23,"local":true}';
    const status = h('div', { class: 'calc-sub' }, '');
    function fmt(min) { try { const o = JSON.parse(ta.value); ta.value = JSON.stringify(o, null, min ? 0 : 2); status.textContent = '✓ Valid JSON'; status.style.color = '#41d18f'; } catch (e) { status.textContent = '✗ ' + e.message; status.style.color = '#ff6d6d'; } }
    root.appendChild(toolShell(this, h('div', {}, h('div', { class: 'panel' }, ta, status,
      h('div', { class: 'panel__actions' }, h('button', { class: 'btn btn--primary', onclick: () => fmt(false) }, 'Beautify'), h('button', { class: 'btn', onclick: () => fmt(true) }, 'Minify'), copyBtn(() => ta.value))))));
  },
};

/* ---------------- Text Diff ---------------- */
export const textDiff = {
  id: 'text-diff', name: 'Text Diff', category: CAT, icon: ICONS.code,
  description: 'Compare two texts line by line and highlight the differences.',
  keywords: 'diff compare text difference changes lines merge',
  render(root) {
    const a = h('textarea', { class: 'input mono', rows: 10, placeholder: 'Original text…' });
    const b = h('textarea', { class: 'input mono', rows: 10, placeholder: 'Changed text…' });
    const out = h('div', { class: 'diff-out' });
    function lcs(x, y) { const m = x.length, n = y.length; const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0)); for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) dp[i][j] = x[i] === y[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]); const res = []; let i = 0, j = 0; while (i < m && j < n) { if (x[i] === y[j]) { res.push(['=', x[i]]); i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) { res.push(['-', x[i++]]); } else { res.push(['+', y[j++]]); } } while (i < m) res.push(['-', x[i++]]); while (j < n) res.push(['+', y[j++]]); return res; }
    function run() { const diff = lcs(a.value.split('\n'), b.value.split('\n')); out.innerHTML = ''; diff.forEach(([t, line]) => out.appendChild(h('div', { class: 'diff-line diff-line--' + (t === '+' ? 'add' : t === '-' ? 'del' : 'same') }, (t === '=' ? '  ' : t + ' ') + line))); }
    root.appendChild(toolShell(this, h('div', {}, h('div', { class: 'panel' }, h('div', { class: 'grid-2' }, field('Original', a), field('Changed', b)),
      h('div', { class: 'panel__actions' }, h('button', { class: 'btn btn--primary', onclick: run }, 'Compare')), out))));
  },
};

/* ---------------- Markdown Editor ---------------- */
export const markdownEditor = {
  id: 'markdown-editor', name: 'Markdown Editor', category: CAT, icon: ICONS.doc,
  description: 'Write Markdown with live preview and export to HTML.',
  keywords: 'markdown editor preview html md write export',
  render(root) {
    const ta = h('textarea', { class: 'input mono', rows: 18, spellcheck: false, oninput: render });
    ta.value = '# Hello\n\nThis is **Markdown** with a [link](https://example.com).\n\n- item one\n- item two\n\n```\ncode block\n```';
    const preview = h('div', { class: 'md-preview' });
    let marked = null;
    async function render() {
      if (!marked) { try { marked = (await import('marked')).marked; } catch (e) { preview.textContent = 'Failed to load markdown engine.'; return; } }
      preview.innerHTML = marked.parse(ta.value);
    }
    const exportBtn = h('button', { class: 'btn btn--primary', onclick: () => downloadBlob(new Blob([`<!doctype html><meta charset=utf-8><body>${preview.innerHTML}`], { type: 'text/html' }), 'document.html') }, 'Export HTML');
    root.appendChild(toolShell(this, h('div', {}, h('div', { class: 'panel' }, h('div', { class: 'md-layout' }, ta, preview), h('div', { class: 'panel__actions' }, exportBtn, copyBtn(() => ta.value)))))); render();
  },
};

/* ---------------- ASCII Art ---------------- */
export const asciiArt = {
  id: 'ascii-art', name: 'Image to ASCII Art', category: CAT, icon: ICONS.code,
  description: 'Convert an image into text-based ASCII art.',
  keywords: 'ascii art image text convert characters retro',
  render(root) {
    let img = null, width = 100;
    const out = h('pre', { class: 'ascii-out' });
    const panel = h('div', { class: 'panel hidden' });
    const CHARS = '@%#*+=-:. ';
    function render() {
      if (!img) return;
      const w = width, hgt = Math.round(w * img.naturalHeight / img.naturalWidth * 0.5);
      const c = h('canvas', { width: w, height: hgt }); const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0, w, hgt);
      const d = ctx.getImageData(0, 0, w, hgt).data; let s = '';
      for (let y = 0; y < hgt; y++) { for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; const lum = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255; s += CHARS[Math.min(CHARS.length - 1, Math.floor((1 - lum) * CHARS.length))]; } s += '\n'; }
      out.textContent = s;
    }
    panel.append(rangeField('Width (chars)', { min: 40, max: 200, step: 10, value: width, onInput: v => { width = v; render(); } }), out,
      h('div', { class: 'panel__actions' }, copyBtn(() => out.textContent), h('button', { class: 'btn', onclick: () => downloadBlob(new Blob([out.textContent], { type: 'text/plain' }), 'ascii.txt') }, 'Download .txt')));
    const dz = Dropzone({ accept: 'image/*', onFiles: async fs => { img = await loadImage(URL.createObjectURL(fs[0])); panel.classList.remove('hidden'); render(); } });
    root.appendChild(toolShell(this, h('div', {}, dz, panel)));
  },
};

export default [loremIpsum, fancyText, morseCode, jsonFormatter, textDiff, markdownEditor, asciiArt];
