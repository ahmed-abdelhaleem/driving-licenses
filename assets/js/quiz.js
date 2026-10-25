// Question rendering, practice sessions and the theory-exam simulator.
const AREA_ORDER = ['rules', 'safety', 'vehicle', 'environment', 'personal'];
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

// Our exam mix. Trafikverket publishes the five areas but not how many questions
// each area gets, so this split is the site's own choice (65 scored questions).
const EXAM_MIX = { rules: 24, safety: 17, vehicle: 10, environment: 6, personal: 8 };
const MAX_SIGN_QUESTIONS_IN_EXAM = 10;
const EXAM_TRIAL = 5;
const EXAM_SECONDS = 50 * 60;
const EXAM_PASS = 52;

const QIndex = new Map((window.DL_QUESTIONS || []).map((q) => [q.id, q]));

function questionsFor(path) {
  return (window.DL_QUESTIONS || []).filter((q) => !path || q.paths.includes(path));
}

function optionOrder(q) {
  const idx = q.opts.map((_, i) => i);
  return q.fix ? idx : shuffle(idx);
}

function assembleExam(path) {
  const pool = questionsFor(path).filter((q) => !q.noExam);
  const used = new Set();
  const picked = [];
  const take = (list, n) => {
    for (const q of shuffle(list)) {
      if (n <= 0) break;
      if (used.has(q.id)) continue;
      used.add(q.id);
      picked.push(q);
      n -= 1;
    }
    return n; // how many we could not find
  };
  let shortfall = 0;
  for (const area of AREA_ORDER) {
    let n = EXAM_MIX[area];
    if (area === 'rules') {
      const signQs = pool.filter((q) => q.gen === 'sign');
      const nSigns = Math.min(MAX_SIGN_QUESTIONS_IN_EXAM, signQs.length);
      const left = take(pool.filter((q) => q.area === 'rules' && !q.gen), n - nSigns);
      n = take(signQs, nSigns + left);
    } else {
      n = take(pool.filter((q) => q.area === area), n);
    }
    shortfall += n;
  }
  take(pool, shortfall);
  const scored = picked.slice();
  picked.length = 0;
  take(pool, EXAM_TRIAL);
  const trial = picked.slice();
  return shuffle([
    ...scored.map((q) => ({ id: q.id, trial: false })),
    ...trial.map((q) => ({ id: q.id, trial: true })),
  ]).map((it) => ({ ...it, choice: null, flag: false, order: optionOrder(QIndex.get(it.id)) }));
}

function renderOptions(q, order, chosen, reveal) {
  return order.map((i, pos) => {
    let cls = 'opt';
    if (reveal) {
      if (i === q.a) cls += ' correct';
      else if (i === chosen) cls += ' wrong';
    }
    const pressed = chosen === i ? 'true' : 'false';
    return `<button type="button" class="${cls}" data-i="${i}" aria-pressed="${pressed}" ${reveal ? 'disabled' : ''}><span class="key" aria-hidden="true">${LETTERS[pos]}</span><span>${q.opts[i]}</span></button>`;
  }).join('');
}

function feedbackHtml(q, chosen) {
  const ok = chosen === q.a;
  const lesson = q.lesson ? (window.DL_CONTENT.lessons.find((l) => l.id === q.lesson)) : null;
  return `<div class="feedback ${ok ? 'ok' : 'no'}" role="status">
    <p class="verdict">${ok ? 'Correct' : 'Not quite'}</p>
    ${ok ? '' : `<p>The right answer is: <strong>${q.opts[q.a]}</strong></p>`}
    <p>${q.ex}</p>
    <p class="small">Source: ${q.src.join(' ')}${lesson ? ` · Learn more: <a href="#lesson.${esc(lesson.id)}">${esc(lesson.title)}</a>` : ''}</p>
  </div>`;
}

