import { HTML } from "./html.js";
import {
  COMPARISON_STORES,
  DEFAULT_ENABLED_STORES,
  comparePrices,
  normalizeEnabledStoreKeys,
  searchStoreProducts,
} from "./comparison.js";
import {
  CATEGORIES,
  PRODUCT_CATEGORY_RULES,
  canonicalCategory,
  classifyCatalogProduct,
  classifyProductName,
  storeKeyFromName,
} from "./categories.js";

const MAX_USERS = 3;
const SESSION_DAYS = 45;

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

function cleanProductDisplayName(name) {
  return String(name || "")
    .trim()
    .replace(/^\d+(?:[.,]\d+)?\s+(?=[A-Za-zÁÉÍÓÚÜÑáéíóúüñ])/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

function normalizeProductName(name) {
  return cleanProductDisplayName(name)
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
    d1.prepare(
      "CREATE TABLE IF NOT EXISTS product_category_cache (store_key TEXT NOT NULL, normalized_name TEXT NOT NULL, display_name TEXT NOT NULL, category TEXT NOT NULL, source_category TEXT NOT NULL DEFAULT '', matched_name TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL, PRIMARY KEY (store_key, normalized_name))",
    ),
    d1.prepare(
      "CREATE TABLE IF NOT EXISTS app_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)",
    ),
    d1.prepare(
      "CREATE TABLE IF NOT EXISTS user_settings (user_id TEXT PRIMARY KEY, enabled_stores TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL)",
    ),
    d1.prepare(
      "CREATE TABLE IF NOT EXISTS shopping_plan_items (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, query TEXT NOT NULL, store_key TEXT NOT NULL, store_name TEXT NOT NULL, product_id TEXT NOT NULL, product_name TEXT NOT NULL, brand TEXT NOT NULL DEFAULT '', price REAL NOT NULL, normalized_price REAL NOT NULL DEFAULT 0, normalized_unit TEXT NOT NULL DEFAULT '', package_amount REAL NOT NULL DEFAULT 0, package_label TEXT NOT NULL DEFAULT '', image_url TEXT NOT NULL DEFAULT '', product_url TEXT NOT NULL DEFAULT '', reference_price REAL NOT NULL DEFAULT 0, checked_at TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE (user_id, store_key, product_id))",
    ),
    d1.prepare("CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS idx_receipts_user_date ON receipts (user_id, receipt_date)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS idx_items_user_category ON receipt_items (user_id, category)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS idx_items_receipt_id ON receipt_items (receipt_id)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS idx_plan_user_store ON shopping_plan_items (user_id, store_key)"),
    d1.prepare("PRAGMA optimize"),
  ]);

  const categoryMigration = "2026-08-20-category-rules-v1";
  const applied = await d1.prepare("SELECT name FROM app_migrations WHERE name = ?").bind(categoryMigration).first();
  if (!applied) {
    await d1.batch([
      d1.prepare(
        `UPDATE receipt_items
         SET category = CASE
           WHEN normalized_name LIKE '%albondig%' THEN 'Carne'
           WHEN normalized_name LIKE '%costill%' THEN 'Carne'
           WHEN normalized_name LIKE '%filete pechuga%' THEN 'Carne'
           WHEN normalized_name LIKE '%cuarto trasero%' THEN 'Carne'
           WHEN normalized_name LIKE '%filete melva%' OR normalized_name LIKE '%pota%' THEN 'Pescado'
           WHEN normalized_name LIKE '%burrata%' THEN 'Lácteos'
           WHEN normalized_name LIKE '%champinon%' THEN 'Verdura'
           WHEN normalized_name LIKE '%crema de calabaza%' THEN 'Platos y conservas'
           WHEN normalized_name LIKE '%discos desm%' OR normalized_name LIKE '%laca%' THEN 'Higiene'
           WHEN normalized_name LIKE '%mayonesa%' OR normalized_name LIKE '%salsa %' THEN 'Salsas'
           WHEN normalized_name LIKE '%muesli%' THEN 'Cereales y pasta'
           WHEN normalized_name LIKE '%paraguayo%' OR normalized_name LIKE '%pina%' THEN 'Fruta'
           WHEN normalized_name LIKE '%proteina beber%' THEN 'Bebidas'
           ELSE category
         END
         WHERE normalized_name LIKE '%albondig%'
            OR normalized_name LIKE '%costill%'
            OR normalized_name LIKE '%filete pechuga%'
            OR normalized_name LIKE '%cuarto trasero%'
            OR normalized_name LIKE '%filete melva%'
            OR normalized_name LIKE '%pota%'
            OR normalized_name LIKE '%burrata%'
            OR normalized_name LIKE '%champinon%'
            OR normalized_name LIKE '%crema de calabaza%'
            OR normalized_name LIKE '%discos desm%'
            OR normalized_name LIKE '%laca%'
            OR normalized_name LIKE '%mayonesa%'
            OR normalized_name LIKE '%salsa %'
            OR normalized_name LIKE '%muesli%'
            OR normalized_name LIKE '%paraguayo%'
            OR normalized_name LIKE '%pina%'
            OR normalized_name LIKE '%proteina beber%'`,
      ),
      d1.prepare("DELETE FROM category_rules"),
      d1.prepare("INSERT OR IGNORE INTO app_migrations (name, applied_at) VALUES (?, ?)").bind(categoryMigration, nowIso()),
    ]);
  }
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
    return json({ error: "Usuario no válido" }, 400);
  }
  if (password.length < 6) {
    return json({ error: "Contraseña demasiado corta" }, 400);
  }
  const count = await getUserCount(env);
  if (count >= MAX_USERS) {
    return json({ error: "Límite de usuarios alcanzado" }, 403);
  }
  if (count > 0 && !env.INVITE_CODE) {
    return json({ error: "El registro por invitación no está disponible" }, 503);
  }
  if (count > 0 && inviteCode !== env.INVITE_CODE) {
    return json({ error: "Código de invitación incorrecto" }, 403);
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
  if (!row) return json({ error: "Usuario o contraseña incorrectos" }, 401);
  const passwordHash = await hashPassword(password, row.salt);
  if (passwordHash !== row.password_hash) {
    return json({ error: "Usuario o contraseña incorrectos" }, 401);
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
    const category = canonicalCategory(item.category);
    categoryTotal += amount;
    categoryMap.set(category, (categoryMap.get(category) || 0) + amount);
    const displayName = cleanProductDisplayName(item.name);
    const productKey = item.normalized_name || normalizeProductName(displayName);
    const current = productMap.get(productKey) || {
      name: displayName,
      category,
      total: 0,
      count: 0,
      quantity: 0,
      lastPrice: 0,
    };
    current.total += amount;
    current.count += 1;
    current.quantity += Number(item.quantity || 1);
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
  const items = (itemsResult.results || []).map((item) => ({
    ...item,
    name: cleanProductDisplayName(item.name),
  }));
  const rules = (rulesResult.results || []).map((rule) => ({ ...rule, category: canonicalCategory(rule.category) }));
  const annualTotal = trend.reduce((sum, row) => sum + Number(row.total || 0), 0);
  const annualReceipts = trend.reduce((sum, row) => sum + Number(row.receipts || 0), 0);
  return json({
    ok: true,
    user: auth.user,
    userCount,
    maxUsers: MAX_USERS,
    categories: CATEGORIES,
    classificationRules: PRODUCT_CATEGORY_RULES,
    receipts: receiptsResult.results || [],
    items,
    trend,
    annual: {
      year: bounds.year,
      total: annualTotal,
      receipts: annualReceipts,
      averageTicket: annualReceipts ? annualTotal / annualReceipts : 0,
    },
    rules,
    summary: summarize(items, receiptsResult.results || [], bounds.clean),
  });
}

function cleanStore(store) {
  return String(store || "Supermercado").trim().slice(0, 80) || "Supermercado";
}

function cleanDate(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(date || "")) ? String(date) : new Date().toISOString().slice(0, 10);
}

