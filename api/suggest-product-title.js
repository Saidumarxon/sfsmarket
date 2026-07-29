/**
 * Product title suggestions for admin (OpenAI ChatGPT + rule fallback).
 * POST /api/suggest-product-title
 * Env: OPENAI_API_KEY, OPENAI_MODEL (default gpt-4o-mini)
 */
const OPENAI_MODEL = String(process.env.OPENAI_MODEL || "gpt-4o-mini").trim();
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

    const openaiKey = String(process.env.OPENAI_API_KEY || "").trim();
    if (openaiKey) {
      const ai = await suggestWithOpenAI(openaiKey, title, lang, brand, model, category);
      if (ai) {
        return res.status(200).json({
          ok: true,
          score: ai.score,
          charCount: title.length,
          feedback: ai.feedback,
          suggested: ai.suggested,
          suggestedUz: ai.suggestedUz || "",
          suggestedRu: ai.suggestedRu || "",
          source: "openai",
          model: OPENAI_MODEL,
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
    if (score >= 9) return "Sarlavha yaxshi. Agar xohlasangiz, quyidagi variantni sinab ko'ring.";
    if (len > HARD_MAX) return "Sarlavha juda uzun. Qisqaroq va aniqroq variant yaxshiroq.";
    if (len > IDEAL_MAX) return "Yetarlicha batafsil sarlavha. Yana bir qisqaroq variant taklif qilamiz.";
    return "Sarlavhani yaxshilash uchun quyidagi variantni ko'rib chiqing.";
  }
  if (score >= 9) return "Название хорошее — можно использовать. Ниже альтернатива, если нужна короче.";
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
  const ports = text.match(/(\d)\s*(?:порт|port|raz'?em|razem|разъем)/i);
  if (ports) {
    specs.push(lang === "uz" ? ports[1] + " port" : ports[1] + " razem");
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

function buildTitlePrompt(title, lang, brand, model, category) {
  const langLabel = lang === "uz" ? "Uzbek (Latin)" : "Russian";
  const feedbackLang = lang === "uz" ? "Uzbek" : "Russian";

  return (
    "Optimize product titles for Emirate Co e-commerce in Uzbekistan (electronics & home goods).\n" +
    "Style: like Yandex Market — clear score, short hint if the title is good or needs work, and a better variant.\n\n" +
    "Input language focus: " +
    langLabel +
    "\n" +
    "Brand: " +
    (brand || "(unknown)") +
    "\n" +
    "Model: " +
    (model || "(unknown)") +
    "\n" +
    "Category: " +
    (category || "(unknown)") +
    "\n" +
    "Current title: " +
    title +
    "\n\n" +
    "Return ONLY valid JSON:\n" +
    "{\n" +
    '  "score": 8,\n' +
    '  "feedback": "1-2 sentences in ' +
    feedbackLang +
    ' — explain if current title is OK to use or what to fix (length, clarity, missing brand)",\n' +
    '  "suggestedRu": "optimized Russian marketplace title",\n' +
    '  "suggestedUz": "optimized Uzbek Latin marketplace title"\n' +
    "}\n\n" +
    "Rules:\n" +
    "- score 1-10 (10 = ideal for marketplace SEO and customer search)\n" +
    "- suggested titles 45-90 characters: brand + model + 2-4 key specs\n" +
    "- remove SKU codes in parentheses, redundant words, ALL CAPS\n" +
    "- if current title is already excellent (score 9-10), feedback must say it is good to use; still offer a slightly polished variant\n" +
    "- feedback must be in " +
    feedbackLang +
    " only"
  );
}

function parseAiSuggestion(parsed, title, lang, brand, model) {
  if (!parsed || typeof parsed !== "object") return null;

  const score = Math.max(1, Math.min(10, Math.round(Number(parsed.score) || scoreTitle(title, brand, model))));
  const suggestedRu = String(parsed.suggestedRu || "").trim();
  const suggestedUz = String(parsed.suggestedUz || "").trim();
  const suggested = lang === "uz" ? suggestedUz || suggestedRu : suggestedRu || suggestedUz;
  const feedback =
    String(parsed.feedback || "").trim() || feedbackForScore(score, title.length, lang);

  if (!suggested && score < 9) return null;

  return {
    score: score,
    feedback: feedback,
    suggested: suggested,
    suggestedRu: suggestedRu,
    suggestedUz: suggestedUz,
  };
}

async function suggestWithOpenAI(apiKey, title, lang, brand, model, category) {
  const prompt = buildTitlePrompt(title, lang, brand, model, category);

  const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + apiKey,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.25,
      max_tokens: 700,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are an expert e-commerce copywriter for Uzbekistan marketplaces. Always respond with valid JSON only.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  const openaiJson = await openaiRes.json();
  if (!openaiRes.ok) {
    console.warn("[suggest-product-title] openai", openaiRes.status, openaiJson);
    return null;
  }

  const text =
    openaiJson &&
    openaiJson.choices &&
    openaiJson.choices[0] &&
    openaiJson.choices[0].message &&
    openaiJson.choices[0].message.content;

  const parsed = extractJson(text);
  return parseAiSuggestion(parsed, title, lang, brand, model);
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
