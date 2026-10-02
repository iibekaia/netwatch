import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { LanDevice, LanState } from './netwatch.types';

/**
 * ლოკალური ქსელის მოწყობილობები (Angular).
 * სკანირება main process-ში ხდება ავტომატურად (გაშვებისას და ყოველ წუთში);
 * ეს სერვისი მხოლოდ შედეგს იღებს და ალაგებს.
 */
@Injectable({ providedIn: 'root' })
export class LanService {
  private readonly api = window.netwatch;
  readonly available = !!this.api;

  private readonly _state = signal<LanState | null>(null);
  readonly state = this._state.asReadonly();
  readonly scanning = computed(() => this._state()?.scanning ?? false);

  /** თანმიმდევრობა: ეს კომპიუტერი, როუტერი, NetWatch-ის მომხმარებლები, დანარჩენი IP-ით */
  readonly devices = computed(() =>
    [...(this._state()?.devices ?? [])].sort(
      (a, b) => rank(a) - rank(b) || ipNum(a.ip) - ipNum(b.ip)
    )
  );
  /** NetWatch-ის მომხმარებლები სხვა კომპიუტრებზე */
  readonly peerCount = computed(() => this.devices().filter((d) => d.peer && !d.self).length);

  constructor() {
    if (!this.api) return;
    const off = this.api.onLan((s) => this._state.set(s));
    inject(DestroyRef).onDestroy(off);
    this.api.getLan().then((s) => this._state.set(s));
  }

  async scan(): Promise<void> {
    if (this.api) this._state.set(await this.api.scanLan());
  }
}

function rank(d: LanDevice): number {
  if (d.self) return 0;
  if (d.gateway) return 1;
  if (d.peer) return 2;
  return 3;
}

function ipNum(ip: string): number {
  return ip.split('.').reduce((acc, p) => acc * 256 + Number(p), 0);
}
