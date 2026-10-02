import { Component, computed, inject, input, output } from '@angular/core';
import { ProviderInfo } from '../../../core/netwatch.types';
import { Icon } from '../../../shared/icon';
import { I18nService } from '../../../core/i18n.service';

/** პროვაიდერის ინფო: სახელი, საჯარო IP, ASN, მდებარეობა, ტესტის სერვერი */
@Component({
  selector: 'app-provider-card',
  imports: [Icon],
  templateUrl: './provider-card.html',
  host: { class: 'card block' },
})
export class ProviderCard {
  readonly provider = input<ProviderInfo | null>(null);
  readonly loading = input(false);
  readonly refresh = output<void>();
  protected readonly i18n = inject(I18nService);

  protected readonly rows = computed(() => {
    const p = this.provider();
    if (!p) return [];
    const location = [p.city, p.region !== p.city ? p.region : null, p.country];
    return [
      { label: this.i18n.t('speed.publicIp'), value: p.ip, mono: true },
      { label: this.i18n.t('speed.asn'), value: p.asn, mono: true },
      { label: this.i18n.t('speed.location'), value: location.filter(Boolean).join(', '), mono: false },
      { label: this.i18n.t('speed.server'), value: p.server, mono: false },
    ];
  });
}
