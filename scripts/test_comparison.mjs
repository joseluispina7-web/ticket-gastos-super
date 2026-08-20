import assert from "node:assert/strict";
import {
  cleanComparisonQuery,
  comparePrices,
  comparablePrice,
  normalizeEnabledStoreKeys,
  parseAhorramasHtml,
  parseAlcampoHtml,
  parseBasePrice,
  parseHipercorHtml,
  parseHipercorMarkdown,
  parsePackageMetric,
  parseUnitPrice,
  productMatchScore,
  queryVariants,
} from "../server/comparison.js";

assert.deepEqual(parsePackageMetric("64 uds"), { amount: 64, unit: "unit", label: "64 uds" });
assert.deepEqual(parsePackageMetric("Pack 6 x 1.5 L"), { amount: 9, unit: "L", label: "6 x 1.5 L" });
assert.deepEqual(parsePackageMetric("Botella 750 ml"), { amount: 0.75, unit: "L", label: "750 ml" });
assert.equal(comparablePrice(1.5, parsePackageMetric("500 g")), 3);
assert.deepEqual(parseBasePrice("1 kg = 2,99"), { value: 2.99, unit: "kg" });
assert.deepEqual(parseUnitPrice("5,32€/KILO"), { value: 5.32, unit: "kg" });
assert.deepEqual(parseUnitPrice("0,80 € / 100 ml"), { value: 8, unit: "L" });
assert.ok(productMatchScore("panales talla 6", "Panales talla 6") > productMatchScore("panales talla 6", "Panales talla 2"));
assert.equal(productMatchScore("panales talla 6", "Panales talla 2 de 3-6 kg"), 0);
assert.equal(productMatchScore("panales talla 6", "Panales de agua talla S 6 unidades"), 0);
assert.ok(productMatchScore("queso de untar", "Crema de queso natural 250 g") > 0.9);
assert.ok(productMatchScore("picos de pan", "Picos gourmet 130 g") > 0.9);
assert.equal(productMatchScore("picos de pan", "Pan de picos integral"), 0);
assert.ok(productMatchScore("leche entera 1 l", "Leche entera") > 0.9);
assert.ok(productMatchScore("leche entera 1 l", "Leche semidesnatada") < 0.55);
assert.equal(cleanComparisonQuery("1 DISCOS DESM REDONDO"), "DISCOS DESM REDONDO");
assert.deepEqual(queryVariants("queso de untar"), ["queso de untar", "queso untar", "crema de queso"]);
assert.deepEqual(queryVariants("queso de untar natural"), ["queso de untar natural", "queso untar natural", "crema de queso natural"]);
assert.deepEqual(queryVariants("leche entera 1 l"), ["leche entera 1 l", "leche entera"]);
assert.deepEqual(queryVariants("1 discos desm redondo"), ["discos desm redondo", "discos desmaquillantes redondo", "discos desmaquilladores redondo"]);

const mercadonaHit = {
  id: "m1",
  display_name: "Panales bebe talla 6 Deliplus",
  brand: "Deliplus",
  packaging: "Paquete",
  published: true,
  share_url: "https://tienda.mercadona.es/product/m1/test",
  price_instructions: {
    unit_price: "6.30",
    reference_price: "0.287",
    reference_format: "ud",
    unit_size: 22,
    size_format: "ud",
    total_units: 22,
  },
};

const diaItem = {
  object_id: "d1",
  display_name: "Panales talla 6 Dia 28 unidades",
  brand: "Dia Planeta Bebe",
  units_in_stock: 10,
  url: "/infantil/p/d1",
  prices: { price: 8.02, price_per_unit: 0.29, measure_unit: "UNIDAD" },
};

const aldiHit = {
  objectID: "al1",
  name: "Panales bebe talla 6 Aldi 34 uds",
  brandName: "Mamia",
  isAvailable: true,
  isRecall: false,
  productSlug: "panales-bebe-talla-6-aldi-340000",
  currentPrice: { priceValue: 8.84, validFrom: 1783461600 },
  salesUnit: "34 unidades",
  mainCategoryID: "bebe-e-infantil",
  hierarchicalCategories: { lvl1: ["Bebe e infantil > Panales"] },
  assets: [{ type: "primary", url: "https://s7g10.scene7.com/is/image/aldinord/test" }],
};

