// Page views. Each view writes into <main> and returns the page title.
const C = () => window.DL_CONTENT;
const SIGNS = () => window.DL_SIGNS;
const signMap = new Map((window.DL_SIGNS || []).map((s) => [s.id, s]));
const lessonMap = new Map((window.DL_CONTENT.lessons || []).map((l) => [l.id, l]));
const termMap = new Map((window.DL_CONTENT.glossary || []).map((t) => [t.id, t]));
const sourceMap = new Map((window.DL_CONTENT.sources || []).map((s) => [s.id, s]));

const PATH_PICT = {
  'car-manual': `<svg class="lane-pict" viewBox="0 0 72 48" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"><path d="M14 10v28M36 10v28M58 10v28M14 24h44"/></g><g fill="currentColor"><circle cx="14" cy="10" r="4.2"/><circle cx="36" cy="10" r="4.2"/><circle cx="58" cy="10" r="4.2"/><circle cx="14" cy="38" r="4.2"/><circle cx="36" cy="38" r="4.2"/><circle cx="58" cy="38" r="4.2"/></g><g font-family="var(--font-display)" font-weight="700" font-size="9" fill="var(--paper)" text-anchor="middle"><text x="14" y="13">1</text><text x="36" y="13">3</text><text x="58" y="13">5</text><text x="14" y="41">2</text><text x="36" y="41">4</text><text x="58" y="41">R</text></g></svg>`,
  'car-automatic': `<svg class="lane-pict" viewBox="0 0 72 48" aria-hidden="true"><rect x="2" y="6" width="68" height="36" rx="8" fill="none" stroke="currentColor" stroke-width="3"/><g font-family="var(--font-display)" font-weight="700" font-size="17" text-anchor="middle" fill="currentColor"><text x="16" y="30">P</text><text x="30" y="30">R</text><text x="44" y="30">N</text></g><rect x="50" y="12" width="15" height="24" rx="4" fill="currentColor"/><text x="57.5" y="30" font-family="var(--font-display)" font-weight="700" font-size="17" text-anchor="middle" fill="var(--paper)">D</text></svg>`,
  motorcycle: `<svg class="lane-pict" viewBox="0 0 72 48" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="14" cy="34" r="10"/><circle cx="58" cy="34" r="10"/><path d="M14 34 27 22h15l8 12M42 22l-4-9h-7M50 34 46 16h9M27 22l-5-6"/></g></svg>`,
};

function pathById(id) {
  return C().paths.find((p) => p.id === id);
}

function lessonsInPath(p) {
  return p.modules.flatMap((m) => m.lessons);
}

// ---------------------------------------------------------------- rail (curriculum sidebar)
function renderRail(currentLessonId) {
  const rail = $('#rail');
  const layout = $('#layout');
  const p = pathById(State.path);
  if (!p) { rail.hidden = true; layout.classList.remove('has-rail'); return; }
  rail.hidden = false;
  layout.classList.add('has-rail');
  rail.innerHTML = `<div class="rail-path">${PATH_PICT[p.id] ? PATH_PICT[p.id].replace('lane-pict', 'rail-pict" width="34" height="24') : ''}<a href="#learn.${p.id}">${esc(p.title)}</a></div>
    ${p.modules.map((m) => `<div class="rail-mod"><p class="rail-mod-title">${esc(m.title)}</p><ol>${m.lessons.map((id) => {
      const l = lessonMap.get(id);
      if (!l) return '';
      return `<li><a href="#lesson.${id}" ${id === currentLessonId ? 'aria-current="page"' : ''}><span class="tick ${State.done.has(id) ? 'done' : ''}" aria-hidden="true"></span><span>${esc(l.title)}</span></a></li>`;
    }).join('')}</ol></div>`).join('')}
    <div class="rail-mod"><a class="btn small" href="#exam.${p.id}">Take the exam</a></div>`;
  const cur = $('[aria-current="page"]', rail);
  if (cur) cur.scrollIntoView({ block: 'nearest' });
}

function hideRail() {
  $('#rail').hidden = true;
  $('#layout').classList.remove('has-rail');
}

