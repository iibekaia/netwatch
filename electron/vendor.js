const path = require('path');

/**
 * MAC → მწარმოებელი (main process), ოფლაინ — SQLite ბაზა electron/data/oui.db
 * (IEEE-ის რეესტრიდან, აწყობა: npm run oui). ბაზა ინსტალერს მიჰყვება; მისამართები არსად იგზავნება.
 *
 * MAC-ის დასაწყისი მწარმოებლის კოდია: 6 სიმბოლო (MA-L), უფრო ვიწრო დიაპაზონებისთვის
 * 7 (MA-M) ან 9 (MA-S) — ვამოწმებთ ყველაზე გრძლიდან.
 * შემთხვევით (privacy) MAC-ს მწარმოებელი არ აქვს — null.
 *
 * დაყენებულ აპში ფაილები app.asar არქივშია, საიდანაც SQLite ვერ კითხულობს —
 * ბაზა იქვე, app.asar.unpacked-შია (package.json → build.asarUnpack).
 */

let lookup = null; // პირველ გამოძახებამდე ბაზა არ იხსნება

function open() {
  const { DatabaseSync } = require('node:sqlite');
  const file = path.join(__dirname, 'data', 'oui.db').replace(/app\.asar([\\/])/, 'app.asar.unpacked$1');
  const db = new DatabaseSync(file, { readOnly: true });
  const stmt = db.prepare(
    `SELECT v.name FROM prefixes p JOIN vendors v ON v.id = p.vendor_id
     WHERE p.prefix IN (?, ?, ?) ORDER BY length(p.prefix) DESC LIMIT 1`
  );
  return (hex) => stmt.get(hex.slice(0, 9), hex.slice(0, 7), hex.slice(0, 6))?.name ?? null;
}

function vendorOf(mac) {
  if (!mac) return null;
  const hex = mac.replace(/[^0-9a-f]/gi, '').toUpperCase();
  if (hex.length !== 12) return null;
  // locally administered ბიტი — შემთხვევითი MAC (ტელეფონები privacy რეჟიმში)
  if (parseInt(hex.slice(0, 2), 16) & 0x02) return null;

  try {
    lookup ??= open();
    return lookup(hex);
  } catch (err) {
    // ბაზა თუ ვერ გაიხსნა — სკანირება მაინც მუშაობს, უბრალოდ მწარმოებლის გარეშე
    console.warn('[vendor] lookup failed', err.message);
    lookup = () => null;
    return null;
  }
}

module.exports = { vendorOf };
