const fs = require('fs');
const path = require('path');
const { BrowserWindow } = require('electron');

/**
 * ისტორიის ექსპორტი (main process):
 *  - CSV — ყველა გათიშვა ცხრილად (Excel-ი ქართულს სწორად კითხულობს — UTF-8 BOM)
 *  - PDF — ანგარიში პროვაიდერთან საჩივრისთვის: შეჯამება, დღიური გრაფიკი, გათიშვების სია.
 *          იქმნება უხილავ ფანჯარაში printToPDF-ით; ქართული ფონტი ფაილშივეა ჩაშენებული.
 */

const MONTHS = ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'];
const REASONS = {
  unreachable: 'ქსელი არის, ინტერნეტი — არა',
  'no-network': 'ქსელთან კავშირი არ არის',
  'browser-event': 'სისტემის სიგნალი',
};

// ───────── CSV ─────────

function toCsv(report) {
  const header = ['დაწყება', 'დასრულება', 'ხანგრძლივობა (წამი)', 'ხანგრძლივობა', 'მიზეზი', 'დიაგნოსტიკა', 'შენიშვნა'];
  const rows = [...report.outages].reverse().map((o) => [
    dateTime(o.start),
    o.ongoing ? '' : dateTime(o.end),
    Math.round(o.durationMs / 1000),
    duration(o.durationMs),
    REASONS[o.reason] ?? o.reason ?? '',
    o.cause ?? '',
    o.ongoing ? 'ჯერ გრძელდება' : o.unknownEnd ? 'აპი დაიხურა გათიშვის დროს — დასასრული მიახლოებითია' : '',
  ]);
  const esc = (v) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + [header, ...rows].map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n';
}

// ───────── PDF ─────────

async function toPdf(report, meta) {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, contextIsolation: true, javascript: false },
  });
  try {
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(reportHtml(report, meta)));
    return await win.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      margins: { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 },
    });
  } finally {
    win.destroy();
  }
}

function reportHtml({ summary: s, days, outages }, meta) {
  const sentence =
    s.count === 0
      ? 'ამ პერიოდში ინტერნეტი არ გათიშულა.'
      : `ამ პერიოდში ინტერნეტი <b>${s.count}-ჯერ გაითიშა</b>, ჯამში <b>${duration(s.downtimeMs)}</b>.` +
        (s.providerCount
          ? ` მათგან <b>${s.providerCount}</b> — პროვაიდერის მხარეს (როუტერი მუშაობდა, ინტერნეტი — არა).`
          : '');

  const stats = [
    ['Uptime', s.uptimePct === null ? '—' : `${s.uptimePct.toFixed(2)}%`],
    ['გათიშვები', s.count],
    ['ჯამური ოფლაინ დრო', duration(s.downtimeMs)],
    ['ყველაზე ხანგრძლივი', s.longestMs ? `${duration(s.longestMs)}` : '—'],
    ['საშუალო ხანგრძლივობა', s.count ? duration(s.avgMs) : '—'],
    ['მონიტორინგის დრო', duration(s.monitoredMs)],
  ];

  const metaRows = [
    ['პერიოდი', `${day(s.from)} – ${day(s.to - 1)}`],
    ['პროვაიდერი', meta.isp ?? '—'],
    ['საჯარო IP', meta.ip ?? '—'],
    ['კომპიუტერი', meta.host ?? '—'],
    ['შექმნილია', dateTime(Date.now())],
  ];

  return `<!doctype html><html lang="ka"><head><meta charset="utf-8"><style>
${fontFaces()}
* { box-sizing: border-box; }
body { margin: 0; font: 11px/1.5 'NotoGeo', sans-serif; color: #18181b; }
h1 { font-size: 20px; margin: 0 0 2px; letter-spacing: -0.01em; }
h2 { font-size: 13px; margin: 22px 0 8px; }
.sub { color: #71717a; margin: 0 0 16px; }
.meta { display: grid; grid-template-columns: 130px 1fr; gap: 3px 12px; margin-bottom: 14px; }
.meta dt { color: #71717a; } .meta dd { margin: 0; font-weight: 500; }
.lead { font-size: 13px; padding: 12px 14px; background: #f4f4f5; border-radius: 8px; margin: 0 0 14px; }
.stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.stat { border: 1px solid #e4e4e7; border-radius: 8px; padding: 9px 11px; }
.stat span { display: block; color: #71717a; font-size: 10px; }
.stat b { font-size: 16px; font-weight: 600; }
table { width: 100%; border-collapse: collapse; font-size: 11px; }
th, td { text-align: left; padding: 5px 6px; border-bottom: 1px solid #e4e4e7; vertical-align: top; }
th { color: #71717a; font-weight: 500; font-size: 10px; }
td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
tr { break-inside: avoid; }
.chart { width: 100%; height: 120px; display: block; }
.note { color: #71717a; font-size: 9.5px; margin-top: 18px; }
.tag { color: #b91c1c; }
</style></head><body>
<h1>ინტერნეტ-კავშირის ანგარიში</h1>
<p class="sub">NetWatch · ${esc(meta.periodLabel ?? '')}</p>
<dl class="meta">${metaRows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
<p class="lead">${sentence}</p>
<div class="stats">${stats.map(([k, v]) => `<div class="stat"><span>${k}</span><b>${esc(v)}</b></div>`).join('')}</div>

${days.length > 1 ? `<h2>ოფლაინ დრო დღეების მიხედვით (წუთი)</h2>${chartSvg(days)}` : ''}

<h2>გათიშვების სია (${outages.length})</h2>
${
  outages.length
    ? `<table><thead><tr><th>დაწყება</th><th>დასრულება</th><th class="num">ხანგრძლივობა</th><th>მიზეზი / დიაგნოსტიკა</th></tr></thead><tbody>
${[...outages]
  .reverse()
  .map(
    (o) => `<tr><td>${dateTime(o.start)}</td><td>${o.ongoing ? '<span class="tag">გრძელდება</span>' : dateTime(o.end) + (o.unknownEnd ? ' *' : '')}</td>
<td class="num">${duration(o.durationMs)}</td><td>${esc(o.cause ?? REASONS[o.reason] ?? '')}</td></tr>`
  )
  .join('')}
</tbody></table>`
    : '<p>გათიშვა არ დაფიქსირებულა.</p>'
}
<p class="note">Uptime ითვლება მხოლოდ იმ დროზე, როცა NetWatch მუშაობდა (${duration(s.monitoredMs)}); კომპიუტრის
გამორთვის/ძილის დრო არ ითვლება. ინტერნეტი მოწმდება ყოველ 1–2 წამში რამდენიმე საჯარო სერვერთან.
დიაგნოსტიკა ამოწმებს როუტერს, საჯარო IP-ებს (1.1.1.1, 8.8.8.8), DNS-ს და HTTP-ს.${
    outages.some((o) => o.unknownEnd) ? '<br>* აპი დაიხურა გათიშვის დროს — დასასრული მიახლოებითია.' : ''
  }</p>
</body></html>`;
}