// ---------------------------------------------------------------- home
function viewHome() {
  hideRail();
  const c = C();
  const nLessons = c.lessons.length;
  const nQuestions = (window.DL_QUESTIONS || []).length;
  const F = c.facts;
  const stepLink = (id, text) => (lessonMap.has(id) ? `<a href="#lesson.${id}">${text}</a>` : text);
  const testLesson = State.path === 'motorcycle' ? 'riding-test-mc' : 'driving-test-car';
  $('#main').innerHTML = `
  <section class="hero">
    <p class="eyebrow">Körkort · theory test · in English</p>
    <h1>Learn Swedish driving theory in plain English</h1>
    <p class="lede">Pick the licence you are studying for. The lessons follow Transportstyrelsen's official course plans. The road signs are the official images, and every rule links to the Swedish law or official page it comes from.</p>
  </section>
  <div class="lanes" role="list">
    ${c.paths.map((p) => `<a class="lane" role="listitem" href="#learn.${p.id}" data-pick="${p.id}" ${State.path === p.id ? 'aria-current="true"' : ''}>
      ${PATH_PICT[p.id] || ''}
      <span class="cat">${esc(p.badge || '')}</span>
      <h2>${esc(p.title)}</h2>
      <p>${esc(p.blurb || '')}</p>
      <span class="go">${State.path === p.id ? 'Continue studying →' : 'Start this path →'}</span>
    </a>`).join('')}
  </div>
  <div class="stats" aria-label="What the site contains">
    <span><strong>${nLessons}</strong>lessons</span>
    <span><strong>${SIGNS().length}</strong>official signs, markings and signals</span>
    <span><strong>${nQuestions}</strong>practice questions</span>
    <span><strong>${c.glossary.length}</strong>dictionary words</span>
    <span><strong>${c.sources.length}</strong>official sources</span>
  </div>

  <section class="section">
    <h2>The road to your licence</h2>
    <p class="muted" style="margin:-.5rem 0 1.25rem;max-width:var(--measure)">The same order applies to the car and the motorcycle licence. Each step links to the lesson that explains it.</p>
    <ol class="journey">
      <li><div><h3>${stepLink('learner-permit', 'Get a learner’s permit')}</h3><p>Apply to Transportstyrelsen with a health declaration and an eyesight certificate. Applying is ${esc(F.prices.permit.value)}; it takes ${esc(F.permit.processing.value)} and is valid for ${esc(F.permit.validity.value)}.</p></div></li>
      <li><div><h3>${stepLink('practice-driving', 'Practise')}</h3><p>At a driving school, privately with an approved supervisor, or both. Cars: from ${esc(F.ages.practiceCar.value)}.</p></div></li>
      <li><div><h3>${stepLink('risk-education', 'Do the risk education')}</h3><p>Two compulsory parts, done before the tests. The car course and the motorcycle course are separate.</p></div></li>
      <li><div><h3>${stepLink('theory-test', 'Pass the theory test')}</h3><p>${esc(F.theory.questions.value)} questions in ${esc(F.theory.minutes.value)} minutes; ${esc(F.theory.passMark.value)} of ${esc(F.theory.scored.value)} points to pass. Available in English.</p></div></li>
      <li><div><h3>${stepLink(testLesson, 'Pass the driving test')}</h3><p>A safety check, special manoeuvres and driving in traffic. The motorcycle test also has a closed-area manoeuvre test.</p></div></li>
      <li><div><h3>${stepLink('after-the-test', 'Drive on probation')}</h3><p>For the first ${esc(F.probation.length.value)}. If your licence is revoked in that time, you must take both tests again.</p></div></li>
    </ol>
  </section>

  <section class="section">
    <h2>Look things up</h2>
    <div class="quick">
      <a href="#signs"><strong>Road signs</strong><span>All ${SIGNS().length} signs, markings and signals with official images, the Swedish name and an English explanation.</span></a>
      <a href="#dictionary"><strong>Dictionary</strong><span>Swedish traffic words explained in simple English, with pictures.</span></a>
      <a href="#practice"><strong>Practice and exam</strong><span>Quick quizzes, sign drills and a full ${esc(F.theory.questions.value)}-question exam simulator.</span></a>
      <a href="#sources"><strong>Sources</strong><span>Every law, regulation and official page this site is based on.</span></a>
    </div>
  </section>

  <section class="section">
    <div class="notice">
      <p><strong>Recent rule changes already included</strong></p>
      <ul style="margin:.4rem 0 0;padding-left:1.2rem">
        <li>From ${esc(F.supervisor.introCourseRemoved.value)}, private practice for a car licence no longer requires the introduction course (introduktionsutbildning). ${stepLink('practice-driving', 'Read more')}</li>
        <li>A theory test passed on or after ${esc(F.theory.validityChangeDate.value)} is valid for ${esc(F.theory.validity.value)} (before: four months). ${stepLink('theory-test', 'Read more')}</li>
      </ul>
    </div>
  </section>`;
  $$('.lane', $('#main')).forEach((a) => a.addEventListener('click', () => App.setPath(a.dataset.pick)));
  return 'Swedish driving theory in English';
}

// ---------------------------------------------------------------- learn: choose a path / path overview
function viewLearn(pathId) {
  if (!pathId && State.path) pathId = State.path;
  if (!pathId) {
    hideRail();
    $('#main').innerHTML = `<div class="page-head"><h1>Choose your licence</h1><p class="lede">Each path has its own lessons. Rules and signs are shared; vehicle knowledge, the tests and some rules differ.</p></div>
      <div class="lanes">${C().paths.map((p) => `<a class="lane" href="#learn.${p.id}" data-pick="${p.id}">${PATH_PICT[p.id] || ''}<span class="cat">${esc(p.badge || '')}</span><h2>${esc(p.title)}</h2><p>${esc(p.blurb || '')}</p><span class="go">Open →</span></a>`).join('')}</div>`;
    $$('.lane', $('#main')).forEach((a) => a.addEventListener('click', () => App.setPath(a.dataset.pick)));
    return 'Choose your licence';
  }
  const p = pathById(pathId);
  if (!p) return viewNotFound();
  if (State.path !== p.id) App.setPath(p.id, { silent: true });
  renderRail(null);
  const all = lessonsInPath(p);
  const done = all.filter((id) => State.done.has(id)).length;
  const next = all.find((id) => !State.done.has(id)) || all[0];
  const pct = all.length ? Math.round((done / all.length) * 100) : 0;
  $('#main').innerHTML = `<div class="page-head">
      <p class="eyebrow">${esc(p.badge || '')}</p>
      <h1>${esc(p.title)}</h1>
      <p class="lede">${esc(p.intro || p.blurb || '')}</p>
      <div class="progressbar" role="img" aria-label="${done} of ${all.length} lessons done"><span style="width:${pct}%"></span></div>
      <p class="muted small">${done} of ${all.length} lessons marked as done</p>
      <div class="btn-row">${next ? `<a class="btn" href="#lesson.${next}">${done ? 'Continue' : 'Start'}: ${esc(lessonMap.get(next).title)}</a>` : ''}<a class="btn ghost" href="#exam.${p.id}">Exam simulator</a></div>
    </div>
    ${p.modules.map((m, mi) => `<section class="module" id="m-${m.id}">
      <div class="module-head"><p class="eyebrow">Part ${mi + 1}</p><h2>${esc(m.title)}</h2>${m.area ? `<span class="chip">${esc(C().areas[m.area] || '')}</span>` : ''}</div>
      ${m.intro ? `<p class="module-intro">${esc(m.intro)}</p>` : ''}
      <ol class="lesson-list">${m.lessons.map((id) => {
        const l = lessonMap.get(id);
        if (!l) return '';
        return `<li><a href="#lesson.${id}"><span class="tick ${State.done.has(id) ? 'done' : ''}" aria-hidden="true"></span><span><span class="ltitle">${esc(l.title)}</span><span class="lsum">${esc(l.summary)}</span></span><span class="lmin">${l.minutes} min</span></a></li>`;
      }).join('')}</ol>
      <p class="btn-row" style="margin-top:.6rem"><a class="btn ghost small" href="#quiz.module.${m.id}">Practise this part</a></p>
    </section>`).join('')}`;
  return p.title;
}

