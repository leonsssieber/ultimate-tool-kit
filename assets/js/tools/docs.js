// docs.js — Word document conversions. Fully local.
import mammoth from 'mammoth';
import {
  h, ICONS, Dropzone, toolShell, busy, resultCard, toast, stripExt, downloadBlob,
} from '../core.js';

/* ---------------- Word → PDF ---------------- */
export const wordToPdf = {
  id: 'word-to-pdf',
  name: 'Word → PDF',
  category: 'Documents',
  icon: ICONS.doc,
  description: 'Convert a .docx file to PDF (text, headings, lists, images, tables).',
  keywords: 'word docx to pdf document convert office',
  render(root) {
    let file = null;
    const body = h('div', {});
    const out = h('div', { class: 'output' });
    const panel = h('div', { class: 'panel hidden' });
    panel.append(
      h('p', { class: 'hint' }, 'Best for standard documents. Very complex layouts may shift slightly.'),
      h('div', { class: 'panel__actions' }, h('button', { class: 'btn btn--primary', onclick: run }, 'Convert to PDF')),
    );
    const dz = Dropzone({ accept: '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document', onFiles: fs => { file = fs[0]; panel.classList.remove('hidden'); } });

    async function run() {
      if (!file) return toast('Add a .docx file', 'error');
      out.innerHTML = '';
      const b = busy(out, 'Reading document…'); b.progress(null);
      try {
        const { value: html } = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
        b.msg('Rendering PDF…');
        const html2pdf = (await import('html2pdf.js')).default;
        const container = h('div', { class: 'docx-render', html: `<style>
          .docx-render{font-family:Georgia,'Times New Roman',serif;color:#111;line-height:1.5;font-size:12pt;}
          .docx-render h1{font-size:20pt;margin:.6em 0 .3em} .docx-render h2{font-size:16pt;margin:.6em 0 .3em}
          .docx-render h3{font-size:13pt} .docx-render p{margin:.4em 0}
          .docx-render table{border-collapse:collapse;width:100%} .docx-render td,.docx-render th{border:1px solid #999;padding:6px}
          .docx-render img{max-width:100%}
        </style>${html}` });
        container.style.cssText = 'width:794px;padding:48px;background:#fff;position:fixed;left:-9999px;top:0;';
        document.body.appendChild(container);
        const worker = html2pdf().set({
          margin: [10, 10, 10, 10],
          filename: `${stripExt(file.name)}.pdf`,
          image: { type: 'jpeg', quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['css', 'legacy'] },
        }).from(container);
        const blob = await worker.outputPdf('blob');
        container.remove();
        b.done();
        out.appendChild(resultCard({ title: 'PDF', blob, filename: `${stripExt(file.name)}.pdf`, previewUrl: 'x', isImage: false }));
        toast('Converted to PDF', 'success');
      } catch (e) { console.error(e); b.done(); toast('Failed: ' + e.message, 'error'); }
    }

    body.append(dz, panel, out);
    root.appendChild(toolShell(this, body));
  },
};

/* ---------------- Word → HTML / Text ---------------- */
export const wordToText = {
  id: 'word-to-text',
  name: 'Word → Text / HTML',
  category: 'Documents',
  icon: ICONS.doc,
  description: 'Extract clean text or HTML from a .docx file.',
  keywords: 'word docx to text html extract content plain',
  render(root) {
    let file = null, mode = 'text';
    const body = h('div', {});
    const out = h('div', { class: 'output' });
    const panel = h('div', { class: 'panel hidden' });
    panel.append(
      h('div', { class: 'segmented' },
        h('button', { class: 'seg seg--on', onclick: e => setMode('text', e) }, 'Plain text'),
        h('button', { class: 'seg', onclick: e => setMode('html', e) }, 'HTML'),
      ),
      h('div', { class: 'panel__actions' }, h('button', { class: 'btn btn--primary', onclick: run }, 'Extract')),
    );
    function setMode(m, e) { mode = m; panel.querySelectorAll('.seg').forEach(s => s.classList.remove('seg--on')); e.target.classList.add('seg--on'); }
    const dz = Dropzone({ accept: '.docx', onFiles: fs => { file = fs[0]; panel.classList.remove('hidden'); } });

    async function run() {
      if (!file) return toast('Add a .docx file', 'error');
      out.innerHTML = '';
      const b = busy(out, 'Extracting…'); b.progress(null);
      try {
        const ab = await file.arrayBuffer();
        let content, ext, type;
        if (mode === 'html') { content = (await mammoth.convertToHtml({ arrayBuffer: ab })).value; ext = 'html'; type = 'text/html'; }
        else { content = (await mammoth.extractRawText({ arrayBuffer: ab })).value; ext = 'txt'; type = 'text/plain'; }
        const blob = new Blob([content], { type });
        b.done();
        out.appendChild(resultCard({ title: ext, blob, filename: `${stripExt(file.name)}.${ext}`, previewUrl: 'x', isImage: false }));
        out.appendChild(h('pre', { class: 'textpreview' }, content.slice(0, 4000) + (content.length > 4000 ? '\n…' : '')));
        toast('Extracted', 'success');
      } catch (e) { console.error(e); b.done(); toast('Failed: ' + e.message, 'error'); }
    }

    body.append(dz, panel, out);
    root.appendChild(toolShell(this, body));
  },
};

export default [wordToPdf, wordToText];
