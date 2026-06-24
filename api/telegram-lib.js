/**
 * Emirate Co — Telegram bot helpers (catalog search via Supabase).
 */
const SITE = String(process.env.EMIRATE_SITE_URL || "https://www.emirateco.uz").replace(/\/+$/, "");
const SUPABASE_URL = String(process.env.SUPABASE_URL || "https://efoujwgalbnfrodgkqyl.supabase.co").replace(/\/+$/, "");
const DEFAULT_SUPABASE_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmb3Vqd2dhbGJuZnJvZGdrcXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2NjM0MDcsImV4cCI6MjA5NDIzOTQwN30.NbE5q-vi1YTlp7hGvGZmRGZgjnv2SW1S6kYfQMT5KBU";
const SUPABASE_ANON = String(process.env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON).trim();
const BOT_TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
const WEBHOOK_SECRET = String(process.env.TELEGRAM_WEBHOOK_SECRET || "").trim();
const PHONE = String(process.env.EMIRATE_CONTACT_PHONE || "+998508868844").trim();
const MARKUP = 1.2;
const CACHE_MS = 5 * 60 * 1000;
const OG_IMAGE = SITE + "/images/og-emirate.png?v=3";

/** Русские/узбекские запросы → латиница в каталоге */
const SEARCH_SYNONYMS = {
  айфон: "iphone",
  айпад: "ipad",
  аймак: "imac",
  макбук: "macbook",
  эпл: "apple",
  apple: "apple",
  самсунг: "samsung",
  сеймсунг: "samsung",
  galaxy: "galaxy",
  хуавей: "huawei",
  huavey: "huawei",
  сяоми: "xiaomi",
  ксиоми: "xiaomi",
  redmi: "redmi",
  редми: "redmi",
  honor: "honor",
  хонор: "honor",
  oppo: "oppo",
  оппо: "oppo",
  vivo: "vivo",
  виво: "vivo",
  noutbuk: "noutbuk",
  ноутбук: "noutbuk",
  телевизор: "tv",
  телек: "tv",
  наушники: "audio",
  smartfon: "smartfon",
  смартфон: "smartfon",
};

function expandSearchKeys(query) {
  const key = normalizeKey(query);
  if (!key) return [];
  const keys = [key];
  Object.keys(SEARCH_SYNONYMS).forEach(function (ru) {
    if (key.includes(ru)) {
      const en = normalizeKey(SEARCH_SYNONYMS[ru]);
      if (en && keys.indexOf(en) === -1) keys.push(en);
    }
  });
  if (SEARCH_SYNONYMS[key]) {
    const en = normalizeKey(SEARCH_SYNONYMS[key]);
    if (en && keys.indexOf(en) === -1) keys.push(en);
  }
  return keys;
}

function scoreProductMatch(product, keys) {
  const hay = productSearchHay(product);
  let best = 0;
  keys.forEach(function (key) {
    if (!key || key.length < 2 || !hay.includes(key)) return;
    let score = 1;
    if (normalizeKey(product.title).includes(key)) score += 3;
    if (normalizeKey(product.brand).includes(key)) score += 3;
    if (normalizeKey(product.model).includes(key)) score += 2;
    if (hay.startsWith(key)) score += 2;
    if (score > best) best = score;
  });
  return best;
}

let productsCache = { at: 0, items: [] };

function parseMoney(value) {
  return Number(String(value || "").replace(/\s+/g, "").replace(/[^\d]/g, "")) || 0;
}

function formatSum(amount) {
  const n = Math.round(Number(amount) || 0);
  if (!n) return "—";
  return n.toLocaleString("ru-RU") + " сум";
}

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/gb\b/g, "")
    .replace(/[^a-zа-яё0-9]+/gi, "");
}

function productUrl(title) {
  return SITE + "/product?product=" + encodeURIComponent(String(title || "").trim());
}

function mapRow(row) {
  if (!row) return null;
  const payload = row.payload && typeof row.payload === "object" ? row.payload : {};
  const title = String(row.title || payload.nameRu || payload.nameUz || "").trim();
  if (!title) return null;
  const basePrice = parseMoney(payload.price);
  const price = basePrice > 0 ? Math.round(basePrice * MARKUP) : 0;
  const oldBase = parseMoney(payload.oldPrice);
  const oldPrice = oldBase > 0 ? Math.round(oldBase * MARKUP) : 0;
  return {
    title,
    brand: String(payload.brand || "").trim(),
    model: String(payload.model || "").trim(),
    category: String(payload.category || "").trim(),
    nameRu: String(payload.nameRu || "").trim(),
    nameUz: String(payload.nameUz || "").trim(),
    price,
    oldPrice: oldPrice > price ? oldPrice : 0,
    url: productUrl(title),
  };
}

