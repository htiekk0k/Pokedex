{
'use strict';
const D = window.DEXDATA;
const N = window.Native || null;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const API = 'https://pokeapi.co/api/v2/';
const SD = 'https://play.pokemonshowdown.com/data/';
const DAY = 86400;
const netUrl = (u, ttl = 30 * DAY) => '/net?ttl=' + ttl + '&u=' + encodeURIComponent(u);
const imgUrl = u => netUrl(u, -1);
const memo = new Map();
function getJSON(u, ttl) {
  if (!memo.has(u)) {
    memo.set(u, fetch(netUrl(u, ttl)).then(r => {
      if (!r.ok) throw new Error(r.status === 504 ? 'offline' : 'HTTP ' + r.status);
      return r.json();
    }).catch(err => { memo.delete(u); throw err; }));
  }
  return memo.get(u);
}

const toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/♀/g, 'f').replace(/♂/g, 'm').replace(/[^a-z0-9]/g, '');
const title = slug => String(slug || '').split('-').map(w => w ? w[0].toUpperCase() + w.slice(1) : w).join(' ');
const pad = n => '#' + String(n).padStart(4, '0');
const ROMAN_N = {i:1, ii:2, iii:3, iv:4, v:5, vi:6, vii:7, viii:8, ix:9, x:10};
const genFromName = name => ROMAN_N[String(name || '').split('-')[1]] || 99;
const idFromUrl = u => parseInt(String(u).split('/').filter(Boolean).pop(), 10);
const en = arr => (arr || []).filter(x => x.language && x.language.name === 'en');

// ------------------------------------------------------------- settings
const DEF = {gen: 9, rate: 0.95, pitch: 0.85, autoRead: true, format: 'ou'};
let S = (() => { try { return {...DEF, ...JSON.parse(localStorage.getItem('dex.settings') || '{}')}; } catch (e) { return {...DEF}; } })();
S.gen = 9; // no generation setting: pages use the latest data, with per-game pickers
const save = () => { try { localStorage.setItem('dex.settings', JSON.stringify(S)); } catch (e) { /* ignore */ } };

// ----------------------------------------------------------------- index
let INDEX = [], BYID = {}, BYNUM = {}, BASES = {}, NAMEMAP = new Map();
const REGION_ADJ = {Alola:'Alolan', Galar:'Galarian', Hisui:'Hisuian', Paldea:'Paldean'};

function formeGen(e) {
  const g = D.genOfNum(e.num), f = e.forme || '';
  if (!f) return g;
  if (/^(Mega|Primal)/.test(f)) return Math.max(6, g);
  if (/Alola/.test(f)) return 7;
  if (/Galar|Gmax|Hisui/.test(f)) return 8;
  if (/Paldea/.test(f)) return 9;
  return g;
}
function displayName(e) {
  if (!e.forme) return e.name;
  const f = e.forme;
  for (const [k, adj] of Object.entries(REGION_ADJ)) if (f.startsWith(k)) {
    const rest = f.slice(k.length).replace(/^-/, '');
    return adj + ' ' + e.base + (rest ? ' (' + rest.replace(/-/g, ' ') + ')' : '');
  }
  if (f.startsWith('Mega')) return 'Mega ' + e.base + f.slice(4).replace(/-/g, ' ');
  if (f === 'Primal') return 'Primal ' + e.base;
  if (f === 'Gmax') return 'Gigantamax ' + e.base;
  return e.base + ' (' + f.replace(/-/g, ' ') + ')';
}
function formeLabel(e) {
  const f = e.forme;
  for (const [k, adj] of Object.entries(REGION_ADJ)) if (f.startsWith(k)) return adj + ' form' + (f.length > k.length ? ' · ' + f.slice(k.length + 1).replace(/-/g, ' ') : '');
  if (f.startsWith('Mega')) return 'Mega Evolution' + f.slice(4).replace(/-/g, ' ');
  if (f === 'Gmax') return 'Gigantamax';
  return f.replace(/-/g, ' ') + ' form';
}
function spriteOf(e) {
  const pkapi = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/' + e.num + '.png';
  const sd = 'https://play.pokemonshowdown.com/sprites/gen5/' + toID(e.base) + (e.forme ? '-' + toID(e.forme) : '') + '.png';
  return e.forme ? [sd, pkapi] : [pkapi, sd];
}
const imgTag = (urls, alt, cls = '') =>
  `<img class="${cls}" loading="lazy" alt="${esc(alt)}" src="${imgUrl(urls[0])}"${urls[1] ? ` data-fb="${imgUrl(urls[1])}"` : ''}>`;
document.addEventListener('error', ev => {
  const t = ev.target;
  if (t && t.tagName === 'IMG' && t.dataset.fb) { const fb = t.dataset.fb; delete t.dataset.fb; t.src = fb; }
}, true);

async function loadIndex() {
  const dex = await getJSON(SD + 'pokedex.json', 7 * DAY);
  const out = [];
  for (const [id, e] of Object.entries(dex)) {
    if (!e || !(e.num > 0) || !e.name) continue;
    if (['CAP', 'Custom', 'Future'].includes(e.isNonstandard)) continue;
    const forme = e.forme || '';
    if (/Totem|Starter|Pokestar/.test(forme)) continue;
    const bs = e.baseStats || {};
    out.push({id, name: e.name, num: e.num, base: e.baseSpecies || e.name, forme,
      types: e.types || ['Normal'], gen: formeGen(e), bs,
      bst: ['hp', 'atk', 'def', 'spa', 'spd', 'spe'].reduce((t, k) => t + (bs[k] || 0), 0),
      abilities: Object.values(e.abilities || {}), tags: e.tags || [], tier: e.tier || '',
      evos: (e.evos || []).length > 0, prevo: !!e.prevo});
  }
  out.sort((a, b) => a.num - b.num || (a.forme ? 1 : 0) - (b.forme ? 1 : 0));
  INDEX = out;
  for (const e of out) {
    BYID[e.id] = e;
    if (!e.forme && !BYNUM[e.num]) BYNUM[e.num] = e;
    (BASES[e.base] = BASES[e.base] || []).push(e);
    const keys = [norm(e.name)];
    if (e.forme) {
      for (const [k, adj] of Object.entries(REGION_ADJ)) if (e.forme === k) keys.push(norm(adj + e.base));
      if (e.forme.startsWith('Mega')) keys.push(norm('Mega' + e.base + e.forme.slice(4)));
      if (e.forme === 'Primal') keys.push(norm('Primal' + e.base));
    }
    for (const k of keys) if (k && !NAMEMAP.has(k)) NAMEMAP.set(k, e);
  }
}

// ---------------------------------------------------------- type badges
const tb = t => `<span class="tb${D.LIGHT_TYPES.has(t) ? ' light' : ''}" style="background:${D.TYPE_COLOR[t] || '#888'}">${esc(t)}</span>`;

// ================================================================ HOME
let query = '', limit = 60, homeScroll = 0;
// Filters (this session). types: must have all (max 2); other groups: any of.
const F0 = () => ({types: [], gens: [], cats: [], evo: '', tiers: [], ability: '', forms: 'all', sort: 'num'});
let F = F0();
const CATS = [['legendary', 'Legendary'], ['mythical', 'Mythical'], ['ultrabeast', 'Ultra Beast'], ['paradox', 'Paradox'],
  ['mega', 'Mega & Primal'], ['regional', 'Regional forms'], ['gmax', 'Gigantamax']];
const EVOS = [['', 'Any'], ['final', 'Fully evolved'], ['nfe', 'Can still evolve'], ['single', 'Doesn’t evolve']];
const TIERS = [['Uber', 'Ubers'], ['OU', 'OU'], ['UUBL', 'UUBL'], ['UU', 'UU'], ['RUBL', 'RUBL'], ['RU', 'RU'], ['NUBL', 'NUBL'], ['NU', 'NU'],
  ['PUBL', 'PUBL'], ['PU', 'PU'], ['ZUBL', 'ZUBL'], ['ZU', 'ZU'], ['LC', 'LC'], ['NFE', 'NFE'], ['AG', 'AG']];
const SORTS = [['num', 'Number'], ['name', 'Name (A–Z)'], ['bst', 'Base stat total'], ['hp', 'HP'], ['atk', 'Attack'],
  ['def', 'Defense'], ['spa', 'Sp. Atk'], ['spd', 'Sp. Def'], ['spe', 'Speed']];
