import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClient } from '@core/api/api-client';
import {
  CourseProgramOutcomeMatrix,
  CourseProgramOutcomeSetCommand,
} from './course-mapping.models';

/** `api/CourseProgramOutcomeAdmin` uç noktalarının tipli karşılığı. */
@Injectable({ providedIn: 'root' })
export class CourseMappingApi {
  private readonly api = inject(ApiClient);
  private readonly base = 'CourseProgramOutcomeAdmin';

  /**
   * Matrisin tamamı. Bölüm ve arama **süzgeçtir**: satırları daraltır, kolonları ve
   * "kaç ders bağlı" sayımlarını değiştirmez.
   */
  getMatrix(departmentId: number | null, search: string): Observable<CourseProgramOutcomeMatrix> {
    const params: Record<string, string | number> = {};

    if (departmentId !== null) params['departmentId'] = departmentId;
    if (search.trim().length > 0) params['search'] = search.trim();

    return this.api.get<CourseProgramOutcomeMatrix>(this.base, params);
  }

  /** Bir dersin üyeliklerini tümüyle yeniden yazar. */
  setCourseOutcomes(
    courseId: number,
    command: CourseProgramOutcomeSetCommand,
  ): Observable<string> {
    return this.api.putCommand(`${this.base}/course/${courseId}`, command);
  }
}
