const test = require('node:test');
const assert = require('node:assert/strict');
const { vendorOf } = require('../electron/vendor');

test('მწარმოებელი MAC-ით (oui.db)', () => {
  assert.equal(vendorOf('d4:ff:1a:45:13:6e'), 'Apple');
  assert.equal(vendorOf('48-55-41-73-87-78'), 'Iskratel'); // Windows-ის ფორმატი (ტირეებით)
  assert.equal(vendorOf('08:B4:D2:2D:0A:1E'), 'Intel'); // დიდი ასოებით
  assert.equal(vendorOf('b8:27:eb:00:00:01'), 'Raspberry Pi');
});

test('გრძელი პრეფიქსი (MA-M, 7 სიმბოლო) უპირატესია', () => {
  assert.equal(vendorOf('10:06:48:21:00:00'), 'Dynics');
});

test('შემთხვევითი MAC და არასწორი მნიშვნელობა → null', () => {
  assert.equal(vendorOf('aa:df:e9:4b:2c:20'), null); // locally administered
  assert.equal(vendorOf(null), null);
  assert.equal(vendorOf('not-a-mac'), null);
});
