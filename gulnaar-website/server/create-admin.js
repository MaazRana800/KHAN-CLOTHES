'use strict';

require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./db');

(async () => {
  const username = String(process.env.ADMIN_USERNAME || '').trim();
  const password = String(process.env.ADMIN_PASSWORD || '');
  try {
    pool.assertDatabaseConfigured();
    if (!username || password.length < 12 || password.startsWith('replace-')) {
      throw new Error('Set ADMIN_USERNAME and a unique ADMIN_PASSWORD of at least 12 characters in .env first.');
    }
    const hash = await bcrypt.hash(password, 12);
    await pool.query(
      `INSERT INTO admin_users (username, password_hash)
       VALUES ($1, $2)
       ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, active = TRUE`,
      [username, hash],
    );
    console.log(`Admin account '${username}' is ready. Remove ADMIN_PASSWORD from the runtime environment.`);
  } catch (error) {
    console.error('Admin creation failed:', error.message || error.code || error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();