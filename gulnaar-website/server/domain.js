'use strict';

const PAYMENT_METHODS = new Set(['cod', 'jazzcash', 'easypaisa', 'bank']);
const ORDER_STATUSES = new Set(['Placed', 'Confirmed', 'Packed', 'Shipped', 'Delivered', 'Cancelled']);

function normalizePhone(value) {
  return String(value || '').replace(/[^0-9]/g, '');
}

function validateOrderPayload(payload) {
  const errors = [];
  const customer = payload?.customer;
  const payment = payload?.payment;
  const items = payload?.items;

  if (!customer || typeof customer !== 'object') errors.push('Customer details are required.');
  if (!String(customer?.name || '').trim()) errors.push('Customer name is required.');
  if (!/^03\d{9}$/.test(normalizePhone(customer?.phone))) errors.push('A valid Pakistani mobile number is required.');
  if (!String(customer?.addr || '').trim()) errors.push('Delivery address is required.');
  if (!String(customer?.city || '').trim()) errors.push('Delivery city is required.');
  if (!payment || !PAYMENT_METHODS.has(payment.method)) errors.push('Select a supported payment method.');
  if (!Array.isArray(items) || items.length === 0 || items.length > 30) errors.push('Order must contain between 1 and 30 items.');

  if (Array.isArray(items)) {
    for (const item of items) {
      if (!item || !String(item.pid || '').trim() || !String(item.size || '').trim() || !String(item.color || '').trim()) {
        errors.push('Each item must include product, size, and color.');
        break;
      }
      if (!Number.isInteger(Number(item.qty)) || Number(item.qty) < 1 || Number(item.qty) > 20) {
        errors.push('Item quantity must be between 1 and 20.');
        break;
      }
    }
  }

  if (payment && PAYMENT_METHODS.has(payment.method) && payment.method !== 'cod') {
    if (String(payment.txn || '').trim().length < 5) errors.push('A valid transaction reference is required.');
    if (payment.method !== 'bank' && !/^03\d{9}$/.test(normalizePhone(payment.sender))) {
      errors.push('A valid sender mobile number is required.');
    }
  }

  return errors;
}

function nextOrderStatus(current, next) {
  const allowed = {
    Placed: ['Confirmed', 'Cancelled'],
    Confirmed: ['Packed', 'Cancelled'],
    Packed: ['Shipped', 'Cancelled'],
    Shipped: ['Delivered'],
    Delivered: [],
    Cancelled: [],
  };
  return ORDER_STATUSES.has(next) && allowed[current]?.includes(next);
}

function normalizeAdminProduct(payload) {
  const errors = [];
  const id = String(payload?.id || '').trim().toUpperCase();
  const name = String(payload?.name || '').trim();
  const category = String(payload?.cat || '').trim().toLowerCase();
  const sub = String(payload?.sub || '').trim();
  const price = Number(payload?.price);
  const sale = payload?.sale === '' || payload?.sale == null ? null : Number(payload.sale);
  const image = String(payload?.img || '').trim();
  const fabric = String(payload?.fabric || '').trim();
  const description = String(payload?.desc || '').trim();
  const colors = payload?.colors;
  const sizes = payload?.sizes;

  if (!/^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(id)) errors.push('Product code must be 3–40 letters, numbers, dashes, or underscores.');
  if (!name || name.length > 120) errors.push('Product name is required and must be under 120 characters.');
  if (!['men', 'women'].includes(category)) errors.push('Choose men or women as the product category.');
  if (!sub || sub.length > 80) errors.push('A short product type is required (maximum 80 characters).');
  if (!Number.isSafeInteger(price) || price < 1 || price > 10000000) errors.push('Price must be a whole number greater than zero.');
  if (sale !== null && (!Number.isSafeInteger(sale) || sale < 1 || sale >= price)) errors.push('Sale price must be less than the regular price.');
  const safeImagePath = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(image) && !image.split('/').includes('..');
  if (!image || image.length > 500 || (!safeImagePath && !/^https:\/\//i.test(image))) errors.push('Provide a valid relative image path or HTTPS image URL.');
  if (!fabric || fabric.length > 120) errors.push('Fabric is required and must be under 120 characters.');
  if (!description || description.length > 3000) errors.push('Description is required and must be under 3000 characters.');
  if (!Array.isArray(colors) || colors.length < 1 || colors.length > 12) errors.push('Provide between 1 and 12 colors.');
  if (Array.isArray(colors) && colors.some((color) => !String(color?.n || '').trim() || String(color.n).length > 40 || !/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(color?.c || '')))) {
    errors.push('Each color needs a name and a valid hex color.');
  }
  if (!Array.isArray(sizes) || sizes.length < 1 || sizes.length > 12) errors.push('Provide between 1 and 12 size/stock entries.');
  if (Array.isArray(sizes) && sizes.some((size) => !String(size?.s || '').trim() || String(size.s).length > 20 || !Number.isInteger(Number(size.q)) || Number(size.q) < 0 || Number(size.q) > 10000)) {
    errors.push('Each size needs a label and stock quantity from 0 to 10000.');
  }
  if (Array.isArray(sizes) && new Set(sizes.map((size) => String(size?.s || '').trim().toLowerCase())).size !== sizes.length) {
    errors.push('Size labels must be unique.');
  }

  if (errors.length) return { product: null, errors };
  return {
    product: {
      id,
      name,
      cat: category,
      sub,
      price,
      sale,
      img: image,
      badge: String(payload.badge || '').trim().slice(0, 30) || null,
      fabric,
      colors: colors.map((color) => ({ n: String(color.n).trim(), c: String(color.c).toLowerCase() })),
      sizes: sizes.map((size) => ({ s: String(size.s).trim(), q: Number(size.q) })),
      rating: Number.isFinite(Number(payload.rating)) ? Math.min(5, Math.max(0, Number(payload.rating))) : 5,
      rc: Number.isInteger(Number(payload.rc)) ? Math.max(0, Number(payload.rc)) : 0,
      desc: description,
      isNew: Boolean(payload.isNew),
    },
    errors: [],
  };
}

module.exports = { normalizePhone, validateOrderPayload, nextOrderStatus, normalizeAdminProduct };