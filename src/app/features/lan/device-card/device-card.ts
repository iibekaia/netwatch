import { Component, computed, inject, input } from '@angular/core';
import { LanDevice } from '../../../core/netwatch.types';
import { Icon, IconName } from '../../../shared/icon';
import { I18nService } from '../../../core/i18n.service';

const PLATFORMS: Record<string, string> = { win32: 'Windows', darwin: 'macOS', linux: 'Linux' };
const PHONE_NAME = /iphone|ipad|android|galaxy|redmi|pixel|watch/i;
const TV_NAME = /tv\b|googletv|chromecast|roku|firetv|bravia|webos/i;
// Apple-ის კომპიუტრებიც შემთხვევით MAC-ს იყენებენ — ამიტომ სახელი MAC-ზე ადრე მოწმდება
const COMPUTER_NAME = /^mac\b|macbook|imac|desktop|laptop|^pc\b|-pc\b/i;

/**
 * მწარმოებელი → მოწყობილობის ტიპი (იკონკისთვის).
 * Apple — კომპიუტერი: მწარმოებელი მხოლოდ მუდმივ MAC-ზე ჩანს, iPhone/iPad კი ნაგულისხმევად
 * შემთხვევით MAC-ს იყენებს — ასე რომ, Apple-ის მუდმივი MAC ჩვეულებრივ Mac-ია.
 */
const VENDOR_KIND: Record<string, IconName> = Object.fromEntries([
  ['Apple', 'laptop'],
  ...['Samsung', 'Xiaomi', 'Huawei', 'Honor', 'OPPO', 'vivo', 'realme', 'OnePlus', 'Motorola', 'Nokia', 'Meizu'].map((v) => [v, 'phone']),
  ...['TP-Link', 'Netgear', 'D-Link', 'Tenda', 'MikroTik', 'Ubiquiti', 'ZTE', 'Iskratel', 'Technicolor', 'Sagemcom', 'ARRIS', 'AVM (FRITZ!)', 'Cisco'].map((v) => [v, 'router']),
  ...['Dell', 'Lenovo', 'HP', 'ASUS', 'Microsoft'].map((v) => [v, 'laptop']),
  ...['Roku', 'LG', 'Sony', 'TCL', 'Hisense', 'VIZIO'].map((v) => [v, 'tv']),
  ...['Canon', 'Epson', 'Brother', 'Xerox'].map((v) => [v, 'printer']),
  ...['Hikvision', 'Dahua', 'Ring'].map((v) => [v, 'camera']),
  ...['Espressif', 'Tuya', 'Raspberry Pi'].map((v) => [v, 'chip']),
]);

/**
 * Wi-Fi/ქსელის ჩიპების მწარმოებლები: MAC-ში ჩანს ჩიპი, არა ლეპტოპის ბრენდი —
 * ამიტომ ვწერთ "ქსელის ბარათი: Intel" და არა უბრალოდ "Intel".
 */
const CHIP_MAKERS = new Set(['Intel', 'Realtek', 'Foxconn', 'AzureWave', 'Lite-On', 'Murata', 'Qualcomm', 'MediaTek', 'Texas Instruments']);

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
  protected readonly i18n = inject(I18nService);

  /** მწარმოებელი, თუ ის მოწყობილობის ბრენდია (და არა ქსელის ჩიპის) */
  private readonly brand = computed(() => {
    const v = this.device().vendor;
    return v && !CHIP_MAKERS.has(v) ? v : null;
  });

  protected readonly name = computed(() => {
    const d = this.device();
    return (
      d.peer?.host ||
      d.netbiosName ||
      d.hostname ||
      (d.gateway ? this.i18n.t('lan.router') : null) ||
      // სახელი არ იცის — მაშინ მაინც ბრენდი: "Samsung", "TP-Link"
      this.brand() ||
      this.i18n.t(d.randomMac ? 'lan.phoneTablet' : 'lan.unknown')
    );
  });

  protected readonly icon = computed<IconName>(() => {
    const d = this.device();
    const host = d.hostname ?? '';
    if (d.gateway) return 'router';
    if (d.self || d.peer || d.netbiosName || COMPUTER_NAME.test(host)) return 'laptop';
    if (TV_NAME.test(host)) return 'tv';
    if (PHONE_NAME.test(host)) return 'phone';
    const byVendor = d.vendor ? VENDOR_KIND[d.vendor] : undefined;
    if (byVendor) return byVendor;
    if (d.vendor && CHIP_MAKERS.has(d.vendor)) return 'laptop';
    if (d.randomMac) return 'phone';
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
    if (d.vendor && d.vendor !== title) {
      parts.push(CHIP_MAKERS.has(d.vendor) ? this.i18n.t('lan.nic', { vendor: d.vendor }) : d.vendor);
    }
    if (d.hostname && d.hostname !== title) parts.push(`DNS: ${d.hostname}`);
    if (d.netbiosName && d.netbiosName !== title) parts.push(`NetBIOS: ${d.netbiosName}`);
    if (d.workgroup) parts.push(this.i18n.t('lan.group', { name: d.workgroup }));
    if (d.randomMac) parts.push(this.i18n.t('lan.randomMac'));
    return parts.join(' · ');
  });

  protected platform(p: string): string {
    return PLATFORMS[p] ?? p;
  }
}
