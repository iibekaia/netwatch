import { Component, inject } from '@angular/core';
import { LanService } from '../../../core/lan.service';
import { netmaskPrefix } from '../../../shared/format';
import { DeviceCard } from '../device-card/device-card';
import { Icon } from '../../../shared/icon';
import { I18nService } from '../../../core/i18n.service';

/** ტაბი „ქსელი“: ლოკალურ ქსელში აღმოჩენილი მოწყობილობები */
@Component({
  selector: 'app-lan-tab',
  imports: [DeviceCard, Icon],
  templateUrl: './lan-tab.html',
  host: { class: 'flex min-h-0 flex-1 flex-col gap-3' },
})
export class LanTab {
  protected readonly lan = inject(LanService);
  protected readonly i18n = inject(I18nService);
  protected readonly prefix = netmaskPrefix;
}