async function fetchProducts() {
  if (Date.now() - productsCache.at < CACHE_MS && productsCache.items.length) {
    return productsCache.items;
  }
  if (!SUPABASE_ANON) return [];
  const endpoint =
    SUPABASE_URL +
    "/rest/v1/products?status=eq.active&select=title,payload,priority&order=priority.asc&limit=5000";
  const res = await fetch(endpoint, {
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: "Bearer " + SUPABASE_ANON,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    console.error("[telegram-lib] fetchProducts", res.status, await res.text().catch(function () { return ""; }));
    return productsCache.items;
  }
  const rows = await res.json();
  if (!Array.isArray(rows)) return productsCache.items;
  productsCache = {
    at: Date.now(),
    items: rows.map(mapRow).filter(Boolean),
  };
  return productsCache.items;
}

function productSearchHay(product) {
  return normalizeKey(
    [product.title, product.brand, product.model, product.category, product.nameRu, product.nameUz].join(" ")
  );
}

function searchProducts(query, limit) {
  const max = limit || 5;
  const keys = expandSearchKeys(query);
  if (!keys.length || keys[0].length < 2) return [];
  const items = productsCache.items.length ? productsCache.items : [];
  const scored = [];
  for (let i = 0; i < items.length; i++) {
    const p = items[i];
    const score = scoreProductMatch(p, keys);
    if (!score) continue;
    scored.push({ product: p, score: score });
  }
  scored.sort(function (a, b) {
    return b.score - a.score || a.product.title.localeCompare(b.product.title, "ru");
  });
  return scored.slice(0, max).map(function (entry) {
    return entry.product;
  });
}

async function tgApi(method, body) {
  if (!BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN missing");
  const res = await fetch("https://api.telegram.org/bot" + BOT_TOKEN + "/" + method, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(function () {
    return {};
  });
  if (!data.ok) {
    throw new Error(data.description || "Telegram API error");
  }
  return data.result;
}

async function sendMessage(chatId, text, extra) {
  return tgApi("sendMessage", Object.assign({ chat_id: chatId, text: text }, extra || {}));
}

async function sendPhoto(chatId, photo, extra) {
  return tgApi("sendPhoto", Object.assign({ chat_id: chatId, photo: photo }, extra || {}));
}

async function sendCatalogCard(chatId) {
  await sendPhoto(chatId, OG_IMAGE, {
    caption:
      "<b>Каталог Emirate Co</b>\n\n" +
      "Смартфоны, ноутбуки, ТВ и бытовая техника с доставкой по Узбекистану.",
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [[{ text: "📱 Открыть каталог", url: SITE + "/catalog" }]],
    },
  });
}

async function sendSiteCard(chatId) {
  await sendPhoto(chatId, OG_IMAGE, {
    caption: "<b>Emirate Co</b>\n\n" + SITE,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [[{ text: "🌐 Открыть сайт", url: SITE }]],
    },
  });
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function welcomeText() {
  return (
    "Добро пожаловать в <b>Emirate Co</b>!\n\n" +
    "Я помогу найти товары в нашем каталоге.\n\n" +
    "• Напишите название — <i>айфон</i>, <i>Samsung</i>, <i>MacBook</i>\n" +
    "• /catalog — каталог на сайте\n" +
    "• /contact — телефон и адрес\n" +
    "• /help — подсказки"
  );
}

function contactText() {
  return (
    "<b>Emirate Co</b>\n\n" +
    "📞 <a href=\"tel:" + PHONE + "\">" + PHONE + "</a>\n" +
    "🌐 <a href=\"" + SITE + "\">" + SITE + "</a>\n" +
    "📱 <a href=\"" + SITE + "/catalog\">Каталог</a>"
  );
}

function mainKeyboard() {
  return {
    keyboard: [
      [{ text: "🔍 Поиск товара" }, { text: "📱 Каталог" }],
      [{ text: "📞 Контакты" }, { text: "🌐 Сайт" }],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

function buildSearchReply(products) {
  if (!products.length) {
    return {
      text: "Ничего не найдено.\n\nПопробуйте другое название.",
      extra: {
        reply_markup: {
          inline_keyboard: [[{ text: "📱 Открыть каталог", url: SITE + "/catalog" }]],
        },
      },
    };
  }
  let text = "Найдено: <b>" + products.length + "</b>\n\n";
  const keyboard = [];
  products.forEach(function (p, index) {
    text += "<b>" + (index + 1) + ".</b> " + escapeHtml(p.title) + "\n";
    text += "💰 " + formatSum(p.price);
    if (p.oldPrice > p.price) {
      text += " <s>" + formatSum(p.oldPrice) + "</s>";
    }
    text += "\n\n";
    keyboard.push([{ text: "🛒 " + truncate(p.title, 28), url: p.url }]);
  });
  text += "Откройте весь каталог на сайте.";
  return {
    text: text,
    extra: {
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: keyboard.concat([[{ text: "📱 Весь каталог", url: SITE + "/catalog" }]]),
      },
    },
  };
}

function truncate(text, max) {
  const s = String(text || "").trim();
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

async function handleCommand(chatId, command, args) {
  const cmd = String(command || "").toLowerCase();
  if (cmd === "start" || cmd === "help") {
    await sendMessage(chatId, welcomeText(), {
      parse_mode: "HTML",
      reply_markup: mainKeyboard(),
    });
    return;
  }
  if (cmd === "catalog") {
    await sendCatalogCard(chatId);
    return;
  }
  if (cmd === "contact") {
    await sendMessage(chatId, contactText(), { parse_mode: "HTML", disable_web_page_preview: true });
    return;
  }
  if (cmd === "search") {
    const query = String(args || "").trim();
    if (!query) {
      await sendMessage(chatId, "Напишите запрос: /search iPhone\n\nИли просто отправьте название товара.");
      return;
    }
    await runSearch(chatId, query);
    return;
  }
  await sendMessage(chatId, "Неизвестная команда. Напишите /help");
}

async function runSearch(chatId, query) {
  const items = await fetchProducts();
  if (!items.length) {
    await sendMessage(chatId, "Каталог временно недоступен. Попробуйте позже.", {
      disable_web_page_preview: true,
    });
    return;
  }
  const products = searchProducts(query, 5);
  const reply = buildSearchReply(products);
  await sendMessage(chatId, reply.text, reply.extra || { parse_mode: "HTML", disable_web_page_preview: true });
}

async function handleText(chatId, text) {
  const raw = String(text || "").trim();
  if (!raw) return;
  if (raw === "🔍 Поиск товара") {
    await sendMessage(chatId, "Напишите название товара, например: айфон, iPhone 17 или Samsung S26");
    return;
  }
  if (raw === "📱 Каталог") {
    await handleCommand(chatId, "catalog", "");
    return;
  }
  if (raw === "📞 Контакты") {
    await handleCommand(chatId, "contact", "");
    return;
  }
  if (raw === "🌐 Сайт") {
    await sendSiteCard(chatId);
    return;
  }
  if (raw.startsWith("/")) {
    const parts = raw.split(/\s+/);
    const command = parts[0].slice(1);
    const args = parts.slice(1).join(" ");
    await handleCommand(chatId, command, args);
    return;
  }
  await runSearch(chatId, raw);
}

async function handleUpdate(update) {
  const message = update && update.message;
  if (!message || !message.chat) return;
  const chatId = message.chat.id;
  const text = message.text || message.caption || "";
  if (!text && !message.contact) return;
  await handleText(chatId, text);
}

async function registerWebhook(publicUrl) {
  const url = String(publicUrl || SITE + "/api/telegram-webhook").trim();
  const body = {
    url: url,
    allowed_updates: ["message"],
    drop_pending_updates: true,
  };
  if (WEBHOOK_SECRET) body.secret_token = WEBHOOK_SECRET;
  return tgApi("setWebhook", body);
}

async function registerCommands() {
  return tgApi("setMyCommands", {
    commands: [
      { command: "start", description: "Начать" },
      { command: "catalog", description: "Каталог на сайте" },
      { command: "search", description: "Поиск товара" },
      { command: "contact", description: "Контакты" },
      { command: "help", description: "Помощь" },
    ],
  });
}

async function getWebhookInfo() {
  return tgApi("getWebhookInfo", {});
}

function verifyWebhookSecret(req) {
  if (!WEBHOOK_SECRET) return true;
  const header = req.headers["x-telegram-bot-api-secret-token"] || req.headers["X-Telegram-Bot-Api-Secret-Token"];
  return String(header || "") === WEBHOOK_SECRET;
}

module.exports = {
  BOT_TOKEN,
  WEBHOOK_SECRET,
  SITE,
  SUPABASE_ANON,
  handleUpdate,
  registerWebhook,
  registerCommands,
  getWebhookInfo,
  verifyWebhookSecret,
  fetchProducts,
  searchProducts,
};
