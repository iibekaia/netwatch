const { EventEmitter } = require('events');

/**
 * ინტერნეტის სიჩქარის ტესტი და პროვაიდერის ინფო (main process).
 * სერვერი: Cloudflare-ის საჯარო speed test (speed.cloudflare.com) — ახლოს მდებარე
 * Cloudflare-ის მონაცემთა ცენტრი პასუხობს, ანგარიში/გასაღები არ სჭირდება.
 *
 * ეტაპები:
 *  1. ping   — PING_COUNT მსუბუქი მოთხოვნა /cdn-cgi/trace-ზე (პასუხობს Cloudflare-ის კიდე პირდაპირ,
 *             დამუშავების დაყოვნების გარეშე — __down?bytes=0 ~150ms-ს უმატებს). ping = მედიანა,
 *             jitter = მეზობელ გაზომვებს შორის საშუალო სხვაობა.
 *  2. download — STREAMS პარალელური ნაკადი PHASE_MS-ის განმავლობაში.
 *  3. upload   — იგივე, POST-ით.
 * სიჩქარე ითვლება ბოლო WINDOW_MS-ის მიხედვით (ცოცხლად), საბოლოო შედეგი — პირველი
 * WARMUP_MS-ის გარეშე (TCP-ს "გაჩქარების" პერიოდი შედეგს არ უნდა ამცირებდეს).
 *
 * მოვლენები: 'progress' ({ phase, value, progress, ping?, jitter? })
 */

const BASE = 'https://speed.cloudflare.com';
const PING_COUNT = 12;
const STREAMS = 4;
const PHASE_MS = 8000;
const WARMUP_MS = 1500;
const WINDOW_MS = 1000;
const DOWN_CHUNK = 25_000_000;
const UP_CHUNK = 1_000_000;
// speed.cloudflare.com ზოგ endpoint-ზე (მაგ. /meta) Referer-ის გარეშე 403-ს აბრუნებს
const HEADERS = { Referer: `${BASE}/` };

class SpeedTest extends EventEmitter {
  constructor() {
    super();
    this._abort = null;
  }

  get running() {
    return !!this._abort;
  }

  async run() {
    if (this._abort) throw new Error('already running');
    const abort = new AbortController();
    this._abort = abort;
    const { signal } = abort;
    try {
      const { ping, jitter } = await this._ping(signal);
      const download = await this._throughput('download', signal);
      const upload = await this._throughput('upload', signal);
      return { at: Date.now(), ping, jitter, download, upload };
    } finally {
      this._abort = null;
    }
  }

  cancel() {
    this._abort?.abort();
  }

  // ───────── ping / jitter ─────────

  async _ping(signal) {
    const samples = [];
    for (let i = 0; i < PING_COUNT; i++) {
      const t0 = performance.now();
      const res = await fetch(`${BASE}/cdn-cgi/trace`, { signal, cache: 'no-store', headers: HEADERS });
      await res.arrayBuffer();
      // პირველი მოთხოვნა TCP/TLS კავშირსაც ამყარებს — არ ვითვლით
      if (i > 0) samples.push(performance.now() - t0);
      this.emit('progress', { phase: 'ping', value: median(samples), progress: (i + 1) / PING_COUNT });
    }
    const jitter =
      samples.slice(1).reduce((sum, v, i) => sum + Math.abs(v - samples[i]), 0) /
      Math.max(1, samples.length - 1);
    return { ping: round(median(samples)), jitter: round(jitter) };
  }

  // ───────── download / upload ─────────

