// pdf.js — PDF tools using pdf-lib (write) and pdfjs-dist (render). Fully local.
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import {
  h, ICONS, Dropzone, toolShell, busy, resultCard, toast, field, select, rangeField,
  downloadBlob, zipAndDownload, stripExt, fileChip, loadImage,
} from '../core.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.7.76/build/pdf.worker.min.mjs';

/* ---------------- Images → PDF ---------------- */
export const imagesToPdf = {
  id: 'images-to-pdf',
  name: 'Images → PDF',
  category: 'PDF',
  icon: ICONS.pdf,
  description: 'Combine JPG/PNG images into a single PDF, in your chosen order.',
  keywords: 'image jpg png to pdf combine merge photos document',
  render(root) {
    let files = [];
    let pageSize = 'fit', orientation = 'auto';
    const body = h('div', {});
    const out = h('div', { class: 'output' });
    const list = h('div', { class: 'chips chips--ordered' });
    const panel = h('div', { class: 'panel hidden' });

    function renderList() {
      list.innerHTML = '';
      files.forEach((f, i) => {
        const chip = fileChip(f, () => { files.splice(i, 1); renderList(); if (!files.length) panel.classList.add('hidden'); });
        if (i > 0) chip.prepend(h('button', { class: 'chip__move', title: 'Move up', onclick: () => { [files[i - 1], files[i]] = [files[i], files[i - 1]]; renderList(); }, html: '↑' }));
        list.appendChild(chip);
      });
    }

    panel.append(
      field('Page size', select([{ value: 'fit', label: 'Fit to image' }, { value: 'a4', label: 'A4' }, { value: 'letter', label: 'US Letter' }], pageSize, v => pageSize = v)),
      list,
      h('div', { class: 'panel__actions' }, h('button', { class: 'btn btn--primary', onclick: run }, 'Create PDF')),
    );

    const dz = Dropzone({ accept: 'image/png,image/jpeg', multiple: true, onFiles: fs => { files.push(...fs); renderList(); panel.classList.remove('hidden'); } });

    async function run() {
      if (!files.length) return toast('Add images', 'error');
      out.innerHTML = '';
      const b = busy(out, 'Building PDF…');
      try {
        const pdf = await PDFDocument.create();
        for (let i = 0; i < files.length; i++) {
          b.progress(i / files.length);
          const bytes = new Uint8Array(await files[i].arrayBuffer());
          let img;
          if (files[i].type === 'image/png') img = await pdf.embedPng(bytes);
          else img = await pdf.embedJpg(bytes);
          let pw, ph;
          if (pageSize === 'a4') { pw = 595.28; ph = 841.89; }
          else if (pageSize === 'letter') { pw = 612; ph = 792; }
          else { pw = img.width; ph = img.height; }
          const page = pdf.addPage([pw, ph]);
          const scale = pageSize === 'fit' ? 1 : Math.min(pw / img.width, ph / img.height);
          const dw = img.width * scale, dh = img.height * scale;
          page.drawImage(img, { x: (pw - dw) / 2, y: (ph - dh) / 2, width: dw, height: dh });
        }
        const blob = new Blob([await pdf.save()], { type: 'application/pdf' });
        b.done();
        out.appendChild(resultCard({ title: 'PDF', blob, filename: 'images.pdf', previewUrl: 'x', isImage: false }));
        toast('PDF created', 'success');
      } catch (e) { console.error(e); b.done(); toast('Failed: ' + e.message, 'error'); }
    }

    body.append(dz, panel, out);
    root.appendChild(toolShell(this, body));
  },
};

