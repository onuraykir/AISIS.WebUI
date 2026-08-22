import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClient } from '@core/api/api-client';
import { CreatedId } from '@core/api/api-result.model';
import {
  RoleCreateCommand,
  RoleListItem,
  RolePermissionMatrix,
  RolePermissionSetCommand,
  RoleUpdateCommand,
} from './role.models';

/** `api/RoleAdmin` uç noktalarının tipli karşılığı. Yalnızca HTTP konuşur. */
@Injectable({ providedIn: 'root' })
export class RoleAdminApi {
  private readonly api = inject(ApiClient);
  private readonly base = 'RoleAdmin';

  getRoles(): Observable<RoleListItem[]> {
    return this.api.get<RoleListItem[]>(this.base);
  }

  getMatrix(roleId: number): Observable<RolePermissionMatrix> {
    return this.api.get<RolePermissionMatrix>(`${this.base}/${roleId}/permissions`);
  }

  create(command: RoleCreateCommand): Observable<CreatedId> {
    return this.api.post<CreatedId>(this.base, command);
  }

  update(id: number, command: RoleUpdateCommand): Observable<string> {
    return this.api.putCommand(`${this.base}/${id}`, command);
  }

  setPermissions(roleId: number, command: RolePermissionSetCommand): Observable<string> {
    return this.api.putCommand(`${this.base}/${roleId}/permissions`, command);
  }

  remove(id: number): Observable<string> {
    return this.api.deleteCommand(`${this.base}/${id}`);
  }
}
