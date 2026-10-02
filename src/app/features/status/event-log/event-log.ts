import { Component, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ConnectionEvent } from '../../../core/connection.service';
import { formatDuration, reasonText } from '../../../shared/format';

/** მოვლენების ისტორია: როდის გაითიშა / ჩაირთო ინტერნეტი */
@Component({
  selector: 'app-event-log',
  imports: [DatePipe],
  templateUrl: './event-log.html',
})
export class EventLog {
  readonly events = input.required<ConnectionEvent[]>();
  readonly clear = output<void>();

  protected readonly formatDuration = formatDuration;
  protected readonly reasonText = reasonText;
}
