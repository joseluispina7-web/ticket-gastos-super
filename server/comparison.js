const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 80;
const SEARCH_TIMEOUT_MS = 12000;
const USER_AGENT = "Compra-Clara/0.2 (+https://github.com/joseluispina7-web/ticket-gastos-super)";

const MERCADONA_APP = "7UZJKL1DJ0";
const MERCADONA_KEY = "9d8f2e39e90df472b4f2e559a116fe17";
const MERCADONA_INDEX = "products_prod_bcn1_es";

const STORE_META = [
  { key: "mercadona", label: "Mercadona", mode: "Online", homeUrl: "https://tienda.mercadona.es" },
  { key: "lidl", label: "Lidl", mode: "Tienda", homeUrl: "https://www.lidl.es" },
  { key: "dia", label: "DIA", mode: "Online", homeUrl: "https://www.dia.es" },
];

const memoryCache = new Map();

function cleanText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function roundMoney(value, digits = 3) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return 0;
  return Number(number.toFixed(digits));
}

function numberFrom(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const normalized = String(value || "").trim().replace(/\s/g, "").replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

export function normalizeComparisonUnit(value) {
  const unit = cleanText(value);
  if (/^(kg|kilo|kilogramo|g|gr|gramo)/.test(unit)) return "kg";
  if (/^(l|litro|ml|cl)/.test(unit)) return "L";
  if (/^(u|ud|uds|unidad|unidades|each|pack|paquete)/.test(unit)) return "unit";
  return "";
}

function stripHtml(value) {
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
}

function metricFrom(value, unit, packs = 1) {
  const amount = numberFrom(value);
  const normalized = cleanText(unit);
  if (!amount || !packs) return null;
  if (/^(kg|kilo|kilogramos?)$/.test(normalized)) return { amount: amount * packs, unit: "kg" };
  if (/^(g|gr|gramos?)$/.test(normalized)) return { amount: (amount * packs) / 1000, unit: "kg" };
  if (/^(l|litro|litros?)$/.test(normalized)) return { amount: amount * packs, unit: "L" };
  if (/^(ml|mililitros?)$/.test(normalized)) return { amount: (amount * packs) / 1000, unit: "L" };
  if (/^(cl|centilitros?)$/.test(normalized)) return { amount: (amount * packs) / 100, unit: "L" };
  if (/^(u|ud|uds|unidad|unidades)$/.test(normalized)) return { amount: amount * packs, unit: "unit" };
  return null;
}

export function parsePackageMetric(value) {
  const text = stripHtml(value).replace(/\u00d7/g, "x");
  let match = text.match(/(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)\s*(kilogramos?|kilos?|kg|gramos?|gr|g|litros?|l|mililitros?|ml|centilitros?|cl|unidades?|uds|ud|u)/i);
  if (match) {
    const metric = metricFrom(match[2], match[3], numberFrom(match[1]));
    if (metric) return { ...metric, label: match[0] };
  }
  match = text.match(/(\d+(?:[.,]\d+)?)\s*(unidades?|uds|ud|u)/i);
  if (match) {
    const metric = metricFrom(match[1], match[2]);
    if (metric) return { ...metric, label: match[0] };
  }
  match = text.match(/(\d+(?:[.,]\d+)?)\s*(kilogramos?|kilos?|kg|gramos?|gr|g|litros?|l|mililitros?|ml|centilitros?|cl)/i);
  if (match) {
    const metric = metricFrom(match[1], match[2]);
    if (metric) return { ...metric, label: match[0] };
  }
  return null;
}

export function parseBasePrice(value) {
  const text = stripHtml(value);
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|l|ml|cl|unidades?|uds|ud|u)\s*=\s*(\d+(?:[.,]\d+)?)/i);
  if (!match) return null;
  const basis = metricFrom(match[1], match[2]);
  const price = numberFrom(match[3]);
  if (!basis || !price || !basis.amount) return null;
  return { value: price / basis.amount, unit: basis.unit };
}

export function comparablePrice(price, metric) {
  const amount = metric && Number(metric.amount || 0);
  return amount > 0 ? Number(price || 0) / amount : 0;
}

export function productMatchScore(query, name) {
  const wanted = cleanText(query).split(" ").filter((token) => token.length > 1 || /^\d+$/.test(token));
  if (!wanted.length) return 0;
  const normalizedName = cleanText(name);
  const words = new Set(normalizedName.split(" "));
  const matched = wanted.filter((token) => words.has(token) || normalizedName.includes(token)).length;
  let score = matched / wanted.length;
  const cleanQuery = cleanText(query);
  if (cleanQuery && normalizedName.includes(cleanQuery)) score += 0.2;
  const wantedSize = cleanQuery.match(/\btalla\s*([a-z0-9]+)\b/);
  const productSize = normalizedName.match(/\btalla\s*([a-z0-9]+)\b/);
  if (wantedSize && productSize) {
    if (wantedSize[1] !== productSize[1]) return 0;
    score += 0.35;
  }
  return Math.max(0, Math.min(score, 1));
}