const STAT_SHORT = {bst: 'BST', hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe'};
const REGIONAL = /^(Alola|Galar|Hisui|Paldea)/;
function catOf(e, c) {
  switch (c) {
    case 'legendary': return e.tags.includes('Sub-Legendary') || e.tags.includes('Restricted Legendary');
    case 'mythical': return e.tags.includes('Mythical');
    case 'ultrabeast': return e.tags.includes('Ultra Beast');
    case 'paradox': return e.tags.includes('Paradox');
    case 'mega': return /^(Mega|Primal)/.test(e.forme);
    case 'regional': return REGIONAL.test(e.forme);
    case 'gmax': return e.forme === 'Gmax';
  }
  return false;
}
const tierKey = t => String(t || '').replace(/[()]/g, '');
function filterCount() {
  return F.types.length + F.gens.length + F.cats.length + (F.evo ? 1 : 0) + F.tiers.length + (F.ability.trim() ? 1 : 0) + (F.forms !== 'all' ? 1 : 0);
}
function passes(e) {
  if (F.types.length && !F.types.every(t => e.types.includes(t))) return false;
  if (F.gens.length && !F.gens.includes(e.gen)) return false;
  if (F.cats.length && !F.cats.some(c => catOf(e, c))) return false;
  if (F.forms === 'base' && e.forme) return false;
  if (F.evo === 'final' && e.evos) return false;
  if (F.evo === 'nfe' && !e.evos) return false;
  if (F.evo === 'single' && (e.evos || e.prevo)) return false;
  if (F.tiers.length && !F.tiers.includes(tierKey(e.tier))) return false;
  const ab = norm(F.ability);
  if (ab && !e.abilities.some(a => norm(a).includes(ab))) return false;
  return true;
}

function filtered() {
  const raw = query.trim();
  const qNum = /^#?\d+$/.test(raw) ? parseInt(raw.replace('#', ''), 10) : null;
  const q = norm(raw);
  const list = INDEX.filter(e => {
    if (!passes(e)) return false;
    if (!raw) return true;
    if (qNum !== null) return e.num === qNum || String(e.num).startsWith(String(qNum));
    return norm(e.name).includes(q) || norm(displayName(e)).includes(q);
  });
  if (F.sort === 'name') list.sort((a, b) => displayName(a).localeCompare(displayName(b)));
  else if (F.sort === 'bst') list.sort((a, b) => b.bst - a.bst || a.num - b.num);
  else if (F.sort !== 'num') list.sort((a, b) => (b.bs[F.sort] || 0) - (a.bs[F.sort] || 0) || a.num - b.num);
  return list;
}

function renderTypeFilter() {
  const n = filterCount();
  $('#typeFilter').innerHTML = `<button type="button" class="chip filt" data-act="filters" aria-pressed="${n > 0}"><svg><use href="#i-filter"/></svg>Filters${n ? ` · ${n}` : ''}</button>` +
    `<button type="button" class="chip" data-type="" aria-pressed="${!F.types.length}">All types</button>` +
    D.TYPES.map(t => `<button type="button" class="chip t${D.LIGHT_TYPES.has(t) ? ' light' : ''}" style="background:${D.TYPE_COLOR[t]}" data-type="${t}" aria-pressed="${F.types.includes(t)}">${t}</button>`).join('');
}
function toggleType(t) {
  if (!t) F.types = [];
  else if (F.types.includes(t)) F.types = F.types.filter(x => x !== t);
  else F.types = [...F.types, t].slice(-2);
}

function renderList(reset) {
  if (reset) limit = 60;
  const list = filtered();
  const n = filterCount();
  const sortLabel = F.sort !== 'num' ? ' · sorted by ' + SORTS.find(x => x[0] === F.sort)[1].toLowerCase() : '';
  $('#count').innerHTML = `${list.length.toLocaleString()} Pokémon${esc(sortLabel)}${n || F.sort !== 'num' ? ` · <button type="button" class="linkish" data-act="filters-reset">Clear</button>` : ''}`;
  const stat = F.sort in STAT_SHORT ? F.sort : null;
  $('#list').innerHTML = list.slice(0, limit).map(e => `<li><button type="button" class="dex-row" data-id="${e.id}">
      ${imgTag(spriteOf(e), e.name)}
      <span class="meta"><span class="num">${pad(e.num)}${stat ? ` · <b class="statv">${STAT_SHORT[stat]} ${stat === 'bst' ? e.bst : (e.bs[stat] || 0)}</b>` : ''}</span><span class="nm">${esc(e.forme ? displayName(e) : e.name)}${e.forme ? `<small>${esc(formeLabel(e))}</small>` : ''}</span></span>
      <span class="types">${e.types.map(tb).join('')}</span></button></li>`).join('');
  $('#homeMsg').innerHTML = list.length ? '' :
    `<div class="msg"><b>No match</b>${query.trim() ? `Nothing matches “${esc(query)}”${n ? ' with these filters' : ''}.` : 'No Pokémon match these filters.'}${n ? `<br><br><button type="button" class="btn" data-act="filters-reset">Clear filters</button>` : ''}</div>`;
  $('#more').dataset.left = Math.max(0, list.length - limit);
}

function filterSheet() {
  const chip = (group, v, l, on) => `<button type="button" class="chip" data-f="${group}" data-v="${esc(v)}" aria-pressed="${on}">${esc(l)}</button>`;
  const typeChip = t => `<button type="button" class="chip t${D.LIGHT_TYPES.has(t) ? ' light' : ''}" style="background:${D.TYPE_COLOR[t]}" data-f="types" data-v="${t}" aria-pressed="${F.types.includes(t)}">${t}</button>`;
  openSheet(`<h2>Filters</h2>
    <h3>Type <small class="note">pick up to 2</small></h3><div class="wrap">${D.TYPES.map(typeChip).join('')}</div>
    <h3>Introduced in</h3><div class="wrap">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(g => chip('gens', g, `Gen ${D.ROMAN[g]} · ${D.GENS[g].region}`, F.gens.includes(g))).join('')}</div>
    <h3>Category</h3><div class="wrap">${CATS.map(([v, l]) => chip('cats', v, l, F.cats.includes(v))).join('')}</div>
    <h3>Forms</h3><div class="wrap">${chip('forms', 'all', 'Show all forms', F.forms === 'all')}${chip('forms', 'base', 'Base forms only', F.forms === 'base')}</div>
    <h3>Evolution</h3><div class="wrap">${EVOS.map(([v, l]) => chip('evo', v, l, F.evo === v)).join('')}</div>
    <h3>Smogon tier <small class="note">current Gen IX singles</small></h3><div class="wrap">${TIERS.map(([v, l]) => chip('tiers', v, l, F.tiers.includes(v))).join('')}</div>
    <h3>Ability</h3><div class="field"><input id="fAbility" class="text-in" type="search" placeholder="e.g. Levitate, Intimidate" value="${esc(F.ability)}" autocomplete="off"></div>
    <h3>Sort by</h3><div class="wrap">${SORTS.map(([v, l]) => chip('sort', v, l, F.sort === v)).join('')}</div>
    <div class="sheet-actions"><button type="button" class="btn ghost" data-act="filters-reset">Reset</button>
      <button type="button" class="btn red" data-act="close-sheet" id="fShow">Show ${filtered().length.toLocaleString()} Pokémon</button></div>`);
}
function onFilterChip(group, v) {
  if (group === 'types') toggleType(v);
  else if (group === 'gens') { const g = +v; F.gens = F.gens.includes(g) ? F.gens.filter(x => x !== g) : [...F.gens, g]; }
  else if (group === 'cats' || group === 'tiers') F[group] = F[group].includes(v) ? F[group].filter(x => x !== v) : [...F[group], v];
  else F[group] = v;
  // refresh chip states + count without rebuilding the sheet (keeps scroll)
  $$('#sheetBody [data-f]').forEach(b => {
    const g = b.dataset.f, val = b.dataset.v;
    const on = g === 'types' ? F.types.includes(val) : g === 'gens' ? F.gens.includes(+val) : (g === 'cats' || g === 'tiers') ? F[g].includes(val) : F[g] === val;
    b.setAttribute('aria-pressed', on);
  });
  refreshAfterFilter();
}
function refreshAfterFilter() {
  const btn = $('#fShow');
  if (btn) btn.textContent = `Show ${filtered().length.toLocaleString()} Pokémon`;
  renderTypeFilter(); renderList(true);
}

function renderHome() {
  renderTypeFilter();
  renderList(true);
}

const moreObs = new IntersectionObserver(entries => {
  if (entries.some(x => x.isIntersecting) && +($('#more').dataset.left || 0) > 0) { limit += 90; renderList(false); }
}, {rootMargin: '600px'});
moreObs.observe($('#more'));

// ============================================================== ROUTER
let pendingAuto = false;
function go(id, auto) {
  pendingAuto = !!auto;
  const h = '#p-' + id;
  if (location.hash === h) route(); else location.hash = h;
}
function route() {
  const h = location.hash.slice(1);
  if (h.startsWith('p-')) {
    if (!$('#home').hidden) homeScroll = window.scrollY;
    $('#home').hidden = true; $('#detail').hidden = false;
    ready.then(() => showDetail(h.slice(2))).catch(() => {});
  } else {
    stopSpeaking();
    $('#detail').hidden = true; $('#home').hidden = false;
    requestAnimationFrame(() => window.scrollTo(0, homeScroll));
  }
}
window.addEventListener('hashchange', route);

// ============================================================= DETAIL
let cur = null, token = 0;

function pickVariety(species, e) {
  const vs = species.varieties || [];
  const def = vs.find(v => v.is_default) || vs[0];
  if (!e.forme) return def;
  const slug = e.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[.'’:%]/g, '')
    .replace(/\s+/g, '-').replace(/-+/g, '-');
  const fslug = e.forme.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return vs.find(v => v.pokemon.name === slug) || vs.find(v => v.pokemon.name.startsWith(slug + '-')) ||
    vs.find(v => v.pokemon.name.includes(fslug)) || def;
}

// Values as they were in the selected generation (PokéAPI keeps the history).
function pastPick(past, gen) {
  const list = (past || []).map(p => ({g: genFromName(p.generation && p.generation.name), p})).filter(x => x.g >= gen).sort((a, b) => a.g - b.g);
  return list.length ? list[0].p : null;
}
function typesAt(p, gen) {
  const past = pastPick(p.past_types, gen);
  return (past ? past.types : p.types).slice().sort((a, b) => a.slot - b.slot).map(x => title(x.type.name));
}
function abilitiesAt(p, gen) {
  const bySlot = {};
  for (const a of p.abilities || []) bySlot[a.slot] = a;
  const past = pastPick(p.past_abilities, gen);
  if (past) for (const a of past.abilities || []) { if (a.ability) bySlot[a.slot] = a; else delete bySlot[a.slot]; }
  let list = Object.values(bySlot).sort((a, b) => a.slot - b.slot);
  if (gen < 5) list = list.filter(a => !a.is_hidden);
  return list;
}
function statsAt(p, gen) {
  const m = {};
  for (const s of p.stats || []) m[s.stat.name] = {base: s.base_stat, effort: s.effort};
  const past = pastPick(p.past_stats, gen);
  if (past) for (const s of past.stats || []) if (m[s.stat.name]) m[s.stat.name] = {...m[s.stat.name], base: s.base_stat};
  return m;
}
const vgGen = vg => D.VG_GEN[vg] || 9;
const verGen = v => D.VERSION_GEN[v] || 9;

const VERSION_ORDER = Object.keys(D.VERSION_GEN);
function flavorFor(species) {
  const all = en(species.flavor_text_entries).map(f => ({v: f.version.name, g: verGen(f.version.name),
    text: f.flavor_text.replace(/[\f\n\r\u00ad]+/g, ' ').replace(/\s+/g, ' ').replace(/pok[eé]mon/gi, 'Pokémon').trim()}));
  const seen = new Set();
  const list = all.filter(f => !seen.has(f.v) && seen.add(f.v))
    .sort((a, b) => a.g - b.g || ((VERSION_ORDER.indexOf(a.v) + 1 || 999) - (VERSION_ORDER.indexOf(b.v) + 1 || 999)));
  return {list, note: ''};
}
const genusOf = sp => (en(sp.genera)[0] || {}).genus || '';

async function showDetail(id) {
  const e = BYID[id];
  if (!e) { location.hash = ''; return; }
  const my = ++token;
  stopSpeaking();
  window.scrollTo(0, 0);
  const keepTab = cur && cur.e.base === e.base ? cur.tab : 'entry';
  cur = {e, tab: keepTab, species: null, pokemon: null, version: null, vg: null, fmt: null, sets: null};
  $('#barTitle').textContent = displayName(e);
  $('#detailBody').innerHTML = heroHTML() + `<div class="pane"><div class="skeleton"></div><div class="skeleton"></div></div>`;
  try {
    const species = await getJSON(API + 'pokemon-species/' + e.num);
    const v = pickVariety(species, e);
    const pokemon = await getJSON(v.pokemon.url);
    if (my !== token) return;
    cur.species = species; cur.pokemon = pokemon;
    renderDetail();
    if (pendingAuto) { pendingAuto = false; if (S.autoRead) setTimeout(speakEntry, 250); }
  } catch (err) {
    if (my !== token) return;
    $('#detailBody').innerHTML = heroHTML() + `<div class="pane">${errorCard(err, 'retry-detail')}</div>`;
  }
}

function errorCard(err, act) {
  const off = String(err && err.message) === 'offline';
  return `<div class="msg"><b>${off ? 'You’re offline' : 'Couldn’t load this'}</b>${off
    ? 'This hasn’t been saved on your phone yet. Connect to the internet and try again.'
    : 'The data source didn’t answer properly. Try again in a moment.'}<br><br>
    <button type="button" class="btn" data-act="${act}">Try again</button></div>`;
}

function heroHTML() {
  const {e, species, pokemon} = cur;
  const types = pokemon ? typesAt(pokemon, S.gen) : D.typesInGen(e.types, S.gen);
  const other = pokemon && pokemon.sprites && pokemon.sprites.other;
  const art = other && ((other['official-artwork'] || {}).front_default || (other.home || {}).front_default);
  const urls = art ? [art, spriteOf(e)[0]] : spriteOf(e);
  const forms = BASES[e.base] || [];
  const genus = species ? genusOf(species) : '';
  return `<section class="hero">
    <div class="screen-frame">
      <div class="lcd" style="--tint:${D.TYPE_COLOR[types[0]] || '#cfd8dc'}">
        <span class="dexno">${pad(e.num)}</span>${imgTag(urls, e.name)}
      </div>
      <div class="frame-foot"><span class="dot" id="ttsDot"></span><span class="grille"></span></div>
    </div>
    <h2>${esc(displayName(e))}</h2>
    <p class="genus">${esc(genus || ' ')}</p>
    <div class="types">${types.map(tb).join('')}</div>
    ${e.gen > S.gen ? `<p class="genus">Not in Gen ${D.ROMAN[S.gen]} games (introduced in Gen ${D.ROMAN[e.gen]}).</p>` : ''}
    <div class="speak-row"><button type="button" class="speak" id="speakBtn" data-act="speak" ${species ? '' : 'disabled'}>
      <svg><use href="#i-speak"/></svg><span>Read entry aloud</span></button></div>
    ${forms.length > 1 ? `<div class="forms scroll">${forms.map(f => `<button type="button" class="chip" data-go="${f.id}" aria-pressed="${f.id === e.id}">${esc(f.forme ? formeLabel(f).replace(' form', '') : 'Base')}</button>`).join('')}</div>` : ''}
  </section>`;
}

const TABS = [['entry', 'Entry'], ['stats', 'Stats'], ['moves', 'Moves'], ['smogon', 'Smogon'], ['evo', 'Evolution']];
function renderDetail() {
  $('#detailBody').innerHTML = heroHTML() +
    `<nav class="tabs scroll" role="tablist">${TABS.map(([k, l]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${cur.tab === k}">${l}</button>`).join('')}</nav>
     <div class="pane" id="pane"></div>`;
  renderPane();
}
function renderPane() {
  const pane = $('#pane');
  if (!pane) return;
  $$('.tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === cur.tab));
  ({entry: paneEntry, stats: paneStats, moves: paneMoves, smogon: paneSmogon, evo: paneEvo})[cur.tab](pane);
}

// ------------------------------------------------------------ Entry tab
const EGG = {monster:'Monster', water1:'Water 1', water2:'Water 2', water3:'Water 3', bug:'Bug', flying:'Flying',
  ground:'Field', fairy:'Fairy', plant:'Grass', humanshape:'Human-Like', mineral:'Mineral', indeterminate:'Amorphous',
  ditto:'Ditto', dragon:'Dragon', 'no-eggs':'Undiscovered'};
const GROWTH = {'slow-then-very-fast':'Erratic', 'fast-then-very-slow':'Fluctuating'};
const verLabel = v => D.VERSION_LABEL[v] || title(v);

function paneEntry(pane) {
  const {e, species: sp, pokemon: p} = cur;
  const gen = S.gen;
  const fl = flavorFor(sp);
  if (!cur.version || !fl.list.find(f => f.v === cur.version)) cur.version = fl.list.length ? fl.list[fl.list.length - 1].v : null;
  const shown = fl.list.find(f => f.v === cur.version);
  const types = typesAt(p, gen);
  const st = statsAt(p, gen);
  const m = p.height / 10, kg = p.weight / 10;
  const inches = Math.round(m * 39.3701);
  const abil = abilitiesAt(p, gen);
  const ev = D.STAT_KEYS.filter(k => st[k] && st[k].effort > 0).map(k => `${st[k].effort} ${D.STAT_LABEL[k]}`).join(', ') || '—';
  const female = sp.gender_rate;
  const gender = female < 0 ? 'Genderless' : `<span style="color:#2a6fd6">${100 - female * 12.5}% male</span>, <span style="color:#c2185b">${female * 12.5}% female</span>`;
  const cr = sp.capture_rate;

  pane.innerHTML = `
    <section class="card">
      <h3>Pokédex entry</h3>
      ${fl.list.length > 1 ? pickBtn('pick-ver', 'Game', verLabel(cur.version)) : ''}
      <p class="entry-text">${shown ? esc(shown.text) : 'No English Pokédex entry for this Pokémon yet.'}</p>
      ${shown && fl.list.length === 1 ? `<p class="note">${esc(verLabel(shown.v))}</p>` : ''}
      ${fl.note ? `<p class="note">${esc(fl.note)}</p>` : ''}
    </section>
    <section class="card"><h3>Pokédex data</h3><table class="kv"><tbody>
      <tr><th>National №</th><td>${pad(e.num).slice(1)}</td></tr>
      <tr><th>Type</th><td><span class="types">${types.map(tb).join('')}</span></td></tr>
      <tr><th>Species</th><td>${esc(genusOf(sp) || '—')}</td></tr>
      <tr><th>Height</th><td>${m.toFixed(1)} m (${Math.floor(inches / 12)}′${String(inches % 12).padStart(2, '0')}″)</td></tr>
      <tr><th>Weight</th><td>${kg.toFixed(1)} kg (${(kg * 2.20462).toFixed(1)} lbs)</td></tr>
      ${gen >= 3 ? `<tr><th>Abilities</th><td>${abil.map((a, i) => `<div><button type="button" class="linkish" data-ability="${a.ability.name}">${i + 1}. ${esc(title(a.ability.name))}</button>${a.is_hidden ? ' <small>(hidden ability)</small>' : ''}<span class="ability-desc" id="ab-${a.ability.name}"></span></div>`).join('') || '—'}</td></tr>` : ''}
    </tbody></table></section>
    <section class="card"><h3>Training</h3><table class="kv"><tbody>
      <tr><th>EV yield</th><td>${ev}</td></tr>
      <tr><th>Catch rate</th><td>${cr} <small>(${(cr / 3 / 255 * 100).toFixed(1)}% with a Poké Ball at full HP)</small></td></tr>
      ${gen >= 2 ? `<tr><th>Base friendship</th><td>${sp.base_happiness ?? '—'}</td></tr>` : ''}
      <tr><th>Base Exp.</th><td>${p.base_experience ?? '—'}</td></tr>
      <tr><th>Growth rate</th><td>${esc(GROWTH[sp.growth_rate && sp.growth_rate.name] || title(sp.growth_rate && sp.growth_rate.name))}</td></tr>
    </tbody></table></section>
    ${gen >= 2 ? `<section class="card"><h3>Breeding</h3><table class="kv"><tbody>
      <tr><th>Egg groups</th><td>${(sp.egg_groups || []).map(g => EGG[g.name] || title(g.name)).join(', ') || '—'}</td></tr>
      <tr><th>Gender</th><td>${gender}</td></tr>
      <tr><th>Egg cycles</th><td>${sp.hatch_counter ?? '—'}</td></tr>
    </tbody></table></section>` : ''}
    <section class="card"><h3>Type defenses</h3>${defensesHTML(types, gen)}</section>`;
}

function defensesHTML(types, gen) {
  const lab = {0: '0', 0.25: '¼', 0.5: '½', 1: '', 2: '2', 4: '4'};
  const cls = {0: 'x0', 0.25: 'x25', 0.5: 'x5', 1: 'x1', 2: 'x2', 4: 'x4'};
  return `<div class="defs">${D.typesForGen(gen).map(t => {
    const m = D.effectiveness(t, types, gen);
    return `<div class="def"><span class="tn${D.LIGHT_TYPES.has(t) ? ' light' : ''}" style="background:${D.TYPE_COLOR[t]}">${t.slice(0, 3)}</span><span class="m ${cls[m] || 'x1'}">${lab[m] ?? m}</span></div>`;
  }).join('')}</div><p class="note">2 = super effective, ½ = resisted, 0 = immune. Abilities like Levitate aren’t counted.</p>`;
}

async function showAbility(name) {
  const el = document.getElementById('ab-' + name);
  if (!el) return;
  if (el.textContent) { el.textContent = ''; return; }
  el.textContent = 'Loading…';
  try {
    const a = await getJSON(API + 'ability/' + name);
    const eff = en(a.effect_entries)[0];
    const fl = en(a.flavor_text_entries).pop();
    el.textContent = (eff && eff.short_effect) || (fl && fl.flavor_text.replace(/\s+/g, ' ')) || 'No description.';
  } catch (err) { el.textContent = 'Couldn’t load the description.'; }
}

// ------------------------------------------------------------ Stats tab
function statColor(v) { return v < 30 ? '#f34444' : v < 60 ? '#ff7f0f' : v < 90 ? '#ffc93c' : v < 120 ? '#a0e515' : v < 150 ? '#23cd5e' : '#00c2b8'; }
function paneStats(pane) {
  const st = statsAt(cur.pokemon, S.gen);
  let total = 0;
  const rows = D.STAT_KEYS.map(k => {
    const b = st[k] ? st[k].base : 0;
    total += b;
    let min, max;
    if (k === 'hp') { min = b === 1 ? 1 : 2 * b + 110; max = b === 1 ? 1 : 2 * b + 204; }
    else { min = Math.floor((2 * b + 5) * 0.9); max = Math.floor((2 * b + 99) * 1.1); }
    return `<div class="stat"><span class="k">${D.STAT_LABEL[k]}</span><span class="v">${b}</span>
      <span class="bar-bg"><span class="bar-fg" style="display:block;width:${Math.min(100, b / 255 * 100).toFixed(1)}%;background:${statColor(b)}"></span></span>
      <span class="mm">${min}–${max}</span></div>`;
  }).join('');
  pane.innerHTML = `<section class="card"><h3>Base stats</h3>${rows}
      <div class="stat total"><span class="k">Total</span><span class="v">${total}</span><span></span><span class="mm">Min–Max</span></div>
      <p class="note">Min–Max are level 100 stats: hindering nature with 0 EVs and 0 IVs, up to a helpful nature with 252 EVs and 31 IVs.</p>
      ${S.gen === 1 ? '<p class="note">In Gen 1, Sp. Atk and Sp. Def were one “Special” stat. Both are shown as they are today.</p>' : ''}
      ${S.gen <= 2 ? '<p class="note">Gen 1–2 games used DVs and stat experience instead of IVs and EVs, so in-game stats differ slightly.</p>' : ''}
    </section>
    <section class="card"><h3>Type defenses</h3>${defensesHTML(typesAt(cur.pokemon, S.gen), S.gen)}</section>`;
}

// ------------------------------------------------------------ Moves tab
const PREF_VG = {1:'yellow', 2:'crystal', 3:'emerald', 4:'platinum', 5:'black-2-white-2', 6:'omega-ruby-alpha-sapphire',
  7:'ultra-sun-ultra-moon', 8:'sword-shield', 9:'scarlet-violet'};
const METHOD = {'level-up':'Level up', machine:'TM / HM / TR', egg:'Egg moves', tutor:'Move tutor'};

// <optgroup> per generation, newest generation first
function byGen(items, genOf, render) {
  const gens = [...new Set(items.map(genOf))].sort((a, b) => b - a);
  return gens.map(g => `<optgroup label="Gen ${D.ROMAN[g] || g}">${items.filter(x => genOf(x) === g).slice().reverse().map(render).join('')}</optgroup>`).join('');
}
// In-app picker (Android's native dropdown handles grouped lists poorly).
let pickerCb = null;
const pickBtn = (act, label, text) => `<div class="field"><span class="field-label">${label}</span><button type="button" class="select-btn" data-act="${act}"><span>${esc(text)}</span><span aria-hidden="true">▾</span></button></div>`;
function openPicker(heading, groups, selected, onPick) {
  pickerCb = onPick;
  openSheet(`<h2>${esc(heading)}</h2>${groups.filter(g => g.items.length).map(g => `<h3>${esc(g.label)}</h3>
    <div class="pick-list">${g.items.map(([v, l]) => `<button type="button" class="pick-opt" data-pickval="${esc(v)}" aria-pressed="${v === selected}">${esc(l)}</button>`).join('')}</div>`).join('')}`);
  const sel = $('#sheetBody .pick-opt[aria-pressed=true]');
  if (sel) sel.scrollIntoView({block: 'center'});
}
const genGroups = (items, genOf, label) => [...new Set(items.map(genOf))].sort((a, b) => b - a)
  .map(g => ({label: 'Gen ' + (D.ROMAN[g] || g), items: items.filter(x => genOf(x) === g).slice().reverse().map(label)}));

function vgsIn(p) {
  const s = new Set();
  for (const m of p.moves || []) for (const d of m.version_group_details) s.add(d.version_group.name);
  return [...s].sort((a, b) => (D.VG_ORDER[a] ?? 999) - (D.VG_ORDER[b] ?? 999));
}

async function paneMoves(pane) {
  pane.innerHTML = '<div class="skeleton"></div>';
  const my = token;
  let p = cur.pokemon, note = '';
  if (!vgsIn(p).length && cur.e.forme) {
    try {
      const def = (cur.species.varieties || []).find(v => v.is_default);
      if (def) { const base = await getJSON(def.pokemon.url); if (vgsIn(base).length) { p = base; note = `Showing ${cur.e.base}’s moves. This form has no separate move list.`; } }
    } catch (err) { /* keep form data */ }
  }
  let movedb = {};
  try { movedb = await getJSON(SD + 'moves.json', 30 * DAY); } catch (err) { /* names only */ }
  if (my !== token || cur.tab !== 'moves') return;
  const vgs = vgsIn(p);
  if (!vgs.length) {
    pane.innerHTML = `<div class="msg"><b>No moves listed</b>PokéAPI has no move data for this Pokémon yet.</div>`;
    return;
  }
  if (!vgs.includes(cur.vg)) {
    const latestGen = Math.max(...vgs.map(vgGen));
    const main = PREF_VG[latestGen];
    cur.vg = vgs.includes(main) ? main : vgs.filter(v => vgGen(v) === latestGen).pop();
  }
  const mgen = vgGen(cur.vg);
  const groups = {};
  for (const m of p.moves) for (const d of m.version_group_details) {
    if (d.version_group.name !== cur.vg) continue;
    const meth = d.move_learn_method.name;
    (groups[meth] = groups[meth] || []).push({name: m.move.name, level: d.level_learned_at});
  }
  const order = ['level-up', 'machine', 'egg', 'tutor', ...Object.keys(groups).filter(k => !METHOD[k])];
  const sections = order.filter(k => groups[k] && groups[k].length).map(k => {
    const seen = new Set();
    const list = groups[k].filter(r => { const key = r.name + '|' + (k === 'level-up' ? r.level : ''); return !seen.has(key) && seen.add(key); });
    list.sort((a, b) => k === 'level-up' ? a.level - b.level || a.name.localeCompare(b.name) : moveName(movedb, a.name).localeCompare(moveName(movedb, b.name)));
    const showLv = k === 'level-up';
    return `<section class="card"><h3>${METHOD[k] || title(k)} <small>${list.length}</small></h3>
      <table class="mtable"><thead><tr>${showLv ? '<th>Lv</th>' : ''}<th>Move</th><th>Type</th><th>Cat</th><th class="r">Pwr</th><th class="r">Acc</th></tr></thead>
      <tbody>${list.map(r => moveRow(movedb, r, showLv, mgen)).join('')}</tbody></table></section>`;
  }).join('');
  cur.vgs = vgs;
  pane.innerHTML = `<section class="card">${pickBtn('pick-vg', 'Game', vgLabel(cur.vg))}
      ${note ? `<p class="note">${esc(note)}</p>` : ''}<p class="note">Tap a move for its effect. Power and accuracy are from the latest games.</p></section>${sections}`;
}
const vgLabel = v => D.VG_LABEL[v] || title(v);
function moveName(db, slug) { const m = db[slug.replace(/-/g, '')]; return m ? m.name : title(slug); }
function moveInfo(db, slug, gen) {
  const id = slug.replace(/-/g, '');
  const m = db[id] || {};
  let type = m.type || '';
  const hist = D.MOVE_TYPE_HISTORY[id];
  if (hist && gen <= hist[0]) type = hist[1];
  let cat = m.category || '';
  if (gen <= 3 && cat && cat !== 'Status') cat = D.PHYSICAL_TYPES.has(type) ? 'Physical' : 'Special';
  return {name: m.name || title(slug), type, cat, bp: m.basePower ? m.basePower : '—',
    acc: m.accuracy === true ? '—' : (m.accuracy ?? '—'), pp: m.pp, pri: m.priority};
}
function moveRow(db, r, showLv, gen) {
  const m = moveInfo(db, r.name, gen);
  return `<tr class="mrow" data-move="${r.name}">${showLv ? `<td class="lv">${r.level || 'Evo'}</td>` : ''}
    <td class="mv">${esc(m.name)}</td><td>${m.type ? tb(m.type) : ''}</td>
    <td>${m.cat ? `<span class="cat ${m.cat}" title="${m.cat}"></span>` : ''}</td>
    <td class="r">${m.bp}</td><td class="r">${m.acc}</td></tr>`;
}
async function toggleMove(tr) {
  const next = tr.nextElementSibling;
  if (next && next.classList.contains('expand')) { next.remove(); return; }
  const slug = tr.dataset.move;
  const ex = document.createElement('tr');
  ex.className = 'expand';
  ex.innerHTML = `<td colspan="${tr.children.length}">Loading…</td>`;
  tr.after(ex);
  let db = {};
  try { db = await getJSON(SD + 'moves.json', 30 * DAY); } catch (err) { /* ignore */ }
  const info = moveInfo(db, slug, cur && cur.vg ? vgGen(cur.vg) : 9);
  let text = '';
  try {
    const mv = await getJSON(API + 'move/' + slug);
    const eff = en(mv.effect_entries)[0];
    text = eff ? eff.short_effect.replace(/\$effect_chance/g, mv.effect_chance ?? '') : ((en(mv.flavor_text_entries).pop() || {}).flavor_text || '');
  } catch (err) { text = 'Couldn’t load the description (offline?).'; }
  ex.firstElementChild.innerHTML = `${info.cat ? `<b>${info.cat}</b>` : ''}${info.pp ? ` · PP ${info.pp}` : ''}${info.pri ? ` · Priority ${info.pri > 0 ? '+' : ''}${info.pri}` : ''}<br>${esc(text.replace(/\s+/g, ' '))}`;
}

// ----------------------------------------------------------- Smogon tab
const STATN = {hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe'};
const spread = o => Object.entries(o || {}).filter(([, n]) => n !== undefined && n !== null).map(([k, n]) => `${n} ${STATN[k] || k}`).join(' / ');
const fmtVal = v => Array.isArray(v) ? v.map(fmtVal).join(' / ') : (v && typeof v === 'object') ? spread(v) : String(v);
const fmtSpread = v => Array.isArray(v) ? v.map(spread).join('  or  ') : spread(v);
const first = v => Array.isArray(v) ? first(v[0]) : v;

// Smogon rules: 'gen1'…'gen9' or 'champions'. null = follow the app's generation (or your saved default).
let smogonRules = null;
const RULES = [...[1, 2, 3, 4, 5, 6, 7, 8, 9].map(g => ['gen' + g, 'Gen ' + D.ROMAN[g]]), ['champions', 'Champions']];
const RULES_DEX = {gen1:'rb', gen2:'gs', gen3:'rs', gen4:'dp', gen5:'bw', gen6:'xy', gen7:'sm', gen8:'ss', gen9:'sv', champions:'champions'};
const FMT_ORDER = ['ou', 'ubers', 'uu', 'ru', 'nu', 'pu', 'zu', 'lc', 'nfe', 'monotype', 'doublesou', 'vgc', 'battlestadium', 'nationaldex', 'randombattle', 'randomdoublesbattle', '1v1', 'anythinggoes'];
function fmtRank(f) {
  const i = FMT_ORDER.findIndex(p => f === p || (['vgc', 'battlestadium', 'nationaldex'].includes(p) && f.startsWith(p)));
  return i < 0 ? 99 : i;
}
const sortFormats = list => [...new Set(list)].sort((a, b) => fmtRank(a) - fmtRank(b) || a.localeCompare(b));
const autoRules = e => 'gen' + Math.max(S.gen, Math.min(e.gen, 9));
const defaultRules = e => S.smogonRules || autoRules(e);
const rulesNow = e => smogonRules || defaultRules(e);
// Every format Smogon has set data for, per rules (from data.pkmn.cc/sets/index.json).
async function formatsFor(rules) {
  let idx = {};
  try { idx = await getJSON('https://data.pkmn.cc/sets/index.json', 7 * DAY); } catch (err) { /* offline: only formats in the file */ }
  const out = [];
  for (const k of Object.keys(idx)) {
    const id = k.replace(/\.json$/, '');
    if (id.startsWith(rules) && id !== rules) out.push(id.slice(rules.length));
  }
  return out;
}
const hasRandbats = rules => /^gen[1-9]$/.test(rules);
function pickFormat(withSets, all) {
  const want = cur.fmt || S.format;
  const pool = cur.fmt ? all : withSets.length ? withSets : all;
  if (pool.includes(want)) return want;
  for (const fam of ['vgc', 'battlestadium']) if (want && want.startsWith(fam)) { const v = pool.filter(f => f.startsWith(fam)).sort().pop(); if (v) return v; }
  if (withSets.includes('ou')) return 'ou';
  return withSets[0] || all[0];
}
const smogonSlug = name => name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[.'’:%]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function paneSmogon(pane) {
  pane.innerHTML = '<div class="skeleton"></div>';
  const my = token, e = cur.e;
  const rules = rulesNow(e);
  const rulesLabel = rules === 'champions' ? 'Pokémon Champions' : D.GENS[+rules.slice(3)].games;
  const ruleChips = `<div class="games scroll">${RULES.slice().reverse().filter(([r]) => r === 'champions' || +r.slice(3) >= e.gen).map(([r, l]) => `<button type="button" class="chip" data-srules="${r}" aria-pressed="${r === rules}">${l}</button>`).join('')}</div>`;
  const dexLink = `https://www.smogon.com/dex/${RULES_DEX[rules]}/pokemon/${smogonSlug(e.name)}/`;
  const linkBtn = `<button type="button" class="btn ghost" data-url="${dexLink}"><svg><use href="#i-ext"/></svg>Open on Smogon</button>`;

  let data = {}, loadErr = null;
  try { data = await getJSON(`https://data.pkmn.cc/sets/${rules}.json`, 3 * DAY); } catch (err) { loadErr = err; }
  const indexFormats = await formatsFor(rules);
  if (my !== token || cur.tab !== 'smogon') return;

  // <rules>.json is species → format → set name → set (older files may be format → species).
  let byFmt = {};
  if (data[e.name] && typeof data[e.name] === 'object') byFmt = data[e.name];
  else for (const t of Object.keys(data)) if (data[t] && typeof data[t] === 'object' && data[t][e.name]) byFmt[t] = data[t][e.name];
  const withSets = sortFormats(Object.keys(byFmt).filter(f => byFmt[f] && Object.keys(byFmt[f]).length));
  const all = sortFormats([...withSets, ...indexFormats, ...(hasRandbats(rules) ? ['randombattle'] : []), ...(['gen8', 'gen9'].includes(rules) ? ['randomdoublesbattle'] : [])]);

  if (loadErr && !all.length) {
    pane.innerHTML = `<section class="card"><h3>Rules</h3>${ruleChips}</section>` + errorCard(loadErr, 'retry-pane');
    return;
  }
  const fmt = cur.fmt = pickFormat(withSets, all);
  const isDefault = S.format === fmt && rules === defaultRules(e);
  cur.rules = rules;
  const others = all.filter(f => !withSets.includes(f));
  cur.fmtGroups = [{label: 'Sets for ' + e.name, items: withSets.map(f => [f, D.tierLabel(f)])}, {label: 'Other formats', items: others.map(f => [f, D.tierLabel(f)])}];
  const head = `<section class="card"><h3>Rules <small>${esc(rulesLabel)}</small></h3>${ruleChips}
      ${pickBtn('pick-fmt', 'Battle format', D.tierLabel(fmt))}
      <div class="set-actions"><button type="button" class="btn ${isDefault ? 'ghost' : 'red'}" data-act="fmt-default" ${isDefault ? 'disabled' : ''}>${isDefault ? '★ This is your default' : '☆ Make this my default'}</button></div>
      <p class="note">Sets written by Smogon University contributors (via data.pkmn.cc).</p></section>`;

  if (fmt === 'randombattle' || fmt === 'randomdoublesbattle') {
    pane.innerHTML = head + '<div class="skeleton"></div>';
    let rb = null;
    try { rb = await getJSON(`https://data.pkmn.cc/randbats/${rules}${fmt}.json`, 3 * DAY); } catch (err) { /* below */ }
    if (my !== token || cur.tab !== 'smogon') return;
    const r = rb && rb[e.name];
    cur.sets = null;
    pane.innerHTML = head + (r ? randbatsCard(r) : `<div class="msg"><b>Not in ${esc(D.tierLabel(fmt))}</b>${esc(e.name)} has no ${esc(D.tierLabel(fmt))} set for these rules.</div>`) + `<div style="text-align:center">${linkBtn}</div>`;
    return;
  }
  const sets = byFmt[fmt];
  cur.sets = sets || null;
  pane.innerHTML = head + (sets
    ? Object.entries(sets).map(([setName, s], i) => setCard(setName, s, i)).join('')
    : `<div class="msg"><b>No ${esc(D.tierLabel(fmt))} sets</b>Smogon hasn’t written ${esc(D.tierLabel(fmt))} sets for ${esc(displayName(e))} under these rules.${withSets.length ? ` It has sets in: ${withSets.map(f => esc(D.tierLabel(f))).join(', ')}.` : ''}</div>`) +
    `<div style="text-align:center">${linkBtn}</div>`;
}
// Random Battle data: {level, abilities, items, moves, teraTypes} or {level, roles: {name: {...}}}
function randbatsCard(r) {
  const list = v => Array.isArray(v) ? v.join(' / ') : (v ?? '');
  const block = (name, x) => `<section class="card setcard"><h4>${esc(name)}</h4><div class="set-lines">
      ${r.level ? `<div><b>Level</b>${esc(r.level)}</div>` : ''}
      ${x.abilities ? `<div><b>Ability</b>${esc(list(x.abilities))}</div>` : ''}
      ${x.items ? `<div><b>Item</b>${esc(list(x.items))}</div>` : ''}
      ${x.teraTypes ? `<div><b>Tera</b>${esc(list(x.teraTypes))}</div>` : ''}
    </div><h4 style="margin-top:10px;font-size:14px">Possible moves</h4>
    <div class="games" style="flex-wrap:wrap;margin:0">${(x.moves || []).map(m => `<span class="chip" style="min-height:30px;display:inline-flex;align-items:center">${esc(m)}</span>`).join('')}</div></section>`;
  if (r.roles) return Object.entries(r.roles).map(([n, x]) => block(n, x)).join('');
  return block('Random set', r);
}
function setCard(setName, s, i) {
  const line = (k, v) => v === undefined || v === null || v === '' ? '' : `<div><b>${k}</b>${esc(v)}</div>`;
  return `<section class="card setcard"><h4>${esc(setName)}</h4><div class="set-lines">
      ${line('Item', s.item !== undefined ? fmtVal(s.item) : '')}
      ${line('Ability', s.ability !== undefined ? fmtVal(s.ability) : '')}
      ${line('Nature', s.nature !== undefined ? fmtVal(s.nature) : '')}
      ${line('Tera', s.teratypes !== undefined ? fmtVal(s.teratypes) : '')}
      ${line('EVs', s.evs ? fmtSpread(s.evs) : '')}
      ${line('IVs', s.ivs ? fmtSpread(s.ivs) : '')}
      ${line('Level', s.level !== undefined ? fmtVal(s.level) : '')}
    </div>
    <ol class="set-moves">${(s.moves || []).map(m => `<li>${esc(Array.isArray(m) ? m.join(' / ') : m)}</li>`).join('')}</ol>
    <div class="set-actions"><button type="button" class="btn" data-copyset="${i}"><svg><use href="#i-copy"/></svg>Copy for Showdown</button></div>
  </section>`;
}
function showdownExport(s) {
  const out = [cur.e.name + (s.item ? ' @ ' + first(s.item) : '')];
  if (s.ability) out.push('Ability: ' + first(s.ability));
  if (s.level) out.push('Level: ' + first(s.level));
  if (s.teratypes) out.push('Tera Type: ' + first(s.teratypes));
  if (s.evs) out.push('EVs: ' + spread(first(s.evs)));
  if (s.nature) out.push(first(s.nature) + ' Nature');
  if (s.ivs) out.push('IVs: ' + spread(first(s.ivs)));
  for (const m of s.moves || []) out.push('- ' + first(m));
  return out.join('\n');
}
function copyText(t) {
  if (N) N.copy(t);
  else if (navigator.clipboard) navigator.clipboard.writeText(t).catch(() => {});
}

