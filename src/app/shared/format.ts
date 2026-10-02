/** ფორმატირების საერთო ფუნქციები (რამდენიმე კომპონენტი იყენებს) */

/** ms → "1სთ 2წთ" / "5წთ 3წმ" / "5წთ" / "40წმ" (საათებთან წამები აღარ ჩანს, ნულები — არც) */
export function formatDuration(ms: number | null): string {
  if (ms === null || ms < 0) return '—';
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h) return m ? `${h}სთ ${m}წთ` : `${h}სთ`;
  if (m) return s ? `${m}წთ ${s}წმ` : `${m}წთ`;
  return `${s}წმ`;
}

/** კავშირის შემოწმების მიზეზი → ადამიანური ტექსტი */
export function reasonText(reason: string): string {
  switch (reason) {
    case 'reachable':
      return 'სერვერები პასუხობს';
    case 'unreachable':
      return 'ქსელი არის, ინტერნეტი — არა';
    case 'no-network':
      return 'ქსელთან კავშირი არ არის';
    case 'browser-event':
      return 'სისტემის სიგნალი';
    default:
      return 'მოწმდება…';
  }
}

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
