import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiFailure } from '@core/api/api-result.model';
import { RoleAdminApi } from './role-admin.api';
import {
  MatrixModule,
  MatrixPage,
  RoleCreateCommand,
  RoleListItem,
  RolePermissionMatrix,
  RoleUpdateCommand,
} from './role.models';

export interface StoreFeedback {
  readonly severity: 'success' | 'error';
  readonly text: string;
}

/**
 * Rol yetkileri ekranının durumu.
 *
 * Yetki EYLEM seviyesinde verilir (sayfa -> işlem -> eylem); taslak kümesi de
 * eylem kimliklerini tutar. Üstteki seviyelerin kutucukları yalnızca toplu
 * seçim kısayoludur, ayrı bir kayda karşılık gelmez.
 *
 * Matris TASLAK üzerinden çalışır: kutucuklar `draft` kümesini değiştirir,
 * sunucuya ancak "Kaydet" ile gidilir. Her tıklamada istek atmak hem gürültülü
 * hem de yarım kalmış bir yetki kümesi bırakabilirdi.
 *
 * Kaydetme REPLACE semantiğinde: sunucuya kümenin TAMAMI gönderilir, farkı
 * sunucu hesaplar (bkz. RoleCommandService.SetPermissionsAsync).
 */
@Injectable()
export class RoleAdminStore {
  private readonly api = inject(RoleAdminApi);

  private readonly _roles = signal<readonly RoleListItem[]>([]);
  private readonly _matrix = signal<RolePermissionMatrix | null>(null);
  private readonly _selectedRoleId = signal<number | null>(null);

  /** Sunucudan gelen ilk hâl; "değişiklik var mı" bununla karşılaştırılır. */
  private readonly _initialGrants = signal<ReadonlySet<number>>(new Set<number>());
  private readonly _draft = signal<ReadonlySet<number>>(new Set<number>());

  private readonly _loading = signal(false);
  private readonly _matrixLoading = signal(false);
  private readonly _saving = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _feedback = signal<StoreFeedback | null>(null);

  readonly roles = this._roles.asReadonly();
  readonly matrix = this._matrix.asReadonly();
  readonly selectedRoleId = this._selectedRoleId.asReadonly();
  readonly draft = this._draft.asReadonly();

  readonly loading = this._loading.asReadonly();
  readonly matrixLoading = this._matrixLoading.asReadonly();
  readonly saving = this._saving.asReadonly();
  readonly error = this._error.asReadonly();
  readonly feedback = this._feedback.asReadonly();

  readonly selectedRole = computed<RoleListItem | null>(() => {
    const id = this._selectedRoleId();
    return id === null ? null : (this._roles().find((role) => role.id === id) ?? null);
  });

  readonly grantTotal = computed(() =>
    this._roles().reduce((total, role) => total + role.permissionCount, 0),
  );

  /** Taslakta işaretli izin sayısı. */
  readonly draftCount = computed(() => this._draft().size);

  /** Eklenen ve kaldırılan izin sayısı — kaydetme düğmesinde gösterilir. */
  readonly pendingChanges = computed(() => {
    const initial = this._initialGrants();
    const draft = this._draft();

    let added = 0;
    let removed = 0;

    for (const id of draft) {
      if (!initial.has(id)) added++;
    }
    for (const id of initial) {
      if (!draft.has(id)) removed++;
    }

    return { added, removed, total: added + removed };
  });

  readonly isDirty = computed(() => this.pendingChanges().total > 0);

  /** Matristeki tüm eylem kimlikleri; "tümünü seç" için. */
  readonly allActionIds = computed<number[]>(() => {
    const matrix = this._matrix();
    return matrix ? collectPages(matrix.modules).flatMap((page) => pageActionIds(page)) : [];
  });

  clearFeedback(): void {
    this._feedback.set(null);
  }

  isGranted(operationActionId: number): boolean {
    return this._draft().has(operationActionId);
  }

  async load(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const roles = await firstValueFrom(this.api.getRoles());
      this._roles.set(roles);

      const current = this._selectedRoleId();
      if (current !== null && roles.some((role) => role.id === current)) {
        await this.loadMatrix(current);
      } else {
        this._selectedRoleId.set(null);
        this.resetMatrix();
      }
    } catch (error) {
      this._roles.set([]);
      this.resetMatrix();
      this._error.set(toMessage(error));
    } finally {
      this._loading.set(false);
    }
  }

