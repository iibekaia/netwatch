import { Component, input } from '@angular/core';

export type IconName =
  | 'activity'
  | 'network'
  | 'gauge'
  | 'globe'
  | 'router'
  | 'laptop'
  | 'phone'
  | 'chip'
  | 'user'
  | 'refresh'
  | 'arrow-down'
  | 'arrow-up'
  | 'server'
  | 'window'
  | 'stethoscope';

/**
 * ხაზოვანი იკონკები (Lucide-ის სტილი, 24×24, stroke = currentColor).
 * ზომა და ფერი — Tailwind კლასებით: <app-icon name="globe" class="size-4 text-muted" />
 */
@Component({
  selector: 'app-icon',
  template: `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="size-full"
      aria-hidden="true"
    >
      @switch (name()) {
        @case ('activity') {
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        }
        @case ('network') {
          <rect x="16" y="16" width="6" height="6" rx="1" />
          <rect x="2" y="16" width="6" height="6" rx="1" />
          <rect x="9" y="2" width="6" height="6" rx="1" />
          <path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3" />
          <path d="M12 12V8" />
        }
        @case ('gauge') {
          <path d="m12 14 4-4" />
          <path d="M3.34 19a10 10 0 1 1 17.32 0" />
        }
        @case ('globe') {
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
          <path d="M2 12h20" />
        }
        @case ('router') {
          <path d="M12 20h.01" />
          <path d="M2 8.82a15 15 0 0 1 20 0" />
          <path d="M5 12.86a10 10 0 0 1 14 0" />
          <path d="M8.5 16.43a5 5 0 0 1 7 0" />
        }
        @case ('laptop') {
          <rect x="3" y="4" width="18" height="12" rx="2" />
          <path d="M2 20h20" />
        }
        @case ('phone') {
          <rect x="5" y="2" width="14" height="20" rx="2" />
          <path d="M12 18h.01" />
        }
        @case ('chip') {
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <rect x="9" y="9" width="6" height="6" rx="1" />
          <path d="M15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2" />
        }
        @case ('user') {
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        }
        @case ('refresh') {
          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
          <path d="M21 3v5h-5" />
          <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
          <path d="M8 16H3v5" />
        }
        @case ('arrow-down') {
          <path d="M12 5v14" />
          <path d="m19 12-7 7-7-7" />
        }
        @case ('arrow-up') {
          <path d="M12 19V5" />
          <path d="m5 12 7-7 7 7" />
        }
        @case ('server') {
          <rect x="2" y="3" width="20" height="8" rx="2" />
          <rect x="2" y="13" width="20" height="8" rx="2" />
          <path d="M6 7h.01M6 17h.01" />
        }
        @case ('window') {
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="M2 9h20M6 4v5M10 4v5" />
        }
        @case ('stethoscope') {
          <path d="M11 2v2M5 2v2" />
          <path d="M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1" />
          <path d="M8 15a6 6 0 0 0 12 0v-3" />
          <circle cx="20" cy="10" r="2" />
        }
      }
    </svg>
  `,
  host: { class: 'inline-block shrink-0' },
})
export class Icon {
  readonly name = input.required<IconName>();
}
