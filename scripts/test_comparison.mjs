import assert from "node:assert/strict";
import {
  comparePrices,
  comparablePrice,
  parseAhorramasHtml,
  parseAlcampoHtml,
  parseBasePrice,
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
assert.ok(productMatchScore("panales talla 6", "Panales talla 6") > productMatchScore("panales talla 6", "Panales talla 2"));
assert.equal(productMatchScore("panales talla 6", "Panales talla 2 de 3-6 kg"), 0);
assert.equal(productMatchScore("panales talla 6", "Panales de agua talla S 6 unidades"), 0);
assert.ok(productMatchScore("queso de untar", "Crema de queso natural 250 g") > 0.9);
assert.ok(productMatchScore("picos de pan", "Picos gourmet 130 g") > 0.9);
assert.equal(productMatchScore("picos de pan", "Pan de picos integral"), 0);
assert.deepEqual(queryVariants("queso de untar"), ["queso de untar", "queso untar", "crema de queso"]);
assert.deepEqual(queryVariants("queso de untar natural"), ["queso de untar natural", "queso untar natural", "crema de queso natural"]);

const mercadonaHit = {
  id: "m1",
  display_name: "Panales bebe talla 6 Deliplus",
  brand: "Deliplus",
  published: true,
  share_url: "https://tienda.mercadona.es/product/m1/test",
  price_instructions: {
    unit_price: "6.30",
    reference_price: "0.287",
    reference_format: "ud",
    unit_size: 22,
    size_format: "ud",
  },
};

const lidlItem = {
  code: "l1",
  gridbox: {
    data: {
      fullTitle: "Lupilu Panales talla 6",
      brand: { name: "Lupilu" },
      canonicalUrl: "/p/test/p1",
      keyfacts: { description: "<ul><li>64 uds</li></ul>" },
      price: { price: 12.62, packaging: { text: "Paquete" }, basePrice: { text: "" } },
    },
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

assert.equal(parseAlcampoHtml(alcampoHtml)[0].normalizedPrice, 0.21);
assert.equal(parseAhorramasHtml(ahorramasHtml)[0].normalizedPrice, 0.22);

async function fixtureFetch(url) {
  if (String(url).includes("algolia.net")) return new Response(JSON.stringify({ hits: [mercadonaHit] }));
  if (String(url).includes("lidl.es")) return new Response(JSON.stringify({ items: [lidlItem] }));
  if (String(url).includes("dia.es")) return new Response(JSON.stringify({ search_items: [diaItem] }));
  if (String(url).includes("api.empathy.co")) return new Response(JSON.stringify({ catalog: { content: [carrefourItem] } }));
  if (String(url).includes("compraonline.alcampo.es")) return new Response(alcampoHtml, { headers: { "content-type": "text/html" } });
  if (String(url).includes("ahorramas.com")) return new Response(ahorramasHtml, { headers: { "content-type": "text/html" } });
  return new Response("not found", { status: 404 });
}

const comparison = await comparePrices("panales talla 6", { fetcher: fixtureFetch, cache: false, limit: 3 });
assert.deepEqual(comparison.stores.map((store) => store.status), ["ok", "ok", "ok", "ok", "ok", "ok"]);
assert.equal(comparison.comparison.unit, "unit");
assert.equal(comparison.comparison.cheapest.store, "Lidl");
assert.equal(comparison.comparison.cheapest.offer.normalizedPrice, 0.197);
assert.equal(comparison.upcomingStores.length, 0);

console.log("Price comparison tests passed");
