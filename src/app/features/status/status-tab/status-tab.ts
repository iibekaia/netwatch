import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ConnectionService } from '../../../core/connection.service';
import { formatDuration, reasonText } from '../../../shared/format';
import { DiagnosticsCard } from '../diagnostics-card/diagnostics-card';

/**
 * ტაბი „კავშირი“: მოკლე მდგომარეობა (რამდენ ხანს, დაყოვნება) და დიაგნოსტიკა.
 * ონლაინ/ოფლაინ თვითონ header-ში ჩანს; გათიშვების ისტორია — ტაბში „ისტორია“.
 */
@Component({
  selector: 'app-status-tab',
  imports: [DatePipe, DiagnosticsCard],
  templateUrl: './status-tab.html',
  host: { class: 'flex flex-col gap-3' },
})
export class StatusTab {
  protected readonly conn = inject(ConnectionService);

  /** ყოველ წამში ახლდება, რომ ხანგრძლივობა "ცოცხლად" ითვლებოდეს */
  private readonly now = signal(Date.now());

  protected readonly title = computed(() => {
    const online = this.conn.online();
    const since = formatDuration(this.now() - this.conn.status().since);
    if (online === null) return 'მოწმდება…';
    return online ? `ონლაინ უკვე ${since}` : `ოფლაინ უკვე ${since}`;
  });

  protected readonly reason = computed(() => reasonText(this.conn.status().reason));

  constructor() {
    const tick = setInterval(() => this.now.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(tick));
  }
}
