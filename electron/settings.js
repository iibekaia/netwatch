/**
 * აპის პარამეტრები — netwatch.db → settings (key, value JSON):
 *   lang           — მომხმარებლის არჩეული ენა (თუ არ აურჩევია — ავტომატური)
 *   firstRunDone   — პირველი გაშვების ნაბიჯები (ავტომატური ჩართვა) უკვე შესრულდა
 *   trayHintShown  — "NetWatch ფონზე მუშაობს" შეტყობინება უკვე ნაჩვენებია
 */
class Settings {
  constructor(db) {
    this.getStmt = db.prepare('SELECT value FROM settings WHERE key = ?');
    this.setStmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  }

  get(key, fallback) {
    const row = this.getStmt.get(key);
    if (!row) return fallback;
    try {
      return JSON.parse(row.value);
    } catch {
      return fallback;
    }
  }

  set(key, value) {
    try {
      this.setStmt.run(key, JSON.stringify(value));
    } catch (err) {
      console.warn('[settings] save failed', err.message);
    }
  }
}

module.exports = { Settings };
