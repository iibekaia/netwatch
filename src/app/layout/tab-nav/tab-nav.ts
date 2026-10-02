import { Component, inject, model } from '@angular/core';
import { LanService } from '../../core/lan.service';
import { SpeedService } from '../../core/speed.service';
import { Icon, IconName } from '../../shared/icon';
import { I18nService } from '../../core/i18n.service';

export type AppTab = 'status' | 'lan' | 'speed' | 'history';

/** ტაბების გადამრთველი (segmented control): სიჩქარე / კავშირი / ქსელი / ისტორია */
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
  protected readonly i18n = inject(I18nService);

  // სახელი — თარგმანის გასაღები (tabs.<id>)
  protected readonly tabs: { id: AppTab; icon: IconName }[] = [
    { id: 'speed', icon: 'gauge' },
    { id: 'status', icon: 'activity' },
    { id: 'lan', icon: 'network' },
    { id: 'history', icon: 'history' },
  ];
}