function cleanCategory(category) {
  return canonicalCategory(category);
}

function cleanReceiptPayload(body) {
  const sourceItems = Array.isArray(body.items) ? body.items : [];
  const items = sourceItems
    .map((item) => {
      const name = cleanProductDisplayName(item.name);
      const quantity = Math.max(Number(item.quantity || 1), 0.001);
      const rawLineTotal = item.lineTotal !== undefined ? item.lineTotal : item.line_total;
      const rawUnitPrice = item.unitPrice !== undefined ? item.unitPrice : item.unit_price;
      const lineTotal = Math.max(Number(rawLineTotal !== undefined ? rawLineTotal : 0), 0);
      const unitPrice = Math.max(Number(rawUnitPrice !== undefined ? rawUnitPrice : lineTotal / quantity), 0);
      const selectedCategory = cleanCategory(item.category);
      const inferred = classifyProductName(name);
      return {
        id: crypto.randomUUID(),
        name,
        normalizedName: normalizeProductName(name),
        category: item.categoryEdited || inferred.category === "Otros" ? selectedCategory : inferred.category,
        categoryEdited: Boolean(item.categoryEdited),
        quantity,
        unitPrice,
        lineTotal,
      };
    })
    .filter((item) => item.name && item.lineTotal >= 0);
  const itemTotal = items.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);
  return {
    items,
    total: Number(body.total) > 0 ? Number(body.total) : itemTotal,
    store: cleanStore(body.store),
    date: cleanDate(body.date),
    sourceName: String(body.sourceName || "").trim().slice(0, 160),
    rawText: Object.prototype.hasOwnProperty.call(body, "rawText")
      ? String(body.rawText || "").slice(0, 50000)
      : null,
  };
}

