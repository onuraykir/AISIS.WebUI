import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';

import { ConfirmationService } from 'primeng/api';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Skeleton } from 'primeng/skeleton';
import { Tooltip } from 'primeng/tooltip';

import { HasAction } from '@shared/directives/has-action';
import { AdminToolbar } from '../shared/admin-toolbar/admin-toolbar';
import { NameDialog } from '../shared/name-dialog/name-dialog';
import { RoleAdminStore, pageActionIds } from './data-access/role-admin.store';
import {
  MatrixModule,
  MatrixOperation,
  MatrixPage,
  RoleListItem,
} from './data-access/role.models';

/** Matriste çizilen tek satır: sayfa + hangi modülün altında olduğu. */
interface MatrixRow {
  readonly page: MatrixPage;
  readonly moduleLabel: string;
}

/**
 * Roller ekranı (akıllı bileşen).
 *
 * Solda roller, sağda seçili rolün yetki matrisi. Matris TASLAK üzerinde
 * çalışır: kutucuklar anında sunucuya gitmez, "Kaydet" ile tek seferde
 * gönderilir — yarım kalmış bir yetki kümesi oluşmasın diye.
 */
@Component({
  selector: 'app-roles-page',
  imports: [
    ConfirmDialog,
    IconField,
    InputIcon,
    InputText,
    Message,
    Skeleton,
    Tooltip,
    HasAction,
    AdminToolbar,
    NameDialog,
  ],
  providers: [RoleAdminStore, ConfirmationService],
  templateUrl: './roles-page.html',
  styleUrl: './roles-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RolesPage implements OnInit {
  private readonly confirmation = inject(ConfirmationService);

  protected readonly store = inject(RoleAdminStore);

  protected readonly dialogOpen = signal(false);
  protected readonly roleInDialog = signal<RoleListItem | null>(null);

  protected readonly search = signal('');

  /** Matris satırları: modül ağacı düzleştirilir, arama uygulanır. */
  protected readonly rows = computed<MatrixRow[]>(() => {
    const matrix = this.store.matrix();
    if (!matrix) {
      return [];
    }

    const needle = this.search().trim().toLocaleLowerCase('tr-TR');
    const rows: MatrixRow[] = [];

    const walk = (modules: readonly MatrixModule[], prefix: string): void => {
      for (const module of modules) {
        const label = prefix ? `${prefix} › ${module.name}` : module.name;

        for (const page of module.pages) {
          rows.push({ page, moduleLabel: label });
        }

        walk(module.subModules, label);
      }
    };

    walk(matrix.modules, '');

    if (needle.length === 0) {
      return rows;
    }

    return rows.filter(
      (row) =>
        row.page.pageName.toLocaleLowerCase('tr-TR').includes(needle) ||
        row.page.route.toLocaleLowerCase('tr-TR').includes(needle) ||
        row.moduleLabel.toLocaleLowerCase('tr-TR').includes(needle),
    );
  });

  /** Satırları modül etiketine göre gruplar; başlık tekrar etmesin. */
  protected readonly groups = computed(() => {
    const grouped = new Map<string, MatrixPage[]>();

    for (const row of this.rows()) {
      const bucket = grouped.get(row.moduleLabel);
      if (bucket) {
        bucket.push(row.page);
      } else {
        grouped.set(row.moduleLabel, [row.page]);
      }
    }

    return [...grouped.entries()].map(([label, pages]) => ({ label, pages }));
  });

  protected readonly matrixEmpty = computed(
    () => this.store.matrix() !== null && this.rows().length === 0,
  );

  ngOnInit(): void {
    void this.store.load();
  }

  protected reload(): void {
    void this.store.load();
  }

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected selectRole(role: RoleListItem): void {
    if (this.store.isDirty() && !confirmDiscard()) {
      return;
    }
    void this.store.selectRole(role.id);
  }

  // ── Matris ──
  //
  // Yetki EYLEM seviyesinde verilir. Sayfa ve işlem kutucukları yalnızca toplu
  // seçim kısayolu: altındaki eylemlerin tamamını işaretler veya kaldırır.

  protected pageIds(page: MatrixPage): number[] {
    return pageActionIds(page);
  }

  protected operationIds(operation: MatrixOperation): number[] {
    return operation.actions.map((action) => action.operationActionId);
  }

  protected pageAllGranted(page: MatrixPage): boolean {
    const ids = this.pageIds(page);
    return ids.length > 0 && ids.every((id) => this.store.isGranted(id));
  }

  protected pageSomeGranted(page: MatrixPage): boolean {
    return this.pageIds(page).some((id) => this.store.isGranted(id));
  }

  protected togglePage(page: MatrixPage): void {
    this.store.setMany(this.pageIds(page), !this.pageAllGranted(page));
  }

  protected operationAllGranted(operation: MatrixOperation): boolean {
    const ids = this.operationIds(operation);
    return ids.length > 0 && ids.every((id) => this.store.isGranted(id));
  }

  protected operationSomeGranted(operation: MatrixOperation): boolean {
    return this.operationIds(operation).some((id) => this.store.isGranted(id));
  }

  protected toggleOperation(operation: MatrixOperation): void {
    this.store.setMany(this.operationIds(operation), !this.operationAllGranted(operation));
  }

  /** İşlem başlığındaki durum etiketi: hepsi / kısmi / yok. */
  protected operationState(operation: MatrixOperation): string {
    if (this.operationAllGranted(operation)) {
      return 'hepsi';
    }
    return this.operationSomeGranted(operation) ? 'kısmi' : 'yok';
  }

  protected toggleGroup(pages: readonly MatrixPage[]): void {
    const ids = pages.flatMap((page) => this.pageIds(page));
    const allGranted = ids.every((id) => this.store.isGranted(id));
    this.store.setMany(ids, !allGranted);
  }

  protected groupAllGranted(pages: readonly MatrixPage[]): boolean {
    return pages.every((page) => this.pageAllGranted(page));
  }

  /** Uç noktası olmayan eylem UNAVAILABLE görünür; yönetici neyi verdiğini görmeli. */
  protected methodLabel(httpMethod: string | null): string {
    return httpMethod ?? 'UNAVAILABLE';
  }

  protected methodClass(httpMethod: string | null): string {
    return `method--${httpMethod?.toLowerCase() ?? 'unavailable'}`;
  }

  protected async save(): Promise<void> {
    await this.store.savePermissions();
  }

  // ── Rol komutları ──

  protected openCreate(): void {
    this.roleInDialog.set(null);
    this.dialogOpen.set(true);
  }

  protected openEdit(role: RoleListItem): void {
    this.roleInDialog.set(role);
    this.dialogOpen.set(true);
  }

  protected async onDialogSave(name: string): Promise<void> {
    const editing = this.roleInDialog();

    const ok = editing
      ? await this.store.updateRole(editing.id, { name })
      : await this.store.createRole({ name });

    if (ok) {
      this.dialogOpen.set(false);
    }
  }

  protected confirmDelete(role: RoleListItem): void {
    this.confirmation.confirm({
      header: 'Rolü sil',
      message: `"${role.name}" rolü ve ${role.permissionCount} yetkisi silinecek. Devam edilsin mi?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sil',
      rejectLabel: 'Vazgeç',
      acceptButtonStyleClass: 'p-button-danger p-button-sm',
      rejectButtonStyleClass: 'p-button-text p-button-sm',
      accept: () => void this.store.removeRole(role.id),
    });
  }

  protected deleteBlockedReason(role: RoleListItem): string | null {
    return role.groupCount > 0
      ? `${role.groupCount} kullanıcı grubuna atanmış. Önce grup bağlarını kaldırın.`
      : null;
  }
}

/** Kaydedilmemiş değişiklik varken rol değiştirmeden önce onay ister. */
function confirmDiscard(): boolean {
  return globalThis.confirm(
    'Kaydedilmemiş yetki değişiklikleriniz var. Rol değiştirilirse bu değişiklikler kaybolacak. Devam edilsin mi?',
  );
}