// ---------------------------------------------------------------- lesson
function viewLesson(id, sectionId) {
  const l = lessonMap.get(id);
  if (!l) return viewNotFound();
  let p = pathById(State.path);
  const inPath = p && lessonsInPath(p).includes(id);
  if (!inPath) p = C().paths.find((x) => lessonsInPath(x).includes(id)) || null;
  renderRail(id);
  const mod = p ? p.modules.find((m) => m.lessons.includes(id)) : null;
  const order = p ? lessonsInPath(p) : [];
  const pos = order.indexOf(id);
  const prev = pos > 0 ? lessonMap.get(order[pos - 1]) : null;
  const next = pos >= 0 && pos < order.length - 1 ? lessonMap.get(order[pos + 1]) : null;
  const pathChips = l.paths.map((pid) => `<span class="chip ${State.path === pid ? 'green' : ''}">${esc(C().pathLabels[pid])}</span>`).join('');
  const sources = l.sources.map((s) => {
    const src = sourceMap.get(s.id);
    if (!src) return '';
    const sections = s.locs.length ? ` Cited: ${s.locs.map((loc) => citeHtml(s.id, loc)).join(' ')}` : '';
    return `<li><strong>${esc(src.title)}</strong>${src.titleEn && src.titleEn !== src.title ? ` (${esc(src.titleEn)})` : ''} — ${esc(src.publisher)}${src.consolidated ? `, ${esc(src.consolidated)}` : ''}. <a href="${esc(src.url)}" target="_blank" rel="noopener">Open the official source</a>.${sections}</li>`;
  }).join('');
  const qs = questionsFor(State.path).filter((q) => q.lesson === id);
  $('#main').innerHTML = `<article class="lesson">
    <div class="page-head">
      <p class="crumbs">${p ? `<a href="#learn.${p.id}">${esc(p.title)}</a><span aria-hidden="true">›</span>` : ''}${mod ? `<span>${esc(mod.title)}</span>` : ''}</p>
      <h1>${esc(l.title)}</h1>
      ${l.summary ? `<p class="lede">${esc(l.summary)}</p>` : ''}
      <div class="lesson-meta"><span>${l.minutes} min read</span><span>Checked ${esc(l.updated)}</span><span class="chips">${pathChips}</span></div>
      ${State.path && !l.paths.includes(State.path) ? `<p class="notice small">This lesson is not part of the ${esc(C().pathLabels[State.path])} path, but you can still read it.</p>` : ''}
    </div>
    ${l.goals.length ? `<div class="goals"><h2>In this lesson</h2><ul>${l.goals.map((g) => `<li>${esc(g)}</li>`).join('')}</ul></div>` : ''}
    <div class="prose" id="lesson-body">${l.html}</div>
    ${qs.length ? `<section class="check-yourself"><h2>Check yourself</h2><p class="muted">${plural(Math.min(3, qs.length), 'question')} from this lesson. Answer to see the explanation.</p><div id="cy"></div><p class="btn-row" style="margin-top:1rem"><a class="btn ghost small" href="#quiz.lesson.${id}">All ${qs.length} questions for this lesson</a></p></section>` : ''}
    <p class="btn-row section"><button class="btn ${State.done.has(id) ? 'ghost' : ''}" id="mark-done">${State.done.has(id) ? 'Marked as done ✓ (undo)' : 'Mark lesson as done'}</button></p>
    <section class="lesson-sources"><h2>Sources for this lesson</h2><ol>${sources}</ol></section>
    <nav class="lesson-nav" aria-label="Lesson navigation">
      ${prev ? `<a href="#lesson.${prev.id}"><span class="dir">Previous</span><span>${esc(prev.title)}</span></a>` : '<span></span>'}
      ${next ? `<a href="#lesson.${next.id}" style="text-align:right"><span class="dir">Next</span><span>${esc(next.title)}</span></a>` : (p ? `<a href="#exam.${p.id}" style="text-align:right"><span class="dir">Finished?</span><span>Try the exam simulator</span></a>` : '')}
    </nav>
  </article>`;
  applyPathFilter($('#lesson-body'));
  $$('table', $('#lesson-body')).forEach((t) => {
    if (t.parentElement.classList.contains('table-wrap')) return;
    const w = document.createElement('div');
    w.className = 'table-wrap';
    t.replaceWith(w);
    w.appendChild(t);
  });
  if (qs.length) {
    const box = $('#cy');
    sample(qs, 3).forEach((q, i) => {
      const slot = document.createElement('div');
      box.appendChild(slot);
      mountPracticeQuestion(slot, q, { label: `Question ${i + 1}` });
    });
  }
  $('#mark-done').addEventListener('click', () => { State.toggleDone(id); App.render({ keepScroll: true }); });
  if (sectionId) App.pendingAnchor = sectionId;
  return l.title;
}

function citeHtml(id, loc) {
  const s = sourceMap.get(id);
  if (!s) return '';
  let href = s.url;
  let label = s.short || s.title;
  if (loc) {
    const [k, p] = loc.includes(':') ? loc.split(':') : [null, loc];
    if (s.section) href = s.section.replace('{k}', k ?? '').replace('{p}', p);
    label = (s.kind === 'law' || s.kind === 'regulation') ? (k ? `${s.short} ${k} kap. ${p} §` : `${s.short} ${p} §`) : `${s.short} ${loc}`;
  }
  return `<a class="cite" href="${esc(href)}" target="_blank" rel="noopener">${esc(label)}</a>`;
}

