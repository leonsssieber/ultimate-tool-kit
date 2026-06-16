// calculators.js — pure-JS calculators. All local.
import { h, ICONS, toolShell, field, select, toast, onCleanup } from '../core.js';

const CAT = 'Calculators';
const num = (props = {}) => h('input', Object.assign({ class: 'input', type: 'number' }, props));
function result(node) { return h('div', { class: 'calc-result' }, node); }

/* ---------------- Age Calculator ---------------- */
export const ageCalculator = {
  id: 'age-calculator', name: 'Age Calculator', category: CAT, icon: ICONS.clock,
  description: 'Exact age in years/months/days, zodiac sign and next-birthday countdown.',
  keywords: 'age birthday zodiac days old countdown date of birth',
  render(root) {
    const out = h('div', { class: 'output' });
    const dob = h('input', { class: 'input', type: 'date', max: new Date().toISOString().slice(0, 10), onchange: calc });
    function zodiac(m, d) {
      const z = [['Capricorn', 19], ['Aquarius', 18], ['Pisces', 20], ['Aries', 20], ['Taurus', 21], ['Gemini', 21], ['Cancer', 22], ['Leo', 22], ['Virgo', 23], ['Libra', 23], ['Scorpio', 22], ['Sagittarius', 21]];
      return d > z[m][1] ? z[(m + 1) % 12][0] : z[m][0];
    }
    function calc() {
      if (!dob.value) return;
      const b = new Date(dob.value), now = new Date();
      if (b > now) { out.innerHTML = ''; out.appendChild(result('That date is in the future.')); return; }
      let y = now.getFullYear() - b.getFullYear();
      let m = now.getMonth() - b.getMonth();
      let d = now.getDate() - b.getDate();
      if (d < 0) { m--; d += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); }
      if (m < 0) { y--; m += 12; }
      const totalDays = Math.floor((now - b) / 864e5);
      const next = new Date(now.getFullYear(), b.getMonth(), b.getDate());
      if (next < now) next.setFullYear(now.getFullYear() + 1);
      const daysToBday = Math.ceil((next - now) / 864e5);
      out.innerHTML = '';
      out.append(
        result(h('div', { class: 'big-num' }, `${y} years, ${m} months, ${d} days`)),
        h('div', { class: 'stats' },
          stat(totalDays.toLocaleString(), 'Days lived'),
          stat((totalDays * 24).toLocaleString(), 'Hours'),
          stat(zodiac(b.getMonth(), b.getDate()), 'Zodiac'),
          stat(daysToBday === 0 ? '🎉 Today!' : daysToBday, 'Days to birthday'),
        ),
      );
    }
    root.appendChild(toolShell(this, h('div', {}, h('div', { class: 'panel' }, field('Your date of birth', dob)), out)));
  },
};