// A self-checking question card used in lessons and practice sessions.
function mountPracticeQuestion(container, q, opts = {}) {
  const order = optionOrder(q);
  const area = window.DL_CONTENT.areas[q.area] || '';
  container.innerHTML = `<article class="qcard" data-qid="${esc(q.id)}">
    <p class="eyebrow">${opts.label ? `${esc(opts.label)} · ` : ''}${esc(area)}</p>
    <div class="qtext">${q.q}</div>
    ${q.img || ''}
    <div class="options" role="group" aria-label="Answer options">${renderOptions(q, order, null, false)}</div>
    <div class="fb"></div>
    <div class="btn-row next-row" hidden></div>
  </article>`;
  hydrateSigns(container);
  const card = $('.qcard', container);
  const answer = (i) => {
    if (card.dataset.done) return;
    card.dataset.done = '1';
    const correct = i === q.a;
    State.recordAnswer(q.id, correct);
    $('.options', card).innerHTML = renderOptions(q, order, i, true);
    $('.fb', card).innerHTML = feedbackHtml(q, i);
    if (opts.onAnswer) opts.onAnswer(correct, card);
  };
  card.addEventListener('click', (e) => {
    const b = e.target.closest('.opt');
    if (b && !b.disabled) answer(Number(b.dataset.i));
  });
  card.addEventListener('keydown', (e) => {
    const k = e.key.toUpperCase();
    const pos = LETTERS.indexOf(k) >= 0 ? LETTERS.indexOf(k) : ['1', '2', '3', '4', '5', '6'].indexOf(e.key);
    if (pos >= 0 && pos < order.length && !e.target.matches('input, select, textarea')) answer(order[pos]);
  });
  return card;
}

// ---------------------------------------------------------------- practice sessions
const Practice = {
  session: null,

  pick(mode, arg, path) {
    const pool = questionsFor(path);
    let list = [];
    let title = 'Practice';
    if (mode === 'quick') { list = sample(pool, 10); title = 'Quick 10'; }
    else if (mode === 'area') { list = sample(pool.filter((q) => q.area === arg), 15); title = window.DL_CONTENT.areas[arg] || 'Practice'; }
    else if (mode === 'lesson') {
      list = sample(pool.filter((q) => q.lesson === arg), 20);
      const l = window.DL_CONTENT.lessons.find((x) => x.id === arg);
      title = l ? l.title : 'Lesson questions';
    } else if (mode === 'module') {
      const p = window.DL_CONTENT.paths.find((x) => x.id === path) || window.DL_CONTENT.paths[0];
      const mod = p.modules.find((m) => m.id === arg);
      const ids = new Set(mod ? mod.lessons : []);
      list = sample(pool.filter((q) => ids.has(q.lesson)), 20);
      title = mod ? mod.title : 'Module questions';
    } else if (mode === 'signs') {
      const signIds = arg ? new Set(window.DL_SIGNS.filter((s) => s.cat === arg).map((s) => s.id)) : null;
      list = sample(pool.filter((q) => q.gen === 'sign' && (!signIds || signIds.has(q.signs[0]))), 20);
      title = arg ? `Sign drill: ${(window.DL_CONTENT.cats.find((c) => c.id === arg) || {}).en || arg}` : 'Sign drill';
    } else if (mode === 'mistakes') {
      list = sample(pool.filter((q) => (State.qstats[q.id] || {}).last === -1), 20);
      title = 'Your mistakes';
    } else if (mode === 'new') {
      list = sample(pool.filter((q) => !State.qstats[q.id]), 15);
      title = 'Questions you have not seen';
    }
    return { title, ids: list.map((q) => q.id) };
  },

  start(mode, arg) {
    const { title, ids } = this.pick(mode, arg, State.path);
    this.session = { title, ids, i: 0, right: 0, answered: 0, wrong: [], mode, arg };
  },
};

