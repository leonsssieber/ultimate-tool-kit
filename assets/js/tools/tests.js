// tests.js — hardware & reflex tests. All local.
import { h, ICONS, toolShell, toast, onCleanup, field } from '../core.js';

const CAT = 'Tests';
const SENTENCES = [
  'the quick brown fox jumps over the lazy dog while the sun sets behind the hills',
  'typing fast requires practice patience and a steady rhythm of your fingers',
  'a journey of a thousand miles begins with a single careful step forward',
  'bright vivid colors filled the sky as the storm slowly drifted away east',
];

/* ---------------- Typing Speed Test ---------------- */
export const typingTest = {
  id: 'typing-test', name: 'Typing Speed Test', category: CAT, icon: ICONS.type,
  description: 'Measure your words-per-minute, accuracy and time.',
  keywords: 'typing speed test wpm words per minute accuracy keyboard',
  render(root) {
    let target = SENTENCES[Math.floor(Math.random() * SENTENCES.length)];
    let startT = 0, done = false;
    const sample = h('div', { class: 'typing-sample' });
    const input = h('textarea', { class: 'input', rows: 3, placeholder: 'Start typing here…', oninput: onType });
    const stats = h('div', { class: 'stats' });
    function paint() {
      sample.innerHTML = '';
      const typed = input.value;
      target.split('').forEach((ch, i) => {
        let cls = 'tc';
        if (i < typed.length) cls += typed[i] === ch ? ' tc--ok' : ' tc--bad';
        else if (i === typed.length) cls += ' tc--cur';
        sample.appendChild(h('span', { class: cls }, ch));
      });
    }
    function onType() {
      if (!startT) startT = performance.now();
      paint();
      const typed = input.value;
      const mins = (performance.now() - startT) / 60000;
      const words = typed.trim().split(/\s+/).filter(Boolean).length;
      const correct = [...typed].filter((c, i) => c === target[i]).length;
      const acc = typed.length ? Math.round(correct / typed.length * 100) : 100;
      stats.innerHTML = '';
      stats.append(st(mins ? Math.round(words / mins) : 0, 'WPM'), st(acc + '%', 'Accuracy'), st((mins * 60).toFixed(1) + 's', 'Time'), st(typed.length, 'Chars'));
      if (typed.length >= target.length && !done) { done = true; toast('Done! ' + (mins ? Math.round(words / mins) : 0) + ' WPM', 'success'); }
    }
    const reset = h('button', { class: 'btn', onclick: () => { target = SENTENCES[Math.floor(Math.random() * SENTENCES.length)]; input.value = ''; startT = 0; done = false; paint(); stats.innerHTML = ''; input.focus(); } }, 'New sentence');
    paint();
    root.appendChild(toolShell(this, h('div', {}, h('div', { class: 'panel' }, sample, input, h('div', { class: 'panel__actions' }, reset)), h('div', { class: 'output' }, stats))));
  },
};

/* ---------------- Keyboard Tester ---------------- */
export const keyboardTester = {
  id: 'keyboard-tester', name: 'Keyboard Tester', category: CAT, icon: ICONS.code,
  description: 'Press keys to find stuck or broken keys — shows a live keyboard.',
  keywords: 'keyboard tester broken stuck keys press test hardware',
  render(root) {
    const rows = [['Esc','1','2','3','4','5','6','7','8','9','0','-','=','Back'],['Tab','Q','W','E','R','T','Y','U','I','O','P','[',']','\\'],['Caps','A','S','D','F','G','H','J','K','L',';','\'','Enter'],['Shift','Z','X','C','V','B','N','M',',','.','/','RShift'],['Ctrl','Alt','Space','AltGr','Menu']];
    const map = { ' ': 'SPACE', BACKSPACE: 'BACK', ESCAPE: 'ESC', CAPSLOCK: 'CAPS', SHIFTLEFT: 'SHIFT', SHIFTRIGHT: 'RSHIFT', CONTROLLEFT: 'CTRL' };
    const kb = h('div', { class: 'kbtest' });
    const keyEls = {};
    rows.forEach(r => { const rowEl = h('div', { class: 'kbtest__row' }); r.forEach(k => { const el = h('div', { class: 'kbtest__key' + (k === 'Space' ? ' kbtest__key--space' : '') }, k); keyEls[k.toUpperCase()] = el; rowEl.appendChild(el); }); kb.appendChild(rowEl); });
    const info = h('div', { class: 'calc-sub' }, 'Click here, then press any key.');
    function down(e) {
      e.preventDefault();
      let label = (e.key.length === 1 ? e.key.toUpperCase() : e.key.toUpperCase());
      label = map[e.code?.toUpperCase()] || map[label] || label;
      const el = keyEls[label] || keyEls[e.key.toUpperCase()];
      if (el) { el.classList.add('kbtest__key--down', 'kbtest__key--hit'); }
      info.textContent = `key: "${e.key}"   code: ${e.code}   keyCode: ${e.keyCode}`;
    }
    function up(e) { let label = map[e.code?.toUpperCase()] || (e.key.length === 1 ? e.key.toUpperCase() : e.key.toUpperCase()); const el = keyEls[label] || keyEls[e.key.toUpperCase()]; if (el) el.classList.remove('kbtest__key--down'); }
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    onCleanup(() => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); });
    const reset = h('button', { class: 'btn', onclick: () => Object.values(keyEls).forEach(el => el.classList.remove('kbtest__key--hit')) }, 'Clear highlights');
    root.appendChild(toolShell(this, h('div', {}, h('div', { class: 'panel' }, info, kb, h('div', { class: 'panel__actions' }, reset)))));
  },
};