/* ---------------- Unit Converter ---------------- */
const UNITS = {
  Length: { meter: 1, kilometer: 1000, centimeter: 0.01, millimeter: 0.001, mile: 1609.344, yard: 0.9144, foot: 0.3048, inch: 0.0254, 'nautical mile': 1852 },
  Weight: { kilogram: 1, gram: 0.001, milligram: 1e-6, tonne: 1000, pound: 0.45359237, ounce: 0.0283495, stone: 6.35029 },
  Volume: { liter: 1, milliliter: 0.001, 'cubic meter': 1000, gallon: 3.78541, quart: 0.946353, pint: 0.473176, cup: 0.24, 'fluid ounce': 0.0295735 },
  Area: { 'sq meter': 1, 'sq kilometer': 1e6, 'sq mile': 2.59e6, 'sq foot': 0.092903, acre: 4046.86, hectare: 10000 },
  Speed: { 'm/s': 1, 'km/h': 0.277778, 'mph': 0.44704, knot: 0.514444 },
  'Data': { byte: 1, kilobyte: 1024, megabyte: 1048576, gigabyte: 1073741824, terabyte: 1099511627776 },
};
export const unitConverter = {
  id: 'unit-converter', name: 'Unit Converter', category: CAT, icon: ICONS.calc,
  description: 'Convert length, weight, volume, area, speed, data and temperature.',
  keywords: 'unit converter length weight volume temperature celsius fahrenheit metric imperial',
  render(root) {
    let cat = 'Length';
    const val = num({ value: 1, oninput: conv });
    const fromSel = select(Object.keys(UNITS[cat]), 'meter', v => { from = v; conv(); });
    const toSel = select(Object.keys(UNITS[cat]), 'foot', v => { to = v; conv(); });
    let from = 'meter', to = 'foot';
    const out = h('div', { class: 'big-num' }, '—');

    function rebuild() {
      const keys = cat === 'Temperature' ? ['Celsius', 'Fahrenheit', 'Kelvin'] : Object.keys(UNITS[cat]);
      from = keys[0]; to = keys[1] || keys[0];
      fromSel.innerHTML = ''; toSel.innerHTML = '';
      keys.forEach((k, i) => { const a = h('option', { value: k }, k); const b = h('option', { value: k }, k); if (i === 0) a.selected = true; if (i === 1) b.selected = true; fromSel.appendChild(a); toSel.appendChild(b); });
      conv();
    }
    function conv() {
      const x = parseFloat(val.value); if (isNaN(x)) { out.textContent = '—'; return; }
      let r;
      if (cat === 'Temperature') {
        let c = from === 'Celsius' ? x : from === 'Fahrenheit' ? (x - 32) * 5 / 9 : x - 273.15;
        r = to === 'Celsius' ? c : to === 'Fahrenheit' ? c * 9 / 5 + 32 : c + 273.15;
      } else r = x * UNITS[cat][from] / UNITS[cat][to];
      out.textContent = `${(+r.toPrecision(8))} ${to}`;
    }
    const body = h('div', {},
      h('div', { class: 'panel' },
        field('Category', select([...Object.keys(UNITS), 'Temperature'], cat, v => { cat = v; rebuild(); })),
        field('Value', val),
        h('div', { class: 'grid-2' }, field('From', fromSel), field('To', toSel)),
      ),
      h('div', { class: 'output' }, h('div', { class: 'calc-result' }, out)),
    );
    root.appendChild(toolShell(this, body));
    conv();
  },
};

/* ---------------- Percentage Calculator ---------------- */
export const percentageCalculator = {
  id: 'percentage-calculator', name: 'Percentage Calculator', category: CAT, icon: ICONS.percent,
  description: 'Percent of a number, percentage change, and X is what % of Y.',
  keywords: 'percentage percent change increase decrease ratio of',
  render(root) {
    const r1 = h('div', { class: 'big-num' }, '—'), r2 = h('div', { class: 'big-num' }, '—'), r3 = h('div', { class: 'big-num' }, '—');
    const a1 = num({ value: 20, oninput: c1 }), b1 = num({ value: 150, oninput: c1 });
    const a2 = num({ value: 30, oninput: c2 }), b2 = num({ value: 120, oninput: c2 });
    const a3 = num({ value: 100, oninput: c3 }), b3 = num({ value: 150, oninput: c3 });
    function c1() { const p = +a1.value, n = +b1.value; r1.textContent = isFinite(p * n) ? (+(p / 100 * n).toPrecision(6)) : '—'; }
    function c2() { const x = +a2.value, y = +b2.value; r2.textContent = y ? (+(x / y * 100).toPrecision(6)) + '%' : '—'; }
    function c3() { const o = +a3.value, n = +b3.value; r3.textContent = o ? (n >= o ? '+' : '') + (+((n - o) / o * 100).toPrecision(6)) + '%' : '—'; }
    const body = h('div', {},
      h('div', { class: 'panel' }, h('p', { class: 'field__label' }, 'What is X% of Y?'),
        h('div', { class: 'grid-2' }, field('X (%)', a1), field('Y', b1)), result(r1)),
      h('div', { class: 'panel' }, h('p', { class: 'field__label' }, 'X is what percent of Y?'),
        h('div', { class: 'grid-2' }, field('X', a2), field('Y', b2)), result(r2)),
      h('div', { class: 'panel' }, h('p', { class: 'field__label' }, 'Percentage change from old to new'),
        h('div', { class: 'grid-2' }, field('Old', a3), field('New', b3)), result(r3)),
    );
    root.appendChild(toolShell(this, body));
    c1(); c2(); c3();
  },
};

