import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClient } from '@core/api/api-client';
import { CreatedId } from '@core/api/api-result.model';
import {
  ActionDefinition,
  ActionDefinitionCreateCommand,
  ActionDefinitionReorderCommand,
  ActionDefinitionUpdateCommand,
  ApiEndpoint,
  OperationActionAttachCommand,
  OperationActionUpdateCommand,
  PageOperationCreateCommand,
  PageOperationReorderCommand,
  PageOperationUpdateCommand,
} from './operation.models';

/** `api/OperationAdmin` uç noktalarının tipli karşılığı. Yalnızca HTTP konuşur. */
@Injectable({ providedIn: 'root' })
export class OperationAdminApi {
  private readonly api = inject(ApiClient);
  private readonly base = 'OperationAdmin';

  // ── Ortak eylem havuzu ──

  getCatalog(): Observable<ActionDefinition[]> {
    return this.api.get<ActionDefinition[]>(`${this.base}/catalog`);
  }

  createDefinition(command: ActionDefinitionCreateCommand): Observable<CreatedId> {
    return this.api.post<CreatedId>(`${this.base}/catalog`, command);
  }

  updateDefinition(id: number, command: ActionDefinitionUpdateCommand): Observable<string> {
    return this.api.putCommand(`${this.base}/catalog/${id}`, command);
  }

  reorderDefinitions(command: ActionDefinitionReorderCommand): Observable<string> {
    return this.api.putCommand(`${this.base}/catalog/reorder`, command);
  }

  removeDefinition(id: number): Observable<string> {
    return this.api.deleteCommand(`${this.base}/catalog/${id}`);
  }

  /** Uygulamada tanımlı uç noktalar; eylem bağlarken adres buradan seçilir. */
  getEndpoints(): Observable<ApiEndpoint[]> {
    return this.api.get<ApiEndpoint[]>(`${this.base}/endpoints`);
  }

  // ── Sayfa işlemleri ──
  // Sayfanın işlem → eylem ağacı `PageAdmin/catalog` yanıtında geliyor
  // (PageListItem.operations); burada yalnızca yazma uçları var.

  createOperation(pageId: number, command: PageOperationCreateCommand): Observable<CreatedId> {
    return this.api.post<CreatedId>(`${this.base}/page/${pageId}`, command);
  }

  reorderOperations(pageId: number, command: PageOperationReorderCommand): Observable<string> {
    return this.api.putCommand(`${this.base}/page/${pageId}/reorder`, command);
  }

  updateOperation(operationId: number, command: PageOperationUpdateCommand): Observable<string> {
    return this.api.putCommand(`${this.base}/operation/${operationId}`, command);
  }

  removeOperation(operationId: number): Observable<string> {
    return this.api.deleteCommand(`${this.base}/operation/${operationId}`);
  }

  // ── İşlem eylemleri ──

  attachAction(operationId: number, command: OperationActionAttachCommand): Observable<CreatedId> {
    return this.api.post<CreatedId>(`${this.base}/operation/${operationId}/action`, command);
  }

  updateAction(actionId: number, command: OperationActionUpdateCommand): Observable<string> {
    return this.api.putCommand(`${this.base}/action/${actionId}`, command);
  }

  detachAction(actionId: number): Observable<string> {
    return this.api.deleteCommand(`${this.base}/action/${actionId}`);
  }
}
