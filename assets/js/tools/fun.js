// fun.js — randomizers & fun. All local.
import { h, ICONS, toolShell, field, toast, onCleanup } from '../core.js';

const CAT = 'Fun';

/* ---------------- Random Spinner ---------------- */
export const spinner = {
  id: 'spinner', name: 'Random Spinner Wheel', category: CAT, icon: ICONS.shuffle,
  description: 'A customizable wheel of fortune — add options and spin to pick one.',
  keywords: 'spinner wheel random pick decision fortune choose raffle',
  render(root) {
    let options = ['Pizza', 'Sushi', 'Burgers', 'Tacos', 'Salad', 'Pasta'];
    let angle = 0, spinning = false;
    const COLORS = ['#3b71ff', '#b06dff', '#ff6dce', '#ff8a5b', '#ffce5b', '#41d18f', '#5bd0ff', '#8a8fff'];
    const canvas = h('canvas', { class: 'wheel', width: 380, height: 380 });
    const ta = h('textarea', { class: 'input', rows: 6, oninput: e => { options = e.target.value.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 15); draw(); } });
    ta.value = options.join('\n');
    const result = h('div', { class: 'big-num' }, '');
    function draw() {
      const ctx = canvas.getContext('2d'); const cx = 190, cy = 190, r = 180;
      ctx.clearRect(0, 0, 380, 380);
      const n = options.length || 1; const slice = Math.PI * 2 / n;
      for (let i = 0; i < n; i++) {
        ctx.beginPath(); ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, angle + i * slice, angle + (i + 1) * slice);
        ctx.fillStyle = COLORS[i % COLORS.length]; ctx.fill();
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(angle + i * slice + slice / 2);
        ctx.fillStyle = '#0b0d12'; ctx.font = 'bold 14px Inter, sans-serif'; ctx.textAlign = 'right';
        ctx.fillText((options[i] || '').slice(0, 14), r - 14, 5); ctx.restore();
      }
      ctx.beginPath(); ctx.arc(cx, cy, 22, 0, 7); ctx.fillStyle = '#fff'; ctx.fill();
    }
    function spin() {
      if (spinning || !options.length) return; spinning = true; result.textContent = '';
      const target = Math.random() * Math.PI * 2; const total = Math.PI * 2 * 6 + target; const dur = 4200; const t0 = performance.now(); const startAngle = angle;
      (function anim(t) {
        const p = Math.min(1, (t - t0) / dur); const ease = 1 - Math.pow(1 - p, 3);
        angle = startAngle + total * ease; draw();
        if (p < 1) requestAnimationFrame(anim);
        else { spinning = false; const norm = (Math.PI * 1.5 - angle % (Math.PI * 2) + Math.PI * 4) % (Math.PI * 2); const idx = Math.floor(norm / (Math.PI * 2 / options.length)); result.textContent = '🎉 ' + options[idx % options.length]; }
      })(t0);
    }
    draw();
    root.appendChild(toolShell(this, h('div', {}, h('div', { class: 'spin-layout' },
      h('div', { class: 'wheel-wrap' }, h('div', { class: 'wheel-pin' }), canvas, h('button', { class: 'btn btn--primary', style: { marginTop: '12px', width: '100%' }, onclick: spin }, 'SPIN')),
      h('div', { class: 'panel', style: { flex: 1 } }, field('Options (one per line, max 15)', ta), result)))));
  },
};

/* ---------------- Coin Flip ---------------- */
export const coinFlip = {
  id: 'coin-flip', name: 'Coin Flip', category: CAT, icon: ICONS.circle,
  description: 'Flip a coin with a 3D animation and running statistics.',
  keywords: 'coin flip heads tails random toss decision',
  render(root) {
    let heads = 0, tails = 0, flipping = false;
    const coin = h('div', { class: 'coin' }, h('div', { class: 'coin__face coin__face--h' }, 'H'), h('div', { class: 'coin__face coin__face--t' }, 'T'));
    const stats = h('div', { class: 'stats' });
    function update() { stats.innerHTML = ''; const total = heads + tails; stats.append(s(heads, 'Heads'), s(tails, 'Tails'), s(total, 'Total'), s(total ? Math.round(heads / total * 100) + '%' : '—', 'Heads %')); }
    function flip() {
      if (flipping) return; flipping = true;
      const isH = Math.random() < 0.5; const spins = 5;
      coin.style.transition = 'transform 1.4s cubic-bezier(.3,.8,.3,1)';
      coin.style.transform = `rotateY(${spins * 360 + (isH ? 0 : 180)}deg)`;
      setTimeout(() => { coin.style.transition = 'none'; coin.style.transform = `rotateY(${isH ? 0 : 180}deg)`; isH ? heads++ : tails++; update(); flipping = false; }, 1450);
    }
    update();
    root.appendChild(toolShell(this, h('div', {}, h('div', { class: 'panel center' }, h('div', { class: 'coin-stage' }, coin),
      h('div', { class: 'panel__actions center' }, h('button', { class: 'btn btn--primary', onclick: flip }, 'Flip coin'), h('button', { class: 'btn', onclick: () => { heads = tails = 0; update(); } }, 'Reset'))), h('div', { class: 'output' }, stats))));
    function s(n, l) { return h('div', { class: 'stat' }, h('span', { class: 'stat__num' }, String(n)), h('span', { class: 'stat__label' }, l)); }
  },
};

/* ---------------- Dice Roller ---------------- */
export const diceRoller = {
  id: 'dice-roller', name: 'Dice Roller', category: CAT, icon: ICONS.dice,
  description: 'Roll 1–6 dice (or D20 etc.) with rolling animation and history.',
  keywords: 'dice roller d6 d20 random roll tabletop game rpg',
  render(root) {
    let sides = 6, count = 2, history = [];
    const display = h('div', { class: 'dice-row' });
    const total = h('div', { class: 'big-num' }, '');
    const hist = h('div', { class: 'lap-list' });
    function roll() {
      const rolls = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * sides));
      display.innerHTML = '';
      rolls.forEach(r => { const d = h('div', { class: 'die die--rolling' }, '?'); display.appendChild(d); setTimeout(() => { d.textContent = r; d.classList.remove('die--rolling'); }, 500); });
      const sum = rolls.reduce((a, b) => a + b, 0);
      setTimeout(() => { total.textContent = `Total: ${sum}`; history.unshift(`${count}d${sides}: [${rolls.join(', ')}] = ${sum}`); hist.innerHTML = ''; history.slice(0, 12).forEach(hh => hist.appendChild(h('div', { class: 'lap' }, hh))); }, 520);
    }
    const sidesSel = h('select', { class: 'input', onchange: e => sides = +e.target.value }, ...[4, 6, 8, 10, 12, 20, 100].map(n => { const o = h('option', { value: n }, 'D' + n); if (n === 6) o.selected = true; return o; }));
    const countIn = h('input', { class: 'input', type: 'number', min: 1, max: 8, value: 2, onchange: e => count = Math.max(1, Math.min(8, +e.target.value)) });
    root.appendChild(toolShell(this, h('div', {}, h('div', { class: 'panel center' }, display, total,
      h('div', { class: 'grid-2', style: { maxWidth: '320px', margin: '12px auto 0' } }, field('Dice type', sidesSel), field('How many', countIn)),
      h('div', { class: 'panel__actions center' }, h('button', { class: 'btn btn--primary', onclick: roll }, 'Roll dice'))), hist)));
  },
};

export default [spinner, coinFlip, diceRoller];
