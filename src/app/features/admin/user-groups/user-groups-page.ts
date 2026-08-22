import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ConfirmationService } from 'primeng/api';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Skeleton } from 'primeng/skeleton';
import { Tooltip } from 'primeng/tooltip';

import { IdName } from '@core/api/api-result.model';
import { HasAction } from '@shared/directives/has-action';
import { AdminToolbar } from '../shared/admin-toolbar/admin-toolbar';
import { NameDialog } from '../shared/name-dialog/name-dialog';
import { ScopeKind, UserGroupAdminStore } from './data-access/user-group-admin.store';
import { GroupMember, UserGroupListItem } from './data-access/user-group.models';
import { ScopePicker } from './ui/scope-picker';

/**
 * Kullanıcı Grupları ekranı (akıllı bileşen).
 *
 * Grup, yetkinin iki eksenini birleştirir: NE (ana modüller) ve NEREDE
 * (birimler). Roller izni verir, kapsam onu sınırlar. Üyelik ise ikisinin
 * kesişiminde durur — bu yüzden bir birim, üyesi varken kapsamdan çıkarılamaz.
 */
@Component({
  selector: 'app-user-groups-page',
  imports: [
    FormsModule,
    ConfirmDialog,
    Message,
    Select,
    Skeleton,
    Tooltip,
    HasAction,
    AdminToolbar,
    NameDialog,
    ScopePicker,
  ],
  providers: [UserGroupAdminStore, ConfirmationService],
  templateUrl: './user-groups-page.html',
  styleUrl: './user-groups-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserGroupsPage implements OnInit {
  private readonly confirmation = inject(ConfirmationService);

  protected readonly store = inject(UserGroupAdminStore);

  protected readonly dialogOpen = signal(false);
  protected readonly groupInDialog = signal<UserGroupListItem | null>(null);

  /** Üye ekleme formu. */
  protected readonly newMemberUserId = signal<number | null>(null);
  protected readonly newMemberDepartmentId = signal<number | null>(null);

  /**
   * Üye eklerken yalnızca grubun KAPSAMINDAKİ birimler seçilebilir —
   * sunucu da başkasını reddeder.
   */
  protected readonly memberDepartmentOptions = computed<IdName[]>(() => {
    const inScope = new Set(this.store.departmentDraft());
    return this.store.lookups().departments.filter((department) => inScope.has(department.id));
  });

  /** p-select değiştirilebilir dizi ister; sözleşme tipleri readonly. */
  protected readonly userOptions = computed<IdName[]>(() => [...this.store.lookups().users]);
  protected readonly moduleOptions = computed<IdName[]>(() => [...this.store.lookups().modules]);
  protected readonly departmentOptions = computed<IdName[]>(() => [
    ...this.store.lookups().departments,
  ]);
  protected readonly roleOptions = computed<IdName[]>(() => [...this.store.lookups().roles]);

  protected readonly canAddMember = computed(
    () => this.newMemberUserId() !== null && this.newMemberDepartmentId() !== null,
  );

  protected readonly departmentBlockedIds = computed<number[]>(() => {
    const blockedNames = new Set(this.store.departmentRemovalBlocked());
    return this.store
      .members()
      .filter((member) => blockedNames.has(member.departmentName))
      .map((member) => member.departmentId);
  });

  ngOnInit(): void {
    void this.store.load();
  }

  protected reload(): void {
    void this.store.load();
  }

  protected selectGroup(group: UserGroupListItem): void {
    void this.store.selectGroup(group.id);
    this.newMemberUserId.set(null);
    this.newMemberDepartmentId.set(null);
  }

  // ── Kapsam ──

  protected onScopeChange(kind: ScopeKind, ids: number[]): void {
    this.store.setDraft(kind, ids);
  }

  protected async saveScope(kind: ScopeKind): Promise<void> {
    await this.store.saveScope(kind);
  }

  protected revertScope(kind: ScopeKind): void {
    this.store.revert(kind);
  }

  // ── Üyelik ──

  protected async addMember(): Promise<void> {
    const userId = this.newMemberUserId();
    const departmentId = this.newMemberDepartmentId();

    if (userId === null || departmentId === null) {
      return;
    }

    const ok = await this.store.addMember(userId, departmentId);
    if (ok) {
      this.newMemberUserId.set(null);
      this.newMemberDepartmentId.set(null);
    }
  }

  protected confirmRemoveMember(member: GroupMember): void {
    this.confirmation.confirm({
      header: 'Üyeliği kaldır',
      message: `"${member.userName}" kullanıcısının "${member.departmentName}" birimindeki üyeliği kaldırılacak. Devam edilsin mi?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Kaldır',
      rejectLabel: 'Vazgeç',
      acceptButtonStyleClass: 'p-button-danger p-button-sm',
      rejectButtonStyleClass: 'p-button-text p-button-sm',
      accept: () => void this.store.removeMember(member.userId, member.departmentId),
    });
  }

  // ── Grup komutları ──

  protected openCreate(): void {
    this.groupInDialog.set(null);
    this.dialogOpen.set(true);
  }

  protected openEdit(group: UserGroupListItem): void {
    this.groupInDialog.set(group);
    this.dialogOpen.set(true);
  }

  protected async onDialogSave(name: string): Promise<void> {
    const editing = this.groupInDialog();

    const ok = editing
      ? await this.store.updateGroup(editing.id, { name })
      : await this.store.createGroup({ name });

    if (ok) {
      this.dialogOpen.set(false);
    }
  }

  protected confirmDelete(group: UserGroupListItem): void {
    this.confirmation.confirm({
      header: 'Grubu sil',
      message: `"${group.name}" grubu ve tüm kapsam bağları silinecek. Devam edilsin mi?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sil',
      rejectLabel: 'Vazgeç',
      acceptButtonStyleClass: 'p-button-danger p-button-sm',
      rejectButtonStyleClass: 'p-button-text p-button-sm',
      accept: () => void this.store.removeGroup(group.id),
    });
  }

  protected deleteBlockedReason(group: UserGroupListItem): string | null {
    return group.memberCount > 0
      ? `${group.memberCount} üyesi var. Önce üyelikleri kaldırın.`
      : null;
  }
}
