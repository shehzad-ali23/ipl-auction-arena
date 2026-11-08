'use strict';
const fs = require('fs');
const path = require('path');
let pool = null;

async function init() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.warn('[db] DATABASE_URL not set - running in-memory only (rooms vanish on restart)'); return; }
  const { Pool } = require('pg');
  const local = /localhost|127\.0\.0\.1/.test(url);
  pool = new Pool({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false }, max: 5 });
  await pool.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  console.log('[db] connected, schema ready');
}
async function saveRoom(code, data) {
  if (!pool) return;
  await pool.query(
    'INSERT INTO rooms(code,data,updated_at) VALUES($1,$2,now()) ON CONFLICT (code) DO UPDATE SET data=$2, updated_at=now()',
    [code, data]);
}
async function loadRooms() {
  if (!pool) return [];
  const r = await pool.query("SELECT data FROM rooms WHERE updated_at > now() - interval '24 hours'");
  return r.rows.map(x => x.data);
}
async function deleteRoom(code) { if (pool) await pool.query('DELETE FROM rooms WHERE code=$1', [code]); }
module.exports = { init, saveRoom, loadRooms, deleteRoom };
