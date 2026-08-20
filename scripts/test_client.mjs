import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const html = await readFile(resolve("web", "index.html"), "utf8");
assert.doesNotMatch(html, /data-compare-receipt-product/);
assert.doesNotMatch(html, /data-compare-product/);
assert.match(html, /Mercadona, DIA, Carrefour, Alcampo, Ahorramas, Aldi e Hipercor/);
assert.match(html, /data-view="settings"/);
assert.match(html, /data-edit=/);
assert.match(html, /method: receiptId \? "PUT" : "POST"/);
assert.match(html, /Gasto por supermercado/);
assert.match(html, /offer-original/);
assert.match(html, /offer\.discountPercent/);
assert.match(html, /Precio vigente rebajado/);
assert.match(html, /Formato estimado/);
assert.match(html, /offer\.priceIsUnitPrice/);
assert.match(html, /store\.emptyReason/);
assert.doesNotMatch(html, /Mercadona, Lidl/);
const script = html.split("<script>")[1].split("</script>")[0];
const constants = script.slice(script.indexOf("var CATEGORY_COLORS"), script.indexOf("var els ="));
const functions = script.slice(script.indexOf("function groupPdfLines"), script.indexOf("function categoryOptions"));

const createParser = new Function(`
  ${constants}
  var state = { dashboard: { rules: [] } };
  var els = { ticketFile: { files: [] } };
  ${functions}
  return { parseReceiptText, guessCategory, groupPdfLines };
`);

const { parseReceiptText, guessCategory, groupPdfLines } = createParser();

const carrefour = [
  "CARREFOUR",
  "15/08/2026 18:42",
  "8437000123456 PANALES TALLA 6 18,45",
  "2 x 1,25 LECHE ENTERA 2,50",
  "0,845 kg SALMON 9,99 EUR/kg 8,44",
  "TOTAL 29,39",
].join("\n");

const parsed = parseReceiptText(carrefour);
assert.equal(parsed.store, "Carrefour");
assert.equal(parsed.date, "2026-08-15");
assert.equal(parsed.total, 29.39);
assert.equal(parsed.items.length, 3);
assert.equal(parsed.items[0].category, "Bebé");
assert.equal(parsed.items[1].quantity, 2);
assert.equal(parsed.items[2].category, "Pescado");
assert.equal(parsed.items[2].quantity, 0.845);
assert.equal(parsed.items[2].name, "SALMÓN");
assert.equal(guessCategory("pañales Dodot talla 6"), "Bebé");
assert.equal(guessCategory("pan integral"), "Panadería");

const carrefourMultiline = [
  "Centros",
  "Comerciales",
  "Carrefour",
  "CIF: A28425270",
  "Telf. Directo Tienda 675087697",
  "TINGA",
  "DE",
  "POLLO",
  "4,09",
  "CREMA",
  "QUESO",
  "CABRA",
  "1,27",
  "QUESO",
  "UNTAR",
  "NATURAL",
  "2 x ( 1,24 )",
  "2,48",
  "PLATANO",
  "1,29",
  "NAPOLITANA",
  "SUREME",
  "2 x ( 0,79 )",
  "1,58",
  "RONDO",
  "YOGUR",
  "2,95",
  "PIN. MOR CERDO ADOB",
  "3,00",
  "SECRETO CERDO VACIO",
  "3,58",
  "BOLSA 48X60CM",
  "0,15",
  "11 ART. TOTAL A PAGAR :",
  "20,39",
  "TOTAL VENTAJAS EN ESTA COMPRA:",
  "0,21",
  "Saldo acumulado a 27/09/2024:0,06 €",
].join("\n");

const parsedMultiline = parseReceiptText(carrefourMultiline);
assert.equal(parsedMultiline.store, "Carrefour");
assert.equal(parsedMultiline.date, "2024-09-27");
assert.equal(parsedMultiline.total, 20.39);
assert.equal(parsedMultiline.items.length, 9);
assert.equal(parsedMultiline.items[0].name, "TINGA DE POLLO");
assert.equal(parsedMultiline.items[2].name, "QUESO UNTAR NATURAL");
assert.equal(parsedMultiline.items[2].quantity, 2);
assert.equal(parsedMultiline.items[2].unitPrice, 1.24);
assert.equal(parsedMultiline.items[2].lineTotal, 2.48);
assert.equal(parsedMultiline.items.at(-1).name, "BOLSA 48X60CM");
assert.ok(!parsedMultiline.items.some((item) => item.name.includes("Saldo") || item.lineTotal === 0.06));

