const fs = require('fs');
const path = require('path');
const { BrowserWindow } = require('electron');
const { i18n } = require('./i18n');

/**
 * ისტორიის ექსპორტი (main process) — აპის მიმდინარე ენაზე:
 *  - CSV — ყველა გათიშვა ცხრილად (Excel-ი UTF-8-ს სწორად კითხულობს — BOM)
 *  - PDF — ანგარიში პროვაიდერთან საჩივრისთვის: შეჯამება, დღიური გრაფიკი, გათიშვების სია.
 *          იქმნება უხილავ ფანჯარაში printToPDF-ით; ფონტები (ქართული + კირილიცა) ფაილშივეა ჩაშენებული.
 */

const t = (key, params) => i18n.t(key, params);

/** მიზეზი: დიაგნოსტიკის დასკვნა (კოდით) ან, თუ არ არის, შემოწმების მიზეზი */
function causeText(o) {
  if (o.cause) return t(`diag.verdict.${o.cause}.title`);
  return t(`reason.${o.reason}`) === `reason.${o.reason}` ? '' : t(`reason.${o.reason}`);
}

// ───────── CSV ─────────

function toCsv(report) {
  const header = ['start', 'end', 'durationSec', 'duration', 'reason', 'diagnosis', 'note'].map((k) => t(`csv.${k}`));
  const rows = [...report.outages].reverse().map((o) => [
    dateTime(o.start),
    o.ongoing ? '' : dateTime(o.end),
    Math.round(o.durationMs / 1000),
    i18n.duration(o.durationMs),
    o.reason && t(`reason.${o.reason}`) !== `reason.${o.reason}` ? t(`reason.${o.reason}`) : '',
    o.cause ? t(`diag.verdict.${o.cause}.title`) : '',
    o.ongoing ? t('csv.ongoing') : o.unknownEnd ? t('csv.approx') : '',
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
      ? t('report.none')
      : t('report.sentence', { count: s.count, total: i18n.duration(s.downtimeMs) }) +
        (s.providerCount ? t('report.providerPart', { count: s.providerCount }) : '');

  const stats = [
    [t('report.stats.uptime'), s.uptimePct === null ? '—' : `${s.uptimePct.toFixed(2)}%`],
    [t('report.stats.outages'), s.count],
    [t('report.stats.total'), i18n.duration(s.downtimeMs)],
    [t('report.stats.longest'), s.longestMs ? i18n.duration(s.longestMs) : '—'],
    [t('report.stats.average'), s.count ? i18n.duration(s.avgMs) : '—'],
    [t('report.stats.monitored'), i18n.duration(s.monitoredMs)],
  ];

  const metaRows = [
    [t('report.period'), `${i18n.day(s.from, { year: true })} – ${i18n.day(s.to - 1, { year: true })}`],
    [t('report.provider'), meta.isp ?? '—'],
    [t('report.ip'), meta.ip ?? '—'],
    [t('report.computer'), meta.host ?? '—'],
    [t('report.created'), dateTime(Date.now())],
  ];

  return `<!doctype html><html lang="${i18n.lang}"><head><meta charset="utf-8"><style>
${fontFaces()}
* { box-sizing: border-box; }
body { margin: 0; font: 11px/1.5 'NotoGeo', 'NotoSans', sans-serif; color: #18181b; }
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
<h1>${esc(t('report.title'))}</h1>
<p class="sub">NetWatch · ${esc(meta.periodLabel ?? '')}</p>
<dl class="meta">${metaRows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
<p class="lead">${sentence}</p>
<div class="stats">${stats.map(([k, v]) => `<div class="stat"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>

${days.length > 1 ? `<h2>${esc(t('report.chartTitle'))}</h2>${chartSvg(days)}` : ''}

<h2>${esc(t('report.listTitle', { count: outages.length }))}</h2>
${
  outages.length
    ? `<table><thead><tr><th>${esc(t('report.col.start'))}</th><th>${esc(t('report.col.end'))}</th><th class="num">${esc(t('report.col.duration'))}</th><th>${esc(t('report.col.cause'))}</th></tr></thead><tbody>
${[...outages]
  .reverse()
  .map(
    (o) => `<tr><td>${dateTime(o.start)}</td><td>${o.ongoing ? `<span class="tag">${esc(t('report.ongoing'))}</span>` : dateTime(o.end) + (o.unknownEnd ? ' *' : '')}</td>
<td class="num">${esc(i18n.duration(o.durationMs))}</td><td>${esc(causeText(o))}</td></tr>`
  )
  .join('')}
</tbody></table>`
    : `<p>${esc(t('report.noneList'))}</p>`
}
<p class="note">${esc(t('report.note', { time: i18n.duration(s.monitoredMs) }))}${
    outages.some((o) => o.unknownEnd) ? `<br>${esc(t('report.approx'))}` : ''
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
          `<text x="${i === 0 ? padL : i === days.length - 1 ? W : padL + i * step + bw / 2}" y="${H - 4}" font-size="9" fill="#71717a" text-anchor="${i === 0 ? 'start' : i === days.length - 1 ? 'end' : 'middle'}">${esc(i18n.day(d.date))}</text>`
        : ''
    )
    .join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}">
<line x1="${padL}" x2="${W}" y1="${H - padB}" y2="${H - padB}" stroke="#d4d4d8"/>
<text x="${padL - 4}" y="${padT + 8}" font-size="9" fill="#71717a" text-anchor="end">${Math.round(maxMin)}</text>
<text x="${padL - 4}" y="${H - padB}" font-size="9" fill="#71717a" text-anchor="end">0</text>
${bars}${labels}</svg>`;
}

/** ფონტები PDF-ში ჩაშენებით: ქართული (Noto Sans Georgian) + ლათინური/კირილიცა (Noto Sans) */
function fontFaces() {
  const media = path.join(__dirname, '..', 'dist', 'netwatch', 'browser', 'media');
  let files = [];
  try {
    files = fs.readdirSync(media);
  } catch {
    return '';
  }
  const face = (family, file) =>
    `@font-face { font-family: '${family}'; font-weight: 100 900; src: url(data:font/woff2;base64,${fs
      .readFileSync(path.join(media, file))
      .toString('base64')}) format('woff2'); }`;
  return [
    ...files.filter((f) => /^noto-sans-georgian-(georgian|latin)-wght/.test(f)).map((f) => face('NotoGeo', f)),
    // უკრაინული — კირილიცა
    ...files.filter((f) => /^noto-sans-(cyrillic|cyrillic-ext)-wght/.test(f)).map((f) => face('NotoSans', f)),
  ].join('\n');
}

// ───────── ფორმატირება ─────────

const pad = (n) => String(n).padStart(2, '0');

/** ენისგან დამოუკიდებელი (ISO-ს მსგავსი) — ცხრილში და Excel-ში ერთნაირად იკითხება */
function dateTime(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function esc(v) {
  return String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

module.exports = { toCsv, toPdf, dateTime };
