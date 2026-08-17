import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

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

function localPath(requestUrl) {
  const url = new URL(requestUrl, `http://${host}:${port}`);
  const pathname = url.pathname === "/" ? "/web/index.html" : decodeURIComponent(url.pathname);
  const candidate = resolve(root, `.${pathname}`);
  return candidate === root || candidate.startsWith(`${root}${sep}`) ? candidate : null;
}

const server = createServer((request, response) => {
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
