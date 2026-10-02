import { Component, inject } from '@angular/core';
import { ToastService } from '../../core/toast.service';

/** ამომხტარი შეტყობინებები ეკრანის ქვედა ნაწილში; დაკლიკებით იხურება */
@Component({
  selector: 'app-toasts',
  template: `
    @for (t of toast.toasts(); track t.id) {
      <button
        class="flex animate-toast-in items-center gap-2.5 rounded-full bg-text py-2.5 pr-4 pl-3.5 text-left text-[13px] font-medium text-bg shadow-lg"
        (click)="toast.dismiss(t.id)"
      >
        <span class="size-2 shrink-0 rounded-full" [class]="t.online ? 'bg-ok' : 'bg-bad'"></span>
        {{ t.text }}
      </button>
    }
  `,
  host: {
    class: 'fixed inset-x-0 bottom-5 z-10 flex flex-col items-center gap-2 px-4',
  },
})
export class Toasts {
  protected readonly toast = inject(ToastService);
}
