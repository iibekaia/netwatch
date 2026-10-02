const fs = require('fs');
const path = require('path');

/**
 * მომხმარებლის მონაცემების ბაზა (SQLite): <userData>/netwatch.db
 *   Windows: %APPDATA%\NetWatch\netwatch.db — აპის განახლებისას არ იშლება.
 *
 * ცხრილები:
 *   settings    (key, value JSON)                     — ენა, პირველი გაშვება …
 *   sessions    (start, end)                          — როდის მუშაობდა NetWatch (uptime-ისთვის)
 *   outages     (start, end, reason, cause, failed_at, unknown_end)
 *   speed_tests (at, ping, jitter, download, upload)
 *
 * სქემის ვერსია — PRAGMA user_version; ახალი ცვლილებები MIGRATIONS-ში ემატება (რიგით).
 * მწარმოებლების ბაზა (oui.db) ცალკეა: ის აპს მიჰყვება და მხოლოდ წასაკითხია.
 */

const MIGRATIONS = [
  // 1 — საწყისი სქემა
  `CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
   CREATE TABLE sessions (id INTEGER PRIMARY KEY, start INTEGER NOT NULL, end INTEGER NOT NULL);
   CREATE INDEX sessions_end ON sessions (end);
   CREATE TABLE outages (
     id INTEGER PRIMARY KEY,
     start INTEGER NOT NULL,
     end INTEGER,                -- NULL — ჯერ გრძელდება
     reason TEXT,
     cause TEXT,                 -- დიაგნოსტიკის კოდი: internet, router, dns …
     failed_at TEXT,
     unknown_end INTEGER NOT NULL DEFAULT 0
   );
   CREATE INDEX outages_start ON outages (start);
   CREATE TABLE speed_tests (
     id INTEGER PRIMARY KEY,
     at INTEGER NOT NULL,
     ping REAL, jitter REAL, download REAL, upload REAL
   );
   CREATE INDEX speed_tests_at ON speed_tests (at);`,
];

function openDatabase(dir) {
  const { DatabaseSync } = require('node:sqlite');
  fs.mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(path.join(dir, 'netwatch.db'));
  // WAL — ჩაწერა არ ბლოკავს წაკითხვას; busy_timeout — მეორე ასლი (გაშვების მომენტში) არ ჩავარდეს
  db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 3000; PRAGMA foreign_keys = ON;');
  migrate(db, dir);
  return db;
}

function migrate(db, dir) {
  // BEGIN IMMEDIATE — თუ ორი ასლი ერთდროულად გაეშვა, მიგრაცია მხოლოდ ერთხელ შესრულდება
  db.exec('BEGIN IMMEDIATE');
  try {
    let version = db.prepare('PRAGMA user_version').get().user_version;
    const fresh = version === 0;
    for (; version < MIGRATIONS.length; version++) db.exec(MIGRATIONS[version]);
    db.exec(`PRAGMA user_version = ${MIGRATIONS.length}`);
    if (fresh) importLegacyFiles(db, dir);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

/**
 * ძველი ვერსიების ფაილები (history.json, settings.json) → ბაზა, ერთხელ.
 * ფაილები არ იშლება — <სახელი>.bak-ად ინახება (რამე თუ მოხდა, დაბრუნება შეიძლება).
 */
function importLegacyFiles(db, dir) {
  const read = (name) => {
    try {
      return JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
    } catch {
      return null;
    }
  };

  const history = read('history.json');
  if (history) {
    const insS = db.prepare('INSERT INTO sessions (start, end) VALUES (?, ?)');
    for (const s of history.sessions ?? []) insS.run(s.start, s.end);
    const insO = db.prepare(
      'INSERT INTO outages (start, end, reason, cause, failed_at, unknown_end) VALUES (?, ?, ?, ?, ?, ?)'
    );
    for (const o of history.outages ?? []) {
      insO.run(o.start, o.end ?? null, o.reason ?? null, o.cause ?? null, o.failedAt ?? null, o.unknownEnd ? 1 : 0);
    }
    backup(dir, 'history.json');
  }

  const settings = read('settings.json');
  if (settings) {
    const ins = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    for (const [key, value] of Object.entries(settings)) ins.run(key, JSON.stringify(value));
    backup(dir, 'settings.json');
  }
}

function backup(dir, name) {
  try {
    fs.renameSync(path.join(dir, name), path.join(dir, `${name}.bak`));
  } catch (err) {
    console.warn('[db] backup failed', name, err.message);
  }
}

module.exports = { openDatabase };
