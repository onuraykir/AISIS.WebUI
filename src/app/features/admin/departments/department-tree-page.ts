import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ConfirmationService } from 'primeng/api';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Skeleton } from 'primeng/skeleton';
import { Tooltip } from 'primeng/tooltip';

import { HasAction } from '@shared/directives/has-action';
import { AdminToolbar } from '../shared/admin-toolbar/admin-toolbar';
import { DepartmentTreeStore } from './data-access/department-tree.store';
import {
  DEPARTMENT_LEVEL_LABELS,
  DEPARTMENT_TYPE_LABELS,
  DepartmentTreeNode,
  DepartmentType,
} from './data-access/department.models';
import { DepartmentFormDialog, DepartmentFormValue } from './ui/department-form-dialog';

/**
 * Birim Ağacı ekranı (akıllı bileşen).
 *
 * Solda ağaç, sağda seçili birimin künyesi ve taşıma. Modül Ağacı ekranıyla aynı
 * iskelet — iki ağaç iki farklı dille anlatılmasın.
 *
 * Üç şeridin (öğrenci / akademik / idari) tek buluşma noktası burasıdır; sayaçlar
 * yalnızca AÇIK bağları sayar, "bu birimde kaç öğrenci var" sorusunun cevabı
 * geçmiş kayıtları içermemeli.
 */
@Component({
  selector: 'app-department-tree-page',
  imports: [
    FormsModule,
    ConfirmDialog,
    IconField,
    InputIcon,
    InputText,
    Message,
    Select,
    Skeleton,
    Tooltip,
    HasAction,
    AdminToolbar,
    DepartmentFormDialog,
  ],
  providers: [DepartmentTreeStore, ConfirmationService],
  templateUrl: './department-tree-page.html',
  styleUrl: './department-tree-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DepartmentTreePage implements OnInit {
  private readonly confirmation = inject(ConfirmationService);

  protected readonly store = inject(DepartmentTreeStore);

  protected readonly dialogOpen = signal(false);
  protected readonly departmentInDialog = signal<DepartmentTreeNode | null>(null);

  /** Taşıma kutusundaki seçili hedef; null = kök. */
  protected readonly moveTarget = signal<number | null>(null);

  protected readonly selected = this.store.selected;

  /** Yeni kayıt diyaloğundaki üst birim seçenekleri. */
  protected readonly parentOptions = computed(() => [
    { id: null as number | null, label: 'Kök birim (üstü yok)' },
    ...this.store.rows().map((row) => ({ id: row.node.id as number | null, label: row.node.name })),
  ]);

  /** Seçili birimin taşınabileceği hedefler; kendisi ve alt ağacı hariç. */
  protected readonly moveOptions = computed(() => {
    const node = this.selected();
    return node ? this.store.moveTargets(node) : [];
  });

  protected readonly moveChanged = computed(
    () => this.moveTarget() !== (this.selected()?.parentDepartmentId ?? null),
  );

  /** Silme neden engelli? Boşsa serbest. */
  protected readonly deleteBlockedReason = computed<string | null>(() => {
    const node = this.selected();
    if (!node) {
      return null;
    }

    if (node.subDepartments.length > 0) {
      return `${node.subDepartments.length} alt birimi var. Önce onları taşıyın veya silin.`;
    }

    const blockers: string[] = [];
    if (node.studentCount > 0) blockers.push(`${node.studentCount} öğrenci`);
    if (node.instructorCount > 0) blockers.push(`${node.instructorCount} öğretim elemanı`);
    if (node.staffCount > 0) blockers.push(`${node.staffCount} idari görev`);
    if (node.courseCount > 0) blockers.push(`${node.courseCount} ders`);
    if (node.userCount > 0) blockers.push(`${node.userCount} kullanıcı ataması`);

    return blockers.length > 0
      ? `Bağlı ${blockers.join(', ')} var. Silinemez; kapatmak için pasifleştirin.`
      : null;
  });

  ngOnInit(): void {
    void this.store.load();
  }

  protected reload(): void {
    void this.store.load();
  }

  protected onSearch(event: Event): void {
    this.store.search.set((event.target as HTMLInputElement).value);
  }

  protected select(node: DepartmentTreeNode): void {
    this.store.select(node.id);
    this.moveTarget.set(node.parentDepartmentId);
  }

  protected typeLabel(node: DepartmentTreeNode): string {
    return DEPARTMENT_TYPE_LABELS[node.type] ?? '—';
  }

  protected levelLabel(node: DepartmentTreeNode): string {
    return DEPARTMENT_LEVEL_LABELS[node.level] ?? '—';
  }

  protected isAcademic(node: DepartmentTreeNode): boolean {
    return node.type === DepartmentType.Academic;
  }

  /** Açık bağların toplamı; satırdaki tek rozet bunu gösterir. */
  protected memberCount(node: DepartmentTreeNode): number {
    return node.studentCount + node.instructorCount + node.staffCount;
  }

  // ── Komutlar ──

  protected openCreate(): void {
    this.departmentInDialog.set(null);
    this.dialogOpen.set(true);
  }

  protected openEdit(node: DepartmentTreeNode): void {
    this.departmentInDialog.set(node);
    this.dialogOpen.set(true);
  }

  protected async onDialogSave(value: DepartmentFormValue): Promise<void> {
    const editing = this.departmentInDialog();

    const ok = editing
      ? await this.store.update(editing.id, {
          name: value.name,
          type: value.type,
          level: value.level,
          isActive: value.isActive,
        })
      : await this.store.create({
          code: value.code,
          name: value.name,
          type: value.type,
          level: value.level,
          parentDepartmentId: value.parentDepartmentId,
        });

    if (ok) {
      this.dialogOpen.set(false);
    }
  }

  protected async applyMove(): Promise<void> {
    const node = this.selected();
    if (!node || !this.moveChanged()) {
      return;
    }

    await this.store.move(node.id, this.moveTarget());
  }

  protected confirmDelete(node: DepartmentTreeNode): void {
    this.confirmation.confirm({
      header: 'Birimi sil',
      message: `"${node.name}" birimi silinecek. Devam edilsin mi?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sil',
      rejectLabel: 'Vazgeç',
      acceptButtonStyleClass: 'p-button-danger p-button-sm',
      rejectButtonStyleClass: 'p-button-text p-button-sm',
      accept: () => void this.store.remove(node.id),
    });
  }
}
