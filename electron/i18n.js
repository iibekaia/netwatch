const { EventEmitter } = require('events');
const { app } = require('electron');

/**
 * ენები (main process): შეტყობინებები, tray, დიაგნოსტიკა, PDF/CSV.
 * იგივე ფაილებს (electron/locales/*.json) Angular-იც კითხულობს — ერთი წყარო ორივესთვის.
 *
 * ნაგულისხმევი ენა (თუ მომხმარებელს არ აურჩევია):
 *   1. დროის სარტყელი — რეალური მდებარეობა (Windows-ის "რეგიონი" ხშირად ნაგულისხმევ US-ზე რჩება)
 *   2. სისტემის რეგიონის კოდი (GE / UA / DE …)
 *   3. სისტემის ენების სიიდან პირველი მხარდაჭერილი
 *   4. ინგლისური
 */

const LOCALES = {
  ka: require('./locales/ka.json'),
  en: require('./locales/en.json'),
  uk: require('./locales/uk.json'),
  de: require('./locales/de.json'),
};
const SUPPORTED = Object.keys(LOCALES);

const BY_TIMEZONE = {
  'Asia/Tbilisi': 'ka',
  'Europe/Kyiv': 'uk',
  'Europe/Kiev': 'uk',
  'Europe/Uzhgorod': 'uk',
  'Europe/Zaporozhye': 'uk',
  'Europe/Berlin': 'de',
  'Europe/Busingen': 'de',
  'Europe/Vienna': 'de',
  'Europe/Zurich': 'de',
  'Europe/Vaduz': 'de',
  'Europe/Luxembourg': 'de',
};
const BY_REGION = { GE: 'ka', UA: 'uk', DE: 'de', AT: 'de', CH: 'de', LI: 'de', LU: 'de' };

class I18n extends EventEmitter {
  constructor() {
    super();
    this.lang = 'en';
  }

  /** settings-იდან შენახული არჩევანი ან ავტომატური განსაზღვრა */
  init(saved) {
    this.lang = SUPPORTED.includes(saved) ? saved : detect();
  }

  set(lang) {
    if (!SUPPORTED.includes(lang) || lang === this.lang) return;
    this.lang = lang;
    this.emit('change', lang);
  }

  /** t('diag.verdict.router.title'), t('lan.devices', { count: 5 }) — plural ფორმა count-ით */
  t(key, params = {}) {
    let value = lookup(LOCALES[this.lang], key) ?? lookup(LOCALES.en, key) ?? key;
    if (value && typeof value === 'object') {
      const form = new Intl.PluralRules(this.lang).select(params.count ?? 0);
      value = value[form] ?? value.other;
    }
    return String(value).replace(/\{(\w+)\}/g, (m, name) => (name in params ? String(params[name]) : m));
  }

  /** ms → "1სთ 2წთ" / "5 Min. 3 Sek." (საათებთან წამები აღარ ჩანს, ნულები — არც) */
  duration(ms) {
    const total = Math.max(0, Math.round(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h) return this.t(m ? 'dur.hm' : 'dur.h', { h, m });
    if (m) return this.t(s ? 'dur.ms' : 'dur.m', { m, s });
    return this.t('dur.s', { s });
  }

  /** "2 ოქტ 2026" — ქართულისთვის თვეები ფაილიდან (main process-ის Node-ს ქართული თარიღები არ აქვს) */
  day(t, { year = false } = {}) {
    const d = new Date(t);
    const months = LOCALES[this.lang].meta.months;
    if (months) return `${d.getDate()} ${months[d.getMonth()]}${year ? ' ' + d.getFullYear() : ''}`;
    return new Intl.DateTimeFormat(LOCALES[this.lang].meta.dateLocale, {
      day: 'numeric',
      month: 'short',
      ...(year ? { year: 'numeric' } : {}),
    }).format(d);
  }
}

function lookup(dict, key) {
  return key.split('.').reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), dict);
}

function detect() {
  const preferred = safe(() => app.getPreferredSystemLanguages(), []);
  const codes = preferred.map((l) => l.toLowerCase().split(/[-_]/)[0]);
  const tz = safe(() => Intl.DateTimeFormat().resolvedOptions().timeZone, '');
  if (BY_TIMEZONE[tz]) return BY_TIMEZONE[tz];

  const region = safe(() => app.getSystemLocale(), '').split(/[-_]/)[1]?.toUpperCase();
  if (BY_REGION[region]) return BY_REGION[region];

  return codes.find((c) => SUPPORTED.includes(c)) ?? 'en';
}

function safe(fn, fallback) {
  try {
    return fn() ?? fallback;
  } catch {
    return fallback;
  }
}

const i18n = new I18n();

module.exports = { i18n, SUPPORTED, LOCALES };
