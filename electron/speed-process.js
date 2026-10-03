const { EventEmitter } = require('events');
const path = require('path');
const { utilityProcess } = require('electron');

const ENTRY = path.join(__dirname, 'speed-worker.js');

/**
 * სიჩქარის ტესტი ცალკე პროცესში. ინტერფეისი იგივეა, რაც SpeedTest-ს
 * (run / cancel / running / 'progress'), ამიტომ main.js-ისთვის სულ ერთია.
 *
 * რატომ ცალკე პროცესი და არა Web Worker (renderer-ში):
 *  - დამალულ ფანჯარაში (tray) Chromium ტაიმერებს ანელებს — გაზომვა დაზიანდებოდა;
 *  - renderer-ის fetch-ს CORS და Referer-ის შეზღუდვები აქვს;
 *  - utilityProcess-ში იგივე Node-ის კოდი უცვლელად მუშაობს.
 * პროცესი ყოველ ტესტზე იქმნება და მერე იხურება — უქმად მეხსიერებას არ იკავებს.
 */
class SpeedTestProcess extends EventEmitter {
  constructor() {
    super();
    this._child = null;
  }

  get running() {
    return !!this._child;
  }

  run() {
    if (this._child) return Promise.reject(new Error('already running'));
    return new Promise((resolve, reject) => {
      const child = utilityProcess.fork(ENTRY, [], { serviceName: 'NetWatch Speed Test' });
      this._child = child;
      let settled = false;
      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        this._child = null;
        child.kill();
        fn(value);
      };

      child.on('spawn', () => child.postMessage({ type: 'run' }));
      child.on('message', (msg) => {
        if (msg?.type === 'progress') this.emit('progress', msg.progress);
        else if (msg?.type === 'done') finish(resolve, msg.result);
        else if (msg?.type === 'error') finish(reject, new Error(msg.message));
      });
      // პროცესი მოულოდნელად დაიხურა (ავარია) — ტესტი ჩავარდა
      child.on('exit', (code) => finish(reject, new Error(`speed test process exited (${code})`)));
    });
  }

  cancel() {
    this._child?.postMessage({ type: 'cancel' });
  }
}

module.exports = { SpeedTestProcess };