// Show only the "Only for ..." blocks that match the chosen licence path.
function applyPathFilter(root) {
  $$('.only', root).forEach((el) => {
    const paths = (el.dataset.paths || '').split(' ');
    el.classList.toggle('hidden-for-path', Boolean(State.path) && !paths.includes(State.path));
  });
}

// ---------------------------------------------------------------- road signs
function viewSigns(catId) {
  hideRail();
  const cats = C().cats;
  const cat = catId ? cats.find((c) => c.id.toLowerCase() === catId.toLowerCase()) : null;
  const tabs = `<nav class="cat-tabs" aria-label="Sign categories"><a href="#signs" ${!cat ? 'aria-current="page"' : ''}>Overview</a>${cats.map((c) => `<a href="#signs.${c.id}" ${cat && cat.id === c.id ? 'aria-current="page"' : ''}>${esc(c.id)} <span class="n">${esc(c.en)}</span></a>`).join('')}</nav>`;
  if (!cat) {
    $('#main').innerHTML = `<div class="page-head"><h1>Road signs, markings and signals</h1>
      <p class="lede">All ${SIGNS().length} entries in Transportstyrelsen's official catalogue, grouped the way the Road Signs Ordinance (Vägmärkesförordningen) groups them. Tap a sign for its meaning in English, the official Swedish text and the lessons that use it.</p></div>
      ${tabs}
      <div class="quick">${cats.map((c) => {
        const first = SIGNS().filter((s) => s.cat === c.id).slice(0, 4);
        return `<a href="#signs.${c.id}"><strong>${esc(c.id)} · ${esc(c.en)}</strong><span lang="sv"><i>${esc(c.sv)}</i></span><span class="chips" style="margin-top:.4rem">${first.map((s) => signImgTag(s.img, s.en, 'inline')).join('')}</span><span>${plural(c.count, 'entry', 'entries')}</span></a>`;
      }).join('')}</div>
      <p class="small muted section">Images: Transportstyrelsen, free to use (see <a href="#credits">credits</a>). The codes A1, B2 … are the official codes from the Road Signs Ordinance. "SIG" numbers are Transportstyrelsen's catalogue numbers for traffic signals, which have no legal code.</p>`;
    return 'Road signs';
  }
  const list = SIGNS().filter((s) => s.cat === cat.id);
  $('#main').innerHTML = `<div class="page-head"><p class="crumbs"><a href="#signs">Road signs</a></p><h1>${esc(cat.id)} · ${esc(cat.en)}</h1>
    <p class="lede"><span lang="sv"><i>${esc(cat.sv)}</i></span> · ${plural(list.length, 'entry', 'entries')} · ${citeHtml('vmf', cat.vmf)}</p></div>
    ${tabs}
    <div class="filter-row"><label class="visually-hidden" for="sign-filter">Filter this category</label><input class="field" id="sign-filter" type="search" placeholder="Filter by code, English or Swedish name"><a class="btn ghost small" href="#quiz.signs.${cat.id}">Drill these signs</a></div>
    <div class="sign-grid" id="sign-grid">${list.map((s) => signCard(s, { sv: true })).join('')}</div>
    <p class="empty" id="sign-empty" hidden>No sign in this category matches.</p>`;
  const input = $('#sign-filter');
  input.addEventListener('input', () => {
    const q = processTerm(input.value) || '';
    let shown = 0;
    $$('#sign-grid .sign-card').forEach((card, i) => {
      const s = list[i];
      const hay = [s.id, s.en, s.sv, ...s.variants.map((v) => v.key + ' ' + v.en), ...(s.kw || [])].join(' ').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      const ok = !q || hay.includes(q);
      card.hidden = !ok;
      if (ok) shown += 1;
    });
    $('#sign-empty').hidden = shown > 0;
  });
  return `${cat.en} (${cat.id})`;
}

function viewSign(id) {
  hideRail();
  const s = signMap.get(id) || SIGNS().find((x) => x.id.toLowerCase() === String(id).toLowerCase());
  if (!s) return viewNotFound();
  const cat = C().cats.find((c) => c.id === s.cat);
  const inLessons = C().lessons.filter((l) => l.signs.includes(s.id));
  const qs = (window.DL_QUESTIONS || []).filter((q) => q.signs.includes(s.id) && !q.gen);
  const related = (s.related || []).map((r) => signMap.get(r)).filter(Boolean);
  const siblings = SIGNS().filter((x) => x.cat === s.cat);
  const idx = siblings.indexOf(s);
  const prev = siblings[idx - 1];
  const next = siblings[idx + 1];
  $('#main').innerHTML = `<p class="crumbs" style="margin-bottom:1rem"><a href="#signs">Road signs</a><span aria-hidden="true">›</span><a href="#signs.${s.cat}">${esc(cat.id)} · ${esc(cat.en)}</a></p>
  <div class="sign-detail">
    <div class="sign-hero">${signImgTag(s.img, `${s.id} ${s.en}`, '')}</div>
    <div class="sign-body">
      <p class="eyebrow">${esc(s.id)} · ${esc(cat.en)}</p>
      <h1>${esc(s.en || s.sv)}</h1>
      <p class="sv-name">Official Swedish name: <i lang="sv">${esc(s.sv)}</i></p>
      ${s.enText ? `<div class="panel"><h2>What it means</h2><p>${s.enText}</p>${s.tip ? `<p>${s.tip}</p>` : ''}</div>` : ''}
      ${s.svText ? `<div class="panel"><h2>Official text</h2><blockquote lang="sv">${esc(s.svText)}</blockquote><p class="small muted">From Transportstyrelsen's catalogue, which quotes the Road Signs Ordinance ${citeHtml('vmf', cat.vmf)}. The English text above is this site's translation.</p></div>` : ''}
      ${s.variants.length ? `<div><h2 style="font-size:1.3rem;margin-bottom:.6rem">Other versions of this sign</h2><div class="sign-grid">${s.variants.map((v) => `<div class="sign-card">${signImgTag(v.key, `${v.key} ${v.en || s.en}`)}<span class="sign-code">${esc(v.key)}</span><span class="sign-name">${esc(v.en || 'Variant')}</span></div>`).join('')}</div></div>` : ''}
      ${related.length ? `<div><h2 style="font-size:1.3rem;margin-bottom:.6rem">Related signs</h2><div class="sign-grid">${related.map((r) => signCard(r)).join('')}</div></div>` : ''}
      ${inLessons.length ? `<div class="panel"><h2>Explained in</h2><ul>${inLessons.map((l) => `<li><a href="#lesson.${l.id}">${esc(l.title)}</a></li>`).join('')}</ul></div>` : ''}
      ${qs.length ? `<p><a class="btn ghost small" href="#quiz.sign.${s.id}">Practise questions about this sign (${qs.length})</a></p>` : ''}
      <p class="small muted">Source: <a href="${esc(s.url)}" target="_blank" rel="noopener">Transportstyrelsen – ${esc(s.id)} ${esc(s.sv)}</a></p>
      <nav class="lesson-nav" aria-label="Neighbouring signs">${prev ? `<a href="#sign.${prev.id}"><span class="dir">Previous</span><span>${esc(prev.id)} ${esc(prev.en)}</span></a>` : '<span></span>'}${next ? `<a href="#sign.${next.id}" style="text-align:right"><span class="dir">Next</span><span>${esc(next.id)} ${esc(next.en)}</span></a>` : ''}</nav>
    </div>
  </div>`;
  return `${s.id} ${s.en}`;
}

