/**
 * Product title suggestions for admin (OpenAI + brand/model detection + rule fallback).
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

/** Common marketplace brands (fallback when admin brands list is empty). */
const KNOWN_BRANDS = [
  "Green Lion",
  "Apple",
  "Samsung",
  "Xiaomi",
  "Redmi",
  "POCO",
  "Huawei",
  "Honor",
  "Realme",
  "Oppo",
  "Vivo",
  "OnePlus",
  "Nokia",
  "Sony",
  "LG",
  "Asus",
  "Acer",
  "Lenovo",
  "HP",
  "Dell",
  "MSI",
  "Microsoft",
  "Google",
  "Nothing",
  "Tecno",
  "Infinix",
  "Itel",
  "UGREEN",
  "Baseus",
  "Anker",
  "JBL",
  "Beats",
  "Bose",
  "Marshall",
  "Xiaomi Redmi",
  "Garmin",
  "Amazfit",
  "Huawei Watch",
  "Samsung Galaxy",
  "Dyson",
  "Philips",
  "Bosch",
  "Tefal",
  "Remax",
  "Hoco",
  "Borofone",
  "Joyroom",
  "Poco",
  "iPhone",
  "MacBook",
  "iPad",
  "AirPods",
];

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
    const brandInput = String(body.brand || "").trim();
    const modelInput = String(body.model || "").trim();
    const category = String(body.category || "").trim();
    const brandsCatalog = normalizeBrandsCatalog(body.brands);

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
        detectedBrand: "",
        detectedModel: "",
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

    const detected = detectBrandAndModel(title, brandInput, modelInput, brandsCatalog);
    const brand = detected.brand;
    const model = detected.model;

    const openaiKey = String(process.env.OPENAI_API_KEY || "").trim();
    if (openaiKey) {
      const ai = await suggestWithOpenAI(openaiKey, title, lang, brand, model, category, brandsCatalog);
      if (ai) {
        const finalBrand = ai.detectedBrand || brand;
        const finalModel = ai.detectedModel || model;
        return res.status(200).json({
          ok: true,
          score: ai.score,
          charCount: title.length,
          feedback: sanitizeBrandFeedback(ai.feedback, title, finalBrand, lang),
          suggested: ai.suggested,
          suggestedUz: ai.suggestedUz || "",
          suggestedRu: ai.suggestedRu || "",
          source: "openai",
          model: OPENAI_MODEL,
          detectedBrand: finalBrand,
          detectedModel: finalModel,
        });
      }
    }

    const rules = suggestWithRules(title, lang, brand, model, category);
    return res.status(200).json({
      ok: true,
      score: rules.score,
      charCount: title.length,
      feedback: sanitizeBrandFeedback(rules.feedback, title, brand, lang),
      suggested: rules.suggested,
      suggestedRu: lang === "ru" ? rules.suggested : "",
      suggestedUz: lang === "uz" ? rules.suggested : "",
      source: "rules",
      detectedBrand: brand,
      detectedModel: model,
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

function normalizeBrandsCatalog(raw) {
  const list = [];
  const push = function (name) {
    const value = String(name || "").trim();
    if (!value || value.length < 2) return;
    if (list.some(function (item) { return item.toLowerCase() === value.toLowerCase(); })) return;
    list.push(value);
  };

  if (Array.isArray(raw)) {
    raw.forEach(function (item) {
      if (typeof item === "string") push(item);
      else if (item && typeof item === "object") {
        push(item.nameRu);
        push(item.nameUz);
        push(item.name);
      }
    });
  }

  KNOWN_BRANDS.forEach(push);
  list.sort(function (a, b) {
    return b.length - a.length;
  });
  return list;
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function titleIncludesBrand(title, brand) {
  if (!brand) return false;
  const re = new RegExp("(?:^|[^\\p{L}\\p{N}])" + escapeRegExp(brand) + "(?:[^\\p{L}\\p{N}]|$)", "iu");
  try {
    return re.test(title);
  } catch (_) {
    return title.toLowerCase().includes(brand.toLowerCase());
  }
}

function findBrandInTitle(title, brandsCatalog) {
  for (let i = 0; i < brandsCatalog.length; i++) {
    const brand = brandsCatalog[i];
    if (titleIncludesBrand(title, brand)) return brand;
  }
  return "";
}

function detectModelFromTitle(title, brand) {
  let work = String(title || "");
  if (brand) {
    work = work.replace(new RegExp(escapeRegExp(brand), "ig"), " ");
  }

  const patterns = [
    /\b([A-Z]{1,4}-?[A-Z]{0,3}\d{2,5}[A-Z0-9-]{0,8})\b/,
    /\b((?:iPhone|Galaxy|Redmi|POCO|MacBook|iPad|Watch)\s?[A-Za-z0-9.+-]{1,20})\b/i,
    /\b(Nexus(?:\s+[A-Z0-9-]{2,20})?)\b/i,
    /\b([A-Z]{2,}\s?\d{2,4}[A-Z]?)\b/,
    /\b(\d{1,2}\/\d{2,4}\s*(?:GB|TB)?)\b/i,
  ];

  for (let i = 0; i < patterns.length; i++) {
    const match = work.match(patterns[i]);
    if (!match) continue;
    const value = String(match[1] || "").trim();
    if (value.length < 2 || value.length > 40) continue;
    if (/^(USB|AMOLED|Bluetooth|IP\d+|GaN|PD)$/i.test(value)) continue;
    return value.replace(/\s+/g, " ");
  }

  // Fallback: token after brand (e.g. "Green Lion Nexus")
  if (brand) {
    const after = String(title || "").split(new RegExp(escapeRegExp(brand), "i"))[1] || "";
    const token = after
      .replace(/^[\s,.:;-]+/, "")
      .split(/[,\|/]| с | va | и /i)[0]
      .trim()
      .split(/\s+/)
      .slice(0, 3)
      .join(" ")
      .trim();
    if (token && token.length >= 2 && token.length <= 40 && !/^(умные|smart|часы|soat)/i.test(token)) {
      return token;
    }
  }
  return "";
}

function detectBrandAndModel(title, brandInput, modelInput, brandsCatalog) {
  let brand = String(brandInput || "").trim();
  let model = String(modelInput || "").trim();

  if (!brand) {
    brand = findBrandInTitle(title, brandsCatalog);
  } else if (!titleIncludesBrand(title, brand)) {
    const fromTitle = findBrandInTitle(title, brandsCatalog);
    if (fromTitle) brand = fromTitle;
  }

  if (!model) {
    model = detectModelFromTitle(title, brand);
  }

  return { brand: brand, model: model };
}

function sanitizeBrandFeedback(feedback, title, brand, lang) {
  let text = String(feedback || "").trim();
  if (!brand) return text;

  const brandInTitle = titleIncludesBrand(title, brand);
  if (!brandInTitle) return text;

  const missingBrandRe =
    /(brend\s*nomi\s*yo'?q|бренд(?:а)?\s*нет|нет\s*бренда|missing\s*brand|brand\s*(is\s*)?missing|без\s*бренда)/i;
  if (missingBrandRe.test(text)) {
    text =
      lang === "uz"
        ? "Brend topildi: " +
          brand +
          ". Sarlavhani biroz qisqartirish va asosiy xususiyatlarni aniqroq yozish mumkin."
        : "Бренд найден: " +
          brand +
          ". Можно чуть сократить название и выделить ключевые характеристики.";
  }
  return text;
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
  else if (brand && titleLc.includes(brandLc)) score += 0.5;
  if (model && model.length > 2 && !titleLc.includes(modelLc)) score -= 0.5;

  if (len >= 35 && len <= IDEAL_MAX) score += 0.5;

  return Math.max(1, Math.min(10, Math.round(score)));
}

function feedbackForScore(score, len, lang, brand) {
  if (lang === "uz") {
    if (brand) {
      if (score >= 9) return "Brend aniqlandi: " + brand + ". Sarlavha yaxshi — ishlatish mumkin.";
      if (len > HARD_MAX) return "Brend: " + brand + ". Sarlavha uzun — qisqaroq variant yaxshiroq.";
      return "Brend aniqlandi: " + brand + ". Sarlavhani biroz yaxshilash mumkin.";
    }
    if (score >= 9) return "Sarlavha yaxshi. Agar xohlasangiz, quyidagi variantni sinab ko'ring.";
    if (len > HARD_MAX) return "Sarlavha juda uzun. Qisqaroq va aniqroq variant yaxshiroq.";
    if (len > IDEAL_MAX) return "Yetarlicha batafsil sarlavha. Yana bir qisqaroq variant taklif qilamiz.";
    return "Sarlavhani yaxshilash uchun quyidagi variantni ko'rib chiqing.";
  }
  if (brand) {
    if (score >= 9) return "Бренд определён: " + brand + ". Название хорошее — можно использовать.";
    if (len > HARD_MAX) return "Бренд: " + brand + ". Название длинное — лучше короче.";
    return "Бренд определён: " + brand + ". Можно чуть улучшить формулировку.";
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
    feedback: feedbackForScore(score, title.length, lang, brand),
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
  if (/AMOLED/i.test(text)) specs.push("AMOLED");
  if (/IP\d+/i.test(text)) {
    const ip = text.match(/IP\d+/i);
    if (ip) specs.push(ip[0].toUpperCase());
  }
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
    "Смартфоны": "Смартфон",
    "Ноутбуки": "Ноутбук",
    "Планшеты": "Планшет",
  };
  return map[String(category || "")] || map[String(category || "").toLowerCase()] || "";
}

function buildTitlePrompt(title, lang, brand, model, category, brandsCatalog) {
  const langLabel = lang === "uz" ? "Uzbek (Latin)" : "Russian";
  const feedbackLang = lang === "uz" ? "Uzbek" : "Russian";
  const brandHints = brandsCatalog.slice(0, 40).join(", ");

  return (
    "Optimize product titles for Emirate Co e-commerce in Uzbekistan (electronics & home goods).\n" +
    "Style: like Yandex Market — clear score, short hint, and a better variant.\n\n" +
    "Input language focus: " +
    langLabel +
    "\n" +
    "Known brand from form/detector: " +
    (brand || "(not selected — extract from title)") +
    "\n" +
    "Known model from form/detector: " +
    (model || "(not selected — extract from title)") +
    "\n" +
    "Category: " +
    (category || "(unknown)") +
    "\n" +
    "Brand catalog hints: " +
    (brandHints || "Apple, Samsung, Green Lion, UGREEN, Xiaomi") +
    "\n" +
    "Current title: " +
    title +
    "\n\n" +
    "Return ONLY valid JSON:\n" +
    "{\n" +
    '  "score": 8,\n' +
    '  "feedback": "1-2 sentences in ' +
    feedbackLang +
    '",\n' +
    '  "detectedBrand": "brand name found in title or form",\n' +
    '  "detectedModel": "model/sku like GL-SW58 or Nexus",\n' +
    '  "suggestedRu": "optimized Russian marketplace title",\n' +
    '  "suggestedUz": "optimized Uzbek Latin marketplace title"\n' +
    "}\n\n" +
    "Rules:\n" +
    "- ALWAYS extract brand and model from the current title when possible (multi-word brands like Green Lion, Baseus, UGREEN count)\n" +
    "- NEVER say brand is missing if the brand text already appears in the title\n" +
    "- If brand is already in the title, say that brand was found and only suggest length/clarity improvements\n" +
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
    String(parsed.feedback || "").trim() || feedbackForScore(score, title.length, lang, brand);
  const detectedBrand = String(parsed.detectedBrand || brand || "").trim();
  const detectedModel = String(parsed.detectedModel || model || "").trim();

  if (!suggested && score < 9) return null;

  return {
    score: score,
    feedback: feedback,
    suggested: suggested,
    suggestedRu: suggestedRu,
    suggestedUz: suggestedUz,
    detectedBrand: detectedBrand,
    detectedModel: detectedModel,
  };
}

async function suggestWithOpenAI(apiKey, title, lang, brand, model, category, brandsCatalog) {
  const prompt = buildTitlePrompt(title, lang, brand, model, category, brandsCatalog);

  const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + apiKey,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.2,
      max_tokens: 800,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are an expert e-commerce copywriter for Uzbekistan marketplaces. " +
            "You always detect brand/model from the product title when present. " +
            "Never claim the brand is missing if it is written in the title. " +
            "Always respond with valid JSON only.",
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
