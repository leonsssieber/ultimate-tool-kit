// data.js — data format converters (CSV / JSON / YAML / Excel). All local.
import {
  h, ICONS, toolShell, field, select, toast, downloadBlob, Dropzone, busy, resultCard, stripExt,
} from '../core.js';

const CAT = 'Data';
const copy = (t) => { navigator.clipboard.writeText(t); toast('Copied', 'success'); };

/* tiny CSV parser supporting quotes */
function parseCSV(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c === '\r') { /* skip */ }
    else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.length && !(r.length === 1 && r[0] === ''));
}
function toCSV(rows) {
  return rows.map(r => r.map(v => {
    v = v == null ? '' : String(v);
    return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }).join(',')).join('\n');
}

/* ---------------- CSV → JSON ---------------- */
export const csvToJson = {
  id: 'csv-to-json', name: 'CSV → JSON', category: CAT, icon: ICONS.code,
  description: 'Turn CSV (with a header row) into a JSON array of objects.',
  keywords: 'csv to json convert data table objects parse',
  render(root) {
    const ta = h('textarea', { class: 'input mono', rows: 7, value: 'name,age,city\nAda,36,London\nLin,29,Berlin' });
    const out = h('div', { class: 'textpreview' }, '—');
    function run() {
      const rows = parseCSV(ta.value); if (!rows.length) return toast('No data', 'error');
      const head = rows[0]; const arr = rows.slice(1).map(r => Object.fromEntries(head.map((k, i) => [k, r[i] ?? ''])));
      out.textContent = JSON.stringify(arr, null, 2);
    }
    root.appendChild(toolShell(this, h('div', {}, h('div', { class: 'panel' }, field('CSV (first row = headers)', ta),
      h('div', { class: 'panel__actions' }, h('button', { class: 'btn btn--primary', onclick: run }, 'Convert'), h('button', { class: 'btn', onclick: () => copy(out.textContent) }, 'Copy'),
        h('button', { class: 'btn', onclick: () => downloadBlob(new Blob([out.textContent], { type: 'application/json' }), 'data.json') }, 'Download .json')), out)))); run();
  },
};

/* ---------------- JSON → CSV ---------------- */
export const jsonToCsv = {
  id: 'json-to-csv', name: 'JSON → CSV', category: CAT, icon: ICONS.code,
  description: 'Turn a JSON array of objects into CSV.',
  keywords: 'json to csv convert data table export spreadsheet',
  render(root) {
    const ta = h('textarea', { class: 'input mono', rows: 7, value: '[{"name":"Ada","age":36},{"name":"Lin","age":29}]' });
    const out = h('div', { class: 'textpreview' }, '—');
    function run() {
      let data; try { data = JSON.parse(ta.value); } catch (e) { return toast('Invalid JSON: ' + e.message, 'error'); }
      if (!Array.isArray(data)) data = [data];
      const keys = [...new Set(data.flatMap(o => Object.keys(o || {})))];
      out.textContent = toCSV([keys, ...data.map(o => keys.map(k => o?.[k]))]);
    }
    root.appendChild(toolShell(this, h('div', {}, h('div', { class: 'panel' }, field('JSON array', ta),
      h('div', { class: 'panel__actions' }, h('button', { class: 'btn btn--primary', onclick: run }, 'Convert'), h('button', { class: 'btn', onclick: () => copy(out.textContent) }, 'Copy'),
        h('button', { class: 'btn', onclick: () => downloadBlob(new Blob([out.textContent], { type: 'text/csv' }), 'data.csv') }, 'Download .csv')), out)))); run();
  },
};

/* ---------------- JSON ↔ YAML ---------------- */
export const jsonYaml = {
  id: 'json-yaml', name: 'JSON ↔ YAML', category: CAT, icon: ICONS.code,
  description: 'Convert between JSON and YAML in either direction.',
  keywords: 'json yaml convert config data both directions',
  render(root) {
    const ta = h('textarea', { class: 'input mono', rows: 8, value: '{\n  "app": "toolkit",\n  "tools": 90,\n  "tags": ["local", "free"]\n}' });
    const out = h('div', { class: 'textpreview' }, '—');
    let yaml = null;
    async function lib() { if (!yaml) yaml = await import('js-yaml'); return yaml; }
    async function toYaml() { try { const y = await lib(); out.textContent = y.dump(JSON.parse(ta.value)); } catch (e) { toast('Invalid JSON: ' + e.message, 'error'); } }
    async function toJson() { try { const y = await lib(); out.textContent = JSON.stringify(y.load(ta.value), null, 2); } catch (e) { toast('Invalid YAML: ' + e.message, 'error'); } }
    root.appendChild(toolShell(this, h('div', {}, h('div', { class: 'panel' }, field('Input', ta),
      h('div', { class: 'panel__actions' }, h('button', { class: 'btn btn--primary', onclick: toYaml }, 'JSON → YAML'), h('button', { class: 'btn', onclick: toJson }, 'YAML → JSON'), h('button', { class: 'btn', onclick: () => copy(out.textContent) }, 'Copy')), out))));
  },
};