/* ---------------- BMI Calculator ---------------- */
export const bmiCalculator = {
  id: 'bmi-calculator', name: 'BMI Calculator', category: CAT, icon: ICONS.gauge,
  description: 'Body Mass Index with a visual category bar (metric or imperial).',
  keywords: 'bmi body mass index weight height health metric imperial',
  render(root) {
    let metric = true;
    const hIn = num({ value: 175, oninput: calc }), wIn = num({ value: 70, oninput: calc });
    const hL = field('Height (cm)', hIn), wL = field('Weight (kg)', wIn);
    const big = h('div', { class: 'big-num' }, '—'), catEl = h('div', { class: 'calc-sub' }, '');
    const bar = h('div', { class: 'bmi-bar' }, h('span', { class: 'bmi-bar__marker' }));
    function calc() {
      let h_ = +hIn.value, w = +wIn.value;
      if (metric) { h_ = h_ / 100; } else { h_ = h_ * 0.0254; w = w * 0.453592; }
      if (!h_ || !w) { big.textContent = '—'; return; }
      const bmi = w / (h_ * h_);
      big.textContent = bmi.toFixed(1);
      const cats = [[18.5, 'Underweight', '#5aa9ff'], [25, 'Normal', '#41d18f'], [30, 'Overweight', '#ffb454'], [99, 'Obese', '#ff6d6d']];
      const c = cats.find(c => bmi < c[0]);
      catEl.textContent = c[1]; catEl.style.color = c[2];
      bar.querySelector('.bmi-bar__marker').style.left = `${Math.max(0, Math.min(100, (bmi - 12) / (40 - 12) * 100))}%`;
    }
    const toggle = h('div', { class: 'segmented' },
      h('button', { class: 'seg seg--on', onclick: e => { metric = true; hL.querySelector('.field__label').textContent = 'Height (cm)'; wL.querySelector('.field__label').textContent = 'Weight (kg)'; segOn(e); calc(); } }, 'Metric'),
      h('button', { class: 'seg', onclick: e => { metric = false; hL.querySelector('.field__label').textContent = 'Height (in)'; wL.querySelector('.field__label').textContent = 'Weight (lb)'; segOn(e); calc(); } }, 'Imperial'));
    function segOn(e) { toggle.querySelectorAll('.seg').forEach(s => s.classList.remove('seg--on')); e.target.classList.add('seg--on'); }
    const body = h('div', {}, h('div', { class: 'panel' }, toggle, h('div', { class: 'grid-2' }, hL, wL)),
      h('div', { class: 'output' }, h('div', { class: 'calc-result' }, big, catEl, bar)));
    root.appendChild(toolShell(this, body)); calc();
  },
};

/* ---------------- Tip Calculator ---------------- */
export const tipCalculator = {
  id: 'tip-calculator', name: 'Tip Calculator', category: CAT, icon: ICONS.calc,
  description: 'Calculate tip, total and split the bill between people.',
  keywords: 'tip gratuity bill split restaurant percentage',
  render(root) {
    const bill = num({ value: 50, step: '0.01', oninput: calc });
    const tip = num({ value: 18, oninput: calc });
    const people = num({ value: 2, min: 1, oninput: calc });
    const tipAmt = h('div', { class: 'big-num' }, '—');
    const stats = h('div', { class: 'stats' });
    function calc() {
      const b = +bill.value, t = +tip.value, p = Math.max(1, +people.value || 1);
      const tipTotal = b * t / 100, total = b + tipTotal;
      tipAmt.textContent = '$' + tipTotal.toFixed(2);
      stats.innerHTML = '';
      stats.append(stat('$' + total.toFixed(2), 'Total'), stat('$' + (total / p).toFixed(2), 'Per person'), stat('$' + (tipTotal / p).toFixed(2), 'Tip / person'));
    }
    const body = h('div', {}, h('div', { class: 'panel' }, field('Bill amount ($)', bill),
      field('Tip (%)', tip), field('Split between', people)),
      h('div', { class: 'output' }, h('div', { class: 'calc-result' }, h('div', { class: 'calc-sub' }, 'Tip amount'), tipAmt, stats)));
    root.appendChild(toolShell(this, body)); calc();
  },
};

