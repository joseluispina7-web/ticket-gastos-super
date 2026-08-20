const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 80;
const SEARCH_TIMEOUT_MS = 12000;
const READER_TIMEOUT_MS = 20000;
const USER_AGENT = "Compra-Clara/0.2 (+https://github.com/joseluispina7-web/ticket-gastos-super)";
const BROWSER_USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

const MERCADONA_APP = "7UZJKL1DJ0";
const MERCADONA_KEY = "9d8f2e39e90df472b4f2e559a116fe17";
const MERCADONA_POSTAL_CODE = "28050";
const MERCADONA_FALLBACK_WAREHOUSE = "mad3";
const MERCADONA_INDEX_PREFIX = "products_prod";
const ALDI_APP = "L9KNU74IO7";
const ALDI_KEY = "83df5acd172c42ab174afa4583232b5d";
const ALDI_INDEX = "an_prd_es_es_pen_products2";

const STORE_META = [
  { key: "mercadona", label: "Mercadona", mode: "Online", homeUrl: "https://tienda.mercadona.es" },
  { key: "dia", label: "DIA", mode: "Online", homeUrl: "https://www.dia.es" },
  { key: "carrefour", label: "Carrefour", mode: "Online", homeUrl: "https://www.carrefour.es/supermercado" },
  { key: "alcampo", label: "Alcampo", mode: "Online", homeUrl: "https://www.compraonline.alcampo.es" },
  { key: "ahorramas", label: "Ahorramas", mode: "Online", homeUrl: "https://www.ahorramas.com" },
  { key: "aldi", label: "Aldi", mode: "Tienda", homeUrl: "https://www.aldi.es" },
  { key: "hipercor", label: "Hipercor", mode: "Online", homeUrl: "https://www.hipercor.es/supermercado" },
];

export const COMPARISON_STORES = STORE_META.map(({ key, label, mode }) => ({ key, label, mode }));
export const DEFAULT_ENABLED_STORES = COMPARISON_STORES.map((store) => store.key);
const STORE_KEYS = new Set(DEFAULT_ENABLED_STORES);

