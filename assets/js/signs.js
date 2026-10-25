// Official sign images live in a few bundles (base64 WebP) that load on demand.
// Views render <img data-sign="A1-1"> without src; hydrateSigns() fills them in.
const SIGNIMG = {};
window.DL_SIGNIMG_ADD = (map) => Object.assign(SIGNIMG, map);
const bundleLoads = {};

function loadSignBundle(name) {
  if (!bundleLoads[name]) {
    bundleLoads[name] = new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = `assets/signs/bundle-${name}.js`;
      s.onload = resolve;
      s.onerror = resolve; // a missing bundle leaves grey placeholders, never breaks the page
      document.head.appendChild(s);
    });
  }
  return bundleLoads[name];
}

function signSrc(key) {
  return SIGNIMG[key] ? `data:image/webp;base64,${SIGNIMG[key]}` : '';
}

async function hydrateSigns(root) {
  const imgs = $$('img[data-sign]', root || document).filter((i) => !i.getAttribute('src'));
  if (!imgs.length) return;
  const bundleOf = window.DL_SIGN_BUNDLE_OF || {};
  const needed = new Set(imgs.map((i) => bundleOf[i.dataset.sign]).filter(Boolean));
  await Promise.all(Array.from(needed).map(loadSignBundle));
  for (const img of imgs) {
    const src = signSrc(img.dataset.sign);
    if (src) img.src = src;
  }
}

// Load every bundle when the browser is idle so search results show images quickly.
function prefetchSignBundles() {
  const all = new Set(Object.values(window.DL_SIGN_BUNDLE_OF || {}));
  const run = () => all.forEach(loadSignBundle);
  if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 4000 });
  else setTimeout(run, 2500);
}

function signImgTag(key, alt, cls = '') {
  return `<img class="sign-img ${cls}" data-sign="${esc(key)}" alt="${esc(alt)}" width="64" height="64">`;
}

function signCard(sign, opts = {}) {
  const key = opts.key || sign.img;
  const variant = sign.variants.find((v) => v.key === key);
  const name = variant && variant.en ? variant.en : sign.en || sign.sv;
  return `<a class="sign-card" href="#sign.${esc(sign.id)}">${signImgTag(key, `${sign.id} ${name}`)}<span class="sign-code">${esc(key === sign.img ? sign.id : key)}</span><span class="sign-name">${esc(name)}${opts.sv ? `<span class="sv" lang="sv">${esc(sign.sv)}</span>` : ''}</span></a>`;
}
