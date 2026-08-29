import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiFailure, IdName } from '@core/api/api-result.model';
import { UserGroupAdminApi } from './user-group-admin.api';
import {
  GroupMember,
  UserGroupCreateCommand,
  UserGroupDetail,
  UserGroupListItem,
  UserGroupLookups,
  UserGroupUpdateCommand,
} from './user-group.models';

export interface StoreFeedback {
  readonly severity: 'success' | 'error';
  readonly text: string;
}

/** Ekranın üç kapsam bölümünden hangisinin kaydedileceğini belirtir. */
export type ScopeKind = 'modules' | 'departments' | 'roles';

const EMPTY_LOOKUPS: UserGroupLookups = { modules: [], departments: [], roles: [], users: [] };

/**
 * Kullanıcı Grupları ekranının durumu.
 *
 * Üç kapsam listesi (modül / birim / rol) AYRI uçlardan yönetilir ve her biri
 * REPLACE semantiğindedir. Bu yüzden her biri kendi taslağını tutar: yönetici
 * birimleri değiştirip kaydetmeden modüllere dokunursa iki değişiklik
 * birbirine karışmaz.
 */
@Injectable()
export class UserGroupAdminStore {
  private readonly api = inject(UserGroupAdminApi);

  private readonly _groups = signal<readonly UserGroupListItem[]>([]);
  private readonly _lookups = signal<UserGroupLookups>(EMPTY_LOOKUPS);
  private readonly _detail = signal<UserGroupDetail | null>(null);
  private readonly _members = signal<readonly GroupMember[]>([]);
  private readonly _selectedGroupId = signal<number | null>(null);

  /** Kapsam taslakları; kaydedilene kadar sunucuya gitmez. */
  private readonly _moduleDraft = signal<readonly number[]>([]);
  private readonly _departmentDraft = signal<readonly number[]>([]);
  private readonly _roleDraft = signal<readonly number[]>([]);

  private readonly _loading = signal(false);
  private readonly _detailLoading = signal(false);
  private readonly _saving = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _feedback = signal<StoreFeedback | null>(null);

  readonly groups = this._groups.asReadonly();
  readonly lookups = this._lookups.asReadonly();
  readonly detail = this._detail.asReadonly();
  readonly members = this._members.asReadonly();
  readonly selectedGroupId = this._selectedGroupId.asReadonly();

  readonly moduleDraft = this._moduleDraft.asReadonly();
  readonly departmentDraft = this._departmentDraft.asReadonly();
  readonly roleDraft = this._roleDraft.asReadonly();

  readonly loading = this._loading.asReadonly();
  readonly detailLoading = this._detailLoading.asReadonly();
  readonly saving = this._saving.asReadonly();
  readonly error = this._error.asReadonly();
  readonly feedback = this._feedback.asReadonly();

  readonly memberTotal = computed(() =>
    this._groups().reduce((total, group) => total + group.memberCount, 0),
  );

  readonly moduleDirty = computed(() =>
    differs(this._moduleDraft(), this._detail()?.modules ?? []),
  );
  readonly departmentDirty = computed(() =>
    differs(this._departmentDraft(), this._detail()?.departments ?? []),
  );
  readonly roleDirty = computed(() => differs(this._roleDraft(), this._detail()?.roles ?? []));

  /**
   * Bir birim kapsamdan çıkarılmak isteniyorsa ve o birimde üye varsa engellenir.
   * Sunucu da reddeder; burada kullanıcı kaydetmeden önce görür.
   */
  readonly departmentRemovalBlocked = computed<string[]>(() => {
    const draft = new Set(this._departmentDraft());

    return [
      ...new Set(
        this._members()
          .filter((member) => !draft.has(member.departmentId))
          .map((member) => member.departmentName),
      ),
    ];
  });

  clearFeedback(): void {
    this._feedback.set(null);
  }

  setDraft(kind: ScopeKind, ids: readonly number[]): void {
    if (kind === 'modules') this._moduleDraft.set(ids);
    else if (kind === 'departments') this._departmentDraft.set(ids);
    else this._roleDraft.set(ids);
  }

