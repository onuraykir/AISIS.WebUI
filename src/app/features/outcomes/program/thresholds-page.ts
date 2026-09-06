import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ConfirmationService } from 'primeng/api';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Skeleton } from 'primeng/skeleton';
import { Tooltip } from 'primeng/tooltip';

import { HasAction } from '@shared/directives/has-action';
import { ProgramOutcomeStore } from './data-access/program-outcome.store';
import { ProgramOutcomeThreshold } from './data-access/program-outcome.models';

/**
 * Eşik Değerler ekranı (akıllı bileşen).
 *
 * EŞİK, ÇIKTI HESABININ SON ADIMIDIR: öğrencinin ders çıktısı ortalaması (0–5)
 * geçme eşiğiyle karşılaştırılıp başarılı/başarısız kararına dönüşür. Yürürlükte
 * eşiği olmayan bir program çıktısı hesabı **durdurur**.
 *
 * Bir çıktının EN FAZLA BİR eşiği yürürlüktedir; geçmiş eşikler silinmez, çünkü
 * geçmiş dönemin raporu o gün yürürlükte olan eşiğe dayanır.
 */
@Component({
  selector: 'app-thresholds-page',
  imports: [FormsModule, ConfirmDialog, Message, Select, Skeleton, Tooltip, HasAction],
  providers: [ProgramOutcomeStore, ConfirmationService],
  templateUrl: './thresholds-page.html',
  styleUrl: './thresholds-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThresholdsPage implements OnInit {
  private readonly confirmation = inject(ConfirmationService);

  protected readonly store = inject(ProgramOutcomeStore);

  /** Yeni eşik formu; ayrı diyalog açmayacak kadar küçük (iki sayı). */
  protected readonly newMinValue = signal<number | null>(3);
  protected readonly newTargetValue = signal<number | null>(4);

  ngOnInit(): void {
    void this.store.load();
  }

  protected onOutcomeChange(outcomeId: number | null): void {
    if (outcomeId !== null) void this.store.select(outcomeId);
  }

  protected outcomeOptions() {
    return this.store.items().map((outcome) => ({
      value: outcome.id,
      label: `${outcome.code} — ${outcome.description}`,
    }));
  }

  protected async addThreshold(): Promise<void> {
    const outcomeId = this.store.selectedId();
    const min = this.newMinValue();
    const target = this.newTargetValue();

    if (outcomeId === null || min === null || target === null) return;

    // Yeni esik PASIF eklenir; yururluge almak ayri bir eylemdir. Sessizce
    // yururluge girseydi eski donemin hesabi farkinda olunmadan degisirdi.
    const ok = await this.store.createThreshold({
      programOutcomeId: outcomeId,
      minValue: min,
      targetValue: target,
      isActive: false,
    });

    if (ok) {
      this.newMinValue.set(3);
      this.newTargetValue.set(4);
    }
  }

  protected confirmActivate(threshold: ProgramOutcomeThreshold): void {
    this.confirmation.confirm({
      header: 'Eşiği yürürlüğe al',
      message:
        `Geçme eşiği ${threshold.minValue} olacak. Bundan sonraki çıktı hesapları bu ` +
        'değerle karar verir; yürürlükteki eşik aynı işlemde düşer.',
      icon: 'pi pi-flag',
      acceptLabel: 'Yürürlüğe al',
      rejectLabel: 'Vazgeç',
      acceptButtonStyleClass: 'p-button-sm',
      rejectButtonStyleClass: 'p-button-text p-button-sm',
      accept: () => void this.store.activateThreshold(threshold.id),
    });
  }

  protected confirmDelete(threshold: ProgramOutcomeThreshold): void {
    this.confirmation.confirm({
      header: 'Eşiği sil',
      message: threshold.isActive
        ? 'Bu eşik YÜRÜRLÜKTE. Silinirse bu program çıktısı için karar verilemez ve ' +
          'çıktı hesabı koşmaz.'
        : 'Bu eşik silinecek. Geçmiş raporlar o gün yürürlükte olan eşiğe dayanır.',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sil',
      rejectLabel: 'Vazgeç',
      acceptButtonStyleClass: 'p-button-danger p-button-sm',
      rejectButtonStyleClass: 'p-button-text p-button-sm',
      accept: () => void this.store.removeThreshold(threshold.id),
    });
  }

  /** Yeni eşik eklemeyi engelleyen sebep. Boşsa serbest. */
  protected addBlockedReason(): string | null {
    if (this.store.selectedId() === null) return 'Önce bir program çıktısı seçin.';

    const min = this.newMinValue();
    const target = this.newTargetValue();

    if (min === null || target === null) return 'İki değer de girilmeli.';
    if (min < 0 || min > 5) return 'Geçme eşiği 0 ile 5 arasında olmalı.';
    if (target < 0 || target > 5) return 'Hedef 0 ile 5 arasında olmalı.';
    if (target < min) return 'Hedef, geçme eşiğinden küçük olamaz.';

    return null;
  }
}
