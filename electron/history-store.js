const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

/**
 * გათიშვების ისტორია დისკზე (main process).
 * ფაილი: <userData>/history.json  (Windows: %APPDATA%\NetWatch\history.json)
 *
 * ორი სია:
 *  - outages:  [{ start, end, reason, cause, failedAt }] — თითოეული გათიშვა.
 *              end = null — ჯერ გრძელდება; cause — დიაგნოსტიკის დასკვნა ("პრობლემა პროვაიდერის მხარესაა").
 *  - sessions: [{ start, end }] — როდის მუშაობდა NetWatch. uptime % მხოლოდ ამ დროზე ითვლება:
 *              როცა კომპიუტერი გამორთულია/ძინავს, ინტერნეტის მდგომარეობა უცნობია და
 *              ოფლაინად არ უნდა ჩაითვალოს.
 *
 * სესია ყოველ HEARTBEAT_MS-ში "გრძელდება". თუ heartbeat-ებს შორის დიდი შუალედია
 * (კომპიუტერს ეძინა), ახალი სესია იწყება — ძილის დრო მონიტორინგად არ ითვლება.
 * აპი თუ ავარიულად დაიხურა, ღია გათიშვა ბოლო heartbeat-ით იხურება.
 *
 * მოვლენები: 'change'
 */

const HEARTBEAT_MS = 30 * 1000;
const SLEEP_GAP_MS = 3 * HEARTBEAT_MS;
const RETENTION_MS = 365 * 24 * 60 * 60 * 1000; // ერთი წელი
const SAVE_DELAY_MS = 2000;

class HistoryStore extends EventEmitter {
  constructor(file) {
    super();
    this.file = file;
    this.data = { version: 1, outages: [], sessions: [] };
    this._saveTimer = null;
    this._heartbeat = null;
  }

  /** ჩატვირთვა + ახალი სესიის დაწყება */
  start() {
    this._load();
    const now = Date.now();
    const lastSession = this.data.sessions.at(-1);

    // წინა გაშვება ავარიულად დასრულდა — ღია გათიშვა ბოლო heartbeat-ით იხურება
    const open = this._open();
    if (open) {
      open.end = Math.max(open.start, lastSession?.end ?? open.start);
      open.unknownEnd = true;
    }

    this._prune(now);
    this.data.sessions.push({ start: now, end: now });
    this._heartbeat = setInterval(() => this._beat(), HEARTBEAT_MS);
    this._save(true);
  }

  /** აპის დახურვა: სესია და ღია გათიშვა ახლანდელი დროით იხურება */
  stop() {
    clearInterval(this._heartbeat);
    const now = Date.now();
    const session = this.data.sessions.at(-1);
    if (session) session.end = now;
    const open = this._open();
    if (open) {
      open.end = now;
      open.unknownEnd = true; // აპი დაიხურა გათიშვის დროს — რეალური დასასრული უცნობია
    }
    this._save(true, true);
  }

  startOutage(at, reason) {
    if (this._open()) return; // უკვე გრძელდება
    this.data.outages.push({ start: at, end: null, reason, cause: null, failedAt: null });
    this._changed();
  }

  endOutage(at) {
    const open = this._open();
    if (!open) return;
    open.end = Math.max(open.start, at);
    this._changed();
  }

  /** დიაგნოსტიკის დასკვნა ბოლო (ან მიმდინარე) გათიშვას მიეწერება */
  annotate(verdict) {
    const last = this.data.outages.at(-1);
    if (!last || !verdict || verdict.level === 'ok') return;
    // მხოლოდ თუ ეს გათიშვა ახლახან დაიწყო ან ჯერ გრძელდება
    if (last.end !== null && Date.now() - last.end > 60 * 1000) return;
    last.cause = verdict.title;
    last.failedAt = verdict.failedAt;
    this._changed();
  }

  clear() {
    const now = Date.now();
    this.data.outages = this.data.outages.filter((o) => o.end === null);
    this.data.sessions = [{ start: now, end: now }];
    this._changed();
  }

  snapshot() {
    return this.data;
  }

  // ───────── შიდა ─────────

  _open() {
    const last = this.data.outages.at(-1);
    return last && last.end === null ? last : null;
  }

  _beat() {
    const now = Date.now();
    const session = this.data.sessions.at(-1);
    if (!session || now - session.end > SLEEP_GAP_MS) {
      // ძილიდან გაღვიძება — ახალი სესია
      this.data.sessions.push({ start: now, end: now });
    } else {
      session.end = now;
    }
    this._save();
  }

  _prune(now) {
    const cutoff = now - RETENTION_MS;
    this.data.outages = this.data.outages.filter((o) => (o.end ?? now) >= cutoff);
    this.data.sessions = this.data.sessions.filter((s) => s.end >= cutoff);
  }

  _changed() {
    this._save();
    this.emit('change');
  }

  _load() {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (Array.isArray(parsed?.outages) && Array.isArray(parsed?.sessions)) {
        this.data = { version: 1, outages: parsed.outages, sessions: parsed.sessions };
      }
    } catch (err) {
      if (err.code !== 'ENOENT') console.warn('[history] load failed', err.message);
    }
  }

  /** ჩაწერა: ჩვეულებრივ — 2 წამის დაგვიანებით (ბევრი ცვლილება ერთ ჩაწერად); sync — დახურვისას */
  _save(immediate = false, sync = false) {
    clearTimeout(this._saveTimer);
    const write = () => {
      try {
        fs.mkdirSync(path.dirname(this.file), { recursive: true });
        // ჯერ დროებით ფაილში, მერე rename — ჩაწერისას ავარია ფაილს არ გააფუჭებს
        const tmp = `${this.file}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify(this.data));
        fs.renameSync(tmp, this.file);
      } catch (err) {
        console.warn('[history] save failed', err.message);
      }
    };
    if (sync) write();
    else this._saveTimer = setTimeout(write, immediate ? 0 : SAVE_DELAY_MS);
  }
}

module.exports = { HistoryStore };
