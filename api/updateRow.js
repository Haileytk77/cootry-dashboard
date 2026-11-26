const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { id, json_data } = body;
    await pool.query(
      `UPDATE dashboard_data SET json_data=$1 WHERE id=$2`,
      [JSON.stringify(json_data), id]
    );
    res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, msg: err.message });
  }
};
