// Site search: signs (by code, English or Swedish name), lesson sections and dictionary words.
let searchIndex = null;
const TYPE_LABEL = { sign: 'Road sign', lesson: 'Lesson', term: 'Dictionary' };

function getSearchIndex() {
  if (!searchIndex) {
    searchIndex = window.MiniSearch.loadJS(window.DL_SEARCH.index, { ...SEARCH_OPTIONS, processTerm });
  }
  return searchIndex;
}

function runSearch(query, limit = 60) {
  const q = query.trim();
  if (!q) return [];
  const idx = getSearchIndex();
  let res = idx.search(q);
  if (!res.length) res = idx.search(q, { combineWith: 'OR' });
  const docs = window.DL_SEARCH.docs;
  const out = res.map((r) => ({ id: r.id, score: r.score, ...docs[r.id] }));
  // A query that is exactly a dictionary word, in Swedish or English, puts that word first.
  const fold = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  const fq = fold(q);
  const word = out.findIndex((r) => r.type === 'term' && [r.sv, r.title].some((v) => fold(v).split(/\s*\/\s*/).includes(fq)));
  if (word > 0) out.unshift(out.splice(word, 1)[0]);
  // A query that is exactly a sign code (e.g. "c31", "B 1") puts that sign first.
  const code = q.replace(/\s+/g, '').toUpperCase();
  const exact = out.findIndex((r) => r.type === 'sign' && r.id.toUpperCase() === `S:${code}`);
  if (exact > 0) out.unshift(out.splice(exact, 1)[0]);
  return out.slice(0, limit);
}

function resultIcon(r) {
  if (r.type === 'sign') return `<span class="sr-icon">${signImgTag(r.img, r.title)}</span>`;
  const letter = r.type === 'term' ? 'Aa' : '§';
  return `<span class="sr-icon" aria-hidden="true">${letter}</span>`;
}

function resultItem(r, i) {
  const meta = r.type === 'sign'
    ? `<span lang="sv">${esc(r.sv)}</span>`
    : r.type === 'term'
      ? `<span lang="sv">${esc(r.sv)}</span> · ${esc(r.snippet)}`
      : esc(r.snippet);
  return `<a class="sr-item" role="option" id="sr-${i}" href="#${esc(r.route)}" aria-selected="false">${resultIcon(r)}<span><span class="sr-type">${TYPE_LABEL[r.type] || ''}</span><span class="sr-title">${esc(r.title)}</span><span class="sr-meta">${meta}</span></span></a>`;
}

const Search = {
  lastQuery: '',
  active: -1,

  init() {
    const input = $('#q');
    const pop = $('#search-pop');
    const update = debounce(() => this.showPop(input.value), 90);
    input.addEventListener('input', update);
    input.addEventListener('focus', () => { if (input.value.trim()) this.showPop(input.value); });
    input.addEventListener('keydown', (e) => {
      const items = $$('.sr-item', pop);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (pop.hidden || !items.length) return;
        e.preventDefault();
        this.active = (this.active + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items.forEach((el, i) => el.setAttribute('aria-selected', String(i === this.active)));
        input.setAttribute('aria-activedescendant', items[this.active].id);
        items[this.active].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (this.active >= 0 && items[this.active]) {
          location.hash = items[this.active].getAttribute('href');
        } else {
          this.openPage(input.value);
        }
        this.hidePop();
      } else if (e.key === 'Escape') {
        this.hidePop();
      }
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-box')) this.hidePop();
      else if (e.target.closest('.sr-item, .sr-all')) setTimeout(() => this.hidePop(), 0);
    });
  },

  showPop(value) {
    const pop = $('#search-pop');
    const input = $('#q');
    const q = value.trim();
    this.active = -1;
    input.removeAttribute('aria-activedescendant');
    if (!q) { this.hidePop(); return; }
    const results = runSearch(q, 8);
    pop.innerHTML = results.length
      ? results.map(resultItem).join('') + `<a class="sr-all" href="#search">See all results for “${esc(q)}”</a>`
      : `<p class="sr-empty">No matches for “${esc(q)}”. Try a sign code (like B1), an English word, or the Swedish word.</p>`;
    this.lastQuery = q;
    pop.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    hydrateSigns(pop);
  },

  hidePop() {
    const pop = $('#search-pop');
    pop.hidden = true;
    $('#q').setAttribute('aria-expanded', 'false');
  },

  openPage(q) {
    this.lastQuery = q.trim();
    if (location.hash === '#search') App.render();
    else location.hash = '#search';
  },
};
