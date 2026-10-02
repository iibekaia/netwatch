import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ConnectionService } from '../../../core/connection.service';
import { formatDuration, reasonText } from '../../../shared/format';
import { EventLog } from '../event-log/event-log';

/** ფერები მდგომარეობის მიხედვით (Tailwind კლასები) */
const TONES = {
  online: { card: '', text: 'text-ok', halo: 'bg-ok/10', dot: 'bg-ok' },
  offline: { card: 'border-bad/25! bg-bad/5!', text: 'text-bad', halo: 'bg-bad/10', dot: 'bg-bad' },
  unknown: { card: '', text: 'text-muted', halo: 'bg-subtle', dot: 'bg-muted' },
};

/** ტაბი „კავშირი“: მიმდინარე მდგომარეობა, მეტრიკები, მოვლენების ისტორია */
@Component({
  selector: 'app-status-tab',
  imports: [EventLog],
  templateUrl: './status-tab.html',
  host: { class: 'flex min-h-0 flex-1 flex-col gap-3' },
})
export class StatusTab {
  protected readonly conn = inject(ConnectionService);
  private readonly date = new DatePipe('en-US');

  /** ყოველ წამში ახლდება, რომ ხანგრძლივობა "ცოცხლად" ითვლებოდეს */
  private readonly now = signal(Date.now());

  protected readonly stateLabel = computed(() => {
    const online = this.conn.online();
    return online === null ? 'მოწმდება…' : online ? 'ონლაინ' : 'ოფლაინ';
  });

  protected readonly tone = computed(() => {
    const online = this.conn.online();
    return TONES[online === null ? 'unknown' : online ? 'online' : 'offline'];
  });

  protected readonly duration = computed(() =>
    formatDuration(this.now() - this.conn.status().since)
  );

  protected readonly reasonLabel = computed(() => reasonText(this.conn.status().reason));

  protected readonly metrics = computed(() => {
    const s = this.conn.status();
    return [
      { label: 'დაყოვნება', value: s.latencyMs !== null ? `${s.latencyMs} ms` : '—' },
      { label: 'ბოლო შემოწმება', value: s.lastCheck ? this.date.transform(s.lastCheck, 'HH:mm:ss') : '—' },
      { label: 'ცვლილებები', value: String(this.conn.events().length) },
    ];
  });

  constructor() {
    const tick = setInterval(() => this.now.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(tick));
  }
}
