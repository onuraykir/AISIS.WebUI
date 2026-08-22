import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClient } from '@core/api/api-client';
import { CreatedId } from '@core/api/api-result.model';
import {
  ModuleCreateCommand,
  ModuleMoveCommand,
  ModuleReorderCommand,
  ModuleTreeNode,
  ModuleUpdateCommand,
} from './module.models';

/**
 * `api/ModuleAdmin` uç noktalarının tipli karşılığı.
 *
 * Yalnızca HTTP konuşur: durum tutmaz, hata yakalamaz, mesaj göstermez.
 * Bunlar store'un işidir.
 */
@Injectable({ providedIn: 'root' })
export class ModuleAdminApi {
  private readonly api = inject(ApiClient);
  private readonly base = 'ModuleAdmin';

  getTree(): Observable<ModuleTreeNode[]> {
    return this.api.get<ModuleTreeNode[]>(`${this.base}/tree`);
  }

  create(command: ModuleCreateCommand): Observable<CreatedId> {
    return this.api.post<CreatedId>(this.base, command);
  }

  update(id: number, command: ModuleUpdateCommand): Observable<string> {
    return this.api.putCommand(`${this.base}/${id}`, command);
  }

  move(id: number, command: ModuleMoveCommand): Observable<string> {
    return this.api.putCommand(`${this.base}/${id}/move`, command);
  }

  reorder(command: ModuleReorderCommand): Observable<string> {
    return this.api.putCommand(`${this.base}/reorder`, command);
  }

  remove(id: number): Observable<string> {
    return this.api.deleteCommand(`${this.base}/${id}`);
  }
}
