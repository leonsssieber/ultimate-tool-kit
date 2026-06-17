// weird.js — novelty *reversible* converters. All local.
// Core idea: pack a file/text (with its name + mime) into a byte blob, then carry
// those bytes inside a different medium (lossless WAV audio or a PNG image).
// Decoding reverses it exactly — image → audio → image returns the original file.
import {
  h, ICONS, Dropzone, toolShell, busy, resultCard, toast, downloadBlob, stripExt, loadImage, field,
} from '../core.js';

const CAT = 'Weird Converters';
const MAGIC = [0x53, 0x54, 0x4B, 0x31]; // "STK1"

/* ---------- pack / unpack (magic + name + mime + payload) ---------- */
function pack(payload, name, mime) {
  const enc = new TextEncoder();
  const nameB = enc.encode(name || 'file');
  const mimeB = enc.encode(mime || 'application/octet-stream');
  const out = new Uint8Array(4 + 2 + nameB.length + 2 + mimeB.length + 4 + payload.length);
  const dv = new DataView(out.buffer);
  let p = 0;
  out.set(MAGIC, 0); p = 4;
  dv.setUint16(p, nameB.length, true); p += 2; out.set(nameB, p); p += nameB.length;
  dv.setUint16(p, mimeB.length, true); p += 2; out.set(mimeB, p); p += mimeB.length;
  dv.setUint32(p, payload.length, true); p += 4; out.set(payload, p);
  return out;
}
function unpack(u8, start = 0) {
  if (!(u8[start] === MAGIC[0] && u8[start + 1] === MAGIC[1] && u8[start + 2] === MAGIC[2] && u8[start + 3] === MAGIC[3]))
    throw new Error('This file was not encoded by the Toolkit.');
  const dv = new DataView(u8.buffer, u8.byteOffset);
  let p = start + 4;
  const dec = new TextDecoder();
  const nameLen = dv.getUint16(p, true); p += 2; const name = dec.decode(u8.subarray(p, p + nameLen)); p += nameLen;
  const mimeLen = dv.getUint16(p, true); p += 2; const mime = dec.decode(u8.subarray(p, p + mimeLen)); p += mimeLen;
  const payLen = dv.getUint32(p, true); p += 4; const payload = u8.subarray(p, p + payLen);
  return { name, mime, payload };
}
function findMagic(u8) {
  for (let i = 0; i < u8.length - 4; i++)
    if (u8[i] === MAGIC[0] && u8[i + 1] === MAGIC[1] && u8[i + 2] === MAGIC[2] && u8[i + 3] === MAGIC[3]) return i;
  return -1;
}

/* ---------- WAV carrier (8-bit unsigned PCM = raw bytes) ---------- */
function bytesToWav(bytes, sampleRate = 8000) {
  const dataLen = bytes.length;
  const buf = new ArrayBuffer(44 + dataLen);
  const dv = new DataView(buf);
  let p = 0;
  const ws = s => { for (let i = 0; i < s.length; i++) dv.setUint8(p++, s.charCodeAt(i)); };
  const u32 = n => { dv.setUint32(p, n, true); p += 4; };
  const u16 = n => { dv.setUint16(p, n, true); p += 2; };
  ws('RIFF'); u32(36 + dataLen); ws('WAVE');
  ws('fmt '); u32(16); u16(1); u16(1); u32(sampleRate); u32(sampleRate); u16(1); u16(8);
  ws('data'); u32(dataLen);
  new Uint8Array(buf, 44).set(bytes);
  return new Blob([buf], { type: 'audio/wav' });
}
function wavToPacked(u8) {
  let off = (u8[44] === MAGIC[0] && u8[45] === MAGIC[1] && u8[46] === MAGIC[2] && u8[47] === MAGIC[3]) ? 44 : findMagic(u8);
  if (off < 0) throw new Error('No hidden data found — was this WAV re-compressed?');
  return unpack(u8, off);
}

/* ---------- PNG carrier (bytes in RGB channels, alpha fixed at 255) ---------- */
async function bytesToPngBlob(bytes) {
  const px = Math.ceil(bytes.length / 3);
  const side = Math.max(1, Math.ceil(Math.sqrt(px)));
  const canvas = h('canvas', { width: side, height: side });
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(side, side);
  const d = img.data;
  for (let i = 0; i < side * side; i++) {
    d[i * 4] = bytes[i * 3] || 0;
    d[i * 4 + 1] = bytes[i * 3 + 1] || 0;
    d[i * 4 + 2] = bytes[i * 3 + 2] || 0;
    d[i * 4 + 3] = 255; // opaque → no premultiplied-alpha corruption
  }
  ctx.putImageData(img, 0, 0);
  return new Promise(res => canvas.toBlob(res, 'image/png'));
}
async function pngToPacked(file) {
  const img = await loadImage(URL.createObjectURL(file));
  const canvas = h('canvas', { width: img.naturalWidth, height: img.naturalHeight });
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const out = new Uint8Array(Math.floor(d.length / 4) * 3);
  for (let i = 0; i < d.length / 4; i++) { out[i * 3] = d[i * 4]; out[i * 3 + 1] = d[i * 4 + 1]; out[i * 3 + 2] = d[i * 4 + 2]; }
  return unpack(out, 0);
}

