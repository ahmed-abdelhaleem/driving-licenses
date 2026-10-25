#!/usr/bin/env python3
"""Scrape Transportstyrelsen road-sign catalogue: categories -> sign pages -> description, PNG + alternatives."""
import os, re, json, time, subprocess, hashlib, sys
from bs4 import BeautifulSoup
SCR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = 'https://www.transportstyrelsen.se'
ROOT = '/sv/vagtrafik/trafikregler-och-vagmarken/vagmarken/'
CATS = [
 ('A','varningsmarken'),('B','vajningspliktsmarken'),('C','forbudsmarken'),('D','pabudsmarken'),
 ('E','anvisningsmarken'),('F','lokaliseringsmarken-for-vagvisning'),('F-GC','lokaliseringsmarken-for-gang-och-cykeltrafik'),
 ('G','lokaliseringsmarken-for-upplysning-om-allmanna-inrattningar-med-mera'),
 ('H','lokaliseringsmarken-for-upplysning-om-serviceanlaggningar-med-mera'),
 ('I','lokaliseringsmarken-for-turistiskt-intressanta-mal-med-mera'),('J','upplysningsmarken'),
 ('M','vagmarkeringar'),('P','tecken-av-polisman-med-flera'),('S','symboler'),('T','tillaggstavlor'),
 ('SIG','trafiksignaler'),('V','tecken-av-vakt'),('X','andra-anordningar-for-anvisningar-for-trafiken'),
 ('Y','sakerhetsanordningar-i-korsningar-med-jarnvag-eller-sparvag')]
def get(url):
    fn = os.path.join(SCR, 'signs', 'pages', hashlib.md5(url.encode()).hexdigest() + '.html')
    if not os.path.exists(fn):
        subprocess.run(['curl', '-sSL', '--max-time', '60', '-o', fn, BASE + url], check=True)
        time.sleep(0.3)
    return BeautifulSoup(open(fn, 'rb').read().decode('utf-8', 'replace'), 'lxml')
def clean(t): return ' '.join(t.split())
out = []
for cat, slug in CATS:
    s = get(ROOT + slug + '/')
    main = s.find('main')
    title = clean(main.find('h1').get_text())
    intro = [clean(p.get_text()) for p in main.find_all('p', recursive=True) if not p.get('class')]
    items = []
    for a in main.find_all('a', class_='roadsign-item'):
        href = a.get('href'); label = clean(a.get_text())
        img = a.find('img')
        items.append({'href': href, 'label': label, 'thumb': img.get('src').strip() if img else None})
    if not items:  # fallback: list links in main under this category path
        for a in main.find_all('a'):
            h = a.get('href') or ''
            if h.startswith(ROOT + slug + '/') and h != ROOT + slug + '/':
                items.append({'href': h, 'label': clean(a.get_text()), 'thumb': None})
    print(cat, title, len(items), file=sys.stderr)
    for it in items:
        p = get(it['href']); m = p.find('main')
        name = clean(m.find('h1').get_text()) if m.find('h1') else it['label']
        mainimg = None
        w = m.find('div', class_='roadsign-image-sizing-wrapper')
        if w and w.find('img'): mainimg = w.find('img').get('src').strip()
        desc = []
        for el in m.find_all(['p', 'li', 'h2', 'h3']):
            if el.find_parent('a') or el.find_parent(class_='roadsign-mediadata'): continue
            t = clean(el.get_text())
            if not t or t in ('Vägmärkesfiler', 'Alternativa symboler'): continue
            if el.name in ('h2', 'h3'): t = '## ' + t
            desc.append(t)
        files = {}
        for a in m.select('a.roadsign-button'):
            h = a.get('href', '')
            ext = h.rsplit('.', 1)[-1].lower()
            files[ext] = h
        alts = []
        for a in m.find_all('a', class_='roadsign-item'):
            img = a.find('img')
            alts.append({'code': clean(a.get_text()), 'href': a.get('href'), 'img': img.get('src').strip() if img else None})
        out.append({'cat': cat, 'catTitle': title, 'label': it['label'], 'name': name, 'href': it['href'],
                    'img': mainimg, 'files': files, 'desc': desc, 'alts': alts})
json.dump(out, open(os.path.join(SCR, 'signs', 'catalogue.json'), 'w'), ensure_ascii=False, indent=1)
print('total', len(out), file=sys.stderr)
