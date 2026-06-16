// ai.js — AI background remover (runs an ONNX model fully in-browser via WASM).
import {
  h, ICONS, Dropzone, toolShell, busy, resultCard, toast, stripExt, fileChip, downloadBlob,
} from '../core.js';

export const bgRemover = {
  id: 'background-remover',
  name: 'AI Background Remover',
  category: 'AI & Effects',
  icon: ICONS.wand,
  description: 'Erase the background from any photo automatically — no green screen needed.',
  keywords: 'background remove erase cutout transparent subject ai remove bg',
  render(root) {
    let files = [];
    const body = h('div', {});
    const out = h('div', { class: 'output' });
    const list = h('div', { class: 'chips' });
    const panel = h('div', { class: 'panel hidden' });

    function renderList() {
      list.innerHTML = '';
      files.forEach((f, i) => list.appendChild(fileChip(f, () => { files.splice(i, 1); renderList(); if (!files.length) panel.classList.add('hidden'); })));
    }

    panel.append(
      h('p', { class: 'hint' }, 'First run downloads the AI model (~40 MB). After that it works offline and instantly.'),
      list,
      h('div', { class: 'panel__actions' }, h('button', { class: 'btn btn--primary', onclick: run }, 'Remove background')),
    );

    const dz = Dropzone({
      accept: 'image/*', multiple: true,
      onFiles: (fs) => { files.push(...fs); renderList(); panel.classList.remove('hidden'); },
    });

    async function run() {
      if (!files.length) return toast('Add an image', 'error');
      out.innerHTML = '';
      const b = busy(out, 'Loading AI model…'); b.progress(null);
      let removeBackground;
      try {
        ({ removeBackground } = await import('@imgly/background-removal'));
      } catch (e) {
        console.error(e); b.done();
        return toast('Could not load the AI library (check your connection).', 'error');
      }
      const results = [];
      try {
        for (let i = 0; i < files.length; i++) {
          b.msg(`Processing ${i + 1}/${files.length}… (first run is slower)`);
          const blob = await removeBackground(files[i], {
            progress: (key, current, total) => {
              if (total) b.progress(current / total);
              if (key && key.includes('fetch')) b.msg('Downloading AI model…');
              else b.msg(`Processing ${i + 1}/${files.length}…`);
            },
            output: { format: 'image/png' },
          });
          results.push({ blob, name: `${stripExt(files[i].name)}-no-bg.png` });
        }
      } catch (e) {
        console.error(e); b.done();
        return toast('Background removal failed: ' + e.message, 'error');
      }
      b.done();
      results.forEach(r => out.appendChild(resultCard({
        title: r.name, blob: r.blob, filename: r.name,
        previewUrl: URL.createObjectURL(r.blob), isImage: true,
      })));
      toast('Background removed', 'success');
    }

    body.append(dz, panel, out);
    root.appendChild(toolShell(this, body));
  },
};

export default [bgRemover];
