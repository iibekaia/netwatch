import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ConnectionService } from '../../../core/connection.service';
import { I18nService } from '../../../core/i18n.service';
import { DiagnosticsCard } from '../diagnostics-card/diagnostics-card';

/**
 * ტაბი „კავშირი“: მოკლე მდგომარეობა (რამდენ ხანს, დაყოვნება) და დიაგნოსტიკა.
 * ონლაინ/ოფლაინ თვითონ header-ში ჩანს; გათიშვების ისტორია — ტაბში „ისტორია“.
 */
@Component({
  selector: 'app-status-tab',
  imports: [DiagnosticsCard],
  templateUrl: './status-tab.html',
  host: { class: 'flex flex-col gap-3' },
})
export class StatusTab {
  protected readonly conn = inject(ConnectionService);
  protected readonly i18n = inject(I18nService);

  /** ყოველ წამში ახლდება, რომ ხანგრძლივობა "ცოცხლად" ითვლებოდეს */
  private readonly now = signal(Date.now());

  protected readonly title = computed(() => {
    const online = this.conn.online();
    const time = this.i18n.duration(this.now() - this.conn.status().since);
    if (online === null) return this.i18n.t('conn.checking');
    return this.i18n.t(online ? 'conn.onlineFor' : 'conn.offlineFor', { time });
  });

  protected readonly reason = computed(() => this.i18n.reason(this.conn.status().reason));

  constructor() {
    const tick = setInterval(() => this.now.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(tick));
  }
}
