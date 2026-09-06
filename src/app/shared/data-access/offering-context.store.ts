import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiFailure } from '@core/api/api-result.model';
import { OfferingAdminApi } from '@features/admin/offerings/data-access/offering-admin.api';
import { OfferingListItem } from '@features/admin/offerings/data-access/offering.models';
import { SemesterAdminApi } from '@features/admin/semesters/data-access/semester-admin.api';
import { SemesterListItem } from '@features/admin/semesters/data-access/semester.models';

/**
 * DÖNEM → AÇILIŞ bağlamı: "hangi dersin hangi dönemki açılışındayım?"
 *
 * Akreditasyon ekranlarının çoğu bu bağlamla başlar, çünkü ders çıktısı da,
 * etkinlik de, sonuç da **açılışa** bağlıdır (K-I/B) — derse değil.
 *
 * ORTAK BİLEŞENE ÇIKARILDI çünkü aynı seçici üçüncü kez gerekti (çıktı hesabı,
 * çıktı eşleştirme, ders çıktısı kaydı). İki kopyada tolere edilebilirdi;
 * üçüncüde "güncel dönemi varsayılan seç" gibi kararlar kopyalar arasında
 * ayrışmaya başlar.
 *
 * SAYFA BAŞINA BİR ÖRNEK: `providers` içinde verilir, `providedIn: 'root'`
 * DEĞİLDİR — iki ekran açıkken birinin seçimi ötekini kaydırmamalı.
 */
@Injectable()
export class OfferingContextStore {
  private readonly semesterApi = inject(SemesterAdminApi);
  private readonly offeringApi = inject(OfferingAdminApi);

  private readonly _semesters = signal<readonly SemesterListItem[]>([]);
  private readonly _offerings = signal<readonly OfferingListItem[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly semesters = this._semesters.asReadonly();
  readonly offerings = this._offerings.asReadonly();

  /** Dönem/açılış listeleri yükleniyor mu? Sayfanın kendi yüklemesinden ayrıdır. */
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly semesterId = signal<number | null>(null);
  readonly offeringId = signal<number | null>(null);

  readonly selectedOffering = computed(
    () => this._offerings().find((offering) => offering.id === this.offeringId()) ?? null,
  );

  /** Seçili açılışın okunabilir künyesi; başlıklarda kullanılır. */
  readonly offeringLabel = computed(() => {
    const offering = this.selectedOffering();
    return offering ? `${offering.courseCode} — ${offering.courseName}` : null;
  });

  readonly semesterOptions = computed(() =>
    this._semesters().map((semester) => ({
      value: semester.id,
      label: semester.isCurrent ? `${semester.name} (güncel)` : semester.name,
    })),
  );

  readonly offeringOptions = computed(() =>
    this._offerings().map((offering) => ({
      value: offering.id,
      label: `${offering.courseCode} — ${offering.courseName}`,
    })),
  );

  /**
   * Dönemleri getirir ve seçim boşsa GÜNCEL dönemi varsayar; sonra o dönemin
   * açılışlarını yükler.
   *
   * Güncel dönem varsayılıyor çünkü kullanıcı neredeyse her zaman onunla
   * çalışıyor; geçmiş döneme bakmak bilinçli bir eylemdir.
   */
  async load(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const semesters = await firstValueFrom(
        this.semesterApi.getList({ status: null, search: '' }),
      );
      this._semesters.set(semesters);

      if (this.semesterId() === null) {
        this.semesterId.set((semesters.find((s) => s.isCurrent) ?? semesters[0])?.id ?? null);
      }

      await this.loadOfferings();
    } catch (error) {
      this._semesters.set([]);
      this._error.set(toMessage(error));
    } finally {
      this._loading.set(false);
    }
  }

  /**
   * Seçili dönemin açılışlarını getirir. Açılış seçimi HER ZAMAN sıfırlanır:
   * başka bir dönemde aynı Id başka bir dersi gösterir ve ekran sessizce yanlış
   * açılışın verisini basardı.
   */
  async loadOfferings(): Promise<void> {
    const semesterId = this.semesterId();
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
}

function toMessage(error: unknown): string {
  return error instanceof ApiFailure ? error.message : 'Beklenmeyen bir hata oluştu.';
}
