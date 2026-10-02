import { Component, computed, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HistoryReport } from '../../../core/netwatch.types';
import { formatDuration } from '../../../shared/format';

type Day = HistoryReport['days'][number];

/**
 * ოფლაინ დრო დღეების მიხედვით — ერთი სერია (წითელი = "ოფლაინ", როგორც მთელ აპში).
 * სვეტები: 4px მომრგვალება ზედა ბოლოზე, ბაზაზე მიმაგრებული, 2px ღრეჩო.
 * hover — tooltip (თარიღი, ოფლაინ დრო, გათიშვები); hit-area მთელი სვეტის სიმაღლეა.
 */
@Component({
  selector: 'app-downtime-chart',
  imports: [DatePipe],
  templateUrl: './downtime-chart.html',
  host: { class: 'block' },
})
export class DowntimeChart {
  readonly days = input.required<Day[]>();

  protected readonly hovered = signal<number | null>(null);
  protected readonly formatDuration = formatDuration;

  /** y-ღერძის მაქსიმუმი წუთებში — "ლამაზ" რიცხვამდე დამრგვალებული */
  protected readonly maxMin = computed(() => {
    const max = Math.max(...this.days().map((d) => d.downtimeMs / 60000), 0);
    if (max <= 0) return 1;
    const nice = [1, 2, 5, 10, 15, 30, 60, 120, 180, 240, 360, 720, 1440];
    return nice.find((n) => n >= max) ?? Math.ceil(max / 60) * 60;
  });

  protected readonly bars = computed(() =>
    this.days().map((d, i) => ({
      ...d,
      i,
      pct: Math.min(100, (d.downtimeMs / 60000 / this.maxMin()) * 100),
      // x ღერძის წარწერები: პირველი, შუა, ბოლო — რომ არ გადაეფარონ
      label: i === 0 || i === this.days().length - 1 || i === Math.floor(this.days().length / 2),
      // მონიტორინგი საერთოდ არ ყოფილა (კომპიუტერი გამორთული) — მონაცემი არ არის
      noData: d.monitoredMs === 0,
    }))
  );

  protected readonly tip = computed(() => {
    const i = this.hovered();
    return i === null ? null : this.bars()[i];
  });

  protected axisLabel(min: number): string {
    return min >= 60 ? `${Math.round(min / 60)} სთ` : `${min} წთ`;
  }
}