const hipercor = [
  "HIPERCOR",
  "EL CORTE INGLES, S.A.",
  "SANCHINARRO HIPER",
  "17/ago/26 20:43",
  "Descripcion Cantidad Importe",
  "VINAGRE VINO BLANCO 1 B 0,69",
  "MENTA CON CHOCOLATE 1 B 3,45",
  "BATIDO COLACAO SHAKE 1 B 1,67",
  "KINDER MAXI 10 UNIDA 2 B 7,98",
  "Precio unitario 3,99",
  "CUCARACHICIDA 1 C 5,05",
  "SUBTOTAL 18.84",
  "IVA INCLUIDO",
  "(B) IMP 10,00% 12,54 1,25 13,79",
  "(C) IMP 21,00% 4,17 0,88 5,05",
  "TOTAL COMPRA EUR 18,84",
  "EFECTIVO 50,00",
  "CAMBIO 31,16",
  "( N. TOTAL DE ARTICULOS: 6 )"
].join("\n");

const parsedHipercor = parseReceiptText(hipercor);
assert.equal(parsedHipercor.store, "Hipercor");
assert.equal(parsedHipercor.date, "2026-08-17");
assert.equal(parsedHipercor.total, 18.84);
assert.equal(parsedHipercor.items.length, 5);
assert.equal(parsedHipercor.items[0].name, "VINAGRE VINO BLANCO");
assert.equal(parsedHipercor.items[3].name, "KINDER MAXI 10 UNIDADES");
assert.equal(parsedHipercor.items[3].quantity, 2);
assert.equal(parsedHipercor.items[3].unitPrice, 3.99);
assert.equal(parsedHipercor.items[1].category, "Dulces y snacks");
assert.equal(parsedHipercor.items[2].category, "Lácteos");
assert.equal(parsedHipercor.items[3].category, "Dulces y snacks");
assert.equal(parsedHipercor.items[4].category, "Limpieza");
assert.ok(!parsedHipercor.items.some((item) => /Precio unitario|IVA|EFECTIVO/i.test(item.name)));

const hipercorMobileOcr = [
  "EL CORTE INGLES, S.A.",
  "SANCHINARRO HIFER",
  "17/ago/26 20:43",
  "VINAGRE VINO EL.ANCO 18 0,69",
  "MENTA CON CHOCOLATE 18 3,45",
  "BATIDO COLACAC SHAKE 18 1,67",
  "KINDER MAXI 1(1 UNIDA 28 7,98",
  "Precio unitario 3,99",
  "CUCARACHICIDA 1C 5,05",
  "SUBTOTAL 18,84",
  "TOTAL COMPRA EUR 18,84"
].join("\n");

const parsedHipercorMobile = parseReceiptText(hipercorMobileOcr);
assert.equal(parsedHipercorMobile.store, "Hipercor");
assert.equal(parsedHipercorMobile.items.length, 5);
assert.equal(parsedHipercorMobile.items[0].name, "VINAGRE VINO BLANCO");
assert.equal(parsedHipercorMobile.items[0].category, "Platos y conservas");
assert.equal(parsedHipercorMobile.items[1].name, "MENTA CON CHOCOLATE");
assert.equal(parsedHipercorMobile.items[2].name, "BATIDO COLACAO SHAKE");
assert.equal(parsedHipercorMobile.items[3].name, "KINDER MAXI 10 UNIDADES");
assert.equal(parsedHipercorMobile.items[3].quantity, 2);
assert.equal(parsedHipercorMobile.items[3].unitPrice, 3.99);
assert.equal(parsedHipercorMobile.items[3].category, "Dulces y snacks");
assert.equal(parsedHipercorMobile.items[4].name, "CUCARACHICIDA");
assert.equal(parsedHipercorMobile.items[4].category, "Limpieza");

