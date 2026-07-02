# AI-Generated Portfolio

A portfolio website that loads as **raw JSON-style plain text**. The second line says
*"to generate a User Interface click here"* — and when a visitor clicks it, an AI
designs a complete UI for the site **live, streamed in real time**, in the style of
3 randomly picked words. Every generation looks different.

Nothing is faked: the HTML you watch appear is being written by the model at that moment.

## How it fits together

```
 visitor's browser
       │
       ├── GitHub Pages  ──►  index.html + data.json   (static, no secrets)
       │
       └── click "here"
              │  POST { data }
              ▼
        Vercel  ──►  /api/generate
              │        1. picks 3 random style words
              │        2. asks Claude: "design a website UI for this website
              │           based on the style of [word1, word2, word3]" + your data
              │        3. streams the HTML back as it's generated
              ▼
        browser renders each chunk into an iframe as it arrives
```

Your AI API key lives **only** in Vercel environment variables. Visitors never see it.

## Setup

### 1. Put in your info

Edit `data.json` — it's the single source of truth for everything on the site
(name, bio, skills, projects, experience, links). The frontend displays it raw, and
the AI is required to include every field in the generated UI.

### 2. Deploy the API to Vercel

1. In your Vercel dashboard: **Add New → Project → import this GitHub repo**.
   The defaults are fine (Vercel auto-detects `api/generate.js` as a serverless function;
   no build step needed).
2. In the project's **Settings → Environment Variables**, add:

   | Name | Value | Required |
   |---|---|---|
   | `ANTHROPIC_API_KEY` | your Anthropic API key | yes |
   | `ALLOWED_ORIGIN` | your GitHub Pages origin, e.g. `https://yourusername.github.io` | recommended (defaults to `*`) |
   | `PROVIDER` | `anthropic` (default), `openai`, or `gemini` | no |

3. Deploy, and note your project URL (e.g. `https://my-portfolio-api.vercel.app`).

Smoke-test it from a terminal:

```sh
curl -N https://YOUR-PROJECT.vercel.app/api/generate \
  -H "Content-Type: application/json" \
  -d '{"data":{"name":"Test","bio":"hello"}}'
```

You should see a `{"words":[...]}` line and then HTML streaming out.

### 3. Point the frontend at your API

In `index.html`, near the top of the `<script>`:

```js
const API_BASE = "https://YOUR-PROJECT.vercel.app";
```

Replace it with your Vercel URL. Commit and push.

### 4. Enable GitHub Pages

Repo **Settings → Pages → Source: Deploy from a branch**, pick your branch, root folder.
Your site is now at `https://yourusername.github.io/<repo>/`.

## Swapping the AI provider

The backend calls the AI through one small abstraction: `lib/providers.js`.
Claude is implemented; OpenAI (ChatGPT) and Gemini stubs are already there with
working code in comments. To switch:

1. `npm install openai` (or `@google/genai`) and commit the updated `package.json`.
2. Uncomment the stub body in `lib/providers.js`.
3. In Vercel env vars: add `OPENAI_API_KEY` (or `GEMINI_API_KEY`) and set `PROVIDER=openai` (or `gemini`).

## Notes

- Random style words come from [random-word-api](https://random-word-api.herokuapp.com/)
  server-side, with a built-in fallback word list if that API is down.
- Each generation costs real API tokens (roughly a few cents with Claude Sonnet).
  `ALLOWED_ORIGIN` limits who can call your endpoint from a browser; if the site gets
  popular, consider adding rate limiting (e.g. Vercel's `@vercel/firewall` or Upstash).
- Generations can take 1–3 minutes for a full page — that's the show. `vercel.json`
  sets `maxDuration: 300` so Vercel doesn't cut it off (requires a plan that allows it;
  Hobby currently allows up to 300s with fluid compute).
