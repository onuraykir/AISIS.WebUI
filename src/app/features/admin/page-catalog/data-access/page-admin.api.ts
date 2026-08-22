import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClient } from '@core/api/api-client';
import { CreatedId } from '@core/api/api-result.model';
import {
  PageCreateCommand,
  PageListItem,
  PagePlacementCommand,
  PageUpdateCommand,
} from './page.models';

/** `api/PageAdmin` uç noktalarının tipli karşılığı. Yalnızca HTTP konuşur. */
@Injectable({ providedIn: 'root' })
export class PageAdminApi {
  private readonly api = inject(ApiClient);
  private readonly base = 'PageAdmin';

  /** isPlaced verilmezse hem havuz hem yerleşik sayfalar gelir. */
  getCatalog(isPlaced?: boolean): Observable<PageListItem[]> {
    return this.api.get<PageListItem[]>(
      `${this.base}/catalog`,
      isPlaced === undefined ? undefined : { isPlaced },
    );
  }

  create(command: PageCreateCommand): Observable<CreatedId> {
    return this.api.post<CreatedId>(this.base, command);
  }

  update(id: number, command: PageUpdateCommand): Observable<string> {
    return this.api.putCommand(`${this.base}/${id}`, command);
  }

  setPlacement(id: number, command: PagePlacementCommand): Observable<string> {
    return this.api.putCommand(`${this.base}/${id}/placement`, command);
  }

  remove(id: number): Observable<string> {
    return this.api.deleteCommand(`${this.base}/${id}`);
  }
}
