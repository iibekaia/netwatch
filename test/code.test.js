const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

/**
 * კოდის შემოწმებები, რომლებიც ESLint-ს არ შეუძლია — ორივე ამ პროექტის რეალური შეცდომიდანაა.
 */

const ROOT = path.join(__dirname, '..');
const walk = (d) =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));

test('electron/*.js — ყველა ფაილი სინტაქსურად სწორია (აპი გაეშვება)', () => {
  // updater.js-ში კომენტარმა ერთ ხაზზე ობიექტის ბოლო "გადაყლაპა" — აპი საერთოდ არ ჩაირთო
  const files = walk(path.join(ROOT, 'electron')).filter((f) => f.endsWith('.js'));
  for (const file of files) {
    // process.execPath — Electron-ის Node (ELECTRON_RUN_AS_NODE უკვე დაყენებულია scripts/test.js-ში)
    const r = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8', env: process.env });
    assert.equal(r.status, 0, `${path.relative(ROOT, file)}:\n${r.stderr}`);
  }
});

test('Angular: [class.X]-ში კლასის სახელს წერტილი არ აქვს', () => {
  // [class.translate-x-3.5] → Angular სახელს წერტილთან ჭრის ("translate-x-3") — კლასი არ ედება.
  // სწორად: [class]="cond ? 'translate-x-3.5' : ''"
  const files = walk(path.join(ROOT, 'src', 'app')).filter((f) => /\.(html|ts)$/.test(f));
  const bad = [];
  for (const file of files) {
    for (const m of fs.readFileSync(file, 'utf8').matchAll(/\[class\.([^\]=\s]+)\]/g)) {
      // შიგნით [] (Tailwind-ის arbitrary value) — ცალკე შემთხვევა, წერტილი იქ არ ითვლება
      const name = m[1].replace(/\[[^\]]*$/, '');
      if (name.includes('.')) bad.push(`${path.relative(ROOT, file)}: [class.${m[1]}]`);
    }
  }
  assert.deepEqual(bad, []);
});
