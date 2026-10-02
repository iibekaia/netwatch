import { Component, inject, input } from '@angular/core';
import { SpeedResult } from '../../../core/netwatch.types';
import { I18nService } from '../../../core/i18n.service';

/** წინა გაზომვების ცხრილი */
@Component({
  selector: 'app-speed-history',
  templateUrl: './speed-history.html',
  host: { class: 'block' },
})
export class SpeedHistory {
  readonly results = input.required<SpeedResult[]>();
  protected readonly i18n = inject(I18nService);
}
