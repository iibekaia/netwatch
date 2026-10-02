import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { HistoryRange, HistoryReport } from './netwatch.types';
import { I18nService } from './i18n.service';

export type HistoryPeriod = 'today' | 'week' | 'month' | 'thisMonth';
export const PERIODS: HistoryPeriod[] = ['today', 'week', 'month', 'thisMonth'];

/**
 * გათიშვების ისტორია და სტატისტიკა (Angular). მონაცემები დისკზე ინახება და
 * main process ითვლის (electron/history-stats.js) — აქ მხოლოდ პერიოდი და ჩვენება.
 */
@Injectable({ providedIn: 'root' })
export class HistoryService {
  private readonly api = window.netwatch;
  private readonly i18n = inject(I18nService);
  readonly available = !!this.api;

  readonly period = signal<HistoryPeriod>('week');
  readonly report = signal<HistoryReport | null>(null);
  readonly exporting = signal<'csv' | 'pdf' | null>(null);

  /** PDF-ის ქვესათაურისთვის — მიმდინარე ენაზე */
  readonly periodLabel = computed(() => this.i18n.t('history.periods.' + this.period()));

  constructor() {
    if (!this.api) return;
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(this.api.onHistory(() => this.refresh()));
    // მიმდინარე გათიშვის ხანგრძლივობა და uptime "ცოცხლად" — ყოველ წუთში
    const tick = setInterval(() => this.refresh(), 60 * 1000);
    destroyRef.onDestroy(() => clearInterval(tick));
    this.refresh();
  }

  setPeriod(p: HistoryPeriod): void {
    this.period.set(p);
    this.refresh();
  }

  refresh(): void {
    this.api?.queryHistory(this.range()).then((r) => this.report.set(r));
  }

  /** CSV/PDF — main process ხსნის შენახვის ფანჯარას; აბრუნებს ფაილის გზას (ან null) */
  async export(format: 'csv' | 'pdf'): Promise<string | null> {
    if (!this.api || this.exporting()) return null;
    this.exporting.set(format);
    try {
      const res = await this.api.exportHistory({ ...this.range(), format, periodLabel: this.periodLabel() });
      return res.ok ? res.path : null;
    } finally {
      this.exporting.set(null);
    }
  }

  async clear(): Promise<void> {
    await this.api?.clearHistory();
    this.refresh();
  }

  /** პერიოდი ლოკალური დროით: დღის/თვის დასაწყისიდან ახლამდე */
  private range(): HistoryRange {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    switch (this.period()) {
      case 'week':
        start.setDate(start.getDate() - 6);
        break;
      case 'month':
        start.setDate(start.getDate() - 29);
        break;
      case 'thisMonth':
        start.setDate(1);
        break;
    }
    return { from: start.getTime(), to: now.getTime() };
  }
}
