// Builds the static site into docs/ (GitHub Pages ready).
//   node scripts/build.mjs            -> docs/
// Outputs docs/index.html (full page) and docs/artifact.html (same page as a
// fragment for hosts that add their own document skeleton).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import MiniSearch from 'minisearch';
import { createMarkdown, renderLessonMarkdown, escapeHtml, slugify, PATH_LABELS } from './lib/markdown.mjs';
import { SEARCH_OPTIONS, processTerm } from '../assets/js/search-options.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(ROOT, p));
const loadYaml = (p, fallback) => (exists(p) ? yaml.load(read(p)) ?? fallback : fallback);

const problems = [];
const problem = (where, msg) => problems.push(`${where}: ${msg}`);

// ---------------------------------------------------------------- content
const sources = loadYaml('content/sources.yaml', []);
const facts = loadYaml('content/facts.yaml', {});
const pathsDef = loadYaml('content/paths.yaml', {});
const glossaryRaw = loadYaml('content/glossary.yaml', []);
const signsSv = JSON.parse(read('content/signs/catalogue.json'));
const signsEn = loadYaml('content/signs/en.yaml', {});
const photos = loadYaml('content/media/photos.yaml', []);
const diagrams = loadYaml('content/media/diagrams.yaml', []);

const sourceById = new Map(sources.map((s) => [s.id, s]));
const photoById = new Map(photos.map((p) => [p.id, p]));
const diagramById = new Map(diagrams.map((d) => [d.id, d]));

// ---------------------------------------------------------------- signs
const CAT_ORDER = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'T', 'S', 'M', 'SIG', 'P', 'V', 'X', 'Y'];
const CAT_INFO = {
  A: { en: 'Warning signs', sv: 'Varningsmärken', vmf: '2:5' },
  B: { en: 'Priority signs', sv: 'Väjningspliktsmärken', vmf: '2:6' },
  C: { en: 'Prohibitory signs', sv: 'Förbudsmärken', vmf: '2:8' },
  D: { en: 'Mandatory signs', sv: 'Påbudsmärken', vmf: '2:10' },
  E: { en: 'Information signs', sv: 'Anvisningsmärken', vmf: '2:12' },
  F: { en: 'Direction signs', sv: 'Lokaliseringsmärken för vägvisning', vmf: '2:17' },
  G: { en: 'Public facility signs', sv: 'Lokaliseringsmärken för upplysning om allmänna inrättningar m.m.', vmf: '2:22' },
  H: { en: 'Service signs', sv: 'Lokaliseringsmärken för upplysning om serviceanläggningar m.m.', vmf: '2:24' },
  I: { en: 'Tourist signs', sv: 'Lokaliseringsmärken för turistiskt intressanta mål m.m.', vmf: '2:26' },
  J: { en: 'Notice signs', sv: 'Upplysningsmärken', vmf: '2:27' },
  T: { en: 'Additional panels', sv: 'Tilläggstavlor', vmf: '2:30' },
  S: { en: 'Symbols', sv: 'Symboler', vmf: '2:28' },
  M: { en: 'Road markings', sv: 'Vägmarkeringar', vmf: '4:1' },
  SIG: { en: 'Traffic signals', sv: 'Trafiksignaler', vmf: '3:1' },
  P: { en: 'Police signals', sv: 'Tecken av polisman m.fl.', vmf: '7:2' },
  V: { en: 'Signals from a guard', sv: 'Tecken av vakt', vmf: '5:2' },
  X: { en: 'Other traffic devices', sv: 'Andra anordningar för anvisningar för trafiken', vmf: '5:1' },
  Y: { en: 'Level crossing signals', sv: 'Signaler vid korsning med järnväg eller spårväg', vmf: '6:6' },
};

