// Shared by the build (Node) and the browser so the index and the queries
// treat words the same way. Swedish letters are folded (ä -> a, ö -> o, å -> a)
// so "vajningsplikt" finds "väjningsplikt".
export function processTerm(term) {
  const t = term
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9-]/g, '');
  if (!t) return null;
  if (t.length < 2 && !/^[0-9]$/.test(t)) return null;
  return t;
}

export const SEARCH_OPTIONS = {
  fields: ['title', 'code', 'sv', 'kw', 'text'],
  storeFields: [],
  tokenize: (text) => String(text).split(/[\s,.;:!?()"“”'’/]+/u),
  searchOptions: {
    boost: { code: 6, title: 3, sv: 2.5, kw: 2, text: 1 },
    prefix: true,
    fuzzy: (term) => (term.length > 4 ? 0.2 : false),
    combineWith: 'AND',
  },
};
