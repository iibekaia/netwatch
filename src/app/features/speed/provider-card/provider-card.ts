import { Component, computed, input, output } from '@angular/core';
import { ProviderInfo } from '../../../core/netwatch.types';
import { Icon } from '../../../shared/icon';

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

  protected readonly rows = computed(() => {
    const p = this.provider();
    if (!p) return [];
    const location = [p.city, p.region !== p.city ? p.region : null, p.country];
    return [
      { label: 'საჯარო IP', value: p.ip, mono: true },
      { label: 'ASN', value: p.asn, mono: true },
      { label: 'მდებარეობა', value: location.filter(Boolean).join(', '), mono: false },
      { label: 'ტესტის სერვერი', value: p.server, mono: false },
    ];
  });
}