// -------------------------------------------------------- Evolution tab
function evoCond(details) {
  return (details || []).map(d => {
    const parts = [];
    const trig = d.trigger && d.trigger.name;
    if (trig === 'level-up') parts.push(d.min_level ? 'Level ' + d.min_level : 'Level up');
    else if (trig === 'trade') parts.push('Trade');
    else if (trig === 'use-item' && d.item) parts.push('Use ' + title(d.item.name));
    else if (trig) parts.push(title(trig));
    if (d.held_item) parts.push('holding ' + title(d.held_item.name));
    if (d.min_happiness) parts.push('high friendship');
    if (d.min_affection) parts.push('high affection');
    if (d.min_beauty) parts.push('high Beauty');
    if (d.known_move) parts.push('knowing ' + title(d.known_move.name));
    if (d.known_move_type) parts.push('knowing a ' + title(d.known_move_type.name) + '-type move');
    if (d.location) parts.push('at ' + title(d.location.name));
    if (d.time_of_day) parts.push('(' + d.time_of_day + ')');
    if (d.gender === 1) parts.push('(female)');
    if (d.gender === 2) parts.push('(male)');
    if (d.needs_overworld_rain) parts.push('while raining');
    if (d.party_species) parts.push('with ' + title(d.party_species.name) + ' in party');
    if (d.party_type) parts.push('with a ' + title(d.party_type.name) + '-type in party');
    if (d.trade_species) parts.push('for ' + title(d.trade_species.name));
    if (d.turn_upside_down) parts.push('holding the console upside down');
    if (d.relative_physical_stats === 1) parts.push('Atk > Def');
    if (d.relative_physical_stats === -1) parts.push('Atk < Def');
    if (d.relative_physical_stats === 0) parts.push('Atk = Def');
    return parts.join(', ');
  }).filter(Boolean).join(' or ');
}
async function paneEvo(pane) {
  pane.innerHTML = '<div class="skeleton"></div>';
  const my = token;
  let chain;
  try { chain = await getJSON(cur.species.evolution_chain.url); }
  catch (err) { if (my === token && cur.tab === 'evo') pane.innerHTML = errorCard(err, 'retry-pane'); return; }
  if (my !== token || cur.tab !== 'evo') return;
  const curNum = cur.e.num;
  const visible = n => { const e = BYNUM[idFromUrl(n.species.url)]; return !!e && e.gen <= S.gen; };
  const mon = n => {
    const num = idFromUrl(n.species.url), e = BYNUM[num];
    if (!e) return '';
    return `<button type="button" class="evo-mon${num === curNum ? ' cur' : ''}" data-go="${e.id}">${imgTag(spriteOf(e), e.name)}<span>${esc(e.name)}</span><small>${pad(num)}</small></button>`;
  };
  const node = n => {
    const kids = (n.evolves_to || []).filter(visible);
    if (!kids.length) return `<div class="evo-branch">${mon(n)}</div>`;
    if (kids.length === 1) return `<div class="evo-branch">${mon(n)}<div class="evo-arrow">↓</div><div class="evo-cond">${esc(evoCond(kids[0].evolution_details))}</div>${node(kids[0])}</div>`;
    return `<div class="evo-branch">${mon(n)}<div class="evo-arrow">↓</div><div class="evo-stage">${kids.map(k => `<div class="evo-branch"><div class="evo-cond">${esc(evoCond(k.evolution_details))}</div>${node(k)}</div>`).join('')}</div></div>`;
  };
  const root = chain.chain;
  const single = !(root.evolves_to || []).filter(visible).length;
  pane.innerHTML = `<section class="card"><h3>Evolution chart</h3>${visible(root) ? `<div class="evo">${node(root)}</div>` : ''}
    ${single ? '<p class="note">This Pokémon does not evolve' + (S.gen < 9 ? ` in Gen ${D.ROMAN[S.gen]} games` : '') + '.</p>' : ''}
    ${cur.e.forme ? '<p class="note">Regional and other forms can evolve differently. This chart shows the species’ main line.</p>' : ''}</section>`;
}

