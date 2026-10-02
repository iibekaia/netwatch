import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { LanService } from '../../../core/lan.service';
import { netmaskPrefix } from '../../../shared/format';
import { DeviceCard } from '../device-card/device-card';

/** ტაბი „ქსელი“: ლოკალურ ქსელში აღმოჩენილი მოწყობილობები */
@Component({
  selector: 'app-lan-tab',
  imports: [DatePipe, DeviceCard],
  templateUrl: './lan-tab.html',
  host: { class: 'flex min-h-0 flex-1 flex-col gap-2.5' },
})
export class LanTab {
  protected readonly lan = inject(LanService);
  protected readonly prefix = netmaskPrefix;
}
