/**
 * Visual product search — Gemini Flash AI (server) + MobileNet fallback (browser).
 */
(function () {
  var EMB_CACHE_KEY = "emirate_img_embeddings_v1";
  var QUERY_KEY = "emirate_photo_search_query";
  var QUOTA_KEY = "emirate_photo_search_quota";
  var QUOTA_LIMIT = 3;
  var QUOTA_WINDOW_MS = 5 * 60 * 1000;
  var MIN_SCORE = 0.28;
  var MAX_CACHE = 240;
  var MAX_PRODUCTS = 80;
  var MAX_IMAGES_PER_PRODUCT = 2;

  var modelPromise = null;

  function loadQuotaHits() {
    try {
      var raw = localStorage.getItem(QUOTA_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function saveQuotaHits(hits) {
    try {
      localStorage.setItem(QUOTA_KEY, JSON.stringify(hits || []));
    } catch (_) {}
  }

  function pruneQuotaHits(hits) {
    var now = Date.now();
    var cutoff = now - QUOTA_WINDOW_MS;
    return (hits || []).filter(function (time) {
      return Number(time) > cutoff;
    }).sort(function (a, b) {
      return Number(a) - Number(b);
    });
  }

  function syncQuotaFromSuccess(remaining, limit) {
    var max = Number(limit) || QUOTA_LIMIT;
    var left = Number(remaining);
    if (!Number.isFinite(left)) {
      var hits = pruneQuotaHits(loadQuotaHits());
      hits.push(Date.now());
      saveQuotaHits(hits);
      return;
    }
    var used = Math.max(0, max - left);
    var hits = pruneQuotaHits(loadQuotaHits());
    while (hits.length < used) {
      hits.push(Date.now());
    }
    while (hits.length > used) {
      hits.shift();
    }
    saveQuotaHits(hits);
  }

  function syncQuotaFromBlocked(retryAfterSec) {
    var retryMs = Math.max(1, Number(retryAfterSec) || 1) * 1000;
    var oldest = Date.now() - (QUOTA_WINDOW_MS - retryMs);
    var hits = [];
    for (var i = 0; i < QUOTA_LIMIT; i++) {
      hits.push(oldest + i * 1000);
    }
    saveQuotaHits(pruneQuotaHits(hits));
  }

  function getPhotoSearchQuota() {
    var hits = pruneQuotaHits(loadQuotaHits());
    saveQuotaHits(hits);
    var remaining = Math.max(0, QUOTA_LIMIT - hits.length);
    var retryAfterSec = 0;
    if (remaining === 0 && hits.length) {
      retryAfterSec = Math.max(1, Math.ceil((Number(hits[0]) + QUOTA_WINDOW_MS - Date.now()) / 1000));
    }
    return {
      limit: QUOTA_LIMIT,
      remaining: remaining,
      retryAfterSec: retryAfterSec,
      blocked: remaining === 0 && retryAfterSec > 0,
    };
  }

  function recordPhotoSearchHit() {
    var hits = pruneQuotaHits(loadQuotaHits());
    hits.push(Date.now());
    saveQuotaHits(hits);
    return getPhotoSearchQuota();
  }

  function assertPhotoSearchAllowed() {
    var quota = getPhotoSearchQuota();
    if (!quota.blocked) return quota;
    var err = new Error("rate_limit_exceeded");
    err.retryAfterSec = quota.retryAfterSec;
    err.quota = quota;
    throw err;
  }

  function formatPhotoSearchRetry(seconds) {
    var total = Math.max(0, Number(seconds) || 0);
    var mins = Math.floor(total / 60);
    var secs = total % 60;
    return String(mins).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (document.querySelector('script[src="' + src + '"]')) {
        resolve();
        return;
      }
      var s = document.createElement("script");
      s.src = src;
      s.onload = function () {
        resolve();
      };
      s.onerror = function () {
        reject(new Error("script_load_failed"));
      };
      document.head.appendChild(s);
    });
  }

  async function getModel() {
    if (!modelPromise) {
      modelPromise = (async function () {
        await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js");
        await loadScript(
          "https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.1/dist/mobilenet.min.js"
        );
        if (window.tf && window.tf.ready) {
          await window.tf.ready();
        }
        if (!window.mobilenet || !window.mobilenet.load) {
          throw new Error("mobilenet_unavailable");
        }
        return window.mobilenet.load({ version: 2, alpha: 0.75 });
      })();
    }
    return modelPromise;
  }

  function cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    var dot = 0;
    var na = 0;
    var nb = 0;
    for (var i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    if (!na || !nb) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
  }

  function readEmbCache() {
    try {
      var raw = localStorage.getItem(EMB_CACHE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (_) {
      return {};
    }
  }

  function writeEmbCache(cache) {
    try {
      var keys = Object.keys(cache);
      if (keys.length > MAX_CACHE) {
        keys.slice(0, keys.length - MAX_CACHE).forEach(function (k) {
          delete cache[k];
        });
      }
      localStorage.setItem(EMB_CACHE_KEY, JSON.stringify(cache));
    } catch (_) {
      // Quota exceeded — ignore cache write.
    }
  }

  function cacheEmbedding(url, vector) {
    if (!url || !vector) return;
    var cache = readEmbCache();
    cache[url] = vector;
    writeEmbCache(cache);
  }

  function loadImageFromBlob(blob) {
    return new Promise(function (resolve, reject) {
      var blobUrl = URL.createObjectURL(blob);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(blobUrl);
        resolve(img);
      };
      img.onerror = function () {
        URL.revokeObjectURL(blobUrl);
        reject(new Error("image_load_failed"));
      };
      img.src = blobUrl;
    });
  }

  function loadImageFromUrlLegacy(url) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = function () {
        resolve(img);
      };
      img.onerror = function () {
        reject(new Error("image_load_failed"));
      };
      img.src = url;
    });
  }

  async function loadImageFromUrl(url) {
    var value = String(url || "").trim();
    if (!value) throw new Error("image_load_failed");

    if (value.indexOf("data:") === 0) {
      return loadImageFromDataUrl(value);
    }

    try {
      var resp = await fetch(value, { mode: "cors", credentials: "omit", cache: "force-cache" });
      if (resp.ok) {
        var blob = await resp.blob();
        if (blob && blob.size) {
          return loadImageFromBlob(blob);
        }
      }
    } catch (_) {}

    return loadImageFromUrlLegacy(value);
  }

  function loadImageFromDataUrl(dataUrl) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        resolve(img);
      };
      img.onerror = function () {
        reject(new Error("image_load_failed"));
      };
      img.src = dataUrl;
    });
  }

  function loadImageFromFile(file) {
    return new Promise(function (resolve, reject) {
      if (!file) {
        reject(new Error("image_load_failed"));
        return;
      }
      if (file.type && file.type.indexOf("image/") === 0) {
        loadImageFromBlob(file).then(resolve).catch(reject);
        return;
      }
      reject(new Error("image_load_failed"));
    });
  }

  async function extractEmbedding(source) {
    var model = await getModel();
    var embedding = model.infer(source, true);
    var data = await embedding.data();
    embedding.dispose();
    return Array.from(data);
  }

  async function getUrlEmbedding(url) {
    var cache = readEmbCache();
    if (cache[url]) return cache[url];
    try {
      var img = await loadImageFromUrl(url);
      var vector = await extractEmbedding(img);
      cacheEmbedding(url, vector);
      return vector;
    } catch (_) {
      return null;
    }
  }

  function isRealProductImageUrl(url) {
    var value = String(url || "").trim();
    if (!value || value.indexOf("data:") === 0) return false;
    if (value.indexOf("picsum.photos") !== -1) return false;
    if (value.indexOf("placeholder") !== -1) return false;
    return true;
  }

  function collectProductImageUrls(product) {
    var urls = [];
    var media = window.emirateResolveProductMedia?.(product) || {
      image: product.image,
      photos: product.photos || [],
      fromUpload: false
    };

    if (media.fromUpload) {
      if (media.image) urls.push(media.image);
      if (Array.isArray(media.photos)) urls.push.apply(urls, media.photos.filter(Boolean));
    }

    if (Array.isArray(product.photos)) {
      product.photos.filter(Boolean).forEach(function (url) {
        urls.push(url);
      });
    }
    if (product.image) urls.push(product.image);

    if (Array.isArray(product.colors)) {
      product.colors.forEach(function (variant) {
        if (Array.isArray(variant.photos)) {
          urls.push.apply(urls, variant.photos.filter(Boolean));
        }
      });
    }

    var seen = {};
    return urls.filter(function (url) {
      if (!isRealProductImageUrl(url) || seen[url]) return false;
      seen[url] = true;
      return true;
    }).slice(0, MAX_IMAGES_PER_PRODUCT);
  }

  async function scoreProduct(queryEmb, product) {
    var urls = collectProductImageUrls(product);
    if (!urls.length) return 0;
    var best = 0;
    for (var i = 0; i < urls.length; i++) {
      var emb = await getUrlEmbedding(urls[i]);
      if (emb) best = Math.max(best, cosineSimilarity(queryEmb, emb));
    }
    return best;
  }

  async function searchSimilar(querySource, products, options) {
    var opts = options || {};
    var list = Array.isArray(products) ? products : [];
    var candidates = list.filter(function (product) {
      return collectProductImageUrls(product).length > 0;
    }).slice(0, MAX_PRODUCTS);

    if (!candidates.length) {
      return [];
    }

    var queryEmb = await extractEmbedding(querySource);
    var scored = [];
    var total = candidates.length;

    for (var i = 0; i < candidates.length; i++) {
      if (typeof opts.onProgress === "function") opts.onProgress(i + 1, total);
      var score = await scoreProduct(queryEmb, candidates[i]);
      if (score > 0) scored.push({ product: candidates[i], score: score });
    }

    scored.sort(function (a, b) {
      return b.score - a.score;
    });

    var minScore = typeof opts.minScore === "number" ? opts.minScore : MIN_SCORE;
    var filtered = scored.filter(function (item) {
      return item.score >= minScore;
    });

    return filtered.slice(0, 24);
  }

  function saveQueryImage(dataUrl) {
    sessionStorage.setItem(QUERY_KEY, dataUrl);
  }

  function loadQueryImage() {
    return sessionStorage.getItem(QUERY_KEY);
  }

  function clearQueryImage() {
    sessionStorage.removeItem(QUERY_KEY);
  }

  function compressToDataUrl(source, maxSide) {
    maxSide = maxSide || 800;
    return new Promise(function (resolve, reject) {
      var img = source instanceof HTMLImageElement ? source : null;
      if (!img && source instanceof Blob) {
        loadImageFromBlob(source)
          .then(function (loaded) {
            resolve(drawCompressed(loaded, maxSide));
          })
          .catch(reject);
        return;
      }
      if (!img) {
        reject(new Error("compress_failed"));
        return;
      }
      resolve(drawCompressed(img, maxSide));
    });
  }

  function drawCompressed(img, maxSide) {
    var w = img.naturalWidth || img.width;
    var h = img.naturalHeight || img.height;
    if (!w || !h) return "";
    if (w > maxSide || h > maxSide) {
      if (w >= h) {
        h = Math.round((h * maxSide) / w);
        w = maxSide;
      } else {
        w = Math.round((w * maxSide) / h);
        h = maxSide;
      }
    }
    var canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d").drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.85);
  }

  async function searchWithAi(dataUrl, products, options) {
    var opts = options || {};
    assertPhotoSearchAllowed();
    if (typeof opts.onProgress === "function") {
      opts.onProgress(0, 1);
    }

    var userId = null;
    try {
      if (window.emirateAuth && typeof window.emirateAuth.getActiveUserId === "function") {
        userId = await window.emirateAuth.getActiveUserId();
      }
    } catch (_) {}

    var res = await fetch("/api/photo-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: dataUrl,
        userId: userId || undefined,
        products: (products || []).slice(0, 200).map(function (p) {
          return {
            title: p.title,
            brand: p.brand,
            category: p.category,
            sku: p.sku,
          };
        }),
      }),
    });

    var json = await res.json();
    if (res.status === 429 || (json && json.error === "rate_limit_exceeded")) {
      syncQuotaFromBlocked(json.retryAfterSec);
      var limitErr = new Error("rate_limit_exceeded");
      limitErr.retryAfterSec = Math.max(1, Number(json.retryAfterSec) || getPhotoSearchQuota().retryAfterSec);
      throw limitErr;
    }
    if (!res.ok || !json.ok) {
      var errCode = (json && json.error) || "ai_search_failed";
      if (errCode === "ai_not_configured") {
        throw new Error("ai_not_configured");
      }
      throw new Error(errCode);
    }

    syncQuotaFromSuccess(json.remaining, json.limit);

    if (typeof opts.onProgress === "function") {
      opts.onProgress(1, 1);
    }

    var byTitle = {};
    (products || []).forEach(function (p) {
      if (p && p.title) byTitle[p.title] = p;
    });

    return (json.matches || [])
      .map(function (match) {
        var product = byTitle[match.title];
        if (!product) return null;
        var score = Number(match.score) || 0.5;
        if (score < 0.35) return null;
        return {
          product: product,
          score: score,
          source: "gemini",
        };
      })
      .filter(Boolean);
  }

  async function searchProducts(querySourceOrDataUrl, products, options) {
    var opts = options || {};
    var dataUrl =
      typeof querySourceOrDataUrl === "string" && querySourceOrDataUrl.indexOf("data:") === 0
        ? querySourceOrDataUrl
        : null;

    if (dataUrl) {
      try {
        var aiResults = await searchWithAi(dataUrl, products, opts);
        if (aiResults.length) return aiResults;
      } catch (err) {
        if (String(err && err.message) === "rate_limit_exceeded") {
          throw err;
        }
        if (String(err && err.message) !== "ai_not_configured") {
          console.warn("[photo-search] AI failed, using local fallback", err);
        }
      }
    }

    var img = querySourceOrDataUrl;
    if (dataUrl) {
      img = await loadImageFromDataUrl(dataUrl);
    }
    var local = await searchSimilar(img, products, opts);
    return local.map(function (item) {
      item.source = item.source || "local";
      return item;
    });
  }

  async function startPhotoSearchFromFile(file) {
    assertPhotoSearchAllowed();
    var img = await loadImageFromFile(file);
    var dataUrl = await compressToDataUrl(img);
    saveQueryImage(dataUrl);
    window.location.href = "catalog.html?photo=1";
  }

  window.emirateImageSearch = {
    getModel: getModel,
    extractEmbedding: extractEmbedding,
    searchSimilar: searchSimilar,
    searchWithAi: searchWithAi,
    searchProducts: searchProducts,
    saveQueryImage: saveQueryImage,
    loadQueryImage: loadQueryImage,
    clearQueryImage: clearQueryImage,
    compressToDataUrl: compressToDataUrl,
    loadImageFromDataUrl: loadImageFromDataUrl,
    loadImageFromFile: loadImageFromFile,
    startPhotoSearchFromFile: startPhotoSearchFromFile,
    collectProductImageUrls: collectProductImageUrls,
    getPhotoSearchQuota: getPhotoSearchQuota,
    assertPhotoSearchAllowed: assertPhotoSearchAllowed,
    formatPhotoSearchRetry: formatPhotoSearchRetry,
    QUOTA_LIMIT: QUOTA_LIMIT,
    QUOTA_WINDOW_MS: QUOTA_WINDOW_MS,
    QUERY_KEY: QUERY_KEY
  };
})();
