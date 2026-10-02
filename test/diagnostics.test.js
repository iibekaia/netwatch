const test = require('node:test');
const assert = require('node:assert/strict');
const { verdict, codeFor } = require('../electron/diagnostics');
const { i18n, SUPPORTED } = require('../electron/i18n');

const ok = (id) => ({ id, status: 'ok' });
const fail = (id, extra = {}) => ({ id, status: 'fail', ...extra });
const skip = (id) => ({ id, status: 'skip' });

// ყველა სცენარი: რგოლების მდგომარეობა → მოსალოდნელი დასკვნა
const CASES = [
  ['Wi-Fi/კაბელი გათიშულია', [fail('adapter'), skip('router'), skip('internet'), skip('dns'), skip('web')], 'adapter-off', 'adapter'],
  ['როუტერმა IP არ მისცა', [fail('adapter', { dhcp: true }), skip('router'), skip('internet'), skip('dns'), skip('web')], 'adapter-dhcp', 'adapter'],
  ['როუტერი არ პასუხობს', [ok('adapter'), fail('router'), fail('internet'), fail('dns'), fail('web')], 'router', 'router'],
  ['პროვაიდერი', [ok('adapter'), ok('router'), fail('internet'), fail('dns'), fail('web')], 'internet', 'internet'],
  ['DNS სერვერი (1.1.1.1 მუშაობს)', [ok('adapter'), ok('router'), ok('internet'), fail('dns', { altWorks: true }), fail('web')], 'dns-server', 'dns'],
  ['DNS საერთოდ', [ok('adapter'), ok('router'), ok('internet'), fail('dns'), fail('web')], 'dns', 'dns'],
  ['Wi-Fi ავტორიზაცია (captive)', [ok('adapter'), ok('router'), ok('internet'), ok('dns'), fail('web', { captive: true })], 'captive', 'web'],
  ['HTTP იბლოკება', [ok('adapter'), ok('router'), ok('internet'), ok('dns'), fail('web')], 'web', 'web'],
  ['ყველაფერი რიგზეა', [ok('adapter'), ok('router'), ok('internet'), ok('dns'), ok('web')], 'ok', null],
  // როუტერი ping-ს ბლოკავს, მაგრამ ინტერნეტი მუშაობს — პრობლემა არ არის
  ['როუტერი მხოლოდ შემოწმებას ბლოკავს', [ok('adapter'), { id: 'router', status: 'warn' }, ok('internet'), ok('dns'), ok('web')], 'ok', null],
];

for (const [name, steps, code, failedAt] of CASES) {
  test(`დასკვნა: ${name} → ${code}`, () => {
    const v = verdict(steps);
    assert.equal(v.code, code);
    assert.equal(v.failedAt, failedAt);
  });
}

test('ყველა დასკვნის კოდს აქვს სათაური და რჩევა ყველა ენაზე', () => {
  const codes = new Set(CASES.map((c) => c[2]));
  for (const lang of SUPPORTED) {
    i18n.set(lang);
    for (const code of codes) {
      for (const part of ['title', 'advice']) {
        const key = `diag.verdict.${code}.${part}`;
        assert.notEqual(i18n.t(key), key, `${lang}: ${key} არ არის თარგმნილი`);
      }
    }
  }
  i18n.set('en');
});

test('ძველი ჩანაწერებისთვის failedAt → კოდი', () => {
  assert.equal(codeFor('internet'), 'internet');
  assert.equal(codeFor('router'), 'router');
  assert.equal(codeFor('adapter'), 'adapter-off');
  assert.equal(codeFor(null), null);
});
