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

module.exports = { normalizePhone, validateOrderPayload, nextOrderStatus };