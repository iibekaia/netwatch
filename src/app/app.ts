import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Icon } from './shared/icon';
import { ConnectionService } from './core/connection.service';
import { LanService } from './core/lan.service';
import { ToastService } from './core/toast.service';
import { UpdateService } from './core/update.service';
import { AutostartService } from './core/autostart.service';
import { I18nService } from './core/i18n.service';
import { Lang } from './core/netwatch.types';
import { AppTab, TabNav } from './layout/tab-nav/tab-nav';
import { Toasts } from './layout/toasts/toasts';
import { UpdateBanner } from './layout/update-banner/update-banner';
import { StatusTab } from './features/status/status-tab/status-tab';
import { LanTab } from './features/lan/lan-tab/lan-tab';
import { SpeedTab } from './features/speed/speed-tab/speed-tab';
import { HistoryTab } from './features/history/history-tab/history-tab';

/** აპის ჩარჩო: header (ენა, სტატუსი), ტაბები, აქტიური ტაბის შიგთავსი, footer, toast-ები */
@Component({
  selector: 'app-root',
  imports: [Icon, TabNav, Toasts, UpdateBanner, StatusTab, LanTab, SpeedTab, HistoryTab],
  templateUrl: './app.html',
  host: { class: 'block min-h-screen' },
})
export class App {
  protected readonly conn = inject(ConnectionService);
  protected readonly lan = inject(LanService);
  protected readonly update = inject(UpdateService);
  protected readonly autostart = inject(AutostartService);
  protected readonly i18n = inject(I18nService);
  // სიჩქარე — პირველი ტაბი; ბრაუზერის რეჟიმში (Electron-ის გარეშე) მხოლოდ კავშირი მუშაობს
  protected readonly tab = signal<AppTab>(window.netwatch ? 'speed' : 'status');
  protected readonly versions = window.netwatch?.versions;

  /** გვერდი ჩამოსქროლილია — sticky ტაბებს ქვედა ხაზი უჩნდება */
  protected readonly scrolled = signal(window.scrollY > 0);

  /** header-ის პატარა ინდიკატორი */
  protected readonly statusText = computed(() => {
    const online = this.conn.online();
    return this.i18n.t(online === null ? 'status.checking' : online ? 'status.online' : 'status.offline');
  });
  protected readonly statusDot = computed(() => {
    const online = this.conn.online();
    return online === null ? 'bg-muted' : online ? 'bg-ok' : 'bg-white';
  });

  private readonly toast = inject(ToastService);

  constructor() {
    // ───────── ჰენდლერები ─────────
    const offOffline = this.conn.onOffline((status) => {
      console.warn('[App] offline', status);
      this.toast.show(false, this.i18n.t('toast.offline', { reason: this.i18n.reason(status.reason) }));
    });

    const offOnline = this.conn.onOnline((status, prev) => {
      console.info('[App] online', status);
      this.toast.show(
        true,
        prev
          ? this.i18n.t('toast.onlineAfter', { time: this.i18n.duration(status.since - prev.since) })
          : this.i18n.t('toast.online')
      );
    });

    const onScroll = () => this.scrolled.set(window.scrollY > 0);
    window.addEventListener('scroll', onScroll, { passive: true });

    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('scroll', onScroll);
      offOffline();
      offOnline();
    });
  }

  protected setLang(event: Event): void {
    this.i18n.set((event.target as HTMLSelectElement).value as Lang);
  }
}
