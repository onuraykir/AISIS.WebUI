import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClient } from '@core/api/api-client';
import { OutcomeConfirmation, OutcomeDraft, OutcomeGrid } from './matrix.models';

/**
 * `api/CourseOutcomeGrid` uç noktalarının tipli karşılığı.
 *
 * ÜÇ ADIM: matrisi bas → taslağı analiz et → onayla ve yaz. Analiz adımı hiçbir
 * şey yazmaz; onay adımında karşılaştırma sunucuda **yeniden** kurulur, çünkü
 * önizleme ile onay arasında başkası aynı açılışa dokunmuş olabilir.
 */
@Injectable({ providedIn: 'root' })
export class OutcomeMatrixApi {
  private readonly api = inject(ApiClient);
  private readonly base = 'CourseOutcomeGrid';

  /** FAZ 0. Açılışın matrisi. Boş açılışta da 200 döner, listeler boş gelir. */
  getGrid(courseInSemesterId: number): Observable<OutcomeGrid> {
    return this.api.get<OutcomeGrid>(`${this.base}/${courseInSemesterId}`);
  }

  /** FAZ A. Taslağı analiz eder, YAZMAZ. */
  parse(courseInSemesterId: number, draft: OutcomeDraft): Observable<OutcomeConfirmation> {
    return this.api.post<OutcomeConfirmation>(`${this.base}/${courseInSemesterId}/parse`, draft);
  }

  /** FAZ B. Onaylanan taslağı yazar. */
  confirm(courseInSemesterId: number, draft: OutcomeDraft): Observable<unknown> {
    return this.api.post<unknown>(`${this.base}/${courseInSemesterId}/confirm`, draft);
  }
}
