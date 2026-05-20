/**
 * Vercel serverless: NBU USD sell rate (курс продажи) from nbu.uz
 */
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=300");

  const urls = [
    "https://nbu.uz/en/",
    "https://nbu.uz/en/for-individuals-exchange-rates",
    "https://nbu.uz/uz/",
  ];

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "EmirateCo-Store/1.0",
          Accept: "text/html,application/xhtml+xml",
        },
      });
      if (!response.ok) continue;
      const html = await response.text();
      const rate = parseNbuUsdSellFromHtml(html);
      if (rate > 0) {
        return res.status(200).json({
          ok: true,
          rate,
          currency: "USD",
          source: "nbu.uz",
          fetchedAt: new Date().toISOString(),
        });
      }
    } catch (_) {
      // try next URL
    }
  }

  return res.status(200).json({
    ok: true,
    rate: FALLBACK_USD_SELL,
    currency: "USD",
    source: "fallback",
    stale: true,
    message: "Не удалось получить курс с nbu.uz — используется запасной курс",
    fetchedAt: new Date().toISOString(),
  });
};

function parseNbuUsdSellFromHtml(html) {
  const text = String(html || "");
  const patterns = [
    /USD\s+Buying:\s*([\d\s]+)[\s\S]{0,40}?Selling:\s*([\d\s]+)/i,
    /USD\s+Buying:\s*[\d\s]+\s*[^\d]*Selling:\s*([\d\s]+)/i,
    /USD[\s\S]{0,120}?Selling:\s*([\d\s]+)/i,
    /USD[\s\S]{0,200}?US\s+Dollar[\s\S]{0,120}?(\d[\d\s]{3,7})[\s\S]{0,80}?(\d[\d\s]{3,7})/i,
    /"USD"[^}]*"sale"[^}]*"value"\s*:\s*"?([\d.]+)"?/i,
    /"code"\s*:\s*"USD"[\s\S]{0,200}?"sale"\s*:\s*"?([\d.]+)"?/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const raw =
      match[2] != null && /Buying|US\s+Dollar/i.test(pattern.source) ? match[2] : match[1];
    const rate = Number(String(raw || "").replace(/\s+/g, "").replace(/[^\d]/g, ""));
    if (rate >= 10000 && rate <= 20000) return rate;
  }
  return 0;
}

const FALLBACK_USD_SELL = 12120;
