import { Component, inject, model } from '@angular/core';
import { LanService } from '../../core/lan.service';
import { SpeedService } from '../../core/speed.service';

export type AppTab = 'status' | 'lan' | 'speed';

/** ტაბების გადამრთველი: კავშირი / ქსელი / სიჩქარე (მრიცხველებით) */
@Component({
  selector: 'app-tab-nav',
  templateUrl: './tab-nav.html',
  host: {
    role: 'tablist',
    class: 'grid grid-cols-3 gap-1 rounded-xl border border-border bg-card p-1',
  },
})
export class TabNav {
  readonly active = model.required<AppTab>();

  protected readonly lan = inject(LanService);
  protected readonly speed = inject(SpeedService);

  protected readonly tabs: { id: AppTab; label: string }[] = [
    { id: 'status', label: 'კავშირი' },
    { id: 'lan', label: 'ქსელი' },
    { id: 'speed', label: 'სიჩქარე' },
  ];
}
