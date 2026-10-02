const fs = require('fs');

/**
 * აპის პარამეტრები: <userData>/settings.json
 *   firstRunDone   — პირველი გაშვების ნაბიჯები (ავტომატური ჩართვა) უკვე შესრულდა
 *   trayHintShown  — "NetWatch ფონზე მუშაობს" შეტყობინება უკვე ნაჩვენებია
 */
class Settings {
  constructor(file) {
    this.file = file;
    this.data = {};
    try {
      this.data = JSON.parse(fs.readFileSync(file, 'utf8')) ?? {};
    } catch {
      // ფაილი ჯერ არ არის — ნაგულისხმევი მნიშვნელობები
    }
  }

  get(key, fallback) {
    return key in this.data ? this.data[key] : fallback;
  }

  set(key, value) {
    this.data[key] = value;
    try {
      fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2));
    } catch (err) {
      console.warn('[settings] save failed', err.message);
    }
  }
}

module.exports = { Settings };
