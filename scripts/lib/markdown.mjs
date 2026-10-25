// Markdown renderer with the site's shortcodes and callout containers.
//
// Inline shortcodes:   [[sign:A1-1]]  [[term:vajningsplikt|give way]]  [[src:tf|3:17]]
//                      [[fact:theory.passMark]]  [[lesson:speed|text]]
// Block shortcodes (alone on a line):
//                      [[signs:A1-1,A1-2]]  [[photo:id]]  [[fig:id]]
// Containers:          ::: law tf 3:17   ::: tip   ::: warning   ::: note   ::: key
//                      ::: example   ::: only car-manual motorcycle   ::: steps
import MarkdownIt from 'markdown-it';
import container from 'markdown-it-container';

const BLOCK_SHORTCODES = new Set(['signs', 'photo', 'fig']);
const PIPE = '';

export const PATH_LABELS = {
  'car-manual': 'Manual car',
  'car-automatic': 'Automatic car',
  motorcycle: 'Motorcycle',
};

export function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/&[a-z]+;/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'section';
}

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Build a markdown-it instance bound to a site context (`site`) that knows how to
// resolve signs, terms, sources, facts, photos, diagrams and lessons.
// Each render call gets an `env` object that collects what the text uses.
export function createMarkdown(site) {
  const md = new MarkdownIt({ html: true, typographer: true, linkify: false });

  // ---- inline [[type:arg]] shortcode ----
  // A table row is split on "|" before inline parsing, so the "|" inside a
  // shortcode is swapped for a private-use character first and restored below.
  md.core.ruler.after('normalize', 'shortcode_pipes', (state) => {
    state.src = state.src.replace(/\[\[([a-z]+):([^\]\n]*)\]\]/g, (_m, type, arg) => `[[${type}:${arg.replace(/\|/g, PIPE)}]]`);
  });
  md.inline.ruler.before('link', 'shortcode', (state, silent) => {
    const { src, pos } = state;
    if (src.charCodeAt(pos) !== 0x5b || src.charCodeAt(pos + 1) !== 0x5b) return false;
    const end = src.indexOf(']]', pos + 2);
    if (end < 0) return false;
    const inner = src.slice(pos + 2, end);
    const m = /^([a-z]+):([\s\S]+)$/.exec(inner);
    if (!m) return false;
    if (!silent) {
      const token = state.push('shortcode', '', 0);
      token.meta = { type: m[1], arg: m[2].replaceAll(PIPE, '|').trim() };
    }
    state.pos = end + 2;
    return true;
  });
  md.renderer.rules.shortcode = (tokens, idx, _opts, env) =>
    site.renderShortcode(tokens[idx].meta.type, tokens[idx].meta.arg, env);

  // A paragraph holding only a block shortcode loses its <p> wrapper.
  md.core.ruler.push('block_shortcodes', (state) => {
    const t = state.tokens;
    for (let i = 1; i < t.length - 1; i++) {
      if (t[i].type !== 'inline' || t[i - 1].type !== 'paragraph_open') continue;
      const kids = (t[i].children || []).filter((c) => !(c.type === 'text' && !c.content.trim()) && c.type !== 'softbreak');
      if (kids.length && kids.every((c) => c.type === 'shortcode' && BLOCK_SHORTCODES.has(c.meta.type))) {
        t[i - 1].hidden = true;
        t[i + 1].hidden = true;
      }
    }
  });

  // ---- heading ids (h2/h3) so search can link to sections ----
  md.core.ruler.push('heading_ids', (state) => {
    const used = state.env.headingIds || (state.env.headingIds = new Set());
    const t = state.tokens;
    for (let i = 0; i < t.length; i++) {
      if (t[i].type !== 'heading_open' || !['h2', 'h3'].includes(t[i].tag)) continue;
      const text = t[i + 1].children.map((c) => (c.type === 'text' || c.type === 'code_inline' ? c.content : '')).join('');
      let id = slugify(text);
      let n = 2;
      while (used.has(id)) id = `${slugify(text)}-${n++}`;
      used.add(id);
      t[i].attrSet('id', id);
      (state.env.headings || (state.env.headings = [])).push({ level: t[i].tag, id, text });
    }
  });

  // ---- callout containers ----
  const simple = {
    tip: 'Good to know',
    warning: 'Common mistake',
    note: 'Note',
    key: 'Remember',
    example: 'Example',
  };
  for (const [name, label] of Object.entries(simple)) {
    md.use(container, name, {
      render(tokens, idx) {
        if (tokens[idx].nesting === 1) {
          const custom = tokens[idx].info.trim().slice(name.length).trim();
          return `<aside class="callout callout-${name}"><p class="callout-label">${escapeHtml(custom || label)}</p>\n`;
        }
        return '</aside>\n';
      },
    });
  }

  md.use(container, 'law', {
    render(tokens, idx, _opts, env) {
      if (tokens[idx].nesting === 1) {
        const info = tokens[idx].info.trim().replace(/^law\s*/, '');
        const [srcId, loc, ...rest] = info.split(/\s+/);
        const cite = site.citation(srcId, loc, env);
        const note = rest.length ? ` <span class="law-note">${escapeHtml(rest.join(' '))}</span>` : '';
        return `<aside class="law"><p class="law-label"><span>The rule</span><span class="law-ref">${cite.html}${note}</span></p>\n`;
      }
      return '</aside>\n';
    },
  });

  md.use(container, 'only', {
    render(tokens, idx, _opts, env) {
      if (tokens[idx].nesting === 1) {
        const keys = tokens[idx].info.trim().replace(/^only\s*/, '').split(/\s+/).flatMap((k) =>
          k === 'car' ? ['car-manual', 'car-automatic'] : [k]);
        for (const k of keys) if (!PATH_LABELS[k]) site.problem(env, `unknown path "${k}" in ::: only`);
        const label = keys.map((k) => PATH_LABELS[k] || k).join(' · ');
        return `<div class="only" data-paths="${keys.join(' ')}"><p class="only-label">Only for: ${escapeHtml(label)}</p>\n`;
      }
      return '</div>\n';
    },
  });

  md.use(container, 'steps', {
    render(tokens, idx) {
      return tokens[idx].nesting === 1 ? '<div class="steps">\n' : '</div>\n';
    },
  });

  return md;
}

export function renderLessonMarkdown(md, text, env) {
  let html = md.render(text, env);
  // The quoted Swedish text inside a rule box is marked as Swedish for screen readers.
  html = html.replace(/(<aside class="law">[\s\S]*?)<blockquote>/g, '$1<blockquote lang="sv">');
  return html;
}