function viewPracticeRun(mode, arg) {
  if (!Practice.session || Practice.session.mode !== mode || Practice.session.arg !== (arg || undefined)) {
    Practice.start(mode, arg || undefined);
  }
  const s = Practice.session;
  const main = $('#main');
  if (!s.ids.length) {
    main.innerHTML = `<div class="page-head"><p class="crumbs"><a href="#practice">Practice</a></p><h1>${esc(s.title)}</h1>
      <p class="lede">${mode === 'mistakes' ? 'No mistakes to repeat yet. Questions you answer wrong will collect here.' : 'There are no questions for this choice yet.'}</p></div>
      <p class="btn-row"><a class="btn" href="#practice">Back to practice</a></p>`;
    return `${s.title}`;
  }
  if (s.i >= s.ids.length) {
    const pct = Math.round((s.right / s.ids.length) * 100);
    main.innerHTML = `<div class="page-head"><p class="crumbs"><a href="#practice">Practice</a></p><h1>${esc(s.title)}: done</h1>
      <p class="lede">You answered <strong>${s.right} of ${s.ids.length}</strong> correctly (${pct}%).</p></div>
      ${s.wrong.length ? `<h2 class="section">Questions to look at again</h2><div class="review">${s.wrong.map((id) => reviewItem(QIndex.get(id), null)).join('')}</div>` : '<p>Every answer was right.</p>'}
      <p class="btn-row section"><button class="btn" id="again">Practise again</button><a class="btn ghost" href="#practice">Choose another practice</a></p>`;
    hydrateSigns(main);
    $('#again').addEventListener('click', () => { Practice.start(mode, arg || undefined); App.render(); });
    return `${s.title} results`;
  }
  const q = QIndex.get(s.ids[s.i]);
  main.innerHTML = `<div class="page-head"><p class="crumbs"><a href="#practice">Practice</a></p><h1>${esc(s.title)}</h1>
    <p class="muted tabular">Question ${s.i + 1} of ${s.ids.length} · ${s.right} correct so far</p></div><div id="qslot"></div>`;
  const card = mountPracticeQuestion($('#qslot'), q, {
    label: `Question ${s.i + 1}`,
    onAnswer(correct, cardEl) {
      s.answered += 1;
      if (correct) s.right += 1;
      else s.wrong.push(q.id);
      const row = $('.next-row', cardEl);
      row.hidden = false;
      row.innerHTML = `<button class="btn" id="nextq">${s.i + 1 < s.ids.length ? 'Next question' : 'See results'}</button>`;
      $('#nextq').focus();
      $('#nextq').addEventListener('click', () => { s.i += 1; App.render(); });
    },
  });
  $('.opt', card).focus({ preventScroll: true });
  return s.title;
}

function reviewItem(q, item) {
  if (!q) return '';
  const chosen = item ? item.choice : null;
  const status = item
    ? item.trial ? '<span class="chip">Trial question – not scored</span>'
      : chosen === q.a ? '<span class="chip green">Correct</span>'
        : chosen == null ? '<span class="chip red">Not answered</span>' : '<span class="chip red">Wrong</span>'
    : '<span class="chip red">Wrong</span>';
  const order = item ? item.order : q.opts.map((_, i) => i);
  return `<details ${item && !item.trial && chosen !== q.a ? 'open' : ''}><summary>${status}<span>${textOf(q.q).slice(0, 140)}</span></summary>
    <div class="qtext">${q.q}</div>${q.img || ''}
    <div class="options">${renderOptions(q, order, chosen, true)}</div>
    ${feedbackHtml(q, chosen == null ? -1 : chosen).replace('Not quite', chosen == null ? 'Not answered' : 'Not quite')}
  </details>`;
}

// ---------------------------------------------------------------- exam simulator
const Exam = {
  live: Store.get('exam-live', null),
  timer: null,

  start(path) {
    this.live = { path, started: Date.now(), items: assembleExam(path), i: 0, submitted: false };
    this.save();
  },
  save() { Store.set('exam-live', this.live); },
  clear() { this.live = null; Store.remove('exam-live'); clearInterval(this.timer); },
  remaining() { return this.live ? EXAM_SECONDS - (Date.now() - this.live.started) / 1000 : 0; },

  score() {
    const items = this.live.items;
    const scored = items.filter((it) => !it.trial);
    const right = scored.filter((it) => it.choice === QIndex.get(it.id).a).length;
    const byArea = {};
    for (const it of scored) {
      const q = QIndex.get(it.id);
      const a = byArea[q.area] || (byArea[q.area] = { n: 0, ok: 0 });
      a.n += 1;
      if (it.choice === q.a) a.ok += 1;
    }
    return { right, total: scored.length, pass: right >= EXAM_PASS, byArea };
  },

  submit() {
    if (!this.live || this.live.submitted) return;
    clearInterval(this.timer);
    const s = this.score();
    for (const it of this.live.items) {
      if (it.choice != null) State.recordAnswer(it.id, it.choice === QIndex.get(it.id).a);
    }
    this.live.submitted = true;
    this.live.finished = Date.now();
    this.live.result = s;
    this.save();
    State.recordExam({ path: this.live.path, date: this.live.finished, right: s.right, total: s.total, pass: s.pass, secs: Math.round((this.live.finished - this.live.started) / 1000) });
  },
};

