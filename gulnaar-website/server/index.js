'use strict';

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('node:path');
const fs = require('node:fs');
const { createHmac, timingSafeEqual } = require('node:crypto');
const pool = require('./db');
const { normalizePhone, validateOrderPayload, nextOrderStatus, normalizeAdminProduct } = require('./domain');

const app = express();
const port = Number(process.env.PORT || 3000);
const jwtSecret = process.env.JWT_SECRET || '';
const visitorGateSecret = process.env.VISITOR_GATE_SECRET
  || (process.env.NODE_ENV === 'production' ? '' : 'local-only-visitor-gate-secret');
const siteRoot = path.resolve(__dirname, '..');
const verificationPage = fs.readFileSync(path.join(siteRoot, 'verify.html'), 'utf8')
  .replaceAll('__TURNSTILE_SITE_KEY__', process.env.TURNSTILE_SITE_KEY || '');
const cityFees = {
  Lahore: 200, Karachi: 250, Islamabad: 220, Rawalpindi: 220,
  Faisalabad: 180, Multan: 200, Gujranwala: 180, Sialkot: 180,
  Peshawar: 250, Quetta: 300, Bahawalpur: 220, Sargodha: 200,
};
const coupons = {
  KHAN10: { type: 'percent', value: 10, min: 3000 },
  EID500: { type: 'fixed', value: 500, min: 5000 },
  FREESHIP: { type: 'ship', value: 0, min: 0 },
};

if (process.env.NODE_ENV === 'production' && jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters in production.');
}
if (process.env.NODE_ENV === 'production' && visitorGateSecret.length < 32) {
  throw new Error('VISITOR_GATE_SECRET must be at least 32 characters in production.');
}
if (!jwtSecret) console.warn('JWT_SECRET is not configured. Admin login is disabled until it is set.');

app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://challenges.cloudflare.com'],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://challenges.cloudflare.com'],
      frameSrc: ["'self'", 'https://challenges.cloudflare.com'],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: null,
    },
  },
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim()) : false,
  credentials: true,
}));
app.use(express.json({ limit: '100kb' }));

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false });
const verificationLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false });

function visitorCookieSignature(expiry) {
  return createHmac('sha256', visitorGateSecret).update(expiry).digest('base64url');
}

function hasVerifiedVisitor(req) {
  if (!visitorGateSecret) return false;
  const cookies = (req.headers.cookie || '').split(';');
  const cookie = cookies.map((part) => part.trim()).find((part) => part.startsWith('khan_visitor='));
  if (!cookie) return false;
  const [expiry, signature] = cookie.slice('khan_visitor='.length).split('.');
  if (!expiry || !signature || !/^\d+$/.test(expiry) || Number(expiry) <= Date.now()) return false;
  const expected = Buffer.from(visitorCookieSignature(expiry));
  const received = Buffer.from(signature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

app.use((req, res, next) => {
  if (req.path === '/api/health' || req.path === '/api/verification') return next();
  if (hasVerifiedVisitor(req)) return next();
  if (req.path.startsWith('/api/')) return fail(res, 403, 'Complete visitor verification to continue.');
  res.set('Cache-Control', 'no-store');
  return res.type('html').send(verificationPage);
});

app.post('/api/verification', verificationLimiter, async (req, res, next) => {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  const token = req.body?.token;
  if (!process.env.TURNSTILE_SITE_KEY || !secret) {
    return fail(res, 503, 'Visitor verification is not configured. Please contact the site owner.');
  }
  if (typeof token !== 'string' || token.length === 0 || token.length > 2048) {
    return fail(res, 400, 'Complete the visitor verification challenge.');
  }

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }),
    });
    if (!response.ok) return fail(res, 503, 'Visitor verification is temporarily unavailable.');
    const result = await response.json();
    if (result.success !== true) return fail(res, 403, 'Verification failed. Please try again.');

    const expiry = String(Date.now() + 12 * 60 * 60 * 1000);
    res.cookie('khan_visitor', `${expiry}.${visitorCookieSignature(expiry)}`, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 12 * 60 * 60 * 1000,
      path: '/',
    });
    return res.json({ verified: true });
  } catch (error) {
    return next(error);
  }
});

function fail(res, status, message) {
  return res.status(status).json({ message });
}

function requireAdmin(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token || !jwtSecret) return fail(res, 401, 'Admin authentication required.');
  try {
    req.admin = jwt.verify(token, jwtSecret, { issuer: 'khan-store-api', audience: 'khan-admin' });
    return next();
  } catch {
    return fail(res, 401, 'Admin session expired. Please sign in again.');
  }
}

