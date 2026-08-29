import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClient } from '@core/api/api-client';
import { CreatedId } from '@core/api/api-result.model';
import {
  DepartmentCreateCommand,
  DepartmentMoveCommand,
  DepartmentOption,
  DepartmentTreeNode,
  DepartmentTypeValue,
  DepartmentUpdateCommand,
} from './department.models';

/** `api/DepartmentAdmin` uç noktalarının tipli karşılığı. Yalnızca HTTP konuşur. */
@Injectable({ providedIn: 'root' })
export class DepartmentAdminApi {
  private readonly api = inject(ApiClient);
  private readonly base = 'DepartmentAdmin';

  getTree(): Observable<DepartmentTreeNode[]> {
    return this.api.get<DepartmentTreeNode[]>(`${this.base}/tree`);
  }

  /** Diğer ekranların birim seçicisi; tip verilirse süzülür. */
  getOptions(type?: DepartmentTypeValue): Observable<DepartmentOption[]> {
    return this.api.get<DepartmentOption[]>(
      `${this.base}/options`,
      type === undefined ? undefined : { type },
    );
  }

  create(command: DepartmentCreateCommand): Observable<CreatedId> {
    return this.api.post<CreatedId>(this.base, command);
  }

  update(id: number, command: DepartmentUpdateCommand): Observable<string> {
    return this.api.putCommand(`${this.base}/${id}`, command);
  }

  move(id: number, command: DepartmentMoveCommand): Observable<string> {
    return this.api.putCommand(`${this.base}/${id}/move`, command);
  }

  remove(id: number): Observable<string> {
    return this.api.deleteCommand(`${this.base}/${id}`);
  }
}
