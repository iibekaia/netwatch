import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { ProviderInfo, SpeedPhase, SpeedResult } from './netwatch.types';

const HISTORY_KEY = 'netwatch.speedHistory';

/**
 * სიჩქარის ტესტი და პროვაიდერის ინფო (Angular).
 * თვითონ გაზომვა main process-ში ხდება (electron/speed-test.js), აქ — მხოლოდ მდგომარეობა.
 */
@Injectable({ providedIn: 'root' })
export class SpeedService {
  private readonly api = window.netwatch;
  readonly available = !!this.api;

  readonly provider = signal<ProviderInfo | null>(null);
  readonly providerLoading = signal(false);

  readonly running = signal(false);
  readonly phase = signal<SpeedPhase | null>(null);
  readonly phaseProgress = signal(0);
  /** მიმდინარე ტესტის მნიშვნელობები (ცოცხლად ახლდება) */
  readonly live = signal<Partial<SpeedResult>>({});
  readonly error = signal<string | null>(null);
  /** ბოლო 10 შედეგი (ახალი — თავში) */
  readonly history = signal<SpeedResult[]>(loadHistory());

  constructor() {
    if (!this.api) return;
    const destroyRef = inject(DestroyRef);

    destroyRef.onDestroy(this.api.onProvider((p) => this.provider.set(p)));
    destroyRef.onDestroy(
      this.api.onSpeedProgress((p) => {
        this.phase.set(p.phase);
        this.phaseProgress.set(p.progress);
        this.live.update((v) => ({ ...v, [p.phase]: p.value }));
      })
    );
    this.refreshProvider(false);
  }

  async refreshProvider(force = true): Promise<void> {
    if (!this.api) return;
    this.providerLoading.set(true);
    try {
      this.provider.set(await this.api.getProvider(force));
    } finally {
      this.providerLoading.set(false);
    }
  }

  async run(): Promise<void> {
    if (!this.api || this.running()) return;
    this.running.set(true);
    this.error.set(null);
    this.live.set({});
    this.phase.set('ping');
    this.phaseProgress.set(0);
    try {
      const res = await this.api.runSpeedTest();
      if (res.ok) {
        this.live.set(res.result);
        this.history.update((h) => [res.result, ...h].slice(0, 10));
        saveHistory(this.history());
      } else if (!/abort|cancel/i.test(res.error)) {
        this.error.set('ტესტი ვერ შესრულდა — შეამოწმე ინტერნეტი');
      }
    } finally {
      this.running.set(false);
      this.phase.set(null);
    }
  }

  cancel(): void {
    this.api?.cancelSpeedTest();
  }
}

function loadHistory(): SpeedResult[] {
  try {
    const list = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
    return Array.isArray(list) ? list.slice(0, 10) : [];
  } catch {
    return [];
  }
}

function saveHistory(list: SpeedResult[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  } catch {
    // შენახვა არ არის კრიტიკული
  }
}
