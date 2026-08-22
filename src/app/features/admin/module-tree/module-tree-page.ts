import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ConfirmationService } from 'primeng/api';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Skeleton } from 'primeng/skeleton';
import { Tooltip } from 'primeng/tooltip';

import { HasAction } from '@shared/directives/has-action';
import { AdminToolbar } from '../shared/admin-toolbar/admin-toolbar';
import { ModuleTreeStore } from './data-access/module-tree.store';
import { ModuleTreeNode } from './data-access/module.models';
import { ModuleFormDialog, ModuleFormValue } from './ui/module-form-dialog';
import { ModuleNodeRow } from './ui/module-node-row';

/** Taşıma listesindeki bir seçenek. */
interface MoveOption {
  readonly label: string;
  readonly value: number | null;
}

/**
 * Modül Ağacı ekranı (akıllı bileşen).
 *
 * Store'u kendi seviyesinde sağlar: ekrandan çıkıldığında durum da gider,
 * uygulama genelinde artık bir modül ağacı taşınmaz.
 *
 * İki bölme: solda ağaç (yapıyı değiştirme), sağda seçili düğümün künyesi ve
 * konumu. Düzenleme diyalogda; böylece ağaçtaki bağlam kaybolmaz.
 */
@Component({
  selector: 'app-module-tree-page',
  imports: [
    FormsModule,
    ConfirmDialog,
    Message,
    Select,
    Skeleton,
    Tooltip,
    HasAction,
    AdminToolbar,
    ModuleNodeRow,
    ModuleFormDialog,
  ],
  providers: [ModuleTreeStore, ConfirmationService],
  templateUrl: './module-tree-page.html',
  styleUrl: './module-tree-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModuleTreePage implements OnInit {
  private readonly confirmation = inject(ConfirmationService);

  protected readonly store = inject(ModuleTreeStore);

  /** Kapatılmış ana modüllerin id'leri. Varsayılan: hepsi açık. */
  private readonly collapsed = signal<ReadonlySet<number>>(new Set<number>());

  protected readonly dialogOpen = signal(false);
  protected readonly dialogModule = signal<ModuleTreeNode | null>(null);
  protected readonly dialogParent = signal<ModuleTreeNode | null>(null);

  /** Taşıma kutusundaki seçili hedef. */
  protected readonly moveTarget = signal<number | null>(null);

  protected readonly selected = this.store.selected;

  protected readonly moveOptions = computed<MoveOption[]>(() => {
    const node = this.selected();
    if (!node) {
      return [];
    }

    const options: MoveOption[] = [{ label: 'Ana modül yap (en üst seviye)', value: null }];

    for (const root of this.store.moveTargets(node)) {
      options.push({ label: `${root.name} altına`, value: root.id });
    }

    return options;
  });

  /** Taşıma neden yapılamıyor? Boşsa yapılabilir. */
  protected readonly moveBlockedReason = computed<string | null>(() => {
    const node = this.selected();
    if (!node) {
      return null;
    }

    if (node.subModules.length > 0) {
      return 'Altında alt modül bulunan bir modül taşınamaz. Önce alt modülleri taşıyın.';
    }

    if (node.isBoundToGroups && this.moveTarget() !== null) {
      return 'Kullanıcı gruplarının kapsamındaki bir modül alt modül yapılamaz.';
    }

    return null;
  });

  protected readonly deleteBlockedReason = computed<string | null>(() => {
    const node = this.selected();
    if (!node) {
      return null;
    }

    if (node.subModules.length > 0) {
      return 'Altında alt modül var.';
    }

    if (node.pageCount > 0) {
      return 'Altında sayfa var. Önce sayfaları havuza alın.';
    }

    if (node.isBoundToGroups) {
      return 'Bir kullanıcı grubunun kapsamında.';
    }

    return null;
  });

  ngOnInit(): void {
    void this.store.load();
  }

  // ── Ağaç ──

  protected isExpanded(node: ModuleTreeNode): boolean {
    return !this.collapsed().has(node.id);
  }

  protected toggle(node: ModuleTreeNode): void {
    this.collapsed.update((current) => {
      const next = new Set(current);
      if (next.has(node.id)) {
        next.delete(node.id);
      } else {
        next.add(node.id);
      }
      return next;
    });
  }

  protected select(node: ModuleTreeNode): void {
    this.store.select(node.id);
    this.moveTarget.set(node.parentModuleId);
  }

  protected canMoveUp(node: ModuleTreeNode): boolean {
    const siblings = this.store.siblingsOf(node);
    return siblings.length > 1 && siblings[0]?.id !== node.id;
  }

  protected canMoveDown(node: ModuleTreeNode): boolean {
    const siblings = this.store.siblingsOf(node);
    return siblings.length > 1 && siblings.at(-1)?.id !== node.id;
  }

  protected shiftUp(node: ModuleTreeNode): void {
    void this.store.shift(node, -1);
  }

  protected shiftDown(node: ModuleTreeNode): void {
    void this.store.shift(node, 1);
  }

  // ── Diyalog ──

  protected openCreateRoot(): void {
    this.dialogModule.set(null);
    this.dialogParent.set(null);
    this.dialogOpen.set(true);
  }

  protected openCreateChild(parent: ModuleTreeNode): void {
    this.dialogModule.set(null);
    this.dialogParent.set(parent);
    this.dialogOpen.set(true);
  }

  protected openEdit(node: ModuleTreeNode): void {
    this.dialogModule.set(node);
    this.dialogParent.set(null);
    this.dialogOpen.set(true);
  }

  protected async onDialogSave(value: ModuleFormValue): Promise<void> {
    const editing = this.dialogModule();

    const ok = editing
      ? await this.store.update(editing.id, {
          name: value.name,
          icon: value.icon,
          description: value.description,
          isActive: value.isActive,
        })
      : await this.store.create({
          code: value.code,
          name: value.name,
          icon: value.icon,
          description: value.description,
          parentModuleId: this.dialogParent()?.id ?? null,
          isActive: value.isActive,
        });

    if (ok) {
      this.dialogOpen.set(false);
    }
  }

  // ── Konum ve silme ──

  protected async applyMove(): Promise<void> {
    const node = this.selected();
    if (!node || this.moveBlockedReason()) {
      return;
    }

    await this.store.move(node.id, this.moveTarget());
  }

  protected confirmDelete(node: ModuleTreeNode): void {
    this.confirmation.confirm({
      header: 'Modülü sil',
      message: `"${node.name}" modülü silinecek. Bu işlem menüyü etkiler. Devam edilsin mi?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sil',
      rejectLabel: 'Vazgeç',
      acceptButtonStyleClass: 'p-button-danger p-button-sm',
      rejectButtonStyleClass: 'p-button-text p-button-sm',
      accept: () => void this.store.remove(node.id),
    });
  }

  protected reload(): void {
    void this.store.load();
  }
}
