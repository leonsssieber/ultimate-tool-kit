// download.js — direct/batch downloaders (100% in-browser) + a YouTube downloader
// that talks to the optional local helper (server/server.py running yt-dlp).
import {
  h, ICONS, toolShell, field, select, toast, downloadBlob, busy, formatBytes, stripExt,
} from '../core.js';

const CAT = 'Download';

/* read/persist the local-helper URL */
const HELPER_KEY = 'utk-helper-url';
const getHelper = () => localStorage.getItem(HELPER_KEY) || 'http://localhost:8787';
const setHelper = (u) => localStorage.setItem(HELPER_KEY, u.replace(/\/$/, ''));

/* stream a fetch response into a Blob, reporting progress + extracting filename */
async function fetchToBlob(url, opts, b) {
  const res = await fetch(url, opts);
  if (!res.ok) { let msg = ''; try { msg = (await res.json()).error; } catch (_) {} throw new Error(msg || `HTTP ${res.status}`); }
  const total = +res.headers.get('Content-Length') || 0;
  const cd = res.headers.get('Content-Disposition') || '';
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
  const name = m ? decodeURIComponent(m[1]) : null;
  if (!res.body) return { blob: await res.blob(), name };
  const reader = res.body.getReader(); const chunks = []; let recv = 0;
  for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); recv += value.length; if (b) { if (total) b.progress(recv / total); b.msg(`Downloading… ${formatBytes(recv)}${total ? ' / ' + formatBytes(total) : ''}`); } }
  return { blob: new Blob(chunks), name };
}

function filenameFromUrl(url) {
  try { const u = new URL(url); const n = u.pathname.split('/').filter(Boolean).pop(); return n ? decodeURIComponent(n) : 'download'; } catch { return 'download'; }
}

/* ---------------- Direct URL Downloader ---------------- */
export const urlDownloader = {
  id: 'url-downloader', name: 'Download from URL', category: CAT, icon: ICONS.download,
  description: 'Save a file from a direct link to your device (images, PDFs, MP3/MP4, …).',
  keywords: 'download url link direct file save fetch grab',
  render(root) {
    const input = h('input', { class: 'input', placeholder: 'https://example.com/file.mp4' });
    const out = h('div', { class: 'output' });
    async function run() {
      const url = input.value.trim(); if (!url) return toast('Paste a direct file link', 'error');
      out.innerHTML = ''; const b = busy(out, 'Fetching…'); b.progress(null);
      try {
        const { blob, name } = await fetchToBlob(url, {}, b);
        downloadBlob(blob, name || filenameFromUrl(url)); b.done(); toast('Downloaded', 'success');
      } catch (e) {
        b.done();
        toast('Direct fetch blocked (CORS) — opening in a new tab instead.', 'error');
        window.open(url, '_blank', 'noopener');
      }
    }
    root.appendChild(toolShell(this, h('div', {}, h('div', { class: 'panel' },
      h('p', { class: 'hint' }, 'Works for direct file links that allow cross-origin access. It does NOT work for YouTube/streaming pages — use the YouTube Downloader for those.'),
      field('File URL', input),
      h('div', { class: 'panel__actions' }, h('button', { class: 'btn btn--primary', onclick: run }, 'Download'))), out)));
  },
};

