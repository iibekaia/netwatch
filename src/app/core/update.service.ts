import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { UpdateState } from './netwatch.types';

/**
 * აპის განახლება (Angular). შემოწმება/გადმოწერა main process-ში ხდება
 * (electron/updater.js) — აქ მხოლოდ მდგომარეობა და ღილაკების მოქმედებები.
 */
@Injectable({ providedIn: 'root' })
export class UpdateService {
  private readonly api = window.netwatch;

  readonly state = signal<UpdateState | null>(null);
  /** განახლება ჩართულია (dev რეჟიმში და ბრაუზერში — არა) */
  readonly enabled = computed(() => !!this.state() && this.state()!.status !== 'disabled');
  /** ბანერი ჩანს: ახალი ვერსია იწერება, მზადაა ან გადმოსაწერია */
  readonly hasUpdate = computed(() =>
    ['available', 'downloading', 'downloaded'].includes(this.state()?.status ?? '')
  );

  /**
   * მოდალი დახურა „მოგვიანებით“-ით — რომელ მდგომარეობაზე (status:version).
   * მდგომარეობა თუ შეიცვალა (მაგ. გადმოწერა დასრულდა → „გადატვირთვა“), მოდალი ისევ ჩნდება.
   */
  private readonly dismissedKey = signal<string | null>(null);
  private readonly key = computed(() => `${this.state()?.status}:${this.state()?.version}`);
  /** მოდალი ჩანს */
  readonly modalOpen = computed(() => this.hasUpdate() && this.dismissedKey() !== this.key());

  dismiss(): void {
    this.dismissedKey.set(this.key());
  }

  /** footer-იდან ხელახლა გახსნა */
  reopen(): void {
    this.dismissedKey.set(null);
  }

  constructor() {
    if (!this.api) return;
    inject(DestroyRef).onDestroy(this.api.onUpdate((s) => this.state.set(s)));
    this.api.getUpdate().then((s) => this.state.set(s));
  }

  check(): void {
    this.api?.checkUpdate().then((s) => this.state.set(s));
  }

  /** auto: გადატვირთვა და დაყენება; manual: გადმოწერის გვერდის გახსნა */
  install(): void {
    this.api?.installUpdate();
  }
}