async function classifyProducts(request, env) {
  const auth = await requireUser(request, env);
  if (auth.response) return auth.response;
  const body = await readBody(request);
  const storeKey = storeKeyFromName(body.store);
  const sourceItems = Array.isArray(body.items) ? body.items.slice(0, 40) : [];
  const items = sourceItems.map((item, index) => ({
    index,
    name: cleanProductDisplayName(item && item.name),
    normalizedName: normalizeProductName(item && item.name),
  })).filter((item) => item.name && item.normalizedName);
  if (!items.length) return json({ ok: true, items: [] });

  const uniqueNames = [...new Set(items.map((item) => item.normalizedName))];
  const placeholders = uniqueNames.map(() => "?").join(",");
  const learnedResult = await env.DB.prepare(
    `SELECT normalized_name, category FROM category_rules WHERE user_id = ? AND normalized_name IN (${placeholders})`,
  ).bind(auth.user.id, ...uniqueNames).all();
  const learned = new Map((learnedResult.results || []).map((row) => [row.normalized_name, canonicalCategory(row.category)]));
  let cached = new Map();
  if (storeKey) {
    const cacheResult = await env.DB.prepare(
      `SELECT normalized_name, category, source_category, matched_name FROM product_category_cache WHERE store_key = ? AND normalized_name IN (${placeholders})`,
    ).bind(storeKey, ...uniqueNames).all();
    cached = new Map((cacheResult.results || []).map((row) => [row.normalized_name, row]));
  }

  const suggestions = items.map((item) => {
    const learnedCategory = learned.get(item.normalizedName);
    if (learnedCategory && learnedCategory !== "Otros") return { ...item, category: learnedCategory, source: "corrección guardada" };
    const inferred = classifyProductName(item.name);
    if (inferred.category !== "Otros") return { ...item, category: inferred.category, source: inferred.source };
    const cache = cached.get(item.normalizedName);
    if (cache) return { ...item, category: canonicalCategory(cache.category), source: "catálogo guardado", matchedName: cache.matched_name, sourceCategory: cache.source_category };
    return { ...item, category: "Otros", source: "sin coincidencia" };
  });

  const pendingLimit = storeKey === "hipercor" ? 2 : 8;
  const pending = storeKey ? suggestions.filter((item) => item.category === "Otros").slice(0, pendingLimit) : [];
  const now = nowIso();
  for (let offset = 0; offset < pending.length; offset += 2) {
    const group = pending.slice(offset, offset + 2);
    await Promise.all(group.map(async (item) => {
      try {
        const offers = await searchStoreProducts(storeKey, item.name, { limit: 3, browser: env.BROWSER, fetcher: fetch });
        const offer = offers[0];
        if (!offer) return;
        const match = classifyCatalogProduct(offer.category, offer.name);
        if (match.category === "Otros") return;
        item.category = match.category;
        item.source = "catálogo del supermercado";
        item.matchedName = offer.name;
        item.sourceCategory = offer.category || "";
        await env.DB.prepare(
          "INSERT INTO product_category_cache (store_key, normalized_name, display_name, category, source_category, matched_name, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(store_key, normalized_name) DO UPDATE SET display_name = excluded.display_name, category = excluded.category, source_category = excluded.source_category, matched_name = excluded.matched_name, updated_at = excluded.updated_at",
        ).bind(storeKey, item.normalizedName, item.name, item.category, item.sourceCategory, item.matchedName, now).run();
      } catch (_error) {
        // Keep the review usable when a supermarket blocks or times out.
      }
    }));
  }

  return json({
    ok: true,
    storeKey,
    items: suggestions.map(({ index, name, category, source, matchedName = "", sourceCategory = "" }) => ({
      index, name, category, source, matchedName, sourceCategory,
    })),
  });
}

