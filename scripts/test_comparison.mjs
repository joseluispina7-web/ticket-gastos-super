import assert from "node:assert/strict";
import {
  comparePrices,
  comparablePrice,
  parseBasePrice,
  parsePackageMetric,
  productMatchScore,
} from "../server/comparison.js";

assert.deepEqual(parsePackageMetric("64 uds"), { amount: 64, unit: "unit", label: "64 uds" });
assert.deepEqual(parsePackageMetric("Pack 6 x 1.5 L"), { amount: 9, unit: "L", label: "6 x 1.5 L" });
assert.deepEqual(parsePackageMetric("Botella 750 ml"), { amount: 0.75, unit: "L", label: "750 ml" });
assert.equal(comparablePrice(1.5, parsePackageMetric("500 g")), 3);
assert.deepEqual(parseBasePrice("1 kg = 2,99"), { value: 2.99, unit: "kg" });
assert.ok(productMatchScore("panales talla 6", "Panales talla 6") > productMatchScore("panales talla 6", "Panales talla 2"));
assert.equal(productMatchScore("panales talla 6", "Panales talla 2 de 3-6 kg"), 0);
assert.equal(productMatchScore("panales talla 6", "Panales de agua talla S 6 unidades"), 0);

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

async function fixtureFetch(url) {
  if (String(url).includes("algolia.net")) return new Response(JSON.stringify({ hits: [mercadonaHit] }));
  if (String(url).includes("lidl.es")) return new Response(JSON.stringify({ items: [lidlItem] }));
  if (String(url).includes("dia.es")) return new Response(JSON.stringify({ search_items: [diaItem] }));
  return new Response("not found", { status: 404 });
}

const comparison = await comparePrices("panales talla 6", { fetcher: fixtureFetch, cache: false, limit: 3 });
assert.deepEqual(comparison.stores.map((store) => store.status), ["ok", "ok", "ok"]);
assert.equal(comparison.comparison.unit, "unit");
assert.equal(comparison.comparison.cheapest.store, "Lidl");
assert.equal(comparison.comparison.cheapest.offer.normalizedPrice, 0.197);
assert.equal(comparison.upcomingStores.length, 2);

console.log("Price comparison tests passed");
