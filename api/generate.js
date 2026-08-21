// ============================================================
// POST /api/generate
//
// Body: { "data": { ...portfolio json... } }
//
// Response: a plain-text stream in the "Field Swap" protocol.
//   Line 1 (JSON header):   {"words":["neon","cactus","velvet"]}
//   Then:                   @theme
//                           ...raw CSS styling the .ui-* classes...
//                           @endtheme
//                           @show name
//                           @show title
//                           @show skill-0
//                           ... (one @show per data slot, in order)
//                           @done
//
// The client renders every field's CONTENT from data.json (so the
// model can never invent or alter the data); the model only supplies
// the theme CSS and the reveal order/pacing. The client also sweeps
// any un-shown slots when the stream ends, so the page is always
// complete even if the model's output is imperfect.
//
// The AI API key lives only in Vercel env vars — visitors never see it.
// ============================================================

const { streamUI } = require("../lib/providers");

// Fallback style words, used if the random-word API is down.
const FALLBACK_WORDS = [
  "neon", "cactus", "velvet", "brutalist", "origami", "vaporwave", "tundra",
  "arcade", "botanical", "chrome", "parchment", "glacier", "circuit", "moss",
  "midnight", "citrus", "nebula", "terracotta", "static", "porcelain",
  "graffiti", "monsoon", "prism", "lantern", "obsidian", "meadow", "retro",
  "holographic", "driftwood", "magma", "denim", "carnival", "fog", "honey",
  "sakura", "industrial", "coral", "blueprint", "jazz", "aurora", "desert",
  "cosmic", "typewriter", "jungle", "marble", "pixel", "silk", "thunder",
  "wireframe", "amber", "noir", "bubblegum", "geode", "harbor", "voltage",
  "papyrus", "disco", "frost", "safari", "kaleidoscope",
];

async function getRandomWords() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch("https://random-word-api.herokuapp.com/word?number=3", {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error("status " + res.status);
    const words = await res.json();
    if (Array.isArray(words) && words.length === 3 && words.every((w) => typeof w === "string")) {
      return words;
    }
    throw new Error("bad response shape");
  } catch (e) {
    // fall back to our built-in list
    const picks = [];
    const pool = [...FALLBACK_WORDS];
    for (let i = 0; i < 3; i++) {
      picks.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    return picks;
  }
}

// Build the ordered list of data slot ids (must match the client in index.html).
function buildSlotOrder(d) {
  const order = [];
  ["name", "title", "location", "bio", "email"].forEach((k) => {
    if (d[k] != null && d[k] !== "") order.push(k);
  });
  if (d.links && typeof d.links === "object") Object.keys(d.links).forEach((k) => order.push("link-" + k));
  if (Array.isArray(d.skills)) d.skills.forEach((_, i) => order.push("skill-" + i));
  if (Array.isArray(d.projects)) d.projects.forEach((_, i) => order.push("project-" + i));
  if (Array.isArray(d.experience)) d.experience.forEach((_, i) => order.push("exp-" + i));
  if (d.education != null && d.education !== "") order.push("education");
  if (d.funFact != null && d.funFact !== "") order.push("funfact");
  return order;
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

module.exports = async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only" });
    return;
  }

  // Vercel parses JSON bodies automatically; cap size so strangers
  // can't pump huge prompts through the endpoint.
  const data = req.body && req.body.data;
  if (!data || typeof data !== "object") {
    res.status(400).json({ error: "body must be { data: {...} }" });
    return;
  }
  const dataJson = JSON.stringify(data, null, 2);
  if (dataJson.length > 20000) {
    res.status(413).json({ error: "portfolio data too large" });
    return;
  }

  const words = await getRandomWords();
  const slotOrder = buildSlotOrder(data);

  const systemPrompt = [
    "You are a world-class UI designer. A portfolio is revealed on screen field",
    "by field, and YOU design how it looks. You output ONLY a plain-text stream in",
    "a simple line protocol. No markdown, no code fences, no commentary, no HTML.",
    "",
    "Output EXACTLY this structure and nothing else:",
    "",
    "1) A line containing only: @theme",
    "2) Then raw CSS (NO <style> tag, NO code fences) that styles the exact class",
    "   names listed below. Base the ENTIRE visual direction — palette, typography,",
    "   spacing, borders, radius, shadows — on the three style words you are given.",
    "   Override the :root design tokens and add rules for these classes:",
    "     :root (set --ui-bg,--ui-fg,--ui-muted,--ui-accent,--ui-border,--ui-card,--ui-chip)",
    "     .ui-root .ui-name .ui-title .ui-meta .ui-email .ui-bio",
    "     .ui-section .ui-label .ui-links .ui-link .ui-skills .ui-chip",
    "     .ui-projects .ui-card .ui-card h3 .ui-card p .ui-tech .ui-tag .ui-cardlink",
    "     .ui-exp-list .ui-exp .ui-exp-role .ui-exp-co .ui-exp-period .ui-exp-sum",
    "     .ui-edu .ui-fun",
    "   Keep the CSS compact (~60-110 lines). Do NOT use @import or external fonts.",
    "   Make it distinctive and genuinely themed by the words — not generic.",
    "3) A line containing only: @endtheme",
    "4) Then one line per field to reveal, in this EXACT order, nothing else on the line:",
    "     @show <slotid>",
    "   Use these slot ids, in this order:",
    "     " + slotOrder.join(" "),
    "5) A final line containing only: @done",
    "",
    "Do NOT output any HTML tags. Do NOT restate the portfolio data (the page already",
    "has it). Only: @theme, CSS, @endtheme, the @show lines, then @done.",
  ].join("\n");

  const userPrompt = [
    `Style words to design around: ${words.join(", ")}.`,
    "Let these three words genuinely drive the palette, typography, and feel.",
    "",
    "For context, here is the portfolio data being displayed (do NOT echo it back —",
    "just design a theme that suits it):",
    "",
    dataJson,
    "",
    "Now output the @theme CSS, then @endtheme, then the @show lines in the exact",
    "order given, then @done.",
  ].join("\n");

  // Stream: JSON header line first (style words), then the protocol.
  res.writeHead(200, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "X-Accel-Buffering": "no",
    "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*",
  });
  res.write(JSON.stringify({ words }) + "\n");

  try {
    await streamUI({
      systemPrompt,
      userPrompt,
      onText: (chunk) => res.write(chunk),
    });
  } catch (err) {
    // headers already sent — surface the error in-stream
    res.write(`\n<!-- generation error: ${String(err.message || err).replace(/-->/g, "")} -->\n`);
  }
  res.end();
};
