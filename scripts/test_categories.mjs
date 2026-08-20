import assert from "node:assert/strict";
import {
  classifyCatalogProduct,
  classifyProductName,
  storeKeyFromName,
} from "../server/categories.js";

assert.equal(classifyProductName("COSTILLAR 1/2 PATATA").category, "Carne");
assert.equal(classifyProductName("FILETE PECHUGA").category, "Carne");
assert.equal(classifyProductName("ALBONDIGAS 24 UNID").category, "Carne");
assert.equal(classifyProductName("FILETE MELVA OLIVA").category, "Pescado");
assert.equal(classifyProductName("SALMÓN CON VERDURAS").category, "Pescado");
assert.equal(classifyProductName("SALSA MIEL Y MOSTAZA").category, "Salsas");
assert.equal(classifyProductName("DISCOS DESM REDONDO").category, "Higiene");
assert.equal(classifyProductName("CREMA DE CALABAZA").category, "Platos y conservas");
assert.equal(classifyProductName("BURRATA").category, "Lácteos");
assert.equal(classifyProductName("PROTEÍNA BEBER FRESA").category, "Bebidas");
assert.equal(classifyCatalogProduct("Carnes y aves", "Preparado fresco").category, "Carne");
assert.equal(classifyCatalogProduct("Pescados y mariscos", "Filetes frescos").category, "Pescado");
assert.equal(storeKeyFromName("El Corte Inglés / Hipercor"), "hipercor");
assert.equal(storeKeyFromName("Mercadona"), "mercadona");

console.log("Category classification tests passed");
