/**
 * MAC → მწარმოებლის SQLite ბაზა: electron/data/oui.db (აპს ინსტალერით მიჰყვება, ოფლაინ მუშაობს)
 *
 * წყარო: npm პაკეტი `oui-data` (IEEE-ის რეესტრი, ~5.7 MB). აპში მთლიანად არ ჩადის —
 * აქედან ვაწყობთ კომპაქტურ ბაზას მოკლე სახელებით.
 *
 * განახლება (წელიწადში ერთხელ-ორჯერ საკმარისია):
 *   npm update oui-data && npm run oui
 * Electron-ით ეშვება (არა ჩვეულებრივი node-ით): SQLite (node:sqlite) Node 22-შია, Electron-ში ჩაშენებული.
 */
const fs = require('fs');
const path = require('path');
const db = require('oui-data');

// ცნობილი ბრენდები — ერთი, ლამაზი სახელით (IEEE-ში ხშირად რამდენიმე ფორმითაა)
const BRANDS = [
  [/^apple\b/i, 'Apple'],
  [/^samsung\b/i, 'Samsung'],
  [/^(tp-link|tp link)\b/i, 'TP-Link'],
  [/^huawei\b/i, 'Huawei'],
  [/^honor device/i, 'Honor'],
  [/^(xiaomi|beijing xiaomi)\b/i, 'Xiaomi'],
  [/^intel\b/i, 'Intel'],
  [/^google\b/i, 'Google'],
  [/^amazon\b/i, 'Amazon'],
  [/^microsoft\b/i, 'Microsoft'],
  [/^sony\b/i, 'Sony'],
  [/^lg (electronics|innotek)\b/i, 'LG'],
  [/^asustek\b/i, 'ASUS'],
  [/^(hewlett|hp inc)\b/i, 'HP'],
  [/^dell\b/i, 'Dell'],
  [/^lenovo\b/i, 'Lenovo'],
  [/^cisco\b/i, 'Cisco'],
  [/^netgear\b/i, 'Netgear'],
  [/^d-link\b/i, 'D-Link'],
  [/^zte\b/i, 'ZTE'],
  [/^oneplus\b/i, 'OnePlus'],
  [/^(guangdong oppo|oppo)\b/i, 'OPPO'],
  [/^vivo mobile\b/i, 'vivo'],
  [/^realme\b/i, 'realme'],
  [/^motorola\b/i, 'Motorola'],
  [/^nokia\b/i, 'Nokia'],
  [/^espressif\b/i, 'Espressif'],
  [/^raspberry pi\b/i, 'Raspberry Pi'],
  [/^ubiquiti\b/i, 'Ubiquiti'],
  [/^(mikrotik|routerboard)\b/i, 'MikroTik'],
  [/^(shenzhen tenda|tenda)\b/i, 'Tenda'],
  [/^canon\b/i, 'Canon'],
  [/^seiko epson\b/i, 'Epson'],
  [/^brother\b/i, 'Brother'],
  [/^nintendo\b/i, 'Nintendo'],
  [/^roku\b/i, 'Roku'],
  [/^sonos\b/i, 'Sonos'],
  [/^tuya\b/i, 'Tuya'],
  [/^murata\b/i, 'Murata'],
  [/^azurewave\b/i, 'AzureWave'],
  [/^(lite-on|liteon)\b/i, 'Lite-On'],
  [/^(hon hai|foxconn|cloud network technology)\b/i, 'Foxconn'],
  [/^(realtek)\b/i, 'Realtek'],
  [/^(qualcomm)\b/i, 'Qualcomm'],
  [/^(mediatek)\b/i, 'MediaTek'],
  [/^(texas instruments)\b/i, 'Texas Instruments'],
  [/^(arris)\b/i, 'ARRIS'],
  [/^(technicolor)\b/i, 'Technicolor'],
  [/^(sagemcom)\b/i, 'Sagemcom'],
  [/^(avm\b|avm audiovisuelles)/i, 'AVM (FRITZ!)'],
  [/^(iskratel)\b/i, 'Iskratel'],
  [/^(nvidia)\b/i, 'NVIDIA'],
  [/^(panasonic)\b/i, 'Panasonic'],
  [/^(philips|signify)\b/i, 'Philips'],
  [/^(xerox)\b/i, 'Xerox'],
  [/^(meizu)\b/i, 'Meizu'],
  [/^(tcl)\b/i, 'TCL'],
  [/^(hisense)\b/i, 'Hisense'],
  [/^(vizio)\b/i, 'VIZIO'],
  [/^(garmin)\b/i, 'Garmin'],
  [/^(fitbit)\b/i, 'Fitbit'],
  [/^(ring llc)\b/i, 'Ring'],
  [/^(nest labs)\b/i, 'Google Nest'],
  [/^(synology)\b/i, 'Synology'],
  [/^(qnap)\b/i, 'QNAP'],
  [/^(hikvision|hangzhou hikvision)\b/i, 'Hikvision'],
  [/^(dahua|zhejiang dahua)\b/i, 'Dahua'],
];