const imgKey = (url) => path.basename(url.trim()).replace(/\.[a-z]+$/i, '').toUpperCase();
const signs = [];
const signById = new Map();
const imageOwner = new Map(); // image key -> sign id
for (const raw of signsSv) {
  const m = /^([A-Z]+\d+[a-z]?)(?:-\d+)?\.\s+(.*)$/.exec(raw.label);
  const id = m[1];
  const cat = raw.cat === 'F-GC' ? 'F' : raw.cat;
  const en = signsEn[id] || {};
  if (!signsEn[id]) problem(`sign ${id}`, 'missing English entry in content/signs/en.yaml');
  const main = imgKey(raw.img);
  const variants = [];
  const seen = new Set([main]);
  for (const a of raw.alts) {
    if (!a.img) continue;
    const key = imgKey(a.img);
    if (seen.has(key)) continue;
    seen.add(key);
    variants.push({ key, en: (en.variants || {})[a.code] || (en.variants || {})[key] || '' });
  }
  for (const k of seen) {
    if (!exists(`assets/signs/${k}.webp`)) problem(`sign ${id}`, `image assets/signs/${k}.webp missing`);
    imageOwner.set(k, id);
  }
  const svText = raw.desc.filter((t) => !t.startsWith('## ')).join(' ');
  const sign = {
    id,
    cat,
    gc: raw.cat === 'F-GC' || undefined,
    sv: raw.name,
    en: en.en || '',
    svText,
    enText: en.text || '',
    tip: en.tip || '',
    kw: en.kw || [],
    img: main,
    variants,
    url: `https://www.transportstyrelsen.se${raw.href}`,
    related: en.related || [],
  };
  signs.push(sign);
  signById.set(id, sign);
}
// Sign references can name a sign (A1) or one of its images (A1-2).
function resolveSign(ref) {
  const r = ref.trim();
  if (signById.has(r)) return { sign: signById.get(r), key: signById.get(r).img };
  const up = r.toUpperCase();
  if (imageOwner.has(up)) return { sign: signById.get(imageOwner.get(up)), key: up };
  const low = [...signById.keys()].find((k) => k.toLowerCase() === r.toLowerCase());
  if (low) return { sign: signById.get(low), key: signById.get(low).img };
  return null;
}

// ---------------------------------------------------------------- glossary
const glossary = glossaryRaw.map((g) => ({ ...g, id: g.id || slugify(g.sv) }));
const termById = new Map(glossary.map((g) => [g.id, g]));

// ---------------------------------------------------------------- lessons (front matter + markdown)
function walk(dir) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.md') ? [path.join(dir, e.name)] : []);
}
function parseFrontMatter(text, file) {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
  if (!m) { problem(file, 'missing front matter'); return { meta: {}, body: text }; }
  return { meta: yaml.load(m[1]) || {}, body: m[2] };
}
const lessonFiles = walk('content/lessons');
const lessonsRaw = lessonFiles.map((f) => {
  const { meta, body } = parseFrontMatter(read(f), f);
  return { ...meta, file: f, body };
});
const lessonById = new Map(lessonsRaw.map((l) => [l.id, l]));
for (const l of lessonsRaw) if (!l.id) problem(l.file, 'lesson has no id');

// ---------------------------------------------------------------- shortcode rendering
function factValue(key, env) {
  const parts = key.split('.');
  let v = facts;
  for (const p of parts) v = v?.[p];
  if (typeof v === 'string') return v;
  if (!v || v.value === undefined) { problem(env.where, `unknown fact "${key}"`); return `[${key}]`; }
  if (v.src) env.sources?.add(v.loc ? `${v.src}|${v.loc}` : v.src);
  return v.value;
}

function citation(srcId, loc, env) {
  const s = sourceById.get(srcId);
  if (!s) { problem(env.where, `unknown source "${srcId}"`); return { html: `<span class="cite">[${escapeHtml(srcId)}]</span>`, href: '#' }; }
  env.sources?.add(loc ? `${srcId}|${loc}` : srcId);
  let href = s.url;
  let label = s.short || s.title;
  if (loc) {
    const [k, p] = loc.includes(':') ? loc.split(':') : [null, loc];
    if (s.section) href = s.section.replace('{k}', k ?? '').replace('{p}', p);
    // Non-breaking spaces keep "3 kap. 17 §" together when a citation wraps.
    if (s.kind === 'law' || s.kind === 'regulation') label = k ? `${s.short} ${k}\u00a0kap.\u00a0${p}\u00a0§` : `${s.short} ${p}\u00a0§`;
    else label = `${s.short} ${loc}`;
  }
  const title = `${s.titleEn || s.title}${loc ? ` — ${label}` : ''}`;
  return {
    html: `<a class="cite" href="${escapeHtml(href)}" target="_blank" rel="noopener" title="${escapeHtml(title)}">${escapeHtml(label)}</a>`,
    href,
  };
}

function signImg(key, sign, cls = '') {
  return `<img class="sign-img ${cls}" data-sign="${key}" alt="${escapeHtml(`${sign.id} ${sign.en || sign.sv}`)}" width="64" height="64">`;
}

