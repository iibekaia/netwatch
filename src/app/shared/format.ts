/**
 * ენისგან დამოუკიდებელი ფორმატირება. ტექსტთან დაკავშირებული (ხანგრძლივობა, მიზეზი, თარიღი) —
 * I18nService-შია (core/i18n.service.ts).
 */

/** რიცხვი ჩვენებისთვის: 100-ზე მეტი — მთელი, ნაკლები — digits ათწილადით */
export function formatNumber(v: number | undefined, digits: number): string {
  if (v === undefined) return '—';
  return v >= 100 ? Math.round(v).toString() : v.toFixed(digits);
}

/** "255.255.255.0" → 24 */
export function netmaskPrefix(netmask: string): number {
  return netmask
    .split('.')
    .reduce((n, part) => n + Number(part).toString(2).replace(/0/g, '').length, 0);
}
