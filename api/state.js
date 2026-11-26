// COOTRY 看板 · 云端状态读写接口（Vercel Node serverless）
// 数据文档结构：{ added: {日期: 当日记录}, deleted: [日期], cost: {SKU: {name,pc,lg,ids}} }
const { Pool } = require('pg');

let pool = null;
function getPool() {
  if (pool) return pool;
  const cs = process.env.DATABASE_URL || '';
  const needSsl = /sslmode=require|neon\.tech|supabase\.co|vercel/.test(cs);
  pool = new Pool({
    connectionString: cs,
    ssl: needSsl ? { rejectUnauthorized: false } : false,
    max: 1
  });
  return pool;
}

const DOC_KEY = 'main';

function emptyDoc() {
  return { added: {}, deleted: [], cost: {} };
}

function sendJson(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body) {
      resolve(typeof req.body === 'string' ? safeParse(req.body) : req.body);
      return;
    }
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => resolve(safeParse(raw)));
  });
}
function safeParse(s) {
  try { return s ? JSON.parse(s) : {}; } catch (e) { return {}; }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const body = await readBody(req);

  try {
    const db = getPool();

    if (req.method === 'GET') {
      const r = await db.query('SELECT value FROM kv WHERE key = $1', [DOC_KEY]);
      const doc = r.rows[0] && r.rows[0].value ? r.rows[0].value : emptyDoc();
      doc.added = doc.added || {};
      doc.deleted = doc.deleted || [];
      doc.cost = doc.cost || {};
      return sendJson(res, 200, doc);
    }

    if (req.method === 'POST') {
      const doc = {
        added: body.added && typeof body.added === 'object' ? body.added : {},
        deleted: Array.isArray(body.deleted) ? body.deleted : [],
        cost: body.cost && typeof body.cost === 'object' ? body.cost : {}
      };
      await db.query(
        `INSERT INTO kv (key, value, updated_at)
         VALUES ($1, $2, now())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
        [DOC_KEY, JSON.stringify(doc)]
      );
      return sendJson(res, 200, { ok: true });
    }

    return sendJson(res, 405, { error: 'method not allowed' });
  } catch (e) {
    return sendJson(res, 500, { error: String((e && e.message) || e) });
  }
};
