# Notes & revertible tweaks

## Single-page (no-scroll, desktop) mode

The generated UI is currently asked to fit **entirely on one desktop screen**
so the visitor never has to scroll (optimized for computer/laptop viewports).

- **Where:** `api/generate.js`, the `SINGLE_PAGE_MODE` constant (set to `true`).
- **To revert:** set `SINGLE_PAGE_MODE = false` (or delete the
  `if (SINGLE_PAGE_MODE) { … }` block).

Reverting returns the prompt to its **original neutral behavior**: it does
**not** ask for a single no-scroll page, and it does **not** ask for a longer
scrolling page either — it simply drops the single-page instruction.
