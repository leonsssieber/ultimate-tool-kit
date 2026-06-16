// app.js — registry, dashboard grid, search and hash routing.
import { h, ICONS } from './core.js';
import imageTools from './tools/images.js';
import pdfTools from './tools/pdf.js';
import mediaTools from './tools/media.js';
import aiTools from './tools/ai.js';
import docTools from './tools/docs.js';
import utilTools from './tools/utils.js';

const TOOLS = [...imageTools, ...aiTools, ...pdfTools, ...docTools, ...mediaTools, ...utilTools];
const byId = Object.fromEntries(TOOLS.map(t => [t.id, t]));

const CATEGORY_ORDER = ['Image', 'AI & Effects', 'PDF', 'Documents', 'Audio', 'Video', 'Utilities'];
const CATEGORY_ICON = {
  Image: ICONS.image, 'AI & Effects': ICONS.wand, PDF: ICONS.pdf,
  Documents: ICONS.doc, Audio: ICONS.audio, Video: ICONS.video, Utilities: ICONS.tools,
};

const appEl = document.getElementById('app');
const sidebarNav = document.getElementById('sidebar-nav');
const searchInput = document.getElementById('search');

/* ---------- theme ---------- */
const themeBtn = document.getElementById('theme-toggle');
function setTheme(t) {
  document.documentElement.dataset.theme = t;
  localStorage.setItem('utk-theme', t);
  themeBtn.innerHTML = t === 'dark' ? ICONS.sun : ICONS.moon;
}
setTheme(localStorage.getItem('utk-theme') || 'dark');
themeBtn.addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));

/* ---------- sidebar ---------- */
function buildSidebar() {
  sidebarNav.innerHTML = '';
  const home = h('a', { class: 'navlink navlink--home', href: '#/' }, h('span', { class: 'navlink__icon', html: ICONS.tools }), 'All tools');
  sidebarNav.appendChild(home);
  for (const cat of CATEGORY_ORDER) {
    const tools = TOOLS.filter(t => t.category === cat);
    if (!tools.length) continue;
    sidebarNav.appendChild(h('p', { class: 'nav-cat' }, cat));
    tools.forEach(t => sidebarNav.appendChild(
      h('a', { class: 'navlink', href: `#/tool/${t.id}`, dataset: { id: t.id } },
        h('span', { class: 'navlink__icon', html: t.icon }), t.name)));
  }
}

function highlightNav(id) {
  document.querySelectorAll('.navlink').forEach(a => a.classList.toggle('navlink--active', a.dataset.id === id));
}

/* ---------- dashboard ---------- */
function renderHome(filter = '') {
  highlightNav(null);
  appEl.innerHTML = '';
  appEl.scrollTop = 0;
  const f = filter.trim().toLowerCase();

  if (!f) {
    appEl.appendChild(h('div', { class: 'hero' },
      h('h1', { class: 'hero__title' }, 'Everything you need, ', h('span', { class: 'grad' }, 'all in one place')),
      h('p', { class: 'hero__sub' }, `${TOOLS.length} free tools to convert files, edit media and more — running entirely in your browser. No uploads, no ads, no sign-up.`),
    ));
  }

  const matches = TOOLS.filter(t => !f || (t.name + ' ' + t.description + ' ' + (t.keywords || '') + ' ' + t.category).toLowerCase().includes(f));

  if (!matches.length) {
    appEl.appendChild(h('p', { class: 'empty' }, `No tools match “${filter}”.`));
    return;
  }

  for (const cat of CATEGORY_ORDER) {
    const tools = matches.filter(t => t.category === cat);
    if (!tools.length) continue;
    const grid = h('div', { class: 'grid' });
    tools.forEach(t => grid.appendChild(
      h('a', { class: 'card', href: `#/tool/${t.id}` },
        h('div', { class: 'card__icon', html: t.icon }),
        h('h3', { class: 'card__title' }, t.name),
        h('p', { class: 'card__desc' }, t.description),
      )));
    appEl.appendChild(h('section', { class: 'cat' },
      h('h2', { class: 'cat__title' }, h('span', { class: 'cat__icon', html: CATEGORY_ICON[cat] }), cat,
        h('span', { class: 'cat__count' }, tools.length)),
      grid,
    ));
  }
}

function renderTool(id) {
  const tool = byId[id];
  if (!tool) return renderHome();
  highlightNav(id);
  appEl.innerHTML = '';
  appEl.scrollTop = 0;
  appEl.appendChild(h('a', { class: 'backlink', href: '#/' }, h('span', { html: ICONS.back }), 'All tools'));
  try {
    tool.render(appEl);
  } catch (e) {
    console.error(e);
    appEl.appendChild(h('p', { class: 'empty' }, 'This tool failed to load: ' + e.message));
  }
}

/* ---------- router ---------- */
function route() {
  const hash = location.hash || '#/';
  const m = hash.match(/^#\/tool\/(.+)$/);
  if (m) renderTool(m[1]);
  else renderHome(searchInput.value);
}

searchInput.addEventListener('input', () => {
  if (location.hash && location.hash !== '#/') location.hash = '#/';
  else renderHome(searchInput.value);
});

window.addEventListener('hashchange', route);
buildSidebar();
route();
