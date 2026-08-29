import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClient } from '@core/api/api-client';
import { CreatedId } from '@core/api/api-result.model';
import {
  ActivityDefinition,
  ActivityDefinitionCreateCommand,
  ActivityDefinitionUpdateCommand,
} from './activity-definition.models';

/** `api/ActivityDefinitionAdmin` uç noktalarının tipli karşılığı. */
@Injectable({ providedIn: 'root' })
export class ActivityDefinitionAdminApi {
  private readonly api = inject(ApiClient);
  private readonly base = 'ActivityDefinitionAdmin';

  getList(search: string): Observable<ActivityDefinition[]> {
    return this.api.get<ActivityDefinition[]>(
      this.base,
      search.trim().length > 0 ? { search: search.trim() } : undefined,
    );
  }

  create(command: ActivityDefinitionCreateCommand): Observable<CreatedId> {
    return this.api.post<CreatedId>(this.base, command);
  }

  update(id: number, command: ActivityDefinitionUpdateCommand): Observable<string> {
    return this.api.putCommand(`${this.base}/${id}`, command);
  }

  remove(id: number): Observable<string> {
    return this.api.deleteCommand(`${this.base}/${id}`);
  }
}
