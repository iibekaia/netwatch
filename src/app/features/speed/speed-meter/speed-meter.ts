import { Component, computed, input } from '@angular/core';
import { formatNumber } from '../../../shared/format';
import { Icon, IconName } from '../../../shared/icon';

/**
 * სიჩქარის ბარი ლოგარითმული სკალით 0–1000 Mbps
 * (10 → 35%, 100 → 67%), რომ ნელი და სწრაფი ინტერნეტი ორივე კარგად ჩანდეს.
 */
@Component({
  selector: 'app-speed-meter',
  imports: [Icon],
  templateUrl: './speed-meter.html',
  host: { class: 'block' },
})
export class SpeedMeter {
  readonly label = input.required<string>();
  readonly icon = input.required<IconName>();
  /** Mbps; undefined — ჯერ არ გაზომილა */
  readonly value = input<number | undefined>(undefined);
  /** ახლა იზომება — ბარზე "ნათება" მოძრაობს */
  readonly active = input(false);
  readonly color = input<'accent' | 'ok'>('accent');

  protected readonly display = computed(() => formatNumber(this.value(), 1));

  protected readonly percent = computed(() => {
    const v = this.value();
    if (!v || v <= 0) return 0;
    return Math.min(100, (Math.log10(1 + v) / Math.log10(1001)) * 100);
  });

  protected readonly tone = computed(() =>
    this.color() === 'ok' ? { bar: 'bg-ok', text: 'text-ok bg-ok/10' } : { bar: 'bg-accent', text: 'text-accent bg-accent/10' }
  );

  /** სკალის ნიშნულები და მათი პოზიცია (%) */
  protected readonly ticks = [
    { label: '0', pos: 'left-0' },
    { label: '10', pos: 'left-[34.7%] -translate-x-1/2' },
    { label: '100', pos: 'left-[66.8%] -translate-x-1/2' },
    { label: '1000', pos: 'right-0' },
  ];
}
