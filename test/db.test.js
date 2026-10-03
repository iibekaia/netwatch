const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { openDatabase } = require('../electron/db');
const { Settings } = require('../electron/settings');
const { HistoryStore } = require('../electron/history-store');
const { SpeedStore } = require('../electron/speed-store');
const { DeviceStore } = require('../electron/device-store');

/** ცალკე დროებითი საქაღალდე ყოველ ტესტზე — რეალურ მონაცემებს არ ეხება */
function tempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'netwatch-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('ახალი ბაზა: სქემა იქმნება, ვერსია = მიგრაციების რაოდენობა', (t) => {
  const db = openDatabase(tempDir(t));
  const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`).all().map((r) => r.name);
  assert.deepEqual(tables, ['devices', 'outages', 'sessions', 'settings', 'speed_tests']);
  assert.ok(db.prepare('PRAGMA user_version').get().user_version >= 1);
  db.close();
});

test('ძველი history.json / settings.json გადადის ბაზაში ერთხელ და .bak-ად ინახება', (t) => {
  const dir = tempDir(t);
  const now = Date.now();
  fs.writeFileSync(
    path.join(dir, 'history.json'),
    JSON.stringify({
      sessions: [{ start: now - 5e6, end: now - 1e6 }],
      outages: [{ start: now - 4e6, end: now - 3e6, reason: 'unreachable', cause: 'internet', failedAt: 'internet' }],
    })
  );
  fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ lang: 'de', firstRunDone: true }));

  let db = openDatabase(dir);
  assert.ok(fs.existsSync(path.join(dir, 'history.json.bak')));
  assert.ok(fs.existsSync(path.join(dir, 'settings.json.bak')));
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM outages').get().n, 1);
  assert.equal(new Settings(db).get('lang'), 'de');
  db.close();

  // მეორე გახსნა — მიგრაცია აღარ მეორდება
  db = openDatabase(dir);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM outages').get().n, 1);
  db.close();
});

test('Settings: ინახავს JSON მნიშვნელობებს, არარსებულზე — fallback', (t) => {
  const db = openDatabase(tempDir(t));
  const s = new Settings(db);
  s.set('lang', 'uk');
  s.set('flags', { a: 1 });
  assert.equal(s.get('lang'), 'uk');
  assert.deepEqual(s.get('flags'), { a: 1 });
  assert.equal(s.get('missing', 'fallback'), 'fallback');
  db.close();
});

test('HistoryStore: გათიშვა → მიზეზი → დასრულება; ავარიის შემდეგ ღია გათიშვა იხურება', (t) => {
  const db = openDatabase(tempDir(t));
  let h = new HistoryStore(db);
  h.start();
  const at = Date.now();
  h.startOutage(at, 'unreachable');
  h.startOutage(at + 1, 'unreachable'); // მეორე არ უნდა შეიქმნას — უკვე გრძელდება
  h.annotate({ level: 'bad', code: 'router', failedAt: 'router' });
  h.endOutage(at + 30e3);

  let { outages } = h.snapshot({ from: 0, to: Date.now() + 60e3 });
  assert.equal(outages.length, 1);
  assert.equal(outages[0].cause, 'router');
  assert.equal(outages[0].end - outages[0].start, 30e3);

  // "ავარია": ახალი გათიშვა იწყება და stop() არ ხდება
  h.startOutage(Date.now(), 'no-network');
  clearInterval(h._heartbeat);
  h = new HistoryStore(db);
  h.start(); // ღია გათიშვა უნდა დაიხუროს, მიახლოებითი დასასრულით
  outages = h.snapshot({ from: 0, to: Date.now() + 60e3 }).outages;
  assert.equal(outages.length, 2);
  assert.ok(outages.every((o) => o.end !== null));
  assert.equal(outages[1].unknownEnd, true);
  h.stop();
  db.close();
});

test('SpeedStore: ძველი localStorage-ის იმპორტი მხოლოდ ცარიელ ცხრილში', (t) => {
  const db = openDatabase(tempDir(t));
  const s = new SpeedStore(db);
  const legacy = [
    { at: 2000, ping: 40, jitter: 2, download: 85, upload: 92 },
    { at: 1000, ping: 41, jitter: 3, download: 95, upload: 86 },
  ];
  assert.equal(s.importLegacy(legacy), 2);
  assert.equal(s.importLegacy(legacy), 0, 'მეორედ აღარ უნდა ჩაიწეროს');
  s.add({ at: 3000, ping: 39, jitter: 1, download: 100, upload: 90 });
  assert.deepEqual(s.list(10).map((r) => r.at), [3000, 2000, 1000]);
  db.close();
});

test('DeviceStore: აქტიურები იწერება, არააქტიურს last_seen რჩება; ქსელები ცალ-ცალკეა', (t) => {
  const db = openDatabase(tempDir(t));
  const store = new DeviceStore(db);
  const home = '48:55:41:73:87:78';
  const office = 'aa:bb:cc:00:00:01';

  store.record(home, [
    { ip: '192.168.1.10', mac: '11:11:11:11:11:11', hostname: 'laptop', vendor: 'Intel', active: true },
    { ip: '192.168.1.20', mac: '22:22:22:22:22:22', hostname: 'phone', active: true },
    { ip: '192.168.1.30', mac: '33:33:33:33:33:33', active: false }, // ჯერ არასდროს ნანახი აქტიურად — არ იწერება
    { ip: '192.168.1.2', mac: '44:44:44:44:44:44', self: true, active: true }, // ეს კომპიუტერი — არ იწერება
  ], 1000);

  // მეორე სკანირება: phone წავიდა (inactive), laptop-მა სახელი ამჯერად ვერ თქვა
  store.record(home, [
    { ip: '192.168.1.10', mac: '11:11:11:11:11:11', hostname: null, active: true },
    { ip: '192.168.1.20', mac: '22:22:22:22:22:22', active: false },
  ], 2000);

  const list = store.list(home);
  assert.deepEqual(list.map((d) => d.mac), ['11:11:11:11:11:11', '22:22:22:22:22:22']); // ბოლოს ნანახი — თავში
  const laptop = list.find((d) => d.hostname === 'laptop');
  assert.equal(laptop.lastSeen, 2000);
  assert.equal(laptop.firstSeen, 1000);
  assert.equal(laptop.vendor, 'Intel', 'ძველი სახელი/მწარმოებელი არ უნდა წაიშალოს');
  assert.equal(list.find((d) => d.hostname === 'phone').lastSeen, 1000, 'არააქტიურის last_seen არ იცვლება');

  assert.deepEqual(store.list(office), [], 'სხვა ქსელის მოწყობილობები არ ერევა');
  db.close();
});