// იურიდიული დაბოლოებები: "Co., Ltd.", "Inc.", "GmbH" …
const SUFFIX = /[\s,.]+(inc|incorporated|corp|corporation|co|company|ltd|limited|llc|l\.l\.c|gmbh|ag|s\.?a|s\.?a\.?s|b\.?v|n\.?v|pte|plc|oy|ab|as|srl|s\.r\.l|spa|s\.p\.a|d\.o\.o|kg|kft|aps|a\/s|şti|sti|sp\.? z o\.?o|pty|pvt|private|holdings?|group|international|technologies|technology|tech|electronics|communications?|systems|industrial|industries|manufacturing|enterprises?)\.?$/i;

function shorten(raw) {
  const name = raw.split('\n')[0].trim().replace(/\s+/g, ' ');
  for (const [re, brand] of BRANDS) if (re.test(name)) return brand;
  let s = name;
  for (let i = 0; i < 6; i++) {
    const next = s.replace(SUFFIX, '').trim();
    if (!next || next === s) break;
    s = next;
  }
  s = s.replace(/[,.\s]+$/, '');
  // "SHENZHEN XYZ" → "Shenzhen Xyz" (მხოლოდ თუ მთლიანად დიდი ასოებითაა და მოკლე აბრევიატურა არ არის)
  if (s === s.toUpperCase() && s.length > 4) {
    // \b მხოლოდ ლათინურს იცნობს — ასო სიტყვის დასაწყისში (ş, ö … ჩათვლით)
    s = s.toLowerCase().replace(/(^|[\s\-(&/])(\p{L})/gu, (m, sep, c) => sep + c.toUpperCase());
  }
  return s || name;
}

const vendors = [];
const index = new Map();
const map = {};
for (const [prefix, raw] of Object.entries(db)) {
  // 6 (MA-L), 7 (MA-M) და 9 (MA-S) სიმბოლო; "Private" — მწარმოებელმა სახელი დამალა
  if (!/^[0-9A-F]{6}([0-9A-F]|[0-9A-F]{3})?$/.test(prefix) || !raw) continue;
  const name = shorten(raw);
  if (/^private$/i.test(name)) continue;
  if (!index.has(name)) {
    index.set(name, vendors.length);
    vendors.push(name);
  }
  map[prefix] = index.get(name);
}

// ───────── SQLite ფაილში ჩაწერა ─────────
//   vendors  (id, name)                 — მწარმოებლები (თითო ერთხელ)
//   prefixes (prefix PRIMARY KEY, vendor_id) — MAC-ის დასაწყისი → მწარმოებელი
//   meta     (key, value)               — წყარო და ვერსია
const { DatabaseSync } = require('node:sqlite');

const out = path.join(__dirname, '..', 'electron', 'data', 'oui.db');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.rmSync(out, { force: true });
// პაკეტი package.json-ს არ ექსპორტავს — ვერსიას ფაილიდან ვკითხულობთ
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'node_modules', 'oui-data', 'package.json'), 'utf8'));

const sql = new DatabaseSync(out);
sql.exec(`
  PRAGMA page_size = 4096;
  CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE vendors (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
  CREATE TABLE prefixes (prefix TEXT PRIMARY KEY, vendor_id INTEGER NOT NULL REFERENCES vendors(id)) WITHOUT ROWID;
`);
sql.exec('BEGIN');
const insVendor = sql.prepare('INSERT INTO vendors (id, name) VALUES (?, ?)');
vendors.forEach((name, id) => insVendor.run(id, name));
const insPrefix = sql.prepare('INSERT INTO prefixes (prefix, vendor_id) VALUES (?, ?)');
for (const [prefix, id] of Object.entries(map)) insPrefix.run(prefix, id);
const insMeta = sql.prepare('INSERT INTO meta (key, value) VALUES (?, ?)');
insMeta.run('source', `oui-data ${pkg.version}`);
insMeta.run('built', new Date().toISOString());
sql.exec('COMMIT');
sql.exec('VACUUM'); // ფაილი მინიმალური ზომის
sql.close();

console.log(`${Object.keys(map).length} prefixes, ${vendors.length} vendors → ${path.relative(process.cwd(), out)} (${Math.round(fs.statSync(out).size / 1024)} KB)`);
// Electron-ით გაშვებისას (npm run oui) პროცესი თავისით არ სრულდება
process.exit(0);