const mercadonaDigital = [
  "MERCADONA, S.A. A-46103834",
  "11/08/2026 11:22 OP: 3125441",
  "Descripción P. Unit Importe",
  "1 CUARTO TRASERO 2 UND 3,63",
  "1 BURGER CON QUESO 3,00",
  "1 PARAGUAYO BANDEJA 1,80",
  "1 COSTILLAR 1/2 PATATA 7,00",
  "2 SALMÓN CON VERDURAS 5,75 11,50",
  "1 KÉFIR 1,10",
  "1 CREMA DE CALABAZA 1,70",
  "1 DISCOS DESM REDONDO 1,00",
  "1 QUESO FETA 2,40",
  "1 ZANAHORIA 500 G 0,80",
  "1 MEJILLÓN NATURAL 2,00",
  "1 TACOS DE POTA AJILLO 3,20",
  "1 CHAMPIÑÓN LIMPIO LAM 1,69",
  "1 BURRATA 2,20",
  "1 PIÑA PELADA RODAJAS 3,98",
  "1 KIWI VERDE BANDEJA 5,17",
  "1 ALMENDRA TOST S/PIEL 2,90",
  "1 PISTACHO TOST 0% SAL 3,40",
  "1 PROTEÍNA BEBER FRESA 1,15",
  "1 SALSA MIEL Y MOSTAZA 1,45",
  "1 MUESLI QUINOA CHIA 2,40",
  "1 SOLOMILLO CERDO 3,65",
  "1 SOLOMILLO CERDO 3,85",
  "1 LACA XTRAFORTE 1,90",
  "1 FILETE MELVA OLIVA 1,85",
  "1 GAZPACHO FRESCO 1,10",
  "1 AGUACATE BANDEJA 3,18",
  "1 FILETE PECHUGA 4,83",
  "1 ALBONDIGAS 24 UNID. 4,55",
  "1 MAYONESA BOCA ABAJO 1,40",
  "1 TOMATE ROSA",
  "0,388 kg 2,70 €/kg 1,05",
  "1 MANGO",
  "0,522 kg 3,25 €/kg 1,70",
  "1 PARKING 0,00",
  "TOTAL (€) 92,53",
  "TARJETA BANCARIA 12,53",
  "ENTREGA EFECTIVO 80,00",
  "IVA BASE IMPONIBLE (€) CUOTA (€)",
  "TOTAL 85,26 7,27"
].join("\n");

const parsedMercadona = parseReceiptText(mercadonaDigital);
assert.equal(parsedMercadona.store, "Mercadona");
assert.equal(parsedMercadona.date, "2026-08-11");
assert.equal(parsedMercadona.total, 92.53);
assert.equal(parsedMercadona.items.find((item) => item.name === "SALMÓN CON VERDURAS").quantity, 2);
assert.equal(parsedMercadona.items.find((item) => item.name === "SALMÓN CON VERDURAS").unitPrice, 5.75);
assert.equal(parsedMercadona.items.find((item) => item.name === "ZANAHORIA").quantity, 1);
assert.equal(parsedMercadona.items.find((item) => item.name === "ALBÓNDIGAS 24 UNID").quantity, 1);
assert.equal(parsedMercadona.items.find((item) => item.name === "TOMATE ROSA").quantity, 0.388);
assert.equal(parsedMercadona.items.find((item) => item.name === "MANGO").quantity, 0.522);
assert.equal(parsedMercadona.items.find((item) => item.name === "SALSA MIEL Y MOSTAZA").category, "Salsas");
assert.equal(parsedMercadona.items.find((item) => item.name === "MAYONESA BOCA ABAJO").category, "Salsas");
assert.equal(parsedMercadona.items.find((item) => item.name === "FILETE MELVA OLIVA").category, "Pescado");
assert.equal(parsedMercadona.items.find((item) => item.name === "ALBÓNDIGAS 24 UNID").category, "Carne");
assert.equal(parsedMercadona.items.find((item) => item.name === "COSTILLAR 1/2 PATATA").category, "Carne");
assert.equal(parsedMercadona.items.find((item) => item.name === "FILETE PECHUGA").category, "Carne");
assert.equal(parsedMercadona.items.find((item) => item.name === "MUESLI QUINOA CHIA").category, "Cereales y pasta");
assert.equal(parsedMercadona.items.find((item) => item.name === "LACA XTRAFORTE").category, "Higiene");
assert.equal(parsedMercadona.items.find((item) => item.name === "DISCOS DESM REDONDO").category, "Higiene");
assert.equal(parsedMercadona.items.find((item) => item.name === "PROTEÍNA BEBER FRESA").category, "Bebidas");
assert.equal(parsedMercadona.items.length, 32);

const pdfLines = groupPdfLines([
  { str: "PANALES TALLA 6", transform: [1, 0, 0, 1, 20, 700], width: 110 },
  { str: "18,45", transform: [1, 0, 0, 1, 240, 700], width: 32 },
  { str: "TOTAL", transform: [1, 0, 0, 1, 20, 680], width: 40 },
  { str: "18,45", transform: [1, 0, 0, 1, 240, 680], width: 32 },
]);
assert.deepEqual(pdfLines, ["PANALES TALLA 6 18,45", "TOTAL 18,45"]);

console.log("Client parser tests passed");
