import {
  ApplicationConfig,
  LOCALE_ID,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeKa from '@angular/common/locales/ka';

// date pipe — ქართული თვეები და დღეები ("2 ოქტ, ხუთ")
registerLocaleData(localeKa);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    { provide: LOCALE_ID, useValue: 'ka' },
  ],
};
