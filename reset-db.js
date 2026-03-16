// scripts/reset-db.js
// Run with:  node scripts/reset-db.js
// WARNING: Drops ALL tables and reseeds from scratch.

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt   = require('bcryptjs');
console.log('🔐 Hashing password for seeding…',process.env.DATABASE_URL);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function reset() {
  const client = await pool.connect();
  try {
    console.log('⚠️  Resetting database…');
    await client.query('BEGIN');
    await client.query('DROP TABLE IF EXISTS orders   CASCADE');
    await client.query('DROP TABLE IF EXISTS products CASCADE');
    await client.query('DROP TABLE IF EXISTS users    CASCADE');
    console.log('✅ Tables dropped');
    await client.query('COMMIT');
    console.log('🔄 Re-run `npm start` to recreate and reseed tables.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Reset failed:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

reset();