  async load(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const [groups, lookups] = await Promise.all([
        firstValueFrom(this.api.getGroups()),
        firstValueFrom(this.api.getLookups()),
      ]);

      this._groups.set(groups);
      this._lookups.set(lookups);

      const current = this._selectedGroupId();
      if (current !== null && groups.some((group) => group.id === current)) {
        await this.loadDetail(current);
      } else {
        this._selectedGroupId.set(null);
        this.resetDetail();
      }
    } catch (error) {
      this._groups.set([]);
      this._lookups.set(EMPTY_LOOKUPS);
      this.resetDetail();
      this._error.set(toMessage(error));
    } finally {
      this._loading.set(false);
    }
  }

  async selectGroup(groupId: number): Promise<void> {
    this._selectedGroupId.set(groupId);
    await this.loadDetail(groupId);
  }

  private async loadDetail(groupId: number): Promise<void> {
    this._detailLoading.set(true);

    try {
      const [detail, members] = await Promise.all([
        firstValueFrom(this.api.getDetail(groupId)),
        firstValueFrom(this.api.getMembers(groupId)),
      ]);

      this.applyDetail(detail, members);
    } catch (error) {
      this.resetDetail();
      this._feedback.set({ severity: 'error', text: toMessage(error) });
    } finally {
      this._detailLoading.set(false);
    }
  }

  private applyDetail(detail: UserGroupDetail, members: readonly GroupMember[]): void {
    this._detail.set(detail);
    this._members.set(members);
    this._moduleDraft.set(detail.modules.map((item) => item.id));
    this._departmentDraft.set(detail.departments.map((item) => item.id));
    this._roleDraft.set(detail.roles.map((item) => item.id));
  }

  private resetDetail(): void {
    this._detail.set(null);
    this._members.set([]);
    this._moduleDraft.set([]);
    this._departmentDraft.set([]);
    this._roleDraft.set([]);
  }

  // ── Komutlar ──

  async saveScope(kind: ScopeKind): Promise<boolean> {
    const groupId = this._selectedGroupId();
    if (groupId === null) {
      return false;
    }

    return this.runCommand(() => {
      if (kind === 'modules') {
        return firstValueFrom(this.api.setModules(groupId, { rootModuleIds: this._moduleDraft() }));
      }

      if (kind === 'departments') {
        return firstValueFrom(
          this.api.setDepartments(groupId, { departmentIds: this._departmentDraft() }),
        );
      }

      return firstValueFrom(this.api.setRoles(groupId, { roleIds: this._roleDraft() }));
    });
  }

  /** Kaydedilmemiş kapsam değişikliklerini atar. */
  revert(kind: ScopeKind): void {
    const detail = this._detail();
    if (!detail) {
      return;
    }

    if (kind === 'modules') this._moduleDraft.set(detail.modules.map((item) => item.id));
    else if (kind === 'departments')
      this._departmentDraft.set(detail.departments.map((item) => item.id));
    else this._roleDraft.set(detail.roles.map((item) => item.id));
  }

  async createGroup(command: UserGroupCreateCommand): Promise<boolean> {
    return this.runCommand(async () => {
      const created = await firstValueFrom(this.api.create(command));
      await this.load();
      await this.selectGroup(created.id);
      return 'Kullanıcı grubu oluşturuldu.';
    });
  }

  async updateGroup(id: number, command: UserGroupUpdateCommand): Promise<boolean> {
    return this.runCommand(() => firstValueFrom(this.api.update(id, command)));
  }

  async removeGroup(id: number): Promise<boolean> {
    const ok = await this.runCommand(() => firstValueFrom(this.api.remove(id)));
    if (ok && this._selectedGroupId() === id) {
      this._selectedGroupId.set(null);
      this.resetDetail();
    }
    return ok;
  }

  async addMember(userId: number, departmentId: number): Promise<boolean> {
    const groupId = this._selectedGroupId();
    if (groupId === null) {
      return false;
    }

    return this.runCommand(() =>
      firstValueFrom(this.api.addMember(groupId, { userId, departmentId })),
    );
  }

  async removeMember(userId: number, departmentId: number): Promise<boolean> {
    const groupId = this._selectedGroupId();
    if (groupId === null) {
      return false;
    }

    return this.runCommand(() =>
      firstValueFrom(this.api.removeMember(groupId, userId, departmentId)),
    );
  }

  private async runCommand(action: () => Promise<string>): Promise<boolean> {
    this._saving.set(true);
    this._feedback.set(null);

    try {
      const message = await action();
      await this.load();
      this._feedback.set({ severity: 'success', text: message });
      return true;
    } catch (error) {
      this._feedback.set({ severity: 'error', text: toMessage(error) });
      return false;
    } finally {
      this._saving.set(false);
    }
  }
}

/** Taslak ile kayıtlı küme farklı mı? Sıra önemsiz. */
function differs(draft: readonly number[], saved: readonly IdName[]): boolean {
  if (draft.length !== saved.length) {
    return true;
  }

  const savedIds = new Set(saved.map((item) => item.id));
  return draft.some((id) => !savedIds.has(id));
}

function toMessage(error: unknown): string {
  return error instanceof ApiFailure ? error.message : 'Beklenmeyen bir hata oluştu.';
}
