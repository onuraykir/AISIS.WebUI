import { IdName } from '@core/api/api-result.model';

/** `api/UserGroupAdmin` sözleşmesi — backend DTO'ları ile birebir. */

export interface UserGroupListItem {
  readonly id: number;
  readonly name: string;

  /** Kapsam — NE: bağlı ana modül sayısı. */
  readonly moduleCount: number;

  /** Kapsam — NEREDE: yetkili olunan birim sayısı. */
  readonly departmentCount: number;

  readonly roleCount: number;
  readonly memberCount: number;
}

export interface UserGroupDetail {
  readonly id: number;
  readonly name: string;
  readonly modules: readonly IdName[];
  readonly departments: readonly IdName[];
  readonly roles: readonly IdName[];
  readonly memberCount: number;
}

/** Düzenleme ekranındaki tüm seçim listeleri, tek çağrıda. */
export interface UserGroupLookups {
  /** Yalnızca ANA modüller: gruba başka bir şey bağlanamaz. */
  readonly modules: readonly IdName[];
  readonly departments: readonly IdName[];
  readonly roles: readonly IdName[];
  readonly users: readonly IdName[];
}

export interface GroupMember {
  readonly userId: number;
  readonly userName: string;
  readonly email: string;
  readonly departmentId: number;
  readonly departmentName: string;
}

export interface UserGroupCreateCommand {
  readonly name: string;
}

export interface UserGroupUpdateCommand {
  readonly name: string;
}

/** Üç kapsam listesi de REPLACE semantiğinde: seçili küme bütün olarak gönderilir. */
export interface GroupModuleSetCommand {
  readonly rootModuleIds: readonly number[];
}

export interface GroupDepartmentSetCommand {
  readonly departmentIds: readonly number[];
}

export interface GroupRoleSetCommand {
  readonly roleIds: readonly number[];
}

export interface GroupMemberAddCommand {
  readonly userId: number;
  readonly departmentId: number;
}
