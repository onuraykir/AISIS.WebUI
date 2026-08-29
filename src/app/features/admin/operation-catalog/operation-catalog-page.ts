import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';

import { ConfirmationService } from 'primeng/api';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Skeleton } from 'primeng/skeleton';
import { Tooltip } from 'primeng/tooltip';

import { HasAction } from '@shared/directives/has-action';
import { PageListItem } from '../page-catalog/data-access/page.models';
import { AdminToolbar } from '../shared/admin-toolbar/admin-toolbar';
import { CodeNameDialog, CodeNameValue } from '../shared/code-name-dialog/code-name-dialog';
import { OperationAdminStore, PageFilter } from './data-access/operation-admin.store';
import { ActionDefinition, OperationAction, PageOperation } from './data-access/operation.models';
import { ActionDictionaryDialog } from './ui/action-dictionary-dialog';
import { OperationActionDialog, OperationActionFormValue } from './ui/operation-action-dialog';

interface FilterOption {
  readonly value: PageFilter;
  readonly label: string;
}

/**
 * İşlem Kataloğu ekranı (akıllı bileşen).
 *
 * Okunuşu hiyerarşinin kendisidir: SAYFA → İŞLEM → EYLEM. Solda sayfalar,
 * sağda seçili sayfanın işlemleri; her işlemin altında eylemleri ve
 * bağlanabilir eylem havuzu.
 *
 * İşlemi yönetici tanımlar — sayfanın bir bölümü gibi ("Grid İşlemleri",
 * "Eşik Yönetimi"). Eylemler ortak sözlükten seçilir, uç nokta eylemde durur.
 * Yetki de en alttaki eyleme verilir; arayüzde düğmeler `*appHasAction` ile
 * işlem koduna göre basılır.
 *
 * Ortak eylem sözlüğü ana akışta değil, üst çubuktaki diyalogda.
 */
