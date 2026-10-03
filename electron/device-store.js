/**
 * ქსელის მოწყობილობების "მეხსიერება" — netwatch.db → devices.
 *
 * ყოველ სკანირებაზე აქტიური მოწყობილობები იწერება (last_seen = ახლა). ამის წყალობით
 * "არააქტიური" ნიშნავს: ადრე ნანახი, ამ წუთში არ პასუხობს (გათიშულია, ძინავს, წავიდა).
 *
 * network — როუტერის MAC: სხვადასხვა ქსელის (სახლი/ოფისი) მოწყობილობები არ ერევა ერთმანეთს.
 * RETENTION-ზე ძველი (დიდი ხანია არ ჩანს) — იშლება.
 */

const RETENTION_MS = 90 * 24 * 60 * 60 * 1000; // 90 დღე

class DeviceStore {
  constructor(db) {
    this.q = {
      upsert: db.prepare(
        `INSERT INTO devices (network, mac, ip, hostname, netbios, workgroup, vendor, random_mac, gateway, first_seen, last_seen)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (network, mac) DO UPDATE SET
           ip = excluded.ip,
           -- სახელი ყოველთვის არ ჩანს (DNS/NetBIOS შეიძლება ამჯერად არ უპასუხოს) — ძველს არ ვშლით
           hostname = COALESCE(excluded.hostname, hostname),
           netbios = COALESCE(excluded.netbios, netbios),
           workgroup = COALESCE(excluded.workgroup, workgroup),
           vendor = COALESCE(excluded.vendor, vendor),
           random_mac = excluded.random_mac,
           gateway = excluded.gateway,
           last_seen = excluded.last_seen`
      ),
      list: db.prepare(
        `SELECT mac, ip, hostname, netbios AS netbiosName, workgroup, vendor, random_mac AS randomMac,
                gateway, first_seen AS firstSeen, last_seen AS lastSeen
         FROM devices WHERE network = ? ORDER BY last_seen DESC`
      ),
      prune: db.prepare('DELETE FROM devices WHERE last_seen < ?'),
    };
    this.db = db;
  }

  /** სკანირების შედეგი: აქტიურები იწერება/ახლდება (არააქტიურებს არ ვეხებით — მათი last_seen რჩება) */
  record(network, devices, now = Date.now()) {
    if (!network) return;
    this.db.exec('BEGIN');
    try {
      for (const d of devices) {
        if (!d.active || !d.mac || d.self) continue;
        this.q.upsert.run(
          network, d.mac, d.ip ?? null, d.hostname ?? null, d.netbiosName ?? null, d.workgroup ?? null,
          d.vendor ?? null, d.randomMac ? 1 : 0, d.gateway ? 1 : 0, now, now
        );
      }
      this.q.prune.run(now - RETENTION_MS);
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  /** ამ ქსელში ოდესმე ნანახი მოწყობილობები (ახლახან ნანახი — თავში) */
  list(network) {
    if (!network) return [];
    return this.q.list.all(network).map((d) => ({ ...d, randomMac: !!d.randomMac, gateway: !!d.gateway }));
  }
}

module.exports = { DeviceStore };
