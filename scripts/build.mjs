import { copyFile, cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distServer = resolve(root, "dist", "server");
const distOpenAI = resolve(root, "dist", ".openai");

await mkdir(distServer, { recursive: true });
await mkdir(distOpenAI, { recursive: true });

const html = await readFile(resolve(root, "web", "index.html"), "utf8");
await cp(resolve(root, "server"), distServer, { recursive: true });
await writeFile(resolve(distServer, "html.js"), `export const HTML = ${JSON.stringify(html)};\n`, "utf8");
await copyFile(resolve(root, ".openai", "hosting.json"), resolve(distOpenAI, "hosting.json"));

console.log("Built Ticket Gastos Super");
