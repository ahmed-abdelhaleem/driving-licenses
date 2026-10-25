// Router and app shell. Routes use only letters, digits, dots and hyphens
// (#lesson.speed, #sign.B1) so links also work when the page is embedded.
const App = {
  pendingAnchor: null,
  first: true,

  parse() {
    const raw = decodeURIComponent((location.hash || '').replace(/^#/, '')) || 'home';
    const [view, ...args] = raw.split('.');
    return { view, args };
  },

  setPath(p, opts = {}) {
    State.setPath(p);
    $('#pathsel').value = p || '';
    if (!opts.silent) this.render({ keepScroll: true });
  },

  render(opts = {}) {
    const { view, args } = this.parse();
    clearInterval(Exam.timer);
    let title;
    switch (view) {
      case 'home': title = viewHome(); break;
      case 'learn': title = viewLearn(args[0]); break;
      case 'lesson': title = viewLesson(args[0], args[1]); break;
      case 'signs': title = viewSigns(args[0]); break;
      case 'sign': title = viewSign(args.join('.')); break;
      case 'dictionary': title = viewDictionary(args.join('.')); break;
      case 'term': title = viewTerm(args[0]); break;
      case 'practice': title = viewPractice(); break;
      case 'quiz': title = viewQuiz(args[0], args[1]); break;
      case 'exam': title = viewExam(args[0] || State.path); break;
      case 'search': title = viewSearch(); break;
      case 'sources': title = viewSources(args[0]); break;
      case 'credits': title = viewCredits(); break;
      case 'about': title = viewAbout(); break;
      case 'progress': title = viewProgress(); break;
      default:
        // A bare token from a shared link may name a licence path.
        if (C().paths.some((p) => p.id === view)) { title = viewLearn(view); break; }
        title = viewNotFound();
    }
    document.title = title ? `${title} · Övningskör` : 'Övningskör';
    const navKey = { lesson: 'learn', sign: 'signs', term: 'dictionary', quiz: 'practice', exam: 'practice' }[view] || view;
    $$('#mainnav a').forEach((a) => (a.dataset.nav === navKey ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
    const main = $('#main');
    hydrateSigns(main);
    if (this.pendingAnchor) {
      const target = document.getElementById(this.pendingAnchor);
      this.pendingAnchor = null;
      if (target) { target.scrollIntoView(); return; }
    }
    if (!opts.keepScroll) window.scrollTo(0, 0);
    if (!this.first && !opts.keepScroll) main.focus({ preventScroll: true });
    this.first = false;
  },
};

// ---------------------------------------------------------------- dictionary pop-ups on dotted words
const TermPop = {
  timer: null,
  current: null,
  show(link) {
    const t = termMap.get(link.dataset.term);
    if (!t) return;
    const pop = $('#term-pop');
    pop.innerHTML = `<p class="tp-en">${esc(t.en)}</p><p class="tp-sv" lang="sv">${esc(t.sv)}</p><p>${t.def}</p><p><a href="#term.${esc(t.id)}">Open in the dictionary →</a></p>`;
    pop.hidden = false;
    const r = link.getBoundingClientRect();
    const w = pop.offsetWidth;
    const left = Math.min(Math.max(16, r.left), window.innerWidth - w - 16);
    let top = r.bottom + 8;
    if (top + pop.offsetHeight > window.innerHeight - 8) top = Math.max(8, r.top - pop.offsetHeight - 8);
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
    this.current = link;
  },
  hide() {
    $('#term-pop').hidden = true;
    this.current = null;
  },
};

function boot() {
  $('#pathsel').value = State.path || '';
  $('#pathsel').addEventListener('change', (e) => App.setPath(e.target.value));
  $('#checked-on').textContent = C().facts.checkedOn;
  Search.init();
  window.addEventListener('hashchange', () => { TermPop.hide(); App.render(); });

  // Dotted dictionary words: hover shows the definition; on touch screens the first tap shows it.
  const main = document.body;
  main.addEventListener('mouseover', (e) => {
    const link = e.target.closest('a.term');
    if (!link) return;
    clearTimeout(TermPop.timer);
    TermPop.timer = setTimeout(() => TermPop.show(link), 250);
  });
  main.addEventListener('mouseout', (e) => {
    if (e.target.closest('a.term') || e.target.closest('#term-pop')) {
      clearTimeout(TermPop.timer);
      TermPop.timer = setTimeout(() => {
        if (!$('#term-pop:hover')) TermPop.hide();
      }, 300);
    }
  });
  main.addEventListener('click', (e) => {
    const link = e.target.closest('a.term');
    if (link && window.matchMedia('(hover: none)').matches && TermPop.current !== link) {
      e.preventDefault();
      TermPop.show(link);
      return;
    }
    if (!e.target.closest('#term-pop') && !link) TermPop.hide();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') TermPop.hide(); });
  window.addEventListener('scroll', () => { if (TermPop.current) TermPop.hide(); }, { passive: true });

  App.render();
  prefetchSignBundles();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
