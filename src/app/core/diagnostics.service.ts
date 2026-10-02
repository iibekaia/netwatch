import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { DiagState } from './netwatch.types';
import { ConnectionService } from './connection.service';

/**
 * „სად არის პრობლემა?“ (Angular). შემოწმება main process-ში ხდება (electron/diagnostics.js):
 * ავტომატურად — ინტერნეტის გათიშვისას, ან ხელით — run()-ით.
 */
@Injectable({ providedIn: 'root' })
export class DiagnosticsService {
  private readonly api = window.netwatch;
  private readonly conn = inject(ConnectionService);
  readonly available = !!this.api;

  readonly state = signal<DiagState>({ running: false, trigger: null, result: null });

  constructor() {
    if (!this.api) return;
    inject(DestroyRef).onDestroy(this.api.onDiagnostics((s) => this.state.set(s)));
    this.api.getDiagnostics().then((s) => this.state.set(s));
  }

  /** ერთი ღილაკი — კავშირიც (სტატუსი) და ჯაჭვის ყველა რგოლიც */
  run(): void {
    this.conn.checkNow();
    this.api?.runDiagnostics().then((s) => this.state.set(s));
  }
}