function renderShortcode(type, arg, env) {
  const [main, ...opts] = arg.split('|');
  switch (type) {
    case 'sign': {
      const r = resolveSign(main);
      if (!r) { problem(env.where, `unknown sign "${main}"`); return `<span class="missing">${escapeHtml(main)}</span>`; }
      env.signs?.add(r.sign.id);
      const label = opts[0] ?? r.sign.id;
      return `<a class="sign-ref" href="#sign.${r.sign.id}" title="${escapeHtml(`${r.sign.id}: ${r.sign.en} (${r.sign.sv})`)}">${signImg(r.key, r.sign, 'inline')}<span>${escapeHtml(label)}</span></a>`;
    }
    case 'signs': {
      const cards = main.split(',').map((ref) => {
        const r = resolveSign(ref);
        if (!r) { problem(env.where, `unknown sign "${ref}"`); return ''; }
        env.signs?.add(r.sign.id);
        const variant = r.sign.variants.find((v) => v.key === r.key);
        const caption = variant && variant.en ? variant.en : r.sign.en;
        return `<a class="sign-card" href="#sign.${r.sign.id}">${signImg(r.key, r.sign)}<span class="sign-code">${escapeHtml(r.key === r.sign.img ? r.sign.id : r.key)}</span><span class="sign-name">${escapeHtml(caption)}</span></a>`;
      });
      return `<div class="sign-grid">${cards.join('')}</div>\n`;
    }
    case 'term': {
      const t = termById.get(main);
      if (!t) { problem(env.where, `unknown term "${main}"`); return escapeHtml(opts[0] || main); }
      env.terms?.add(t.id);
      // [[term:id|sv]] shows the Swedish headword, e.g. after the English word in bold.
      if (opts[0] === 'sv') return `<a class="term" href="#term.${t.id}" data-term="${t.id}" lang="sv"><i>${escapeHtml(t.sv)}</i></a>`;
      const label = opts[0] || t.en;
      return `<a class="term" href="#term.${t.id}" data-term="${t.id}">${escapeHtml(label)}</a>`;
    }
    case 'sv': // a Swedish word shown in italics with lang attribute
      return `<i lang="sv">${escapeHtml(main)}</i>`;
    case 'src': {
      return citation(main, opts[0], env).html;
    }
    case 'fact':
      return escapeHtml(factValue(main, env));
    case 'lesson': {
      const l = lessonById.get(main);
      if (!l) { problem(env.where, `unknown lesson "${main}"`); return escapeHtml(opts[0] || main); }
      env.lessons?.add(main);
      return `<a class="lesson-link" href="#lesson.${main}">${escapeHtml(opts[0] || l.title)}</a>`;
    }
    case 'photo': {
      const p = photoById.get(main);
      if (!p) { problem(env.where, `unknown photo "${main}"`); return ''; }
      env.photos?.add(main);
      return photoFigure(p, opts[0]);
    }
    case 'fig': {
      const d = diagramById.get(main);
      if (!d) { problem(env.where, `unknown diagram "${main}"`); return ''; }
      if (!exists(`assets/diagrams/${main}.svg`)) { problem(env.where, `diagram file assets/diagrams/${main}.svg missing`); return ''; }
      env.diagrams?.add(main);
      const svg = read(`assets/diagrams/${main}.svg`).replace(/<\?xml[^>]*>\s*/, '');
      return `<figure class="diagram">${svg}<figcaption>${md.renderInline(opts[0] || d.caption || '', env)} <span class="credit">Illustration made for this site.</span></figcaption></figure>\n`;
    }
    default:
      problem(env.where, `unknown shortcode type "${type}"`);
      return escapeHtml(`[[${type}:${arg}]]`);
  }
}

function photoFigure(p, captionOverride) {
  const caption = captionOverride || p.caption || '';
  return `<figure class="photo"><img src="assets/photos/${p.id}.webp" alt="${escapeHtml(p.alt)}" loading="lazy" width="${p.w || 900}" height="${p.h || 600}"><figcaption>${md.renderInline(caption, {})} <span class="credit">${photoCredit(p)}</span></figcaption></figure>\n`;
}
function photoCredit(p) {
  const lic = p.licenseUrl ? `<a href="${escapeHtml(p.licenseUrl)}" target="_blank" rel="noopener">${escapeHtml(p.license)}</a>` : escapeHtml(p.license);
  return `Photo: ${escapeHtml(p.author)}, ${lic}, via <a href="${escapeHtml(p.page)}" target="_blank" rel="noopener">${escapeHtml(p.via || 'Wikimedia Commons')}</a>${p.modified ? ' (cropped/resized)' : ''}.`;
}

