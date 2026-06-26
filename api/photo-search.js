/**
 * Vercel serverless: visual product search via Google Gemini Flash (cheap multimodal AI).
 *
 * Env: GEMINI_API_KEY — https://aistudio.google.com/apikey
 */
const rateLimit = require("./photo-rate-limit");

const GEMINI_MODEL = String(process.env.GEMINI_MODEL || "gemini-2.0-flash-lite");
const MAX_PRODUCTS = 200;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const apiKey = String(process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    return res.status(503).json({ ok: false, error: "ai_not_configured" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const image = parseDataUrl(body.image);
    const products = Array.isArray(body.products) ? body.products : [];
    const userId = String(body.userId || body.user_id || "").trim();

    if (!image) {
      return res.status(400).json({ ok: false, error: "invalid_image" });
    }

    if (image.byteLength > MAX_IMAGE_BYTES) {
      return res.status(400).json({ ok: false, error: "image_too_large" });
    }

    const quota = await rateLimit.consumePhotoSearchQuota(req, userId);
    rateLimit.applyRateLimitHeaders(res, quota);
    if (!quota.allowed) {
      return res.status(429).json({
        ok: false,
        error: "rate_limit_exceeded",
        retryAfterSec: quota.retryAfterSec,
        remaining: 0,
        limit: quota.limit,
      });
    }

    const catalog = products
      .slice(0, MAX_PRODUCTS)
      .map(function (p, index) {
        const title = String(p.title || p.nameRu || p.name || "").trim();
        if (!title) return "";
        const brand = String(p.brand || "").trim();
        const category = String(p.category || "").trim();
        return (index + 1) + ". " + title + " | " + brand + " | " + category;
      })
      .filter(Boolean)
      .join("\n");

    if (!catalog) {
      return res.status(200).json({ ok: true, matches: [], source: "gemini" });
    }

    const prompt =
      "You are a product search assistant for Emirate Co electronics store in Uzbekistan.\n" +
      "The user uploaded a photo. Find matching products from the catalog below.\n\n" +
      "Catalog (title | brand | category):\n" +
      catalog +
      "\n\n" +
      "Return ONLY valid JSON without markdown:\n" +
      '{"matches":[{"title":"exact title from catalog","score":0.92}]}\n' +
      "Rules:\n" +
      "- Include 0 to 12 best matches only.\n" +
      "- score is 0 to 1 (confidence).\n" +
      "- title must exactly match a catalog title.\n" +
      "- If nothing matches, return {\"matches\":[]}.";

    const geminiRes = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/" +
        encodeURIComponent(GEMINI_MODEL) +
        ":generateContent?key=" +
        encodeURIComponent(apiKey),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: image.mimeType,
                    data: image.data,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.15,
            maxOutputTokens: 1200,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    const geminiJson = await geminiRes.json();
    if (!geminiRes.ok) {
      const message =
        (geminiJson && geminiJson.error && geminiJson.error.message) || "gemini_request_failed";
      return res.status(502).json({ ok: false, error: message });
    }

    const text = extractGeminiText(geminiJson);
    const parsed = extractJson(text);
    const matches = normalizeMatches(parsed && parsed.matches, products);

    return res.status(200).json({
      ok: true,
      matches: matches,
      source: "gemini",
      model: GEMINI_MODEL,
      remaining: quota.remaining,
      limit: quota.limit,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: String(err && err.message ? err.message : err),
    });
  }
};

function parseDataUrl(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/^data:([^;]+);base64,([A-Za-z0-9+/=\s]+)$/);
  if (match) {
    const data = match[2].replace(/\s+/g, "");
    return {
      mimeType: match[1],
      data: data,
      byteLength: Math.floor((data.length * 3) / 4),
    };
  }
  if (/^[A-Za-z0-9+/=\s]+$/.test(raw) && raw.length > 64) {
    const data = raw.replace(/\s+/g, "");
    return {
      mimeType: "image/jpeg",
      data: data,
      byteLength: Math.floor((data.length * 3) / 4),
    };
  }
  return null;
}

function extractGeminiText(payload) {
  const parts =
    payload &&
    payload.candidates &&
    payload.candidates[0] &&
    payload.candidates[0].content &&
    payload.candidates[0].content.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .map(function (part) {
      return String((part && part.text) || "");
    })
    .join("\n")
    .trim();
}

function extractJson(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_) {}
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch (_) {}
  }
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch (_) {}
  }
  return null;
}

function normalizeTitleKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeMatches(matches, products) {
  if (!Array.isArray(matches)) return [];

  const byTitle = new Map();
  (products || []).forEach(function (product) {
    const title = String(product.title || product.nameRu || product.name || "").trim();
    if (title) byTitle.set(normalizeTitleKey(title), title);
  });

  const seen = new Set();
  const out = [];

  matches.forEach(function (item) {
    const title = String((item && item.title) || "").trim();
    const key = normalizeTitleKey(title);
    const canonical = byTitle.get(key);
    if (!canonical || seen.has(canonical)) return;
    seen.add(canonical);
    const score = Number(item && item.score);
    out.push({
      title: canonical,
      score: Number.isFinite(score) ? Math.max(0, Math.min(1, score)) : 0.5,
    });
  });

  out.sort(function (a, b) {
    return b.score - a.score;
  });

  return out.slice(0, 12);
}
