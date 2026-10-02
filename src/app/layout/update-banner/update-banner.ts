import { Component, ElementRef, afterNextRender, computed, inject, viewChild } from '@angular/core';
import { UpdateService } from '../../core/update.service';
import { Icon } from '../../shared/icon';
import { I18nService } from '../../core/i18n.service';

/**
 * ახალი ვერსიის მოდალი — ყველაფრის ზემოთ (ტაბები z-20, toast-ები z-10), ეკრანის ცენტრში,
 * ნახევრად გამჭვირვალე შავ ფონზე:
 *  - downloading — ფონზე იწერება, პროგრესით
 *  - downloaded  — „გადატვირთვა“ (auto რეჟიმი)
 *  - available   — „გადმოწერა“ (manual რეჟიმი: macOS / Portable)
 * „მოგვიანებით“ / Esc / ფონზე დაჭერა — იხურება; მდგომარეობის შეცვლისას (მაგ. გადმოწერა
 * დასრულდა) ისევ ჩნდება. დახურულს footer-იდან ხსნი (UpdateService.reopen).
 */
@Component({
  selector: 'app-update-banner',
  imports: [Icon],
  template: `
    @let s = update.state()!;
    <!-- ფონი: დაჭერა ხურავს (კლავიატურით — Esc, იხ. host keydown) -->
    <div class="absolute inset-0 animate-fade-in bg-black/60 backdrop-blur-[2px]" aria-hidden="true" (click)="update.dismiss()"></div>

    <section
      #dialog
      role="dialog"
      aria-modal="true"
      aria-labelledby="update-title"
      tabindex="-1"
      class="card relative flex w-full max-w-[400px] animate-toast-in flex-col items-center gap-4 p-6 text-center shadow-2xl outline-none"
    >
      <span class="grid size-12 place-items-center rounded-2xl bg-accent/10 text-accent" aria-hidden="true">
        <app-icon name="arrow-down" class="size-6" [class.animate-bounce]="s.status === 'downloading'" />
      </span>

      <div class="w-full">
        <h2 id="update-title" class="text-base font-semibold tracking-tight">{{ title() }}</h2>
        @if (s.status === 'downloading') {
          <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-subtle">
            <span
              class="block h-full rounded-full bg-accent transition-[width] duration-300"
              [style.width.%]="s.progress ?? 0"
            ></span>
          </div>
        } @else {
          <p class="mt-1 text-[13px] text-muted">{{ subtitle() }}</p>
        }
      </div>

      <div class="flex w-full gap-2">
        <button class="btn-soft h-10 flex-1 justify-center" (click)="update.dismiss()">
          {{ i18n.t('update.later') }}
        </button>
        @if (s.status === 'downloaded' || s.status === 'available') {
          <button
            class="h-10 flex-1 rounded-lg bg-text text-[13px] font-medium text-bg transition hover:opacity-90"
            (click)="update.install()"
          >
            {{ i18n.t(s.status === 'downloaded' ? 'update.restart' : 'update.download') }}
          </button>
        }
      </div>
    </section>
  `,
  host: {
    class: 'fixed inset-0 z-50 grid place-items-center p-6',
    '(keydown.escape)': 'update.dismiss()',
  },
})
export class UpdateBanner {
  protected readonly update = inject(UpdateService);
  protected readonly i18n = inject(I18nService);
  private readonly dialog = viewChild.required<ElementRef<HTMLElement>>('dialog');

  constructor() {
    // ფოკუსი მოდალში — Esc და Tab მაშინვე მუშაობს, ეკრანის მკითხველი ფანჯარას წაიკითხავს
    afterNextRender(() => this.dialog().nativeElement.focus());
  }

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
