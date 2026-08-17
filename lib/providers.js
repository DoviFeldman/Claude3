// ============================================================
// AI provider abstraction.
//
// Every provider exposes the same shape:
//   streamUI({ systemPrompt, userPrompt, onText }) -> Promise<void>
// where onText(chunk) is called with each piece of generated text
// as it streams in.
//
// Select a provider with the PROVIDER env var on Vercel
// (defaults to "anthropic").
//
// TO ADD A NEW PROVIDER (e.g. OpenAI / ChatGPT or Gemini):
//   1. npm install the provider's SDK (see the stubs below)
//   2. Add the provider's API key as a Vercel env var
//   3. Fill in the stub function below (working code is in the comments)
//   4. Set PROVIDER=openai (or gemini) in Vercel env vars — done.
// ============================================================

// ---------- NVIDIA-hosted model (implemented, default) ----------
// Free NVIDIA API, OpenAI-compatible. Key is read from ANTHROPIC_API_KEY
// (kept that env var name) or NVIDIA_API_KEY.
//
// The model is set via the NVIDIA_MODEL env var and defaults to a current,
// available model. (The old deepseek-ai/deepseek-v4-pro was deprecated by
// NVIDIA and now returns HTTP 410, so it is no longer used.) To change the
// model without a redeploy, just set NVIDIA_MODEL in Vercel env vars.
async function streamDeepSeek({ systemPrompt, userPrompt, onText }) {
  const OpenAI = require("openai");
  const client = new OpenAI({
    baseURL: "https://integrate.api.nvidia.com/v1",
    apiKey: process.env.ANTHROPIC_API_KEY || process.env.NVIDIA_API_KEY,
  });
  const model = process.env.NVIDIA_MODEL || "meta/llama-3.1-70b-instruct";
  const params = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 1,
    top_p: 0.95,
    max_tokens: 16384,
    stream: true,
  };
  // DeepSeek chat models support turning "thinking" off; only send that
  // extra field when actually talking to a DeepSeek model.
  if (model.includes("deepseek")) {
    params.chat_template_kwargs = { thinking: false };
  }
  const stream = await client.chat.completions.create(params);
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) onText(delta);
  }
}

// ---------- Claude (implemented) ----------
async function streamAnthropic({ systemPrompt, userPrompt, onText }) {
  // required lazily so the module loads even if you swap providers
  const Anthropic = require("@anthropic-ai/sdk");
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env
  const stream = client.messages.stream({
    model: "claude-sonnet-5",
    max_tokens: 32000,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });
  stream.on("text", (delta) => onText(delta));
  await stream.finalMessage();
}

// ---------- OpenAI / ChatGPT (stub — see instructions) ----------
// 1. npm install openai
// 2. Set OPENAI_API_KEY in Vercel env vars
// 3. Uncomment the code below
// 4. Set PROVIDER=openai
async function streamOpenAI({ systemPrompt, userPrompt, onText }) {
  throw new Error("OpenAI provider not configured — see lib/providers.js for setup steps");
  // const OpenAI = require("openai");
  // const client = new OpenAI(); // reads OPENAI_API_KEY from env
  // const stream = await client.chat.completions.create({
  //   model: "gpt-4o",
  //   stream: true,
  //   messages: [
  //     { role: "system", content: systemPrompt },
  //     { role: "user", content: userPrompt },
  //   ],
  // });
  // for await (const chunk of stream) {
  //   const delta = chunk.choices[0]?.delta?.content;
  //   if (delta) onText(delta);
  // }
}

// ---------- Google Gemini (stub — see instructions) ----------
// 1. npm install @google/genai
// 2. Set GEMINI_API_KEY in Vercel env vars
// 3. Uncomment the code below
// 4. Set PROVIDER=gemini
async function streamGemini({ systemPrompt, userPrompt, onText }) {
  throw new Error("Gemini provider not configured — see lib/providers.js for setup steps");
  // const { GoogleGenAI } = require("@google/genai");
  // const client = new GoogleGenAI({}); // reads GEMINI_API_KEY from env
  // const stream = await client.models.generateContentStream({
  //   model: "gemini-2.5-flash",
  //   config: { systemInstruction: systemPrompt },
  //   contents: userPrompt,
  // });
  // for await (const chunk of stream) {
  //   if (chunk.text) onText(chunk.text);
  // }
}

const PROVIDERS = {
  deepseek: streamDeepSeek,
  anthropic: streamAnthropic,
  openai: streamOpenAI,
  gemini: streamGemini,
};

async function streamUI({ provider, systemPrompt, userPrompt, onText }) {
  const name = provider || process.env.PROVIDER || "deepseek";
  const fn = PROVIDERS[name];
  if (!fn) {
    throw new Error(`Unknown provider "${name}". Available: ${Object.keys(PROVIDERS).join(", ")}`);
  }
  await fn({ systemPrompt, userPrompt, onText });
}

module.exports = { streamUI };
