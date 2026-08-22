import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClient } from '@core/api/api-client';
import { CreatedId } from '@core/api/api-result.model';
import {
  GroupDepartmentSetCommand,
  GroupMember,
  GroupMemberAddCommand,
  GroupModuleSetCommand,
  GroupRoleSetCommand,
  UserGroupCreateCommand,
  UserGroupDetail,
  UserGroupListItem,
  UserGroupLookups,
  UserGroupUpdateCommand,
} from './user-group.models';

/** `api/UserGroupAdmin` uç noktalarının tipli karşılığı. Yalnızca HTTP konuşur. */
@Injectable({ providedIn: 'root' })
export class UserGroupAdminApi {
  private readonly api = inject(ApiClient);
  private readonly base = 'UserGroupAdmin';

  getGroups(): Observable<UserGroupListItem[]> {
    return this.api.get<UserGroupListItem[]>(this.base);
  }

  getDetail(groupId: number): Observable<UserGroupDetail> {
    return this.api.get<UserGroupDetail>(`${this.base}/${groupId}`);
  }

  getMembers(groupId: number): Observable<GroupMember[]> {
    return this.api.get<GroupMember[]>(`${this.base}/${groupId}/members`);
  }

  getLookups(): Observable<UserGroupLookups> {
    return this.api.get<UserGroupLookups>(`${this.base}/lookups`);
  }

  create(command: UserGroupCreateCommand): Observable<CreatedId> {
    return this.api.post<CreatedId>(this.base, command);
  }

  update(id: number, command: UserGroupUpdateCommand): Observable<string> {
    return this.api.putCommand(`${this.base}/${id}`, command);
  }

  setModules(id: number, command: GroupModuleSetCommand): Observable<string> {
    return this.api.putCommand(`${this.base}/${id}/modules`, command);
  }

  setDepartments(id: number, command: GroupDepartmentSetCommand): Observable<string> {
    return this.api.putCommand(`${this.base}/${id}/departments`, command);
  }

  setRoles(id: number, command: GroupRoleSetCommand): Observable<string> {
    return this.api.putCommand(`${this.base}/${id}/roles`, command);
  }

  addMember(id: number, command: GroupMemberAddCommand): Observable<string> {
    return this.api.postCommand(`${this.base}/${id}/members`, command);
  }

  removeMember(id: number, userId: number, departmentId: number): Observable<string> {
    return this.api.deleteCommand(`${this.base}/${id}/members/${userId}/${departmentId}`);
  }

  remove(id: number): Observable<string> {
    return this.api.deleteCommand(`${this.base}/${id}`);
  }
}