const carrefourItem = {
  product_id: "c1",
  display_name: "Panales bebe talla 6 Carrefour 30 unidades",
  brand: "Carrefour Baby",
  active_food: true,
  active_price: 9.9,
  unit_conversion_factor: 30,
  unit_short_name: "ud",
  image_for_play_service: "https://static.carrefour.es/test.jpg",
  url_for_play_service: "/supermercado/panales-talla-6/R-c1/p",
};

const alcampoState = {
  data: {
    products: {
      productEntities: {
        a1: {
          productId: "a1",
          retailerProductId: "a100",
          name: "AUCHAN Panales bebe talla 6 40 uds Producto Alcampo",
          brand: "AUCHAN",
          available: true,
          categoryPath: ["Bebe", "Panales y toallitas"],
          price: {
            current: { amount: "8.40", currency: "EUR" },
            unit: { current: { amount: "0.21", currency: "EUR" }, label: "fop.price.per.each" },
          },
          size: { value: "40 uds" },
          image: { src: "https://www.compraonline.alcampo.es/test.jpg" },
        },
      },
    },
  },
};
const alcampoHtml = `<a href="/products/panales-bebe-talla-6/a100">Producto</a><script>window.__INITIAL_STATE__=${JSON.stringify(alcampoState)};</script>`;
const ahorramasLayer = encodeURIComponent(JSON.stringify({
  id: "h1",
  name: "Panales bebe talla 6 Ahorramas 36 uds",
  brand: "Alipende",
  category: "Panales",
  price: "7.92",
}));
const ahorramasHtml = `<div class="product viewed" data-pid="h1"><a href="/panales-talla-6-h1.html" class="product-pdp-link" data-gtm-layer="${ahorramasLayer}"><img class="tile-image" src="https://www.ahorramas.com/test.jpg"></a><span class="unit-price-per-unit grey">0,22€/UD</span><div data-available="true"></div></div>`;
const hipercorHtml = `<script type="application/ld+json">${JSON.stringify({
  "@type": "Product",
  name: "Pañales talla 6 Hipercor 30 unidades",
  sku: "hi1",
  brand: { name: "Hipercor" },
  category: "Bebé",
  image: "https://sgfm.elcorteingles.es/test.jpg",
  url: "/supermercado/panales-test",
  offers: { price: 9.6, availability: "https://schema.org/InStock" },
})}</script>`;
const hipercorCardHtml = `<div class="food-product-preview-responsive food-typeahead-product-preview-responsive" id="B001020616600035"><div class="food-product-preview-responsive__image"><img src="https://sgfm.elcorteingles.es/leche.jpg"></div><div class="food-prices"><div class="food-prices__price">1,17 €</div><div class="food-prices__measurement-unit">( 1,17 € / Litro )</div></div><a class="food-product-preview-responsive__description" href="/supermercado/B001020616600035-asturiana-leche-semidesnatada-brik-1-l/">leche semidesnatada ASTURIANA</a><span class="food-product-preview-responsive__sale_type">brik <span>|</span> 1 l</span></div>`;
const hipercorCurrentCardHtml = `<div class="food-product-preview-responsive" id="B001055763300294"><div class="food-product-preview-responsive__image"><img src="https://sgfm.elcorteingles.es/discos.jpg"></div><div class="food-prices"><div class="food-prices__price">2,09 €</div><div class="food-prices__measurement-unit">( 2,09 € / Unidad )</div></div><a class="food-product-preview-responsive__description" href="/supermercado/B001055763300294-demak-up-discos-desmaquillantes-redondos/">discos desmaquillantes redondos DEMAK UP</a><span class="food-product-preview-responsive__sale_type">bolsa <span>|</span> 72 unidades</span><!--v-if--></div></div>`;
const hipercorMarkdown = `* [![Image 1](https://sgfm.elcorteingles.es/panales.jpg)](http://www.hipercor.es/supermercado/B001028022100999-hipercor-panales-talla-6-paquete-30-unidades/) Añadir Añadir 9,60 € ( 0,32 € / Unidad ) [Pañales talla 6 Hipercor 30 unidades](http://www.hipercor.es/supermercado/B001028022100999-hipercor-panales-talla-6-paquete-30-unidades/)paquete | 30 unidades [(0)](http://www.hipercor.es/supermercado/B001028022100999-hipercor-panales-talla-6-paquete-30-unidades/)`;