// ============================================================ SPEECH
let speaking = false;
function setSpeaking(on) {
  speaking = on;
  const b = $('#speakBtn'), dot = $('#ttsDot');
  if (b) { b.classList.toggle('on', on); b.innerHTML = on ? '<svg><use href="#i-stop"/></svg><span>Stop</span>' : '<svg><use href="#i-speak"/></svg><span>Read entry aloud</span>'; }
  if (dot) dot.classList.toggle('on', on);
}
function speak(text) {
  if (N) { if (N.speak(text, S.rate, S.pitch)) setSpeaking(true); return; }
  if (window.speechSynthesis) {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = S.rate; u.pitch = S.pitch; u.onend = () => setSpeaking(false);
    speechSynthesis.cancel(); speechSynthesis.speak(u); setSpeaking(true);
  }
}
function stopSpeaking() {
  if (!speaking) return;
  if (N) N.stopSpeaking(); else if (window.speechSynthesis) speechSynthesis.cancel();
  setSpeaking(false);
}
function speakEntry() {
  if (!cur || !cur.species) return;
  if (speaking) { stopSpeaking(); return; }
  const fl = flavorFor(cur.species);
  const shown = fl.list.find(f => f.v === cur.version) || fl.list[fl.list.length - 1];
  const genus = genusOf(cur.species);
  const parts = [displayName(cur.e) + '.'];
  if (genus) parts.push('The ' + genus + '.');
  if (shown) parts.push(shown.text);
  speak(parts.join(' '));
}

