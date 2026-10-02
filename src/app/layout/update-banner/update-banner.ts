import { Component, computed, inject } from '@angular/core';
import { UpdateService } from '../../core/update.service';
import { Icon } from '../../shared/icon';

/**
 * ახალი ვერსიის ბანერი (header-ის ქვეშ):
 *  - downloading — ფონზე იწერება, პროგრესით
 *  - downloaded  — „გადატვირთვა“ (auto რეჟიმი)
 *  - available   — „გადმოწერა“ (manual რეჟიმი: macOS / Portable)
 */
@Component({
  selector: 'app-update-banner',
  imports: [Icon],
  template: `
    @let s = update.state()!;
    <span class="grid size-8 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent" aria-hidden="true">
      <app-icon name="arrow-down" class="size-4" [class.animate-bounce]="s.status === 'downloading'" />
    </span>

    <div class="min-w-0 flex-1">
      <p class="text-[13px] font-medium">{{ title() }}</p>
      @if (s.status === 'downloading') {
        <div class="mt-1.5 h-1 overflow-hidden rounded-full bg-subtle">
          <span
            class="block h-full rounded-full bg-accent transition-[width] duration-300"
            [style.width.%]="s.progress ?? 0"
          ></span>
        </div>
      } @else {
        <p class="text-xs text-muted">{{ subtitle() }}</p>
      }
    </div>

    @if (s.status === 'downloaded' || s.status === 'available') {
      <button
        class="h-8 shrink-0 rounded-lg bg-text px-3 text-[13px] font-medium text-bg transition hover:opacity-90"
        (click)="update.install()"
      >
        {{ s.status === 'downloaded' ? 'გადატვირთვა' : 'გადმოწერა' }}
      </button>
    }
  `,
  host: {
    class: 'card flex animate-fade-in items-center gap-3 py-3',
    role: 'status',
  },
})
export class UpdateBanner {
  protected readonly update = inject(UpdateService);

  protected readonly title = computed(() => {
    const s = this.update.state();
    switch (s?.status) {
      case 'downloading':
        return `ვერსია ${s.version} იწერება… ${s.progress ?? 0}%`;
      case 'downloaded':
        return `ვერსია ${s.version} მზადაა`;
      default:
        return `ხელმისაწვდომია ვერსია ${s?.version}`;
    }
  });

  protected readonly subtitle = computed(() =>
    this.update.state()?.status === 'downloaded'
      ? 'დაყენდება გადატვირთვისას ან აპის შემდეგ დახურვაზე'
      : `ახლა გაქვს ${this.update.state()?.currentVersion}`
  );
}
