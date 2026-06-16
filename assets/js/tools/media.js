// media.js — audio & video tools powered by ffmpeg.wasm. Fully local.
import {
  h, ICONS, Dropzone, toolShell, busy, resultCard, toast, field, select, rangeField,
  stripExt, fileChip, formatBytes,
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

export default [audioConverter, videoConverter, videoToGif, extractAudio, noiseReduction, vocalRemover, trimMedia];