// ============================================================ FINDING
function lev(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const row = Array.from({length: b.length + 1}, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]; row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}
// lines: [{t: text, w: weight}] → ranked [{e, s}]
function findInText(lines, allowNumbers) {
  const score = new Map();
  const add = (e, w) => score.set(e, (score.get(e) || 0) + w);
  for (const {t, w} of lines) {
    const words = String(t).split(/[\s,;!?()[\]{}"/|]+/).filter(Boolean);
    const used = new Array(words.length).fill(false);
    for (let n = Math.min(4, words.length); n >= 1; n--) {
      for (let i = 0; i + n <= words.length; i++) {
        if (used.slice(i, i + n).some(Boolean)) continue;
        const key = norm(words.slice(i, i + n).join(''));
        if (key.length < 3) continue;
        const e = NAMEMAP.get(key);
        if (e) { add(e, w + n * 0.01); for (let k = i; k < i + n; k++) used[k] = true; }
      }
    }
    if (allowNumbers) {
      const m = String(t).match(/\b(\d{1,4})\b/);
      if (m && BYNUM[+m[1]]) add(BYNUM[+m[1]], w * 0.9);
    }
  }
  if (!score.size) {
    const names = [...NAMEMAP.entries()].filter(([, e]) => !e.forme);
    for (const {t, w} of lines) {
      for (const word of String(t).split(/\s+/)) {
        const k = norm(word);
        if (k.length < 5) continue;
        const maxD = k.length >= 8 ? 2 : 1;
        for (const [nk, e] of names) {
          if (Math.abs(nk.length - k.length) > maxD) continue;
          if (lev(k, nk) <= maxD) add(e, w * 0.5);
        }
      }
    }
  }
  return [...score.entries()].sort((a, b) => b[1] - a[1]).map(([e, s]) => ({e, s}));
}

function handleFound(cands, rawText) {
  hideBusy();
  if (!cands.length) {
    openSheet(`<h2>No Pokémon found</h2>
      <p>I couldn’t find a Pokémon name in that.</p>
      ${rawText ? `<h3>What I read</h3><div class="ocr-text">${esc(rawText.slice(0, 600))}</div>` : ''}
      <h3>Tips</h3><ul class="steps"><li>For cards, fill the frame with the card’s name at the top and keep it sharp.</li>
      <li>For plushies, figures or anything without a name, use <b>Lens</b>.</li></ul>`);
    return;
  }
  if (cands.length === 1 || cands[0].s >= cands[1].s * 1.3) { closeSheet(); go(cands[0].e.id, true); return; }
  openSheet(`<h2>Which one?</h2><div class="pick-list">${cands.slice(0, 8).map(({e}) => `<button type="button" class="dex-row" data-pick="${e.id}">
      ${imgTag(spriteOf(e), e.name)}<span class="meta"><span class="num">${pad(e.num)}</span><span class="nm">${esc(displayName(e))}</span></span>
      <span class="types">${e.types.map(tb).join('')}</span></button>`).join('')}</div>`);
}

function textToLines(text) {
  const lines = [];
  for (const m of String(text).matchAll(/https?:\/\/\S+/g)) {
    try { const q = new URL(m[0]).searchParams.get('q'); if (q) lines.push({t: q, w: 2}); } catch (err) { /* ignore */ }
  }
  String(text).replace(/https?:\/\/\S+/g, ' ').split(/\n+/).forEach(l => { if (l.trim()) lines.push({t: l, w: 1}); });
  return lines;
}

function handleNative(ev) {
  switch (ev.type) {
    case 'busy': showBusy(ev.label || 'Working…'); break;
    case 'cancel': hideBusy(); break;
    case 'error': hideBusy(); if (N) N.toast(ev.message || 'Something went wrong'); break;
    case 'tts': setSpeaking(ev.state === 'start'); break;
    case 'ocr': {
      const lines = ev.lines || [];
      const maxH = Math.max(1, ...lines.map(l => l.h || 0));
      const weighted = lines.map(l => ({t: l.t, w: 0.2 + (l.h || 0) / maxH}));
      handleFound(findInText(weighted, false), lines.map(l => l.t).join('\n'));
      break;
    }
    case 'voice': {
      const res = ev.results || [];
      handleFound(findInText(res.map((t, i) => ({t, w: 1 / (i + 1)})), true), res.join('\n'));
      break;
    }
    case 'lensBack': hideBusy(); lensBackSheet(); break;
    case 'text': {
      const found = findInText(textToLines(ev.text || ''), false);
      if (!found.length && ev.source === 'lens') {
        hideBusy();
        openSheet(`<h2>That isn’t a Pokémon name</h2><p>You copied:</p><div class="ocr-text">${esc(String(ev.text).slice(0, 300))}</div>
          <p>Go back to Lens, copy just the Pokémon’s name, then return.</p>
          <div class="pick-list"><button type="button" class="btn red" data-act="lens-check">Check again</button>
          <button type="button" class="btn ghost" data-act="lens-stop">Cancel</button></div>`);
        break;
      }
      handleFound(found, ev.text || '');
      break;
    }
  }
}

// ======================================================= SHEETS & BUSY
function openSheet(html) { $('#sheetBody').innerHTML = html; $('#sheet').hidden = false; }
function closeSheet() { $('#sheet').hidden = true; $('#sheetBody').innerHTML = ''; }
function showBusy(label) { $('#busyLabel').textContent = label; $('#busy').hidden = false; }
function hideBusy() { $('#busy').hidden = true; }
function alertSheet(msg) { openSheet(`<h2>Pokédex</h2><p>${esc(msg)}</p>`); }

const FORMAT_CHOICES = ['ou', 'ubers', 'uu', 'ru', 'nu', 'pu', 'zu', 'lc', 'nfe', 'monotype', '1v1', '2v2doubles', 'almostanyability',
  'anythinggoes', 'balancedhackmons', 'battlestadiumsingles', 'cap', 'doublesou', 'godlygift', 'inheritance', 'mixandmega',
  'nationaldex', 'nationaldexdoubles', 'nationaldexmonotype', 'nationaldexru', 'nationaldexuu', 'nationaldexubers',
  'partnersincrime', 'randombattle', 'randomdoublesbattle', 'stabmons', 'ubersuu', 'vgc'];

function settingsSheet() {
  const size = N ? +N.cacheSize() : 0;
  openSheet(`<h2>Settings</h2>
    <h3>Voice</h3>
    <div class="field"><label for="rate">Speed <span id="rateV">${S.rate.toFixed(2)}×</span></label><input id="rate" type="range" min="0.5" max="1.5" step="0.05" value="${S.rate}"></div>
    <div class="field"><label for="pitch">Pitch <span id="pitchV">${S.pitch.toFixed(2)}</span></label><input id="pitch" type="range" min="0.5" max="1.5" step="0.05" value="${S.pitch}"></div>
    <button type="button" class="btn ghost" data-act="test-voice"><svg><use href="#i-speak"/></svg>Test voice</button>
    <label class="toggle">Read the entry aloud after a scan, voice search or share<input type="checkbox" id="autoRead" ${S.autoRead ? 'checked' : ''}></label>
    <h3>Smogon</h3>
    <div class="field"><label for="rulesSel">Default rules</label><select id="rulesSel"><option value="">Follow the app’s generation</option>${RULES.map(([r, l]) => `<option value="${r}" ${r === S.smogonRules ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <div class="field"><label for="fmtSel">Default battle format</label><select id="fmtSel">${[...new Set([...FORMAT_CHOICES, S.format])].map(v => `<option value="${v}" ${v === S.format ? 'selected' : ''}>${esc(v === 'vgc' ? 'VGC (latest)' : D.tierLabel(v))}</option>`).join('')}</select></div>
    <p class="note">Tip: on any Smogon tab, pick a format and tap “Make this my default”.</p>
    <h3>Saved data</h3>
    <p class="note">Everything you open is saved on your phone so it works offline.${N ? ` Using ${(size / 1048576).toFixed(1)} MB.` : ''}</p>
    <button type="button" class="btn ghost" data-act="clear-cache">Clear saved data</button>
    <h3>About</h3>
    <p class="note">Personal fan-made Pokédex${N ? ' v' + esc(N.version()) : ''}. Data from PokéAPI (pokeapi.co), Pokémon Showdown, and Smogon University sets via data.pkmn.cc. Pokémon and related names are trademarks of Nintendo, Creatures Inc. and GAME FREAK inc. This app isn’t affiliated with them.</p>`);
}

function lensSheet() {
  openSheet(`<h2>Identify with Google Lens</h2>
    <p>Lens recognises plushies, figures, toys and Pokémon on a screen. Take a photo and it opens in Google Lens.</p>
    <div class="pick-list">
      <button type="button" class="btn red" data-act="lens-camera"><svg><use href="#i-cam"/></svg>Take photo → Lens</button>
      <button type="button" class="btn ghost" data-act="lens-gallery"><svg><use href="#i-img"/></svg>Use a picture → Lens</button>
    </div>
    <h3>Then, to come back</h3>
    <ol class="steps">
      <li>When Lens shows the Pokémon’s name, long-press it and tap <b>Copy</b>, then press <b>back</b>. The Pokédex opens it automatically.</li>
      <li>Or select the name and choose <b>Pokédex</b> in the menu that pops up.</li>
    </ol>`);
}
function lensBackSheet() {
  openSheet(`<h2>Waiting for a name from Lens</h2>
    <p>Nothing new was copied yet. In Google Lens, long-press the Pokémon’s name, tap <b>Copy</b>, then come back here.</p>
    <div class="pick-list">
      <button type="button" class="btn red" data-act="lens-check">I copied it. Check again</button>
      <button type="button" class="btn ghost" data-act="lens-camera"><svg><use href="#i-cam"/></svg>Try another photo</button>
      <button type="button" class="btn ghost" data-act="lens-stop">Cancel</button>
    </div>`);
}

// ============================================================ EVENTS
document.addEventListener('click', ev => {
  const tr = ev.target.closest('tr.mrow');
  if (tr) { toggleMove(tr); return; }
  const t = ev.target.closest('button, [data-act]');
  if (!t) return;
  const d = t.dataset;
  if (d.id) { go(d.id, false); return; }
  if (d.go) { go(d.go, false); return; }
  if (d.pick) { closeSheet(); go(d.pick, true); return; }
  if (d.pickval !== undefined) { const cb = pickerCb; pickerCb = null; closeSheet(); if (cb) cb(d.pickval); return; }
  if (d.type !== undefined && t.closest('#typeFilter')) { toggleType(d.type); renderTypeFilter(); renderList(true); window.scrollTo(0, 0); return; }
  if (d.f) { onFilterChip(d.f, d.v); return; }
  if (d.tab) {
    cur.tab = d.tab; renderPane();
    const hero = $('.hero');
    if (hero && window.scrollY > hero.offsetHeight) window.scrollTo(0, hero.offsetHeight);
    return;
  }
  if (d.version) { cur.version = d.version; stopSpeaking(); renderPane(); return; }
  if (d.fmt) { cur.fmt = d.fmt; renderPane(); return; }
  if (d.srules) { smogonRules = d.srules; cur.fmt = null; renderPane(); return; }
  if (d.ability) { showAbility(d.ability); return; }
  if (d.url) { if (N) N.openUrl(d.url); else window.open(d.url, '_blank'); return; }
  if (d.copyset !== undefined && cur && cur.sets) {
    const entry = Object.entries(cur.sets)[+d.copyset];
    if (entry) copyText(showdownExport(entry[1]));
    t.lastChild.textContent = 'Copied';
    return;
  }
  if (d.gen) {
    S.gen = +d.gen; save(); smogonRules = null;
    $$('.gen-btn').forEach(b => b.setAttribute('aria-pressed', +b.dataset.gen === S.gen));
    $('#genGames').textContent = D.GENS[S.gen].games;
    if (cur) { cur.vg = null; cur.version = null; cur.fmt = null; }
    renderHome();
    if (!$('#detail').hidden && cur && cur.species) renderDetail();
    return;
  }
  switch (d.act) {
    case 'back': if (history.length > 1) history.back(); else location.hash = ''; break;
    case 'speak': speakEntry(); break;
    case 'close-sheet': closeSheet(); break;
    case 'voice': if (N) N.listen(); else alertSheet('Voice search works in the Android app.'); break;
    case 'camera': if (N) N.scan('camera'); else alertSheet('Card scanning works in the Android app.'); break;
    case 'gallery': if (N) N.scan('gallery'); else alertSheet('Reading pictures works in the Android app.'); break;
    case 'lens': lensSheet(); break;
    case 'filters': filterSheet(); break;
    case 'filters-reset': F = F0(); if (!$('#sheet').hidden && $('#fShow')) filterSheet(); renderTypeFilter(); renderList(true); break;
    case 'pick-ver': {
      const fl = flavorFor(cur.species);
      openPicker('Pokédex entry from', genGroups(fl.list, f => f.g, f => [f.v, verLabel(f.v)]), cur.version, v => { cur.version = v; stopSpeaking(); renderPane(); });
      break;
    }
    case 'pick-vg':
      openPicker('Moves in', genGroups(cur.vgs || [], vgGen, v => [v, vgLabel(v)]), cur.vg, v => { cur.vg = v; renderPane(); });
      break;
    case 'pick-fmt':
      openPicker('Battle format', cur.fmtGroups || [], cur.fmt, v => { cur.fmt = v; renderPane(); });
      break;
    case 'fmt-default':
      if (cur && cur.fmt) {
        S.format = cur.fmt;
        S.smogonRules = (!S.smogonRules && cur.rules === autoRules(cur.e)) ? null : cur.rules;
        smogonRules = null;
        save(); if (N) N.toast('Default: ' + D.tierLabel(cur.fmt) + (S.smogonRules ? ' · ' + RULES.find(r => r[0] === S.smogonRules)[1] : '')); renderPane();
      }
      break;
    case 'lens-camera': closeSheet(); if (N) N.scan('lens-camera'); else alertSheet('Lens works in the Android app.'); break;
    case 'lens-gallery': closeSheet(); if (N) N.scan('lens-gallery'); else alertSheet('Lens works in the Android app.'); break;
    case 'lens-check': closeSheet(); if (N) N.checkClipboard(); break;
    case 'lens-stop': closeSheet(); if (N) N.stopLensWatch(); break;
    case 'test-voice': speak('Pokédex online. Ready to identify Pokémon.'); break;
    case 'clear-cache': if (N) { N.clearCache(); memo.clear(); N.toast('Saved data cleared'); closeSheet(); } break;
    case 'retry-detail': if (cur) showDetail(cur.e.id); break;
    case 'retry-pane': renderPane(); break;
    case 'retry-index': boot().then(route).catch(() => {}); break;
  }
});
$('#settingsBtn').addEventListener('click', settingsSheet);
$('#settingsBtn2').addEventListener('click', settingsSheet);
document.addEventListener('change', ev => {
  const t = ev.target;
  if (t.id === 'vgSel') { cur.vg = t.value; renderPane(); }
  if (t.id === 'verSel') { cur.version = t.value; stopSpeaking(); renderPane(); }
  if (t.id === 'autoRead') { S.autoRead = t.checked; save(); }
  if (t.id === 'fmtSel') { S.format = t.value; save(); if (cur) cur.fmt = null; }
  if (t.id === 'rulesSel') { S.smogonRules = t.value || null; save(); smogonRules = null; if (cur) cur.fmt = null; }
  if (t.id === 'fmtPick') { cur.fmt = t.value; renderPane(); }
});
document.addEventListener('input', ev => {
  const t = ev.target;
  if (t.id === 'q') { query = t.value; renderList(true); window.scrollTo(0, 0); }
  if (t.id === 'fAbility') { F.ability = t.value; refreshAfterFilter(); }
  if (t.id === 'rate') { S.rate = +t.value; $('#rateV').textContent = S.rate.toFixed(2) + '×'; save(); }
  if (t.id === 'pitch') { S.pitch = +t.value; $('#pitchV').textContent = S.pitch.toFixed(2); save(); }
});
$('#q').addEventListener('keydown', ev => {
  if (ev.key !== 'Enter') return;
  const list = filtered();
  if (list.length && (list.length === 1 || norm(list[0].name) === norm(query))) go(list[0].id, false);
  ev.target.blur();
});

// ============================================================== BOOT
let ready;
function boot() {
  $('#homeMsg').innerHTML = '<div class="msg"><b>Starting up…</b>Loading the Pokédex.</div>';
  ready = loadIndex().then(() => { renderHome(); }).catch(err => {
    $('#homeMsg').innerHTML = `<div class="msg"><b>${String(err.message) === 'offline' ? 'You’re offline' : 'Couldn’t load the Pokédex'}</b>
      The first start needs the internet to download the list of Pokémon. After that it works offline.<br><br>
      <button type="button" class="btn" data-act="retry-index">Try again</button></div>`;
    throw err;
  });
  ready.catch(() => {});
  return ready;
}
boot();
window.onNative = ev => { ready.then(() => handleNative(ev)).catch(() => {}); };
route();
if (N) N.ready();
}
