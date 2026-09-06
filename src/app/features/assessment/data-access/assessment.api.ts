import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';

import { environment } from '@env/environment';
import { ApiClient } from '@core/api/api-client';
import { ApiFailure, ApiResult } from '@core/api/api-result.model';
import { AssessmentGrid, BulkUploadResult, Confirmation, ScoreDraft } from './assessment.models';

/**
 * Not girişinin iki kolu.
 *
 * DOSYA KOLU üç adım: `parse` (dosyayı oku) → `review` (düzenlenmiş taslağı yeniden
 * karşılaştır) → `confirm` (yaz). Ortadaki adım üç aşamalı akışın omurgası: hoca bir
 * karar verdiğinde ekran, artık geçerli olmayan engelleyicileri göstermeye devam
 * etmemeli.
 *
 * GRID KOLU aynı omurga, tek farkı kimliğin Id'den çözülmesi.
 *
 * Onay adımında istemcinin gönderdiği karşılaştırmaya **güvenilmez**; sunucu hepsini
 * yeniden kurar.
 */
@Injectable({ providedIn: 'root' })
export class AssessmentApi {
  private readonly api = inject(ApiClient);
  private readonly http = inject(HttpClient);

  // ── Dosya kolu ──

  /**
   * Excel'i okur ve veritabanıyla karşılaştırır. Yazmaz.
   *
   * `multipart/form-data` olduğu için ortak {@link ApiClient} kullanılamıyor;
   * zarf açma davranışı burada tekrarlanıyor.
   */
  parseFile(courseInSemesterId: number, file: File): Observable<Confirmation> {
    const form = new FormData();
    form.append('File', file);
    form.append('CourseInSemesterId', String(courseInSemesterId));

    return this.http
      .post<ApiResult<Confirmation>>(`${environment.apiUrl}/AssessmentFile/scores/parse`, form)
      .pipe(
        map((response) => {
          if (!response.isSuccess) {
            throw new ApiFailure(response.message || 'Dosya okunamadı.', 200);
          }
          return response.result as Confirmation;
        }),
        catchError((error: unknown) => throwError(() => toFailure(error))),
      );
  }

  /** Düzenlenmiş taslağı yeniden karşılaştırır. Yazmaz. */
  review(draft: ScoreDraft): Observable<Confirmation> {
    return this.api.post<Confirmation>('AssessmentFile/scores/review', draft);
  }

  /** Onaylanan taslağı yazar. */
  confirmFile(draft: ScoreDraft): Observable<BulkUploadResult> {
    return this.api.post<BulkUploadResult>('AssessmentFile/scores/confirm', draft);
  }

  // ── Grid kolu ──

  /** Faz 0: açılışın mevcut not gridi. Boş açılışta da 200 döner. */
  getGrid(courseInSemesterId: number): Observable<AssessmentGrid> {
    return this.api.get<AssessmentGrid>(`AssessmentData/grid/${courseInSemesterId}`);
  }

  parseGrid(draft: ScoreDraft): Observable<Confirmation> {
    return this.api.post<Confirmation>('AssessmentData/grid/parse', draft);
  }

  confirmGrid(draft: ScoreDraft): Observable<BulkUploadResult> {
    return this.api.post<BulkUploadResult>('AssessmentData/grid/confirm', draft);
  }
}

/** {@link ApiClient} içindekiyle aynı indirgeme; multipart çağrısı oradan geçemiyor. */
function toFailure(error: unknown): ApiFailure {
  if (error instanceof ApiFailure) return error;

  const response = error as { status?: number; error?: unknown };
  const body = response?.error as ApiResult<unknown> | null;

  if (body && typeof body === 'object' && typeof body.message === 'string' && body.message) {
    return new ApiFailure(body.message, response.status ?? 0);
  }

  if (response?.status === 0) {
    return new ApiFailure('Sunucuya ulaşılamadı. API çalışıyor mu?', 0);
  }

  return new ApiFailure(`Sunucu hatası (${response?.status ?? '?'}).`, response?.status ?? -1);
}