  async _throughput(phase, signal) {
    const start = performance.now();
    const marks = [[0, 0]]; // [ms, ჯამური ბაიტები]
    let bytes = 0;
    const phaseAbort = new AbortController();
    const onAbort = () => phaseAbort.abort();
    signal.addEventListener('abort', onAbort);

    const elapsed = () => performance.now() - start;
    const add = (n) => {
      bytes += n;
      marks.push([elapsed(), bytes]);
    };

    const worker = async () => {
      while (elapsed() < PHASE_MS && !phaseAbort.signal.aborted) {
        if (phase === 'download') await this._download(add, phaseAbort.signal);
        else await this._upload(add, phaseAbort.signal);
      }
    };

    const ticker = setInterval(() => {
      this.emit('progress', {
        phase,
        value: mbps(windowBytes(marks, elapsed() - WINDOW_MS, elapsed()), WINDOW_MS),
        progress: Math.min(1, elapsed() / PHASE_MS),
      });
    }, 200);
    const stopper = setTimeout(() => phaseAbort.abort(), PHASE_MS);

    try {
      await Promise.all(Array.from({ length: STREAMS }, worker));
    } catch (err) {
      if (signal.aborted) throw err; // მომხმარებელმა გააუქმა
      // ფაზის დასრულებისას შეწყვეტილი მოთხოვნები — ნორმალურია
    } finally {
      clearInterval(ticker);
      clearTimeout(stopper);
      signal.removeEventListener('abort', onAbort);
    }
    if (signal.aborted) throw new Error('cancelled');

    const end = Math.min(elapsed(), PHASE_MS);
    const result = mbps(windowBytes(marks, WARMUP_MS, end), end - WARMUP_MS);
    this.emit('progress', { phase, value: result, progress: 1 });
    return round(result);
  }

  async _download(add, signal) {
    const res = await fetch(`${BASE}/__down?bytes=${DOWN_CHUNK}`, {
      signal,
      cache: 'no-store',
      headers: HEADERS,
    });
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      add(value.byteLength);
    }
  }

  async _upload(add, signal) {
    const body = (this._upBody ??= Buffer.alloc(UP_CHUNK, 0x61));
    const res = await fetch(`${BASE}/__up`, { method: 'POST', body, signal, headers: HEADERS });
    await res.arrayBuffer();
    add(body.byteLength);
  }
}

// ───────── პროვაიდერის ინფო ─────────

/**
 * ორი წყარო პარალელურად:
 *  - ipinfo.io — პროვაიდერის სახელი (AS-ის მფლობელი, მაგ. "System Net Ltd");
 *  - Cloudflare /meta — ტესტის სერვერი (colo) და სარეზერვო მონაცემები. მისი asOrganization
 *    IP-ბლოკის სახელია ("... Broadband block 6"), ამიტომ სახელად მხოლოდ სარეზერვოდ გამოიყენება.
 */
async function providerInfo() {
  const [ipinfo, cf] = await Promise.allSettled([
    getJson('https://ipinfo.io/json'),
    getJson(`${BASE}/meta`, HEADERS),
  ]);
  if (ipinfo.status === 'rejected' && cf.status === 'rejected') throw ipinfo.reason;
  const i = ipinfo.status === 'fulfilled' ? ipinfo.value : {};
  const c = cf.status === 'fulfilled' ? cf.value : {};

  const [, asn, org] = String(i.org ?? '').match(/^(AS\d+)\s+(.*)$/) ?? [];
  const block = c.asOrganization?.replace(/\s+/g, ' ').trim() || null;
  const colo = c.colo && typeof c.colo === 'object' ? c.colo : null;
  return {
    ip: i.ip ?? c.clientIp ?? null,
    isp: org ?? block,
    network: org && block && block !== org ? block : null,
    asn: asn ?? (c.asn ? `AS${c.asn}` : null),
    city: i.city ?? c.city ?? null,
    region: i.region ?? c.region ?? null,
    country: i.country ?? c.country ?? null,
    server: colo ? `${colo.city ?? colo.iata} (${colo.iata})` : null,
  };
}

async function getJson(url, headers = {}) {
  const res = await fetch(url, { signal: AbortSignal.timeout(5000), cache: 'no-store', headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ───────── helpers ─────────

/** ბაიტები [from, to] ms შუალედში (marks — ზრდადი [ms, ჯამური ბაიტები]) */
function windowBytes(marks, from, to) {
  const at = (t) => {
    let v = 0;
    for (const [ms, b] of marks) {
      if (ms > t) break;
      v = b;
    }
    return v;
  };
  return at(to) - at(Math.max(0, from));
}

const mbps = (bytes, ms) => (ms > 0 ? (bytes * 8) / (ms * 1000) : 0);
const round = (n) => Math.round(n * 10) / 10;

function median(list) {
  if (!list.length) return 0;
  const s = [...list].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

module.exports = { SpeedTest, providerInfo };
