// Checks the content and the built site.  npm test  (= node scripts/validate.mjs)
// 1. Rebuilds docs/ and fails on any build problem (unknown signs, terms, sources, lessons …).
// 2. Loads the built data and checks questions, the exam simulator, the dictionary,
//    sources, photo licences, diagrams and the ids used in links.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = path.join(ROOT, 'docs');
const errors = [];
const warnings = [];
const fail = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);
let checks = 0;
const check = (ok, msg) => { checks += 1; if (!ok) fail(msg); };

// ---------------------------------------------------------------- 1. build
const out = execFileSync(process.execPath, [path.join(ROOT, 'scripts/build.mjs')], { encoding: 'utf8' });
const stats = JSON.parse(/Built docs\/: (\{.*\})/.exec(out)?.[1] || '{}');
check(!/problem\(s\):/.test(out), `build reported problems:\n${out.split('problem(s):')[1] || ''}`);

// ---------------------------------------------------------------- 2. load the built data like the browser does
const ctx = { window: {}, console };
vm.createContext(ctx);
for (const f of ['content', 'questions', 'signs', 'search', 'sign-bundles']) {
  vm.runInContext(fs.readFileSync(path.join(DOCS, `assets/data/${f}.js`), 'utf8'), ctx);
}
const C = ctx.window.DL_CONTENT;
const Q = ctx.window.DL_QUESTIONS;
const S = ctx.window.DL_SIGNS;
const PATHS = C.paths.map((p) => p.id);
const AREAS = Object.keys(C.areas);
const lessonIds = new Set(C.lessons.map((l) => l.id));
const signIds = new Set(S.map((s) => s.id));
const sourceIds = new Set(C.sources.map((s) => s.id));

// Ids end up in links such as #lesson.<id>; keep them to characters every host passes through.
const SAFE_ID = /^[A-Za-z0-9_~-]+$/;
for (const [kind, ids] of [['lesson', [...lessonIds]], ['term', C.glossary.map((t) => t.id)], ['sign', [...signIds]], ['source', [...sourceIds]]]) {
  const seen = new Set();
  for (const id of ids) {
    check(SAFE_ID.test(id), `${kind} id "${id}" has characters that are unsafe in a link`);
    check(!seen.has(id), `duplicate ${kind} id "${id}"`);
    seen.add(id);
  }
}