async selectRole(roleId: number): Promise<void> {
    this._selectedRoleId.set(roleId);
    await this.loadMatrix(roleId);
  }

  private async loadMatrix(roleId: number): Promise<void> {
this._matrixLoading.set(true);

    try {
      this.applyMatrix(await firstValueFrom(this.api.getMatrix(roleId)));
    } catch (error) {
      this.resetMatrix();
      this._feedback.set({ severity: 'error', text: toMessage(error) });
    } finally {
      this._matrixLoading.set(false);
    }
  }

  private applyMatrix(matrix: RolePermissionMatrix | null): void {
    this._matrix.set(matrix);

    const granted = new Set<number>();
    if (matrix) {
      for (const page of collectPages(matrix.modules)) {
        for (const operation of page.operations) {
          for (const action of operation.actions) {
            if (action.isGranted) {
              granted.add(action.operationActionId);
            }
          }
        }
      }
    }

    this._initialGrants.set(granted);
    this._draft.set(new Set(granted));
  }

  private resetMatrix(): void {
    this._matrix.set(null);
    this._initialGrants.set(new Set<number>());
    this._draft.set(new Set<number>());
  }

  // ── Taslak düzenleme (sunucuya gitmez) ──

  toggle(operationActionId: number): void {
    this._draft.update((current) => {
      const next = new Set(current);
      if (next.has(operationActionId)) {
        next.delete(operationActionId);
      } else {
        next.add(operationActionId);
      }
      return next;
    });
  }

  /** Bir kümeyi topluca işaretler veya kaldırır (işlem / sayfa / modül başlığı). */
  setMany(operationActionIds: readonly number[], granted: boolean): void {
    this._draft.update((current) => {
      const next = new Set(current);
      for (const id of operationActionIds) {
        if (granted) {
          next.add(id);
        } else {
          next.delete(id);
        }
      }
      return next;
    });
  }

  selectAll(): void {
    this._draft.set(new Set(this.allActionIds()));
  }

  clearAll(): void {
    this._draft.set(new Set<number>());
  }

  /** Kaydedilmemiş değişiklikleri atar. */
  revert(): void {
    this._draft.set(new Set(this._initialGrants()));
  }

  // ── Komutlar ──

  async savePermissions(): Promise<boolean> {
    const roleId = this._selectedRoleId();
    if (roleId === null) {
      return false;
    }

    return this.runCommand(async () => {
      const message = await firstValueFrom(
        this.api.setPermissions(roleId, { operationActionIds: [...this._draft()] }),
      );
      return message;
    });
  }

  async createRole(command: RoleCreateCommand): Promise<boolean> {
    return this.runCommand(async () => {
      const created = await firstValueFrom(this.api.create(command));
      await this.load();
      await this.selectRole(created.id);
      return 'Rol oluşturuldu.';
    });
  }

  async updateRole(id: number, command: RoleUpdateCommand): Promise<boolean> {
    return this.runCommand(() => firstValueFrom(this.api.update(id, command)));
  }

  async removeRole(id: number): Promise<boolean> {
    const ok = await this.runCommand(() => firstValueFrom(this.api.remove(id)));
    if (ok && this._selectedRoleId() === id) {
      this._selectedRoleId.set(null);
      this.resetMatrix();
    }
    return ok;
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

/** Bir sayfadaki tüm eylem kimlikleri (işlemler düzleştirilmiş). */
export function pageActionIds(page: MatrixPage): number[] {
  return page.operations.flatMap((operation) =>
    operation.actions.map((action) => action.operationActionId),
  );
}

/** Ağaçtaki tüm sayfaları düz listeye indirir (ana modül + alt modüller). */
export function collectPages(modules: readonly MatrixModule[]): MatrixPage[] {
  const pages: MatrixPage[] = [];

  const walk = (list: readonly MatrixModule[]): void => {
    for (const module of list) {
      pages.push(...module.pages);
      walk(module.subModules);
    }
  };

  walk(modules);
  return pages;
}

function toMessage(error: unknown): string {
  return error instanceof ApiFailure ? error.message : 'Beklenmeyen bir hata oluştu.';
}