function offerShape(store, data) {
  const price = roundMoney(data.price, 2);
  const metric = data.metric || parsePackageMetric(`${data.name || ""} ${data.packageLabel || ""}`);
  const unit = normalizeComparisonUnit(data.unit || (metric && metric.unit));
  const normalizedPrice = roundMoney(data.normalizedPrice || comparablePrice(price, metric));
  return {
    storeKey: store.key,
    store: store.label,
    mode: data.mode || store.mode,
    id: String(data.id || data.url || data.name || ""),
    name: String(data.name || "").trim(),
    brand: String(data.brand || "").trim(),
    category: String(data.category || "").trim(),
    price,
    normalizedPrice,
    normalizedUnit: unit,
    packageAmount: metric && metric.amount ? roundMoney(metric.amount) : 0,
    packageLabel: String(data.packageLabel || (metric && metric.label) || "").trim(),
    available: data.available !== false && price > 0,
    imageUrl: String(data.imageUrl || ""),
    productUrl: String(data.productUrl || store.homeUrl),
    sourceUpdatedAt: data.sourceUpdatedAt || null,
    matchScore: 0,
  };
}

function categoryName(categories) {
  return Array.isArray(categories) && categories[0] ? String(categories[0].name || "") : "";
}

export function mapMercadonaHit(hit) {
  const store = STORE_META[0];
  const price = hit && hit.price_instructions ? hit.price_instructions : {};
  const unit = normalizeComparisonUnit(price.reference_format);
  const unitSize = numberFrom(price.unit_size);
  const sizeMetric = unitSize > 0 ? metricFrom(unitSize, price.size_format || price.reference_format) : null;
  const packageLabel = sizeMetric ? `${unitSize} ${price.size_format || price.reference_format}` : String(hit.packaging || "");
  return offerShape(store, {
    id: hit.id || hit.objectID,
    name: hit.display_name,
    brand: hit.brand,
    category: categoryName(hit.categories),
    price: price.unit_price,
    normalizedPrice: price.reference_price,
    unit,
    metric: sizeMetric,
    packageLabel,
    available: hit.published !== false && !hit.unavailable_from,
    imageUrl: hit.thumbnail,
    productUrl: hit.share_url,
  });
}

export function mapLidlItem(item) {
  const store = STORE_META[1];
  const data = item && item.gridbox ? item.gridbox.data || {} : {};
  const price = data.price || {};
  const description = stripHtml(data.keyfacts && data.keyfacts.description);
  const packageLabel = [price.packaging && price.packaging.text, description].filter(Boolean).join(" · ");
  const base = parseBasePrice(price.basePrice && price.basePrice.text);
  const rendered = numberFrom(data.renderedTs);
  return offerShape(store, {
    id: item.code || data.erpNumber || data.itemId,
    name: data.fullTitle || data.title,
    brand: data.brand && data.brand.name,
    category: data.category,
    price: price.price,
    normalizedPrice: base && base.value,
    unit: base && base.unit,
    packageLabel,
    available: !data.preventSelling,
    mode: data.online ? "Online" : "Tienda",
    imageUrl: data.image || (data.image_V1 && data.image_V1.image),
    productUrl: data.canonicalUrl ? `https://www.lidl.es${data.canonicalUrl}` : "https://www.lidl.es",
    sourceUpdatedAt: rendered ? new Date(rendered * 1000).toISOString() : null,
  });
}

export function mapDiaItem(item) {
  const store = STORE_META[2];
  const prices = item.prices || {};
  const unit = normalizeComparisonUnit(prices.measure_unit);
  return offerShape(store, {
    id: item.object_id || item.sku_id,
    name: item.display_name,
    brand: item.brand,
    category: item.l2_category_description || item.l1_category_description,
    price: prices.price,
    normalizedPrice: prices.price_per_unit,
    unit,
    packageLabel: (parsePackageMetric(item.display_name) || {}).label,
    available: Number(item.units_in_stock || 0) > 0,
    imageUrl: item.image ? `https://www.dia.es${item.image}` : "",
    productUrl: item.url ? `https://www.dia.es${item.url}` : "https://www.dia.es",
  });
}