async function loadOrder(client, code) {
  const { rows } = await client.query(
    `SELECT o.*, p.method AS payment_method, p.status AS payment_status,
            p.txn_id, p.sender_phone, p.verified_at
       FROM orders o JOIN payments p ON p.order_id = o.id
      WHERE o.code = $1`, [code],
  );
  if (!rows[0]) return null;
  const order = rows[0];
  const events = await client.query(
    'SELECT status AS s, note, created_at AS at FROM order_events WHERE order_id = $1 ORDER BY id', [order.id],
  );
  return {
    code: order.code,
    createdAt: order.created_at,
    status: order.status,
    customer: order.customer,
    items: order.items,
    payment: {
      method: order.payment_method,
      status: order.payment_status,
      txn: order.txn_id || '',
      sender: order.sender_phone || '',
      verifiedAt: order.verified_at,
    },
    subtotal: order.subtotal,
    discount: order.discount,
    ship: order.ship,
    total: order.total,
    coupon: order.coupon_code,
    cn: order.tracking_cn || '',
    events: events.rows,
  };
}

app.get('/api/health', async (req, res, next) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (error) { next(error); }
});

app.get('/api/products', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT data FROM products WHERE active = TRUE ORDER BY id');
    res.json(rows.map((row) => row.data));
  } catch (error) { next(error); }
});

app.get('/api/products/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT data FROM products WHERE id = $1 AND active = TRUE', [req.params.id]);
    if (!rows[0]) return fail(res, 404, 'Product not found.');
    res.json(rows[0].data);
  } catch (error) { next(error); }
});

app.post('/api/admin/products', requireAdmin, async (req, res, next) => {
  const { product, errors } = normalizeAdminProduct(req.body);
  if (errors.length) return res.status(400).json({ message: errors[0], errors });
  try {
    const { rows } = await pool.query(
      'INSERT INTO products (id, data, active, updated_at) VALUES ($1, $2::jsonb, TRUE, NOW()) RETURNING data',
      [product.id, JSON.stringify(product)],
    );
    res.status(201).json(rows[0].data);
  } catch (error) {
    if (error.code === '23505') return fail(res, 409, 'A product with that code already exists.');
    next(error);
  }
});

app.put('/api/admin/products/:id', requireAdmin, async (req, res, next) => {
  const { product, errors } = normalizeAdminProduct({ ...req.body, id: req.params.id });
  if (errors.length) return res.status(400).json({ message: errors[0], errors });
  try {
    const { rows } = await pool.query(
      'UPDATE products SET data = $2::jsonb, active = TRUE, updated_at = NOW() WHERE id = $1 RETURNING data',
      [req.params.id, JSON.stringify(product)],
    );
    if (!rows[0]) return fail(res, 404, 'Product not found.');
    res.json(rows[0].data);
  } catch (error) { next(error); }
});

app.delete('/api/admin/products/:id', requireAdmin, async (req, res, next) => {
  try {
    const { rowCount } = await pool.query(
      'UPDATE products SET active = FALSE, updated_at = NOW() WHERE id = $1 AND active = TRUE',
      [req.params.id],
    );
    if (!rowCount) return fail(res, 404, 'Active product not found.');
    res.status(204).end();
  } catch (error) { next(error); }
});

