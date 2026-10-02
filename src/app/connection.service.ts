import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { NetStatus } from './netwatch.types';

export type ConnectionHandler = (status: NetStatus, previous: NetStatus | null) => void;

export interface ConnectionEvent {
  id: number;
  online: boolean;
  at: number;
  reason: string;
  trigger: string | null;
  /** რამდენ ხანს გაგრძელდა წინა მდგომარეობა (ms) */
  previousDuration: number | null;
}

/**
 * ინტერნეტ-კავშირის სერვისი (Angular).
 *
 * წყაროები:
 *  - Electron main process (რეალური შემოწმება სერვერებთან) — window.netwatch
 *  - ბრაუზერის 'online' / 'offline' მოვლენები — მყისიერი სიგნალი ქსელის ინტერფეისის ცვლილებაზე.
 *    ეს მოვლენა main process-ს ეუბნება "შეამოწმე ახლავე", რომ დაყოვნება არ იყოს.
 *
 * ჰენდლერები:
 *   connection.onOffline((status, prev) => { ... })
 *   connection.onOnline((status, prev) => { ... })
 *   connection.onChange((status, prev) => { ... })
 * თითოეული აბრუნებს ფუნქციას გამოწერის გასაუქმებლად.
 */
@Injectable({ providedIn: 'root' })
export class ConnectionService {
  private readonly api = window.netwatch;
  readonly isElectron = !!this.api;

  private readonly _status = signal<NetStatus>({
    online: null,
    since: Date.now(),
    lastCheck: null,
    latencyMs: null,
    reason: 'starting',
    trigger: null,
  });
  private readonly _events = signal<ConnectionEvent[]>([]);
  private readonly _checking = signal(false);

  readonly status = this._status.asReadonly();
  readonly events = this._events.asReadonly();
  readonly checking = this._checking.asReadonly();
  readonly online = computed(() => this._status().online);

  private readonly onlineHandlers = new Set<ConnectionHandler>();
  private readonly offlineHandlers = new Set<ConnectionHandler>();
  private readonly changeHandlers = new Set<ConnectionHandler>();
  private eventId = 0;

  constructor() {
    const destroyRef = inject(DestroyRef);

    const onBrowserOnline = () => this.handleBrowserEvent(true);
    const onBrowserOffline = () => this.handleBrowserEvent(false);
    window.addEventListener('online', onBrowserOnline);
    window.addEventListener('offline', onBrowserOffline);
    destroyRef.onDestroy(() => {
      window.removeEventListener('online', onBrowserOnline);
      window.removeEventListener('offline', onBrowserOffline);
    });

    if (this.api) {
      const offStatus = this.api.onStatus((s) => this.apply(s));
      destroyRef.onDestroy(offStatus);
      this.api.getStatus().then((s) => this.apply(s));
    } else {
      // ბრაუზერში (Electron-ის გარეშე) — მხოლოდ navigator.onLine
      this.apply(this.browserStatus(navigator.onLine, 'start'));
    }
  }

  // ───────── საჯარო API: ჰენდლერების რეგისტრაცია ─────────

  onOnline(handler: ConnectionHandler): () => void {
    this.onlineHandlers.add(handler);
    return () => this.onlineHandlers.delete(handler);
  }

  onOffline(handler: ConnectionHandler): () => void {
    this.offlineHandlers.add(handler);
    return () => this.offlineHandlers.delete(handler);
  }

  onChange(handler: ConnectionHandler): () => void {
    this.changeHandlers.add(handler);
    return () => this.changeHandlers.delete(handler);
  }

  async checkNow(): Promise<void> {
    this._checking.set(true);
    try {
      if (this.api) this.apply(await this.api.checkNow('manual'));
      else this.apply(this.browserStatus(navigator.onLine, 'manual'));
    } finally {
      this._checking.set(false);
    }
  }

  toggleDevTools(): void {
    this.api?.toggleDevTools();
  }

  clearLog(): void {
    this._events.set([]);
  }

  // ───────── შიდა ლოგიკა ─────────

  private handleBrowserEvent(online: boolean): void {
    if (this.api) {
      // ინტერფეისი გაითიშა — ეს ზუსტია, მაშინვე ვაჩვენებთ.
      if (!online) this.apply(this.browserStatus(false, 'browser-offline'));
      // ორივე შემთხვევაში main process რეალურად გადაამოწმებს.
      this.api.checkNow(online ? 'browser-online' : 'browser-offline').then((s) => this.apply(s));
    } else {
      this.apply(this.browserStatus(online, online ? 'browser-online' : 'browser-offline'));
    }
  }

  private browserStatus(online: boolean, trigger: string): NetStatus {
    const prev = this._status();
    const now = Date.now();
    return {
      online,
      since: prev.online === online ? prev.since : now,
      lastCheck: now,
      latencyMs: null,
      reason: online ? 'browser-event' : 'no-network',
      trigger,
    };
  }

  private apply(next: NetStatus): void {
    const prev = this._status();
    // ძველი პასუხი (მაგ. დაგვიანებული IPC) ახალს არ უნდა გადაეწეროს
    if (prev.lastCheck && next.lastCheck && next.lastCheck < prev.lastCheck) return;

    this._status.set(next);
    if (next.online === null || next.online === prev.online) return;

    const previous = prev.online === null ? null : prev;
    this._events.update((list) =>
      [
        {
          id: ++this.eventId,
          online: next.online!,
          at: next.since,
          reason: next.reason,
          trigger: next.trigger,
          previousDuration: previous ? next.since - previous.since : null,
        },
        ...list,
      ].slice(0, 100)
    );

    this.run(this.changeHandlers, next, previous);
    this.run(next.online ? this.onlineHandlers : this.offlineHandlers, next, previous);
  }

  private run(handlers: Set<ConnectionHandler>, status: NetStatus, prev: NetStatus | null): void {
    for (const handler of handlers) {
      try {
        handler(status, prev);
      } catch (err) {
        console.error('[ConnectionService] handler error', err);
      }
    }
  }
}
