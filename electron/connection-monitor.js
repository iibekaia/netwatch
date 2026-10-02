const { EventEmitter } = require('events');
const { net } = require('electron');

/**
 * ინტერნეტ-კავშირის მონიტორი (main process).
 *
 * როგორ მუშაობს:
 *  1. net.isOnline() — ამოწმებს, აქვს თუ არა სისტემას საერთოდ ქსელი (Wi-Fi/კაბელი).
 *  2. თუ ქსელი არის, რამდენიმე სანდო მისამართს პარალელურად უგზავნის მოთხოვნას —
 *     საკმარისია ერთმა უპასუხოს. ასე ვიჭერთ შემთხვევას, როცა Wi-Fi ჩართულია,
 *     მაგრამ ინტერნეტი რეალურად არ მუშაობს.
 *  3. ონლაინ რეჟიმში ამოწმებს ყოველ 2 წამში, ოფლაინში — ყოველ 1 წამში,
 *     რომ აღდგენა მყისიერად დაინახოს.
 *  4. checkNow() შეიძლება გამოიძახოს ნებისმიერმა მოვლენამ (renderer-ის online/offline,
 *     კომპიუტერის ძილიდან გაღვიძება) — მაშინ შემოწმება მაშინვე ხდება.
 *
 * მოვლენები (events):
 *   'online'  (status)          — კავშირი აღდგა
 *   'offline' (status)          — კავშირი გაწყდა
 *   'change'  (status, prev)    — ნებისმიერი ცვლილება
 *   'status'  (status)          — ყოველი შემოწმების შედეგი
 */
class ConnectionMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    this.targets = options.targets ?? [
      'https://www.gstatic.com/generate_204',
      'https://cp.cloudflare.com/generate_204',
      'https://detectportal.firefox.com/success.txt',
    ];
    this.timeoutMs = options.timeoutMs ?? 2500;
    this.onlineIntervalMs = options.onlineIntervalMs ?? 2000;
    this.offlineIntervalMs = options.offlineIntervalMs ?? 1000;

    this.status = {
      online: null, // null = ჯერ უცნობია
      since: Date.now(),
      lastCheck: null,
      latencyMs: null,
      reason: 'starting',
      trigger: null,
    };

    this._timer = null;
    this._running = null; // მიმდინარე შემოწმების Promise
    this._pendingTrigger = null; // თუ შემოწმების დროს ახალი მოთხოვნა მოვიდა
    this._stopped = true;
  }

  start() {
    if (!this._stopped) return;
    this._stopped = false;
    this.checkNow('start');
  }

  stop() {
    this._stopped = true;
    clearTimeout(this._timer);
  }

  getStatus() {
    return { ...this.status };
  }

  /** შემოწმება ახლავე. თუ უკვე მიმდინარეობს, დასრულების შემდეგ კიდევ ერთხელ გაეშვება. */
  checkNow(trigger = 'manual') {
    if (this._running) {
      this._pendingTrigger = trigger;
      return this._running;
    }
    clearTimeout(this._timer);
    this._running = this._check(trigger).finally(() => {
      this._running = null;
      if (this._pendingTrigger) {
        const next = this._pendingTrigger;
        this._pendingTrigger = null;
        this.checkNow(next);
      } else {
        this._schedule();
      }
    });
    return this._running;
  }

  _schedule() {
    if (this._stopped) return;
    const delay = this.status.online ? this.onlineIntervalMs : this.offlineIntervalMs;
    this._timer = setTimeout(() => this.checkNow('interval'), delay);
  }

  async _probe() {
    if (!net.isOnline()) {
      return { ok: false, reason: 'no-network', latencyMs: null };
    }
    const started = Date.now();
    try {
      await Promise.any(this.targets.map((url) => this._ping(url)));
      return { ok: true, reason: 'reachable', latencyMs: Date.now() - started };
    } catch {
      return { ok: false, reason: 'unreachable', latencyMs: null };
    }
  }

  async _ping(url) {
    const res = await net.fetch(`${url}?_=${Date.now()}`, {
      method: 'HEAD',
      cache: 'no-store',
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
    return res;
  }

  async _check(trigger) {
    const result = await this._probe();
    const now = Date.now();
    const prev = this.status;
    const changed = prev.online !== result.ok;

    this.status = {
      online: result.ok,
      since: changed ? now : prev.since,
      lastCheck: now,
      latencyMs: result.latencyMs,
      reason: result.reason,
      trigger,
    };

    this.emit('status', this.getStatus());
    if (changed) {
      this.emit('change', this.getStatus(), prev);
      this.emit(result.ok ? 'online' : 'offline', this.getStatus(), prev);
    }
  }
}

module.exports = { ConnectionMonitor };