/* ---------------- PDF → Images ---------------- */
export const pdfToImages = {
  id: 'pdf-to-images',
  name: 'PDF → Images',
  category: 'PDF',
  icon: ICONS.pdf,
  description: 'Render each page of a PDF to a PNG or JPG image.',
  keywords: 'pdf to image png jpg export pages render',
  render(root) {
    let file = null, format = 'png', scale = 2;
    const body = h('div', {});
    const out = h('div', { class: 'output' });
    const panel = h('div', { class: 'panel hidden' });

    panel.append(
      field('Format', select([{ value: 'png', label: 'PNG' }, { value: 'jpg', label: 'JPG' }], format, v => format = v)),
      rangeField('Resolution', { min: 1, max: 4, step: 0.5, value: scale, suffix: '×', onInput: v => scale = v }),
      h('div', { class: 'panel__actions' }, h('button', { class: 'btn btn--primary', onclick: run }, 'Convert pages')),
    );

    const dz = Dropzone({ accept: 'application/pdf', onFiles: fs => { file = fs[0]; panel.classList.remove('hidden'); } });

    async function run() {
      if (!file) return toast('Add a PDF', 'error');
      out.innerHTML = '';
      const b = busy(out, 'Rendering pages…');
      try {
        const data = new Uint8Array(await file.arrayBuffer());
        const doc = await pdfjsLib.getDocument({ data }).promise;
        const imgs = [];
        for (let p = 1; p <= doc.numPages; p++) {
          b.msg(`Rendering page ${p}/${doc.numPages}…`); b.progress(p / doc.numPages);
          const page = await doc.getPage(p);
          const viewport = page.getViewport({ scale });
          const canvas = h('canvas', { width: viewport.width, height: viewport.height });
          await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
          const mime = format === 'png' ? 'image/png' : 'image/jpeg';
          const blob = await new Promise(r => canvas.toBlob(r, mime, 0.92));
          imgs.push({ name: `${stripExt(file.name)}-p${String(p).padStart(2, '0')}.${format}`, blob });
        }
        b.done();
        if (imgs.length > 1) {
          out.appendChild(h('div', { class: 'panel__actions' }, h('button', { class: 'btn btn--primary', onclick: () => zipAndDownload(imgs, `${stripExt(file.name)}-pages.zip`) }, `Download all ${imgs.length} as ZIP`)));
        }
        imgs.forEach(im => out.appendChild(resultCard({ title: im.name, blob: im.blob, filename: im.name, previewUrl: URL.createObjectURL(im.blob), isImage: true })));
        toast(`${imgs.length} page(s) rendered`, 'success');
      } catch (e) { console.error(e); b.done(); toast('Failed: ' + e.message, 'error'); }
    }

    body.append(dz, panel, out);
    root.appendChild(toolShell(this, body));
  },
};

/* ---------------- Merge PDFs ---------------- */
export const mergePdf = {
  id: 'merge-pdf',
  name: 'Merge PDFs',
  category: 'PDF',
  icon: ICONS.pdf,
  description: 'Join multiple PDF files into one document.',
  keywords: 'merge combine join pdf documents',
  render(root) {
    let files = [];
    const body = h('div', {});
    const out = h('div', { class: 'output' });
    const list = h('div', { class: 'chips chips--ordered' });
    const panel = h('div', { class: 'panel hidden' });

    function renderList() {
      list.innerHTML = '';
      files.forEach((f, i) => {
        const chip = fileChip(f, () => { files.splice(i, 1); renderList(); if (!files.length) panel.classList.add('hidden'); });
        if (i > 0) chip.prepend(h('button', { class: 'chip__move', title: 'Move up', onclick: () => { [files[i - 1], files[i]] = [files[i], files[i - 1]]; renderList(); }, html: '↑' }));
        list.appendChild(chip);
      });
    }

    panel.append(list, h('div', { class: 'panel__actions' }, h('button', { class: 'btn btn--primary', onclick: run }, 'Merge')));
    const dz = Dropzone({ accept: 'application/pdf', multiple: true, onFiles: fs => { files.push(...fs); renderList(); panel.classList.remove('hidden'); } });

    async function run() {
      if (files.length < 2) return toast('Add at least two PDFs', 'error');
      out.innerHTML = '';
      const b = busy(out, 'Merging…');
      try {
        const merged = await PDFDocument.create();
        for (let i = 0; i < files.length; i++) {
          b.progress(i / files.length);
          const src = await PDFDocument.load(await files[i].arrayBuffer());
          const pages = await merged.copyPages(src, src.getPageIndices());
          pages.forEach(p => merged.addPage(p));
        }
        const blob = new Blob([await merged.save()], { type: 'application/pdf' });
        b.done();
        out.appendChild(resultCard({ title: 'merged', blob, filename: 'merged.pdf', previewUrl: 'x', isImage: false }));
        toast('Merged', 'success');
      } catch (e) { console.error(e); b.done(); toast('Failed: ' + e.message, 'error'); }
    }

    body.append(dz, panel, out);
    root.appendChild(toolShell(this, body));
  },
};