const site = { renderShortcode, citation, problem: (env, msg) => problem(env.where, msg) };
const md = createMarkdown(site);

// ---------------------------------------------------------------- render lessons
const MIN_WPM = 180;
const lessons = lessonsRaw.map((l) => {
  const env = { where: l.file, sources: new Set(), signs: new Set(), terms: new Set(), lessons: new Set(), photos: new Set(), diagrams: new Set() };
  for (const s of l.sources || []) env.sources.add(s);
  const html = renderLessonMarkdown(md, l.body, env);
  const text = html.replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const words = text.split(' ').length;
  // Split into sections for search.
  const sections = [];
  const re = /<h2 id="([^"]+)">([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2 id=|$)/g;
  let m;
  const firstH2 = html.indexOf('<h2');
  sections.push({ id: '', title: l.title, html: firstH2 >= 0 ? html.slice(0, firstH2) : html });
  while ((m = re.exec(html))) sections.push({ id: m[1], title: m[2].replace(/<[^>]+>/g, ''), html: m[3] });
  // One entry per source, with every paragraph the lesson cites from it.
  const grouped = new Map();
  for (const s of env.sources) {
    const [id, loc] = s.split('|');
    if (!sourceById.has(id)) problem(l.file, `unknown source "${id}"`);
    if (!grouped.has(id)) grouped.set(id, new Set());
    if (loc) grouped.get(id).add(loc);
  }
  const sourceList = [...grouped].map(([id, locs]) => ({ id, locs: [...locs] }));
  if (!sourceList.length) problem(l.file, 'lesson cites no sources');
  return {
    id: l.id,
    title: l.title,
    summary: l.summary || '',
    module: l.module,
    paths: l.paths || ['car-manual', 'car-automatic', 'motorcycle'],
    goals: l.goals || [],
    minutes: Math.max(2, Math.round(words / MIN_WPM)),
    html,
    headings: env.headings || [],
    sources: sourceList,
    signs: [...env.signs],
    terms: [...env.terms],
    photos: [...env.photos],
    diagrams: [...env.diagrams],
    updated: l.updated || facts.checkedOn,
    _sections: sections,
  };
});

// ---------------------------------------------------------------- paths and modules
const paths = (pathsDef.paths || []).map((p) => {
  const modules = (p.modules || []).map((mod) => {
    const ids = mod.lessons || [];
    for (const id of ids) {
      const l = lessons.find((x) => x.id === id);
      if (!l) problem(`paths.yaml ${p.id}/${mod.id}`, `unknown lesson "${id}"`);
      else if (!l.paths.includes(p.id)) problem(`paths.yaml ${p.id}/${mod.id}`, `lesson "${id}" does not list path ${p.id}`);
    }
    return { id: mod.id, title: mod.title, intro: mod.intro || '', area: mod.area || '', lessons: ids };
  });
  return { ...p, modules };
});
for (const l of lessons) {
  for (const pid of l.paths) {
    const p = paths.find((x) => x.id === pid);
    if (p && !p.modules.some((m) => m.lessons.includes(l.id))) problem(l.id, `lists path ${pid} but is not in that path's modules`);
  }
}

// ---------------------------------------------------------------- glossary rendering
const glossaryOut = glossary.map((g) => {
  const env = { where: `glossary ${g.id}`, sources: new Set(), signs: new Set(), terms: new Set(), lessons: new Set(), photos: new Set(), diagrams: new Set() };
  const defHtml = md.renderInline(g.def || '', env);
  const moreHtml = g.more ? md.render(g.more, env) : '';
  // image: one "kind:ref" string or a list of them (sign:, photo:, fig:).
  let imageHtml = '';
  for (const img of [].concat(g.image || [])) {
    const [kind, ref] = img.split(':');
    if (kind === 'sign') imageHtml += renderShortcode('signs', ref, env);
    else if (kind === 'photo') imageHtml += renderShortcode('photo', ref, env);
    else if (kind === 'fig') imageHtml += renderShortcode('fig', ref, env);
    else problem(env.where, `bad image "${img}"`);
  }
  for (const r of g.related || []) if (!termById.has(r)) problem(env.where, `unknown related term "${r}"`);
  for (const r of g.lessons || []) if (!lessonById.has(r)) problem(env.where, `unknown lesson "${r}"`);
  if (!g.def) problem(env.where, 'missing definition');
  return {
    id: g.id, sv: g.sv, en: g.en, also: g.also || [], def: defHtml, more: moreHtml, imageHtml,
    related: g.related || [], lessons: g.lessons || [],
    sources: [...env.sources].map((s) => { const [id, loc] = s.split('|'); return { id, loc: loc || '' }; }),
    lawHtml: (g.law || []).map((c) => { const [id, loc] = c.split('|'); return citation(id, loc, env).html; }).join(' '),
  };
});

