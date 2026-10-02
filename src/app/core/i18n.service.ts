import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { Lang, Translatable } from './netwatch.types';
// იგივე ფაილები, რასაც main process კითხულობს (შეტყობინებები, tray, PDF) — ერთი წყარო
import ka from '../../../electron/locales/ka.json';
import en from '../../../electron/locales/en.json';
import uk from '../../../electron/locales/uk.json';
import de from '../../../electron/locales/de.json';

type Dict = { meta: { native: string; dateLocale: string; months?: string[] } } & Record<string, unknown>;
type Params = Record<string, string | number>;

const LOCALES: Record<Lang, Dict> = { ka, en, uk, de };
const LANGS = Object.keys(LOCALES) as Lang[];
const STORAGE_KEY = 'netwatch.lang';

/**
 * ენები (Angular): t('speed.measure'), t('lan.devices', { count: 5 }), duration(ms), date(ts, 'time').
 * ენის სიგნალზეა მიბმული — გადართვისას ყველა ტექსტი მაშინვე ახლდება.
 *
 * Electron-ში საწყის ენას main process ირჩევს (რეგიონი / სისტემის ენები / შენახული არჩევანი)
 * და preload-ი სინქრონულად აწვდის; ბრაუზერის რეჟიმში — navigator.languages + დროის სარტყელი.
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly api = window.netwatch;

  readonly lang = signal<Lang>(this.api?.i18n.lang ?? detectInBrowser());
  readonly languages = LANGS.map((code) => ({ code, name: LOCALES[code].meta.native }));
  readonly native = computed(() => LOCALES[this.lang()].meta.native);

  constructor() {
    document.documentElement.lang = this.lang();
    if (this.api) {
      // tray-იდან ან სხვა ფანჯრიდან შეცვლა
      inject(DestroyRef).onDestroy(this.api.onLanguage((l) => this.apply(l)));
    }
  }

  set(lang: Lang): void {
    this.apply(lang);
    if (this.api) this.api.setLanguage(lang);
    else safe(() => localStorage.setItem(STORAGE_KEY, lang));
  }

  /** თარგმანი; plural — count-ით ({ one, few, many, other }) */
  t(key: string, params: Params = {}): string {
    const lang = this.lang();
    let value = lookup(LOCALES[lang], key) ?? lookup(LOCALES.en, key) ?? key;
    if (value && typeof value === 'object') {
      const forms = value as Record<string, string>;
      value = forms[new Intl.PluralRules(lang).select(Number(params['count'] ?? 0))] ?? forms['other'];
    }
    return String(value).replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m));
  }

  /** main process-იდან მოსული { key, params } */
  tr(text: Translatable | null | undefined): string {
    return text ? this.t(text.key, text.params) : '';
  }

  /** ms → "1სთ 2წთ" / "5 Min. 3 Sek." (საათებთან წამები არ ჩანს, ნულები — არც) */
  duration(ms: number | null): string {
    if (ms === null || ms < 0) return '—';
    const total = Math.floor(ms / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h) return this.t(m ? 'dur.hm' : 'dur.h', { h, m });
    if (m) return this.t(s ? 'dur.ms' : 'dur.m', { m, s });
    return this.t('dur.s', { s });
  }

  /** კავშირის შემოწმების მიზეზი (reachable / unreachable / …) */
  reason(reason: string): string {
    const key = `reason.${reason}`;
    const text = this.t(key);
    return text === key ? this.t('reason.checking') : text;
  }

  /**
   * თარიღი/დრო მიმდინარე ენაზე:
   *   time     — 17:28:05        day      — 2 ოქტ
   *   dayTime  — 2 ოქტ, 17:28    dayWeek  — 2 ოქტ, ხუთ
   *   short    — 02.10 17:28
   * ქართულისთვის თვეები ენის ფაილიდან — main process-ის (PDF) თარიღებთან ერთნაირად.
   */
  date(ts: number, style: 'time' | 'day' | 'dayTime' | 'dayWeek' | 'short'): string {
    const meta = LOCALES[this.lang()].meta;
    const d = new Date(ts);
    const pad = (n: number) => String(n).padStart(2, '0');
    const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    switch (style) {
      case 'time':
        return `${hm}:${pad(d.getSeconds())}`;
      case 'short':
        return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${hm}`;
    }
    const day = meta.months
      ? `${d.getDate()} ${meta.months[d.getMonth()]}`
      : new Intl.DateTimeFormat(meta.dateLocale, { day: 'numeric', month: 'short' }).format(d);
    if (style === 'dayTime') return `${day}, ${hm}`;
    if (style === 'dayWeek') {
      const wd = new Intl.DateTimeFormat(meta.dateLocale, { weekday: 'short' }).format(d);
      return `${day}, ${wd}`;
    }
    return day;
  }

  private apply(lang: Lang): void {
    if (!LANGS.includes(lang) || lang === this.lang()) return;
    this.lang.set(lang);
    document.documentElement.lang = lang;
  }
}

function lookup(dict: unknown, key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), dict);
}

/** ბრაუზერის რეჟიმი (Electron-ის გარეშე): შენახული → დროის სარტყელი → ენების სია → en */
function detectInBrowser(): Lang {
  const saved = safe(() => localStorage.getItem(STORAGE_KEY)) as Lang | null;
  if (saved && LANGS.includes(saved)) return saved;
  const codes = navigator.languages.map((l) => l.toLowerCase().split('-')[0]);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (tz === 'Asia/Tbilisi') return 'ka';
  if (/^Europe\/(Kyiv|Kiev|Uzhgorod|Zaporozhye)$/.test(tz)) return 'uk';
  if (/^Europe\/(Berlin|Busingen|Vienna|Zurich|Vaduz|Luxembourg)$/.test(tz)) return 'de';
  return (codes.find((c) => LANGS.includes(c as Lang)) as Lang | undefined) ?? 'en';
}

function safe<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}
