import { Component, inject, model } from '@angular/core';
import { LanService } from '../../core/lan.service';
import { SpeedService } from '../../core/speed.service';
import { Icon, IconName } from '../../shared/icon';

export type AppTab = 'status' | 'lan' | 'speed' | 'history';

/** ტაბების გადამრთველი (segmented control): კავშირი / ქსელი / სიჩქარე / ისტორია */
@Component({
  selector: 'app-tab-nav',
  imports: [Icon],
  templateUrl: './tab-nav.html',
  host: {
    role: 'tablist',
    class: 'grid grid-cols-4 gap-1 rounded-xl bg-subtle p-1',
  },
})
export class TabNav {
  readonly active = model.required<AppTab>();

  protected readonly lan = inject(LanService);
  protected readonly speed = inject(SpeedService);

  protected readonly tabs: { id: AppTab; label: string; icon: IconName }[] = [
    { id: 'status', label: 'კავშირი', icon: 'activity' },
    { id: 'lan', label: 'ქსელი', icon: 'network' },
    { id: 'speed', label: 'სიჩქარე', icon: 'gauge' },
    { id: 'history', label: 'ისტორია', icon: 'history' },
  ];
}