function receiptItemStatements(env, userId, receiptId, items, createdAt) {
  const statements = [];
  for (const item of items) {
    statements.push(
      env.DB.prepare(
        "INSERT INTO receipt_items (id, receipt_id, user_id, name, normalized_name, category, quantity, unit_price, line_total, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ).bind(
        item.id,
        receiptId,
        userId,
        item.name,
        item.normalizedName,
        item.category,
        item.quantity,
        item.unitPrice,
        item.lineTotal,
        createdAt,
      ),
    );
    if (item.normalizedName && item.categoryEdited) {
      statements.push(
        env.DB.prepare(
          "INSERT INTO category_rules (user_id, normalized_name, display_name, category, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id, normalized_name) DO UPDATE SET display_name = excluded.display_name, category = excluded.category, updated_at = excluded.updated_at",
        ).bind(userId, item.normalizedName, item.name, item.category, createdAt),
      );
    }
  }
  return statements;
}

async function saveReceipt(request, env) {
  const auth = await requireUser(request, env);
  if (auth.response) return auth.response;
  const body = await readBody(request);
  const payload = cleanReceiptPayload(body);
  if (!payload.items.length) return json({ error: "El ticket no tiene líneas válidas" }, 400);
  const receiptId = crypto.randomUUID();
  const createdAt = nowIso();
  const statements = [
    env.DB.prepare(
      "INSERT INTO receipts (id, user_id, store, receipt_date, total, source_name, raw_text, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(
      receiptId,
      auth.user.id,
      payload.store,
      payload.date,
      payload.total,
      payload.sourceName,
      payload.rawText || "",
      createdAt,
    ),
    ...receiptItemStatements(env, auth.user.id, receiptId, payload.items, createdAt),
  ];
  await env.DB.batch(statements);
  return json({ ok: true, receiptId });
}

async function updateReceipt(request, env, id) {
  const auth = await requireUser(request, env);
  if (auth.response) return auth.response;
  const receipt = await env.DB.prepare("SELECT id FROM receipts WHERE id = ? AND user_id = ?").bind(id, auth.user.id).first();
  if (!receipt) return json({ error: "Ticket no encontrado" }, 404);
  const payload = cleanReceiptPayload(await readBody(request));
  if (!payload.items.length) return json({ error: "El ticket no tiene líneas válidas" }, 400);
  const updatedAt = nowIso();
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE receipts SET store = ?, receipt_date = ?, total = ?, source_name = ?, raw_text = COALESCE(?, raw_text) WHERE id = ? AND user_id = ?",
    ).bind(
      payload.store,
      payload.date,
      payload.total,
      payload.sourceName,
      payload.rawText,
      id,
      auth.user.id,
    ),
    env.DB.prepare("DELETE FROM receipt_items WHERE receipt_id = ? AND user_id = ?").bind(id, auth.user.id),
    ...receiptItemStatements(env, auth.user.id, id, payload.items, updatedAt),
  ]);
  return json({ ok: true, receiptId: id });
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

