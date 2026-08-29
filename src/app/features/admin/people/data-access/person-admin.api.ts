import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClient } from '@core/api/api-client';
import { PersonDetail, PersonSearchItem, PersonUpdateCommand } from './people.models';

/**
 * `api/PersonAdmin` uç noktalarının tipli karşılığı.
 *
 * KAYIT AÇMA UCU YOK ve olmayacak: kayıt her zaman şeridin kendi ekranından,
 * TCKN ile başlar (K-A). Silme de yok — kişiyi silmek üç şeridin geçmişini
 * birden götürürdü.
 */
@Injectable({ providedIn: 'root' })
export class PersonAdminApi {
  private readonly api = inject(ApiClient);
  private readonly base = 'PersonAdmin';

  /** TCKN, ad, soyad, öğrenci numarası veya sicil ile arar. */
  search(search: string): Observable<PersonSearchItem[]> {
    const trimmed = search.trim();

    return this.api.get<PersonSearchItem[]>(
      this.base,
      trimmed.length > 0 ? { search: trimmed } : undefined,
    );
  }

  getById(id: number): Observable<PersonDetail> {
    return this.api.get<PersonDetail>(`${this.base}/${id}`);
  }

  update(id: number, command: PersonUpdateCommand): Observable<string> {
    return this.api.putCommand(`${this.base}/${id}`, command);
  }
}