// ---------------------------------------------------------------- dictionary
const SV_ORDER = 'abcdefghijklmnopqrstuvwxyzåäö';
function svKey(w) {
  return w.toLowerCase().split('').map((ch) => {
    const i = SV_ORDER.indexOf(ch);
    return i >= 0 ? String.fromCharCode(97 + i) : ch;
  }).join('');
}

function viewDictionary(arg) {
  hideRail();
  const sortSv = arg === 'sv' || (arg || '').startsWith('sv-');
  const letter = (arg || '').replace(/^sv-?/, '').toLowerCase();
  const all = C().glossary.slice().sort((a, b) => (sortSv ? svKey(a.sv).localeCompare(svKey(b.sv)) : a.en.localeCompare(b.en, 'en')));
  const headword = (t) => (sortSv ? t.sv : t.en).toLowerCase();
  const letters = Array.from(new Set(all.map((t) => headword(t)[0]))).sort((a, b) => (sortSv ? SV_ORDER.indexOf(a) - SV_ORDER.indexOf(b) : a.localeCompare(b)));
  const list = letter ? all.filter((t) => headword(t)[0] === letter) : all;
  const base = sortSv ? 'dictionary.sv' : 'dictionary';
  $('#main').innerHTML = `<div class="page-head"><h1>Dictionary</h1>
    <p class="lede">Swedish traffic and licence words explained in simple English. Words underlined with dots in the lessons open these explanations.</p></div>
    <div class="filter-row"><label class="visually-hidden" for="dict-filter">Filter the dictionary</label><input class="field" id="dict-filter" type="search" placeholder="Filter in English or Swedish">
      <span class="btn-row"><a class="btn small ${sortSv ? 'ghost' : ''}" href="#dictionary">Sort A–Z by English</a><a class="btn small ${sortSv ? '' : 'ghost'}" href="#dictionary.sv">Sort A–Ö by Swedish</a></span></div>
    <nav class="letters" aria-label="Jump to letter"><a href="#${base}" ${!letter ? 'aria-current="page"' : ''}>All</a>${letters.map((L) => `<a href="#${sortSv ? 'dictionary.sv-' : 'dictionary.'}${encodeURIComponent(L)}" ${letter === L ? 'aria-current="page"' : ''}>${esc(L.toUpperCase())}</a>`).join('')}</nav>
    <div class="terms" id="terms">${list.map((t) => termCard(t, sortSv)).join('')}</div>
    <p class="empty" id="terms-empty" hidden>No word matches. Try the search box at the top, which also searches lessons and signs.</p>`;
  const input = $('#dict-filter');
  input.addEventListener('input', () => {
    const q = processTerm(input.value) || '';
    let shown = 0;
    $$('#terms .term-card').forEach((card, i) => {
      const t = list[i];
      const hay = [t.en, t.sv, ...t.also].join(' ').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      const ok = !q || hay.includes(q);
      card.hidden = !ok;
      if (ok) shown += 1;
    });
    $('#terms-empty').hidden = shown > 0;
  });
  return 'Dictionary';
}

function termThumb(t) {
  const m = /data-sign="([^"]+)"/.exec(t.imageHtml || '');
  if (m) return `<span class="thumb">${signImgTag(m[1], '')}</span>`;
  const p = /src="(assets\/photos\/[^"]+)"/.exec(t.imageHtml || '');
  if (p) return `<span class="thumb"><img src="${p[1]}" alt="" loading="lazy" style="border-radius:6px;object-fit:cover"></span>`;
  return '';
}

function termCard(t, sortSv) {
  const head = sortSv ? `<span class="en" lang="sv">${esc(t.sv)}</span><span class="sv" lang="en">${esc(t.en)}</span>` : `<span class="en">${esc(t.en)}</span><span class="sv" lang="sv">${esc(t.sv)}</span>`;
  return `<a class="term-card" href="#term.${esc(t.id)}"><span>${head}</span>${termThumb(t)}<span class="def">${t.def}</span></a>`;
}

