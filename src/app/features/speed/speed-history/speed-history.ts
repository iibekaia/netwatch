import { Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { SpeedResult } from '../../../core/netwatch.types';

/** წინა გაზომვების ცხრილი */
@Component({
  selector: 'app-speed-history',
  imports: [DatePipe],
  templateUrl: './speed-history.html',
  host: { class: 'block' },
})
export class SpeedHistory {
  readonly results = input.required<SpeedResult[]>();
}
