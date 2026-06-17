// app.js — registry, top pill nav, hero, category tabs and hash routing.
import { h, ICONS, runCleanups } from './core.js';
import imageTools from './tools/images.js';
import pdfTools from './tools/pdf.js';
import mediaTools from './tools/media.js';
import aiTools from './tools/ai.js';
import docTools from './tools/docs.js';
import utilTools from './tools/utils.js';
import calcTools from './tools/calculators.js';
import timeTools from './tools/time.js';
import testTools from './tools/tests.js';
import creativeTools from './tools/creative.js';
import funTools from './tools/fun.js';
import textTools from './tools/textcode.js';
import dataTools from './tools/data.js';
import weirdTools from './tools/weird.js';

const TOOLS = [...imageTools, ...aiTools, ...pdfTools, ...docTools, ...mediaTools, ...textTools, ...dataTools, ...calcTools, ...timeTools, ...creativeTools, ...testTools, ...weirdTools, ...funTools, ...utilTools];
const byId = Object.fromEntries(TOOLS.map(t => [t.id, t]));

const CATEGORY_ORDER = ['Image', 'PDF', 'Documents', 'Audio', 'Video', 'AI & Effects', 'Text & Code', 'Data', 'Calculators', 'Time', 'Creative', 'Tests', 'Weird Converters', 'Fun', 'Utilities'];
const GRID_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>';
const SPARK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/></svg>';
const SEARCH_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>';
const CAT_ICON = {
  Image: ICONS.image, 'AI & Effects': SPARK_ICON, PDF: ICONS.pdf,
  Documents: ICONS.doc, Audio: ICONS.audio, Video: ICONS.video, Utilities: ICONS.tools,
  'Text & Code': ICONS.code, Data: ICONS.calc, Calculators: ICONS.calc, Time: ICONS.clock,
  Creative: ICONS.palette, Tests: ICONS.gauge, Fun: ICONS.dice, 'Weird Converters': ICONS.shuffle,
};
const catCount = (c) => TOOLS.filter(t => t.category === c).length;

const appEl = document.getElementById('app');
const topnavEl = document.getElementById('topnav');

const state = { cat: 'All', q: '' };

/* ---------- theme ---------- */
function setTheme(t) {
  document.documentElement.dataset.theme = t;
  localStorage.setItem('utk-theme', t);
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.innerHTML = t === 'dark' ? ICONS.sun : ICONS.moon;
}

