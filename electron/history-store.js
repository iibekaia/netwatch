const { EventEmitter } = require('events');

/**
 * გათიშვების ისტორია (main process) — netwatch.db:
 *  - outages:  თითოეული გათიშვა. end = NULL — ჯერ გრძელდება;
 *              cause — დიაგნოსტიკის დასკვნის კოდი (internet, router …), ითარგმნება ჩვენებისას.
 *  - sessions: როდის მუშაობდა NetWatch. uptime % მხოლოდ ამ დროზე ითვლება:
 *              როცა კომპიუტერი გამორთულია/ძინავს, ინტერნეტის მდგომარეობა უცნობია და
 *              ოფლაინად არ უნდა ჩაითვალოს.
 *
 * სესია ყოველ HEARTBEAT_MS-ში "გრძელდება". თუ heartbeat-ებს შორის დიდი შუალედია
 * (კომპიუტერს ეძინა), ახალი სესია იწყება — ძილის დრო მონიტორინგად არ ითვლება.
 * აპი თუ ავარიულად დაიხურა, ღია გათიშვა ბოლო heartbeat-ით იხურება.
 *
 * ყოველი ცვლილება — ერთი SQL ბრძანება (მთელი ფაილის გადაწერა აღარ ხდება).
 *
 * მოვლენები: 'change'
 */

const HEARTBEAT_MS = 30 * 1000;
const SLEEP_GAP_MS = 3 * HEARTBEAT_MS;
const RETENTION_MS = 365 * 24 * 60 * 60 * 1000; // ერთი წელი

class HistoryStore extends EventEmitter {
  constructor(db) {
    super();
    this.db = db;
    this._heartbeat = null;
    this._session = null; // მიმდინარე სესიის id

    this.q = {
      lastSession: db.prepare('SELECT id, start, end FROM sessions ORDER BY id DESC LIMIT 1'),
      newSession: db.prepare('INSERT INTO sessions (start, end) VALUES (?, ?)'),
      extendSession: db.prepare('UPDATE sessions SET end = ? WHERE id = ?'),
      openOutage: db.prepare('SELECT id, start FROM outages WHERE end IS NULL ORDER BY id DESC LIMIT 1'),
      lastOutage: db.prepare('SELECT id, end FROM outages ORDER BY id DESC LIMIT 1'),
      newOutage: db.prepare('INSERT INTO outages (start, reason) VALUES (?, ?)'),
      closeOutage: db.prepare('UPDATE outages SET end = MAX(start, ?), unknown_end = ? WHERE id = ?'),
      annotate: db.prepare('UPDATE outages SET cause = ?, failed_at = ? WHERE id = ?'),
      pruneOutages: db.prepare('DELETE FROM outages WHERE COALESCE(end, ?) < ?'),
      pruneSessions: db.prepare('DELETE FROM sessions WHERE end < ?'),
      clearOutages: db.prepare('DELETE FROM outages WHERE end IS NOT NULL'),
      clearSessions: db.prepare('DELETE FROM sessions'),
      rangeOutages: db.prepare(
        `SELECT start, end, reason, cause, failed_at AS failedAt, unknown_end AS unknownEnd
         FROM outages WHERE start < ? AND COALESCE(end, ?) > ? ORDER BY start`
      ),
      rangeSessions: db.prepare('SELECT start, end FROM sessions WHERE start < ? AND end > ? ORDER BY start'),
    };
  }

  /** ახალი სესიის დაწყება; წინა ავარიული გაშვების ღია გათიშვის დახურვა */
  start() {
    const now = Date.now();
    const open = this.q.openOutage.get();
    if (open) {
      const last = this.q.lastSession.get();
      this.q.closeOutage.run(last?.end ?? open.start, 1, open.id);
    }
    const cutoff = now - RETENTION_MS;
    this.q.pruneOutages.run(now, cutoff);
    this.q.pruneSessions.run(cutoff);

    this._session = Number(this.q.newSession.run(now, now).lastInsertRowid);
    this._heartbeat = setInterval(() => this._beat(), HEARTBEAT_MS);
  }

  /** აპის დახურვა: სესია და ღია გათიშვა ახლანდელი დროით იხურება */
  stop() {
    clearInterval(this._heartbeat);
    const now = Date.now();
    if (this._session) this.q.extendSession.run(now, this._session);
    const open = this.q.openOutage.get();
    // აპი დაიხურა გათიშვის დროს — რეალური დასასრული უცნობია
    if (open) this.q.closeOutage.run(now, 1, open.id);
  }

  startOutage(at, reason) {
    if (this.q.openOutage.get()) return; // უკვე გრძელდება
    this.q.newOutage.run(at, reason ?? null);
    this.emit('change');
  }

  endOutage(at) {
    const open = this.q.openOutage.get();
    if (!open) return;
    this.q.closeOutage.run(at, 0, open.id);
    this.emit('change');
  }

  /** დიაგნოსტიკის დასკვნა ბოლო (ან მიმდინარე) გათიშვას მიეწერება */
  annotate(verdict) {
    if (!verdict || verdict.level === 'ok') return;
    const last = this.q.lastOutage.get();
    // მხოლოდ თუ ეს გათიშვა ჯერ გრძელდება ან ახლახან დასრულდა
    if (!last || (last.end !== null && Date.now() - last.end > 60 * 1000)) return;
    this.q.annotate.run(verdict.code, verdict.failedAt ?? null, last.id);
    this.emit('change');
  }

  clear() {
    this.q.clearOutages.run();
    this.q.clearSessions.run();
    const now = Date.now();
    this._session = Number(this.q.newSession.run(now, now).lastInsertRowid);
    this.emit('change');
  }

  /** პერიოდთან გადამკვეთი ჩანაწერები — history-stats.js-ისთვის (იგივე ფორმით, რაც ადრე) */
  snapshot({ from = 0, to = Date.now() } = {}) {
    const now = Date.now();
    return {
      outages: this.q.rangeOutages.all(to, now, from).map((o) => ({ ...o, unknownEnd: !!o.unknownEnd })),
      sessions: this.q.rangeSessions.all(to, from),
    };
  }

  // ───────── შიდა ─────────

  _beat() {
    const now = Date.now();
    const session = this.q.lastSession.get();
    if (!session || session.id !== this._session || now - session.end > SLEEP_GAP_MS) {
      // ძილიდან გაღვიძება (ან ისტორია გასუფთავდა) — ახალი სესია
      this._session = Number(this.q.newSession.run(now, now).lastInsertRowid);
    } else {
      this.q.extendSession.run(now, this._session);
    }
  }
}

module.exports = { HistoryStore };
