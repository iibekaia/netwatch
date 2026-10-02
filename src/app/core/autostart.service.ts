import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { AutostartState } from './netwatch.types';

/** კომპიუტერთან ერთად ჩართვა — იგივე მდგომარეობა, რაც tray-ის მენიუში */
@Injectable({ providedIn: 'root' })
export class AutostartService {
  private readonly api = window.netwatch;
  readonly state = signal<AutostartState>({ supported: false, enabled: false });

  constructor() {
    if (!this.api) return;
    inject(DestroyRef).onDestroy(this.api.onAutostart((s) => this.state.set(s)));
    this.api.getAutostart().then((s) => this.state.set(s));
  }

  toggle(): void {
    this.api?.setAutostart(!this.state().enabled).then((s) => this.state.set(s));
  }
}
