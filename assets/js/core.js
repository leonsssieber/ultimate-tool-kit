// core.js — shared helpers & UI components used by every tool.
// Everything here runs client-side. No data ever leaves the browser.

import JSZip from 'jszip';

/* ---------- tiny hyperscript helper ---------- */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class' || k === 'className') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') {
        el.addEventListener(k.slice(2).toLowerCase(), v);
      } else if (k === 'dataset' && typeof v === 'object') {
        Object.assign(el.dataset, v);
      } else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
  }
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    el.appendChild(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return el;
}

/* ---------- formatting ---------- */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i ? 1 : 0)} ${sizes[i]}`;
}

export function stripExt(name) {
  return name.replace(/\.[^/.]+$/, '');
}

/* ---------- downloads ---------- */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function zipAndDownload(files, zipName = 'toolkit-output.zip') {
  const zip = new JSZip();
  for (const f of files) zip.file(f.name, f.blob);
  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, zipName);
}

/* ---------- toast notifications ---------- */
export function toast(message, type = 'info') {
  let host = document.querySelector('.toast-host');
  if (!host) {
    host = h('div', { class: 'toast-host' });
    document.body.appendChild(host);
  }
  const t = h('div', { class: `toast toast--${type}` }, message);
  host.appendChild(t);
  requestAnimationFrame(() => t.classList.add('toast--show'));
  setTimeout(() => {
    t.classList.remove('toast--show');
    setTimeout(() => t.remove(), 300);
  }, type === 'error' ? 6000 : 3500);
}

/* ---------- dropzone component ---------- */
export function Dropzone({ accept = '*', multiple = false, onFiles, label } = {}) {
  const input = h('input', {
    type: 'file', accept, multiple, style: { display: 'none' },
    onchange: (e) => {
      const files = [...e.target.files];
      if (files.length) onFiles(files);
      input.value = '';
    },
  });

  const zone = h('div', { class: 'dropzone', tabindex: '0' },
    h('div', { class: 'dropzone__icon', html: ICONS.upload }),
    h('p', { class: 'dropzone__title' }, label || 'Drop files here or click to browse'),
    h('p', { class: 'dropzone__hint' }, multiple ? 'You can select multiple files' : 'Select a file'),
    input,
  );

  zone.addEventListener('click', () => input.click());
  zone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  ['dragenter', 'dragover'].forEach(ev => zone.addEventListener(ev, (e) => {
    e.preventDefault(); zone.classList.add('dropzone--over');
  }));
  ['dragleave', 'drop'].forEach(ev => zone.addEventListener(ev, (e) => {
    e.preventDefault(); zone.classList.remove('dropzone--over');
  }));
  zone.addEventListener('drop', (e) => {
    const files = [...e.dataTransfer.files];
    if (files.length) onFiles(multiple ? files : [files[0]]);
  });
  return zone;
}

/* ---------- progress / busy overlay scoped to a tool panel ---------- */
export function busy(container, message = 'Working…') {
  const bar = h('div', { class: 'progressbar' }, h('span', { class: 'progressbar__fill', style: { width: '0%' } }));
  const wrap = h('div', { class: 'busy' },
    h('div', { class: 'spinner' }),
    h('p', { class: 'busy__msg' }, message),
    bar,
  );
  container.appendChild(wrap);
  return {
    el: wrap,
    msg(m) { wrap.querySelector('.busy__msg').textContent = m; },
    progress(ratio) {
      const fill = wrap.querySelector('.progressbar__fill');
      if (ratio == null || isNaN(ratio)) { bar.style.display = 'none'; return; }
      bar.style.display = 'block';
      fill.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
    },
    done() { wrap.remove(); },
  };
}

/* ---------- standard tool layout ---------- */
export function toolShell(tool, bodyNode) {
  return h('div', { class: 'tool' },
    h('div', { class: 'tool__head' },
      h('div', { class: 'tool__icon', html: tool.icon }),
      h('div', {},
        h('h1', { class: 'tool__title' }, tool.name),
        h('p', { class: 'tool__desc' }, tool.description),
      ),
    ),
    h('div', { class: 'privacy-note', html: `${ICONS.lock} <span>100% local — your files are processed on your device and never uploaded.</span>` }),
    bodyNode,
  );
}

/* ---------- result card ---------- */
export function resultCard({ title, blob, filename, previewUrl, isImage, extra }) {
  const card = h('div', { class: 'result' });
  if (previewUrl) {
    card.appendChild(isImage
      ? h('img', { class: 'result__preview result__preview--checker', src: previewUrl, alt: title })
      : h('div', { class: 'result__preview' }, h('div', { class: 'result__fileicon', html: ICONS.file })));
  }
  card.appendChild(h('div', { class: 'result__meta' },
    h('p', { class: 'result__name', title: filename }, filename),
    h('p', { class: 'result__size' }, formatBytes(blob.size)),
  ));
  if (extra) card.appendChild(extra);
  card.appendChild(h('button', {
    class: 'btn btn--primary result__dl',
    onclick: () => downloadBlob(blob, filename),
  }, h('span', { html: ICONS.download }), ' Download'));
  return card;
}

export function fileChip(file, onRemove) {
  return h('div', { class: 'chip' },
    h('span', { class: 'chip__name', title: file.name }, file.name),
    h('span', { class: 'chip__size' }, formatBytes(file.size)),
    onRemove ? h('button', { class: 'chip__x', title: 'Remove', onclick: onRemove, html: '&times;' }) : null,
  );
}

/* simple labelled control row */
export function field(labelText, control) {
  return h('label', { class: 'field' }, h('span', { class: 'field__label' }, labelText), control);
}

export function select(options, value, onChange) {
  const sel = h('select', { class: 'input', onchange: (e) => onChange(e.target.value) });
  for (const opt of options) {
    const o = typeof opt === 'string' ? { value: opt, label: opt } : opt;
    const node = h('option', { value: o.value }, o.label);
    if (o.value === value) node.selected = true;
    sel.appendChild(node);
  }
  return sel;
}

export function rangeField(labelText, { min, max, step, value, suffix = '', onInput }) {
  const out = h('output', {}, `${value}${suffix}`);
  const input = h('input', {
    type: 'range', class: 'range', min, max, step, value,
    oninput: (e) => { out.textContent = `${e.target.value}${suffix}`; onInput?.(parseFloat(e.target.value)); },
  });
  return h('label', { class: 'field' },
    h('span', { class: 'field__label' }, labelText, ' ', out),
    input,
  );
}

/* ---------- image helpers ---------- */
export function loadImage(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

export function canvasToBlob(canvas, type, quality) {
  return new Promise((res) => canvas.toBlob((b) => res(b), type, quality));
}

/* ---------- icon set (inline SVG, currentColor) ---------- */
export const ICONS = {
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.6-3.6a2 2 0 0 0-2.8 0L6 20"/></svg>',
  pdf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 13h1.5a1.5 1.5 0 0 1 0 3H9zM9 13v6"/><path d="M14 19v-6h1.5a1.5 1.5 0 0 1 0 3H14"/></svg>',
  audio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect x="2" y="6" width="14" height="12" rx="2"/></svg>',
  wand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m3 21 9-9"/><path d="M15 4V2M15 10V8M9.5 4.5 8 3M20.5 4.5 22 3M18 7h2M10 7h2"/><path d="m14 7 3 3"/></svg>',
  scissors: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>',
  tools: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z"/></svg>',
  doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><polyline points="15 2 15 7 20 7"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>',
  qr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM21 14v7M17 21h4"/></svg>',
};