const STOP_WORDS = new Set(["a", "al", "de", "del", "el", "en", "la", "las", "los", "para", "por", "un", "una", "y"]);
const PACKAGE_UNIT_PATTERN = "(?:kg|kilos?|kilogramos?|g|gr|gramos?|l|litros?|ml|mililitros?|cl|centilitros?|uds?|unidades?|unidad)";
const PRODUCT_CONCEPTS = [
  {
    id: "concepto_queso_untar",
    phrases: ["queso de untar", "queso untar", "crema de queso", "queso crema", "queso untable"],
    searchAliases: ["queso untar", "crema de queso", "queso de untar"],
  },
  {
    id: "concepto_picos",
    phrases: ["picos de pan", "picos", "colines", "reganas", "palitos de pan"],
    searchAliases: ["picos", "colines"],
  },
  {
    id: "concepto_panales",
    phrases: ["panales", "panal"],
    searchAliases: ["panales"],
  },
  {
    id: "concepto_discos_desmaquillantes",
    phrases: ["discos desm", "discos desmaquillantes", "discos desmaquilladores"],
    searchAliases: ["discos desmaquillantes", "discos desmaquilladores"],
  },
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

function removePackageNoise(value) {
  return String(value || "")
    .replace(new RegExp(`\\b\\d+(?:[.,]\\d+)?\\s*x\\s*\\d+(?:[.,]\\d+)?\\s*${PACKAGE_UNIT_PATTERN}\\b`, "gi"), " ")
    .replace(new RegExp(`\\b\\d+(?:[.,]\\d+)?\\s*${PACKAGE_UNIT_PATTERN}\\b`, "gi"), " ")
    .replace(new RegExp(`\\b(?:pack|paquete|caja|bolsa|botella|brik|brick|lata|bote)\\s*(?:de)?\\s*\\d+(?:[.,]\\d+)?\\b`, "gi"), " ");
}

function storeMeta(key) {
  return STORE_META.find((store) => store.key === key);
}

export function normalizeEnabledStoreKeys(keys) {
  const raw = Array.isArray(keys) ? keys : String(keys || "").split(",");
  const selected = [...new Set(raw
    .map((key) => String(key || "").trim().toLowerCase())
    .filter((key) => STORE_KEYS.has(key)))];
  return selected.length ? selected : DEFAULT_ENABLED_STORES;
}

function conceptTokens(value) {
  let text = cleanText(removePackageNoise(value));
  const concepts = new Set();
  for (const concept of PRODUCT_CONCEPTS) {
    for (const phrase of concept.phrases) {
      const pattern = new RegExp(`(^|\\s)${phrase.replace(/ /g, "\\s+")}(?=\\s|$)`, "g");
      if (pattern.test(text)) {
        concepts.add(concept.id);
        text = text.replace(pattern, " ");
      }
    }
  }
  const tokens = text.split(" ").filter((token) => token && !STOP_WORDS.has(token) && (token.length > 1 || /^\d+$/.test(token)));
  concepts.forEach((concept) => tokens.push(concept));
  return { concepts, tokens };
}

function tokenRoot(token) {
  if (token.startsWith("concepto_")) return token;
  if (token.length > 5 && token.endsWith("es")) return token.slice(0, -2);
  if (token.length > 4 && token.endsWith("s")) return token.slice(0, -1);
  return token;
}

export function queryVariants(value) {
  const query = cleanComparisonQuery(value);
  const normalized = cleanText(query);
  const variants = [query];
  const withoutPackage = cleanText(removePackageNoise(query));
  if (withoutPackage && withoutPackage !== normalized) variants.push(withoutPackage);
  for (const concept of PRODUCT_CONCEPTS) {
    const variantBase = withoutPackage || normalized;
    const matchedPhrase = concept.phrases.find((phrase) => (` ${variantBase} `).includes(` ${phrase} `));
    if (!matchedPhrase) continue;
    for (const alias of concept.searchAliases) {
      const variant = variantBase.replace(matchedPhrase, cleanText(alias)).replace(/\s+/g, " ").trim();
      if (variant !== normalized && variant !== withoutPackage) variants.push(variant);
    }
    break;
  }
  return [...new Set(variants.filter(Boolean))].slice(0, 5);
}

export function cleanComparisonQuery(value) {
  return String(value || "")
    .trim()
    .replace(/^\d+(?:[.,]\d+)?\s+(?=[A-Za-zÁÉÍÓÚÜÑáéíóúüñ])/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
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

function decodeHtml(value) {
  const named = { amp: "&", apos: "'", euro: "EUR", gt: ">", lt: "<", nbsp: " ", quot: '"' };
  return String(value || "").replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    const lower = entity.toLowerCase();
    if (lower[0] === "#") {
      const number = lower[1] === "x" ? parseInt(lower.slice(2), 16) : parseInt(lower.slice(1), 10);
      return Number.isFinite(number) ? String.fromCodePoint(number) : match;
    }
    return Object.prototype.hasOwnProperty.call(named, lower) ? named[lower] : match;
  });
}

function stripHtml(value) {
  return decodeHtml(String(value || "").replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
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

export function parseUnitPrice(value) {
  const text = stripHtml(value).replace(/EUR/gi, "€");
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*€?\s*\/\s*(?:(\d+(?:[.,]\d+)?)\s*)?(kg|kilo|kilogramo|g|gr|gramo|l|litro|ml|mililitro|cl|centilitro|unidad|unidades|ud|uds|u)\b/i);
  if (!match) return null;
  const price = numberFrom(match[1]);
  const basis = metricFrom(match[2] || 1, match[3]);
  return basis && price > 0 ? { value: price / basis.amount, unit: basis.unit } : null;
}

export function comparablePrice(price, metric) {
  const amount = metric && Number(metric.amount || 0);
  return amount > 0 ? Number(price || 0) / amount : 0;
}

export function productMatchScore(query, name) {
  const wanted = conceptTokens(query);
  if (!wanted.tokens.length) return 0;
  const normalizedName = cleanText(name);
  const candidate = conceptTokens(name);
  for (const concept of wanted.concepts) {
    if (!candidate.concepts.has(concept)) return 0;
  }
  if (wanted.concepts.has("concepto_picos") && /\bpan de picos\b/.test(normalizedName) && !/\bpicos de pan\b/.test(normalizedName)) {
    return 0;
  }
  const words = new Set(candidate.tokens.map(tokenRoot));
  const matched = wanted.tokens.filter((token) => words.has(tokenRoot(token))).length;
  let score = matched / wanted.tokens.length;
  const cleanQuery = cleanText(query);
  if (cleanQuery && normalizedName.includes(cleanQuery)) score += 0.15;
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
  return Array.isArray(categories)
    ? categories.map((category) => String(category && category.name || "").trim()).filter(Boolean).join(" > ")
    : "";
}

export function mapMercadonaHit(hit) {
  const store = storeMeta("mercadona");
  const price = hit && hit.price_instructions ? hit.price_instructions : {};
  const unit = normalizeComparisonUnit(price.reference_format);
  const unitSize = numberFrom(price.unit_size);
  const totalUnits = numberFrom(price.total_units);
  const sizeMetric = unit === "unit" && totalUnits > 1
    ? { amount: totalUnits, unit: "unit" }
    : unitSize > 0 ? metricFrom(unitSize, price.size_format || price.reference_format) : null;
  const packageLabel = unit === "unit" && totalUnits > 1
    ? [hit.packaging, `${totalUnits} unidades`].filter(Boolean).join(" | ")
    : sizeMetric ? `${unitSize} ${price.size_format || price.reference_format}` : String(hit.packaging || "");
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

export function mapDiaItem(item) {
  const store = storeMeta("dia");
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

export function mapAldiHit(hit) {
  const store = storeMeta("aldi");
  const primaryAsset = Array.isArray(hit.assets) ? hit.assets.find((asset) => asset.type === "primary") || hit.assets[0] : null;
  const category = hit.hierarchicalCategories && Array.isArray(hit.hierarchicalCategories.lvl1)
    ? String(hit.hierarchicalCategories.lvl1[0] || "").split(">").pop().trim()
    : hit.mainCategoryID;
  return offerShape(store, {
    id: hit.objectID || hit.productSlug,
    name: hit.name,
    brand: hit.brandName,
    category,
    price: hit.currentPrice && hit.currentPrice.priceValue,
    packageLabel: hit.salesUnit,
    available: hit.isAvailable !== false && hit.isRecall !== true,
    imageUrl: primaryAsset && primaryAsset.url,
    productUrl: hit.productSlug ? `https://www.aldi.es/producto/${hit.productSlug}.html` : store.homeUrl,
    sourceUpdatedAt: hit.currentPrice && hit.currentPrice.validFrom
      ? new Date(Number(hit.currentPrice.validFrom) * 1000).toISOString()
      : null,
  });
}

export function mapCarrefourItem(item) {
  const store = storeMeta("carrefour");
  const unit = normalizeComparisonUnit(item.unit_short_name || item.measure_unit);
  const amount = numberFrom(item.unit_conversion_factor);
  const metric = unit && amount > 0 ? { amount, unit } : parsePackageMetric(item.display_name);
  const productPath = item.url_for_play_service || (item.urls && item.urls.food) || "";
  return offerShape(store, {
    id: item.product_id || item.catalog_ref_id || item.ean13,
    name: item.display_name,
    brand: item.brand,
    category: item.parent_category && item.parent_category.food,
    price: item.active_price,
    metric,
    unit,
    packageLabel: (parsePackageMetric(item.display_name) || {}).label,
    available: item.active_food !== false,
    imageUrl: item.image_for_play_service || (item.image_path && item.image_path.food),
    productUrl: productPath ? `https://www.carrefour.es${productPath}` : store.homeUrl,
  });
}

export function mapHipercorProduct(product) {
  const store = storeMeta("hipercor");
  const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers || {};
  const brand = typeof product.brand === "string" ? product.brand : product.brand && product.brand.name;
  const image = Array.isArray(product.image) ? product.image[0] : product.image;
  const productUrl = product.url ? new URL(product.url, store.homeUrl).toString() : store.homeUrl;
  return offerShape(store, {
    id: product.sku || product.productID || product.gtin13 || productUrl || product.name,
    name: product.name,
    brand,
    category: product.category,
    price: offer.price || offer.lowPrice,
    packageLabel: (parsePackageMetric(product.name) || {}).label,
    available: offer.availability ? !/OutOfStock/i.test(String(offer.availability)) : true,
    imageUrl: image,
    productUrl,
  });
}

function unitFromAlcampoLabel(value) {
  const label = cleanText(value);
  if (/(per kg|por kg|kilogramo|gramo)/.test(label)) return "kg";
  if (/(per l|por l|litro)/.test(label)) return "L";
  if (/(per each|por unidad|unidad)/.test(label)) return "unit";
  return "";
}

export function mapAlcampoItem(item, productUrl = "") {
  const store = storeMeta("alcampo");
  const unit = unitFromAlcampoLabel(item.price && item.price.unit && item.price.unit.label);
  const normalizedPrice = numberFrom(item.price && item.price.unit && item.price.unit.current && item.price.unit.current.amount);
  return offerShape(store, {
    id: item.retailerProductId || item.productId,
    name: item.name,
    brand: item.brand,
    category: Array.isArray(item.categoryPath) ? item.categoryPath.slice(0, 3).join(" - ") : "",
    price: item.price && item.price.current && item.price.current.amount,
    normalizedPrice,
    unit,
    packageLabel: item.size && item.size.value,
    available: item.available !== false,
    imageUrl: item.image && item.image.src,
    productUrl: productUrl || store.homeUrl,
  });
}

export function parseAlcampoHtml(html) {
  const source = String(html || "");
  const keyIndex = source.indexOf('"productEntities"');
  if (keyIndex < 0) return [];
  const jsonStart = source.indexOf("{", keyIndex + 17);
  if (jsonStart < 0) return [];
  let depth = 0;
  let inString = false;
  let escaped = false;
  let jsonEnd = -1;
  for (let index = jsonStart; index < source.length; index += 1) {
    const character = source[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === "{") depth += 1;
    else if (character === "}" && --depth === 0) {
      jsonEnd = index + 1;
      break;
    }
  }
  if (jsonEnd < 0) return [];
  let entitiesById;
  try {
    entitiesById = JSON.parse(source.slice(jsonStart, jsonEnd));
  } catch (_error) {
    return [];
  }
  const entities = Object.values(entitiesById || {});
  return entities.map((item) => {
    const id = String(item.retailerProductId || "").replace(/[^a-z0-9-]/gi, "");
    const match = id && source.match(new RegExp(`href="([^"]*/products/[^"]*/${id})"`, "i"));
    const url = match ? new URL(decodeHtml(match[1]), "https://www.compraonline.alcampo.es").toString() : "";
    return mapAlcampoItem(item, url);
  });
}

export function parseAhorramasHtml(html) {
  const source = String(html || "");
  const starts = [...source.matchAll(/<div class="product[^"]*" data-pid="([^"]+)"/gi)];
  return starts.flatMap((marker, index) => {
    const block = source.slice(marker.index, starts[index + 1] ? starts[index + 1].index : source.length);
    const encoded = (block.match(/data-gtm-layer="([^"]+)"/i) || [])[1];
    if (!encoded) return [];
    let data;
    try {
      data = JSON.parse(decodeURIComponent(decodeHtml(encoded)));
    } catch (_error) {
      return [];
    }
    const href = decodeHtml((block.match(/<a[^>]+href="([^"]+)"[^>]+class="product-pdp-link/i) || [])[1] || "");
    const image = decodeHtml((block.match(/<img[^>]+class="tile-image"[^>]+src="([^"]+)"/i) || [])[1] || "");
    const unitText = (block.match(/class="unit-price-per-unit[^"]*"[^>]*>([\s\S]*?)<\/span>/i) || [])[1] || "";
    const base = parseUnitPrice(unitText);
    const store = storeMeta("ahorramas");
    return [offerShape(store, {
      id: data.id || marker[1],
      name: data.name,
      brand: data.brand,
      category: data.category,
      price: data.price,
      normalizedPrice: base && base.value,
      unit: base && base.unit,
      packageLabel: (parsePackageMetric(data.name) || {}).label,
      available: !/data-available="false"/i.test(block),
      imageUrl: image,
      productUrl: href ? new URL(href, "https://www.ahorramas.com").toString() : store.homeUrl,
    })];
  });
}

async function fetchWithTimeout(fetcher, url, options = {}, timeoutMs = SEARCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(url, { ...options, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function searchMercadona(query, limit, fetcher) {
  let warehouse = MERCADONA_FALLBACK_WAREHOUSE;
  try {
    const postalResponse = await fetchWithTimeout(fetcher, "https://tienda.mercadona.es/api/postal-codes/actions/change-pc/", {
      method: "PUT",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        origin: "https://tienda.mercadona.es",
        referer: "https://tienda.mercadona.es/",
        "user-agent": BROWSER_USER_AGENT,
      },
      body: JSON.stringify({ new_postal_code: MERCADONA_POSTAL_CODE }),
    });
    const resolved = String(postalResponse.headers.get("x-customer-wh") || "").trim().toLowerCase();
    if (/^[a-z]{3}\d+$/.test(resolved)) warehouse = resolved;
  } catch (_error) {
    // The postcode currently maps to mad3; keep search usable if location lookup is temporarily blocked.
  }
  const index = `${MERCADONA_INDEX_PREFIX}_${warehouse}_es`;
  const url = `https://${MERCADONA_APP}-dsn.algolia.net/1/indexes/${index}/query`;
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

export function parseHipercorHtml(html) {
  const source = String(html || "");
  const products = [];
  for (const match of source.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let json;
    try {
      json = JSON.parse(stripHtml(match[1]));
    } catch (_error) {
      continue;
    }
    const graph = Array.isArray(json && json["@graph"]) ? json["@graph"] : [json];
    for (const entry of graph.flat()) {
      if (!entry || entry["@type"] !== "Product") continue;
      products.push(mapHipercorProduct(entry));
    }
  }

  const starts = [...source.matchAll(/<div[^>]+class=["'][^"']*\bfood-product-preview-responsive\b[^"']*["'][^>]+id=["'](B[A-Z0-9]+)["'][^>]*>/gi)];
  for (const [index, marker] of starts.entries()) {
    const block = source.slice(marker.index, starts[index + 1] ? starts[index + 1].index : source.length);
    const description = block.match(/<a([^>]*\bfood-product-preview-responsive__description\b[^>]*)>([\s\S]*?)<\/a>/i);
    const priceText = (block.match(/class=["'][^"']*\bfood-prices__price\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i) || [])[1] || "";
    const price = numberFrom(stripHtml(priceText).replace(/[^\d.,-]/g, ""));
    if (!description || !price) continue;
    const href = decodeHtml((description[1].match(/href=["']([^"']+)["']/i) || [])[1] || "");
    const image = decodeHtml((block.match(/\bfood-product-preview-responsive__image\b[\s\S]*?<img[^>]+src=["']([^"']+)["']/i) || [])[1] || "");
    const unitText = (block.match(/class=["'][^"']*\bfood-prices__measurement-unit\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i) || [])[1] || "";
    const packageText = (block.match(/<span[^>]+class=["'][^"']*\bfood-product-preview-responsive__sale_type\b[^"']*["'][^>]*>([\s\S]*?)<\/span>\s*(?:<!--[\s\S]*?-->\s*)*<\/div>/i) || [])[1] || "";
    const base = parseUnitPrice(unitText);
    const packageLabel = stripHtml(packageText);
    const packageMetric = parsePackageMetric(packageLabel);
    const normalizedPrice = base && packageMetric && base.unit === packageMetric.unit && packageMetric.amount > 1 && base.value >= price * 0.9
      ? comparablePrice(price, packageMetric)
      : base && base.value;
    products.push(offerShape(storeMeta("hipercor"), {
      id: marker[1],
      name: stripHtml(description[2]),
      price,
      normalizedPrice,
      unit: base && base.unit,
      packageLabel,
      available: !/Agotado temporalmente/i.test(block),
      imageUrl: image,
      productUrl: href ? new URL(href, "https://www.hipercor.es").toString() : storeMeta("hipercor").homeUrl,
    }));
  }

  return [...new Map(products.map((product) => [product.id, product])).values()];
}

export function parseHipercorMarkdown(markdown) {
  const source = String(markdown || "");
  const productStart = /\[!\[Image[^\]]*\]\((https?:\/\/[^)\s]+)\)\]\((https?:\/\/www\.hipercor\.es\/supermercado\/(B[A-Z0-9]+)[^)]*)\)/gi;
  const starts = [...source.matchAll(productStart)];
  return starts.flatMap((marker, index) => {
    const block = source.slice(marker.index, starts[index + 1] ? starts[index + 1].index : source.length);
    const links = [...block.matchAll(/\[([^\]\n]+)\]\((https?:\/\/www\.hipercor\.es\/supermercado\/B[A-Z0-9]+[^)]*)\)/gi)]
      .filter((match) => !match[1].startsWith("!") && !/^\(\d+\)$/.test(match[1].trim()));
    const description = links[0];
    const priceMatch = block.match(/(\d+(?:[.,]\d+)?)\s*€/);
    if (!description || !priceMatch) return [];
    const remainder = block.slice(description.index + description[0].length);
    const packageLabel = remainder.split(/!\[|\[\(\d+\)\]|\r?\n/)[0].replace(/\s+/g, " ").trim();
    const base = parseUnitPrice(block);
    const packageMetric = parsePackageMetric(packageLabel);
    const price = numberFrom(priceMatch[1]);
    const normalizedPrice = base && packageMetric && base.unit === packageMetric.unit && packageMetric.amount > 1 && base.value >= price * 0.9
      ? comparablePrice(price, packageMetric)
      : base && base.value;
    return [offerShape(storeMeta("hipercor"), {
      id: marker[3],
      name: description[1].replace(/\s+/g, " ").trim(),
      price,
      normalizedPrice,
      unit: base && base.unit,
      packageLabel,
      available: !/Agotado temporalmente/i.test(block),
      imageUrl: marker[1],
      productUrl: description[2].replace(/^http:/i, "https:"),
    })];
  });
}

async function searchAldi(query, limit, fetcher) {
  const url = `https://${ALDI_APP}-dsn.algolia.net/1/indexes/${ALDI_INDEX}/query`;
  const response = await fetchWithTimeout(fetcher, url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-algolia-api-key": ALDI_KEY,
      "x-algolia-application-id": ALDI_APP,
      "user-agent": USER_AGENT,
    },
    body: JSON.stringify({ query, hitsPerPage: Math.max(limit * 4, 24) }),
  });
  const data = await response.json();
  return (data.hits || []).map(mapAldiHit);
}

async function searchDia(query, limit, fetcher) {
  const response = await fetchWithTimeout(fetcher, `https://www.dia.es/api/v1/search-back/search?q=${encodeURIComponent(query)}`, {
    headers: { accept: "application/json", "user-agent": USER_AGENT },
  });
  const data = await response.json();
  return (data.search_items || []).slice(0, Math.max(limit * 4, 24)).map(mapDiaItem);
}

async function searchCarrefour(query, limit, fetcher) {
  const params = new URLSearchParams({
    query,
    lang: "es",
    scope: "desktop",
    catalog: "food",
    start: "0",
    rows: String(Math.max(limit * 4, 24)),
  });
  const response = await fetchWithTimeout(fetcher, `https://api.empathy.co/search/v1/query/carrefour/search?${params}`, {
    headers: { accept: "application/json", "user-agent": USER_AGENT },
  });
  const data = await response.json();
  return (data.catalog && data.catalog.content || []).map(mapCarrefourItem);
}

async function searchAlcampo(query, _limit, fetcher) {
  const response = await fetchWithTimeout(fetcher, `https://www.compraonline.alcampo.es/search?q=${encodeURIComponent(query)}`, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "accept-language": "es-ES,es;q=0.9",
      "user-agent": BROWSER_USER_AGENT,
    },
  });
  const html = await response.text();
  if (!html.includes('"productEntities"')) throw new Error("El catálogo de Alcampo ha pedido verificación del navegador");
  return parseAlcampoHtml(html);
}

async function searchAhorramas(query, _limit, fetcher) {
  const response = await fetchWithTimeout(fetcher, `https://www.ahorramas.com/buscador?q=${encodeURIComponent(query)}`, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "accept-language": "es-ES,es;q=0.9",
      "user-agent": BROWSER_USER_AGENT,
    },
  });
  return parseAhorramasHtml(await response.text());
}

async function browserActionText(result) {
  if (!result) return "";
  if (typeof result === "string") return result;
  const text = typeof result.text === "function" ? await result.text() : "";
  if (text) {
    try {
      const payload = JSON.parse(text);
      return String(payload.markdown || payload.result || payload.content || text);
    } catch (_error) {
      return text;
    }
  }
  return String(result.markdown || result.result || result.content || "");
}

async function searchHipercor(query, _limit, fetcher, browser) {
  const variants = queryVariants(query);
  const sourceQuery = variants.find((variant) => cleanText(variant) !== cleanText(query)) || variants[0] || query;
  const encodedQuery = encodeURIComponent(sourceQuery);
  const directUrl = `https://www.hipercor.es/supermercado/buscar/?question=${encodedQuery}&catalog=supermercado&stype=text_box`;
  let browserIssue = "binding no disponible";
  try {
    const response = await fetchWithTimeout(fetcher, directUrl, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "accept-language": "es-ES,es;q=0.9",
        referer: "https://www.hipercor.es/supermercado/",
        "user-agent": BROWSER_USER_AGENT,
      },
    });
    const offers = parseHipercorHtml(await response.text());
    if (offers.length) return offers;
  } catch (_error) {
    // Hipercor normally rejects plain server-side requests.
  }

  if (browser && typeof browser.quickAction === "function") {
    try {
      const content = await browserActionText(await browser.quickAction("content", {
        url: directUrl,
        gotoOptions: { waitUntil: "networkidle2", timeout: 45000 },
        waitForSelector: { selector: ".food-product-preview-responsive", timeout: 30000 },
        waitForTimeout: 1000,
        userAgent: BROWSER_USER_AGENT,
      }));
      const offers = parseHipercorHtml(content);
      if (offers.length) return offers;
      browserIssue = "respuesta sin productos analizables";
    } catch (error) {
      browserIssue = String(error && error.message || error || "error desconocido").slice(0, 80);
    }
  }

  const readerUrl = `https://r.jina.ai/http://www.hipercor.es/supermercado/buscar/?question=${encodedQuery}%26catalog=supermercado%26stype=text_box`;
  try {
    const response = await fetchWithTimeout(fetcher, readerUrl, {
      headers: { accept: "text/markdown,text/plain;q=0.9", "user-agent": USER_AGENT },
    }, READER_TIMEOUT_MS);
    const offers = parseHipercorMarkdown(await response.text());
    if (!offers.length) throw new Error("respuesta sin productos analizables");
    return offers;
  } catch (error) {
    const readerIssue = String(error && error.message || error || "error desconocido").slice(0, 60);
    throw new Error(`Browser Run: ${browserIssue}; lector: ${readerIssue}`);
  }
}

async function searchExpanded(search, query, limit, fetcher) {
  const results = await Promise.allSettled(queryVariants(query).map((variant) => search(variant, limit, fetcher)));
  const offers = results.filter((result) => result.status === "fulfilled").flatMap((result) => result.value);
  if (!offers.length) {
    const rejected = results.find((result) => result.status === "rejected");
    if (rejected) throw rejected.reason;
  }
  return [...new Map(offers.map((offer) => [`${offer.storeKey}:${offer.id}`, offer])).values()];
}

function rankOffers(query, offers, limit) {
  return offers
    .filter((offer) => offer.name && offer.price > 0)
    .map((offer) => ({ ...offer, matchScore: productMatchScore(query, offer.name) }))
    .filter((offer) => offer.matchScore >= 0.55)
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

function storeAdapters() {
  return {
    mercadona: searchMercadona,
    dia: (query, size, source) => searchExpanded(searchDia, query, size, source),
    carrefour: searchCarrefour,
    alcampo: searchAlcampo,
    ahorramas: (query, size, source) => searchExpanded(searchAhorramas, query, size, source),
    aldi: (query, size, source) => searchExpanded(searchAldi, query, size, source),
    hipercor: searchHipercor,
  };
}

export async function searchStoreProducts(storeKey, query, options = {}) {
  const cleanQuery = cleanComparisonQuery(query);
  const limit = Math.max(1, Math.min(Number(options.limit || 4), 8));
  const search = storeAdapters()[String(storeKey || "").toLowerCase()];
  if (!search || cleanQuery.length < 2) return [];
  const offers = await search(cleanQuery, limit, options.fetcher || fetch, options.browser);
  return rankOffers(cleanQuery, offers, limit);
}

export async function comparePrices(query, options = {}) {
  const cleanQuery = cleanComparisonQuery(query);
  if (cleanQuery.length < 2) throw new Error("Escribe al menos dos caracteres");
  const limit = Math.max(1, Math.min(Number(options.limit || 6), 8));
  const fetcher = options.fetcher || fetch;
  const enabledStores = normalizeEnabledStoreKeys(options.enabledStores);
  const cacheKey = `${cleanText(cleanQuery)}:${limit}:${enabledStores.join(",")}`;
  const cached = options.cache !== false && memoryCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return { ...cached.value, cached: true };

  const adapters = storeAdapters();
  const activeMeta = STORE_META.filter((store) => enabledStores.includes(store.key));
  const searches = activeMeta.map((store) => adapters[store.key]);
  const results = await Promise.allSettled(searches.map((search) => search(cleanQuery, limit, fetcher, options.browser)));
  const stores = activeMeta.map((meta, index) => {
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
  };
  if (options.cache !== false) cacheSet(cacheKey, value);
  return value;
}
