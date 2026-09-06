import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ConfirmationService } from 'primeng/api';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Skeleton } from 'primeng/skeleton';
import { Tooltip } from 'primeng/tooltip';

import { HasAction } from '@shared/directives/has-action';
import { MatrixStore } from './data-access/matrix.store';
import { MatrixRow, OutcomeGridActivity } from './data-access/matrix.models';

/**
 * Çıktı Eşleştirme ekranı (akıllı bileşen).
 *
 * MATRİSİN İKİ İŞİ VAR ve ikisi de çıktı hesabına doğrudan girer:
 *
 * 1. **Ağırlık** — etkinliğin o çıktıdaki payı. Bir çıktının ağırlıkları 100
 *    etmelidir; tavanın 5,00'te sabit kalması buna dayanır.
 * 2. **Soru bağı** — hangi sorunun hangi çıktıyı ölçtüğü. Formülün payı ve paydası
 *    bu bağdan çıkar; bağlanmamış soru hesaba hiç girmez.
 *
 * TASLAK YEREL: hücreler doldurulurken sunucuya gidilmez. "Ne olacak" ancak
 * önizlemede sorulur, "kaydet" ise karşılaştırmayı sunucuda yeniden kurdurur.
 */
@Component({
  selector: 'app-matrix-page',
  imports: [FormsModule, ConfirmDialog, Message, Select, Skeleton, Tooltip, HasAction],
  providers: [MatrixStore, ConfirmationService],
  templateUrl: './matrix-page.html',
  styleUrl: './matrix-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatrixPage implements OnInit {
  private readonly confirmation = inject(ConfirmationService);

  protected readonly store = inject(MatrixStore);

  /** Soru bağları hangi satır için açık? Matris genişlemesin diye tek satır açılıyor. */
  protected readonly expandedRow = signal<number | null>(null);

  ngOnInit(): void {
    void this.store.loadContext();
  }

  protected onSemesterChange(semesterId: number | null): void {
    this.store.semesterId.set(semesterId);
    void this.store.loadOfferings();
  }

  protected onOfferingChange(offeringId: number | null): void {
    this.store.offeringId.set(offeringId);
    this.expandedRow.set(null);
    void this.store.loadGrid();
  }

  protected semesterOptions() {
    return this.store.semesters().map((semester) => ({
      value: semester.id,
      label: semester.isCurrent ? `${semester.name} (güncel)` : semester.name,
    }));
  }

  protected offeringOptions() {
    return this.store.offerings().map((offering) => ({
      value: offering.id,
      label: `${offering.courseCode} — ${offering.courseName}`,
    }));
  }

  // ── Hücre düzenleme ──

  protected weightOf(row: MatrixRow, activity: OutcomeGridActivity): number | null {
    return row.weights[activity.id] ?? null;
  }

  /**
   * Ağırlık hücresi.
   *
   * DEĞER SAYI OLARAK GELİR, metin olarak değil: `<input type="number">` üzerindeki
   * `ngModel` Angular'ın `NumberValueAccessor`'ını kullanır ve `ngModelChange`
   * `number | null` yayar (boş hücrede `null`). Metin bekleyip `raw.trim()` çağırmak
   * her tuş vuruşunda `TypeError` fırlatıyordu; hata `ngModelChange` içinde patladığı
   * için `setWeight` hiç çalışmıyor ve ağırlıklar taslağa yazılmıyordu. Kaydetme
   * çalışıyor görünüyordu çünkü çıktı satırı ve soru bağları başka yollardan
   * gidiyordu — yalnızca ağırlıklar sessizce boş kalıyordu.
   */
  protected onWeightInput(index: number, activityId: number, value: number | null): void {
    this.store.setWeight(index, activityId, value === null || Number.isNaN(value) ? null : value);
  }

  protected toggleExpand(index: number): void {
    this.expandedRow.update((current) => (current === index ? null : index));
  }

  protected isLinked(row: MatrixRow, itemId: number): boolean {
    return row.linkedItemIds.has(itemId);
  }

  /** Bu satırın bir etkinlikteki bağlı soru sayısı; kolon başlığında ipucu olarak. */
  protected linkedCountIn(row: MatrixRow, activityId: number): number {
    const items = this.store.itemsByActivity().get(activityId) ?? [];
    return items.filter((item) => row.linkedItemIds.has(item.id)).length;
  }

  /**
   * Hücrede ağırlık var ama o etkinlikten bağlı soru yok — hesabı DURDURAN hâl
   * (`ACTIVITY_WEIGHTED_WITHOUT_ITEMS`). Kaydetmeden önce görünmesi gerekiyor.
   */
  protected isWeightedWithoutItems(row: MatrixRow, activity: OutcomeGridActivity): boolean {
    return (row.weights[activity.id] ?? 0) > 0 && this.linkedCountIn(row, activity.id) === 0;
  }

  protected confirmRemove(index: number): void {
    const row = this.store.rows()[index];
    if (!row) return;

    const isSaved = row.courseOutcomeId !== null;

    this.confirmation.confirm({
      header: 'Çıktıyı kaldır',
      message: isSaved
        ? `"${row.code}" silinecek; ağırlıkları ve soru bağları da temizlenecek. ` +
          'Silme ancak kaydettiğinizde gerçekleşir.'
        : `"${row.code || 'Adsız satır'}" taslaktan çıkarılacak.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Kaldır',
      rejectLabel: 'Vazgeç',
      acceptButtonStyleClass: 'p-button-danger p-button-sm',
      rejectButtonStyleClass: 'p-button-text p-button-sm',
      accept: () => {
        this.store.removeRow(index);
        this.expandedRow.set(null);
      },
    });
  }

  protected preview(): void {
    void this.store.preview();
  }

  protected save(): void {
    void this.store.save().then((ok) => {
      if (ok) this.expandedRow.set(null);
    });
  }

  /** Kaydetme neden engelli? Boşsa serbest. */
  protected saveBlockedReason(): string | null {
    if (this.store.rows().length === 0) return 'En az bir çıktı gerekli.';

    return this.store.localIssues()[0] ?? null;
  }

  /** Satırın ağırlık toplamı; şablon dizi indeksiyle uğraşmasın. */
  protected totalOf(index: number): number {
    return this.store.weightTotals()[index] ?? 0;
  }

  /** Ağırlık toplamı satırı: 100 tamam, 0 taslak, arası hatalı. */
  protected totalClass(total: number): string {
    if (total === 100) return 'total total--ok';
    if (total === 0) return 'total total--draft';
    return 'total total--bad';
  }
}
