import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ConnectionService } from './connection.service';
import { LanService } from './lan.service';
import { LanDevice } from './netwatch.types';

interface Toast {
  id: number;
  online: boolean;
  text: string;
}

@Component({
  selector: 'app-root',
  imports: [DatePipe],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly conn = inject(ConnectionService);
  protected readonly lan = inject(LanService);
  protected readonly tab = signal<'status' | 'lan'>('status');
  protected readonly toasts = signal<Toast[]>([]);
  protected readonly versions = window.netwatch?.versions;

  /** ყოველ წამში ახლდება, რომ ხანგრძლივობა "ცოცხლად" ითვლებოდეს */
  private readonly now = signal(Date.now());

  protected readonly stateLabel = computed(() => {
    const online = this.conn.online();
    return online === null ? 'მოწმდება…' : online ? 'ონლაინ' : 'ოფლაინ';
  });

  protected readonly stateClass = computed(() => {
    const online = this.conn.online();
    return online === null ? 'unknown' : online ? 'online' : 'offline';
  });

  protected readonly duration = computed(() =>
    this.formatDuration(this.now() - this.conn.status().since)
  );

  protected readonly reasonLabel = computed(() => this.reasonText(this.conn.status().reason));

  private toastId = 0;

  constructor() {
    const destroyRef = inject(DestroyRef);
    const tick = setInterval(() => this.now.set(Date.now()), 1000);
    destroyRef.onDestroy(() => clearInterval(tick));

    // ───────── ჰენდლერები ─────────
    const offOffline = this.conn.onOffline((status) => {
      console.warn('[App] ინტერნეტი გაითიშა', status);
      this.showToast(false, `ინტერნეტი გაითიშა — ${this.reasonText(status.reason)}`);
    });

    const offOnline = this.conn.onOnline((status, prev) => {
      console.info('[App] ინტერნეტი ჩაირთო', status);
      const downFor = prev ? ` (გათიშული იყო ${this.formatDuration(status.since - prev.since)})` : '';
      this.showToast(true, `ინტერნეტი ჩაირთო${downFor}`);
    });

    destroyRef.onDestroy(() => {
      offOffline();
      offOnline();
    });
  }

  protected formatDuration(ms: number | null): string {
    if (ms === null || ms < 0) return '—';
    const total = Math.floor(ms / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h) return `${h}სთ ${m}წთ ${s}წმ`;
    if (m) return `${m}წთ ${s}წმ`;
    return `${s}წმ`;
  }

  protected reasonText(reason: string): string {
    switch (reason) {
      case 'reachable':
        return 'სერვერები პასუხობს';
      case 'unreachable':
        return 'ქსელი არის, ინტერნეტი — არა';
      case 'no-network':
        return 'ქსელთან კავშირი არ არის';
      case 'browser-event':
        return 'სისტემის სიგნალი';
      default:
        return 'მოწმდება…';
    }
  }

  // ───────── ქსელის მოწყობილობები ─────────

  protected deviceName(d: LanDevice): string {
    return (
      d.peer?.host ||
      d.netbiosName ||
      d.hostname ||
      (d.gateway ? 'როუტერი' : d.randomMac ? 'ტელეფონი / პლანშეტი' : 'უცნობი მოწყობილობა')
    );
  }

  protected kindIcon(d: LanDevice): string {
    if (d.gateway) return '📶';
    if (d.self || d.peer || d.netbiosName) return '💻';
    if (d.randomMac || /iphone|ipad|android|galaxy|redmi|pixel/i.test(d.hostname ?? '')) return '📱';
    return '🔌';
  }

  /** დამატებითი ინფო, რომელიც სათაურში არ ჩანს */
  protected extraInfo(d: LanDevice): string {
    const title = this.deviceName(d);
    const parts: string[] = [];
    if (d.hostname && d.hostname !== title) parts.push(`DNS: ${d.hostname}`);
    if (d.netbiosName && d.netbiosName !== title) parts.push(`NetBIOS: ${d.netbiosName}`);
    if (d.workgroup) parts.push(`ჯგუფი: ${d.workgroup}`);
    if (d.randomMac) parts.push('შემთხვევითი MAC');
    return parts.join(' · ');
  }

  protected platformName(p: string): string {
    return { win32: 'Windows', darwin: 'macOS', linux: 'Linux' }[p] ?? p;
  }

  protected prefix(netmask: string): number {
    return netmask
      .split('.')
      .reduce((n, part) => n + Number(part).toString(2).replace(/0/g, '').length, 0);
  }

  protected dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  private showToast(online: boolean, text: string): void {
    const id = ++this.toastId;
    this.toasts.update((list) => [...list, { id, online, text }].slice(-3));
    setTimeout(() => this.dismiss(id), 5000);
  }
}
