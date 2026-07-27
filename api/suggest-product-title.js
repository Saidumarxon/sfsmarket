/**
 * Product title suggestions for admin (Gemini + rule fallback).
 * POST /api/suggest-product-title
 * Env: GEMINI_API_KEY (optional — without it uses rules only)
 */
const GEMINI_MODEL = String(process.env.GEMINI_MODEL || "gemini-2.0-flash-lite");
const MIN_TITLE_LEN = 12;
const IDEAL_MAX = 90;
const HARD_MAX = 120;

const memoryHits = new Map();
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 80;

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

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const title = String(body.title || "").trim();
    const lang = String(body.lang || "ru").trim().toLowerCase() === "uz" ? "uz" : "ru";
    const brand = String(body.brand || "").trim();
    const model = String(body.model || "").trim();
    const category = String(body.category || "").trim();

    if (title.length < MIN_TITLE_LEN) {
      return res.status(200).json({
        ok: true,
        score: 0,
        charCount: title.length,
        feedback:
          lang === "uz"
            ? "Nom juda qisqa. Kamida 12 ta belgi kiriting."
            : "Название слишком короткое. Введите минимум 12 символов.",
        suggested: "",
        source: "rules",
      });
    }

    const quota = consumeRateLimit(req);
    if (!quota.allowed) {
      return res.status(429).json({
        ok: false,
        error: "rate_limited",
        retryAfterSec: quota.retryAfterSec,
      });
    }

    const apiKey = String(process.env.GEMINI_API_KEY || "").trim();
    if (apiKey) {
      const ai = await suggestWithGemini(apiKey, title, lang, brand, model, category);
      if (ai) {
        return res.status(200).json({
          ok: true,
          score: ai.score,
          charCount: title.length,
          feedback: ai.feedback,
          suggested: ai.suggested,
          suggestedUz: ai.suggestedUz || "",
          suggestedRu: ai.suggestedRu || "",
          source: "gemini",
          model: GEMINI_MODEL,
        });
      }
    }

    const rules = suggestWithRules(title, lang, brand, model, category);
    return res.status(200).json({
      ok: true,
      score: rules.score,
      charCount: title.length,
      feedback: rules.feedback,
      suggested: rules.suggested,
      suggestedRu: lang === "ru" ? rules.suggested : "",
      suggestedUz: lang === "uz" ? rules.suggested : "",
      source: "rules",
    });
  } catch (err) {
    console.error("[suggest-product-title]", err);
    return res.status(500).json({ ok: false, error: String(err && err.message ? err.message : err) });
  }
};

function getClientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();
  return forwarded || String(req.headers["x-real-ip"] || "unknown").trim();
}

function consumeRateLimit(req) {
  const key = "title:" + getClientIp(req);
  const now = Date.now();
  const hits = (memoryHits.get(key) || []).filter(function (t) {
    return t > now - RATE_WINDOW_MS;
  });
  if (hits.length >= RATE_MAX) {
    const retryAfterSec = Math.max(1, Math.ceil((hits[0] + RATE_WINDOW_MS - now) / 1000));
    memoryHits.set(key, hits);
    return { allowed: false, retryAfterSec: retryAfterSec };
  }
  hits.push(now);
  memoryHits.set(key, hits);
  return { allowed: true, retryAfterSec: 0 };
}

function scoreTitle(title, brand, model) {
  const len = title.length;
  let score = 10;

  if (len > HARD_MAX) score -= 4;
  else if (len > IDEAL_MAX) score -= 2;
  else if (len < 25) score -= 1;

  if (/\([^)]{5,}\)/.test(title)) score -= 1;
  if (/,.*,.*,/.test(title)) score -= 1;
  if (title.split(/\s+/).length > 14) score -= 1;

  const brandLc = brand.toLowerCase();
  const modelLc = model.toLowerCase();
  const titleLc = title.toLowerCase();
  if (brand && !titleLc.includes(brandLc)) score -= 1;
  if (model && model.length > 2 && !titleLc.includes(modelLc)) score -= 0.5;

  if (len >= 35 && len <= IDEAL_MAX) score += 0.5;

  return Math.max(1, Math.min(10, Math.round(score)));
}

function feedbackForScore(score, len, lang) {
  if (lang === "uz") {
    if (score >= 9) return "Sarlavha yaxshi. Agar xohlasangiz, qisqaroq variantni sinab ko'ring.";
    if (len > HARD_MAX) return "Sarlavha juda uzun. Qisqaroq va aniqroq variant yaxshiroq.";
    if (len > IDEAL_MAX) return "Yetarlicha batafsil sarlavha. Yana bir qisqaroq variant taklif qilamiz.";
    return "Sarlavhani yaxshilash uchun quyidagi variantni ko'rib chiqing.";
  }
  if (score >= 9) return "Название хорошее. Можно использовать или выбрать более короткий вариант ниже.";
  if (len > HARD_MAX) return "Название слишком длинное. Лучше короче — так удобнее в каталоге и поиске.";
  if (len > IDEAL_MAX) return "Достаточно подробное название. Предлагаем более короткий вариант.";
  return "Рекомендуем улучшить название — см. вариант ниже.";
}

