// Progress kept in this browser only (localStorage). Every access is guarded:
// in private windows or previews storage can be missing, and the site must still work.
const Store = {
  prefix: 'ovningskor:',
  get(key, fallback) {
    try {
      const raw = window.localStorage.getItem(this.prefix + key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(this.prefix + key, JSON.stringify(value));
    } catch (e) {
      /* storage unavailable: progress lives only for this visit */
    }
  },
  remove(key) {
    try {
      window.localStorage.removeItem(this.prefix + key);
    } catch (e) {
      /* ignore */
    }
  },
};

const State = {
  path: Store.get('path', ''),
  done: new Set(Store.get('done', [])),
  qstats: Store.get('qstats', {}),
  exams: Store.get('exams', []),

  setPath(p) {
    this.path = p;
    Store.set('path', p);
  },
  toggleDone(lessonId) {
    if (this.done.has(lessonId)) this.done.delete(lessonId);
    else this.done.add(lessonId);
    Store.set('done', Array.from(this.done));
  },
  recordAnswer(qid, correct) {
    const s = this.qstats[qid] || { r: 0, w: 0, last: 0 };
    if (correct) s.r += 1;
    else s.w += 1;
    s.last = correct ? 1 : -1;
    s.t = Date.now();
    this.qstats[qid] = s;
    Store.set('qstats', this.qstats);
  },
  recordExam(entry) {
    this.exams.unshift(entry);
    this.exams = this.exams.slice(0, 50);
    Store.set('exams', this.exams);
  },
  resetAll() {
    this.done = new Set();
    this.qstats = {};
    this.exams = [];
    ['done', 'qstats', 'exams', 'exam-live'].forEach((k) => Store.remove(k));
  },
};
