// media.js — audio & video tools powered by ffmpeg.wasm + Web Audio. Fully local.
import {
  h, ICONS, Dropzone, toolShell, busy, resultCard, toast, field, select, rangeField,
  stripExt, fileChip, formatBytes, onCleanup, downloadBlob,
} from '../core.js';

// Single-threaded core => works on GitHub Pages without special headers.
const CORE_BASE = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
let _ffmpeg = null;
let _loadPromise = null;

async function getFFmpeg(onLog) {
  if (_ffmpeg) return _ffmpeg;
  if (_loadPromise) return _loadPromise;
  _loadPromise = (async () => {
    const { FFmpeg } = await import('@ffmpeg/ffmpeg');
    const { toBlobURL } = await import('@ffmpeg/util');
    const ff = new FFmpeg();
    if (onLog) ff.on('log', ({ message }) => onLog(message));
    await ff.load({
      coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    _ffmpeg = ff;
    return ff;
  })();
  return _loadPromise;
}

// Generic runner: writes input, runs args, reads output.
async function runFFmpeg({ file, outName, args, b }) {
  const ff = await getFFmpeg();
  const inName = 'in_' + file.name.replace(/[^\w.\-]/g, '_');
  const buf = new Uint8Array(await file.arrayBuffer());
  await ff.writeFile(inName, buf);
  const progressHandler = ({ progress }) => { if (b && progress >= 0 && progress <= 1) b.progress(progress); };
  ff.on('progress', progressHandler);
  try {
    await ff.exec(args(inName, outName));
  } finally {
    ff.off('progress', progressHandler);
  }
  const data = await ff.readFile(outName);
  await ff.deleteFile(inName).catch(() => {});
  await ff.deleteFile(outName).catch(() => {});
  return new Blob([data.buffer], { type: 'application/octet-stream' });
}

function mediaTool({ id, name, description, keywords, accept, icon, build }) {
  return {
    id, name, description, keywords, icon,
    category: accept.startsWith('audio') ? 'Audio' : 'Video',
    render(root) {
      let file = null;
      const body = h('div', {});
      const out = h('div', { class: 'output' });
      const panel = h('div', { class: 'panel hidden' });
      const controls = h('div', {});
      const ctx = {};
      build(ctx, controls, () => file);

      panel.append(
        h('p', { class: 'hint' }, 'First media task loads the ffmpeg engine (~25 MB, cached afterward).'),
        controls,
        h('div', { class: 'panel__actions' }, h('button', { class: 'btn btn--primary', onclick: run }, ctx.actionLabel || 'Convert')),
      );

      const dz = Dropzone({
        accept, onFiles: fs => {
          file = fs[0];
          panel.classList.remove('hidden');
          panel.querySelectorAll('.chips').forEach(c => c.remove());
          panel.prepend(h('div', { class: 'chips' }, fileChip(file)));
          ctx.onFile?.(file);
        },
      });

      async function run() {
        if (!file) return toast('Add a file', 'error');
        out.innerHTML = '';
        const b = busy(out, 'Loading engine…'); b.progress(null);
        try {
          await getFFmpeg(() => {});
          b.msg('Processing… (this can take a moment)');
          const { outName, args, label } = ctx.spec(file);
          const blob = await runFFmpeg({ file, outName, args, b });
          b.done();
          const isImg = /\.(gif|png|jpg|webp)$/i.test(outName);
          out.appendChild(resultCard({
            title: outName, blob, filename: outName,
            previewUrl: isImg ? URL.createObjectURL(blob) : 'x', isImage: isImg,
            extra: h('p', { class: 'result__badge' }, `${formatBytes(file.size)} → ${formatBytes(blob.size)}`),
          }));
          toast(label || 'Done', 'success');
        } catch (e) { console.error(e); b.done(); toast('Failed: ' + (e.message || e), 'error'); }
      }

      body.append(dz, panel, out);
      root.appendChild(toolShell(this, body));
    },
  };
}

/* ---------------- Audio Converter ---------------- */
export const audioConverter = mediaTool({
  id: 'audio-converter', name: 'Audio Converter', icon: ICONS.audio,
  description: 'Convert between MP3, WAV, OGG, FLAC, M4A, AAC, OPUS.',
  keywords: 'audio convert mp3 wav ogg flac m4a aac opus music sound',
  accept: 'audio/*',
  build(ctx, controls) {
    let format = 'mp3', bitrate = '192k';
    const brField = field('Bitrate', select(['128k', '192k', '256k', '320k'], bitrate, v => bitrate = v));
    function refresh() { brField.style.display = (format === 'wav' || format === 'flac') ? 'none' : ''; }
    controls.append(
      field('Output format', select(['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'opus'], format, v => { format = v; refresh(); })),
      brField,
    );
    refresh();
    ctx.actionLabel = 'Convert audio';
    ctx.spec = (file) => {
      const outName = `${stripExt(file.name)}.${format}`;
      const args = (i, o) => {
        const a = ['-i', i];
        if (format !== 'wav' && format !== 'flac') a.push('-b:a', bitrate);
        a.push(o);
        return a;
      };
      return { outName, args, label: 'Audio converted' };
    };
  },
});

/* ---------------- Video Converter ---------------- */
export const videoConverter = mediaTool({
  id: 'video-converter', name: 'Video Converter', icon: ICONS.video,
  description: 'Convert between MP4, WEBM, MOV, MKV, AVI and adjust quality.',
  keywords: 'video convert mp4 webm mov mkv avi quality compress',
  accept: 'video/*',
  build(ctx, controls) {
    let format = 'mp4', crf = 26;
    controls.append(
      field('Output format', select(['mp4', 'webm', 'mov', 'mkv', 'avi'], format, v => format = v)),
      rangeField('Quality (lower = better/larger)', { min: 18, max: 34, step: 1, value: crf, onInput: v => crf = v }),
    );
    ctx.actionLabel = 'Convert video';
    ctx.spec = (file) => {
      const outName = `${stripExt(file.name)}.${format}`;
      const args = (i, o) => {
        if (format === 'webm') return ['-i', i, '-c:v', 'libvpx-vp9', '-crf', String(crf), '-b:v', '0', '-c:a', 'libopus', o];
        return ['-i', i, '-c:v', 'libx264', '-crf', String(crf), '-preset', 'veryfast', '-c:a', 'aac', '-b:a', '160k', o];
      };
      return { outName, args, label: 'Video converted' };
    };
  },
});

/* ---------------- Video → GIF ---------------- */
export const videoToGif = mediaTool({
  id: 'video-to-gif', name: 'Video → GIF', icon: ICONS.video,
  description: 'Turn a video clip into an animated GIF.',
  keywords: 'video to gif animated convert clip',
  accept: 'video/*',
  build(ctx, controls) {
    let fps = 12, width = 480;
    controls.append(
      rangeField('Frame rate', { min: 5, max: 24, step: 1, value: fps, suffix: ' fps', onInput: v => fps = v }),
      rangeField('Width', { min: 160, max: 800, step: 20, value: width, suffix: ' px', onInput: v => width = v }),
    );
    ctx.actionLabel = 'Create GIF';
    ctx.spec = (file) => ({
      outName: `${stripExt(file.name)}.gif`,
      args: (i, o) => ['-i', i, '-vf', `fps=${fps},scale=${width}:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`, '-loop', '0', o],
      label: 'GIF created',
    });
  },
});

/* ---------------- Extract Audio from Video ---------------- */
export const extractAudio = mediaTool({
  id: 'extract-audio', name: 'Extract Audio from Video', icon: ICONS.audio,
  description: 'Pull the audio track out of a video as MP3 or WAV.',
  keywords: 'extract audio from video mp3 wav rip sound track',
  accept: 'video/*',
  build(ctx, controls) {
    let format = 'mp3';
    controls.append(field('Audio format', select(['mp3', 'wav', 'm4a'], format, v => format = v)));
    ctx.actionLabel = 'Extract audio';
    ctx.spec = (file) => ({
      outName: `${stripExt(file.name)}.${format}`,
      args: (i, o) => format === 'wav' ? ['-i', i, '-vn', o] : ['-i', i, '-vn', '-b:a', '192k', o],
      label: 'Audio extracted',
    });
  },
});

/* ---------------- Audio Noise Reduction ---------------- */
export const noiseReduction = mediaTool({
  id: 'noise-reduction', name: 'Audio Noise Reduction', icon: ICONS.audio,
  description: 'Reduce background hiss/hum using an FFT denoiser + high-pass filter.',
  keywords: 'noise reduction remove background hiss hum clean audio denoise',
  accept: 'audio/*',
  build(ctx, controls) {
    let strength = 12, highpass = 80;
    controls.append(
      rangeField('Noise reduction strength', { min: 1, max: 30, step: 1, value: strength, suffix: ' dB', onInput: v => strength = v }),
      rangeField('Low-frequency cutoff (removes rumble)', { min: 0, max: 250, step: 10, value: highpass, suffix: ' Hz', onInput: v => highpass = v }),
    );
    ctx.actionLabel = 'Clean audio';
    ctx.spec = (file) => {
      const filters = [`afftdn=nf=-${strength}`];
      if (highpass > 0) filters.unshift(`highpass=f=${highpass}`);
      return {
        outName: `${stripExt(file.name)}-clean.mp3`,
        args: (i, o) => ['-i', i, '-af', filters.join(','), '-b:a', '192k', o],
        label: 'Audio cleaned',
      };
    };
  },
});

/* ---------------- Vocal Remover (center-channel) ---------------- */
export const vocalRemover = mediaTool({
  id: 'vocal-remover', name: 'Vocal Remover (Karaoke)', icon: ICONS.audio,
  description: 'Remove center-panned vocals to make a karaoke track (works best on stereo songs).',
  keywords: 'vocal remover karaoke remove voice instrumental acapella stem',
  accept: 'audio/*',
  build(ctx, controls) {
    let mode = 'instrumental';
    controls.append(
      field('Output', select([{ value: 'instrumental', label: 'Instrumental (remove vocals)' }, { value: 'acapella', label: 'Isolate center (rough acapella)' }], mode, v => mode = v)),
      h('p', { class: 'hint' }, 'This is a fast stereo trick, not full AI stem separation — quality varies by song.'),
    );
    ctx.actionLabel = 'Process';
    ctx.spec = (file) => {
      // Instrumental: subtract channels to cancel center-panned vocals.
      // Acapella: keep the L-R difference (the center content) as mono.
      const af = mode === 'instrumental'
        ? 'pan=stereo|c0=c0-c1|c1=c1-c0'
        : 'pan=mono|c0=0.5*c0-0.5*c1';
      return {
        outName: `${stripExt(file.name)}-${mode}.mp3`,
        args: (i, o) => ['-i', i, '-af', af, '-b:a', '192k', o],
        label: 'Done',
      };
    };
  },
});

/* ---------------- Trim Media ---------------- */
export const trimMedia = mediaTool({
  id: 'trim-media', name: 'Trim Audio / Video', icon: ICONS.scissors,
  description: 'Cut a clip from a start time to an end time without re-encoding.',
  keywords: 'trim cut clip start end shorten audio video',
  accept: 'video/*,audio/*',
  build(ctx, controls) {
    let start = '00:00:00', end = '00:00:10';
    controls.append(
      h('div', { class: 'grid-2' },
        field('Start (hh:mm:ss)', h('input', { class: 'input', value: start, oninput: e => start = e.target.value })),
        field('End (hh:mm:ss)', h('input', { class: 'input', value: end, oninput: e => end = e.target.value })),
      ),
    );
    ctx.actionLabel = 'Trim';
    ctx.spec = (file) => {
      const ext = file.name.split('.').pop();
      return {
        outName: `${stripExt(file.name)}-trim.${ext}`,
        args: (i, o) => ['-ss', start, '-to', end, '-i', i, '-c', 'copy', o],
        label: 'Trimmed',
      };
    };
  },
});

/* ---------------- Compress Video ---------------- */
export const compressVideo = mediaTool({
  id: 'compress-video', name: 'Compress Video', icon: ICONS.video,
  description: 'Reduce video file size while keeping decent quality.',
  keywords: 'compress video reduce size smaller shrink mp4',
  accept: 'video/*',
  build(ctx, controls) {
    let level = 30, scale = '0';
    controls.append(
      rangeField('Compression (higher = smaller file)', { min: 24, max: 38, step: 1, value: level, onInput: v => level = v }),
      field('Scale down', select([{ value: '0', label: 'Keep resolution' }, { value: '1280', label: 'Max 720p' }, { value: '854', label: 'Max 480p' }], '0', v => scale = v)),
    );
    ctx.actionLabel = 'Compress';
    ctx.spec = (file) => ({
      outName: `${stripExt(file.name)}-compressed.mp4`,
      args: (i, o) => {
        const a = ['-i', i, '-c:v', 'libx264', '-crf', String(level), '-preset', 'veryfast'];
        if (scale !== '0') a.push('-vf', `scale=${scale}:-2`);
        a.push('-c:a', 'aac', '-b:a', '128k', o);
        return a;
      },
      label: 'Compressed',
    });
  },
});

/* ---------------- Video Screenshot ---------------- */
export const videoScreenshot = {
  id: 'video-screenshot', name: 'Video Screenshot', category: 'Video', icon: ICONS.image,
  description: 'Scrub to any moment in a video and capture the frame as a PNG.',
  keywords: 'video screenshot frame capture still png grab snapshot',
  render(root) {
    let file = null;
    const video = h('video', { class: 'webcam', controls: true, crossorigin: 'anonymous' });
    const out = h('div', { class: 'output' });
    const panel = h('div', { class: 'panel hidden' });
    panel.append(video, h('p', { class: 'hint' }, 'Pause on the frame you want, then capture.'),
      h('div', { class: 'panel__actions' }, h('button', { class: 'btn btn--primary', onclick: grab }, '📸 Capture frame')));
    const dz = Dropzone({ accept: 'video/*', onFiles: fs => { file = fs[0]; video.src = URL.createObjectURL(file); panel.classList.remove('hidden'); } });
    async function grab() {
      if (!file) return toast('Add a video', 'error');
      const cv = h('canvas', { width: video.videoWidth, height: video.videoHeight });
      cv.getContext('2d').drawImage(video, 0, 0);
      cv.toBlob(blob => { out.innerHTML = ''; out.appendChild(resultCard({ title: 'frame', blob, filename: `${stripExt(file.name)}-${video.currentTime.toFixed(1)}s.png`, previewUrl: URL.createObjectURL(blob), isImage: true })); toast('Captured', 'success'); }, 'image/png');
    }
    onCleanup(() => { if (video.src) URL.revokeObjectURL(video.src); });
    root.appendChild(toolShell(this, h('div', {}, dz, panel, out)));
  },
};

/* ---------------- Noise Generator ---------------- */
export const noiseGenerator = {
  id: 'noise-generator', name: 'Noise Generator', category: 'Audio', icon: ICONS.audio,
  description: 'Play white, pink or brown noise to focus, relax or sleep.',
  keywords: 'noise generator white pink brown sound focus sleep relax ambient',
  render(root) {
    let ac = null, node = null, gain = null, type = 'white', vol = 0.4;
    function make() {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      const buf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
      const d = buf.getChannelData(0);
      let last = 0, b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < d.length; i++) {
        const w = Math.random() * 2 - 1;
        if (type === 'white') d[i] = w;
        else if (type === 'pink') { b0 = 0.99765 * b0 + w * 0.0990460; b1 = 0.96300 * b1 + w * 0.2965164; b2 = 0.57000 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2; }
        else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      }
      node = ac.createBufferSource(); node.buffer = buf; node.loop = true;
      gain = ac.createGain(); gain.gain.value = vol; node.connect(gain); gain.connect(ac.destination); node.start();
    }
    function stop() { try { node?.stop(); ac?.close(); } catch (_) {} ac = null; node = null; }
    onCleanup(stop);
    const playBtn = h('button', { class: 'btn btn--primary', onclick: () => { if (ac) { stop(); playBtn.textContent = '▶ Play'; } else { make(); playBtn.textContent = '⏸ Stop'; } } }, '▶ Play');
    root.appendChild(toolShell(this, h('div', {}, h('div', { class: 'panel' },
      field('Noise type', select([{ value: 'white', label: 'White noise' }, { value: 'pink', label: 'Pink noise' }, { value: 'brown', label: 'Brown noise' }], type, v => { type = v; if (ac) { stop(); make(); } })),
      rangeField('Volume', { min: 0, max: 1, step: 0.05, value: vol, onInput: v => { vol = v; if (gain) gain.gain.value = v; } }),
      h('div', { class: 'panel__actions' }, playBtn)))));
  },
};

/* ---------------- Metronome ---------------- */
export const metronome = {
  id: 'metronome', name: 'Metronome', category: 'Audio', icon: ICONS.music,
  description: '30–300 BPM metronome with tap tempo and accent on beat one.',
  keywords: 'metronome bpm tempo beat music practice tap rhythm',
  render(root) {
    let ac = null, timer = null, bpm = 120, beat = 0, beats = 4, taps = [];
    const bpmDisp = h('div', { class: 'big-num' }, '120');
    const dots = h('div', { class: 'beat-dots' });
    function drawDots() { dots.innerHTML = ''; for (let i = 0; i < beats; i++) dots.appendChild(h('span', { class: 'beat-dot' + (i === beat ? ' beat-dot--on' : '') })); }
    function click(accent) { if (!ac) return; const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = accent ? 1500 : 900; o.connect(g); g.connect(ac.destination); g.gain.setValueAtTime(0.5, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.05); o.start(); o.stop(ac.currentTime + 0.05); }
    function tick() { click(beat === 0); drawDots(); beat = (beat + 1) % beats; }
    function start() { ac = new (window.AudioContext || window.webkitAudioContext)(); beat = 0; tick(); timer = setInterval(tick, 60000 / bpm); }
    function stop() { clearInterval(timer); timer = null; try { ac?.close(); } catch (_) {} ac = null; }
    function restart() { if (timer) { stop(); start(); } }
    onCleanup(stop);
    const startBtn = h('button', { class: 'btn btn--primary', onclick: () => { if (timer) { stop(); startBtn.textContent = 'Start'; } else { start(); startBtn.textContent = 'Stop'; } } }, 'Start');
    const tap = h('button', { class: 'btn', onclick: () => { const now = performance.now(); taps = taps.filter(t => now - t < 2000); taps.push(now); if (taps.length >= 2) { const avg = (taps[taps.length - 1] - taps[0]) / (taps.length - 1); bpm = Math.max(30, Math.min(300, Math.round(60000 / avg))); bpmDisp.textContent = bpm; restart(); } } }, 'Tap tempo');
    drawDots();
    root.appendChild(toolShell(this, h('div', {}, h('div', { class: 'panel center' }, bpmDisp, dots,
      rangeField('BPM', { min: 30, max: 300, step: 1, value: bpm, onInput: v => { bpm = v; bpmDisp.textContent = v; restart(); } }),
      field('Beats per bar', select(['2', '3', '4', '6'], '4', v => { beats = +v; beat = 0; drawDots(); })),
      h('div', { class: 'panel__actions center' }, startBtn, tap)))));
  },
};

/* ---------------- Audio Visualizer ---------------- */
export const audioVisualizer = {
  id: 'audio-visualizer', name: 'Audio Visualizer', category: 'Audio', icon: ICONS.audio,
  description: 'Play an audio file with a live waveform / frequency visualizer.',
  keywords: 'audio visualizer waveform frequency spectrum player music',
  render(root) {
    let ac = null, raf = null, file = null;
    const audio = h('audio', { controls: true, class: 'webcam' });
    const canvas = h('canvas', { class: 'preview-canvas', width: 800, height: 240 });
    const panel = h('div', { class: 'panel hidden' });
    panel.append(canvas, audio);
    const dz = Dropzone({ accept: 'audio/*', onFiles: fs => {
      file = fs[0]; audio.src = URL.createObjectURL(file); panel.classList.remove('hidden');
      if (!ac) { ac = new (window.AudioContext || window.webkitAudioContext)(); const src = ac.createMediaElementSource(audio); const an = ac.createAnalyser(); an.fftSize = 256; src.connect(an); an.connect(ac.destination); const data = new Uint8Array(an.frequencyBinCount); const ctx = canvas.getContext('2d');
        (function loop() { raf = requestAnimationFrame(loop); an.getByteFrequencyData(data); ctx.clearRect(0, 0, 800, 240); const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#3b71ff'; const bw = 800 / data.length; for (let i = 0; i < data.length; i++) { const bh = data[i] / 255 * 240; ctx.fillStyle = accent; ctx.fillRect(i * bw, 240 - bh, bw - 1, bh); } })();
      }
      audio.play().catch(() => {});
    } });
    onCleanup(() => { cancelAnimationFrame(raf); try { ac?.close(); } catch (_) {} if (audio.src) URL.revokeObjectURL(audio.src); });
    root.appendChild(toolShell(this, h('div', {}, dz, panel)));
  },
};

/* ---------------- BPM Detector ---------------- */
export const bpmDetector = {
  id: 'bpm-detector', name: 'BPM Detector', category: 'Audio', icon: ICONS.music,
  description: 'Estimate the tempo (beats per minute) of a song.',
  keywords: 'bpm detector tempo beat estimate song analyze music',
  render(root) {
    let file = null;
    const out = h('div', { class: 'output' });
    const panel = h('div', { class: 'panel hidden' });
    panel.append(h('p', { class: 'hint' }, 'Estimate from the first ~30s. Works best on music with a steady beat.'),
      h('div', { class: 'panel__actions' }, h('button', { class: 'btn btn--primary', onclick: run }, 'Detect BPM')));
    const dz = Dropzone({ accept: 'audio/*', onFiles: fs => { file = fs[0]; panel.classList.remove('hidden'); } });
    async function run() {
      if (!file) return toast('Add an audio file', 'error');
      out.innerHTML = ''; const b = busy(out, 'Analyzing…'); b.progress(null);
      try {
        const ac = new (window.AudioContext || window.webkitAudioContext)();
        const buf = await ac.decodeAudioData(await file.arrayBuffer());
        const data = buf.getChannelData(0);
        const sr = buf.sampleRate;
        const len = Math.min(data.length, sr * 30);
        // envelope: rectified, downsampled energy
        const win = Math.floor(sr / 100); const env = [];
        for (let i = 0; i < len; i += win) { let s = 0; for (let j = 0; j < win && i + j < len; j++) s += Math.abs(data[i + j]); env.push(s / win); }
        // onset = positive difference
        const onset = env.map((v, i) => Math.max(0, v - (env[i - 1] || 0)));
        const fps = sr / win; // env samples per second (~100)
        let best = 0, bestScore = -1;
        for (let bpm = 60; bpm <= 200; bpm++) {
          const lag = Math.round(60 / bpm * fps); let score = 0;
          for (let i = lag; i < onset.length; i++) score += onset[i] * onset[i - lag];
          if (score > bestScore) { bestScore = score; best = bpm; }
        }
        ac.close(); b.done();
        out.appendChild(h('div', { class: 'calc-result' }, h('div', { class: 'big-num' }, best + ' BPM'), h('div', { class: 'calc-sub' }, 'Estimated tempo' + (best < 90 ? ` (or ${best * 2} BPM)` : ''))));
        toast('Estimated ' + best + ' BPM', 'success');
      } catch (e) { console.error(e); b.done(); toast('Failed: ' + e.message, 'error'); }
    }
    root.appendChild(toolShell(this, h('div', {}, dz, panel, out)));
  },
};

export default [audioConverter, videoConverter, compressVideo, videoToGif, videoScreenshot, extractAudio, noiseReduction, vocalRemover, trimMedia, noiseGenerator, metronome, audioVisualizer, bpmDetector];
