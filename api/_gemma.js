// Google Gemma 4 helper (open-weight model served by the Gemini API). Key comes only from env GEMINI_API_KEY.
// Two Gemma 4 models run in parallel "lanes" with short retries; the first valid JSON answer wins.
const MODELS = [process.env.GEMMA_MODEL, "gemma-4-31b-it", "gemma-4-26b-a4b-it"]
  .filter(Boolean).filter((m, i, a) => a.indexOf(m) === i);
const ENDPOINT = (m) => `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`;
const BUDGET_MS = 57000, TIMEOUT_MS = 50000, MAX_TRIES = 3;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseJSON(text) {
  let t = String(text || "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  try { return JSON.parse(t); } catch {}
  const s = t.indexOf("{"), e = t.lastIndexOf("}");
  if (s !== -1 && e > s) { try { return JSON.parse(t.slice(s, e + 1)); } catch {} }
  throw new Error("Model returned invalid JSON");
}

// parts: Gemini "parts" array, e.g. [{ text }, { inline_data: { mime_type, data } }]
async function callOnce(model, parts, maxOutputTokens, signal) {
  const r = await fetch(ENDPOINT(model), {
    method: "POST",
    headers: { "x-goog-api-key": process.env.GEMINI_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: { temperature: 0.3, maxOutputTokens, thinkingConfig: { thinkingLevel: "minimal" } },
    }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)]),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(r.status === 429 ? "Gemma free-tier rate limit reached, try again in a minute" : j.error?.message || `Gemma error ${r.status}`), { status: r.status });
  const text = (j.candidates?.[0]?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || "").join("");
  return { data: parseJSON(text), model };
}

async function lane(model, parts, max, ctrl, start) {
  let last;
  for (let i = 0; i < MAX_TRIES && Date.now() - start < BUDGET_MS - 3000 && !ctrl.signal.aborted; i++) {
    try { return await callOnce(model, parts, max, ctrl.signal); }
    catch (e) {
      last = e;
      if (ctrl.signal.aborted || [400, 401, 403, 429].includes(e.status)) break;
      await sleep(800 + i * 700);
    }
  }
  throw last || new Error("Gemma timed out");
}

async function gemmaJSON(prompt, { images = [], maxOutputTokens = 2000 } = {}) {
  if (!process.env.GEMINI_API_KEY) throw Object.assign(new Error("Server missing GEMINI_API_KEY"), { status: 500 });
  const parts = [...images.map((im) => ({ inline_data: { mime_type: im.mimeType, data: im.data } })), { text: prompt }];
  const ctrl = new AbortController(), start = Date.now();
  const kill = setTimeout(() => ctrl.abort(), BUDGET_MS);
  try { return await Promise.any(MODELS.map((m) => lane(m, parts, maxOutputTokens, ctrl, start))); }
  catch (e) {
    const errs = e.errors || [e];
    const err = errs.find((x) => x?.status === 429) || errs.find((x) => x?.status && x.status !== 500) || errs.find((x) => x?.message) || e;
    const msg = /abort|timed? ?out/i.test(err.message || "") ? "Gemma 4 took too long to answer (free tier is busy). Please try again." : err.message || "Gemma error";
    throw Object.assign(new Error(msg), { status: err.status === 429 ? 429 : 502 });
  } finally { clearTimeout(kill); ctrl.abort(); }
}

const readBody = (req) => (typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {});
// Accepts a data URL ("data:image/jpeg;base64,...") and returns { mimeType, data } or null.
function parseImage(dataUrl) {
  const m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ""));
  if (!m) return null;
  if (m[2].length > 4_000_000) throw Object.assign(new Error("Image too large (max ~3 MB)"), { status: 413 });
  return { mimeType: m[1], data: m[2] };
}
module.exports = { gemmaJSON, readBody, parseImage, MODELS };
