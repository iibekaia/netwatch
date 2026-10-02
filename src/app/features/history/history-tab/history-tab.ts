import { Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HistoryPeriod, HistoryService, PERIOD_LABELS } from '../../../core/history.service';
import { ToastService } from '../../../core/toast.service';
import { formatDuration } from '../../../shared/format';
import { Icon } from '../../../shared/icon';
import { DowntimeChart } from '../downtime-chart/downtime-chart';
import { OutageList } from '../outage-list/outage-list';

/** ტაბი „ისტორია“: uptime, გათიშვები, დღიური გრაფიკი, სია, CSV/PDF ექსპორტი */
@Component({
  selector: 'app-history-tab',
  imports: [DatePipe, Icon, DowntimeChart, OutageList],
  templateUrl: './history-tab.html',
  host: { class: 'flex flex-1 flex-col gap-3' },
})
export class HistoryTab {
  protected readonly history = inject(HistoryService);
  private readonly toast = inject(ToastService);

  protected readonly periods = Object.entries(PERIOD_LABELS) as [HistoryPeriod, string][];
  protected readonly formatDuration = formatDuration;

  protected readonly summary = computed(() => this.history.report()?.summary ?? null);

  /** ერთი წინადადება — ის, რასაც პროვაიდერს ეტყვი */
  protected readonly sentence = computed(() => {
    const s = this.summary();
    if (!s) return '';
    const when = { today: 'დღეს', week: 'ბოლო 7 დღეში', month: 'ბოლო 30 დღეში', thisMonth: 'ამ თვეში' }[
      this.history.period()
    ];
    if (!s.count) return `${when} ინტერნეტი არ გათიშულა.`;
    return `${when} ინტერნეტი ${s.count}-ჯერ გაითიშა, ჯამში ${formatDuration(s.downtimeMs)}.`;
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
    if (path) this.toast.show(true, `${format.toUpperCase()} შენახულია`);
  }

  clear(): void {
    if (confirm('წაიშალოს გათიშვების მთელი ისტორია? ამის დაბრუნება შეუძლებელია.')) this.history.clear();
  }
}