/* ---------------- Reaction Time Test ---------------- */
export const reactionTest = {
  id: 'reaction-test', name: 'Reaction Time Test', category: CAT, icon: ICONS.gauge,
  description: 'Click as fast as you can when the box turns green.',
  keywords: 'reaction time test reflex speed milliseconds click',
  render(root) {
    let state = 'idle', t0 = 0, timer = null, scores = [];
    const box = h('div', { class: 'reaction-box reaction-box--idle' }, 'Click to start');
    const stats = h('div', { class: 'stats' });
    function setState(s, text, cls) { state = s; box.className = 'reaction-box ' + cls; box.textContent = text; }
    box.addEventListener('click', () => {
      if (state === 'idle' || state === 'result') {
        setState('wait', 'Wait for green…', 'reaction-box--wait');
        timer = setTimeout(() => { setState('go', 'CLICK!', 'reaction-box--go'); t0 = performance.now(); }, 1000 + Math.random() * 3000);
      } else if (state === 'wait') {
        clearTimeout(timer); setState('idle', 'Too soon! Click to retry', 'reaction-box--idle');
      } else if (state === 'go') {
        const ms = Math.round(performance.now() - t0); scores.unshift(ms);
        setState('result', ms + ' ms — click to retry', 'reaction-box--idle');
        const best = Math.min(...scores), avg = Math.round(scores.reduce((a, b) => a + b) / scores.length);
        stats.innerHTML = ''; stats.append(st(ms, 'Last'), st(best, 'Best'), st(avg, 'Average'), st(scores.length, 'Tries'));
      }
    });
    onCleanup(() => clearTimeout(timer));
    root.appendChild(toolShell(this, h('div', {}, h('div', { class: 'panel' }, box), h('div', { class: 'output' }, stats))));
  },
};

/* ---------------- CPS Test ---------------- */
export const cpsTest = {
  id: 'cps-test', name: 'CPS Test (Clicks/sec)', category: CAT, icon: ICONS.target,
  description: 'How many times can you click in 5 seconds?',
  keywords: 'cps clicks per second test click speed mouse',
  render(root) {
    let clicks = 0, running = false, left = 5, timer = null;
    const box = h('div', { class: 'reaction-box reaction-box--idle' }, 'Click to start (5s)');
    const stats = h('div', { class: 'stats' });
    box.addEventListener('click', () => {
      if (!running) { running = true; clicks = 0; left = 5; box.className = 'reaction-box reaction-box--go'; timer = setInterval(() => { left--; box.textContent = `${left}s — keep clicking!`; if (left <= 0) { clearInterval(timer); running = false; box.className = 'reaction-box reaction-box--idle'; box.textContent = `${(clicks / 5).toFixed(1)} CPS — click to retry`; stats.innerHTML = ''; stats.append(st(clicks, 'Clicks'), st((clicks / 5).toFixed(1), 'CPS'), st(clicks * 12, 'Per min')); } }, 1000); box.textContent = '5s — keep clicking!'; return; }
      clicks++;
    });
    onCleanup(() => clearInterval(timer));
    root.appendChild(toolShell(this, h('div', {}, h('div', { class: 'panel' }, box), h('div', { class: 'output' }, stats))));
  },
};