// ---------------------------------------------------------------- questions
const qIds = new Set();
for (const q of Q) {
  const where = `question ${q.id}`;
  check(!qIds.has(q.id), `duplicate question id ${q.id}`);
  qIds.add(q.id);
  check(AREAS.includes(q.area), `${where}: unknown area "${q.area}"`);
  check(q.paths.length > 0 && q.paths.every((p) => PATHS.includes(p)), `${where}: bad paths ${q.paths}`);
  check(lessonIds.has(q.lesson), `${where}: unknown lesson "${q.lesson}"`);
  check(typeof q.q === 'string' && q.q.trim().length > 5, `${where}: missing question text`);
  check(Array.isArray(q.opts) && q.opts.length >= 2 && q.opts.length <= 6, `${where}: needs 2–6 options`);
  const norm = q.opts.map((o) => String(o).replace(/<[^>]+>/g, '').trim().toLowerCase());
  check(new Set(norm).size === norm.length, `${where}: two options are the same`);
  check(norm.every((o) => o.length > 0), `${where}: empty option`);
  check(Number.isInteger(q.a) && q.a >= 0 && q.a < q.opts.length, `${where}: answer index out of range`);
  check(typeof q.ex === 'string' && q.ex.trim().length > 10, `${where}: missing explanation`);
  if (!q.gen) {
    // The build resolves every "source|location" into a citation link (and reports unknown ids).
    check(Array.isArray(q.src) && q.src.length > 0, `${where}: no source given`);
    for (const s of q.src || []) check(/class="cite" href="https:\/\//.test(s), `${where}: source is not a resolved citation link`);
  }
  for (const s of q.signs || []) check(signIds.has(s.replace(/-\d+$/, '')) || signIds.has(s), `${where}: unknown sign ${s}`);
}

// ---------------------------------------------------------------- the exam simulator, run with the site's own code
const appCtx = { window: ctx.window, console, document: undefined, Math, Date, Map, Set, JSON };
vm.createContext(appCtx);
const strip = (f) => fs.readFileSync(path.join(ROOT, 'assets/js', f), 'utf8').replace(/^export\s+/gm, '');
vm.runInContext(`${strip('util.js')}\n${strip('store.js')}\n${strip('quiz.js')}\nthis.__exam = { assembleExam, EXAM_MIX, EXAM_TRIAL, MAX_SIGN_QUESTIONS_IN_EXAM };`, appCtx);
const { assembleExam, EXAM_MIX, EXAM_TRIAL, MAX_SIGN_QUESTIONS_IN_EXAM } = appCtx.__exam;
const SCORED = Object.values(EXAM_MIX).reduce((a, b) => a + b, 0);
const QI = new Map(Q.map((q) => [q.id, q]));
for (const p of PATHS) {
  for (let run = 0; run < 200; run++) {
    const exam = assembleExam(p);
    const scored = exam.filter((e) => !e.trial);
    const trial = exam.filter((e) => e.trial);
    const ids = exam.map((e) => e.id);
    check(exam.length === SCORED + EXAM_TRIAL, `exam ${p}: ${exam.length} questions, expected ${SCORED + EXAM_TRIAL}`);
    check(scored.length === SCORED && trial.length === EXAM_TRIAL, `exam ${p}: wrong scored/trial split`);
    check(new Set(ids).size === ids.length, `exam ${p}: the same question twice`);
    const qs = ids.map((id) => QI.get(id));
    check(qs.every((q) => q && q.paths.includes(p)), `exam ${p}: contains a question from another licence`);
    check(qs.every((q) => !q.noExam), `exam ${p}: contains a practice-only question`);
    const byArea = {};
    for (const e of scored) { const a = QI.get(e.id).area; byArea[a] = (byArea[a] || 0) + 1; }
    for (const [a, n] of Object.entries(EXAM_MIX)) check(byArea[a] === n, `exam ${p}: ${byArea[a] || 0} ${a} questions, expected ${n}`);
    const signs = scored.filter((e) => QI.get(e.id).gen === 'sign').length;
    check(signs <= MAX_SIGN_QUESTIONS_IN_EXAM, `exam ${p}: ${signs} sign questions`);
    for (const e of exam) {
      const q = QI.get(e.id);
      check(Array.isArray(e.order) && e.order.length === q.opts.length && [...e.order].sort().join() === q.opts.map((_, i) => i).join(), `exam ${p}: bad option order for ${q.id}`);
    }
  }
  // Pool size per area, so that exams keep varying.
  for (const a of AREAS) {
    const n = Q.filter((q) => q.paths.includes(p) && q.area === a && !q.noExam).length;
    if (n < (EXAM_MIX[a] || 0) * 2) warn(`exam ${p}: only ${n} ${a} questions for ${EXAM_MIX[a]} places`);
  }
}

// ---------------------------------------------------------------- dictionary
for (const t of C.glossary) {
  const where = `term ${t.id}`;
  check(t.sv && t.en && t.def, `${where}: needs sv, en and def`);
  for (const r of t.related) check(C.glossary.some((x) => x.id === r), `${where}: unknown related term ${r}`);
  for (const l of t.lessons) check(lessonIds.has(l), `${where}: unknown lesson ${l}`);
}
const withPictures = C.glossary.filter((t) => t.imageHtml).length;

// ---------------------------------------------------------------- lessons
for (const l of C.lessons) {
  check(l.sources.length > 0, `lesson ${l.id}: cites no source`);
  for (const s of l.sources) check(sourceIds.has(s.id), `lesson ${l.id}: unknown source ${s.id}`);
  check(!/\[\[[a-z]+:/.test(l.html), `lesson ${l.id}: an unrendered [[shortcode]] is left in the page`);
  check(l.paths.every((p) => PATHS.includes(p)), `lesson ${l.id}: bad paths`);
}

// ---------------------------------------------------------------- sources
for (const s of C.sources) {
  const where = `source ${s.id}`;
  check(/^https:\/\//.test(s.url), `${where}: url must be https`);
  check(/^\d{4}-\d{2}-\d{2}/.test(String(s.accessed)), `${where}: accessed date missing`);
  check(s.short && s.title && s.publisher && s.kind, `${where}: needs short, title, publisher and kind`);
  if (!s.usedBy.length && s.use !== 'images') warn(`${where}: not cited anywhere`);
}

// ---------------------------------------------------------------- photos (licences and files)
const FREE = [/^Public domain$/i, /^CC0/i, /^CC BY(-SA)? \d\.\d( [a-z]{2})?$/i, /^No restrictions$/i];
for (const p of C.photos) {
  const where = `photo ${p.id}`;
  check(FREE.some((re) => re.test(p.license)), `${where}: licence "${p.license}" is not on the free list`);
  check(p.author && p.page && p.alt && p.caption, `${where}: needs author, page, alt and caption`);
  if (/^CC BY/i.test(p.license)) check(/^https:\/\/creativecommons\.org\/licenses\//.test(p.licenseUrl), `${where}: CC licence needs its licence link`);
  const f = path.join(DOCS, 'assets/photos', `${p.id}.webp`);
  check(fs.existsSync(f), `${where}: file missing`);
  if (fs.existsSync(f)) check(fs.statSync(f).size < 250 * 1024, `${where}: file over 250 kB`);
}

// ---------------------------------------------------------------- diagrams
const svgIds = new Map();
for (const d of C.diagrams) {
  const f = path.join(ROOT, 'assets/diagrams', `${d.id}.svg`);
  check(fs.existsSync(f), `diagram ${d.id}: file missing`);
  if (!fs.existsSync(f)) continue;
  const svg = fs.readFileSync(f, 'utf8');
  check(/<title[ >]/.test(svg) && /<desc[ >]/.test(svg), `diagram ${d.id}: needs <title> and <desc> for screen readers`);
  check(/role="img"/.test(svg), `diagram ${d.id}: needs role="img"`);
  // Several diagrams can be inlined on one page, so element ids must not collide.
  for (const [, id] of svg.matchAll(/\sid="([^"]+)"/g)) {
    check(!svgIds.has(id), `diagram ${d.id}: id "${id}" is also used in ${svgIds.get(id)}`);
    svgIds.set(id, d.id);
  }
}

// ---------------------------------------------------------------- search index
const search = ctx.window.DL_SEARCH;
check(search && search.index && Object.keys(search.docs).length === stats.searchDocs, 'search index does not match the build');
for (const probe of ['B1', 'C31']) check(Object.values(search.docs).some((d) => d.title.includes(probe) || d.route === `sign.${probe}`), `search: no document for ${probe}`);

// ---------------------------------------------------------------- sizes (each published file must stay well under 16 MB)
for (const f of fs.readdirSync(path.join(DOCS, 'assets/data'))) {
  const size = fs.statSync(path.join(DOCS, 'assets/data', f)).size;
  check(size < 8 * 1024 * 1024, `docs/assets/data/${f} is ${(size / 1048576).toFixed(1)} MB`);
}

// ---------------------------------------------------------------- report
console.log(`Checked: ${stats.lessons} lessons, ${Q.length} questions (${Q.filter((q) => !q.gen).length} written + ${Q.filter((q) => q.gen).length} sign questions), ${C.glossary.length} dictionary words (${withPictures} with pictures), ${C.sources.length} sources, ${C.photos.length} photos, ${C.diagrams.length} diagrams, ${PATHS.length} exam simulators × 200 runs.`);
for (const p of PATHS) {
  const counts = AREAS.map((a) => `${a} ${Q.filter((q) => q.paths.includes(p) && q.area === a && !q.noExam).length}`).join(', ');
  console.log(`  ${p}: ${counts}`);
}
if (warnings.length) {
  console.log(`\n${warnings.length} warning(s):`);
  for (const w of warnings) console.log('  ! ' + w);
}
if (errors.length) {
  console.log(`\n${errors.length} error(s) in ${checks} checks:`);
  for (const e of errors.slice(0, 100)) console.log('  ✗ ' + e);
  process.exit(1);
}
console.log(`\nAll ${checks} checks passed.`);
