const test = require('node:test');
const assert = require('node:assert/strict');
const { queryHistory } = require('../electron/history-stats');

const H = 3600e3;
const M = 60e3;
const day0 = new Date(2026, 9, 1).getTime(); // 1 ოქტომბერი 00:00 (ლოკალური დრო)

test('uptime ითვლება მხოლოდ მონიტორინგის დროზე', () => {
  const data = {
    sessions: [
      { start: day0 + 8 * H, end: day0 + 18 * H }, // 10 სთ
      { start: day0 + 33 * H, end: day0 + 41 * H }, // მეორე დღე, 8 სთ
    ],
    outages: [
      { start: day0 + 10 * H, end: day0 + 10 * H + 30 * M, reason: 'unreachable', cause: 'internet', failedAt: 'internet' },
      { start: day0 + 12 * H, end: day0 + 12 * H + 6 * M, reason: 'no-network', cause: 'router', failedAt: 'router' },
    ],
  };
  const { summary } = queryHistory(data, { from: day0, to: day0 + 48 * H, now: day0 + 48 * H });

  assert.equal(summary.monitoredMs, 18 * H);
  assert.equal(summary.downtimeMs, 36 * M);
  assert.equal(summary.uptimePct.toFixed(3), (((18 * 60 - 36) / (18 * 60)) * 100).toFixed(3));
  assert.equal(summary.count, 2);
  assert.equal(summary.longestMs, 30 * M);
  assert.equal(summary.providerCount, 1, 'მხოლოდ failedAt=internet ითვლება პროვაიდერად');
});

test('კომპიუტრის ძილის დრო ოფლაინად არ ითვლება', () => {
  // გათიშვა 22:00 → 08:30, მაგრამ 22:10-დან 08:00-მდე კომპიუტერს ეძინა (სესიები არ არის)
  const data = {
    sessions: [
      { start: day0 + 20 * H, end: day0 + 22 * H + 10 * M },
      { start: day0 + 32 * H, end: day0 + 34 * H },
    ],
    outages: [{ start: day0 + 22 * H, end: day0 + 32 * H + 30 * M, reason: 'unreachable' }],
  };
  const r = queryHistory(data, { from: day0, to: day0 + 48 * H, now: day0 + 34 * H });

  assert.equal(r.summary.downtimeMs, 40 * M); // 10 წთ + 30 წთ
  assert.deepEqual(r.days.map((d) => d.downtimeMs / M), [10, 30]);
});

test('მიმდინარე (დაუსრულებელი) გათიშვა ითვლება "ახლამდე"', () => {
  const now = day0 + 12 * H;
  const data = {
    sessions: [{ start: day0 + 8 * H, end: now }],
    outages: [{ start: now - 15 * M, end: null, reason: 'unreachable' }],
  };
  const r = queryHistory(data, { from: day0, to: day0 + 24 * H, now });

  assert.equal(r.summary.ongoing, true);
  assert.equal(r.summary.downtimeMs, 15 * M);
  assert.equal(r.outages[0].ongoing, true);
});

test('ძველი ჩანაწერის მიზეზი (ქართული ტექსტი) failedAt-იდან კოდად იქცევა', () => {
  const data = {
    sessions: [{ start: 0, end: 100e3 }],
    outages: [
      { start: 10e3, end: 20e3, reason: 'unreachable', cause: 'პრობლემა პროვაიდერის მხარესაა', failedAt: 'internet' },
      { start: 30e3, end: 40e3, reason: 'unreachable', cause: 'dns-server', failedAt: 'dns' },
      { start: 50e3, end: 60e3, reason: 'no-network', cause: null, failedAt: null },
    ],
  };
  const causes = queryHistory(data, { from: 0, to: 100e3, now: 100e3 }).outages.map((o) => o.cause);
  // ახალი — თავში
  assert.deepEqual(causes, [null, 'dns-server', 'internet']);
});

test('ცარიელი ისტორია — uptime უცნობია, გათიშვები 0', () => {
  const r = queryHistory({ sessions: [], outages: [] }, { from: day0, to: day0 + H, now: day0 + H });
  assert.equal(r.summary.uptimePct, null);
  assert.equal(r.summary.count, 0);
  assert.equal(r.days.length, 1);
});
