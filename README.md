# Pitch deck

One template, many pitches. A pitch is a folder with a YAML file and some images. Nothing else needs editing.

## Run it locally

Double-click `serve.cmd`. It starts a tiny web server and opens `http://localhost:8080/`.
Opening the HTML files directly from disk does not work, because browsers refuse to let a page read its sibling YAML files.

## Add a pitch

1. Copy `pitches/age-of-bonk/` to `pitches/<new-name>/`.
2. Edit `pitch.yaml`. Drop images in `img/`.
3. In `index.html` of the new folder, update the `<title>`, `description` and `og:*` tags. Link previews read those, not the YAML.
4. Add a line to `pitches.yaml` so the root page lists it.

## Files

```
convictions.yaml          shared convictions, referenced by id (c1, c2, ...)
pitches.yaml              list of pitches for the root index page
pitches/<name>/
  index.html              stub: title, Open Graph tags, loads the template
  pitch.yaml              all content
  img/                    icon, screenshots, reference thumbnails
template/
  style.css
  render.js
serve.ps1, serve.cmd      local web server
```

## pitch.yaml reference

Markdown works in every text field. Put a Mermaid diagram in a ```` ```mermaid ```` fence inside any body or take field.

| Key | What it is |
|---|---|
| `title`, `subtitle`, `icon`, `pitch`, `formula` | Title block. `formula` is the "X meets Y" one-liner. |
| `skip` | `{label, to}`. A floating button, shown on the slides between the title and the target, that jumps straight to a slide, for example `to: s-paths`. Slide ids: `s-title`, `s-convictions`, `s-ingredients`, `s-why`, `s-paths`, `s-questions`. |
| `intro` | Optional list of blocks shown under the elevator pitch. |
| `convictions` | List of ids from `convictions.yaml` that this pitch builds on. |
| `evidence` | List of `{id, title, type: comp|testing, summary, supports: [c-ids], image, caption, link, data, comparison}`. |
| `evidence[].comparison` | `{scale, games: [{name, image}], axes: [{name, scores: [a, b]}]}` renders paired bars. |
| `ingredients` | Six keys in fixed order: `toy, rules, meta, theme, visual_hook, monetization`. Each is a list of ref cards, or a map with `cards`, `points` (plain bullets, no images), `consider`, `reject`, `note`. |
| ref card | `{name, image, link, take, why}`. `why` is collapsed by default. |
| `sanity_check` | List of blocks with `refs` pointing at conviction ids, evidence ids, question ids or ingredient keys. |
| `open_questions` | `{id, question, status: open|action|tbd, owner, detail}`. |
| `directions` | `{name, summary, image, loop, body, answers: [q-ids]}`. Each path is a chapter of slides after the overview: a hook slide with `summary`, the text before the first heading and `image`; a loop slide built from `loop: [{step, note}]`; then one slide per `## heading` in `body`. |
| `directions_heading`, `directions_sub` | Heading and subtitle of the paths slide. |

Block fields: `heading`, `body`, `reasoning` (collapsed), `kind: proposal` (dashed, marked as a proposal), `table`, `diagram` (raw Mermaid), `image`, `caption`, `refs`.

## Presenting

The page is a deck. Each section is one full-screen slide, and the page snaps from slide to slide as you scroll.
The slide shows only pictures and labels. Everything written lives one tap deeper:

- Tap a conviction circle, an ingredient, a reason or a path and a sheet opens with the full breakdown.
- Hovering a circle shows the one-line statement without opening anything.
- Chips inside a sheet jump to the thing they reference, so you can follow a reason back to its conviction.

Keys: arrows, PageUp/PageDown or space step through slides, Home and End jump to the ends, Escape closes a sheet.
Every slide and every sheet has its own link, for example `#s-ingredients` or `#c1`, so you can send someone straight to one.

Ctrl+P prints the slides followed by every breakdown, one per page.

**Full overview.** The button in the bottom-right corner opens the same pitch as one long page with everything unfolded, at `?view=full`. Good for a reader who wants to skim it all, and for printing. "Back to the deck" returns. The label can be changed with `overview_label` in the pitch YAML.

## Convictions and their circles

Each conviction in `convictions.yaml` has a `short` label for the circle, a `statement` for hover and the top of the sheet, and up to three `images` that are composited inside the circle. Paths are relative to `convictions.yaml`, so the shared art lives in the root `img/` folder. Set `crossed: true` to draw a red cross over the circle, for a "do not" conviction.

Ingredient categories without reference cards are left off the slide. Give a category a `label` to rename it on the slide, for example `visual_hook: { label: Marketability, cards: [...] }`.