/* ---------------- Split PDF ---------------- */
export const splitPdf = {
  id: 'split-pdf',
  name: 'Split / Extract PDF',
  category: 'PDF',
  icon: ICONS.scissors,
  description: 'Extract a page range or split a PDF into individual pages.',
  keywords: 'split extract pages range separate pdf divide',
  render(root) {
    let file = null, mode = 'range', range = '';
    const body = h('div', {});
    const out = h('div', { class: 'output' });
    const panel = h('div', { class: 'panel hidden' });
    const rangeInput = h('input', { class: 'input', placeholder: 'e.g. 1-3, 5, 8-10', oninput: e => range = e.target.value });
    const rangeRow = field('Pages to extract', rangeInput);

    panel.append(
      field('Mode', select([{ value: 'range', label: 'Extract page range' }, { value: 'each', label: 'Split every page into its own PDF' }], mode, v => { mode = v; rangeRow.style.display = v === 'range' ? '' : 'none'; })),
      rangeRow,
      h('div', { class: 'panel__actions' }, h('button', { class: 'btn btn--primary', onclick: run }, 'Split')),
    );

    const dz = Dropzone({ accept: 'application/pdf', onFiles: fs => { file = fs[0]; panel.classList.remove('hidden'); } });

    function parseRange(str, max) {
      const set = new Set();
      str.split(',').forEach(part => {
        part = part.trim(); if (!part) return;
        if (part.includes('-')) { let [a, b] = part.split('-').map(n => parseInt(n)); for (let i = a; i <= b; i++) if (i >= 1 && i <= max) set.add(i - 1); }
        else { const n = parseInt(part); if (n >= 1 && n <= max) set.add(n - 1); }
      });
      return [...set].sort((a, b) => a - b);
    }

    async function run() {
      if (!file) return toast('Add a PDF', 'error');
      out.innerHTML = '';
      const b = busy(out, 'Splitting…');
      try {
        const src = await PDFDocument.load(await file.arrayBuffer());
        const total = src.getPageCount();
        if (mode === 'range') {
          const idx = parseRange(range, total);
          if (!idx.length) { b.done(); return toast('Enter a valid range (1-' + total + ')', 'error'); }
          const dst = await PDFDocument.create();
          const pages = await dst.copyPages(src, idx);
          pages.forEach(p => dst.addPage(p));
          const blob = new Blob([await dst.save()], { type: 'application/pdf' });
          b.done();
          out.appendChild(resultCard({ title: 'extracted', blob, filename: `${stripExt(file.name)}-extract.pdf`, previewUrl: 'x', isImage: false }));
        } else {
          const outputs = [];
          for (let i = 0; i < total; i++) {
            b.progress(i / total);
            const dst = await PDFDocument.create();
            const [pg] = await dst.copyPages(src, [i]);
            dst.addPage(pg);
            outputs.push({ name: `${stripExt(file.name)}-p${String(i + 1).padStart(2, '0')}.pdf`, blob: new Blob([await dst.save()], { type: 'application/pdf' }) });
          }
          b.done();
          out.appendChild(h('div', { class: 'panel__actions' }, h('button', { class: 'btn btn--primary', onclick: () => zipAndDownload(outputs, `${stripExt(file.name)}-split.zip`) }, `Download all ${outputs.length} as ZIP`)));
          outputs.forEach(o => out.appendChild(resultCard({ title: o.name, blob: o.blob, filename: o.name, previewUrl: 'x', isImage: false })));
        }
        toast('Done', 'success');
      } catch (e) { console.error(e); b.done(); toast('Failed: ' + e.message, 'error'); }
    }

    body.append(dz, panel, out);
    root.appendChild(toolShell(this, body));
  },
};

/* ---------------- PDF → Text ---------------- */
export const pdfToText = {
  id: 'pdf-to-text',
  name: 'PDF → Text',
  category: 'PDF',
  icon: ICONS.doc,
  description: 'Extract all selectable text from a PDF into a .txt file.',
  keywords: 'pdf to text extract copy txt content read',
  render(root) {
    let file = null;
    const body = h('div', {});
    const out = h('div', { class: 'output' });
    const panel = h('div', { class: 'panel hidden' });
    panel.append(h('p', { class: 'hint' }, 'Works on PDFs with real text. Scanned/image PDFs won\'t have selectable text.'),
      h('div', { class: 'panel__actions' }, h('button', { class: 'btn btn--primary', onclick: run }, 'Extract text')));
    const dz = Dropzone({ accept: 'application/pdf', onFiles: fs => { file = fs[0]; panel.classList.remove('hidden'); } });

    async function run() {
      if (!file) return toast('Add a PDF', 'error');
      out.innerHTML = '';
      const b = busy(out, 'Extracting…');
      try {
        const doc = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
        let text = '';
        for (let p = 1; p <= doc.numPages; p++) {
          b.progress(p / doc.numPages);
          const page = await doc.getPage(p);
          const content = await page.getTextContent();
          text += content.items.map(it => it.str).join(' ') + '\n\n';
        }
        const blob = new Blob([text], { type: 'text/plain' });
        b.done();
        out.appendChild(resultCard({ title: 'text', blob, filename: `${stripExt(file.name)}.txt`, previewUrl: 'x', isImage: false }));
        out.appendChild(h('pre', { class: 'textpreview' }, text.slice(0, 4000) + (text.length > 4000 ? '\n…' : '')));
        toast('Text extracted', 'success');
      } catch (e) { console.error(e); b.done(); toast('Failed: ' + e.message, 'error'); }
    }

    body.append(dz, panel, out);
    root.appendChild(toolShell(this, body));
  },
};

export default [imagesToPdf, pdfToImages, mergePdf, splitPdf, pdfToText];
