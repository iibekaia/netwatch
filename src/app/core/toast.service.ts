import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  online: boolean;
  text: string;
}

/** ეკრანის ქვედა ნაწილში ამომხტარი შეტყობინებები (მაქს. 3, 5 წამით) */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();
  private nextId = 0;

  show(online: boolean, text: string): void {
    const id = ++this.nextId;
    this._toasts.update((list) => [...list, { id, online, text }].slice(-3));
    setTimeout(() => this.dismiss(id), 5000);
  }

  dismiss(id: number): void {
    this._toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