function viewTerm(id) {
  hideRail();
  const t = termMap.get(id);
  if (!t) return viewNotFound();
  const related = t.related.map((r) => termMap.get(r)).filter(Boolean);
  const lessons = t.lessons.map((l) => lessonMap.get(l)).filter(Boolean);
  const usedIn = C().lessons.filter((l) => l.terms.includes(t.id) && !t.lessons.includes(l.id));
  $('#main').innerHTML = `<article class="term-detail">
    <p class="crumbs" style="margin-bottom:1rem"><a href="#dictionary">Dictionary</a></p>
    <p class="eyebrow">Swedish: <span lang="sv">${esc(t.sv)}</span></p>
    <h1>${esc(t.en)}</h1>
    ${t.also.length ? `<p class="muted">Also called: ${t.also.map(esc).join(', ')}</p>` : ''}
    <div class="prose" style="margin-top:1rem">
      <p style="font-size:var(--step-1)">${t.def}</p>
      ${t.imageHtml || ''}
      ${t.more || ''}
      ${t.lawHtml ? `<p class="small">Law: ${t.lawHtml}</p>` : ''}
    </div>
    ${related.length ? `<section class="section"><h2 style="font-size:1.4rem;margin-bottom:.6rem">Related words</h2><div class="terms">${related.map((r) => termCard(r)).join('')}</div></section>` : ''}
    ${lessons.length || usedIn.length ? `<section class="section"><h2 style="font-size:1.4rem;margin-bottom:.6rem">Lessons</h2><ul>${[...lessons, ...usedIn].map((l) => `<li><a href="#lesson.${l.id}">${esc(l.title)}</a></li>`).join('')}</ul></section>` : ''}
  </article>`;
  return `${t.en} (${t.sv})`;
}

// ---------------------------------------------------------------- practice hub
function viewPractice() {
  hideRail();
  const path = State.path;
  const p = pathById(path);
  const pool = questionsFor(path);
  const mistakes = pool.filter((q) => (State.qstats[q.id] || {}).last === -1).length;
  const unseen = pool.filter((q) => !State.qstats[q.id]).length;
  const areas = C().areas;
  const recent = State.exams.slice(0, 5);
  $('#main').innerHTML = `<div class="page-head"><h1>Practice and exam</h1>
    <p class="lede">${p ? `Questions for <strong>${esc(p.title)}</strong>.` : 'Choose your licence at the top to get the right questions. Until then you see questions for all licences.'} Every answer comes with an explanation and its source.</p></div>
    <div class="quiz-hub">
      <section class="mode featured"><p class="eyebrow">Exam simulator</p><h3>Full theory exam</h3>
        <p>${esc(C().facts.theory.questions.value)} questions, ${esc(C().facts.theory.minutes.value)} minutes, pass mark ${esc(C().facts.theory.passMark.value)}/${esc(C().facts.theory.scored.value)} – the same format as Trafikverket's test.</p>
        <div class="btn-row">${p ? `<a class="btn" href="#exam.${p.id}">${Exam.live && Exam.live.path === p.id && !Exam.live.submitted ? 'Resume exam' : 'Start exam'}</a>` : C().paths.map((x) => `<a class="btn small" href="#exam.${x.id}" data-pick="${x.id}">${esc(x.short || x.title)}</a>`).join('')}</div></section>
      <section class="mode"><p class="eyebrow">Warm-up</p><h3>Quick 10</h3><p>Ten random questions with instant feedback.</p><div class="btn-row"><a class="btn" href="#quiz.quick">Start</a></div></section>
      <section class="mode"><p class="eyebrow">Signs</p><h3>Sign drill</h3><p>See a sign, choose what it means. Twenty signs per round.</p><div class="btn-row"><a class="btn" href="#quiz.signs">All signs</a><a class="btn ghost small" href="#quiz.signs.A">Warning</a><a class="btn ghost small" href="#quiz.signs.C">Prohibitory</a><a class="btn ghost small" href="#quiz.signs.M">Markings</a></div></section>
      <section class="mode"><p class="eyebrow">Repeat</p><h3>Your mistakes</h3><p>${mistakes ? `${plural(mistakes, 'question')} you last answered wrong.` : 'Questions you answer wrong collect here.'}</p><div class="btn-row"><a class="btn ${mistakes ? '' : 'ghost'}" href="#quiz.mistakes">Practise mistakes</a></div></section>
      <section class="mode"><p class="eyebrow">Something new</p><h3>Unseen questions</h3><p>${plural(unseen, 'question')} you have not answered yet.</p><div class="btn-row"><a class="btn ghost" href="#quiz.new">Start</a></div></section>
    </div>
    <section class="section"><h2>By test area</h2><p class="muted" style="margin:-.5rem 0 1rem">The five areas of Trafikverket's theory test ${citeHtml('tv-theory-b')}.</p>
      <div class="quick">${AREA_ORDER.map((a) => `<a href="#quiz.area.${a}"><strong>${esc(areas[a])}</strong><span>${plural(pool.filter((q) => q.area === a).length, 'question')}</span></a>`).join('')}</div></section>
    ${p ? `<section class="section"><h2>By part of the course</h2><div class="quick">${p.modules.map((m) => {
      const ids = new Set(m.lessons);
      const n = pool.filter((q) => ids.has(q.lesson)).length;
      return n ? `<a href="#quiz.module.${m.id}"><strong>${esc(m.title)}</strong><span>${plural(n, 'question')}</span></a>` : '';
    }).join('')}</div></section>` : ''}
    <section class="section"><h2>Your recent exams</h2>${recent.length ? `<div class="review">${recent.map((e) => `<div class="panel"><p><strong>${e.right}/${e.total}</strong> ${e.pass ? '<span class="chip green">Pass</span>' : '<span class="chip red">Fail</span>'} <span class="muted">${esc(C().pathLabels[e.path] || e.path)} · ${fmtDate(e.date)} · ${Math.round(e.secs / 60)} min</span></p></div>`).join('')}</div>` : '<p class="muted">No exams yet. Results are saved in this browser only.</p>'}</section>`;
  $$('[data-pick]', $('#main')).forEach((a) => a.addEventListener('click', () => App.setPath(a.dataset.pick, { silent: true })));
  return 'Practice and exam';
}