assert.equal(parseAlcampoHtml(alcampoHtml)[0].normalizedPrice, 0.21);
assert.equal(parseAhorramasHtml(ahorramasHtml)[0].normalizedPrice, 0.22);
assert.equal(parseHipercorHtml(hipercorHtml)[0].normalizedPrice, 0.32);
assert.equal(parseHipercorHtml(hipercorCardHtml)[0].normalizedPrice, 1.17);
assert.equal(parseHipercorHtml(hipercorCurrentCardHtml)[0].packageAmount, 72);
assert.equal(parseHipercorHtml(hipercorCurrentCardHtml)[0].normalizedPrice, 0.029);
assert.equal(parseHipercorMarkdown(hipercorMarkdown)[0].normalizedPrice, 0.32);
assert.deepEqual(normalizeEnabledStoreKeys(["lidl", "aldi"]), ["aldi"]);

let mercadonaIndexUrl = "";
async function fixtureFetch(url) {
  if (String(url).includes("postal-codes/actions/change-pc")) {
    return new Response(JSON.stringify({ warehouse_changed: false }), { headers: { "x-customer-wh": "mad3" } });
  }
  if (String(url).includes("L9KNU74IO7-dsn.algolia.net")) return new Response(JSON.stringify({ hits: [aldiHit] }));
  if (String(url).includes("7UZJKL1DJ0-dsn.algolia.net")) {
    mercadonaIndexUrl = String(url);
    return new Response(JSON.stringify({ hits: [mercadonaHit] }));
  }
  if (String(url).includes("dia.es")) return new Response(JSON.stringify({ search_items: [diaItem] }));
  if (String(url).includes("api.empathy.co")) return new Response(JSON.stringify({ catalog: { content: [carrefourItem] } }));
  if (String(url).includes("compraonline.alcampo.es")) return new Response(alcampoHtml, { headers: { "content-type": "text/html" } });
  if (String(url).includes("ahorramas.com")) return new Response(ahorramasHtml, { headers: { "content-type": "text/html" } });
  if (String(url).includes("r.jina.ai")) return new Response(hipercorMarkdown, { headers: { "content-type": "text/markdown" } });
  if (String(url).includes("hipercor.es")) return new Response("forbidden", { status: 403 });
  return new Response("not found", { status: 404 });
}

const comparison = await comparePrices("panales talla 6", { fetcher: fixtureFetch, cache: false, limit: 3 });
assert.deepEqual(comparison.stores.map((store) => store.status), ["ok", "ok", "ok", "ok", "ok", "ok", "ok"]);
assert.equal(comparison.comparison.unit, "unit");
assert.equal(comparison.comparison.cheapest.store, "Alcampo");
assert.equal(comparison.comparison.cheapest.offer.normalizedPrice, 0.21);
assert.equal(comparison.stores[0].offers[0].packageAmount, 22);
assert.equal(comparison.stores[0].offers[0].packageLabel, "Paquete | 22 unidades");
assert.match(mercadonaIndexUrl, /products_prod_mad3_es/);
assert.equal(Object.hasOwn(comparison, "upcomingStores"), false);

async function blockedHipercorFetch(url) {
  if (String(url).includes("r.jina.ai")) return new Response("rate limited", { status: 429 });
  if (String(url).includes("hipercor.es")) return new Response("forbidden", { status: 403 });
  return new Response("not found", { status: 404 });
}

const browser = {
  async quickAction(action, options) {
    assert.equal(action, "content");
    assert.match(options.url, /question=discos%20desmaquillantes%20redondo/);
    assert.equal(options.gotoOptions.waitUntil, "networkidle2");
    assert.equal(options.waitForSelector.selector, ".food-product-preview-responsive");
    return new Response(hipercorCurrentCardHtml, { headers: { "content-type": "text/html" } });
  },
};
const browserComparison = await comparePrices("1 DISCOS DESM REDONDO", {
  fetcher: blockedHipercorFetch,
  browser,
  cache: false,
  limit: 3,
  enabledStores: ["hipercor"],
});
assert.equal(browserComparison.stores[0].status, "ok");
assert.equal(browserComparison.query, "DISCOS DESM REDONDO");
assert.equal(browserComparison.stores[0].offers[0].packageAmount, 72);
assert.equal(browserComparison.stores[0].offers[0].normalizedPrice, 0.029);

const limited = await comparePrices("panales talla 6", { fetcher: fixtureFetch, cache: false, limit: 3, enabledStores: ["mercadona", "aldi"] });
assert.deepEqual(limited.stores.map((store) => store.key), ["mercadona", "aldi"]);

console.log("Price comparison tests passed");
