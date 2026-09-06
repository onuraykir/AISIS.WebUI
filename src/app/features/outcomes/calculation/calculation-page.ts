import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ConfirmationService } from 'primeng/api';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Skeleton } from 'primeng/skeleton';
import { Tooltip } from 'primeng/tooltip';

import { HasAction } from '@shared/directives/has-action';
import { CalculationStore } from './data-access/calculation.store';

/**
 * Çıktı Hesabı ekranı (akıllı bileşen).
 *
 * İKİ ADIM: **Hesapla** hiçbir şey yazmaz, **Kaydet** yazar. Otomatik tetikleyici
 * yoktur — not yüklemek veya matrisi değiştirmek hesabı kendiliğinden koşturmaz.
 *
 * ARA HESAP YOK: engel varsa sayı üretilmez. O yüzden ekranın ortasında ya tablo
 * ya da engellerin listesi durur; ikisi bir arada olmaz. Yarım bir sonuç göstermek,
 * hocaya gerçek olmayan bir başarı tablosu göstermek olurdu.
 *
 * "0 sayıldı" uyarıları kaydetmeden ÖNCE onaylanır: denetimde "bu sıfır gerçek bir
 * başarısızlık mı, eksik veri mi" diye sorulduğunda cevabı veren tek kayıt o liste.
 */
@Component({
  selector: 'app-calculation-page',
  imports: [FormsModule, ConfirmDialog, Message, Select, Skeleton, Tooltip, HasAction],
  providers: [CalculationStore, ConfirmationService],
  templateUrl: './calculation-page.html',
  styleUrl: './calculation-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalculationPage implements OnInit {
  private readonly confirmation = inject(ConfirmationService);

  protected readonly store = inject(CalculationStore);

  /** Yeniden açma gerekçesi. Boşsa sunucu da reddediyor. */
  protected readonly reopenReason = signal('');

  ngOnInit(): void {
    void this.store.loadContext();
  }

  protected onSemesterChange(semesterId: number | null): void {
    this.store.semesterId.set(semesterId);
    void this.store.loadOfferings();
  }

  protected onOfferingChange(offeringId: number | null): void {
    this.store.offeringId.set(offeringId);
    void this.store.preview();
  }

  protected recalculate(): void {
    void this.store.preview();
  }

  protected save(): void {
    void this.store.commit();
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

  /** Kaydetme neden engelli? Boşsa serbest. */
  protected saveBlockedReason(): string | null {
    if (!this.store.result()) {
      return 'Önce hesabı çalıştırın.';
    }

    if (!this.store.canCommit()) {
      return 'Giderilmemiş engeller var.';
    }

    if (this.store.hasWarnings() && !this.store.warningsAcknowledged()) {
      return 'Uyarı listesini gözden geçirip onaylayın.';
    }

    return null;
  }

  // ── Kapanış ──

  protected confirmClose(): void {
    const closure = this.store.closure();
    if (!closure) return;

    this.confirmation.confirm({
      header: 'Açılışı kapat',
      message:
        `${closure.studentCount} öğrencinin ${closure.courseOutcomeResultCount} çıktı sonucu ` +
        'DONDURULACAK. Kapanıştan sonra ne değerlendirme yapısı ne de sonuçlar ' +
        'değiştirilebilir; geri almak ayrı bir yetki ve gerekçe ister.',
      icon: 'pi pi-lock',
      acceptLabel: 'Kapat ve dondur',
      rejectLabel: 'Vazgeç',
      acceptButtonStyleClass: 'p-button-sm',
      rejectButtonStyleClass: 'p-button-text p-button-sm',
      accept: () => void this.store.close(),
    });
  }

  protected submitReopen(): void {
    const reason = this.reopenReason().trim();
    if (reason.length === 0) return;

    void this.store.reopen(reason).then(() => this.reopenReason.set(''));
  }

  /** Kapatma neden engelli? Boşsa serbest. */
  protected closeBlockedReason(): string | null {
    const closure = this.store.closure();

    if (!closure) return 'Önce hesabı çalıştırın.';
    if (closure.isClosed) return 'Açılış zaten kapalı.';
    if (!closure.canClose) return `${closure.blocking.length} engel var.`;

    return null;
  }

  /** 0 – 5 arası başarıyı renklendirmek için eşik; yalnızca görsel. */
  protected levelClass(level: number): string {
    if (level >= 4) return 'level level--high';
    if (level >= 2.5) return 'level level--mid';
    return 'level level--low';
  }
}
