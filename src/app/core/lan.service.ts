import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { LanDevice, LanState } from './netwatch.types';

export type LanFilter = 'active' | 'inactive' | 'all';
export const LAN_FILTERS: LanFilter[] = ['active', 'inactive', 'all'];

/**
 * ლოკალური ქსელის მოწყობილობები (Angular).
 * სკანირება main process-ში ხდება ავტომატურად (გაშვებისას და ყოველ წუთში);
 * ეს სერვისი მხოლოდ შედეგს იღებს, ფილტრავს და ალაგებს.
 *
 *  აქტიური    — ამ სკანირებაში დადასტურდა (ARP-ზე უპასუხა)
 *  არააქტიური — ამ ქსელში ადრე ნანახი, ახლა არ პასუხობს (გათიშულია, ძინავს, წავიდა)
 */
@Injectable({ providedIn: 'root' })
export class LanService {
  private readonly api = window.netwatch;
  readonly available = !!this.api;

  private readonly _state = signal<LanState | null>(null);
  readonly state = this._state.asReadonly();
  readonly scanning = computed(() => this._state()?.scanning ?? false);

  /** სიის ფილტრი — ნაგულისხმევად აქტიურები */
  readonly filter = signal<LanFilter>('active');

  /**
   * თანმიმდევრობა: აქტიურები (ეს კომპიუტერი, როუტერი, NetWatch-ის მომხმარებლები, დანარჩენი IP-ით),
   * მერე არააქტიურები — ბოლოს ნანახი თავში.
   */
  private readonly all = computed(() =>
    [...(this._state()?.devices ?? [])].sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      if (!a.active) return (b.lastSeen ?? 0) - (a.lastSeen ?? 0);
      return rank(a) - rank(b) || ipNum(a.ip) - ipNum(b.ip);
    })
  );

  readonly counts = computed(() => {
    const all = this.all();
    const active = all.filter((d) => d.active).length;
    return { active, inactive: all.length - active, all: all.length };
  });

  /** ფილტრის მიხედვით */
  readonly devices = computed(() => {
    const f = this.filter();
    return this.all().filter((d) => f === 'all' || d.active === (f === 'active'));
  });

  /** NetWatch-ის მომხმარებლები სხვა კომპიუტრებზე (მხოლოდ აქტიურები) */
  readonly peerCount = computed(() => this.all().filter((d) => d.active && d.peer && !d.self).length);

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
