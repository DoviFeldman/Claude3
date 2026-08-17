// ============================================================
// POST /api/generate
//
// Body: { "data": { ...portfolio json... } }
//
// Response: a stream where the FIRST LINE is a JSON header
//   {"words":["neon","cactus","velvet"]}
// and everything after it is raw HTML, streamed live from the
// AI as it is generated.
//
// The AI API key lives only in Vercel env vars — visitors never
// see it.
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

  const systemPrompt = [
    "You are a world-class web designer. You output ONLY a single, complete,",
    "self-contained HTML document. No markdown, no code fences, no commentary,",
    "no explanation before or after. Your very first characters must be <!DOCTYPE html>.",
    "",
    "Rules for the document:",
    "- All CSS in a <style> tag and any JS in a <script> tag — one file, no external requests",
    "  except optionally Google Fonts.",
    "- It must be a polished, creative, fully responsive portfolio website.",
    "- Include EVERY piece of information from the portfolio data you are given:",
    "  name, title, bio, skills, all projects, all experience, education, links, everything.",
    "- Make links real <a> tags using the URLs provided.",
    "- Add tasteful animations and micro-interactions. Be bold and distinctive, not generic.",
    "- Structure the HTML so it looks good even while streaming in: put the <style> tag",
    "  early in <head>, and order the <body> top-to-bottom in visual order.",
    "- Keep it CONCISE and fast to generate: the entire HTML document should be roughly",
    "  150 lines total (about 130-170 is fine). A tight, elegant page renders quickly and",
    "  looks intentional — favor clean design over length, and do not pad the code.",
  ].join("\n");

  const userPrompt = [
    `Design a website UI for this website based on the style of: ${words.join(", ")}.`,
    "",
    "Let those three words genuinely drive the visual direction — colors, typography,",
    "layout, texture, motion. Interpret them creatively.",
    "",
    "Here is all of the website's data. Every field must appear in the page:",
    "",
    dataJson,
  ].join("\n");

  // Stream: header line first, then raw HTML as it generates.
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
