import { Component, computed, inject } from '@angular/core';
import { UpdateService } from '../../core/update.service';
import { Icon } from '../../shared/icon';
import { I18nService } from '../../core/i18n.service';

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
        {{ i18n.t(s.status === 'downloaded' ? 'update.restart' : 'update.download') }}
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
  protected readonly i18n = inject(I18nService);

  protected readonly title = computed(() => {
    const s = this.update.state();
    const version = s?.version ?? '';
    switch (s?.status) {
      case 'downloading':
        return this.i18n.t('update.downloading', { version, progress: s.progress ?? 0 });
      case 'downloaded':
        return this.i18n.t('update.ready', { version });
      default:
        return this.i18n.t('update.available', { version });
    }
  });

  protected readonly subtitle = computed(() =>
    this.update.state()?.status === 'downloaded'
      ? this.i18n.t('update.installLater')
      : this.i18n.t('update.current', { version: this.update.state()?.currentVersion ?? '' })
  );
}