app.post('/api/orders', async (req, res, next) => {
  const errors = validateOrderPayload(req.body);
  if (errors.length) return res.status(400).json({ message: errors[0], errors });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const payload = req.body;
    const pricedItems = [];
    let subtotal = 0;
    for (const requested of payload.items) {
      const result = await client.query('SELECT data FROM products WHERE id = $1 AND active = TRUE FOR UPDATE', [requested.pid]);
      if (!result.rows[0]) throw Object.assign(new Error(`Product ${requested.pid} is unavailable.`), { status: 409 });
      const product = result.rows[0].data;
      const size = product.sizes.find((entry) => entry.s === requested.size);
      if (!size || !product.colors.some((entry) => entry.n === requested.color)) {
        throw Object.assign(new Error(`Selected option is unavailable for ${product.name}.`), { status: 409 });
      }
      if (size.q < Number(requested.qty)) throw Object.assign(new Error(`Insufficient stock for ${product.name} (${requested.size}).`), { status: 409 });
      const price = product.sale ?? product.price;
      subtotal += price * Number(requested.qty);
      pricedItems.push({ pid: product.id, name: product.name, img: product.img, size: requested.size, color: requested.color, qty: Number(requested.qty), price });
      size.q -= Number(requested.qty);
      await client.query('UPDATE products SET data = $2::jsonb, updated_at = NOW() WHERE id = $1', [product.id, JSON.stringify(product)]);
    }

    const city = String(payload.customer.city).trim();
    if (!Object.hasOwn(cityFees, city)) throw Object.assign(new Error('Delivery is not available in that city.'), { status: 400 });
    const couponCode = String(payload.coupon || '').trim().toUpperCase();
    const coupon = couponCode ? coupons[couponCode] : null;
    if (couponCode && !coupon) throw Object.assign(new Error('Coupon code is invalid.'), { status: 400 });
    if (coupon && subtotal < coupon.min) throw Object.assign(new Error('Minimum order amount for this coupon has not been reached.'), { status: 400 });
    const discount = coupon?.type === 'percent' ? Math.round(subtotal * coupon.value / 100) : coupon?.type === 'fixed' ? Math.min(subtotal, coupon.value) : 0;
    const shipping = (subtotal - discount >= 5000 || coupon?.type === 'ship') ? 0 : cityFees[city];
    const method = payload.payment.method;
    const codFee = method === 'cod' ? 0 : 0;
    const total = subtotal - discount + shipping + codFee;
    const paymentStatus = method === 'cod' ? 'Pending' : 'Awaiting Verification';
    const customer = {
      name: String(payload.customer.name).trim().slice(0, 120),
      phone: normalizePhone(payload.customer.phone),
      addr: String(payload.customer.addr).trim().slice(0, 500),
      prov: String(payload.customer.prov || '').trim().slice(0, 100),
      city,
      notes: String(payload.customer.notes || '').trim().slice(0, 1000),
    };
    const day = new Date().toISOString().slice(2, 10).replaceAll('-', '');
    const code = `ORD-${day}-${require('node:crypto').randomBytes(4).toString('hex').toUpperCase()}`;
    const orderResult = await client.query(
      `INSERT INTO orders (code, customer, status, subtotal, discount, ship, total, coupon_code, items)
       VALUES ($1, $2::jsonb, 'Placed', $3, $4, $5, $6, $7, $8::jsonb) RETURNING id`,
      [code, JSON.stringify(customer), subtotal, discount, shipping, total, couponCode || null, JSON.stringify(pricedItems)],
    );
    const orderId = orderResult.rows[0].id;
    const transactionId = method === 'cod' ? null : String(payload.payment.txn).trim();
    await client.query(
      `INSERT INTO payments (order_id, method, status, txn_id, sender_phone)
       VALUES ($1, $2, $3, $4, $5)`,
      [orderId, method, paymentStatus, transactionId, method === 'cod' ? null : normalizePhone(payload.payment.sender)],
    );
    await client.query('INSERT INTO order_events (order_id, status, note) VALUES ($1, $2, $3)', [orderId, 'Placed', 'Order received']);
    await client.query('COMMIT');
    const order = await loadOrder(pool, code);
    return res.status(201).json(order);
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') return fail(res, 409, 'That transaction reference has already been used.');
    if (error.status) return fail(res, error.status, error.message);
    return next(error);
  } finally {
    client.release();
  }
});

app.get('/api/orders/track', async (req, res, next) => {
  try {
    const code = String(req.query.code || '').trim().toUpperCase();
    const phone = normalizePhone(req.query.phone);
    if (!code || !/^03\d{9}$/.test(phone)) return fail(res, 400, 'Order ID and valid mobile number are required.');
    const order = await loadOrder(pool, code);
    if (!order || order.customer.phone !== phone) return fail(res, 404, 'No matching order was found.');
    res.json(order);
  } catch (error) { next(error); }
});

app.post('/api/admin/login', loginLimiter, async (req, res, next) => {
  try {
    if (!jwtSecret) return fail(res, 503, 'Admin authentication is not configured.');
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');
    const { rows } = await pool.query('SELECT id, username, password_hash FROM admin_users WHERE username = $1 AND active = TRUE', [username]);
    const valid = rows[0] && await bcrypt.compare(password, rows[0].password_hash);
    if (!valid) return fail(res, 401, 'Invalid username or password.');
    const token = jwt.sign({ sub: String(rows[0].id), username: rows[0].username }, jwtSecret, {
      issuer: 'khan-store-api', audience: 'khan-admin', expiresIn: '8h',
    });
    res.json({ token, expiresIn: 28800 });
  } catch (error) { next(error); }
});

