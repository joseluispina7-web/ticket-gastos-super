import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const html = await readFile(resolve("web", "index.html"), "utf8");
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
assert.equal(parsed.items[0].category, "Bebe");
assert.equal(parsed.items[1].quantity, 2);
assert.equal(parsed.items[2].category, "Pescado");
assert.equal(parsed.items[2].quantity, 0.845);
assert.equal(parsed.items[2].name, "SALMON");
assert.equal(guessCategory("panales Dodot talla 6"), "Bebe");
assert.equal(guessCategory("pan integral"), "Panaderia");

const pdfLines = groupPdfLines([
  { str: "PANALES TALLA 6", transform: [1, 0, 0, 1, 20, 700], width: 110 },
  { str: "18,45", transform: [1, 0, 0, 1, 240, 700], width: 32 },
  { str: "TOTAL", transform: [1, 0, 0, 1, 20, 680], width: 40 },
  { str: "18,45", transform: [1, 0, 0, 1, 240, 680], width: 32 },
]);
assert.deepEqual(pdfLines, ["PANALES TALLA 6 18,45", "TOTAL 18,45"]);

console.log("Client parser tests passed");
