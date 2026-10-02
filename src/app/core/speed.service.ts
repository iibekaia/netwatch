import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { ProviderInfo, SpeedPhase, SpeedResult } from './netwatch.types';

/** ძველი ვერსიები გაზომვებს აქ ინახავდნენ — ერთხელ გადადის ბაზაში და იშლება */
const LEGACY_KEY = 'netwatch.speedHistory';
const HISTORY_LIMIT = 10;

/**
 * სიჩქარის ტესტი და პროვაიდერის ინფო (Angular).
 * თვითონ გაზომვა main process-ში ხდება (electron/speed-test.js), შედეგები — ბაზაში
 * (netwatch.db → speed_tests); აქ — მხოლოდ მდგომარეობა.
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
  /** შეცდომის თარგმანის გასაღები (speed.error) */
  readonly error = signal<string | null>(null);
  /** ბოლო გაზომვები (ახალი — თავში), ბაზიდან */
  readonly history = signal<SpeedResult[]>([]);

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
    this.loadHistory();
  }

  /** ბაზიდან; პირველ გაშვებაზე — ჯერ localStorage-ის ძველი ჩანაწერების გადატანა */
  private async loadHistory(): Promise<void> {
    if (!this.api) return;
    const legacy = readLegacy();
    if (legacy) {
      await this.api.importSpeedHistory(legacy);
      try {
        localStorage.removeItem(LEGACY_KEY);
      } catch {
        // არ არის კრიტიკული — importLegacy მეორედ აღარ ჩაწერს (ცხრილი უკვე სავსეა)
      }
    }
    this.history.set(await this.api.getSpeedHistory(HISTORY_LIMIT));
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
        // main process-მა უკვე ჩაწერა ბაზაში — აქ მხოლოდ სიის განახლება
        this.history.update((h) => [res.result, ...h].slice(0, HISTORY_LIMIT));
      } else if (!/abort|cancel/i.test(res.error)) {
        this.error.set('speed.error'); // თარგმანის გასაღები
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

function readLegacy(): SpeedResult[] | null {
  try {
    const list = JSON.parse(localStorage.getItem(LEGACY_KEY) ?? 'null');
    return Array.isArray(list) && list.length ? list : null;
  } catch {
    return null;
  }
}
