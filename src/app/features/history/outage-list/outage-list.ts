import { Component, computed, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Outage } from '../../../core/netwatch.types';
import { formatDuration, reasonText } from '../../../shared/format';

const PAGE = 20;

/** შენახული გათიშვების სია (ახალი — ზემოთ); მიზეზი — დიაგნოსტიკიდან */
@Component({
  selector: 'app-outage-list',
  imports: [DatePipe],
  template: `
    @if (outages().length) {
      <ul class="card divide-y divide-border p-0">
        @for (o of visible(); track o.start) {
          <li class="flex items-center gap-3 px-4 py-3 text-[13px]">
            <span
              class="size-2 shrink-0 rounded-full"
              [class]="o.ongoing ? 'animate-pulse bg-bad' : o.failedAt === 'internet' ? 'bg-bad' : 'bg-warn'"
            ></span>
            <div class="min-w-0 flex-1">
              <div class="flex items-baseline gap-2">
                <span class="font-medium tabular-nums">{{ o.start | date: 'd MMM, HH:mm' }}</span>
                @if (o.ongoing) {
                  <span class="tag bg-bad/10 text-bad">გრძელდება</span>
                }
              </div>
              <div class="truncate text-xs text-muted">
                {{ o.cause ?? reasonText(o.reason) }}
                @if (o.unknownEnd) {
                  · აპი დაიხურა გათიშვის დროს
                }
              </div>
            </div>
            <span class="shrink-0 font-medium tabular-nums">{{ formatDuration(o.durationMs) }}</span>
          </li>
        }
      </ul>
      @if (outages().length > visible().length) {
        <button class="btn-link mx-auto mt-2 block" (click)="limit.set(limit() + PAGE)">
          მეტის ნახვა ({{ outages().length - visible().length }})
        </button>
      }
    } @else {
      <p class="empty-state">ამ პერიოდში გათიშვა არ დაფიქსირებულა</p>
    }
  `,
  host: { class: 'block' },
})
export class OutageList {
  readonly outages = input.required<Outage[]>();

  protected readonly PAGE = PAGE;
  protected readonly limit = signal(PAGE);
  protected readonly visible = computed(() => this.outages().slice(0, this.limit()));
  protected readonly formatDuration = formatDuration;
  protected readonly reasonText = reasonText;
}
