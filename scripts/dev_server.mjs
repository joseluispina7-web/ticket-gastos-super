import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { comparePrices } from "../server/comparison.js";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 8788);
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};
const localPlan = [];

function sendJson(response, data, status = 200) {
  response.writeHead(status, { "cache-control": "no-store", "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(data));
}

function readJson(request) {
  return new Promise((resolveBody) => {
    let raw = "";
    request.on("data", (chunk) => { raw += chunk; });
    request.on("end", () => {
      try { resolveBody(JSON.parse(raw || "{}")); } catch (_error) { resolveBody({}); }
    });
  });
}

function localPath(requestUrl) {
  const url = new URL(requestUrl, `http://${host}:${port}`);
  const pathname = url.pathname === "/" ? "/web/index.html" : decodeURIComponent(url.pathname);
  const candidate = resolve(root, `.${pathname}`);
  return candidate === root || candidate.startsWith(`${root}${sep}`) ? candidate : null;
}

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url || "/", `http://${host}:${port}`);
  if (request.method === "GET" && requestUrl.pathname === "/api/compare") {
    try {
      const result = await comparePrices(requestUrl.searchParams.get("q"), {
        limit: requestUrl.searchParams.get("limit") || 6,
      });
      sendJson(response, { ok: true, ...result });
    } catch (error) {
      sendJson(response, { error: String(error && error.message || "No se pudo comparar") }, 400);
    }
    return;
  }
  if (requestUrl.pathname === "/api/shopping-plan") {
    if (request.method === "GET") {
      sendJson(response, { ok: true, items: localPlan });
      return;
    }
    if (request.method === "POST") {
      const body = await readJson(request);
      const offer = body.offer || {};
      const existing = localPlan.findIndex((item) => item.storeKey === offer.storeKey && item.productId === String(offer.id));
      const item = {
        id: existing >= 0 ? localPlan[existing].id : crypto.randomUUID(),
        query: body.query || "",
        storeKey: offer.storeKey,
        store: offer.store,
        productId: String(offer.id || ""),
        name: offer.name,
        brand: offer.brand || "",
        price: Number(offer.price || 0),
        normalizedPrice: Number(offer.normalizedPrice || 0),
        normalizedUnit: offer.normalizedUnit || "",
        packageAmount: Number(offer.packageAmount || 0),
        packageLabel: offer.packageLabel || "",
        imageUrl: offer.imageUrl || "",
        productUrl: offer.productUrl || "",
        referencePrice: Number(body.referencePrice || 0),
        checkedAt: body.checkedAt || new Date().toISOString(),
      };
      if (existing >= 0) localPlan[existing] = item;
      else localPlan.push(item);
      sendJson(response, { ok: true });
      return;
    }
    if (request.method === "DELETE") {
      localPlan.splice(0);
      sendJson(response, { ok: true });
      return;
    }
  }
  const localPlanMatch = requestUrl.pathname.match(/^\/api\/shopping-plan\/([^/]+)$/);
  if (request.method === "DELETE" && localPlanMatch) {
    const index = localPlan.findIndex((item) => item.id === localPlanMatch[1]);
    if (index >= 0) localPlan.splice(index, 1);
    sendJson(response, { ok: true });
    return;
  }
  const pathname = localPath(request.url || "/");
  if (!pathname) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  try {
    const stats = statSync(pathname);
    if (!stats.isFile()) throw new Error("Not a file");
    response.writeHead(200, {
      "cache-control": "no-store",
      "content-type": mimeTypes[extname(pathname).toLowerCase()] || "application/octet-stream",
    });
    createReadStream(pathname).pipe(response);
  } catch (_error) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("Not found");
  }
});

server.listen(port, host, () => {
  console.log(`Ticket Gastos Super: http://${host}:${port}/?preview=1`);
});