function viewQuiz(mode, arg) {
  hideRail();
  if (mode === 'sign') {
    const qs = (window.DL_QUESTIONS || []).filter((q) => q.signs.includes(arg) && !q.gen);
    Practice.session = { title: `Questions about ${arg}`, ids: shuffle(qs.map((q) => q.id)), i: 0, right: 0, answered: 0, wrong: [], mode, arg };
  }
  return viewPracticeRun(mode, arg);
}

// ---------------------------------------------------------------- search page
function viewSearch() {
  hideRail();
  const q = Search.lastQuery || '';
  $('#main').innerHTML = `<div class="page-head"><h1>Search</h1><p class="lede">Search all signs, lessons and dictionary words. Type a sign code (C31), an English word (roundabout) or a Swedish word (väjningsplikt).</p></div>
    <div class="filter-row"><label class="visually-hidden" for="q2">Search</label><input class="field" id="q2" type="search" value="${esc(q)}" placeholder="Search…" style="max-width:32rem">
    <span class="btn-row" id="type-filter" role="group" aria-label="Show"><button class="btn small" data-t="">All</button><button class="btn small ghost" data-t="sign">Signs</button><button class="btn small ghost" data-t="lesson">Lessons</button><button class="btn small ghost" data-t="term">Dictionary</button></span></div>
    <p class="muted small" id="search-count"></p>
    <div id="search-results" class="review"></div>`;
  let type = '';
  const input = $('#q2');
  const draw = () => {
    const query = input.value.trim();
    Search.lastQuery = query;
    const res = query ? runSearch(query, 200).filter((r) => !type || r.type === type) : [];
    $('#search-count').textContent = query ? `${plural(res.length, 'result')} for “${query}”` : 'Type to search.';
    $('#search-results').innerHTML = res.map((r, i) => resultItem(r, i)).join('');
    hydrateSigns($('#search-results'));
  };
  input.addEventListener('input', debounce(draw, 120));
  $('#type-filter').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    type = b.dataset.t;
    $$('#type-filter button').forEach((x) => x.classList.toggle('ghost', x !== b));
    draw();
  });
  draw();
  setTimeout(() => input.focus(), 0);
  return 'Search';
}

// ---------------------------------------------------------------- sources, credits, about, progress
function viewSources(focusId) {
  hideRail();
  const groups = [
    ['law', 'Swedish laws and ordinances', 'The legal texts. Lessons quote them in Swedish and translate them.'],
    ['regulation', 'Regulations from Transportstyrelsen (TSFS)', 'Detailed rules issued by the Swedish Transport Agency.'],
    ['official-web', 'Official web pages', 'Swedish authorities: Transportstyrelsen (licences, rules), Trafikverket (the tests, road safety), the Police, 1177 and others.'],
    ['brochure', 'Official guides and brochures', 'Short guides from Swedish authorities and municipalities. Many of Transportstyrelsen\'s guides have an official English version.'],
  ];
  $('#main').innerHTML = `<div class="page-head"><h1>Sources</h1>
    <p class="lede">Everything on this site is based on these sources. Each lesson lists the ones it uses, and each rule box links to the exact paragraph.</p></div>
    <div class="panel" style="max-width:60rem"><h2>How the content is checked</h2>
      <ul>
        <li>Facts come from the Swedish law texts, Transportstyrelsen's regulations and the official pages of Transportstyrelsen and Trafikverket, read on ${esc(C().facts.checkedOn)}.</li>
        <li>Important rules are shown with the original Swedish wording next to the English translation, so you can check the translation.</li>
        <li>Numbers that change (prices, ages, test format) are kept in one place and linked to their source.</li>
        <li>Rules change. The site cannot promise to stay current after its check date, so confirm anything important on the official sites before your test.</li>
      </ul></div>
    ${groups.map(([kind, title, intro]) => `<section class="section"><h2>${esc(title)}</h2><p class="muted" style="margin:-.5rem 0 1rem">${esc(intro)}</p><div class="src-list">${C().sources.filter((s) => s.kind === kind).map((s) => `<article class="src" id="src-${esc(s.id)}">
        <h3><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a></h3>
        ${s.titleEn && s.titleEn !== s.title ? `<p>${esc(s.titleEn)}</p>` : ''}
        <p>${esc(s.publisher)}${s.consolidated ? ` · ${esc(s.consolidated)}` : ''} · read ${esc(s.accessed)}</p>
        ${s.note ? `<p>${esc(s.note)}</p>` : ''}
        ${s.alt ? `<p class="small"><a href="${esc(s.alt)}" target="_blank" rel="noopener">${esc(s.altLabel || "Same text in Regeringskansliet's legal database")}</a></p>` : ''}
        ${s.en ? `<p class="small"><a href="${esc(s.en)}" target="_blank" rel="noopener">Official English version</a>${s.enNote ? ` (${esc(s.enNote)})` : ''}</p>` : ''}
        ${s.usedBy && s.usedBy.length ? `<p class="small">Used in: ${s.usedBy.map((id) => lessonMap.get(id)).filter(Boolean).map((l) => `<a href="#lesson.${l.id}">${esc(l.title)}</a>`).join(', ')}</p>` : ''}
      </article>`).join('')}</div></section>`).join('')}`;
  if (focusId) App.pendingAnchor = `src-${focusId}`;
  return 'Sources';
}

