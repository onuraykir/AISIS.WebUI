import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClient } from '@core/api/api-client';
import { CreatedId } from '@core/api/api-result.model';
import { AssignmentCloseCommand } from '@features/admin/shared/person/membership.models';
import { RoleRecordCreated } from '@features/admin/shared/person/person.models';
import {
  StaffAssignmentCreateCommand,
  StaffAssignmentUpdateCommand,
  StaffCreateCommand,
  StaffDetail,
  StaffFilter,
  StaffListItem,
  StaffUpdateCommand,
} from './staff.models';

/** `api/StaffAdmin` uç noktalarının tipli karşılığı. Yalnızca HTTP konuşur. */
@Injectable({ providedIn: 'root' })
export class StaffAdminApi {
  private readonly api = inject(ApiClient);
  private readonly base = 'StaffAdmin';

  getList(filter: StaffFilter): Observable<StaffListItem[]> {
    const params: Record<string, string | number | boolean> = {};

    // Boş süzgeç sorgu dizesine HİÇ konmaz: `onlyOpen=` gibi bir parametre
    // sunucuda "false" diye okunur ve sessizce yanlış listeyi getirirdi.
    if (filter.departmentId !== null) params['departmentId'] = filter.departmentId;
    if (filter.onlyOpen !== null) params['onlyOpen'] = filter.onlyOpen;
    if (filter.search.trim().length > 0) params['search'] = filter.search.trim();

    return this.api.get<StaffListItem[]>(this.base, params);
  }

  getById(id: number): Observable<StaffDetail> {
    return this.api.get<StaffDetail>(`${this.base}/${id}`);
  }

  create(command: StaffCreateCommand): Observable<RoleRecordCreated> {
    return this.api.post<RoleRecordCreated>(this.base, command);
  }

  update(id: number, command: StaffUpdateCommand): Observable<string> {
    return this.api.putCommand(`${this.base}/${id}`, command);
  }

  /** Görev döneminin tamamını sonlandırır; kalan açık bağları da kapatır. */
  end(id: number, command: AssignmentCloseCommand): Observable<string> {
    return this.api.postCommand(`${this.base}/${id}/end`, command);
  }

  addAssignment(staffId: number, command: StaffAssignmentCreateCommand): Observable<CreatedId> {
    return this.api.post<CreatedId>(`${this.base}/${staffId}/assignments`, command);
  }

  updateAssignment(
    assignmentId: number,
    command: StaffAssignmentUpdateCommand,
  ): Observable<string> {
    return this.api.putCommand(`${this.base}/assignments/${assignmentId}`, command);
  }

  closeAssignment(assignmentId: number, command: AssignmentCloseCommand): Observable<string> {
    return this.api.postCommand(`${this.base}/assignments/${assignmentId}/close`, command);
  }
}