async function readUserEnabledStores(env, userId) {
  const row = await env.DB.prepare("SELECT enabled_stores FROM user_settings WHERE user_id = ?")
    .bind(userId)
    .first();
  return normalizeEnabledStoreKeys(row && row.enabled_stores ? row.enabled_stores.split(",") : DEFAULT_ENABLED_STORES);
}

async function getSettings(request, env) {
  const auth = await requireUser(request, env);
  if (auth.response) return auth.response;
  return json({
    ok: true,
    stores: COMPARISON_STORES,
    enabledStores: await readUserEnabledStores(env, auth.user.id),
  });
}

async function saveSettings(request, env) {
  const auth = await requireUser(request, env);
  if (auth.response) return auth.response;
  const body = await readBody(request);
  if (!Array.isArray(body.enabledStores)) return json({ error: "Selección no válida" }, 400);
  const validStoreKeys = new Set(COMPARISON_STORES.map((store) => store.key));
  const selected = body.enabledStores
    .map((key) => String(key || "").trim().toLowerCase())
    .filter((key) => validStoreKeys.has(key));
  if (!selected.length) return json({ error: "Selecciona al menos un supermercado" }, 400);
  const enabledStores = normalizeEnabledStoreKeys(selected);
  await env.DB.prepare(
    "INSERT INTO user_settings (user_id, enabled_stores, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET enabled_stores = excluded.enabled_stores, updated_at = excluded.updated_at",
  )
    .bind(auth.user.id, enabledStores.join(","), nowIso())
    .run();
  return json({ ok: true, stores: COMPARISON_STORES, enabledStores });
}

async function compareSearch(request, env) {
  const auth = await requireUser(request, env);
  if (auth.response) return auth.response;
  const url = new URL(request.url);
  const query = String(url.searchParams.get("q") || "").trim();
  const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit") || 6), 8));
  try {
    const enabledStores = await readUserEnabledStores(env, auth.user.id);
    return json({ ok: true, ...(await comparePrices(query, { limit, enabledStores, browser: env.BROWSER })) });
  } catch (error) {
    return json({ error: String(error && error.message || "No se pudo comparar") }, 400);
  }
}

function planItemFromRow(row) {
  return {
    id: row.id,
    query: row.query,
    storeKey: row.store_key,
    store: row.store_name,
    productId: row.product_id,
    name: row.product_name,
    brand: row.brand,
    price: Number(row.price || 0),
    normalizedPrice: Number(row.normalized_price || 0),
    normalizedUnit: row.normalized_unit,
    packageAmount: Number(row.package_amount || 0),
    packageLabel: row.package_label,
    imageUrl: row.image_url,
    productUrl: row.product_url,
    referencePrice: Number(row.reference_price || 0),
    checkedAt: row.checked_at,
    createdAt: row.created_at,
  };
}

async function getShoppingPlan(request, env) {
  const auth = await requireUser(request, env);
  if (auth.response) return auth.response;
  const result = await env.DB.prepare(
    "SELECT * FROM shopping_plan_items WHERE user_id = ? ORDER BY store_name, product_name",
  )
    .bind(auth.user.id)
    .all();
  return json({ ok: true, items: (result.results || []).map(planItemFromRow) });
}

function safeProductUrl(value) {
  try {
    const url = new URL(String(value || ""));
    const allowed = [
      "tienda.mercadona.es",
      "prod-mercadona.imgix.net",
      "www.dia.es",
      "www.carrefour.es",
      "static.carrefour.es",
      "www.compraonline.alcampo.es",
      "www.ahorramas.com",
      "www.aldi.es",
      "www.hipercor.es",
      "www.elcorteingles.es",
      "sgfm.elcorteingles.es",
      "s7g10.scene7.com",
    ];
    return url.protocol === "https:" && allowed.includes(url.hostname) ? url.toString().slice(0, 700) : "";
  } catch (_error) {
    return "";
  }
}

