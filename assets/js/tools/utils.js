// utils.js — handy everyday utilities. All local.
import QRCode from 'qrcode';
import {
  h, ICONS, Dropzone, toolShell, toast, downloadBlob, field, select, rangeField, resultCard, stripExt, busy,
} from '../core.js';

/* ---------------- QR Code Generator ---------------- */
export const qrGenerator = {
  id: 'qr-generator',
  name: 'QR Code Generator',
  category: 'Utilities',
  icon: ICONS.qr,
  description: 'Create a QR code from any text, URL, Wi-Fi or contact info.',
  keywords: 'qr code generator url wifi link barcode',
  render(root) {
    let text = '', size = 512, dark = '#000000', light = '#ffffff';
    const body = h('div', {});
    const canvas = h('canvas', { class: 'qr-canvas' });
    const out = h('div', { class: 'output' });

    async function regen() {
      if (!text.trim()) { canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height); return; }
      await QRCode.toCanvas(canvas, text, { width: size, margin: 2, color: { dark, light } });
    }

    const panel = h('div', { class: 'panel' },
      field('Content', h('textarea', { class: 'input', rows: 3, placeholder: 'https://example.com', oninput: e => { text = e.target.value; regen(); } })),
      h('div', { class: 'grid-2' },
        field('Foreground', h('input', { type: 'color', value: dark, oninput: e => { dark = e.target.value; regen(); } })),
        field('Background', h('input', { type: 'color', value: light, oninput: e => { light = e.target.value; regen(); } })),
      ),
      rangeField('Size', { min: 128, max: 1024, step: 64, value: size, suffix: ' px', onInput: v => { size = v; regen(); } }),
      h('div', { class: 'qr-wrap' }, canvas),
      h('div', { class: 'panel__actions' },
        h('button', { class: 'btn btn--primary', onclick: () => canvas.toBlob(b => b ? downloadBlob(b, 'qr.png') : toast('Enter content first', 'error')) }, 'Download PNG'),
      ),
    );

    body.append(panel, out);
    root.appendChild(toolShell(this, body));
  },
};

/* ---------------- File → Base64 ---------------- */
export const base64Tool = {
  id: 'base64',
  name: 'Base64 Encode / Decode',
  category: 'Utilities',
  icon: ICONS.tools,
  description: 'Convert files or text to Base64 and back (data URIs included).',
  keywords: 'base64 encode decode data uri file text',
  render(root) {
    const body = h('div', {});
    const ta = h('textarea', { class: 'input', rows: 8, placeholder: 'Paste text or Base64 here…' });
    const fileInfo = h('p', { class: 'hint' });

    const panel = h('div', { class: 'panel' },
      h('div', { class: 'segmented' },
        h('button', { class: 'seg', onclick: () => encodeText() }, 'Encode text'),
        h('button', { class: 'seg', onclick: () => decodeText() }, 'Decode text'),
      ),
      ta,
      h('div', { class: 'panel__actions' },
        h('button', { class: 'btn', onclick: () => { navigator.clipboard.writeText(ta.value); toast('Copied', 'success'); } }, 'Copy'),
      ),
      h('hr', { class: 'sep' }),
      h('p', { class: 'field__label' }, 'Or encode a file to a Base64 data URI:'),
      Dropzone({ onFiles: encodeFile, label: 'Drop a file to Base64-encode' }),
      fileInfo,
    );

    function encodeText() { try { ta.value = btoa(unescape(encodeURIComponent(ta.value))); } catch { toast('Cannot encode', 'error'); } }
    function decodeText() { try { ta.value = decodeURIComponent(escape(atob(ta.value.trim()))); } catch { toast('Invalid Base64', 'error'); } }
    function encodeFile(fs) {
      const f = fs[0];
      const reader = new FileReader();
      reader.onload = () => { ta.value = reader.result; fileInfo.textContent = `${f.name} → ${reader.result.length.toLocaleString()} chars`; };
      reader.readAsDataURL(f);
    }

    body.append(panel);
    root.appendChild(toolShell(this, body));
  },
};

