import { Component, computed, input } from '@angular/core';
import { LanDevice } from '../../../core/netwatch.types';

const PLATFORMS: Record<string, string> = { win32: 'Windows', darwin: 'macOS', linux: 'Linux' };

/** ერთი მოწყობილობის ბარათი. NetWatch-ის მომხმარებელი — მწვანედ */
@Component({
  selector: 'app-device-card',
  templateUrl: './device-card.html',
  host: {
    class:
      'grid animate-slide-in grid-cols-[auto_1fr] items-start gap-3 rounded-[10px] border bg-card px-3 py-2.5 text-[13px]',
    '[class]': 'hostTone()',
  },
})
export class DeviceCard {
  readonly device = input.required<LanDevice>();

  protected readonly hostTone = computed(() => {
    const d = this.device();
    if (d.peer) return 'border-ok/55 bg-ok/9 shadow-[inset_3px_0_0_var(--ok)]';
    if (d.self) return 'border-accent/40';
    return 'border-border';
  });

  protected readonly name = computed(() => {
    const d = this.device();
    return (
      d.peer?.host ||
      d.netbiosName ||
      d.hostname ||
      (d.gateway ? 'როუტერი' : d.randomMac ? 'ტელეფონი / პლანშეტი' : 'უცნობი მოწყობილობა')
    );
  });

  protected readonly icon = computed(() => {
    const d = this.device();
    if (d.gateway) return '📶';
    if (d.self || d.peer || d.netbiosName) return '💻';
    if (d.randomMac || /iphone|ipad|android|galaxy|redmi|pixel/i.test(d.hostname ?? '')) return '📱';
    return '🔌';
  });

  /** დამატებითი ინფო, რომელიც სათაურში არ ჩანს */
  protected readonly extra = computed(() => {
    const d = this.device();
    const title = this.name();
    const parts: string[] = [];
    if (d.hostname && d.hostname !== title) parts.push(`DNS: ${d.hostname}`);
    if (d.netbiosName && d.netbiosName !== title) parts.push(`NetBIOS: ${d.netbiosName}`);
    if (d.workgroup) parts.push(`ჯგუფი: ${d.workgroup}`);
    if (d.randomMac) parts.push('შემთხვევითი MAC');
    return parts.join(' · ');
  });

  protected platform(p: string): string {
    return PLATFORMS[p] ?? p;
  }
}
