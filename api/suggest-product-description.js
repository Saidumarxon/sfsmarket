/**
 * Product description AI fill for admin (OpenAI + template fallback).
 * POST /api/suggest-product-description
 */
const OPENAI_MODEL = String(process.env.OPENAI_MODEL || "gpt-4o-mini").trim();
const memoryHits = new Map();
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 40;

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const nameRu = String(body.nameRu || body.title || "").trim();
    const nameUz = String(body.nameUz || "").trim();
    const brand = String(body.brand || "").trim();
    const model = String(body.model || "").trim();
    const category = String(body.category || "").trim();

    if (nameRu.length < 4 && nameUz.length < 4) {
      return res.status(200).json({
        ok: false,
        error: "name_required",
        message: "Avval mahsulot nomini kiriting.",
      });
    }

    const quota = consumeRateLimit(req);
    if (!quota.allowed) {
      return res.status(429).json({ ok: false, error: "rate_limited", retryAfterSec: quota.retryAfterSec });
    }

    const openaiKey = String(process.env.OPENAI_API_KEY || "").trim();
    if (openaiKey) {
      const ai = await suggestWithOpenAI(openaiKey, { nameRu, nameUz, brand, model, category });
      if (ai) {
        return res.status(200).json(Object.assign({ ok: true, source: "openai", model: OPENAI_MODEL }, ai));
      }
    }

    const fallback = suggestWithTemplate({ nameRu, nameUz, brand, model, category });
    return res.status(200).json(Object.assign({ ok: true, source: "template" }, fallback));
  } catch (err) {
    console.error("[suggest-product-description]", err);
    return res.status(500).json({ ok: false, error: String(err && err.message ? err.message : err) });
  }
};

function getClientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || String(req.headers["x-real-ip"] || "unknown").trim();
}

function consumeRateLimit(req) {
  const key = "desc:" + getClientIp(req);
  const now = Date.now();
  const hits = (memoryHits.get(key) || []).filter(function (t) {
    return t > now - RATE_WINDOW_MS;
  });
  if (hits.length >= RATE_MAX) {
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((hits[0] + RATE_WINDOW_MS - now) / 1000)) };
  }
  hits.push(now);
  memoryHits.set(key, hits);
  return { allowed: true, retryAfterSec: 0 };
}

function buildPrompt(input) {
  return (
    "Generate product page content for Emirate Co e-commerce in Uzbekistan.\n\n" +
    "Product name Ru: " +
    (input.nameRu || "(unknown)") +
    "\nProduct name Uz: " +
    (input.nameUz || input.nameRu || "(unknown)") +
    "\nBrand: " +
    (input.brand || "(unknown)") +
    "\nModel: " +
    (input.model || "(unknown)") +
    "\nCategory: " +
    (input.category || "(unknown)") +
    "\n\nReturn ONLY valid JSON:\n" +
    "{\n" +
    '  "descRu": "HTML description in Russian — 2-4 paragraphs, bullet list of key specs, FAQ section with 2 questions",\n' +
    '  "descUz": "HTML description in Uzbek Latin — same structure",\n' +
    '  "seoTitleRu": "SEO title up to 60 chars",\n' +
    '  "seoDescRu": "SEO meta description up to 155 chars",\n' +
    '  "seoTitleUz": "SEO title Uzbek",\n' +
    '  "seoDescUz": "SEO meta description Uzbek",\n' +
    '  "specs": [\n' +
    '    {"keyRu":"Модель","keyUz":"Model","valueRu":"...","valueUz":"..."}\n' +
    "  ]\n" +
    "}\n\n" +
    "Rules:\n" +
    "- Use only HTML tags: p, strong, em, ul, ol, li, h3, br\n" +
    "- No markdown, no outer html/body\n" +
    "- Be factual; do not invent exact specs if unknown — use generic placeholders\n" +
    "- FAQ heading Ru: Часто задаваемые вопросы; Uz: Ko'p beriladigan savollar (FAQ)\n" +
    "- specs: 4-8 rows with bilingual keys/values relevant to category\n" +
    "- descRu and descUz are BOTH required — never leave descRu empty\n" +
    "- Write descRu first, then descUz\n" +
    "- Each description 90-150 words, not longer"
  );
}

async function suggestWithOpenAI(apiKey, input) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + apiKey,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.35,
      max_tokens: 4000,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are an expert e-commerce copywriter for electronics retail in Uzbekistan. Always write BOTH Russian and Uzbek. Return valid JSON only.",
        },
        { role: "user", content: buildPrompt(input) },
      ],
    }),
  });

  const json = await res.json();
  if (!res.ok) {
    console.warn("[suggest-product-description] openai", res.status, json);
    return null;
  }

  const text = json && json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
  const parsed = extractJson(text);
  if (!parsed) return null;
  let payload = normalizePayload(parsed, input);
  if (payload && (!payload.descRu || !payload.descUz)) {
    payload = await fillMissingLanguage(apiKey, payload, input);
  }
  return payload;
}

function pickDesc(parsed, keys) {
  for (let i = 0; i < keys.length; i++) {
    const value = sanitizeHtml(String(parsed[keys[i]] || "").trim());
    if (value) return value;
  }
  return "";
}