/* ---------------- Batch Downloader ---------------- */
export const batchDownloader = {
  id: 'batch-downloader', name: 'Batch Downloader', category: CAT, icon: ICONS.download,
  description: 'Paste many direct links and download them all, one after another.',
  keywords: 'batch download multiple links bulk urls mass list',
  render(root) {
    const ta = h('textarea', { class: 'input mono', rows: 8, placeholder: 'https://site.com/a.jpg\nhttps://site.com/b.pdf\nhttps://site.com/c.mp3' });
    const list = h('div', { class: 'dl-list' });
    let running = false;
    async function run() {
      if (running) return;
      const urls = ta.value.split('\n').map(s => s.trim()).filter(Boolean);
      if (!urls.length) return toast('Paste at least one link', 'error');
      running = true; list.innerHTML = '';
      const rows = urls.map(u => { const r = h('div', { class: 'dl-row' }, h('span', { class: 'dl-row__name', title: u }, filenameFromUrl(u)), h('span', { class: 'dl-row__status' }, '…')); list.appendChild(r); return r; });
      let ok = 0;
      for (let i = 0; i < urls.length; i++) {
        const st = rows[i].querySelector('.dl-row__status'); st.textContent = 'downloading…';
        try { const { blob, name } = await fetchToBlob(urls[i], {}); downloadBlob(blob, name || filenameFromUrl(urls[i])); st.textContent = '✓ done'; st.className = 'dl-row__status dl-row__status--ok'; ok++; }
        catch { st.textContent = '✗ blocked (opened tab)'; st.className = 'dl-row__status dl-row__status--err'; window.open(urls[i], '_blank', 'noopener'); }
        await new Promise(r => setTimeout(r, 400));
      }
      running = false; toast(`Done — ${ok}/${urls.length} downloaded`, 'success');
    }
    root.appendChild(toolShell(this, h('div', {}, h('div', { class: 'panel' },
      h('p', { class: 'hint' }, 'One link per line. Cross-origin links that block fetching open in a new tab instead. For YouTube links use the YouTube Downloader.'),
      field('Links (one per line)', ta),
      h('div', { class: 'panel__actions' }, h('button', { class: 'btn btn--primary', onclick: run }, 'Download all'))), list)));
  },
};

