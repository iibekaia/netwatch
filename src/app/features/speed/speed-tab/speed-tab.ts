import { Component, computed, inject } from '@angular/core';
import { ConnectionService } from '../../../core/connection.service';
import { SpeedService } from '../../../core/speed.service';
import { formatNumber } from '../../../shared/format';
import { ProviderCard } from '../provider-card/provider-card';
import { SpeedHistory } from '../speed-history/speed-history';
import { SpeedMeter } from '../speed-meter/speed-meter';

const PHASE_LABELS = { ping: 'ping-ის გაზომვა', download: 'ჩამოტვირთვა', upload: 'ატვირთვა' };

/** ტაბი „სიჩქარე“: პროვაიდერი, ping/jitter, ჩამოტვირთვა/ატვირთვა, ისტორია */
@Component({
  selector: 'app-speed-tab',
  imports: [ProviderCard, SpeedMeter, SpeedHistory],
  templateUrl: './speed-tab.html',
  host: { class: 'flex flex-1 flex-col gap-3' },
})
export class SpeedTab {
  protected readonly conn = inject(ConnectionService);
  protected readonly speed = inject(SpeedService);
  protected readonly fmt = formatNumber;

  /** მთლიანი ტესტის პროგრესი: ping 10%, download 45%, upload 45% */
  protected readonly overallProgress = computed(() => {
    const p = this.speed.phaseProgress();
    switch (this.speed.phase()) {
      case 'ping':
        return p * 10;
      case 'download':
        return 10 + p * 45;
      case 'upload':
        return 55 + p * 45;
      default:
        return 0;
    }
  });

  protected readonly phaseLabel = computed(() => PHASE_LABELS[this.speed.phase() ?? 'ping']);

  /** მოკლე შეფასება: რისთვის ჰყოფნის ეს ინტერნეტი */
  protected readonly verdict = computed(() => {
    const { download = 0, upload = 0, ping = 999 } = this.speed.live();
    if (download >= 100 && upload >= 20 && ping <= 30)
      return 'შესანიშნავი — 4K ვიდეო, თამაშები და დიდი ფაილები უპრობლემოდ.';
    if (download >= 25 && upload >= 5 && ping <= 60)
      return 'კარგი — HD ვიდეო, ვიდეოზარები და თამაშები ნორმალურად იმუშავებს.';
    if (download >= 5 && ping <= 120)
      return 'საშუალო — ბრაუზინგი და ვიდეოზარი, მაგრამ მაღალ ხარისხზე შეიძლება შეფერხდეს.';
    return 'სუსტი — ვიდეო და ზარები შეიძლება ჭედავდეს.';
  });
}
