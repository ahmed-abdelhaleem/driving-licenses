# Övningskör – Swedish driving licence theory in plain English

A study website for the **Swedish driving licence theory test**, in English, with three separate paths:

| Path | Licence | Notes |
|---|---|---|
| **Car – manual** | B | The driving test in a manual car lets you drive manual and automatic cars. |
| **Car – automatic** | B with code 78 | Passing the driving test in an automatic car limits the licence to automatic cars (code 78). |
| **Motorcycle** | A | With the A1/A2/A steps, protective gear, cornering, braking and the riding test. |

The theory test itself is the same for manual and automatic cars; the paths differ in the vehicle lessons and questions.

## What is on the site

- **Structured lessons** (65) in modules that follow the official course plans: your road to the licence, signs and markings, traffic rules, the vehicle, driving safely, environment and personal factors. Every lesson starts with goals, explains in simple words, and quotes the Swedish law text next to an English translation where the law matters.
- **Every official road sign, marking and signal** (344, with 611 images) with an English name, the meaning translated from the official description, and practical advice.
- **A dictionary** of 201 Swedish licence and traffic words with plain-English definitions, law references, related words and – for 53 of them – a sign, photo or diagram.
- **Search** across lessons, signs and dictionary words, in English or Swedish (e.g. `B1`, `väjningsplikt`, `roundabout`).
- **Practice and an exam simulator**: 586 written questions plus 229 sign-recognition questions. The simulator builds a theory test like Trafikverket's: 70 questions (65 scored + 5 unscored trial questions), 50 minutes, pass mark 52. Trafikverket does not publish how many questions each area gets, so the split between the five areas is this site's own choice.
- **Photos and diagrams**: freely licensed photos from Wikimedia Commons (author, licence and source under each picture) and diagrams drawn for the site that follow the light and dark themes.
- **Sources**: a page listing every source with its publisher, link and the date it was checked. Citations in the lessons link to the exact chapter and section of the law.

Progress (finished lessons, wrong answers, exam results) is stored only in your own browser.

## Accuracy and sources

The rules were checked against official Swedish sources – the Road Traffic Ordinance (*trafikförordningen*), the Driving Licence Act and Ordinance, the Road Signs Ordinance, Transportstyrelsen's regulations (TSFS) and guides, Trafikverket's test information, the Police, 1177 and others – on 25–26 October 2026. For general driving and riding technique only, the site also cites the UK Highway Code and the Saskatchewan (SGI) motorcycle handbook; they are always labelled as such, and their traffic laws do not apply in Sweden.

Laws change. Before your test, confirm anything important with [Transportstyrelsen](https://www.transportstyrelsen.se/sv/vagtrafik/korkort/) and [Trafikverket](https://www.trafikverket.se/korkort/).

## Build and run

Requirements: Node.js 18 or newer.

```sh
npm install        # markdown-it, js-yaml, minisearch
npm run build      # content/ → docs/ (static site)
npm run serve      # http://localhost:8080
npm test           # rebuild + content and exam checks
```

The site is fully static. `docs/index.html` is the standalone page (GitHub Pages can serve the `docs/` folder directly); `docs/artifact.html` is the same page as a fragment for hosts that add their own document skeleton.

`npm test` (`scripts/validate.mjs`) rebuilds the site, fails on any unresolved reference (sign, dictionary word, source, lesson, photo, diagram), checks every question (answer index, unique options, explanation, source), runs the site's own exam-assembly code 200 times per licence (70 questions, area mix, no duplicates, no practice-only questions), and checks photo licences, diagram accessibility, the search index and link-safe ids.

## Content layout

```
content/
  paths.yaml            the three study paths and their modules
  lessons/<module>/*.md lessons (Markdown with shortcodes, see below)
  questions/*.yaml      practice and exam questions
  glossary.yaml         the dictionary
  sources.yaml          every source, with URL and date checked
  facts.yaml            numbers used in many places (speed limits, ages, fees …), each with its source
  signs/                official sign catalogue (Swedish) and English translations
  media/photos.yaml     photo credits and captions
  media/diagrams.yaml   diagram captions
assets/                 CSS, JavaScript, sign images, photos, diagrams, HTML shell
scripts/                build, local server, validator
docs/                   the built site (generated – do not edit)
```

### Lesson shortcodes

| Shortcode | Result |
|---|---|
| `[[sign:B1]]`, `[[sign:B1\|give way]]` | Link to a sign, with its image |
| `[[signs:A10,A11]]` | A row of sign images (on its own line) |
| `[[term:vajningsplikt]]`, `[[term:id\|label]]`, `[[term:id\|sv]]` | Link to a dictionary word |
| `[[src:tf\|3:17]]` | Citation; for laws `chapter:section` becomes "TrF 3 kap. 17 §" with a link to that section |
| `[[src:uk-hc-general\|rule 120]]` | Citation of a location in a non-law source |
| `[[fact:speed.builtUp]]` | A value from `facts.yaml` |
| `[[lesson:tyres]]` | Link to another lesson |
| `[[photo:id]]`, `[[fig:id]]` | A photo or diagram with caption and credit (on its own line) |

Containers: `::: law tf 3:14` (Swedish law text + translation), `::: tip`, `::: warning`, `::: note`, `::: key`, `::: example`, `::: steps`, and `::: only car-manual motorcycle` for text that only belongs to some paths (`car` = both car paths).

### Question fields

`id`, `area` (rules, safety, vehicle, environment, personal), `paths` (default: all), `lesson`, `q`, `options`, `answer` (0-based; options are shuffled when shown), `explain`, `src` (list of `source|location`), optional `image` (`sign:`, `photo:`, `fig:`), `fix: true` to keep the written option order, and `exam: false` for practice-only questions.

## Credits

- **Road signs**: official files from Transportstyrelsen's sign catalogue, which may be used freely.
- **Photos**: Wikimedia Commons contributors – each photo shows its author, licence and source page, and the *Image credits* page lists them all. Cropped or resized photos are marked.
- **Diagrams**: drawn for this site.
