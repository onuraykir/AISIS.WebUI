import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiFailure } from '@core/api/api-result.model';
import { OfferingAdminApi } from '@features/admin/offerings/data-access/offering-admin.api';
import { OfferingListItem } from '@features/admin/offerings/data-access/offering.models';
import { SemesterAdminApi } from '@features/admin/semesters/data-access/semester-admin.api';
import { SemesterListItem } from '@features/admin/semesters/data-access/semester.models';
import { OutcomeCalculationApi } from './outcome-calculation.api';
import { MENU_TRIAL_CONTEXT } from '@core/session/menu-trial-context';
import { OutcomeCalculation, OutcomeClosure, StudentOutcomeRow } from './calculation.models';

export interface StoreFeedback {
  readonly severity: 'success' | 'error';
  readonly text: string;
}

/**
 * Çıktı Hesabı ekranının durumu.
 *
 * BAĞLAM AÇILIŞTIR: önce dönem, sonra o dönemin açılışlarından biri seçilir.
 * Hesap seçilen açılış için koşar — ders çıktıları da ağırlık matrisi de açılışa ait.
 *
 * ARA HESAP YOK: önizleme bir "kısmi sonuç" değil, tam hesabın yazılmamış hâlidir.
 * Engel varsa hiçbir sayı üretilmez; ekranda sayı yerine engellerin listesi durur.
 */
@Injectable()
export class CalculationStore {
  private readonly api = inject(OutcomeCalculationApi);
  private readonly offeringApi = inject(OfferingAdminApi);
  private readonly semesterApi = inject(SemesterAdminApi);

  private readonly _semesters = signal<readonly SemesterListItem[]>([]);
  private readonly _offerings = signal<readonly OfferingListItem[]>([]);
  private readonly _result = signal<OutcomeCalculation | null>(null);
  private readonly _closure = signal<OutcomeClosure | null>(null);
  private readonly _closing = signal(false);

  private readonly _loading = signal(false);
  private readonly _calculating = signal(false);
  private readonly _saving = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _feedback = signal<StoreFeedback | null>(null);

  readonly semesters = this._semesters.asReadonly();
  readonly offerings = this._offerings.asReadonly();
  readonly result = this._result.asReadonly();
  readonly closure = this._closure.asReadonly();
  readonly closing = this._closing.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly calculating = this._calculating.asReadonly();
  readonly saving = this._saving.asReadonly();
  readonly error = this._error.asReadonly();
  readonly feedback = this._feedback.asReadonly();

  readonly semesterId = signal<number | null>(null);
  readonly offeringId = signal<number | null>(null);

  /** Uyarılar okundu mu? Kaydetme buna bağlı — sunucu da ayrıca denetliyor. */
  readonly warningsAcknowledged = signal(false);

  readonly selectedOffering = computed(
    () => this._offerings().find((o) => o.id === this.offeringId()) ?? null,
  );

  /** Kolon başlıkları: dersin çıktı kodları, sırayla. */
  readonly outcomeCodes = computed(() => {
    const rows = this._result()?.courseOutcomeResults ?? [];
    return [...new Set(rows.map((r) => r.outcomeCode))].sort();
  });

  /**
   * Sunucu satırları öğrenci × çıktı olarak düz döner; tablo öğrenci başına
   * TEK satır istiyor. Çevrimi burada yapıyoruz ki şablon mantık taşımasın.
   */
  readonly studentRows = computed<readonly StudentOutcomeRow[]>(() => {
    const rows = this._result()?.courseOutcomeResults ?? [];
    const codes = this.outcomeCodes();

    const byStudent = new Map<number, StudentOutcomeRow>();

    for (const row of rows) {
      let entry = byStudent.get(row.studentId);

      if (!entry) {
        entry = {
          studentId: row.studentId,
          studentNumber: row.studentNumber,
          fullName: row.fullName,
          levels: codes.map(() => 0),
          average: 0,
        };
        byStudent.set(row.studentId, entry);
      }

      const index = codes.indexOf(row.outcomeCode);
      if (index >= 0) {
        (entry.levels as number[])[index] = row.achievementLevel;
      }
    }

    for (const entry of byStudent.values()) {
      const total = entry.levels.reduce((sum, level) => sum + level, 0);
      (entry as { average: number }).average =
        entry.levels.length > 0 ? Math.round((total / entry.levels.length) * 100) / 100 : 0;
    }

    return [...byStudent.values()].sort((a, b) =>
      a.studentNumber.localeCompare(b.studentNumber, 'tr'),
    );
  });

  /** Öğrenci başına program çıktısı sonuçları; alt tablo bundan besleniyor. */
  readonly programRows = computed(() => this._result()?.programOutcomeResults ?? []);

  readonly canCommit = computed(() => this._result()?.canCommit === true);