// ---------------------------------------------------------------- questions
const AREAS = {
  vehicle: 'Vehicle knowledge and handling',
  environment: 'Environment',
  safety: 'Traffic safety',
  rules: 'Traffic rules',
  personal: 'Personal factors',
};
const qFiles = fs.existsSync(path.join(ROOT, 'content/questions'))
  ? fs.readdirSync(path.join(ROOT, 'content/questions')).filter((f) => f.endsWith('.yaml')).sort().map((f) => `content/questions/${f}`)
  : [];
const questions = [];
const qIds = new Set();
for (const f of qFiles) {
  const list = yaml.load(read(f)) || [];
  for (const q of list) {
    const where = `${f} ${q.id}`;
    if (!q.id) { problem(f, 'question without id'); continue; }
    if (qIds.has(q.id)) problem(where, 'duplicate id');
    qIds.add(q.id);
    if (!AREAS[q.area]) problem(where, `bad area "${q.area}"`);
    if (!Array.isArray(q.options) || q.options.length < 2) problem(where, 'needs 2+ options');
    if (!(q.answer >= 0 && q.answer < (q.options || []).length)) problem(where, 'answer index out of range');
    if (new Set(q.options).size !== (q.options || []).length) problem(where, 'duplicate options');
    if (!q.explain) problem(where, 'missing explanation');
    if (!q.src || !q.src.length) problem(where, 'missing source');
    if (q.lesson && !lessonById.has(q.lesson)) problem(where, `unknown lesson "${q.lesson}"`);
    const qp = q.paths || ['car-manual', 'car-automatic', 'motorcycle'];
    for (const p of qp) if (!PATH_LABELS[p]) problem(where, `bad path "${p}"`);
    const env = { where, sources: new Set(), signs: new Set(), terms: new Set(), lessons: new Set(), photos: new Set(), diagrams: new Set() };
    let imageHtml = '';
    if (q.image) {
      const [kind, ref] = String(q.image).split(':');
      if (kind === 'sign') {
        const r = resolveSign(ref);
        if (!r) problem(where, `unknown sign "${ref}"`);
        else { env.signs.add(r.sign.id); imageHtml = `<div class="q-sign">${signImg(r.key, r.sign, 'large')}</div>`; }
      } else if (kind === 'photo') imageHtml = renderShortcode('photo', ref, env);
      else if (kind === 'fig') imageHtml = renderShortcode('fig', ref, env);
      else problem(where, `bad image "${q.image}"`);
    }
    questions.push({
      id: q.id,
      area: q.area,
      paths: qp,
      lesson: q.lesson || '',
      q: md.renderInline(q.q, env),
      img: imageHtml,
      opts: q.options.map((o) => md.renderInline(String(o), env)),
      a: q.answer,
      ex: md.renderInline(q.explain || '', env),
      src: (q.src || []).map((c) => { const [id, loc] = c.split('|'); return citation(id, loc, env).html; }),
      signs: [...env.signs],
      gen: q.generated || undefined,
      // fix: keep the written option order (e.g. "Both A and B"); noExam: practice only, never in the exam simulator.
      fix: q.fix ? 1 : undefined,
      noExam: q.exam === false ? 1 : undefined,
    });
  }
}

