import { HTML } from "./html.js";

const MAX_USERS = 3;
const SESSION_DAYS = 45;
const CATEGORIES = [
  "Carne",
  "Lacteos",
  "Fruta",
  "Verdura",
  "Charcuteria",
  "Higiene",
  "Panaderia",
  "Bebidas",
  "Bebe",
  "Limpieza",
  "Cereales y pasta",
  "Platos y conservas",
  "Pescado",
  "Dulces y snacks",
  "Frutos secos",
  "Huevos",
  "Congelados",
  "Mascotas",
  "Hogar",
  "Otros",
];

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function nowIso() {
  return new Date().toISOString();
}

function monthBounds(month) {
  const clean = /^\d{4}-\d{2}$/.test(month || "") ? month : new Date().toISOString().slice(0, 7);
  const [year, monthNumber] = clean.split("-").map(Number);
  const start = `${year}-${pad(monthNumber)}-01`;
  const next = monthNumber === 12 ? `${year + 1}-01-01` : `${year}-${pad(monthNumber + 1)}-01`;
  return { clean, start, next, year: String(year) };
}

function normalizeUsername(username) {
  return String(username || "").trim().toLowerCase();
}

function normalizeProductName(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b\d+\b/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function bytesToHex(bytes) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomHex(size = 16) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  return bytesToHex(await crypto.subtle.digest("SHA-256", bytes));
}

async function hashPassword(password, salt) {
  return sha256Hex(`${salt}:${String(password)}`);
}

