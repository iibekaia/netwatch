const path = require('path');

/**
 * MAC → მწარმოებელი (main process), ოფლაინ — electron/data/oui.json (IEEE-ის რეესტრიდან,
 * აწყობა: node scripts/build-oui.js). მისამართები არსად იგზავნება.
 *
 * MAC-ის დასაწყისი მწარმოებლის კოდია: 6 სიმბოლო (MA-L), უფრო ვიწრო დიაპაზონებისთვის
 * 7 (MA-M) ან 9 (MA-S) — ვამოწმებთ ყველაზე გრძლიდან.
 * შემთხვევით (privacy) MAC-ს მწარმოებელი არ აქვს — null.
 */

let db = null; // პირველ გამოძახებამდე არ იტვირთება (~1.2 MB)

function vendorOf(mac) {
  if (!mac) return null;
  const hex = mac.replace(/[^0-9a-f]/gi, '').toUpperCase();
  if (hex.length !== 12) return null;
  // locally administered ბიტი — შემთხვევითი MAC (ტელეფონები privacy რეჟიმში)
  if (parseInt(hex.slice(0, 2), 16) & 0x02) return null;

  db ??= require(path.join(__dirname, 'data', 'oui.json'));
  for (const len of [9, 7, 6]) {
    const i = db.m[hex.slice(0, len)];
    if (i !== undefined) return db.v[i];
  }
  return null;
}

module.exports = { vendorOf };
