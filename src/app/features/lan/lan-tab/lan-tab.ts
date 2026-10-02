import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { LanService } from '../../../core/lan.service';
import { netmaskPrefix } from '../../../shared/format';
import { DeviceCard } from '../device-card/device-card';
import { Icon } from '../../../shared/icon';

/** ტაბი „ქსელი“: ლოკალურ ქსელში აღმოჩენილი მოწყობილობები */
@Component({
  selector: 'app-lan-tab',
  imports: [DatePipe, DeviceCard, Icon],
  templateUrl: './lan-tab.html',
  host: { class: 'flex min-h-0 flex-1 flex-col gap-3' },
})
export class LanTab {
  protected readonly lan = inject(LanService);
  protected readonly prefix = netmaskPrefix;
}
