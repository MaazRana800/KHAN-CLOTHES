'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizePhone, validateOrderPayload, nextOrderStatus } = require('./domain');

test('normalizes common Pakistani phone formatting', () => {
  assert.equal(normalizePhone('0300-123 4567'), '03001234567');
});

test('accepts a valid COD order payload', () => {
  const errors = validateOrderPayload({
    customer: { name: 'Customer', phone: '03001234567', addr: 'Street 1', city: 'Lahore' },
    payment: { method: 'cod' },
    items: [{ pid: 'SKU-1', size: 'M', color: 'Black', qty: 1 }],
  });
  assert.deepEqual(errors, []);
});

test('rejects invalid payment details and quantities', () => {
  const errors = validateOrderPayload({
    customer: { name: 'Customer', phone: '123', addr: '', city: '' },
    payment: { method: 'jazzcash', txn: 'x', sender: 'bad' },
    items: [{ pid: 'SKU-1', size: 'M', color: 'Black', qty: 0 }],
  });
  assert.ok(errors.length >= 5);
});

test('allows only forward order transitions and cancellation before shipment', () => {
  assert.equal(nextOrderStatus('Placed', 'Confirmed'), true);
  assert.equal(nextOrderStatus('Packed', 'Shipped'), true);
  assert.equal(nextOrderStatus('Placed', 'Delivered'), false);
  assert.equal(nextOrderStatus('Shipped', 'Cancelled'), false);
});