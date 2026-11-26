const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const key = req.query.key || 'main_data';
  if (req.method === 'GET') {
    const r = await pool.query('SELECT data_json FROM shop_data WHERE data_key=$1', [key]);
    return res.json(r.rows[0]?.data_json || {});
  }
  if (req.method === 'POST') {
    const payload = req.body;
    await pool.query(`
      INSERT INTO shop_data(data_key, data_json, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT(data_key) DO UPDATE SET data_json=$2, updated_at=NOW()
    `, [key, payload]);
    await pool.query('INSERT INTO operation_log(op_type,remark) VALUES($1,$2)', ['save', key]);
    return res.json({ok:true});
  }
  res.status(404).end();
}
