/**
 * სიჩქარის გაზომვების ისტორია — netwatch.db → speed_tests.
 * ადრე ინახებოდა ფანჯრის localStorage-ში (ბოლო 10); ძველ ჩანაწერებს renderer-ი ერთხელ
 * გადმოგზავნის (importLegacy) — მხოლოდ თუ ცხრილი ჯერ ცარიელია.
 */
class SpeedStore {
  constructor(db) {
    this.q = {
      add: db.prepare('INSERT INTO speed_tests (at, ping, jitter, download, upload) VALUES (?, ?, ?, ?, ?)'),
      list: db.prepare('SELECT at, ping, jitter, download, upload FROM speed_tests ORDER BY at DESC LIMIT ?'),
      count: db.prepare('SELECT COUNT(*) AS n FROM speed_tests'),
    };
  }

  add(r) {
    this.q.add.run(r.at, r.ping ?? null, r.jitter ?? null, r.download ?? null, r.upload ?? null);
  }

  /** ბოლო limit გაზომვა, ახალი — თავში */
  list(limit = 10) {
    return this.q.list.all(limit);
  }

  /** localStorage-იდან (ძველი ვერსიები) — ერთხელ; აბრუნებს რამდენი ჩაიწერა */
  importLegacy(list) {
    if (!Array.isArray(list) || !list.length || this.q.count.get().n > 0) return 0;
    let n = 0;
    for (const r of list) {
      if (typeof r?.at !== 'number') continue;
      this.add(r);
      n++;
    }
    return n;
  }
}

module.exports = { SpeedStore };