/* ---------------- YouTube / Media Downloader (needs local helper) ---------------- */
export const youtubeDownloader = {
  id: 'youtube-downloader', name: 'YouTube Downloader', category: CAT, icon: ICONS.video,
  description: 'Download video, video-only or audio (MP3) from YouTube & 1000+ sites — with quality selector and a batch list. Needs the free local helper (see panel).',
  keywords: 'youtube downloader video audio mp3 mp4 quality batch yt-dlp playlist download',
  render(root) {
    let mode = 'both', quality = 'best', connected = false;
    const out = h('div', { class: 'output' });

    // --- helper connection bar ---
    const helperInput = h('input', { class: 'input', value: getHelper(), style: { maxWidth: '280px' } });
    const dot = h('span', { class: 'conn-dot' });
    const status = h('span', { class: 'conn-text' }, 'Not connected');
    async function testConn() {
      setHelper(helperInput.value);
      status.textContent = 'Checking…'; dot.className = 'conn-dot';
      try { const r = await fetch(getHelper() + '/health', { method: 'GET', signal: AbortSignal.timeout(4000) }); connected = r.ok; }
      catch { connected = false; }
      dot.className = 'conn-dot ' + (connected ? 'conn-dot--ok' : 'conn-dot--bad');
      status.textContent = connected ? 'Helper connected ✓' : 'Helper not reachable — start it (see below)';
    }

    const setupNote = h('details', { class: 'setup-note' },
      h('summary', {}, '⚙ How to start the free local helper (one time)'),
      h('div', { class: 'setup-note__body', html: `
        <p>YouTube blocks downloads from websites and cloud servers, so the actual download runs on <b>your</b> computer via a tiny helper using <code>yt-dlp</code>. One-time setup:</p>
        <ol>
          <li>Install <a href="https://www.python.org/downloads/" target="_blank" rel="noopener">Python</a> and <a href="https://ffmpeg.org/download.html" target="_blank" rel="noopener">ffmpeg</a>.</li>
          <li>In the project's <code>server/</code> folder run: <code>pip install -r requirements.txt</code></li>
          <li>Start it: <code>python server.py</code> (Windows: double-click <code>run.bat</code>).</li>
          <li>Click <b>Test connection</b> above. Keep that window open while downloading.</li>
        </ol>
        <p class="hint">The helper only listens on your own machine (localhost) — nothing is sent to any third party.</p>` }),
    );

    const connBar = h('div', { class: 'panel' },
      h('div', { class: 'conn-row' }, dot, status),
      field('Local helper URL', h('div', { class: 'row' }, helperInput, h('button', { class: 'btn', onclick: testConn }, 'Test connection'))),
      setupNote,
    );

    // --- options ---
    const modeSeg = h('div', { class: 'segmented' },
      h('button', { class: 'seg seg--on', onclick: e => setMode('both', e) }, 'Video + Audio'),
      h('button', { class: 'seg', onclick: e => setMode('video', e) }, 'Video only'),
      h('button', { class: 'seg', onclick: e => setMode('audio', e) }, 'Audio (MP3)'),
    );
    const qualityField = field('Max quality', select(
      [{ value: 'best', label: 'Best available' }, { value: '2160', label: '4K (2160p)' }, { value: '1440', label: '1440p' }, { value: '1080', label: '1080p' }, { value: '720', label: '720p' }, { value: '480', label: '480p' }, { value: '360', label: '360p' }],
      quality, v => quality = v));
    function setMode(m, e) { mode = m; modeSeg.querySelectorAll('.seg').forEach(s => s.classList.remove('seg--on')); e.target.classList.add('seg--on'); qualityField.style.display = m === 'audio' ? 'none' : ''; }

    const urlInput = h('input', { class: 'input', placeholder: 'https://www.youtube.com/watch?v=…' });
    const meta = h('div', { class: 'yt-meta' });

    async function getInfo() {
      const url = urlInput.value.trim(); if (!url) return toast('Paste a video URL', 'error');
      meta.innerHTML = ''; const b = busy(meta, 'Fetching video info…'); b.progress(null);
      try {
        const r = await fetch(getHelper() + '/info', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || ('HTTP ' + r.status));
        const info = await r.json();
        b.done();
        meta.innerHTML = '';
        meta.appendChild(h('div', { class: 'yt-card' },
          info.thumbnail ? h('img', { class: 'yt-thumb', src: info.thumbnail, alt: '' }) : null,
          h('div', {}, h('p', { class: 'yt-title' }, info.title || 'Untitled'),
            h('p', { class: 'yt-sub' }, [info.uploader, info.duration_string].filter(Boolean).join(' · ')))));
      } catch (e) { b.done(); connHint(e); }
    }

    function connHint(e) { toast('Could not reach the helper — start it and click “Test connection”. (' + (e.message || e) + ')', 'error'); }

    async function downloadOne(url, b) {
      const r = await fetchToBlob(getHelper() + '/download', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, mode, quality }) }, b);
      downloadBlob(r.blob, r.name || 'video.' + (mode === 'audio' ? 'mp3' : 'mp4'));
    }

    async function single() {
      const url = urlInput.value.trim(); if (!url) return toast('Paste a video URL', 'error');
      out.innerHTML = ''; const b = busy(out, 'Starting download…'); b.progress(null);
      try { await downloadOne(url, b); b.done(); toast('Downloaded', 'success'); }
      catch (e) { b.done(); connHint(e); }
    }

    // --- batch ---
    const batchTa = h('textarea', { class: 'input mono', rows: 5, placeholder: 'One video URL per line…' });
    const batchList = h('div', { class: 'dl-list' });
    async function batch() {
      const urls = batchTa.value.split('\n').map(s => s.trim()).filter(Boolean);
      if (!urls.length) return toast('Paste at least one URL', 'error');
      batchList.innerHTML = '';
      const rows = urls.map(u => { const r = h('div', { class: 'dl-row' }, h('span', { class: 'dl-row__name', title: u }, u), h('span', { class: 'dl-row__status' }, 'queued')); batchList.appendChild(r); return r; });
      for (let i = 0; i < urls.length; i++) {
        const st = rows[i].querySelector('.dl-row__status'); st.textContent = 'downloading…';
        try { await downloadOne(urls[i]); st.textContent = '✓ done'; st.className = 'dl-row__status dl-row__status--ok'; }
        catch (e) { st.textContent = '✗ ' + (e.message || 'failed'); st.className = 'dl-row__status dl-row__status--err'; }
      }
      toast('Batch finished', 'success');
    }

    const body = h('div', {},
      connBar,
      h('div', { class: 'panel' },
        h('p', { class: 'field__label' }, 'Single video'),
        field('Video URL', h('div', { class: 'row' }, urlInput, h('button', { class: 'btn', onclick: getInfo }, 'Get info'))),
        meta,
        modeSeg, qualityField,
        h('div', { class: 'panel__actions' }, h('button', { class: 'btn btn--primary', onclick: single }, h('span', { html: ICONS.download }), ' Download'))),
      out,
      h('div', { class: 'panel' },
        h('p', { class: 'field__label' }, 'Batch (uses the mode & quality above)'),
        field('Video URLs (one per line)', batchTa),
        h('div', { class: 'panel__actions' }, h('button', { class: 'btn btn--primary', onclick: batch }, 'Download all')),
        batchList),
    );
    root.appendChild(toolShell(this, body));
    testConn();
  },
};

export default [youtubeDownloader, urlDownloader, batchDownloader];