// Sign-recognition questions generated from the catalogue: show a sign, choose its meaning.
// Distractors come from the same category so the choice is not trivial.
const SIGN_QUIZ_CATS = ['A', 'B', 'C', 'D', 'E', 'M', 'T', 'SIG', 'P', 'X', 'Y'];
const signQuestions = [];
function seededShuffle(arr, seed) {
  const a = arr.slice();
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
let seed = 7;
for (const s of signs) {
  if (!SIGN_QUIZ_CATS.includes(s.cat) || !s.en || s.noQuiz) continue;
  const enEntry = signsEn[s.id] || {};
  if (enEntry.quiz === false) continue;
  const pool = signs.filter((o) => o.cat === s.cat && o.id !== s.id && o.en && o.en !== s.en && !(enEntry.confusable || []).includes(o.id));
  if (pool.length < 3) continue;
  const distract = seededShuffle(pool, seed++).slice(0, 3).map((o) => o.en);
  const opts = seededShuffle([s.en, ...distract], seed++);
  const area = 'rules';
  const env = { where: `sign-q ${s.id}`, sources: new Set(), signs: new Set([s.id]) };
  signQuestions.push({
    id: `sign-${s.id}`,
    area,
    paths: ['car-manual', 'car-automatic', 'motorcycle'],
    lesson: enEntry.lesson || '',
    q: 'What does this sign, marking or signal mean?',
    img: `<div class="q-sign">${signImg(s.img, s, 'large')}</div>`,
    opts: opts.map((o) => escapeHtml(o)),
    a: opts.indexOf(s.en),
    ex: `${escapeHtml(s.id)} is <strong>${escapeHtml(s.en)}</strong> (Swedish: <i lang="sv">${escapeHtml(s.sv)}</i>). ${md.renderInline(s.enText || '', env)}`,
    src: [citation('vmf', CAT_INFO[s.cat].vmf, env).html],
    signs: [s.id],
    gen: 'sign',
  });
}

// ---------------------------------------------------------------- sources used-by
const usedBy = new Map();
for (const l of lessons) for (const s of l.sources) {
  if (!usedBy.has(s.id)) usedBy.set(s.id, new Set());
  usedBy.get(s.id).add(l.id);
}

// ---------------------------------------------------------------- search index
const strip = (h) => h.replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/g, ' ').replace(/\s+/g, ' ').trim();
const searchDocs = [];
for (const l of lessons) {
  for (const sec of l._sections) {
    const text = strip(sec.html);
    if (!text && sec.id) continue;
    searchDocs.push({
      id: `l:${l.id}:${sec.id}`,
      type: 'lesson',
      title: sec.id ? `${l.title} › ${sec.title}` : l.title,
      text: sec.id ? text : `${l.summary} ${text}`,
      kw: '',
      route: sec.id ? `lesson.${l.id}.${sec.id}` : `lesson.${l.id}`,
    });
  }
}
for (const s of signs) {
  searchDocs.push({
    id: `s:${s.id}`,
    type: 'sign',
    title: `${s.id} ${s.en}`,
    code: [s.id, s.img, ...s.variants.map((v) => v.key)].join(' '),
    sv: s.sv,
    text: `${s.enText} ${s.tip} ${s.variants.map((v) => v.en).join(' ')}`,
    kw: (s.kw || []).join(' '),
    route: `sign.${s.id}`,
    img: s.img,
  });
}
for (const g of glossaryOut) {
  searchDocs.push({
    id: `g:${g.id}`,
    type: 'term',
    title: g.en,
    sv: g.sv,
    text: strip(`${g.def} ${g.more}`),
    kw: g.also.join(' '),
    route: `term.${g.id}`,
  });
}
// Built with the same term processing the browser uses for queries.
const miniReal = new MiniSearch({ ...SEARCH_OPTIONS, processTerm });
miniReal.addAll(searchDocs);

// ---------------------------------------------------------------- write output
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'assets/data'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'assets/photos'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'assets/signs'), { recursive: true });

