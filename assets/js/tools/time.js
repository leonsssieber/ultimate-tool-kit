// time.js — stopwatch, timers, clocks. All local.
import { h, ICONS, toolShell, field, select, toast, onCleanup, h as _h } from '../core.js';

const CAT = 'Time';

function beep(freq = 880, dur = 0.3) {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.value = freq; o.connect(g); g.connect(ac.destination);
    g.gain.setValueAtTime(0.001, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.3, ac.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
    o.start(); o.stop(ac.currentTime + dur);
    setTimeout(() => ac.close(), (dur + 0.1) * 1000);
  } catch (_) {}
}
const pad = n => String(n).padStart(2, '0');

/* ---------------- Stopwatch ---------------- */
export const stopwatch = {
  id: 'stopwatch', name: 'Stopwatch', category: CAT, icon: ICONS.clock,
  description: 'Millisecond-precision stopwatch with lap times.',
  keywords: 'stopwatch timer laps milliseconds count up',
  render(root) {
    let start = 0, elapsed = 0, raf = null, laps = [];
    const disp = h('div', { class: 'timer-display' }, '00:00.00');
    const lapList = h('div', { class: 'lap-list' });
    function fmt(ms) { const m = Math.floor(ms / 60000), s = Math.floor(ms % 60000 / 1000), cs = Math.floor(ms % 1000 / 10); return `${pad(m)}:${pad(s)}.${pad(cs)}`; }
    function loop() { disp.textContent = fmt(elapsed + (performance.now() - start)); raf = requestAnimationFrame(loop); }
    const startBtn = h('button', { class: 'btn btn--primary', onclick: () => {
      if (raf) { elapsed += performance.now() - start; cancelAnimationFrame(raf); raf = null; startBtn.textContent = 'Resume'; }
      else { start = performance.now(); raf = requestAnimationFrame(loop); startBtn.textContent = 'Pause'; }
    } }, 'Start');
    const lapBtn = h('button', { class: 'btn', onclick: () => { if (!raf && !elapsed) return; const t = elapsed + (raf ? performance.now() - start : 0); laps.unshift(t); renderLaps(); } }, 'Lap');
    const resetBtn = h('button', { class: 'btn', onclick: () => { cancelAnimationFrame(raf); raf = null; elapsed = 0; laps = []; disp.textContent = '00:00.00'; renderLaps(); startBtn.textContent = 'Start'; } }, 'Reset');
    function renderLaps() { lapList.innerHTML = ''; laps.forEach((t, i) => lapList.appendChild(h('div', { class: 'lap' }, h('span', {}, `Lap ${laps.length - i}`), h('span', {}, fmt(t))))); }
    onCleanup(() => cancelAnimationFrame(raf));
    root.appendChild(toolShell(this, h('div', {}, h('div', { class: 'panel timer-panel' }, disp, h('div', { class: 'panel__actions center' }, startBtn, lapBtn, resetBtn)), lapList)));
  },
};

/* ---------------- Countdown Timer ---------------- */
export const countdown = {
  id: 'countdown', name: 'Countdown Timer', category: CAT, icon: ICONS.clock,
  description: 'Set a timer that beeps when it reaches zero.',
  keywords: 'countdown timer alarm alert minutes seconds',
  render(root) {
    let remaining = 0, timer = null;
    const disp = h('div', { class: 'timer-display' }, '00:00');
    const mm = h('input', { class: 'input', type: 'number', min: 0, value: 5, style: { width: '90px' } });
    const ss = h('input', { class: 'input', type: 'number', min: 0, max: 59, value: 0, style: { width: '90px' } });
    function fmt(s) { const h_ = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60; return h_ ? `${pad(h_)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`; }
    function tick() { remaining--; disp.textContent = fmt(remaining); if (remaining <= 0) { clearInterval(timer); timer = null; beep(); beep(1100); disp.classList.add('timer-display--done'); toast('Time is up!', 'success'); startBtn.textContent = 'Start'; } }
    const startBtn = h('button', { class: 'btn btn--primary', onclick: () => {
      if (timer) { clearInterval(timer); timer = null; startBtn.textContent = 'Resume'; return; }
      if (remaining <= 0) remaining = (+mm.value) * 60 + (+ss.value);
      if (remaining <= 0) return toast('Set a duration', 'error');
      disp.classList.remove('timer-display--done'); disp.textContent = fmt(remaining);
      timer = setInterval(tick, 1000); startBtn.textContent = 'Pause';
    } }, 'Start');
    const resetBtn = h('button', { class: 'btn', onclick: () => { clearInterval(timer); timer = null; remaining = 0; disp.textContent = '00:00'; disp.classList.remove('timer-display--done'); startBtn.textContent = 'Start'; } }, 'Reset');
    onCleanup(() => clearInterval(timer));
    root.appendChild(toolShell(this, h('div', {}, h('div', { class: 'panel timer-panel' }, disp,
      h('div', { class: 'row center', style: { gap: '10px', justifyContent: 'center', margin: '8px 0' } }, field('Min', mm), field('Sec', ss)),
      h('div', { class: 'panel__actions center' }, startBtn, resetBtn)))));
  },
};

