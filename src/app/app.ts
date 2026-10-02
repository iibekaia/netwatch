import { Component, DestroyRef, inject, signal } from '@angular/core';
import { ConnectionService } from './core/connection.service';
import { LanService } from './core/lan.service';
import { ToastService } from './core/toast.service';
import { formatDuration, reasonText } from './shared/format';
import { AppTab, TabNav } from './layout/tab-nav/tab-nav';
import { Toasts } from './layout/toasts/toasts';
import { StatusTab } from './features/status/status-tab/status-tab';
import { LanTab } from './features/lan/lan-tab/lan-tab';
import { SpeedTab } from './features/speed/speed-tab/speed-tab';

/** აპის ჩარჩო: header, ტაბები, აქტიური ტაბის შიგთავსი, footer, toast-ები */
@Component({
  selector: 'app-root',
  imports: [TabNav, Toasts, StatusTab, LanTab, SpeedTab],
  templateUrl: './app.html',
  host: { class: 'block min-h-screen' },
})
export class App {
  protected readonly conn = inject(ConnectionService);
  protected readonly lan = inject(LanService);
  protected readonly tab = signal<AppTab>('status');
  protected readonly versions = window.netwatch?.versions;

  private readonly toast = inject(ToastService);

  constructor() {
    // ───────── ჰენდლერები ─────────
    const offOffline = this.conn.onOffline((status) => {
      console.warn('[App] ინტერნეტი გაითიშა', status);
      this.toast.show(false, `ინტერნეტი გაითიშა — ${reasonText(status.reason)}`);
    });

    const offOnline = this.conn.onOnline((status, prev) => {
      console.info('[App] ინტერნეტი ჩაირთო', status);
      const downFor = prev ? ` (გათიშული იყო ${formatDuration(status.since - prev.since)})` : '';
      this.toast.show(true, `ინტერნეტი ჩაირთო${downFor}`);
    });

    inject(DestroyRef).onDestroy(() => {
      offOffline();
      offOnline();
    });
  }
}