function examIntro(path) {
  const p = window.DL_CONTENT.paths.find((x) => x.id === path);
  const pool = questionsFor(path);
  const F = window.DL_CONTENT.facts.theory;
  return `<div class="page-head"><p class="crumbs"><a href="#practice">Practice &amp; exam</a></p>
    <h1>Theory exam: ${esc(p ? p.title : path)}</h1>
    <p class="lede">Same format as Trafikverket's test: ${F.questions.value} questions, ${F.minutes.value} minutes, pass with ${F.passMark.value} of ${F.scored.value} points. ${F.questions.value - F.scored.value} questions are unscored trial questions, as in the real test.</p></div>
    <div class="panel" style="max-width:46rem">
      <h2>How it works</h2>
      <ul>
        <li>You can move between questions, change answers and flag questions to come back to.</li>
        <li>No feedback until you finish. Then you see your score, the areas where you made mistakes, and every question with its explanation and source.</li>
        <li>The real test does not show which questions you got wrong; this simulator does, so you can learn from them.</li>
        <li>Questions are drawn from this site's bank of ${pool.length} questions for this licence. The real test uses Trafikverket's own questions, which are not published.</li>
      </ul>
      <p class="small muted">The split between the five areas is this site's own choice. Trafikverket lists the areas but not how many questions each one gets.</p>
      <div class="btn-row"><button class="btn" id="start-exam">Start the exam</button><a class="btn ghost" href="#practice">Not yet</a></div>
    </div>`;
}

function viewExam(path) {
  const main = $('#main');
  const p = window.DL_CONTENT.paths.find((x) => x.id === path);
  if (!p) { main.innerHTML = '<p class="empty">Unknown licence path.</p>'; return 'Exam'; }
  const live = Exam.live;
  if (!live || live.path !== path) {
    main.innerHTML = examIntro(path);
    $('#start-exam').addEventListener('click', () => { Exam.start(path); App.render(); });
    return `Exam – ${p.title}`;
  }
  if (live.submitted) { renderExamResult(main, p); return `Exam result – ${p.title}`; }
  if (Exam.remaining() <= 0) { Exam.submit(); renderExamResult(main, p); return `Exam result – ${p.title}`; }
  renderExamQuestion(main, p);
  return `Exam – ${p.title}`;
}

function renderExamQuestion(main, p) {
  const live = Exam.live;
  const it = live.items[live.i];
  const q = QIndex.get(it.id);
  const answered = live.items.filter((x) => x.choice != null).length;
  main.innerHTML = `<div class="exam-bar" role="region" aria-label="Exam status">
      <span class="timer tabular" id="timer" aria-live="off">${fmtClock(Exam.remaining())}</span>
      <span class="tabular">Question <strong>${live.i + 1}</strong> of ${live.items.length}</span>
      <span class="tabular muted">${answered} answered</span>
      <span class="btn-row" style="margin-left:auto"><button class="btn ghost small" id="flag" aria-pressed="${it.flag}">${it.flag ? 'Flagged' : 'Flag'}</button><button class="btn small" id="finish">Finish exam</button></span>
    </div>
    <article class="qcard" data-qid="${esc(q.id)}">
      <div class="qtext">${q.q}</div>
      ${q.img || ''}
      <div class="options" role="group" aria-label="Answer options">${renderOptions(q, it.order, it.choice, false)}</div>
      <div class="btn-row"><button class="btn ghost" id="prev" ${live.i === 0 ? 'disabled' : ''}>Previous</button><button class="btn" id="next">${live.i + 1 < live.items.length ? 'Next' : 'Review answers'}</button></div>
    </article>
    <nav class="qnav" aria-label="All questions">${live.items.map((x, i) => `<button type="button" data-go="${i}" class="${x.choice != null ? 'answered' : ''} ${x.flag ? 'flagged' : ''}" aria-current="${i === live.i}" aria-label="Question ${i + 1}${x.choice != null ? ', answered' : ''}${x.flag ? ', flagged' : ''}">${i + 1}</button>`).join('')}</nav>`;
  hydrateSigns(main);
  const go = (i) => { live.i = Math.max(0, Math.min(live.items.length - 1, i)); Exam.save(); App.render({ keepScroll: false }); };
  $('.options', main).addEventListener('click', (e) => {
    const b = e.target.closest('.opt');
    if (!b) return;
    it.choice = Number(b.dataset.i);
    Exam.save();
    $$('.opt', main).forEach((o) => o.setAttribute('aria-pressed', String(Number(o.dataset.i) === it.choice)));
    const nav = $(`.qnav [data-go="${live.i}"]`, main);
    if (nav) nav.classList.add('answered');
  });
  $('#prev').addEventListener('click', () => go(live.i - 1));
  $('#next').addEventListener('click', () => (live.i + 1 < live.items.length ? go(live.i + 1) : confirmFinish()));
  $('#flag').addEventListener('click', () => { it.flag = !it.flag; Exam.save(); App.render(); });
  $('#finish').addEventListener('click', confirmFinish);
  $('.qnav', main).addEventListener('click', (e) => { const b = e.target.closest('[data-go]'); if (b) go(Number(b.dataset.go)); });
  clearInterval(Exam.timer);
  Exam.timer = setInterval(() => {
    const t = $('#timer');
    if (!t || !Exam.live || Exam.live.submitted) { clearInterval(Exam.timer); return; }
    const r = Exam.remaining();
    t.textContent = fmtClock(r);
    t.classList.toggle('low', r < 300);
    if (r <= 0) { Exam.submit(); App.render(); }
  }, 1000);

  function confirmFinish() {
    const unanswered = live.items.filter((x) => x.choice == null).length;
    const flagged = live.items.filter((x) => x.flag).length;
    const back = document.createElement('div');
    back.className = 'dialog-back';
    back.innerHTML = `<div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dlg-t">
      <h2 id="dlg-t">Finish the exam?</h2>
      <p>${unanswered ? `<strong>${plural(unanswered, 'question')} not answered.</strong> ` : 'All questions answered. '}${flagged ? `${plural(flagged, 'question')} flagged.` : ''}</p>
      <div class="btn-row"><button class="btn" id="dlg-yes">Finish and see result</button><button class="btn ghost" id="dlg-no">Keep going</button></div></div>`;
    document.body.appendChild(back);
    $('#dlg-yes', back).focus();
    const close = () => back.remove();
    $('#dlg-no', back).addEventListener('click', close);
    back.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    $('#dlg-yes', back).addEventListener('click', () => { close(); Exam.submit(); App.render(); });
  }
}