/* ---------------- Hash Generator ---------------- */
export const hashTool = {
  id: 'hash',
  name: 'Hash / Checksum',
  category: 'Utilities',
  icon: ICONS.lock,
  description: 'Generate SHA-1/256/384/512 hashes of text or files.',
  keywords: 'hash checksum sha sha256 md5 verify integrity',
  render(root) {
    const body = h('div', {});
    let algo = 'SHA-256';
    const ta = h('textarea', { class: 'input', rows: 4, placeholder: 'Type text to hash…', oninput: () => hashText() });
    const result = h('pre', { class: 'textpreview' }, '—');

    async function digest(buf) {
      const hash = await crypto.subtle.digest(algo, buf);
      return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
    }
    async function hashText() {
      if (!ta.value) { result.textContent = '—'; return; }
      result.textContent = await digest(new TextEncoder().encode(ta.value));
    }
    async function hashFile(fs) {
      result.textContent = 'Hashing…';
      result.textContent = await digest(await fs[0].arrayBuffer());
    }

    const panel = h('div', { class: 'panel' },
      field('Algorithm', select(['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'], algo, v => { algo = v; hashText(); })),
      ta,
      Dropzone({ onFiles: hashFile, label: 'Or drop a file to hash it' }),
      h('p', { class: 'field__label' }, 'Result:'),
      result,
      h('div', { class: 'panel__actions' }, h('button', { class: 'btn', onclick: () => { navigator.clipboard.writeText(result.textContent); toast('Copied', 'success'); } }, 'Copy')),
    );

    body.append(panel);
    root.appendChild(toolShell(this, body));
  },
};

/* ---------------- Text Tools ---------------- */
export const textTools = {
  id: 'text-tools',
  name: 'Text Tools',
  category: 'Utilities',
  icon: ICONS.doc,
  description: 'Word/char count, case conversion, remove blank lines, and more.',
  keywords: 'text count words case upper lower sort trim clean',
  render(root) {
    const body = h('div', {});
    const ta = h('textarea', { class: 'input', rows: 8, placeholder: 'Paste your text…', oninput: stats });
    const counts = h('div', { class: 'stats' });

    function stats() {
      const t = ta.value;
      const words = (t.trim().match(/\S+/g) || []).length;
      counts.innerHTML = '';
      [['Characters', t.length], ['Words', words], ['Lines', t ? t.split('\n').length : 0], ['Sentences', (t.match(/[.!?]+/g) || []).length]]
        .forEach(([k, v]) => counts.appendChild(h('div', { class: 'stat' }, h('span', { class: 'stat__num' }, String(v)), h('span', { class: 'stat__label' }, k))));
    }
    const apply = fn => () => { ta.value = fn(ta.value); stats(); };

    const panel = h('div', { class: 'panel' },
      ta,
      counts,
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn', onclick: apply(t => t.toUpperCase()) }, 'UPPER'),
        h('button', { class: 'btn', onclick: apply(t => t.toLowerCase()) }, 'lower'),
        h('button', { class: 'btn', onclick: apply(t => t.replace(/\w\S*/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase())) }, 'Title Case'),
        h('button', { class: 'btn', onclick: apply(t => t.split('\n').filter(l => l.trim()).join('\n')) }, 'Remove blank lines'),
        h('button', { class: 'btn', onclick: apply(t => t.split('\n').map(l => l.trim()).join('\n')) }, 'Trim lines'),
        h('button', { class: 'btn', onclick: apply(t => [...new Set(t.split('\n'))].join('\n')) }, 'Dedupe lines'),
        h('button', { class: 'btn', onclick: apply(t => t.split('\n').sort().join('\n')) }, 'Sort A→Z'),
        h('button', { class: 'btn', onclick: apply(t => t.split('').reverse().join('')) }, 'Reverse'),
      ),
      h('div', { class: 'panel__actions' }, h('button', { class: 'btn btn--primary', onclick: () => { navigator.clipboard.writeText(ta.value); toast('Copied', 'success'); } }, 'Copy result')),
    );
    stats();
    body.append(panel);
    root.appendChild(toolShell(this, body));
  },
};

export default [qrGenerator, base64Tool, hashTool, textTools];
