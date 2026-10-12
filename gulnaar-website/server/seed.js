'use strict';

require('dotenv').config();
const pool = require('./db');
const { PRODUCTS } = require('../assets/products');

(async () => {
  try {
    pool.assertDatabaseConfigured();
    const products = PRODUCTS;
    for (const product of products) {
      await pool.query(
        `INSERT INTO products (id, data, active, updated_at)
         VALUES ($1, $2::jsonb, TRUE, NOW())
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, active = TRUE, updated_at = NOW()`,
        [product.id, JSON.stringify(product)],
      );
    }
    console.log(`Seeded ${products.length} products. Inventory values should be reviewed before accepting orders.`);
  } catch (error) {
    console.error('Product seed failed:', error.message || error.code || error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();