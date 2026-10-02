import { Component, computed, input } from '@angular/core';
import { LanDevice } from '../../../core/netwatch.types';
import { Icon, IconName } from '../../../shared/icon';

const PLATFORMS: Record<string, string> = { win32: 'Windows', darwin: 'macOS', linux: 'Linux' };
const PHONE_NAME = /iphone|ipad|android|galaxy|redmi|pixel/i;
// Apple-ის კომპიუტრებიც შემთხვევით MAC-ს იყენებენ — ამიტომ სახელი MAC-ზე ადრე მოწმდება
const COMPUTER_NAME = /^mac\b|macbook|imac|desktop|laptop|^pc\b|-pc\b/i;

/** ერთი მოწყობილობის რიგი სიაში. NetWatch-ის მომხმარებელი — მწვანე ფონით */
@Component({
  selector: 'app-device-card',
  imports: [Icon],
  templateUrl: './device-card.html',
  host: {
    class: 'grid animate-fade-in grid-cols-[auto_1fr] items-center gap-3 px-4 py-3',
    '[class.bg-ok/5]': '!!device().peer',
  },
})
export class DeviceCard {
  readonly device = input.required<LanDevice>();

  protected readonly name = computed(() => {
    const d = this.device();
    return (
      d.peer?.host ||
      d.netbiosName ||
      d.hostname ||
      (d.gateway ? 'როუტერი' : d.randomMac ? 'ტელეფონი / პლანშეტი' : 'უცნობი მოწყობილობა')
    );
  });

  protected readonly icon = computed<IconName>(() => {
    const d = this.device();
    if (d.gateway) return 'router';
    if (d.self || d.peer || d.netbiosName || COMPUTER_NAME.test(d.hostname ?? '')) return 'laptop';
    if (d.randomMac || PHONE_NAME.test(d.hostname ?? '')) return 'phone';
    return 'chip';
  });

  protected readonly iconTone = computed(() => {
    const d = this.device();
    if (d.peer) return 'bg-ok/12 text-ok';
    if (d.self) return 'bg-accent/10 text-accent';
    return 'bg-subtle text-muted';
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
