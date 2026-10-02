/**
 * ტესტების გაშვება: npm test
 *
 * ტესტები (test/*.test.js) ეშვება Electron-ის Node-ით (22), არა სისტემის node-ით:
 *  - იგივე გარემო, რაზეც აპი მუშაობს;
 *  - node:sqlite მხოლოდ Node 22-შია (სისტემური შეიძლება 20 იყოს).
 * ELECTRON_RUN_AS_NODE=1 — Electron-ი ჩვეულებრივ Node-ად იქცევა (ფანჯრის გარეშე).
 * ჩაშენებული node:test — დამატებითი პაკეტი არ სჭირდება.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const electron = require('electron'); // node-იდან require აბრუნებს Electron-ის exe-ს გზას
const dir = path.join(__dirname, '..', 'test');
const files = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith('.test.js'))
  .map((f) => path.join(dir, f));

const result = spawnSync(electron, ['--test', '--test-reporter=spec', ...files], {
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', NODE_NO_WARNINGS: '1' },
});
process.exit(result.status ?? 1);
