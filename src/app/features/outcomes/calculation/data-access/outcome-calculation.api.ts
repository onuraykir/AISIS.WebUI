import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClient } from '@core/api/api-client';
import { OutcomeCalculation, OutcomeClosure } from './calculation.models';

/**
 * `api/OutcomeCalculation` uç noktalarının tipli karşılığı.
 *
 * İKİ ADIM: önce görülür, sonra kaydedilir. Otomatik tetikleyici yoktur — hesap
 * yalnızca bu çağrılarla, kullanıcının isteğiyle koşar.
 */
@Injectable({ providedIn: 'root' })
export class OutcomeCalculationApi {
  private readonly api = inject(ApiClient);
  private readonly base = 'OutcomeCalculation';

  /** Hesaplar, hiçbir şey yazmaz. */
  preview(courseInSemesterId: number): Observable<OutcomeCalculation> {
    return this.api.get<OutcomeCalculation>(`${this.base}/${courseInSemesterId}/preview`);
  }

  /**
   * Hesaplar ve yazar. Uyarı varsa `acknowledgeWarnings` olmadan sunucu yazmaz —
   * "0 sayıldı" listesi görülmeden kaydedilen bir akreditasyon sayısı savunulamaz.
   */
  commit(courseInSemesterId: number, acknowledgeWarnings: boolean): Observable<OutcomeCalculation> {
    return this.api.post<OutcomeCalculation>(`${this.base}/${courseInSemesterId}`, {
      acknowledgeWarnings,
    });
  }

  // ── Kapanış ──

  /** Kapanış denetimini koşar, mühürlemez. */
  closurePreview(courseInSemesterId: number): Observable<OutcomeClosure> {
    return this.api.get<OutcomeClosure>(`${this.base}/${courseInSemesterId}/closure`);
  }

  /** Denetimi geçerse sonuçları yazar ve açılışı mühürler. */
  close(courseInSemesterId: number, closedByUserId: number): Observable<OutcomeClosure> {
    return this.api.post<OutcomeClosure>(`${this.base}/${courseInSemesterId}/close`, {
      closedByUserId,
    });
  }

  /** Mührü kaldırır. Gerekçe zorunlu. */
  reopen(
    courseInSemesterId: number,
    reason: string,
    reopenedByUserId: number,
  ): Observable<OutcomeClosure> {
    return this.api.post<OutcomeClosure>(`${this.base}/${courseInSemesterId}/reopen`, {
      reason,
      reopenedByUserId,
    });
  }
}