  readonly hasWarnings = computed(() => (this._result()?.warnings.length ?? 0) > 0);

  clearFeedback(): void {
    this._feedback.set(null);
  }

  async loadContext(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const semesters = await firstValueFrom(
        this.semesterApi.getList({ status: null, search: '' }),
      );
      this._semesters.set(semesters);

      if (this.semesterId() === null) {
        const current = semesters.find((s) => s.isCurrent) ?? semesters[0];
        this.semesterId.set(current?.id ?? null);
      }

      await this.loadOfferings();
    } catch (error) {
      this._error.set(toMessage(error));
    } finally {
      this._loading.set(false);
    }
  }

  async loadOfferings(): Promise<void> {
    const semesterId = this.semesterId();
    this._result.set(null);
    this.offeringId.set(null);

    if (semesterId === null) {
      this._offerings.set([]);
      return;
    }

    try {
      this._offerings.set(await firstValueFrom(this.offeringApi.getList(semesterId, '')));
    } catch (error) {
      this._offerings.set([]);
      this._error.set(toMessage(error));
    }
  }

  /** Hesabı koşar; hiçbir şey yazmaz. */
  async preview(): Promise<void> {
    const offeringId = this.offeringId();
    if (offeringId === null) {
      return;
    }

    this._calculating.set(true);
    this._feedback.set(null);
    this.warningsAcknowledged.set(false);

    try {
      this._result.set(await firstValueFrom(this.api.preview(offeringId)));
      // Kapanis durumu hesapla BIRLIKTE tazeleniyor: ikisi ayni sayilara bakiyor
      // ve ekranda yan yana duruyorlar, ayri ayri bayatlamamalilar.
      this._closure.set(await firstValueFrom(this.api.closurePreview(offeringId)));
    } catch (error) {
      this._result.set(null);
      this._closure.set(null);
      this._feedback.set({ severity: 'error', text: toMessage(error) });
    } finally {
      this._calculating.set(false);
    }
  }

  /**
   * Açılışı mühürler. Kapı hesaptan DAHA SIKI: eksik puan hesapta uyarıydı,
   * kapanışta engeldir — dondurulan sayının arkasında eksik veri kalamaz.
   */
  async close(): Promise<void> {
    const offeringId = this.offeringId();
    if (offeringId === null) {
      return;
    }

    this._closing.set(true);
    this._feedback.set(null);

    try {
      this._closure.set(
        await firstValueFrom(this.api.close(offeringId, MENU_TRIAL_CONTEXT.userId)),
      );
      this._feedback.set({
        severity: 'success',
        text: 'Açılış kapatıldı; sonuçlar donduruldu.',
      });
      await this.preview();
    } catch (error) {
      this._feedback.set({ severity: 'error', text: toMessage(error) });
      await this.preview();
    } finally {
      this._closing.set(false);
    }
  }

  /** Mührü kaldırır. Gerekçe zorunlu — sunucu da ayrıca denetliyor. */
  async reopen(reason: string): Promise<void> {
    const offeringId = this.offeringId();
    if (offeringId === null) {
      return;
    }

    this._closing.set(true);
    this._feedback.set(null);

    try {
      this._closure.set(
        await firstValueFrom(this.api.reopen(offeringId, reason, MENU_TRIAL_CONTEXT.userId)),
      );
      this._feedback.set({ severity: 'success', text: 'Açılış yeniden açıldı.' });
      await this.preview();
    } catch (error) {
      this._feedback.set({ severity: 'error', text: toMessage(error) });
    } finally {
      this._closing.set(false);
    }
  }

  /**
   * Sonucu yazar. Sunucu hesabı YENİDEN koşar: önizleme ile onay arasında başkası
   * not girmiş olabilir, o yüzden istemciden sayı gönderilmez.
   */
  async commit(): Promise<void> {
    const offeringId = this.offeringId();
    if (offeringId === null) {
      return;
    }

    this._saving.set(true);
    this._feedback.set(null);

    try {
      const result = await firstValueFrom(
        this.api.commit(offeringId, this.warningsAcknowledged()),
      );

      this._result.set(result);
      this._feedback.set({ severity: 'success', text: 'Çıktı sonuçları kaydedildi.' });
    } catch (error) {
      this._feedback.set({ severity: 'error', text: toMessage(error) });

      // Sunucu reddettiyse durum değişmiş olabilir (arada not girilmiş, açılış
      // kapanmış). Ekrandaki sayı bayat kalmasın diye yeniden koşuyoruz.
      await this.preview();
    } finally {
      this._saving.set(false);
    }
  }
}

function toMessage(error: unknown): string {
  return error instanceof ApiFailure ? error.message : 'Beklenmeyen bir hata oluştu.';
}