/* ---------- generic single-file tool helper ---------- */
function fileTool({ id, name, description, keywords, accept, label, action, isText, textInput }) {
  return {
    id, name, category: CAT, icon: ICONS.shuffle, description, keywords,
    render(root) {
      let file = null;
      const out = h('div', { class: 'output' });
      const panel = h('div', { class: 'panel hidden' });
      const note = h('p', { class: 'hint' }, 'Round-trips are exact — but keep the encoded file as-is (don\'t re-compress it), or the hidden data is lost.');
      const run = async () => {
        out.innerHTML = '';
        const b = busy(out, 'Working…'); b.progress(null);
        try { await action({ file, out, textValue: textInput?.value }); }
        catch (e) { console.error(e); toast(e.message || 'Failed', 'error'); }
        finally { b.done(); }
      };
      if (textInput) {
        panel.classList.remove('hidden');
        panel.append(field('Your text / secret message', textInput), note, h('div', { class: 'panel__actions' }, h('button', { class: 'btn btn--primary', onclick: run }, label)));
        root.appendChild(toolShell(this, h('div', {}, panel, out)));
        return;
      }
      const dz = Dropzone({ accept, onFiles: fs => { file = fs[0]; panel.classList.remove('hidden'); } });
      panel.append(note, h('div', { class: 'panel__actions' }, h('button', { class: 'btn btn--primary', onclick: () => { if (!file) return toast('Add a file first', 'error'); run(); } }, label)));
      root.appendChild(toolShell(this, h('div', {}, dz, panel, out)));
    },
  };
}

function showResult(out, blob, filename, isImage, extra) {
  out.innerHTML = '';
  out.appendChild(resultCard({ title: filename, blob, filename, previewUrl: isImage ? URL.createObjectURL(blob) : 'x', isImage, extra }));
}

/* ---------------- Image → Audio ---------------- */
export const imageToAudio = fileTool({
  id: 'image-to-audio', name: 'Image → Audio', accept: 'image/*', label: 'Turn into sound',
  description: 'Convert a picture into a WAV file. Play it and it sounds like static!',
  keywords: 'image to audio sound wav weird encode picture to sound reversible',
  action: async ({ file, out }) => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const blob = bytesToWav(pack(bytes, file.name, file.type));
    const audio = h('audio', { controls: true, class: 'webcam', src: URL.createObjectURL(blob) });
    showResult(out, blob, `${stripExt(file.name)}.wav`, false, audio);
    toast('Encoded to audio — convert it back with “Audio → Image”', 'success');
  },
});

/* ---------------- Audio → Image ---------------- */
export const audioToImage = fileTool({
  id: 'audio-to-image', name: 'Audio → Image', accept: 'audio/wav,.wav', label: 'Turn back into image',
  description: 'Decode a WAV made by “Image → Audio” back into the exact original image.',
  keywords: 'audio to image decode wav back picture reversible sound to image',
  action: async ({ file, out }) => {
    const { name, mime, payload } = wavToPacked(new Uint8Array(await file.arrayBuffer()));
    const blob = new Blob([payload], { type: mime });
    showResult(out, blob, name, (mime || '').startsWith('image/'));
    toast('Recovered ' + name, 'success');
  },
});

/* ---------------- File → Image ---------------- */
export const fileToImage = fileTool({
  id: 'file-to-image', name: 'Any File → Image', accept: '*', label: 'Hide inside a PNG',
  description: 'Pack ANY file losslessly into a PNG image (a colorful noise pattern).',
  keywords: 'file to image png encode hide steganography any reversible',
  action: async ({ file, out }) => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const blob = await bytesToPngBlob(pack(bytes, file.name, file.type));
    showResult(out, blob, `${stripExt(file.name)}.png`, true);
    toast('Packed into a PNG — extract it with “Image → File”', 'success');
  },
});

/* ---------------- Image → File ---------------- */
export const imageToFile = fileTool({
  id: 'image-to-file', name: 'Image → Any File', accept: 'image/png,.png', label: 'Extract hidden file',
  description: 'Extract the original file from a PNG created by “Any File → Image”.',
  keywords: 'image to file png decode extract unhide reversible',
  action: async ({ file, out }) => {
    const { name, mime, payload } = await pngToPacked(file);
    const blob = new Blob([payload], { type: mime });
    showResult(out, blob, name, (mime || '').startsWith('image/'));
    toast('Recovered ' + name, 'success');
  },
});

/* ---------------- Text → Image ---------------- */
export const textToImage = fileTool({
  id: 'text-to-image', name: 'Secret Text → Image', accept: '*', label: 'Hide message in PNG',
  textInput: h('textarea', { class: 'input', rows: 4, placeholder: 'Type a secret message…' }),
  description: 'Hide a secret text message inside a PNG image.',
  keywords: 'text to image secret message hide png encode reversible steganography',
  action: async ({ out, textValue }) => {
    if (!textValue) throw new Error('Type a message first');
    const bytes = new TextEncoder().encode(textValue);
    const blob = await bytesToPngBlob(pack(bytes, 'message.txt', 'text/plain'));
    showResult(out, blob, 'secret.png', true);
    toast('Message hidden — read it with “Image → Secret Text”', 'success');
  },
});

/* ---------------- Image → Text ---------------- */
export const imageToText = fileTool({
  id: 'image-to-text', name: 'Image → Secret Text', accept: 'image/png,.png', label: 'Reveal message',
  description: 'Reveal the secret text hidden in a PNG by “Secret Text → Image”.',
  keywords: 'image to text reveal secret message decode png reversible',
  action: async ({ file, out }) => {
    const { payload } = await pngToPacked(file);
    const text = new TextDecoder().decode(payload);
    out.innerHTML = '';
    out.appendChild(h('div', { class: 'panel' }, h('p', { class: 'field__label' }, 'Hidden message:'), h('pre', { class: 'textpreview' }, text || '(empty)')));
    toast('Revealed', 'success');
  },
});

export default [imageToAudio, audioToImage, fileToImage, imageToFile, textToImage, imageToText];