/* ---------------- Pomodoro ---------------- */
export const pomodoro = {
  id: 'pomodoro', name: 'Pomodoro Timer', category: CAT, icon: ICONS.clock,
  description: 'Focus/break intervals to stay productive (25/5 by default).',
  keywords: 'pomodoro focus break productivity timer study work',
  render(root) {
    let phase = 'focus', remaining = 25 * 60, timer = null, rounds = 0;
    const focusM = h('input', { class: 'input', type: 'number', value: 25, min: 1, style: { width: '80px' } });
    const breakM = h('input', { class: 'input', type: 'number', value: 5, min: 1, style: { width: '80px' } });
    const disp = h('div', { class: 'timer-display' }, '25:00');
    const phaseEl = h('div', { class: 'calc-sub' }, 'Focus');
    const roundEl = h('div', { class: 'calc-sub' }, 'Round 0');
    function fmt(s) { return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`; }
    function switchPhase() {
      beep(phase === 'focus' ? 660 : 990);
      if (phase === 'focus') { phase = 'break'; remaining = (+breakM.value) * 60; rounds++; roundEl.textContent = `Round ${rounds}`; }
      else { phase = 'focus'; remaining = (+focusM.value) * 60; }
      phaseEl.textContent = phase === 'focus' ? 'Focus' : 'Break';
      disp.classList.toggle('timer-display--break', phase === 'break');
    }
    function tick() { remaining--; if (remaining < 0) { switchPhase(); } disp.textContent = fmt(remaining); }
    const startBtn = h('button', { class: 'btn btn--primary', onclick: () => {
      if (timer) { clearInterval(timer); timer = null; startBtn.textContent = 'Resume'; } else { timer = setInterval(tick, 1000); startBtn.textContent = 'Pause'; }
    } }, 'Start');
    const resetBtn = h('button', { class: 'btn', onclick: () => { clearInterval(timer); timer = null; phase = 'focus'; remaining = (+focusM.value) * 60; rounds = 0; disp.textContent = fmt(remaining); phaseEl.textContent = 'Focus'; roundEl.textContent = 'Round 0'; disp.classList.remove('timer-display--break'); startBtn.textContent = 'Start'; } }, 'Reset');
    onCleanup(() => clearInterval(timer));
    root.appendChild(toolShell(this, h('div', {}, h('div', { class: 'panel timer-panel' }, phaseEl, disp, roundEl,
      h('div', { class: 'row', style: { gap: '14px', justifyContent: 'center', margin: '10px 0' } }, field('Focus (min)', focusM), field('Break (min)', breakM)),
      h('div', { class: 'panel__actions center' }, startBtn, resetBtn)))));
  },
};

/* ---------------- World Clock ---------------- */
export const worldClock = {
  id: 'world-clock', name: 'World Clock', category: CAT, icon: ICONS.clock,
  description: 'Live time across major cities around the world.',
  keywords: 'world clock timezone cities time global utc',
  render(root) {
    const zones = ['UTC', 'America/Los_Angeles', 'America/New_York', 'America/Sao_Paulo', 'Europe/London', 'Europe/Berlin', 'Europe/Moscow', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Shanghai', 'Asia/Tokyo', 'Australia/Sydney'];
    const all = Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone') : zones;
    let list = [...zones];
    const grid = h('div', { class: 'clock-grid' });
    const adder = select(all, 'Europe/Paris', () => {});
    function render() {
      grid.innerHTML = '';
      list.forEach((tz, i) => {
        const now = new Date();
        const time = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(now);
        const date = new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short' }).format(now);
        grid.appendChild(h('div', { class: 'clock-card' },
          h('div', { class: 'clock-card__city' }, tz.split('/').pop().replace(/_/g, ' ')),
          h('div', { class: 'clock-card__time' }, time),
          h('div', { class: 'clock-card__date' }, date),
          h('button', { class: 'clock-card__x', html: '&times;', title: 'Remove', onclick: () => { list.splice(i, 1); render(); } }),
        ));
      });
    }
    const timer = setInterval(render, 1000); onCleanup(() => clearInterval(timer));
    render();
    root.appendChild(toolShell(this, h('div', {}, h('div', { class: 'panel' }, field('Add a city / timezone', adder),
      h('button', { class: 'btn', onclick: () => { if (!list.includes(adder.value)) { list.push(adder.value); render(); } } }, 'Add')), grid)));
  },
};

/* ---------------- Timestamp Converter ---------------- */
export const timestampConverter = {
  id: 'timestamp-converter', name: 'Timestamp Converter', category: CAT, icon: ICONS.code,
  description: 'Convert Unix epoch ↔ human-readable date (seconds or ms).',
  keywords: 'timestamp unix epoch date convert seconds milliseconds iso',
  render(root) {
    const tsIn = h('input', { class: 'input', placeholder: 'e.g. 1700000000', oninput: fromTs });
    const dateIn = h('input', { class: 'input', type: 'datetime-local', oninput: fromDate });
    const out1 = h('div', { class: 'textpreview' }, '—'), out2 = h('div', { class: 'textpreview' }, '—');
    const nowBtn = h('button', { class: 'btn', onclick: () => { tsIn.value = Math.floor(Date.now() / 1000); fromTs(); } }, 'Use now');
    function fromTs() {
      let v = parseInt(tsIn.value); if (isNaN(v)) { out1.textContent = '—'; return; }
      if (tsIn.value.trim().length > 11) {} else v = v * 1000;
      const d = new Date(v);
      out1.textContent = `Local:  ${d.toString()}\nUTC:    ${d.toUTCString()}\nISO:    ${d.toISOString()}`;
    }
    function fromDate() { if (!dateIn.value) return; const d = new Date(dateIn.value); out2.textContent = `Seconds: ${Math.floor(d.getTime() / 1000)}\nMillis:  ${d.getTime()}`; }
    root.appendChild(toolShell(this, h('div', {},
      h('div', { class: 'panel' }, field('Unix timestamp (s or ms)', tsIn), h('div', { class: 'panel__actions' }, nowBtn), out1),
      h('div', { class: 'panel' }, field('Date & time', dateIn), out2))));
  },
};

export default [stopwatch, countdown, pomodoro, worldClock, timestampConverter];
