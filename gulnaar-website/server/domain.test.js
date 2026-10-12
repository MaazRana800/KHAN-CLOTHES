'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizePhone, validateOrderPayload, nextOrderStatus, normalizeAdminProduct } = require('./domain');

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

test('normalizes a valid admin product payload', () => {
  const result = normalizeAdminProduct({
    id: 'new-kurta-1', name: 'New Kurta', cat: 'men', sub: 'Kurta', price: '5000', sale: '4500',
    img: 'assets/img/new-kurta.jpg', fabric: 'Cotton', desc: 'A quality kurta.', badge: 'New', isNew: true,
    colors: [{ n: 'Navy', c: '#123456' }], sizes: [{ s: 'M', q: '5' }],
  });
  assert.deepEqual(result.errors, []);
  assert.equal(result.product.id, 'NEW-KURTA-1');
  assert.equal(result.product.price, 5000);
  assert.equal(result.product.sizes[0].q, 5);
});

test('rejects unsafe or malformed admin product data', () => {
  const result = normalizeAdminProduct({
    id: 'x', name: '', cat: 'other', sub: '', price: -1, sale: 100,
    img: 'javascript:alert(1)', fabric: '', desc: '', colors: [], sizes: [],
  });
  assert.equal(result.product, null);
  assert.ok(result.errors.length >= 8);
});