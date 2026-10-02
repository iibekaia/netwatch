import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ConnectionService } from './connection.service';
import { LanService } from './lan.service';
import { SpeedService } from './speed.service';
import { LanDevice, ProviderInfo } from './netwatch.types';

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
  protected readonly speed = inject(SpeedService);
  protected readonly tab = signal<'status' | 'lan' | 'speed'>('status');

  protected readonly gauges = [
    { key: 'download', label: 'ჩამოტვირთვა', icon: '↓' },
    { key: 'upload', label: 'ატვირთვა', icon: '↑' },
  ] as const;

  /** მთლიანი ტესტის პროგრესი: ping 10%, download 45%, upload 45% */
  protected readonly overallProgress = computed(() => {
    const p = this.speed.phaseProgress();
    switch (this.speed.phase()) {
      case 'ping':
        return p * 10;
      case 'download':
        return 10 + p * 45;
      case 'upload':
        return 55 + p * 45;
      default:
        return 0;
    }
  });

  protected readonly phaseLabel = computed(
    () =>
      ({ ping: 'ping-ის გაზომვა', download: 'ჩამოტვირთვა', upload: 'ატვირთვა' })[
        this.speed.phase() ?? 'ping'
      ]
  );

  /** მოკლე შეფასება: რისთვის ჰყოფნის ეს ინტერნეტი */
  protected readonly verdict = computed(() => {
    const { download = 0, upload = 0, ping = 999 } = this.speed.live();
    if (download >= 100 && upload >= 20 && ping <= 30)
      return 'შესანიშნავი — 4K ვიდეო, თამაშები და დიდი ფაილები უპრობლემოდ.';
    if (download >= 25 && upload >= 5 && ping <= 60)
      return 'კარგი — HD ვიდეო, ვიდეოზარები და თამაშები ნორმალურად იმუშავებს.';
    if (download >= 5 && ping <= 120)
      return 'საშუალო — ბრაუზინგი და ვიდეოზარი, მაგრამ მაღალ ხარისხზე შეიძლება შეფერხდეს.';
    return 'სუსტი — ვიდეო და ზარები შეიძლება ჭედავდეს.';
  });
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

  // ───────── სიჩქარე ─────────

  /** ლოგარითმული სკალა 0–1000 Mbps: 10 → 35%, 100 → 67% */
  protected barPct(mbps: number | undefined): number {
    if (!mbps || mbps <= 0) return 0;
    return Math.min(100, (Math.log10(1 + mbps) / Math.log10(1001)) * 100);
  }

  protected fmt(v: number | undefined, digits: number): string {
    if (v === undefined) return '—';
    return v >= 100 ? Math.round(v).toString() : v.toFixed(digits);
  }

  protected location(p: ProviderInfo): string {
    const parts = [p.city, p.region !== p.city ? p.region : null, p.country];
    return parts.filter(Boolean).join(', ') || '—';
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