/* ---------------- Aim Trainer ---------------- */
export const aimTrainer = {
  id: 'aim-trainer', name: 'Aim Trainer', category: CAT, icon: ICONS.target,
  description: 'Hit 20 targets as fast as you can — measures speed and accuracy.',
  keywords: 'aim trainer mouse accuracy targets speed reflex game',
  render(root) {
    let hits = 0, misses = 0, startT = 0, total = 20;
    const arena = h('div', { class: 'aim-arena' });
    const stats = h('div', { class: 'calc-sub' }, 'Click the targets!');
    const out = h('div', { class: 'stats' });
    function spawn() {
      arena.innerHTML = '';
      if (hits >= total) {
        const secs = (performance.now() - startT) / 1000;
        out.innerHTML = ''; out.append(st(secs.toFixed(2) + 's', 'Total time'), st((secs / total * 1000).toFixed(0) + 'ms', 'Avg / target'), st(Math.round(hits / (hits + misses) * 100) + '%', 'Accuracy'));
        stats.textContent = 'Done! Click below to restart.'; return;
      }
      const r = 26 + Math.random() * 8;
      const x = Math.random() * (arena.clientWidth - 2 * r) + r;
      const y = Math.random() * (arena.clientHeight - 2 * r) + r;
      const t = h('div', { class: 'aim-target', style: { left: (x - r) + 'px', top: (y - r) + 'px', width: 2 * r + 'px', height: 2 * r + 'px' } });
      t.addEventListener('click', (e) => { e.stopPropagation(); hits++; stats.textContent = `${hits} / ${total}`; spawn(); });
      arena.appendChild(t);
    }
    arena.addEventListener('click', () => { if (hits < total && startT) misses++; });
    const startBtn = h('button', { class: 'btn btn--primary', onclick: () => { hits = 0; misses = 0; startT = performance.now(); out.innerHTML = ''; spawn(); } }, 'Start / Restart');
    root.appendChild(toolShell(this, h('div', {}, h('div', { class: 'panel' }, stats, arena, h('div', { class: 'panel__actions' }, startBtn)), h('div', { class: 'output' }, out))));
  },
};

/* ---------------- Mic & Camera Test ---------------- */
export const micCamTest = {
  id: 'mic-cam-test', name: 'Mic & Camera Test', category: CAT, icon: ICONS.camera,
  description: 'Preview your webcam and see a live microphone level meter.',
  keywords: 'microphone camera webcam test mic level audio video device',
  render(root) {
    let stream = null, ac = null, raf = null;
    const video = h('video', { class: 'webcam', autoplay: true, muted: true, playsinline: true });
    const meter = h('div', { class: 'mic-meter' }, h('span', { class: 'mic-meter__fill' }));
    const status = h('div', { class: 'calc-sub' }, 'Click "Start" and allow access.');
    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        video.srcObject = stream; status.textContent = 'Camera & mic active.';
        ac = new (window.AudioContext || window.webkitAudioContext)();
        const src = ac.createMediaStreamSource(stream); const an = ac.createAnalyser(); an.fftSize = 512; src.connect(an);
        const data = new Uint8Array(an.frequencyBinCount);
        const fill = meter.querySelector('.mic-meter__fill');
        (function loop() { an.getByteFrequencyData(data); const avg = data.reduce((a, b) => a + b, 0) / data.length; fill.style.width = Math.min(100, avg / 140 * 100) + '%'; raf = requestAnimationFrame(loop); })();
      } catch (e) { status.textContent = 'Access denied or no device: ' + e.message; }
    }
    function stop() { cancelAnimationFrame(raf); stream?.getTracks().forEach(t => t.stop()); ac?.close(); stream = null; status.textContent = 'Stopped.'; meter.querySelector('.mic-meter__fill').style.width = '0%'; }
    onCleanup(stop);
    root.appendChild(toolShell(this, h('div', {}, h('div', { class: 'panel' }, status, video,
      h('p', { class: 'field__label', style: { marginTop: '12px' } }, 'Microphone level'), meter,
      h('div', { class: 'panel__actions' }, h('button', { class: 'btn btn--primary', onclick: start }, 'Start'), h('button', { class: 'btn', onclick: stop }, 'Stop'))))));
  },
};

function st(numv, label) { return h('div', { class: 'stat' }, h('span', { class: 'stat__num' }, String(numv)), h('span', { class: 'stat__label' }, label)); }

export default [typingTest, keyboardTester, reactionTest, cpsTest, aimTrainer, micCamTest];
