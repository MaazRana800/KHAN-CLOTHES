'use strict';

require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const pool = require('./db');

(async () => {
  try {
    pool.assertDatabaseConfigured();
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await pool.query(schema);
    console.log('Database schema is up to date.');
  } catch (error) {
    console.error('Database migration failed:', error.message || error.code || error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();