async function saveShoppingPlanItem(request, env) {
  const auth = await requireUser(request, env);
  if (auth.response) return auth.response;
  const body = await readBody(request);
  const offer = body.offer && typeof body.offer === "object" ? body.offer : {};
  const stores = {
    mercadona: "Mercadona",
    dia: "DIA",
    carrefour: "Carrefour",
    alcampo: "Alcampo",
    ahorramas: "Ahorramas",
    aldi: "Aldi",
    hipercor: "Hipercor",
  };
  const storeKey = String(offer.storeKey || "").toLowerCase();
  const storeName = stores[storeKey];
  const productId = String(offer.id || "").trim().slice(0, 160);
  const productName = String(offer.name || "").trim().slice(0, 240);
  const price = Number(offer.price || 0);
  if (!storeName || !productId || !productName || !(price > 0)) {
    return json({ error: "Producto no válido" }, 400);
  }
  const id = crypto.randomUUID();
  const createdAt = nowIso();
  await env.DB.prepare(
    "INSERT INTO shopping_plan_items (id, user_id, query, store_key, store_name, product_id, product_name, brand, price, normalized_price, normalized_unit, package_amount, package_label, image_url, product_url, reference_price, checked_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, store_key, product_id) DO UPDATE SET query = excluded.query, product_name = excluded.product_name, brand = excluded.brand, price = excluded.price, normalized_price = excluded.normalized_price, normalized_unit = excluded.normalized_unit, package_amount = excluded.package_amount, package_label = excluded.package_label, image_url = excluded.image_url, product_url = excluded.product_url, reference_price = excluded.reference_price, checked_at = excluded.checked_at",
  )
    .bind(
      id,
      auth.user.id,
      String(body.query || "").trim().slice(0, 80),
      storeKey,
      storeName,
      productId,
      productName,
      String(offer.brand || "").trim().slice(0, 120),
      price,
      Math.max(Number(offer.normalizedPrice || 0), 0),
      ["kg", "L", "unit"].includes(offer.normalizedUnit) ? offer.normalizedUnit : "",
      Math.max(Number(offer.packageAmount || 0), 0),
      String(offer.packageLabel || "").trim().slice(0, 160),
      safeProductUrl(offer.imageUrl),
      safeProductUrl(offer.productUrl),
      Math.max(Number(body.referencePrice || 0), 0),
      String(body.checkedAt || createdAt).slice(0, 40),
      createdAt,
    )
    .run();
  return json({ ok: true });
}

async function deleteShoppingPlanItem(request, env, id) {
  const auth = await requireUser(request, env);
  if (auth.response) return auth.response;
  await env.DB.prepare("DELETE FROM shopping_plan_items WHERE id = ? AND user_id = ?").bind(id, auth.user.id).run();
  return json({ ok: true });
}

async function clearShoppingPlan(request, env) {
  const auth = await requireUser(request, env);
  if (auth.response) return auth.response;
  await env.DB.prepare("DELETE FROM shopping_plan_items WHERE user_id = ?").bind(auth.user.id).run();
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
    if (request.method === "POST" && url.pathname === "/api/classify-products") return classifyProducts(request, env);
    if (request.method === "GET" && url.pathname === "/api/compare") return compareSearch(request, env);
    if (request.method === "GET" && url.pathname === "/api/settings") return getSettings(request, env);
    if (request.method === "PUT" && url.pathname === "/api/settings") return saveSettings(request, env);
    if (request.method === "GET" && url.pathname === "/api/shopping-plan") return getShoppingPlan(request, env);
    if (request.method === "POST" && url.pathname === "/api/shopping-plan") return saveShoppingPlanItem(request, env);
    if (request.method === "DELETE" && url.pathname === "/api/shopping-plan") return clearShoppingPlan(request, env);
    if (request.method === "POST" && url.pathname === "/api/receipts") return saveReceipt(request, env);
    const receiptMatch = url.pathname.match(/^\/api\/receipts\/([^/]+)$/);
    if (request.method === "PUT" && receiptMatch) return updateReceipt(request, env, receiptMatch[1]);
    if (request.method === "DELETE" && receiptMatch) return deleteReceipt(request, env, receiptMatch[1]);
    const planDeleteMatch = url.pathname.match(/^\/api\/shopping-plan\/([^/]+)$/);
    if (request.method === "DELETE" && planDeleteMatch) return deleteShoppingPlanItem(request, env, planDeleteMatch[1]);
    return json({ error: "No encontrado" }, 404);
  },
};