@Component({
  selector: 'app-operation-catalog-page',
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
    CodeNameDialog,
    ActionDictionaryDialog,
    OperationActionDialog,
  ],
  providers: [OperationAdminStore, ConfirmationService],
  templateUrl: './operation-catalog-page.html',
  styleUrl: './operation-catalog-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OperationCatalogPage implements OnInit {
  private readonly confirmation = inject(ConfirmationService);

  protected readonly store = inject(OperationAdminStore);

  protected readonly dictionaryOpen = signal(false);

  protected readonly definitionDialogOpen = signal(false);
  protected readonly definitionInDialog = signal<ActionDefinition | null>(null);

  protected readonly operationDialogOpen = signal(false);
  protected readonly operationInDialog = signal<PageOperation | null>(null);

  protected readonly actionDialogOpen = signal(false);
  protected readonly actionInDialog = signal<OperationAction | null>(null);

  /**
   * Eylem bağlanacak işlem. Nesne değil KİMLİK tutuluyor: her yazma sonrası
   * liste tazeleniyor ve elde kalan nesne bayatlardı.
   */
  protected readonly actionTargetOperationId = signal<number | null>(null);
  protected readonly actionPreselect = signal<number | null>(null);

  protected readonly selected = this.store.selectedPage;

  protected readonly filterOptions: readonly FilterOption[] = [
    { value: 'all', label: 'Hepsi' },
    { value: 'missing', label: 'İşlemsiz' },
    { value: 'pool', label: 'Havuz' },
  ];

  /** Diyaloğun hedefi, seçili sayfanın güncel hâlinden çözülür. */
  protected readonly actionTargetOperation = computed<PageOperation | null>(() => {
    const id = this.actionTargetOperationId();
    return id === null
      ? null
      : (this.selected()?.operations.find((operation) => operation.id === id) ?? null);
  });

  /** Hedef işleme hâlâ bağlanabilecek eylemler; diyalog bunu havuz olarak gösterir. */
  protected readonly actionDialogAvailable = computed(() => {
    const operation = this.actionTargetOperation();
    return operation ? this.store.availableFor(operation) : [];
  });

  protected readonly definitionDialogValue = computed<CodeNameValue | null>(() => {
    const definition = this.definitionInDialog();
    return definition
      ? {
          code: definition.code,
          name: definition.name,
          description: definition.description,
          isActive: true,
        }
      : null;
  });

  protected readonly operationDialogValue = computed<CodeNameValue | null>(() => {
    const operation = this.operationInDialog();
    return operation
      ? {
          code: operation.code,
          name: operation.name,
          description: operation.description,
          isActive: operation.isActive,
        }
      : null;
  });

  ngOnInit(): void {
    void this.store.load();
  }

  protected reload(): void {
    void this.store.load();
  }

  // ── Sol liste ──

  protected setFilter(value: PageFilter): void {
    this.store.filter.set(value);
  }

  protected onSearch(event: Event): void {
    this.store.search.set((event.target as HTMLInputElement).value);
  }

  protected select(page: PageListItem): void {
    this.store.select(page.id);
  }

  // ── Ortak eylem sözlüğü (diyalog) ──

  protected openDictionary(): void {
    this.dictionaryOpen.set(true);
  }

  protected openCreateDefinition(): void {
    this.definitionInDialog.set(null);
    this.definitionDialogOpen.set(true);
  }

  protected openEditDefinition(definition: ActionDefinition): void {
    this.definitionInDialog.set(definition);
    this.definitionDialogOpen.set(true);
  }

  protected async onDefinitionSave(value: CodeNameValue): Promise<void> {
    const editing = this.definitionInDialog();

    const ok = editing
      ? await this.store.updateDefinition(editing.id, {
          name: value.name,
          description: value.description,
        })
      : await this.store.createDefinition({
          code: value.code,
          name: value.name,
          description: value.description,
        });

    if (ok) {
      this.definitionDialogOpen.set(false);
    }
  }

  protected confirmDeleteDefinition(definition: ActionDefinition): void {
    this.confirmation.confirm({
      header: 'Eylem tanımını sil',
      message: `"${definition.name}" eylem tanımı sözlükten silinecek. Devam edilsin mi?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sil',
      rejectLabel: 'Vazgeç',
      acceptButtonStyleClass: 'p-button-danger p-button-sm',
      rejectButtonStyleClass: 'p-button-text p-button-sm',
      accept: () => void this.store.removeDefinition(definition.id),
    });
  }

  protected shiftDefinition(event: { definition: ActionDefinition; direction: -1 | 1 }): void {
    void this.store.shiftDefinition(event.definition, event.direction);
  }

  // ── Sayfa işlemleri ──

  protected openCreateOperation(): void {
    this.operationInDialog.set(null);
    this.operationDialogOpen.set(true);
  }

  protected openEditOperation(operation: PageOperation): void {
    this.operationInDialog.set(operation);
    this.operationDialogOpen.set(true);
  }

  protected async onOperationSave(value: CodeNameValue): Promise<void> {
    const editing = this.operationInDialog();

    const ok = editing
      ? await this.store.updateOperation(editing.id, {
          name: value.name,
          description: value.description,
          isActive: value.isActive,
        })
      : await this.store.createOperation({
          code: value.code,
          name: value.name,
          description: value.description,
        });

    if (ok) {
      this.operationDialogOpen.set(false);
    }
  }

  protected confirmDeleteOperation(operation: PageOperation): void {
    this.confirmation.confirm({
      header: 'İşlemi sil',
      message: `"${operation.name}" işlemi ve ${operation.actions.length} eylemi silinecek. Devam edilsin mi?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sil',
      rejectLabel: 'Vazgeç',
      acceptButtonStyleClass: 'p-button-danger p-button-sm',
      rejectButtonStyleClass: 'p-button-text p-button-sm',
      accept: () => void this.store.removeOperation(operation.id),
    });
  }

  protected shiftOperationUp(operation: PageOperation): void {
    void this.store.shiftOperation(operation, -1);
  }

  protected shiftOperationDown(operation: PageOperation): void {
    void this.store.shiftOperation(operation, 1);
  }

  protected operationGrantCount(operation: PageOperation): number {
    return operation.actions.reduce((total, action) => total + action.grantCount, 0);
  }

  protected deleteOperationBlockedReason(operation: PageOperation): string | null {
    const grants = this.operationGrantCount(operation);
    return grants > 0
      ? `${grants} rol yetkisi verilmiş. Önce rollerdeki yetkileri kaldırın.`
      : null;
  }

  // ── İşlem eylemleri ──

  /** Havuzdaki bir tanıma tıklayınca o eylem seçili olarak bağlama diyaloğu açılır. */
  protected openAttachWith(operation: PageOperation, definition: ActionDefinition): void {
    this.actionInDialog.set(null);
    this.actionTargetOperationId.set(operation.id);
    this.actionPreselect.set(definition.id);
    this.actionDialogOpen.set(true);
  }

  protected openEditAction(operation: PageOperation, action: OperationAction): void {
    this.actionInDialog.set(action);
    this.actionTargetOperationId.set(operation.id);
    this.actionPreselect.set(null);
    this.actionDialogOpen.set(true);
  }

  protected async onActionSave(value: OperationActionFormValue): Promise<void> {
    const editing = this.actionInDialog();
    const operation = this.actionTargetOperation();

    if (!operation) {
      return;
    }

    const ok = editing
      ? await this.store.updateAction(editing.id, {
          endpoint: value.endpoint,
          httpMethod: value.httpMethod,
          isActive: value.isActive,
        })
      : await this.store.attachAction(operation.id, {
          actionDefinitionId: value.actionDefinitionId,
          endpoint: value.endpoint,
          httpMethod: value.httpMethod,
        });

    if (ok) {
      this.actionDialogOpen.set(false);
    }
  }

  protected confirmDetachAction(action: OperationAction): void {
    this.confirmation.confirm({
      header: 'Eylemi kaldır',
      message: `"${action.actionName}" eylemi bu işlemden kaldırılacak. Devam edilsin mi?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Kaldır',
      rejectLabel: 'Vazgeç',
      acceptButtonStyleClass: 'p-button-danger p-button-sm',
      rejectButtonStyleClass: 'p-button-text p-button-sm',
      accept: () => void this.store.detachAction(action.id),
    });
  }

  protected detachBlockedReason(action: OperationAction): string | null {
    return action.grantCount > 0
      ? 'Rol yetkisi verilmiş bir eylem kaldırılamaz. Önce rollerdeki yetkileri kaldırın.'
      : null;
  }

  /** Uç noktası olmayan eylem UNAVAILABLE görünür; rozet sınıfı buradan gelir. */
  protected methodClass(action: OperationAction): string {
    return `method--${action.httpMethod?.toLowerCase() ?? 'unavailable'}`;
  }

  protected availableFor(operation: PageOperation): ActionDefinition[] {
    return this.store.availableFor(operation);
  }
}
