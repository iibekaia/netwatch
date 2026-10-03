/**
 * სიჩქარის ტესტის ცალკე პროცესი (Electron utilityProcess) — იხ. speed-process.js.
 * აქ მხოლოდ SpeedTest ეშვება: main process-ის საქმეები (ქსელის სკანი, ბაზა, IPC)
 * ping-ის დროს და ნაკადების კითხვას ვეღარ აფერხებს.
 *
 * შეტყობინებები: main → { type: 'run' | 'cancel' }
 *                worker → { type: 'progress', progress } | { type: 'done', result } | { type: 'error', message }
 */
const { SpeedTest } = require('./speed-test');

const test = new SpeedTest();
const send = (msg) => process.parentPort.postMessage(msg);

test.on('progress', (progress) => send({ type: 'progress', progress }));

process.parentPort.on('message', ({ data }) => {
  if (data?.type === 'cancel') test.cancel();
  if (data?.type === 'run') {
    test.run().then(
      (result) => send({ type: 'done', result }),
      (err) => send({ type: 'error', message: String(err?.message ?? err) }),
    );
  }
});
