import { Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { DiagnosticsService } from '../../../core/diagnostics.service';
import { DiagStep, DiagStepId } from '../../../core/netwatch.types';
import { Icon, IconName } from '../../../shared/icon';

const NODES: { id: DiagStepId; label: string; icon: IconName }[] = [
  { id: 'adapter', label: 'კომპიუტერი', icon: 'laptop' },
  { id: 'router', label: 'როუტერი', icon: 'router' },
  { id: 'internet', label: 'ინტერნეტი', icon: 'globe' },
  { id: 'dns', label: 'DNS', icon: 'server' },
  { id: 'web', label: 'ვები', icon: 'window' },
];

/** რგოლის ფერი სტატუსის მიხედვით */
const NODE_TONE: Record<DiagStep['status'] | 'idle', string> = {
  ok: 'bg-ok/12 text-ok',
  warn: 'bg-warn/15 text-warn',
  fail: 'bg-bad/12 text-bad ring-2 ring-bad/30',
  skip: 'bg-subtle text-muted/40',
  idle: 'bg-subtle text-muted',
};

const VERDICT_TONE = {
  ok: 'bg-ok/8 [&_strong]:text-ok',
  warn: 'bg-warn/10 [&_strong]:text-warn',
  bad: 'bg-bad/8 [&_strong]:text-bad',
};

const TRIGGERS: Record<string, string> = {
  offline: 'ავტომატურად, გათიშვისას',
  online: 'ავტომატურად, აღდგენისას',
  manual: '', // ხელით ან ტაბის გახსნისას — მხოლოდ დრო
};

/**
 * „სად არის პრობლემა?“ — კავშირის ჯაჭვი:
 *   კომპიუტერი → როუტერი → ინტერნეტი → DNS → ვები
 * პირველი წითელი რგოლი აჩვენებს, სად წყდება კავშირი.
 */
@Component({
  selector: 'app-diagnostics-card',
  imports: [DatePipe, Icon],
  templateUrl: './diagnostics-card.html',
  host: { class: 'card block' },
})
export class DiagnosticsCard {
  protected readonly diag = inject(DiagnosticsService);

  protected readonly nodes = computed(() => {
    const { running, result } = this.diag.state();
    const steps = new Map(result?.steps.map((s) => [s.id, s]));
    return NODES.map((n) => {
      const step = steps.get(n.id) ?? null;
      const status = step?.status ?? 'idle';
      return {
        ...n,
        step,
        tone: NODE_TONE[status],
        // შემოწმებისას — რბილად "სუნთქავს"
        pulse: running,
        // ხაზი შემდეგ რგოლამდე: მწვანე — თუ ეს რგოლი გავიდა
        link: status === 'ok' || status === 'warn' ? 'bg-ok/40' : status === 'fail' ? 'bg-bad/30' : 'bg-border',
      };
    });
  });

  protected readonly verdictTone = computed(
    () => VERDICT_TONE[this.diag.state().result?.verdict.level ?? 'ok']
  );

  protected readonly triggerLabel = computed(() => TRIGGERS[this.diag.state().trigger ?? ''] ?? '');

  constructor() {
    // ტაბის გახსნისას ჯაჭვი ცარიელი რომ არ იყოს — ჯერ თუ არ შემოწმებულა, ახლავე (< 1 წამი)
    if (this.diag.available && !this.diag.state().result && !this.diag.state().running) this.diag.run();
  }
}