function suggestWithRules(title, lang, brand, model, category) {
  const score = scoreTitle(title, brand, model);
  const suggested = buildRuleSuggestion(title, brand, model, category, lang);
  return {
    score: score,
    feedback: feedbackForScore(score, title.length, lang),
    suggested: suggested && suggested !== title ? suggested : "",
  };
}

function buildRuleSuggestion(title, brand, model, category, lang) {
  let text = title
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const parts = [];
  const categoryWord =
    lang === "uz"
      ? String(category || "").trim() || "Mahsulot"
      : categoryLabelRu(category) || "Товар";

  if (brand) parts.push(brand);
  else {
    const first = text.split(/[\s,]+/)[0];
    if (first && first.length <= 20) parts.push(first);
  }

  if (model) parts.push(model);

  const specs = [];
  const watt = text.match(/\b(\d{1,3})\s*W\b/i);
  if (watt) specs.push(watt[1] + "W");
  if (/gan/i.test(text)) specs.push("GaN");
  if (/usb-c/i.test(text)) specs.push("USB-C");
  if (/pd/i.test(text)) specs.push("PD");
  const ports = text.match(/(\d)\s*(?:порт|port|raz'?em|разъем)/i);
  if (ports) {
    specs.push(lang === "uz" ? ports[1] + " port" : ports[1] + " разъёма");
  }

  if (!brand && !model && parts.length < 2) {
    parts.unshift(categoryWord);
  }

  let out = parts.concat(specs.slice(0, 4)).join(", ").replace(/,\s*,/g, ",").trim();
  if (!out) out = text.slice(0, IDEAL_MAX).trim();
  if (out.length > IDEAL_MAX) out = out.slice(0, IDEAL_MAX - 1).trim() + "…";
  return out;
}

function categoryLabelRu(category) {
  const map = {
    phones: "Смартфон",
    laptops: "Ноутбук",
    tablets: "Планшет",
    accessories: "Аксессуар",
    audio: "Аудио",
    tv: "Телевизор",
  };
  return map[String(category || "").toLowerCase()] || "";
}

async function suggestWithGemini(apiKey, title, lang, brand, model, category) {
  const langLabel = lang === "uz" ? "Uzbek (Latin)" : "Russian";
  const prompt =
    "You optimize product titles for Emirate Co e-commerce in Uzbekistan (electronics & home goods).\n" +
    "Input title language focus: " +
    langLabel +
    ".\n" +
    "Brand: " +
    (brand || "(unknown)") +
    "\nModel: " +
    (model || "(unknown)") +
    "\nCategory: " +
    (category || "(unknown)") +
    "\nCurrent title: " +
    title +
    "\n\n" +
    "Return ONLY valid JSON:\n" +
    "{\n" +
    '  "score": 8,\n' +
    '  "feedback": "short hint in ' +
    (lang === "uz" ? "Uzbek" : "Russian") +
    '",\n' +
    '  "suggestedRu": "optimized Russian title",\n' +
    '  "suggestedUz": "optimized Uzbek Latin title"\n' +
    "}\n" +
    "Rules:\n" +
    "- score 1-10 (10 = ideal for marketplace SEO)\n" +
    "- suggested titles 45-90 chars, include brand + model + 2-4 key specs\n" +
    "- remove SKU codes in parentheses, redundant words\n" +
    "- no markdown, no quotes inside JSON values escape properly\n" +
    "- if current title is already good, suggestedRu/Uz can be slightly improved version\n" +
    "- feedback explains why (length, clarity) in " +
    (lang === "uz" ? "Uzbek" : "Russian");

  const geminiRes = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/" +
      encodeURIComponent(GEMINI_MODEL) +
      ":generateContent?key=" +
      encodeURIComponent(apiKey),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.25,
          maxOutputTokens: 600,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  const geminiJson = await geminiRes.json();
  if (!geminiRes.ok) {
    console.warn("[suggest-product-title] gemini", geminiRes.status, geminiJson);
    return null;
  }

  const text = extractGeminiText(geminiJson);
  const parsed = extractJson(text);
  if (!parsed || typeof parsed !== "object") return null;

  const score = Math.max(1, Math.min(10, Math.round(Number(parsed.score) || scoreTitle(title, brand, model))));
  const suggestedRu = String(parsed.suggestedRu || "").trim();
  const suggestedUz = String(parsed.suggestedUz || "").trim();
  const suggested = lang === "uz" ? suggestedUz || suggestedRu : suggestedRu || suggestedUz;
  const feedback =
    String(parsed.feedback || "").trim() || feedbackForScore(score, title.length, lang);

  if (!suggested) return null;

  return {
    score: score,
    feedback: feedback,
    suggested: suggested,
    suggestedRu: suggestedRu,
    suggestedUz: suggestedUz,
  };
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