function renderExamResult(main, p) {
  const live = Exam.live;
  const s = live.result || Exam.score();
  const areas = window.DL_CONTENT.areas;
  const weak = AREA_ORDER.filter((a) => s.byArea[a] && s.byArea[a].ok < s.byArea[a].n);
  const mins = Math.round(((live.finished || Date.now()) - live.started) / 60000);
  main.innerHTML = `<div class="page-head"><p class="crumbs"><a href="#practice">Practice &amp; exam</a></p><h1>Your result</h1></div>
    <section class="result-banner ${s.pass ? 'pass' : 'fail'}" aria-live="polite">
      <p class="eyebrow">${esc(p.title)} · ${fmtDate(live.finished || Date.now())} · ${mins} min</p>
      <p class="big">${s.right} / ${s.total}</p>
      <p><strong>${s.pass ? 'Pass.' : 'Not a pass yet.'}</strong> You need ${EXAM_PASS} of ${s.total} points. ${s.pass ? 'Keep practising the areas below to make it a safe pass.' : `You were ${EXAM_PASS - s.right} point${EXAM_PASS - s.right === 1 ? '' : 's'} short.`}</p>
    </section>
    <section class="section"><h2>Result by area</h2>
      <div class="bars">${AREA_ORDER.filter((a) => s.byArea[a]).map((a) => {
        const v = s.byArea[a];
        const pct = Math.round((v.ok / v.n) * 100);
        return `<div class="bar-row"><span>${esc(areas[a])}</span><span class="bar" role="img" aria-label="${pct}%"><span style="width:${pct}%"></span></span><span class="pct">${v.ok}/${v.n}</span></div>`;
      }).join('')}</div>
      ${weak.length ? `<p class="section">Trafikverket's result shows the areas where you made mistakes. Here they are: <strong>${weak.map((a) => esc(areas[a])).join(', ')}</strong>.</p>
      <p class="btn-row" style="margin-top:.75rem">${weak.map((a) => `<a class="btn ghost small" href="#quiz.area.${a}">Practise ${esc(areas[a].toLowerCase())}</a>`).join('')}</p>` : ''}
    </section>
    <section class="section"><h2>All questions</h2>
      <p class="muted">Wrong and unanswered questions are open. The ${EXAM_TRIAL} trial questions did not count, just like in the real test.</p>
      <div class="review" style="margin-top:1rem">${live.items.map((it) => reviewItem(QIndex.get(it.id), it)).join('')}</div>
    </section>
    <p class="btn-row section"><button class="btn" id="new-exam">Take a new exam</button><a class="btn ghost" href="#practice">Back to practice</a></p>`;
  hydrateSigns(main);
  $('#new-exam').addEventListener('click', () => { Exam.clear(); Exam.start(p.id); App.render(); });
}
