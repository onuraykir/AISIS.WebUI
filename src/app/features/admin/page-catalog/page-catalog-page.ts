import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
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
import type { OperationAction } from '../operation-catalog/data-access/operation.models';
import { CatalogFilter, PageCatalogStore } from './data-access/page-catalog.store';
import { PageListItem } from './data-access/page.models';
import { PageFormDialog, PageFormValue } from './ui/page-form-dialog';

interface FilterOption {
  readonly value: CatalogFilter;
  readonly label: string;
}

/**
 * Sayfa Kataloğu ekranı (akıllı bileşen).
 *
 * Modül Ağacı ekranıyla aynı iskelet: solda liste, sağda seçili kaydın künyesi
 * ve konumu. Buradaki fark, "konum"un anlamı: sayfa ya havuzdadır ya da bir
 * modüle yerleştirilmiştir; yetkilendirme ancak yerleştirildikten sonra mümkün.
 */
@Component({
  selector: 'app-page-catalog-page',
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
    PageFormDialog,
  ],
  providers: [PageCatalogStore, ConfirmationService],
  templateUrl: './page-catalog-page.html',
  styleUrl: './page-catalog-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageCatalogPage implements OnInit {
  private readonly confirmation = inject(ConfirmationService);

  protected readonly store = inject(PageCatalogStore);

  protected readonly dialogOpen = signal(false);
  protected readonly dialogPage = signal<PageListItem | null>(null);

  /** Yerleştirme kutusundaki seçili hedef; null = havuz. */
  protected readonly placementTarget = signal<number | null>(null);

  protected readonly selected = this.store.selected;

  protected readonly filterOptions: readonly FilterOption[] = [
    { value: 'all', label: 'Hepsi' },
    { value: 'placed', label: 'Yerleşik' },
    { value: 'pool', label: 'Havuz' },
  ];

  /** Yerleştirme listesi: havuz seçeneği + modüller. */
  protected readonly placementOptions = computed(() => [
    { id: null as number | null, label: 'Havuza al (menüden çıkar)' },
    ...this.store.moduleOptions().map((option) => ({ id: option.id, label: option.label })),
  ]);

  protected readonly placementChanged = computed(
    () => this.placementTarget() !== (this.selected()?.moduleId ?? null),
  );

  /** Havuza alma neden engelli? Boşsa serbest. */
  protected readonly unplaceBlockedReason = computed<string | null>(() => {
    const page = this.selected();
    if (!page || this.placementTarget() !== null) {
      return null;
    }

    return page.grantCount > 0
      ? 'Rol yetkisi verilmiş bir sayfa havuza alınamaz. Önce rollerdeki yetkileri kaldırın.'
      : null;
  });

  protected readonly deleteBlockedReason = computed<string | null>(() => {
    const page = this.selected();
    if (!page) {
      return null;
    }

    return page.grantCount > 0
      ? 'Rol yetkisi verilmiş bir sayfa silinemez. Önce rollerdeki yetkileri kaldırın.'
      : null;
  });

  /** Uç noktası olmayan eylem UNAVAILABLE görünür; rozet İşlem Kataloğu ile aynı. */
  protected methodLabel(action: OperationAction): string {
    return action.httpMethod ?? 'UNAVAILABLE';
  }

  protected methodClass(action: OperationAction): string {
    return `method--${action.httpMethod?.toLowerCase() ?? 'unavailable'}`;
  }

  ngOnInit(): void {
    void this.store.load();
  }

  protected setFilter(value: CatalogFilter): void {
    this.store.filter.set(value);
  }

  protected onSearch(event: Event): void {
    this.store.search.set((event.target as HTMLInputElement).value);
  }

  protected select(page: PageListItem): void {
    this.store.select(page.id);
    this.placementTarget.set(page.moduleId);
  }

  protected openCreate(): void {
    this.dialogPage.set(null);
    this.dialogOpen.set(true);
  }

  protected openEdit(page: PageListItem): void {
    this.dialogPage.set(page);
    this.dialogOpen.set(true);
  }

  protected async onDialogSave(value: PageFormValue): Promise<void> {
    const editing = this.dialogPage();

    const ok = editing
      ? await this.store.update(editing.id, {
          name: value.name,
          route: value.route,
          icon: value.icon,
          description: value.description,
          isActive: value.isActive,
        })
      : await this.store.create({
          name: value.name,
          route: value.route,
          icon: value.icon,
          description: value.description,
          moduleId: value.moduleId,
          isActive: value.isActive,
        });

    if (ok) {
      this.dialogOpen.set(false);
    }
  }

  protected async applyPlacement(): Promise<void> {
    const page = this.selected();
    if (!page || !this.placementChanged() || this.unplaceBlockedReason()) {
      return;
    }

    await this.store.setPlacement(page.id, this.placementTarget());
  }

  protected confirmDelete(page: PageListItem): void {
    this.confirmation.confirm({
      header: 'Sayfayı sil',
      message: `"${page.name}" sayfası silinecek. İşlemleri ve eylemleri de kaldırılır. Devam edilsin mi?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sil',
      rejectLabel: 'Vazgeç',
      acceptButtonStyleClass: 'p-button-danger p-button-sm',
      rejectButtonStyleClass: 'p-button-text p-button-sm',
      accept: () => void this.store.remove(page.id),
    });
  }

  protected reload(): void {
    void this.store.load();
  }
}
