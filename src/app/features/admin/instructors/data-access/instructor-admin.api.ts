import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClient } from '@core/api/api-client';
import { CreatedId } from '@core/api/api-result.model';
import { AssignmentCloseCommand } from '@features/admin/shared/person/membership.models';
import { RoleRecordCreated } from '@features/admin/shared/person/person.models';
import {
  InstructorAssignmentCreateCommand,
  InstructorAssignmentUpdateCommand,
  InstructorCreateCommand,
  InstructorDetail,
  InstructorFilter,
  InstructorListItem,
  InstructorUpdateCommand,
} from './instructor.models';

/** `api/InstructorAdmin` uç noktalarının tipli karşılığı. Yalnızca HTTP konuşur. */
@Injectable({ providedIn: 'root' })
export class InstructorAdminApi {
  private readonly api = inject(ApiClient);
  private readonly base = 'InstructorAdmin';

  getList(filter: InstructorFilter): Observable<InstructorListItem[]> {
    const params: Record<string, string | number | boolean> = {};

    // Boş süzgeç sorgu dizesine HİÇ konmaz: `onlyOpen=` gibi bir parametre
    // sunucuda "false" diye okunur ve sessizce yanlış listeyi getirirdi.
    if (filter.departmentId !== null) params['departmentId'] = filter.departmentId;
    if (filter.onlyOpen !== null) params['onlyOpen'] = filter.onlyOpen;
    if (filter.search.trim().length > 0) params['search'] = filter.search.trim();

    return this.api.get<InstructorListItem[]>(this.base, params);
  }

  getById(id: number): Observable<InstructorDetail> {
    return this.api.get<InstructorDetail>(`${this.base}/${id}`);
  }

  create(command: InstructorCreateCommand): Observable<RoleRecordCreated> {
    return this.api.post<RoleRecordCreated>(this.base, command);
  }

  update(id: number, command: InstructorUpdateCommand): Observable<string> {
    return this.api.putCommand(`${this.base}/${id}`, command);
  }

  /** Görev döneminin tamamını sonlandırır; kalan açık bağları da kapatır. */
  end(id: number, command: AssignmentCloseCommand): Observable<string> {
    return this.api.postCommand(`${this.base}/${id}/end`, command);
  }

  addAssignment(
    instructorId: number,
    command: InstructorAssignmentCreateCommand,
  ): Observable<CreatedId> {
    return this.api.post<CreatedId>(`${this.base}/${instructorId}/assignments`, command);
  }

  updateAssignment(
    assignmentId: number,
    command: InstructorAssignmentUpdateCommand,
  ): Observable<string> {
    return this.api.putCommand(`${this.base}/assignments/${assignmentId}`, command);
  }

  closeAssignment(assignmentId: number, command: AssignmentCloseCommand): Observable<string> {
    return this.api.postCommand(`${this.base}/assignments/${assignmentId}/close`, command);
  }
}