/* ---------------- CSV → Markdown table ---------------- */
export const csvToMarkdown = {
  id: 'csv-to-markdown', name: 'CSV → Markdown Table', category: CAT, icon: ICONS.doc,
  description: 'Convert CSV data into a GitHub-flavoured Markdown table.',
  keywords: 'csv markdown table convert github readme',
  render(root) {
    const ta = h('textarea', { class: 'input mono', rows: 6, value: 'Tool,Local,Free\nConverter,yes,yes\nEditor,yes,yes' });
    const out = h('div', { class: 'textpreview' }, '—');
    function run() {
      const rows = parseCSV(ta.value); if (!rows.length) return;
      const head = rows[0];
      let md = '| ' + head.join(' | ') + ' |\n| ' + head.map(() => '---').join(' | ') + ' |\n';
      md += rows.slice(1).map(r => '| ' + head.map((_, i) => (r[i] ?? '')).join(' | ') + ' |').join('\n');
      out.textContent = md;
    }
    root.appendChild(toolShell(this, h('div', {}, h('div', { class: 'panel' }, field('CSV', ta),
      h('div', { class: 'panel__actions' }, h('button', { class: 'btn btn--primary', onclick: run }, 'Convert'), h('button', { class: 'btn', onclick: () => copy(out.textContent) }, 'Copy')), out)))); run();
  },
};

/* ---------------- Number Base Converter ---------------- */
export const numberBase = {
  id: 'number-base', name: 'Number Base Converter', category: CAT, icon: ICONS.calc,
  description: 'Convert numbers between binary, octal, decimal and hexadecimal.',
  keywords: 'number base binary hex decimal octal convert radix',
  render(root) {
    const fields = {};
    function setAll(val, from) {
      let n;
      try { n = BigInt(from === 2 ? '0b' + val : from === 8 ? '0o' + val : from === 16 ? '0x' + val : val); }
      catch { Object.entries(fields).forEach(([b, el]) => { if (+b !== from) el.value = ''; }); return; }
      if (fields[2] && from !== 2) fields[2].value = n.toString(2);
      if (fields[8] && from !== 8) fields[8].value = n.toString(8);
      if (fields[10] && from !== 10) fields[10].value = n.toString(10);
      if (fields[16] && from !== 16) fields[16].value = n.toString(16);
    }
    const mk = (base, label) => { const inp = h('input', { class: 'input mono', oninput: e => setAll(e.target.value.trim(), base) }); fields[base] = inp; return field(label, inp); };
    root.appendChild(toolShell(this, h('div', {}, h('div', { class: 'panel' },
      mk(10, 'Decimal (base 10)'), mk(2, 'Binary (base 2)'), mk(8, 'Octal (base 8)'), mk(16, 'Hexadecimal (base 16)')))));
    fields[10].value = '255'; setAll('255', 10);
  },
};

/* ---------------- CSV → Excel (.xlsx) ---------------- */
export const csvToXlsx = {
  id: 'csv-to-xlsx', name: 'CSV → Excel (XLSX)', category: CAT, icon: ICONS.doc,
  description: 'Convert a CSV file into a real Excel .xlsx workbook.',
  keywords: 'csv to excel xlsx spreadsheet convert workbook',
  render(root) {
    let file = null;
    const out = h('div', { class: 'output' });
    const panel = h('div', { class: 'panel hidden' });
    panel.append(h('p', { class: 'hint' }, 'First use loads the spreadsheet engine (~1 MB).'), h('div', { class: 'panel__actions' }, h('button', { class: 'btn btn--primary', onclick: run }, 'Convert to XLSX')));
    const dz = Dropzone({ accept: '.csv,text/csv', onFiles: fs => { file = fs[0]; panel.classList.remove('hidden'); } });
    async function run() {
      if (!file) return toast('Add a CSV', 'error');
      out.innerHTML = ''; const b = busy(out, 'Building workbook…'); b.progress(null);
      try {
        const XLSX = await import('xlsx');
        const wb = XLSX.read(await file.text(), { type: 'string' });
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        b.done(); out.appendChild(resultCard({ title: 'xlsx', blob, filename: `${stripExt(file.name)}.xlsx`, previewUrl: 'x', isImage: false })); toast('Converted', 'success');
      } catch (e) { console.error(e); b.done(); toast('Failed: ' + e.message, 'error'); }
    }
    root.appendChild(toolShell(this, h('div', {}, dz, panel, out)));
  },
};

/* ---------------- Excel → CSV ---------------- */
export const xlsxToCsv = {
  id: 'xlsx-to-csv', name: 'Excel → CSV', category: CAT, icon: ICONS.doc,
  description: 'Extract the first sheet of an Excel .xlsx/.xls file as CSV.',
  keywords: 'excel xlsx xls to csv convert spreadsheet export',
  render(root) {
    let file = null;
    const out = h('div', { class: 'output' });
    const panel = h('div', { class: 'panel hidden' });
    panel.append(h('p', { class: 'hint' }, 'First use loads the spreadsheet engine (~1 MB). Exports the first worksheet.'), h('div', { class: 'panel__actions' }, h('button', { class: 'btn btn--primary', onclick: run }, 'Convert to CSV')));
    const dz = Dropzone({ accept: '.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', onFiles: fs => { file = fs[0]; panel.classList.remove('hidden'); } });
    async function run() {
      if (!file) return toast('Add an Excel file', 'error');
      out.innerHTML = ''; const b = busy(out, 'Reading workbook…'); b.progress(null);
      try {
        const XLSX = await import('xlsx');
        const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' });
        const csv = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]);
        const blob = new Blob([csv], { type: 'text/csv' });
        b.done();
        out.appendChild(resultCard({ title: 'csv', blob, filename: `${stripExt(file.name)}.csv`, previewUrl: 'x', isImage: false }));
        out.appendChild(h('pre', { class: 'textpreview' }, csv.slice(0, 3000)));
        toast('Converted', 'success');
      } catch (e) { console.error(e); b.done(); toast('Failed: ' + e.message, 'error'); }
    }
    root.appendChild(toolShell(this, h('div', {}, dz, panel, out)));
  },
};

export default [csvToJson, jsonToCsv, jsonYaml, csvToMarkdown, numberBase, csvToXlsx, xlsxToCsv];
