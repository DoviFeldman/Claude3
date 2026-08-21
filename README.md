# AI-Generated Portfolio — "Field Swap Stream"

A portfolio website that loads as **raw JSON-style plain text**. One line says
*"to generate a User Interface click here"* — and when a visitor clicks it, the page
**stays on the same screen** and the JSON transforms in place: each field is a slot
that **hard-swaps** into a real UI element, one after another, like a model reading
the portfolio top to bottom. The look (palette, type, spacing, cards, chips) is
**designed live by AI** in the style of 3 randomly picked words, so every run looks
different.

No smooth transitions or fades — deliberate **hard cuts only**. The JSON is the stage;
the UI grows out of it.

## How it fits together

```
 visitor's browser
       │
       ├── GitHub Pages / Vercel  ──►  index.html + data.json   (static, no secrets)
       │
       └── click "here"
              │  POST { data }
              ▼
        Vercel  ──►  /api/generate
              │        1. picks 3 random style words
              │        2. asks the AI to design a THEME (CSS for the .ui-* classes)
              │           in the style of those words
              │        3. streams back a tiny line protocol: the theme, then a
              │           "@show <slot>" line per field, in reading order
              ▼
        the page swaps each JSON slot → a real, themed UI node (content comes
        from data.json, so the AI can never invent or alter your data)
```

Your AI API key lives **only** in Vercel environment variables. Visitors never see it.

### Why the client renders the content (not the model)

The model only supplies the **theme CSS** and the **reveal order**. Every field's
*content* is rendered on the client from `data.json`. This means:

- the AI **cannot invent or change** your bio/projects/links — it only styles them;
- the protocol is tiny and robust (no giant HTML blobs, no escaping headaches);
- if the model's output is imperfect or fails entirely, the client **sweeps** any
  un-shown slots when the stream ends, so the page is **always complete** (it just
  falls back to the built-in default theme).

## Stream format (`/api/generate` response)

Plain text. Line 1 is a JSON header with the style words; then a simple line protocol:

```
{"words":["brutalist","editorial","neon"]}
@theme
:root { --ui-accent:#58a6ff; ... }
.ui-name { ... }  .ui-card { ... }   /* raw CSS for the .ui-* classes */
@endtheme
@show name
@show title
@show skill-0
@show project-0
...
@done
```

The client applies `@theme` by replacing the text of a `<style id="ai-theme">`
(hard cut), and on each `@show <slot>` it `replaceWith`s the matching
`[data-slot]` JSON node with a themed UI node built from `data.json`.

## Setup

### 1. Put in your info

Edit `data.json` — it's the single source of truth (name, title, location, bio,
email, links, skills, projects, experience, education, funFact). The front end shows
it raw and swaps each field into the generated UI.

### 2. Deploy the API to Vercel

1. Vercel dashboard: **Add New → Project → import this GitHub repo**. Defaults are
   fine (Vercel auto-detects `api/generate.js`; no build step).
2. **Settings → Environment Variables**:

   | Name | Value | Required |
   |---|---|---|
   | `GROQ_API_KEY` | your Groq API key (free tier) — default provider is **Groq + `qwen/qwen3.6-27b`** | yes (for the default provider) |
   | `ALLOWED_ORIGIN` | your site origin, e.g. `https://yourusername.github.io` | recommended (defaults to `*`) |
   | `PROVIDER` | `groq` (default), `nvidia`/`deepseek`, `anthropic`, `openai`, `gemini` | no |
   | `GROQ_MODEL` | override the Groq model (default `qwen/qwen3.6-27b`) | no |

3. Deploy and note your project URL (e.g. `https://my-portfolio-api.vercel.app`).

Smoke-test from a terminal:

```sh
curl -N https://YOUR-PROJECT.vercel.app/api/generate \
  -H "Content-Type: application/json" \
  -d '{"data":{"name":"Test","skills":["JS"]}}'
```

You should see a `{"words":[...]}` line, then `@theme … @endtheme`, then `@show …`
lines and `@done`.

### 3. Point the frontend at your API

In `index.html`, near the top of the `<script>`:

```js
const API_BASE_SETTING = "https://YOUR-PROJECT.vercel.app";
```

Then commit and push. (If the whole site is hosted on Vercel, same-origin also works.)

### 4. Enable GitHub Pages (optional)

Repo **Settings → Pages → Source: Deploy from a branch**, root folder. Your site is
then at `https://yourusername.github.io/<repo>/`.

## Swapping the AI provider

The backend calls the AI through one small abstraction: `lib/providers.js`.

- **`groq`** (default) — `qwen/qwen3.6-27b`, fast and free. Reasoning is disabled
  (`reasoning_effort: "none"`) so the model doesn't burn its whole token budget
  "thinking"; stray code fences are stripped from the stream.
- **`nvidia`** / **`deepseek`** — any NVIDIA-hosted OpenAI-compatible model via
  `NVIDIA_MODEL` (key in `ANTHROPIC_API_KEY`/`NVIDIA_API_KEY`).
- **`anthropic`** — Claude (`ANTHROPIC_API_KEY`).
- **`openai`**, **`gemini`** — stubs with working code in comments.

Set `PROVIDER` in Vercel env vars to switch.

## Notes

- Style words come from [random-word-api](https://random-word-api.herokuapp.com/)
  server-side, with a built-in fallback list if that API is down.
- Groq's free tier is ~8000 tokens/min; the request is kept well under that, and a
  full generation takes only a few seconds.
- `ALLOWED_ORIGIN` limits who can call your endpoint from a browser; add rate
  limiting if the site gets popular.
- `vercel.json` sets `maxDuration: 300` as a safety ceiling; generations finish in
  seconds, not minutes.