function parseCookies(header) {
  const out = {};
  for (const part of String(header || "").split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    out[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return out;
}

function sessionCookie(token, request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return [
    `ticket_session=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_DAYS * 24 * 60 * 60}`,
    secure,
  ].join("; ");
}

function clearSessionCookie(request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `ticket_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

async function ensureSchema(env) {
  const d1 = env.DB;
  await d1.batch([
    d1.prepare(
      "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, salt TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user', created_at TEXT NOT NULL)",
    ),
    d1.prepare(
      "CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL)",
    ),
    d1.prepare(
      "CREATE TABLE IF NOT EXISTS receipts (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, store TEXT NOT NULL, receipt_date TEXT NOT NULL, total REAL NOT NULL, source_name TEXT NOT NULL DEFAULT '', raw_text TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL)",
    ),
    d1.prepare(
      "CREATE TABLE IF NOT EXISTS receipt_items (id TEXT PRIMARY KEY, receipt_id TEXT NOT NULL, user_id TEXT NOT NULL, name TEXT NOT NULL, normalized_name TEXT NOT NULL, category TEXT NOT NULL, quantity REAL NOT NULL DEFAULT 1, unit_price REAL NOT NULL DEFAULT 0, line_total REAL NOT NULL DEFAULT 0, created_at TEXT NOT NULL)",
    ),
    d1.prepare(
      "CREATE TABLE IF NOT EXISTS category_rules (user_id TEXT NOT NULL, normalized_name TEXT NOT NULL, display_name TEXT NOT NULL, category TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (user_id, normalized_name))",
    ),
    d1.prepare("CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS idx_receipts_user_date ON receipts (user_id, receipt_date)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS idx_items_user_category ON receipt_items (user_id, category)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS idx_items_receipt_id ON receipt_items (receipt_id)"),
    d1.prepare("PRAGMA optimize"),
  ]);
}

async function readBody(request) {
  return request.json().catch(() => ({}));
}

async function getUserCount(env) {
  const row = await env.DB.prepare("SELECT COUNT(*) AS count FROM users").first();
  return Number((row && row.count) || 0);
}

async function createSession(env, userId, request) {
  const token = `${crypto.randomUUID()}.${randomHex(24)}`;
  const tokenHash = await sha256Hex(token);
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await env.DB.prepare(
    "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
  )
    .bind(tokenHash, userId, now.toISOString(), expires.toISOString())
    .run();
  return sessionCookie(token, request);
}

async function getCurrentUser(request, env) {
  await ensureSchema(env);
  const token = parseCookies(request.headers.get("cookie")).ticket_session;
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  const row = await env.DB.prepare(
    "SELECT users.id, users.username, users.role, sessions.expires_at FROM sessions INNER JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ?",
  )
    .bind(tokenHash)
    .first();
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
    return null;
  }
  return { id: row.id, username: row.username, role: row.role };
}

async function requireUser(request, env) {
  const user = await getCurrentUser(request, env);
  if (!user) return { response: json({ error: "No autorizado" }, 401) };
  return { user };
}

async function register(request, env) {
  await ensureSchema(env);
  const body = await readBody(request);
  const username = normalizeUsername(body.username);
  const password = String(body.password || "");
  const inviteCode = String(body.inviteCode || "");
  if (!/^[a-z0-9._-]{3,24}$/.test(username)) {
    return json({ error: "Usuario no valido" }, 400);
  }
  if (password.length < 6) {
    return json({ error: "Contrasena demasiado corta" }, 400);
  }
  if (env.INVITE_CODE && inviteCode !== env.INVITE_CODE) {
    return json({ error: "Codigo de invitacion incorrecto" }, 403);
  }
  const count = await getUserCount(env);
  if (count >= MAX_USERS) {
    return json({ error: "Limite de usuarios alcanzado" }, 403);
  }
  const salt = randomHex(16);
  const passwordHash = await hashPassword(password, salt);
  const userId = crypto.randomUUID();
  const role = count === 0 ? "admin" : "user";
  try {
    await env.DB.prepare(
      "INSERT INTO users (id, username, password_hash, salt, role, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
      .bind(userId, username, passwordHash, salt, role, nowIso())
      .run();
  } catch (_error) {
    return json({ error: "Ese usuario ya existe" }, 409);
  }
  const cookie = await createSession(env, userId, request);
  return json({ ok: true, user: { id: userId, username, role } }, 200, { "set-cookie": cookie });
}

async function login(request, env) {
  await ensureSchema(env);
  const body = await readBody(request);
  const username = normalizeUsername(body.username);
  const password = String(body.password || "");
  const row = await env.DB.prepare("SELECT id, username, role, password_hash, salt FROM users WHERE username = ?")
    .bind(username)
    .first();
  if (!row) return json({ error: "Usuario o contrasena incorrectos" }, 401);
  const passwordHash = await hashPassword(password, row.salt);
  if (passwordHash !== row.password_hash) {
    return json({ error: "Usuario o contrasena incorrectos" }, 401);
  }
  const cookie = await createSession(env, row.id, request);
  return json({ ok: true, user: { id: row.id, username: row.username, role: row.role } }, 200, {
    "set-cookie": cookie,
  });
}

async function logout(request, env) {
  await ensureSchema(env);
  const token = parseCookies(request.headers.get("cookie")).ticket_session;
  if (token) {
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256Hex(token)).run();
  }
  return json({ ok: true }, 200, { "set-cookie": clearSessionCookie(request) });
}

function summarize(items, receipts, month) {
  const categoryMap = new Map();
  const productMap = new Map();
  const storeMap = new Map();
  let categoryTotal = 0;
  for (const item of items) {
    const amount = Number(item.line_total || 0);
    categoryTotal += amount;
    categoryMap.set(item.category, (categoryMap.get(item.category) || 0) + amount);
    const productKey = item.normalized_name || normalizeProductName(item.name);
    const current = productMap.get(productKey) || {
      name: item.name,
      category: item.category,
      total: 0,
      count: 0,
      lastPrice: 0,
    };
    current.total += amount;
    current.count += 1;
    current.lastPrice = amount;
    productMap.set(productKey, current);
  }
  for (const receipt of receipts) {
    storeMap.set(receipt.store, (storeMap.get(receipt.store) || 0) + Number(receipt.total || 0));
  }
  const receiptTotal = receipts.reduce((sum, receipt) => sum + Number(receipt.total || 0), 0);
  const categories = [...categoryMap.entries()]
    .map(([category, amount]) => ({ category, amount, percent: categoryTotal ? (amount / categoryTotal) * 100 : 0 }))
    .sort((a, b) => b.amount - a.amount);
  const topProducts = [...productMap.values()].sort((a, b) => b.total - a.total).slice(0, 12);
  const stores = [...storeMap.entries()].map(([store, amount]) => ({ store, amount })).sort((a, b) => b.amount - a.amount);
  return {
    month,
    kpis: {
      total: receiptTotal,
      categoryTotal,
      receipts: receipts.length,
      uniqueProducts: productMap.size,
      topCategory: categories[0] || null,
    },
    categories,
    topProducts,
    stores,
  };
}

async function dashboard(request, env) {
  const auth = await requireUser(request, env);
  if (auth.response) return auth.response;
  const url = new URL(request.url);
  const bounds = monthBounds(url.searchParams.get("month"));
  const receiptsResult = await env.DB.prepare(
    "SELECT id, store, receipt_date, total, source_name, created_at FROM receipts WHERE user_id = ? AND receipt_date >= ? AND receipt_date < ? ORDER BY receipt_date DESC, created_at DESC",
  )
    .bind(auth.user.id, bounds.start, bounds.next)
    .all();
  const itemsResult = await env.DB.prepare(
    "SELECT receipt_items.id, receipt_items.receipt_id, receipt_items.name, receipt_items.normalized_name, receipt_items.category, receipt_items.quantity, receipt_items.unit_price, receipt_items.line_total, receipts.store, receipts.receipt_date FROM receipt_items INNER JOIN receipts ON receipts.id = receipt_items.receipt_id WHERE receipt_items.user_id = ? AND receipts.receipt_date >= ? AND receipts.receipt_date < ? ORDER BY receipts.receipt_date DESC",
  )
    .bind(auth.user.id, bounds.start, bounds.next)
    .all();
  const trendResult = await env.DB.prepare(
    "SELECT substr(receipt_date, 1, 7) AS month, SUM(total) AS total, COUNT(*) AS receipts FROM receipts WHERE user_id = ? AND receipt_date >= ? AND receipt_date < ? GROUP BY substr(receipt_date, 1, 7) ORDER BY month",
  )
    .bind(auth.user.id, `${bounds.year}-01-01`, `${Number(bounds.year) + 1}-01-01`)
    .all();
  const rulesResult = await env.DB.prepare(
    "SELECT normalized_name, display_name, category FROM category_rules WHERE user_id = ? ORDER BY updated_at DESC LIMIT 500",
  )
    .bind(auth.user.id)
    .all();
  const userCount = await getUserCount(env);
  const trend = trendResult.results || [];
  const annualTotal = trend.reduce((sum, row) => sum + Number(row.total || 0), 0);
  const annualReceipts = trend.reduce((sum, row) => sum + Number(row.receipts || 0), 0);
  return json({
    ok: true,
    user: auth.user,
    userCount,
    maxUsers: MAX_USERS,
    categories: CATEGORIES,
    receipts: receiptsResult.results || [],
    items: itemsResult.results || [],
    trend,
    annual: {
      year: bounds.year,
      total: annualTotal,
      receipts: annualReceipts,
      averageTicket: annualReceipts ? annualTotal / annualReceipts : 0,
    },
    rules: rulesResult.results || [],
    summary: summarize(itemsResult.results || [], receiptsResult.results || [], bounds.clean),
  });
}

function cleanStore(store) {
  return String(store || "Supermercado").trim().slice(0, 80) || "Supermercado";
}

function cleanDate(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(date || "")) ? String(date) : new Date().toISOString().slice(0, 10);
}

function cleanCategory(category) {
  return CATEGORIES.includes(category) ? category : "Otros";
}

async function saveReceipt(request, env) {
  const auth = await requireUser(request, env);
  if (auth.response) return auth.response;
  const body = await readBody(request);
  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) return json({ error: "El ticket no tiene lineas" }, 400);
  const receiptId = crypto.randomUUID();
  const createdAt = nowIso();
  const cleanedItems = items
    .map((item) => {
      const name = String(item.name || "").trim().slice(0, 160);
      const quantity = Math.max(Number(item.quantity || 1), 0.001);
      const rawLineTotal = item.lineTotal !== undefined ? item.lineTotal : item.line_total;
      const rawUnitPrice = item.unitPrice !== undefined ? item.unitPrice : item.unit_price;
      const lineTotal = Math.max(Number(rawLineTotal !== undefined ? rawLineTotal : 0), 0);
      const unitPrice = Math.max(Number(rawUnitPrice !== undefined ? rawUnitPrice : lineTotal / quantity), 0);
      return {
        id: crypto.randomUUID(),
        name,
        normalizedName: normalizeProductName(name),
        category: cleanCategory(item.category),
        quantity,
        unitPrice,
        lineTotal,
      };
    })
    .filter((item) => item.name && item.lineTotal >= 0);
  if (!cleanedItems.length) return json({ error: "No hay productos validos" }, 400);
  const total =
    Number(body.total) > 0
      ? Number(body.total)
      : cleanedItems.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);
  const store = cleanStore(body.store);
  const date = cleanDate(body.date);
  const sourceName = String(body.sourceName || "").trim().slice(0, 160);
  const rawText = String(body.rawText || "").slice(0, 50000);
  const statements = [
    env.DB.prepare(
      "INSERT INTO receipts (id, user_id, store, receipt_date, total, source_name, raw_text, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(receiptId, auth.user.id, store, date, total, sourceName, rawText, createdAt),
  ];
  for (const item of cleanedItems) {
    statements.push(
      env.DB.prepare(
        "INSERT INTO receipt_items (id, receipt_id, user_id, name, normalized_name, category, quantity, unit_price, line_total, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ).bind(
        item.id,
        receiptId,
        auth.user.id,
        item.name,
        item.normalizedName,
        item.category,
        item.quantity,
        item.unitPrice,
        item.lineTotal,
        createdAt,
      ),
    );
    if (item.normalizedName) {
      statements.push(
        env.DB.prepare(
          "INSERT INTO category_rules (user_id, normalized_name, display_name, category, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id, normalized_name) DO UPDATE SET display_name = excluded.display_name, category = excluded.category, updated_at = excluded.updated_at",
        ).bind(auth.user.id, item.normalizedName, item.name, item.category, createdAt),
      );
    }
  }
  await env.DB.batch(statements);
  return json({ ok: true, receiptId });
}

async function deleteReceipt(request, env, id) {
  const auth = await requireUser(request, env);
  if (auth.response) return auth.response;
  const receipt = await env.DB.prepare("SELECT id FROM receipts WHERE id = ? AND user_id = ?").bind(id, auth.user.id).first();
  if (!receipt) return json({ error: "Ticket no encontrado" }, 404);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM receipt_items WHERE receipt_id = ? AND user_id = ?").bind(id, auth.user.id),
    env.DB.prepare("DELETE FROM receipts WHERE id = ? AND user_id = ?").bind(id, auth.user.id),
  ]);
  return json({ ok: true });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && !url.pathname.startsWith("/api/")) {
      return new Response(HTML, {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }

    if (request.method === "POST" && url.pathname === "/api/register") return register(request, env);
    if (request.method === "POST" && url.pathname === "/api/login") return login(request, env);
    if (request.method === "POST" && url.pathname === "/api/logout") return logout(request, env);
    if (request.method === "GET" && url.pathname === "/api/me") {
      const user = await getCurrentUser(request, env);
      return user ? json({ ok: true, user }) : json({ error: "No autorizado" }, 401);
    }
    if (request.method === "GET" && url.pathname === "/api/dashboard") return dashboard(request, env);
    if (request.method === "POST" && url.pathname === "/api/receipts") return saveReceipt(request, env);
    const deleteMatch = url.pathname.match(/^\/api\/receipts\/([^/]+)$/);
    if (request.method === "DELETE" && deleteMatch) return deleteReceipt(request, env, deleteMatch[1]);
    return json({ error: "No encontrado" }, 404);
  },
};
