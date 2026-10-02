import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ConnectionService } from '../../../core/connection.service';
import { formatDuration, reasonText } from '../../../shared/format';
import { EventLog } from '../event-log/event-log';

/** ფერები მდგომარეობის მიხედვით (Tailwind კლასები) */
const TONES = {
  online: { card: 'border-border bg-card', text: 'text-ok', bg: 'bg-ok', dot: 'bg-ok ring-6 ring-ok/20' },
  offline: {
    card: 'border-bad/35 bg-bad-bg',
    text: 'text-bad',
    bg: 'bg-bad',
    dot: 'bg-bad ring-6 ring-bad/20',
  },
  unknown: {
    card: 'border-border bg-card',
    text: 'text-muted',
    bg: 'bg-muted',
    dot: 'bg-muted ring-6 ring-muted/20',
  },
};

/** ტაბი „კავშირი“: მიმდინარე მდგომარეობა, მეტრიკები, მოვლენების ისტორია */
@Component({
  selector: 'app-status-tab',
  imports: [EventLog],
  templateUrl: './status-tab.html',
  host: { class: 'flex min-h-0 flex-1 flex-col gap-4' },
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
