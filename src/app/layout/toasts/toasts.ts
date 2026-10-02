import { Component, inject } from '@angular/core';
import { ToastService } from '../../core/toast.service';

/** ამომხტარი შეტყობინებები ეკრანის ქვედა ნაწილში; დაკლიკებით იხურება */
@Component({
  selector: 'app-toasts',
  template: `
    @for (t of toast.toasts(); track t.id) {
      <div
        class="animate-toast-in cursor-pointer rounded-xl px-3.5 py-3 text-sm font-medium text-white shadow-[0_8px_24px_rgb(0_0_0/0.2)]"
        [class]="t.online ? 'bg-ok-strong' : 'bg-bad-strong'"
        (click)="toast.dismiss(t.id)"
      >
        {{ t.text }}
      </div>
    }
  `,
  host: {
    class:
      'fixed bottom-4 left-1/2 z-10 flex w-[min(420px,calc(100vw-32px))] -translate-x-1/2 flex-col gap-2',
  },
})
export class Toasts {
  protected readonly toast = inject(ToastService);
}