const js = (name, obj) => `window.${name}=${JSON.stringify(obj)};\n`;
const lessonsOut = lessons.map(({ _sections, ...rest }) => rest);
const sourcesOut = sources.map((s) => ({ ...s, usedBy: [...(usedBy.get(s.id) || [])] }));
const content = {
  facts, paths, lessons: lessonsOut, glossary: glossaryOut, sources: sourcesOut, areas: AREAS,
  cats: CAT_ORDER.map((c) => ({ id: c, ...CAT_INFO[c], count: signs.filter((s) => s.cat === c).length })),
  photos: photos.map((p) => ({ id: p.id, alt: p.alt, caption: p.caption || '', author: p.author, license: p.license, licenseUrl: p.licenseUrl || '', page: p.page, via: p.via || 'Wikimedia Commons', title: p.title || '' })),
  diagrams: diagrams.map((d) => ({ id: d.id, caption: d.caption || '' })),
  pathLabels: PATH_LABELS,
  built: new Date().toISOString().slice(0, 10),
};
fs.writeFileSync(path.join(OUT, 'assets/data/content.js'), js('DL_CONTENT', content));
fs.writeFileSync(path.join(OUT, 'assets/data/signs.js'), js('DL_SIGNS', signs));
fs.writeFileSync(path.join(OUT, 'assets/data/questions.js'), js('DL_QUESTIONS', [...questions, ...signQuestions]));
fs.writeFileSync(path.join(OUT, 'assets/data/search.js'),
  `window.DL_SEARCH=${JSON.stringify({ index: miniReal.toJSON(), docs: Object.fromEntries(searchDocs.map((d) => [d.id, { type: d.type, title: d.title, sv: d.sv || '', route: d.route, img: d.img || '', snippet: d.text.slice(0, 220) }])) })};\n`);

// Sign images: one bundle per group of categories, loaded on demand by the app.
const SIGN_BUNDLES = { a: ['A', 'B'], c: ['C', 'D'], e: ['E', 'J', 'T', 'S'], f: ['F', 'G', 'H', 'I'], m: ['M', 'SIG', 'P', 'V', 'X', 'Y'] };
const bundleOf = {};
for (const [b, cats] of Object.entries(SIGN_BUNDLES)) {
  const map = {};
  for (const s of signs.filter((x) => cats.includes(x.cat))) {
    for (const key of [s.img, ...s.variants.map((v) => v.key)]) {
      const file = path.join(ROOT, 'assets/signs', `${key}.webp`);
      if (!fs.existsSync(file)) continue;
      map[key] = fs.readFileSync(file).toString('base64');
      bundleOf[key] = b;
    }
  }
  fs.writeFileSync(path.join(OUT, `assets/signs/bundle-${b}.js`), `window.DL_SIGNIMG_ADD(${JSON.stringify(map)});\n`);
}
fs.writeFileSync(path.join(OUT, 'assets/data/sign-bundles.js'), js('DL_SIGN_BUNDLE_OF', bundleOf));

// Photos
for (const p of photos) {
  const f = path.join(ROOT, 'assets/photos', `${p.id}.webp`);
  if (!fs.existsSync(f)) { problem(`photo ${p.id}`, 'file missing'); continue; }
  fs.copyFileSync(f, path.join(OUT, 'assets/photos', `${p.id}.webp`));
}

// App code: concatenated classic scripts so the site also works when opened from disk.
const jsOrder = ['search-options.js', 'util.js', 'store.js', 'signs.js', 'search.js', 'quiz.js', 'views.js', 'main.js'];
const appJs = jsOrder.map((f) => `// ---- ${f}\n${read(`assets/js/${f}`).replace(/^export\s+/gm, '')}`).join('\n');
fs.writeFileSync(path.join(OUT, 'assets/app.js'), `(function(){'use strict';\n${appJs}\n})();\n`);
fs.copyFileSync(path.join(ROOT, 'node_modules/minisearch/dist/umd/index.js'), path.join(OUT, 'assets/minisearch.js'));
fs.copyFileSync(path.join(ROOT, 'assets/css/app.css'), path.join(OUT, 'assets/app.css'));

// HTML shells
// Parts between <!--full--> and <!--/full--> exist only in the standalone page.
const shell = read('assets/shell.html');
fs.writeFileSync(path.join(OUT, 'index.html'), shell.replace(/<!--\/?full-->/g, ''));
fs.writeFileSync(path.join(OUT, 'artifact.html'), shell.replace(/<!--full-->[\s\S]*?<!--\/full-->/g, '').trim() + '\n');
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

// ---------------------------------------------------------------- report
const stats = {
  lessons: lessons.length, signs: signs.length, signImages: Object.keys(bundleOf).length,
  terms: glossaryOut.length, questions: questions.length, signQuestions: signQuestions.length,
  sources: sources.length, photos: photos.length, diagrams: diagrams.length, searchDocs: searchDocs.length,
};
console.log('Built docs/:', JSON.stringify(stats));
if (problems.length) {
  console.log(`\n${problems.length} problem(s):`);
  for (const p of problems.slice(0, 400)) console.log('  - ' + p);
  if (process.argv.includes('--strict')) process.exit(1);
}
