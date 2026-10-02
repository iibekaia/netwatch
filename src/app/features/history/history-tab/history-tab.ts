import { Component, computed, inject } from '@angular/core';
import { HistoryService, PERIODS } from '../../../core/history.service';
import { ToastService } from '../../../core/toast.service';
import { I18nService } from '../../../core/i18n.service';
import { Icon } from '../../../shared/icon';
import { DowntimeChart } from '../downtime-chart/downtime-chart';
import { OutageList } from '../outage-list/outage-list';

/** ტაბი „ისტორია“: uptime, გათიშვები, დღიური გრაფიკი, სია, CSV/PDF ექსპორტი */
@Component({
  selector: 'app-history-tab',
  imports: [Icon, DowntimeChart, OutageList],
  templateUrl: './history-tab.html',
  host: { class: 'flex flex-1 flex-col gap-3' },
})
export class HistoryTab {
  protected readonly history = inject(HistoryService);
  protected readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);

  protected readonly periods = PERIODS;

  protected readonly summary = computed(() => this.history.report()?.summary ?? null);

  /** ერთი წინადადება — ის, რასაც პროვაიდერს ეტყვი */
  protected readonly sentence = computed(() => {
    const s = this.summary();
    if (!s) return '';
    const when = this.i18n.t('history.when.' + this.history.period());
    if (!s.count) return this.i18n.t('history.sentenceNone', { when });
    return this.i18n.t('history.sentence', { when, count: s.count, total: this.i18n.duration(s.downtimeMs) });
  });

  protected readonly uptime = computed(() => {
    const p = this.summary()?.uptimePct;
    if (p === null || p === undefined) return '—';
    // 100%-თან ახლოს ათწილადები მნიშვნელოვანია: 99.99% ≠ 100%
    return p >= 99.995 ? '100%' : `${p.toFixed(2)}%`;
  });

  protected readonly uptimeTone = computed(() => {
    const p = this.summary()?.uptimePct;
    if (p === null || p === undefined) return 'bg-muted';
    return p >= 99.5 ? 'bg-ok' : p >= 97 ? 'bg-warn' : 'bg-bad';
  });

  async export(format: 'csv' | 'pdf'): Promise<void> {
    const path = await this.history.export(format);
    if (path) this.toast.show(true, this.i18n.t('toast.saved', { format: format.toUpperCase() }));
  }

  clear(): void {
    if (confirm(this.i18n.t('history.clearConfirm'))) this.history.clear();
  }
}