/** დღიური ოფლაინ დრო — მარტივი სვეტოვანი გრაფიკი (SVG) */
function chartSvg(days) {
  const W = 700, H = 120, padL = 30, padB = 18, padT = 6;
  const maxMin = Math.max(1, ...days.map((d) => d.downtimeMs / 60000));
  const step = (W - padL) / days.length;
  const bw = Math.max(2, step - 2); // 2px ღრეჩო სვეტებს შორის
  const y = (m) => padT + (H - padT - padB) * (1 - m / maxMin);
  const bars = days
    .map((d, i) => {
      const m = d.downtimeMs / 60000;
      if (m <= 0) return '';
      const x = padL + i * step;
      const top = y(m), h = H - padB - top;
      // 4px მომრგვალება მხოლოდ ზედა ბოლოზე
      const r = Math.min(4, bw / 2, h);
      return `<path d="M${x},${H - padB} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${H - padB} Z" fill="#ef4444"/>`;
    })
    .join('');
  const labelEvery = Math.ceil(days.length / 8);
  const labels = days
    .map((d, i) =>
      (i % labelEvery === 0 && days.length - 1 - i >= labelEvery / 2) || i === days.length - 1
        ? // პირველი/ბოლო წარწერა კიდეზეა გასწორებული, რომ არ მოიჭრას
          `<text x="${i === 0 ? padL : i === days.length - 1 ? W : padL + i * step + bw / 2}" y="${H - 4}" font-size="9" fill="#71717a" text-anchor="${i === 0 ? 'start' : i === days.length - 1 ? 'end' : 'middle'}">${shortDay(d.date)}</text>`
        : ''
    )
    .join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}">
<line x1="${padL}" x2="${W}" y1="${H - padB}" y2="${H - padB}" stroke="#d4d4d8"/>
<text x="${padL - 4}" y="${padT + 8}" font-size="9" fill="#71717a" text-anchor="end">${Math.round(maxMin)}</text>
<text x="${padL - 4}" y="${H - padB}" font-size="9" fill="#71717a" text-anchor="end">0</text>
${bars}${labels}</svg>`;
}

function fontFaces() {
  const media = path.join(__dirname, '..', 'dist', 'netwatch', 'browser', 'media');
  let files = [];
  try {
    files = fs.readdirSync(media).filter((f) => /noto-sans-georgian-(georgian|latin)-wght/.test(f));
  } catch {
    return '';
  }
  return files
    .map((f) => {
      const b64 = fs.readFileSync(path.join(media, f)).toString('base64');
      return `@font-face { font-family: 'NotoGeo'; font-weight: 100 900; src: url(data:font/woff2;base64,${b64}) format('woff2'); }`;
    })
    .join('\n');
}

// ───────── ფორმატირება ─────────

const pad = (n) => String(n).padStart(2, '0');

function dateTime(t) {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function day(t) {
  const d = new Date(t);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function shortDay(t) {
  const d = new Date(t);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function duration(ms) {
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h) return m ? `${h} სთ ${m} წთ` : `${h} სთ`;
  if (m) return s ? `${m} წთ ${s} წმ` : `${m} წთ`;
  return `${s} წმ`;
}

function esc(v) {
  return String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

module.exports = { toCsv, toPdf, dateTime };