/* ---------- top pill nav (built once) ---------- */
function buildTopnav() {
  topnavEl.innerHTML = '';
  const brand = h('a', { class: 'brandbadge', href: '#/', title: 'Ultimate Toolkit' }, 'UT');
  brand.addEventListener('click', () => { state.cat = 'All'; });
  topnavEl.appendChild(brand);

  const all = h('button', { class: 'navicon', dataset: { cat: 'All' }, title: 'All tools', html: GRID_ICON, onclick: () => pickCat('All') });
  topnavEl.appendChild(all);
  topnavEl.appendChild(h('div', { class: 'nav-sep' }));

  CATEGORY_ORDER.forEach(cat => {
    topnavEl.appendChild(h('button', {
      class: 'navicon', dataset: { cat }, title: cat, html: CAT_ICON[cat], onclick: () => pickCat(cat),
    }));
  });

  topnavEl.appendChild(h('div', { class: 'nav-sep' }));
  const theme = h('button', { id: 'theme-toggle', class: 'navicon', title: 'Toggle theme', onclick: () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark') });
  topnavEl.appendChild(theme);
  setTheme(localStorage.getItem('utk-theme') || 'dark');
}

function pickCat(cat) {
  state.cat = cat;
  if (location.hash && location.hash !== '#/') location.hash = '#/';
  else { updateGrid(); syncNav(); }
}

function syncNav() {
  topnavEl.querySelectorAll('.navicon[data-cat]').forEach(b =>
    b.classList.toggle('navicon--active', b.dataset.cat === state.cat));
}

/* ---------- home ---------- */
let gridEl = null, tabsEl = null, countEl = null;

function renderHome() {
  appEl.innerHTML = '';

  // hero
  const stats = h('div', { class: 'stats4' },
    statBox(String(TOOLS.length), 'Total tools', 'all free'),
    statBox(String(CATEGORY_ORDER.length), 'Categories', 'workflows'),
    statBox('100%', 'Local & private', 'no uploads'),
    statBox('0', 'Ads or sign-ups', 'forever'),
  );
  const hero = h('section', { class: 'hero' },
    h('span', { class: 'hero__badge' }, '⌘ Tool Library'),
    h('div', { class: 'hero__grid' },
      h('div', {},
        h('h1', { class: 'hero__title' }, 'Convert anything,', h('br'), 'right in your browser.'),
        h('p', { class: 'hero__sub' }, `${TOOLS.length} tools to transform files, edit media and more — running entirely on your device. No uploads, no ads, no account.`),
      ),
      stats,
    ),
    buildTabs(),
  );
  appEl.appendChild(hero);

  // search
  const input = h('input', {
    class: 'searchbar__input', type: 'search', placeholder: 'Search tools, formats, actions…',
    autocomplete: 'off', value: state.q,
    oninput: (e) => { state.q = e.target.value; updateGrid(); },
  });
  appEl.appendChild(h('div', { class: 'searchbar' },
    h('span', { class: 'searchbar__icon', html: SEARCH_ICON }),
    input,
    h('kbd', { class: 'kbd-hint', title: 'Press / to search' }, '/'),
    h('span', { class: 'searchbar__chip', html: `${GRID_ICON} <span>${state.cat === 'All' ? 'All tools' : state.cat}</span>` }),
    h('button', { class: 'searchbar__btn', html: SEARCH_ICON, onclick: () => input.focus() }),
  ));

  // grid
  countEl = h('p', { class: 'results-count' });
  appEl.appendChild(countEl);
  gridEl = h('div', { class: 'grid' });
  appEl.appendChild(gridEl);
  updateGrid();
  syncNav();
}

function statBox(num, label, sub) {
  return h('div', { class: 'statbox' },
    h('div', { class: 'statbox__num' }, num),
    h('div', { class: 'statbox__label' }, label),
    h('div', { class: 'statbox__sub' }, sub),
  );
}

function buildTabs() {
  tabsEl = h('div', { class: 'cattabs' });
  const tabs = [{ key: 'All', label: 'All Tools', icon: GRID_ICON, count: TOOLS.length },
    ...CATEGORY_ORDER.map(c => ({ key: c, label: c, icon: CAT_ICON[c], count: catCount(c) }))];
  tabs.forEach(t => tabsEl.appendChild(h('button', {
    class: 'cattab', dataset: { cat: t.key },
    onclick: () => { state.cat = t.key; updateGrid(); syncNav(); },
  },
    h('span', { html: t.icon }), t.label, h('span', { class: 'cattab__count' }, String(t.count)),
  )));
  return tabsEl;
}

function updateGrid() {
  if (!gridEl) return;
  const q = state.q.trim().toLowerCase();
  const matches = TOOLS.filter(t =>
    (state.cat === 'All' || t.category === state.cat) &&
    (!q || (t.name + ' ' + t.description + ' ' + (t.keywords || '') + ' ' + t.category).toLowerCase().includes(q)));

  gridEl.innerHTML = '';
  if (!matches.length) {
    gridEl.appendChild(h('p', { class: 'empty' }, q ? `No tools match “${state.q}”.` : 'No tools here.'));
  } else {
    matches.forEach(t => gridEl.appendChild(
      h('a', { class: 'card', href: `#/tool/${t.id}` },
        h('div', { class: 'card__icon', html: t.icon }),
        h('div', { class: 'card__text' },
          h('h3', { class: 'card__title' }, t.name),
          h('p', { class: 'card__desc', title: t.description }, t.description),
        ),
      )));
  }

  // sync tab active + search chip + count
  tabsEl?.querySelectorAll('.cattab').forEach(b => b.classList.toggle('cattab--active', b.dataset.cat === state.cat));
  const chip = appEl.querySelector('.searchbar__chip span');
  if (chip) chip.textContent = state.cat === 'All' ? 'All tools' : state.cat;
  if (countEl) {
    const n = matches.length;
    countEl.textContent = `${n} tool${n === 1 ? '' : 's'}`
      + (state.cat !== 'All' ? ` in ${state.cat}` : '')
      + (q ? ` matching “${state.q}”` : '');
  }
}

/* ---------- tool view ---------- */
function renderTool(id) {
  const tool = byId[id];
  if (!tool) return renderHome();
  gridEl = null; tabsEl = null; countEl = null;
  appEl.innerHTML = '';
  window.scrollTo(0, 0);
  appEl.appendChild(h('a', { class: 'backlink', href: '#/' }, h('span', { html: ICONS.back }), 'All tools'));
  try { tool.render(appEl); }
  catch (e) { console.error(e); appEl.appendChild(h('p', { class: 'empty' }, 'This tool failed to load: ' + e.message)); }
  syncNav();
}

/* ---------- router ---------- */
function route() {
  runCleanups(); // stop timers/streams/animations from the previous view
  const m = (location.hash || '#/').match(/^#\/tool\/(.+)$/);
  if (m) renderTool(m[1]);
  else renderHome();
}

window.addEventListener('hashchange', route);

// keyboard shortcuts: "/" focuses search, Esc clears search or returns home
window.addEventListener('keydown', (e) => {
  const tag = (e.target.tagName || '').toLowerCase();
  const typing = tag === 'input' || tag === 'textarea' || e.target.isContentEditable;
  if (e.key === '/' && !typing) {
    if (location.hash && location.hash !== '#/') { state.cat = state.cat; location.hash = '#/'; }
    const s = document.querySelector('.searchbar__input');
    if (s) { e.preventDefault(); s.focus(); }
  } else if (e.key === 'Escape') {
    const s = document.querySelector('.searchbar__input');
    if (s && s.value) { state.q = ''; s.value = ''; updateGrid(); s.blur(); }
    else if (location.hash && location.hash !== '#/') location.hash = '#/';
  }
});

buildTopnav();
route();