function viewCredits() {
  hideRail();
  const photos = C().photos;
  $('#main').innerHTML = `<div class="page-head"><h1>Image credits</h1><p class="lede">Where every picture on this site comes from.</p></div>
    <section class="panel" style="max-width:60rem"><h2>Road signs, markings and signals</h2>
      <p>All ${SIGNS().length} sign entries use the official image files from <a href="https://www.transportstyrelsen.se/sv/vagtrafik/vagmarken/" target="_blank" rel="noopener">Transportstyrelsen's road sign catalogue</a>, converted to WebP. Transportstyrelsen states: <i lang="sv">“Du kan ladda ner filer av vägmärken och använda fritt för olika ändamål utan Transportstyrelsens godkännande.”</i> (You can download road sign files and use them freely for different purposes without the Transport Agency's approval.) ${citeHtml('ts-press')}</p></section>
    <section class="panel" style="max-width:60rem;margin-top:1rem"><h2>Illustrations</h2><p>Diagrams marked “Illustration made for this site” were drawn for this site to show situations that a photo cannot show clearly.</p></section>
    <section class="section"><h2>Photos</h2>${photos.length ? `<div class="credits-list">${photos.map((p) => `<figure class="credit-card"><img src="assets/photos/${esc(p.id)}.webp" alt="${esc(p.alt)}" loading="lazy"><div><p><strong>${esc(p.title || p.alt)}</strong></p><p>${esc(p.author)} · ${p.licenseUrl ? `<a href="${esc(p.licenseUrl)}" target="_blank" rel="noopener">${esc(p.license)}</a>` : esc(p.license)}</p><p><a href="${esc(p.page)}" target="_blank" rel="noopener">Original on ${esc(p.via)}</a></p></div></figure>`).join('')}</div>` : '<p class="muted">No photos yet.</p>'}</section>
    <section class="section"><h2>Software and fonts</h2><ul><li>Fonts: Atkinson Hyperlegible (Braille Institute) and Barlow Semi Condensed (Jeremy Tribby), both under the SIL Open Font License, served by Google Fonts.</li><li>Search: MiniSearch by Luca Ongaro, MIT License.</li></ul></section>`;
  return 'Image credits';
}

function viewAbout() {
  hideRail();
  $('#main').innerHTML = `<div class="page-head"><h1>About this site</h1><p class="lede">An English study guide for the Swedish driving licence theory test, for car (manual or automatic) and motorcycle category A.</p></div>
  <div class="prose lesson">
    <h2>How the lessons are organised</h2>
    <p>Transportstyrelsen's course plans for the car licence (TSFS 2011:20) and the motorcycle licence (TSFS 2011:19) list what you must learn. Trafikverket's theory test checks five areas: vehicle knowledge and handling, environment, traffic safety, traffic rules, and personal factors. Each path on this site covers all five.</p>
    <p>Rules and signs are the same for everyone, so those lessons are shared. Boxes marked <strong>“Only for …”</strong> hold details that apply to one licence. When you choose a licence at the top, the boxes for the other licences are hidden.</p>
    <h2>Accuracy</h2>
    <p>Every rule is taken from the current Swedish law text or from Transportstyrelsen and Trafikverket, and each lesson lists its sources. Swedish legal wording is translated as literally as plain English allows, and the original is shown next to it. Content was checked on ${esc(C().facts.checkedOn)}.</p>
    <p>This is not an official site. If anything here differs from Transportstyrelsen, Trafikverket or the law, the official source is right. The practice questions are written for this site; Trafikverket does not publish its test questions.</p>
    <h2>Your data</h2>
    <p>Your chosen licence, finished lessons, answers and exam results are saved only in this browser (local storage). Nothing is sent anywhere. You can clear it on the <a href="#progress">progress page</a>.</p>
  </div>`;
  return 'About';
}

function viewProgress() {
  hideRail();
  const stats = Object.values(State.qstats);
  const seen = stats.length;
  const right = stats.filter((s) => s.last === 1).length;
  $('#main').innerHTML = `<div class="page-head"><h1>Your progress</h1><p class="lede">Saved in this browser only.</p></div>
    <div class="quick">${C().paths.map((p) => {
      const all = lessonsInPath(p);
      const done = all.filter((id) => State.done.has(id)).length;
      return `<a href="#learn.${p.id}"><strong>${esc(p.title)}</strong><span>${done} of ${all.length} lessons done</span><span class="progressbar"><span style="width:${all.length ? Math.round((done / all.length) * 100) : 0}%"></span></span></a>`;
    }).join('')}</div>
    <section class="section"><h2>Questions</h2><p>${seen ? `You have answered ${plural(seen, 'question')}. Your latest answer was right for ${right} of them (${Math.round((right / seen) * 100)}%).` : 'You have not answered any questions yet.'}</p></section>
    <section class="section"><h2>Exams</h2>${State.exams.length ? `<ul>${State.exams.map((e) => `<li>${fmtDate(e.date)} · ${esc(C().pathLabels[e.path] || e.path)} · <strong>${e.right}/${e.total}</strong> ${e.pass ? '(pass)' : '(fail)'}</li>`).join('')}</ul>` : '<p class="muted">No exams yet.</p>'}</section>
    <section class="section"><h2>Start over</h2><p class="muted">Removes finished lessons, answer history and exam results from this browser.</p><p class="btn-row" style="margin-top:.6rem"><button class="btn ghost" id="reset">Clear my progress</button></p><p id="reset-confirm" hidden class="btn-row" style="margin-top:.6rem"><span>Clear everything?</span><button class="btn small" id="reset-yes">Yes, clear</button><button class="btn small ghost" id="reset-no">Cancel</button></p></section>`;
  $('#reset').addEventListener('click', () => { $('#reset-confirm').hidden = false; });
  $('#reset-no').addEventListener('click', () => { $('#reset-confirm').hidden = true; });
  $('#reset-yes').addEventListener('click', () => { State.resetAll(); Exam.clear(); App.render(); });
  return 'Your progress';
}

function viewNotFound() {
  hideRail();
  $('#main').innerHTML = `<div class="page-head"><h1>Page not found</h1><p class="lede">That link does not lead anywhere on this site. Try the search box or go to the <a href="#home">start page</a>.</p></div>`;
  return 'Not found';
}