app.get('/api/admin/orders', requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT code FROM orders ORDER BY created_at DESC LIMIT 500');
    res.json(await Promise.all(rows.map((row) => loadOrder(pool, row.code))));
  } catch (error) { next(error); }
});

app.get('/api/admin/payments', requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT o.code FROM orders o JOIN payments p ON p.order_id = o.id WHERE p.status = 'Awaiting Verification' ORDER BY o.created_at");
    res.json(await Promise.all(rows.map((row) => loadOrder(pool, row.code))));
  } catch (error) { next(error); }
});

app.patch('/api/admin/orders/:code/status', requireAdmin, async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT id, status FROM orders WHERE code = $1 FOR UPDATE', [req.params.code]);
    if (!rows[0]) { await client.query('ROLLBACK'); return fail(res, 404, 'Order not found.'); }
    const nextStatus = String(req.body?.status || '');
    if (!nextOrderStatus(rows[0].status, nextStatus)) { await client.query('ROLLBACK'); return fail(res, 409, 'That order status transition is not allowed.'); }
    const cn = String(req.body?.cn || '').trim();
    if (nextStatus === 'Shipped' && cn.length < 8) { await client.query('ROLLBACK'); return fail(res, 400, 'A valid courier tracking number is required before shipping.'); }
    if (nextStatus === 'Cancelled') {
      const order = await client.query('SELECT items FROM orders WHERE id = $1', [rows[0].id]);
      for (const item of order.rows[0].items) {
        const productResult = await client.query('SELECT data FROM products WHERE id = $1 FOR UPDATE', [item.pid]);
        if (!productResult.rows[0]) continue;
        const product = productResult.rows[0].data;
        const size = product.sizes.find((entry) => entry.s === item.size);
        if (size) {
          size.q += Number(item.qty);
          await client.query('UPDATE products SET data = $2::jsonb, updated_at = NOW() WHERE id = $1', [item.pid, JSON.stringify(product)]);
        }
      }
    }
    await client.query('UPDATE orders SET status = $2, tracking_cn = CASE WHEN $2 = \'Shipped\' THEN $3 ELSE tracking_cn END, updated_at = NOW() WHERE id = $1', [rows[0].id, nextStatus, cn || null]);
    await client.query('INSERT INTO order_events (order_id, status, note) VALUES ($1, $2, $3)', [rows[0].id, nextStatus, String(req.body?.note || '').slice(0, 500)]);
    await client.query('COMMIT');
    res.json(await loadOrder(pool, req.params.code));
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally { client.release(); }
});

app.patch('/api/admin/payments/:code/verify', requireAdmin, async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT o.id, o.status, p.status AS payment_status FROM orders o JOIN payments p ON p.order_id = o.id WHERE o.code = $1 FOR UPDATE OF o, p', [req.params.code]);
    if (!rows[0]) { await client.query('ROLLBACK'); return fail(res, 404, 'Order not found.'); }
    if (rows[0].payment_status !== 'Awaiting Verification') { await client.query('ROLLBACK'); return fail(res, 409, 'Payment is no longer awaiting verification.'); }
    const approved = req.body?.approved === true;
    const status = approved ? 'Paid' : 'Rejected';
    await client.query('UPDATE payments SET status = $2, verified_at = NOW() WHERE order_id = $1', [rows[0].id, status]);
    await client.query('INSERT INTO order_events (order_id, status, note) VALUES ($1, $2, $3)', [rows[0].id, rows[0].status, approved ? 'Payment verified' : 'Payment rejected']);
    await client.query('COMMIT');
    res.json(await loadOrder(pool, req.params.code));
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally { client.release(); }
});

app.use('/assets', express.static(path.join(siteRoot, 'assets'), { dotfiles: 'deny', index: false, fallthrough: false }));
for (const page of ['index.html', 'shop.html', 'product.html', 'checkout.html', 'track.html', 'info.html', 'admin.html']) {
  app.get(page === 'index.html' ? ['/', '/index.html'] : `/${page}`, (req, res) => res.sendFile(path.join(siteRoot, page)));
}

app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) return next(error);
  const status = Number(error.status) || (error.statusCode === 404 ? 404 : 500);
  res.status(status).json({ message: status === 404 ? 'Resource not found.' : 'The server could not complete the request.' });
});

if (require.main === module) {
  const server = app.listen(port, () => console.log(`Khan API listening on port ${port}`));
  async function shutdown() {
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  }
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

module.exports = app;