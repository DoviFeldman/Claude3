# Notes & implementation choices

## Field Swap Stream (current UX)

Clicking "here" no longer switches to a second screen or an iframe. The JSON on the
page **is** the stage: each field hard-swaps into a real UI node in place, in reading
order, as the stream emits it. See the README's "Stream format" section for the
protocol.

Key files:
- `index.html` — builds the JSON scaffold (`[data-slot]` / `[data-line]` nodes),
  consumes the stream, applies the AI `@theme`, and hard-swaps each `@show <slot>`.
  A final **sweep** on stream-end reveals any slot the model didn't emit, so the page
  is always complete even if the model fails.
- `api/generate.js` — builds the slot order and prompts the model for the
  `@theme … @endtheme` + `@show …` + `@done` protocol.
- `lib/providers.js` — Groq provider (default `qwen/qwen3.6-27b`, reasoning disabled).

Design choice: the model only supplies the **theme CSS** and the **reveal order**;
all field **content** is rendered on the client from `data.json`, so the AI can never
invent or alter your data, and the protocol stays small and robust.

Hard cuts only: no CSS transitions/animations on swaps (just the tiny status-dot
pulse). Reveal pacing is a plain timed queue (`REVEAL_MS` in `index.html`), not an
animation.

## Removed: single-page (no-scroll) iframe mode

The earlier `SINGLE_PAGE_MODE` toggle applied to the old approach, where the model
streamed a full standalone HTML document into an iframe. That approach has been
replaced by Field Swap, so the toggle no longer exists.