async function fetchWithTimeout(fetcher, url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
  try {
    const response = await fetcher(url, { ...options, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function searchMercadona(query, limit, fetcher) {
  const url = `https://${MERCADONA_APP}-dsn.algolia.net/1/indexes/${MERCADONA_INDEX}/query`;
  const response = await fetchWithTimeout(fetcher, url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-algolia-api-key": MERCADONA_KEY,
      "x-algolia-application-id": MERCADONA_APP,
      "user-agent": USER_AGENT,
    },
    body: JSON.stringify({ query, hitsPerPage: Math.max(limit * 3, 12) }),
  });
  const data = await response.json();
  return (data.hits || []).map(mapMercadonaHit);
}

async function searchLidl(query, limit, fetcher) {
  const params = new URLSearchParams({ q: query, assortment: "ES", locale: "es_ES", version: "2.0" });
  const response = await fetchWithTimeout(fetcher, `https://www.lidl.es/q/api/search?${params}`, {
    headers: { accept: "*/*", "user-agent": USER_AGENT },
  });
  const data = await response.json();
  return (data.items || []).slice(0, Math.max(limit * 4, 24)).map(mapLidlItem);
}

async function searchDia(query, limit, fetcher) {
  const response = await fetchWithTimeout(fetcher, `https://www.dia.es/api/v1/search-back/search?q=${encodeURIComponent(query)}`, {
    headers: { accept: "application/json", "user-agent": USER_AGENT },
  });
  const data = await response.json();
  return (data.search_items || []).slice(0, Math.max(limit * 4, 24)).map(mapDiaItem);
}

function rankOffers(query, offers, limit) {
  return offers
    .filter((offer) => offer.name && offer.price > 0)
    .map((offer) => ({ ...offer, matchScore: productMatchScore(query, offer.name) }))
    .filter((offer) => offer.matchScore >= 0.34)
    .sort((a, b) => {
      const scoreGap = b.matchScore - a.matchScore;
      if (Math.abs(scoreGap) > 0.2) return scoreGap;
      if (a.normalizedUnit === b.normalizedUnit && a.normalizedPrice && b.normalizedPrice) {
        return a.normalizedPrice - b.normalizedPrice;
      }
      return scoreGap || a.price - b.price;
    })
    .slice(0, limit);
}

function comparisonSummary(stores) {
  const candidates = stores.flatMap((store) => store.offers || []).filter((offer) => offer.normalizedPrice > 0 && offer.matchScore >= 0.5);
  const unitCounts = candidates.reduce((counts, offer) => {
    counts[offer.normalizedUnit] = (counts[offer.normalizedUnit] || 0) + 1;
    return counts;
  }, {});
  const unit = Object.entries(unitCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  if (!unit) return null;

  const bestByStore = stores
    .map((store) => {
      const offer = (store.offers || [])
        .filter((item) => item.normalizedUnit === unit && item.normalizedPrice > 0 && item.matchScore >= 0.5)
        .sort((a, b) => a.normalizedPrice - b.normalizedPrice)[0];
      return offer ? { storeKey: store.key, store: store.label, offer } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.offer.normalizedPrice - b.offer.normalizedPrice);

  if (!bestByStore.length) return null;
  const lowest = bestByStore[0].offer.normalizedPrice;
  const highest = bestByStore[bestByStore.length - 1].offer.normalizedPrice;
  return {
    unit,
    bestByStore,
    cheapest: bestByStore[0],
    savingPerUnit: roundMoney(Math.max(highest - lowest, 0)),
  };
}

function cacheSet(key, value) {
  if (memoryCache.size >= MAX_CACHE_ENTRIES) memoryCache.delete(memoryCache.keys().next().value);
  memoryCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
}

export async function comparePrices(query, options = {}) {
  const cleanQuery = String(query || "").trim().slice(0, 80);
  if (cleanQuery.length < 2) throw new Error("Escribe al menos dos caracteres");
  const limit = Math.max(1, Math.min(Number(options.limit || 6), 8));
  const fetcher = options.fetcher || fetch;
  const cacheKey = `${cleanText(cleanQuery)}:${limit}`;
  const cached = options.cache !== false && memoryCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return { ...cached.value, cached: true };

  const searches = [searchMercadona, searchLidl, searchDia];
  const results = await Promise.allSettled(searches.map((search) => search(cleanQuery, limit, fetcher)));
  const stores = STORE_META.map((meta, index) => {
    const result = results[index];
    if (result.status === "rejected") {
      return { ...meta, status: "unavailable", offers: [], error: String(result.reason && result.reason.message || result.reason || "No disponible").slice(0, 120) };
    }
    const offers = rankOffers(cleanQuery, result.value, limit);
    return { ...meta, status: offers.length ? "ok" : "empty", offers, error: null };
  });

  const value = {
    query: cleanQuery,
    fetchedAt: new Date().toISOString(),
    cached: false,
    stores,
    comparison: comparisonSummary(stores),
    upcomingStores: [
      { key: "alcampo", label: "Alcampo", reason: "La web bloquea consultas automatizadas simples" },
      { key: "carrefour", label: "Carrefour", reason: "Requiere navegador mantenido por proteccion anti-bot" },
    ],
  };
  if (options.cache !== false) cacheSet(cacheKey, value);
  return value;
}
