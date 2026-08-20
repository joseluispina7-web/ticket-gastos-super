await import("./test_client.mjs");
await import("./test_comparison.mjs");
await import("./test_categories.mjs");
await import("./build.mjs");

const worker = await import(`../dist/server/index.js?check=${Date.now()}`);
if (!worker.default || typeof worker.default.fetch !== "function") {
  throw new Error("The built server does not export a Worker fetch handler");
}

console.log("Build and server module checks passed");
