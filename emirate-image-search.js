/**
 * Visual product search — MobileNet embeddings in the browser.
 */
(function () {
  var EMB_CACHE_KEY = "emirate_img_embeddings_v1";
  var QUERY_KEY = "emirate_photo_search_query";
  var MIN_SCORE = 0.22;
  var MAX_CACHE = 240;

  var modelPromise = null;

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

  function loadImageFromUrl(url) {
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
      var blobUrl = URL.createObjectURL(file);
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

  function collectProductImageUrls(product) {
    var urls = [];
    var media =
      window.emirateResolveProductMedia?.(product) || {
        image: product.image,
        photos: product.photos || []
      };
    if (media.image) urls.push(media.image);
    if (Array.isArray(media.photos)) urls.push.apply(urls, media.photos.filter(Boolean));
    if (Array.isArray(product.colors)) {
      product.colors.forEach(function (variant) {
        if (Array.isArray(variant.photos)) {
          urls.push.apply(urls, variant.photos.filter(Boolean));
        }
      });
    }
    var seen = {};
    return urls.filter(function (url) {
      if (!url || seen[url]) return false;
      seen[url] = true;
      return !String(url).startsWith("data:");
    });
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
    var queryEmb = await extractEmbedding(querySource);
    var scored = [];
    var total = list.length;

    for (var i = 0; i < list.length; i++) {
      if (typeof opts.onProgress === "function") opts.onProgress(i + 1, total);
      var score = await scoreProduct(queryEmb, list[i]);
      if (score > 0) scored.push({ product: list[i], score: score });
    }

    scored.sort(function (a, b) {
      return b.score - a.score;
    });

    var minScore = typeof opts.minScore === "number" ? opts.minScore : MIN_SCORE;
    var filtered = scored.filter(function (item) {
      return item.score >= minScore;
    });

    if (!filtered.length && scored.length) {
      return scored.slice(0, Math.min(12, scored.length));
    }
    return filtered;
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
      var img =
        source instanceof HTMLImageElement
          ? source
          : null;
      if (!img && source instanceof Blob) {
        var url = URL.createObjectURL(source);
        img = new Image();
        img.onload = function () {
          URL.revokeObjectURL(url);
          resolve(drawCompressed(img, maxSide));
        };
        img.onerror = function () {
          URL.revokeObjectURL(url);
          reject(new Error("compress_failed"));
        };
        img.src = url;
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

  window.emirateImageSearch = {
    getModel: getModel,
    extractEmbedding: extractEmbedding,
    searchSimilar: searchSimilar,
    saveQueryImage: saveQueryImage,
    loadQueryImage: loadQueryImage,
    clearQueryImage: clearQueryImage,
    compressToDataUrl: compressToDataUrl,
    loadImageFromDataUrl: loadImageFromDataUrl,
    loadImageFromFile: loadImageFromFile,
    QUERY_KEY: QUERY_KEY
  };
})();