async function fillMissingLanguage(apiKey, payload, input) {
  const missing = !payload.descRu ? "ru" : "uz";
  const source = missing === "ru" ? payload.descUz : payload.descRu;
  if (!source) return payload;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + apiKey,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.2,
        max_tokens: 1800,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "Translate e-commerce product HTML. Keep the same HTML tags. Return valid JSON only.",
          },
          {
            role: "user",
            content:
              missing === "ru"
                ? 'Translate this Uzbek product HTML into natural Russian. Return {"descRu":"..."}.\n\n' + source
                : 'Translate this Russian product HTML into Uzbek Latin. Return {"descUz":"..."}.\n\n' + source,
          },
        ],
      }),
    });
    const json = await res.json().catch(function () {
      return null;
    });
    const text = json && json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
    const parsed = extractJson(text);
    if (!parsed) return payload;
    if (missing === "ru") {
      payload.descRu = sanitizeHtml(String(parsed.descRu || parsed.text || "").trim()) || payload.descRu;
    } else {
      payload.descUz = sanitizeHtml(String(parsed.descUz || parsed.text || "").trim()) || payload.descUz;
    }
  } catch (err) {
    console.warn("[suggest-product-description] fillMissingLanguage", err && err.message ? err.message : err);
  }
  return payload;
}

function normalizePayload(parsed, input) {
  const descRu = pickDesc(parsed, ["descRu", "descriptionRu", "ru", "description_ru"]);
  const descUz = pickDesc(parsed, ["descUz", "descriptionUz", "uz", "description_uz"]);
  if (!descRu && !descUz) return null;

  const specs = Array.isArray(parsed.specs)
    ? parsed.specs
        .map(function (row) {
          return {
            keyRu: String(row.keyRu || row.key || "").trim(),
            keyUz: String(row.keyUz || "").trim(),
            valueRu: String(row.valueRu || row.value || "").trim(),
            valueUz: String(row.valueUz || "").trim(),
          };
        })
        .filter(function (row) {
          return (row.keyRu || row.keyUz) && (row.valueRu || row.valueUz);
        })
    : [];

  return {
    descRu: descRu,
    descUz: descUz,
    seoTitleRu: String(parsed.seoTitleRu || input.nameRu || "").trim().slice(0, 70),
    seoDescRu: String(parsed.seoDescRu || "").trim().slice(0, 160),
    seoTitleUz: String(parsed.seoTitleUz || input.nameUz || input.nameRu || "").trim().slice(0, 70),
    seoDescUz: String(parsed.seoDescUz || "").trim().slice(0, 160),
    specs: specs,
  };
}

function suggestWithTemplate(input) {
  const titleRu = input.nameRu || input.nameUz || "Товар";
  const titleUz = input.nameUz || input.nameRu || "Mahsulot";
  const brandLine = input.brand ? "<strong>" + escapeHtml(input.brand) + "</strong>" : "";
  const modelLine = input.model ? escapeHtml(input.model) : "";

  const descRu =
    "<p>" +
    escapeHtml(titleRu) +
    " — качественный товар" +
    (input.brand ? " от бренда " + brandLine : "") +
    (input.category ? " в категории " + escapeHtml(input.category) : "") +
    ".</p>" +
    "<ul><li>Оригинальная продукция</li><li>Доставка по Узбекистану</li><li>Рассрочка 0-0-12</li></ul>" +
    "<h3>Часто задаваемые вопросы (FAQ)</h3>" +
    "<p><strong>Есть ли гарантия?</strong><br>Да, на товар действует официальная гарантия.</p>";

  const descUz =
    "<p>" +
    escapeHtml(titleUz) +
    " — ishonchli mahsulot" +
    (input.brand ? ", brend: " + brandLine : "") +
    ".</p>" +
    "<ul><li>Original mahsulot</li><li>O'zbekiston bo'ylab yetkazib berish</li><li>0-0-12 muddatli to'lov</li></ul>" +
    "<h3>Ko'p beriladigan savollar (FAQ)</h3>" +
    "<p><strong>Kafolat bormi?</strong><br>Ha, rasmiy kafolat mavjud.</p>";

  const specs = [];
  if (input.brand) specs.push({ keyRu: "Бренд", keyUz: "Brend", valueRu: input.brand, valueUz: input.brand });
  if (input.model) specs.push({ keyRu: "Модель", keyUz: "Model", valueRu: input.model, valueUz: input.model });
  if (input.category) specs.push({ keyRu: "Категория", keyUz: "Kategoriya", valueRu: input.category, valueUz: input.category });

  return {
    descRu: descRu,
    descUz: descUz,
    seoTitleRu: (titleRu + " — купить в Emirate Co").slice(0, 70),
    seoDescRu: (titleRu + ". Доставка и рассрочка по Узбекистану.").slice(0, 160),
    seoTitleUz: (titleUz + " — Emirate Co").slice(0, 70),
    seoDescUz: (titleUz + ". Yetkazib berish va muddatli to'lov.").slice(0, 160),
    specs: specs,
  };
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sanitizeHtml(html) {
  let out = String(html || "");
  out = out.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
  out = out.replace(/on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  out = out.replace(/<(?!(\/)?(p|br|strong|em|ul|ol|li|h3)\b)[^>]+>/gi, "");
  return out.trim();
}

function extractJson(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_) {}
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch (_) {}
  }
  return null;
}