/* ---------------- Mortgage Calculator ---------------- */
export const mortgageCalculator = {
  id: 'mortgage-calculator', name: 'Mortgage / Loan Calculator', category: CAT, icon: ICONS.calc,
  description: 'Monthly payment, total interest and full amortization summary.',
  keywords: 'mortgage loan payment interest amortization principal repayment',
  render(root) {
    const amount = num({ value: 300000, oninput: calc }), rate = num({ value: 5.5, step: '0.01', oninput: calc }), years = num({ value: 30, oninput: calc });
    const big = h('div', { class: 'big-num' }, '—'); const stats = h('div', { class: 'stats' });
    function calc() {
      const P = +amount.value, r = (+rate.value) / 100 / 12, n = (+years.value) * 12;
      if (!P || !n) { big.textContent = '—'; stats.innerHTML = ''; return; }
      const m = r === 0 ? P / n : P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
      const total = m * n;
      big.textContent = '$' + m.toFixed(2);
      stats.innerHTML = '';
      stats.append(stat('$' + total.toFixed(0), 'Total paid'), stat('$' + (total - P).toFixed(0), 'Total interest'), stat(n, 'Payments'));
    }
    const body = h('div', {}, h('div', { class: 'panel' }, field('Loan amount ($)', amount), field('Annual interest rate (%)', rate), field('Term (years)', years)),
      h('div', { class: 'output' }, h('div', { class: 'calc-result' }, h('div', { class: 'calc-sub' }, 'Monthly payment'), big, stats)));
    root.appendChild(toolShell(this, body)); calc();
  },
};

/* ---------------- Meeting Cost Calculator ---------------- */
export const meetingCost = {
  id: 'meeting-cost', name: 'Meeting Cost Calculator', category: CAT, icon: ICONS.clock,
  description: 'Watch the real-time burn rate of a meeting tick up live.',
  keywords: 'meeting cost burn rate salary hourly waste time money',
  render(root) {
    let timer = null, seconds = 0;
    const people = num({ value: 5, min: 1 }), rate = num({ value: 60, min: 1 });
    const big = h('div', { class: 'big-num' }, '$0.00'); const sub = h('div', { class: 'calc-sub' }, 'Not started');
    function perSec() { return (+people.value) * (+rate.value) / 3600; }
    function tick() { seconds++; big.textContent = '$' + (perSec() * seconds).toFixed(2); sub.textContent = `${Math.floor(seconds / 60)}m ${seconds % 60}s · $${(perSec() * 3600).toFixed(0)}/hr burn`; }
    const startBtn = h('button', { class: 'btn btn--primary', onclick: () => {
      if (timer) { clearInterval(timer); timer = null; startBtn.textContent = 'Resume'; }
      else { timer = setInterval(tick, 1000); startBtn.textContent = 'Pause'; }
    } }, 'Start meeting');
    const resetBtn = h('button', { class: 'btn', onclick: () => { clearInterval(timer); timer = null; seconds = 0; big.textContent = '$0.00'; sub.textContent = 'Not started'; startBtn.textContent = 'Start meeting'; } }, 'Reset');
    onCleanup(() => clearInterval(timer));
    const body = h('div', {}, h('div', { class: 'panel' }, h('div', { class: 'grid-2' }, field('Attendees', people), field('Avg hourly rate ($)', rate)),
      h('div', { class: 'panel__actions' }, startBtn, resetBtn)),
      h('div', { class: 'output' }, h('div', { class: 'calc-result' }, big, sub)));
    root.appendChild(toolShell(this, body));
  },
};

function stat(numv, label) { return h('div', { class: 'stat' }, h('span', { class: 'stat__num' }, String(numv)), h('span', { class: 'stat__label' }, label)); }

export default [ageCalculator, unitConverter, percentageCalculator, bmiCalculator, tipCalculator, mortgageCalculator, meetingCost];
