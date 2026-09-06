import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClient } from '@core/api/api-client';
import { CreatedId } from '@core/api/api-result.model';
import {
  SemesterClosure,
  SemesterCreateCommand,
  SemesterDetail,
  SemesterFilter,
  SemesterListItem,
  SemesterUpdateCommand,
} from './semester.models';

/** `api/SemesterAdmin` uç noktalarının tipli karşılığı. Yalnızca HTTP konuşur. */
@Injectable({ providedIn: 'root' })
export class SemesterAdminApi {
  private readonly api = inject(ApiClient);
  private readonly base = 'SemesterAdmin';

  getList(filter: SemesterFilter): Observable<SemesterListItem[]> {
    const params: Record<string, string | number | boolean> = {};

    // Boş süzgeç sorgu dizesine hiç konmaz.
    if (filter.status !== null) params['status'] = filter.status;
    if (filter.search.trim().length > 0) params['search'] = filter.search.trim();

    return this.api.get<SemesterListItem[]>(this.base, params);
  }

  getById(id: number): Observable<SemesterDetail> {
    return this.api.get<SemesterDetail>(`${this.base}/${id}`);
  }

  create(command: SemesterCreateCommand): Observable<CreatedId> {
    return this.api.post<CreatedId>(this.base, command);
  }

  update(id: number, command: SemesterUpdateCommand): Observable<string> {
    return this.api.putCommand(`${this.base}/${id}`, command);
  }

  /** Varsayılan dönemi devreder; eskisi sunucuda aynı işlemde düşer. */
  setCurrent(id: number): Observable<string> {
    return this.api.putCommand(`${this.base}/${id}/current`, null);
  }

  remove(id: number): Observable<string> {
    return this.api.deleteCommand(`${this.base}/${id}`);
  }

  // ── Kapanış ──
  //
  // Düzenleme formundan YAPILAMAZ ve bu bilinçli: ön koşulu K3 (bütün açılışlar
  // kapalı) ve yan etkisi genel program çıktısı sonuçlarının yeniden hesaplanması.

  /** K3 denetimini koşar, kapatmaz. Hangi açılışların açık kaldığını söyler. */
  closurePreview(id: number): Observable<SemesterClosure> {
    return this.api.get<SemesterClosure>(`${this.base}/${id}/closure`);
  }

  close(id: number): Observable<SemesterClosure> {
    return this.api.post<SemesterClosure>(`${this.base}/${id}/close`, null);
  }
}
