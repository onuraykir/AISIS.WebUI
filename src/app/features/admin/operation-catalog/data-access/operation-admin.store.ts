import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiFailure } from '@core/api/api-result.model';
import { ModuleAdminApi } from '../../module-tree/data-access/module-admin.api';
import { PageAdminApi } from '../../page-catalog/data-access/page-admin.api';
import { toModuleOptions } from '../../page-catalog/data-access/page-catalog.store';
import { ModuleOption, PageListItem } from '../../page-catalog/data-access/page.models';
import { OperationAdminApi } from './operation-admin.api';
import {
  ActionDefinition,
  ActionDefinitionCreateCommand,
  ActionDefinitionUpdateCommand,
  ApiEndpoint,
  OperationActionAttachCommand,
  OperationActionUpdateCommand,
  PageOperation,
  PageOperationCreateCommand,
  PageOperationUpdateCommand,
} from './operation.models';

export interface StoreFeedback {
  readonly severity: 'success' | 'error';
  readonly text: string;
}

/** Sol listedeki süzgeç. */
export type PageFilter = 'all' | 'missing' | 'pool';

/** Listede modüle göre gruplanmış sayfalar. Havuz her zaman ilk gruptur. */
export interface PageGroup {
  readonly key: string;
  readonly label: string;
  readonly isPool: boolean;
  readonly pages: readonly PageListItem[];
}

/**
 * İşlem Kataloğu ekranının durumu.
 *
 * Ekran SAYFA merkezlidir: solda sayfalar, sağda seçili sayfanın
 * işlem → eylem ağacı. Ortak eylem sözlüğü ana akışta değil, üst çubuktaki
 * diyalogda; on satırlık bir tanım listesi günlük işin önüne geçmemeli.
 *
 * Sayfanın işlem → eylem ağacı `PageAdmin/catalog` yanıtında geliyor
 * (`PageListItem.operations`). Ayrı bir "board" çağrısı YOK: aynı ağacı iki
 * uçtan döndürmek, iki farklı tazelik hâli demek olurdu.
 */
@Injectable()
export class OperationAdminStore {
  private readonly operationApi = inject(OperationAdminApi);
  private readonly pageApi = inject(PageAdminApi);
  private readonly moduleApi = inject(ModuleAdminApi);

  private readonly _pages = signal<readonly PageListItem[]>([]);
  private readonly _catalog = signal<readonly ActionDefinition[]>([]);
  private readonly _endpoints = signal<readonly ApiEndpoint[]>([]);
  private readonly _moduleOptions = signal<readonly ModuleOption[]>([]);
  private readonly _selectedPageId = signal<number | null>(null);

  private readonly _loading = signal(false);
  private readonly _saving = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _feedback = signal<StoreFeedback | null>(null);

  readonly pages = this._pages.asReadonly();
  readonly catalog = this._catalog.asReadonly();
  readonly endpoints = this._endpoints.asReadonly();
  readonly selectedPageId = this._selectedPageId.asReadonly();

  readonly loading = this._loading.asReadonly();
  readonly saving = this._saving.asReadonly();
  readonly error = this._error.asReadonly();
  readonly feedback = this._feedback.asReadonly();

  /** Ekran süzgeçleri; listeyi daraltır ama sayaçları etkilemez. */
  readonly filter = signal<PageFilter>('all');
  readonly search = signal('');

  readonly selectedPage = computed<PageListItem | null>(() => {
    const id = this._selectedPageId();
    return id === null ? null : (this._pages().find((page) => page.id === id) ?? null);
  });

  readonly definitionCount = computed(() => this._catalog().length);

  readonly operationTotal = computed(() =>
    this._pages().reduce((total, page) => total + page.operationCount, 0),
  );

  readonly actionTotal = computed(() =>
    this._pages().reduce((total, page) => total + page.actionCount, 0),
  );

  /** İşlemi olmayan sayfa hiç yetkilendirilemez; sol süzgeç bunu ayırır. */
  readonly missingCount = computed(
    () => this._pages().filter((page) => page.operationCount === 0).length,
  );

  /** Hiçbir eyleme bağlanmamış uç noktalar: yetkilendirme boşluğu. */
  readonly unmappedEndpointCount = computed(
    () => this._endpoints().filter((endpoint) => endpoint.usageCount === 0).length,
  );

  /** Süzgeç + arama uygulanmış, modüle göre gruplanmış liste. */
  readonly groups = computed<PageGroup[]>(() => {
    const needle = this.search().trim().toLocaleLowerCase('tr-TR');
    const filter = this.filter();

    const visible = this._pages().filter((page) => {
      if (filter === 'missing' && page.operationCount > 0) return false;
      if (filter === 'pool' && page.isPlaced) return false;

      if (needle.length === 0) return true;

      return (
        page.name.toLocaleLowerCase('tr-TR').includes(needle) ||
        page.route.toLocaleLowerCase('tr-TR').includes(needle) ||
        page.operations.some((operation) =>
          operation.name.toLocaleLowerCase('tr-TR').includes(needle),
        )
      );
    });

    const groups: PageGroup[] = [];
    const pool = visible.filter((page) => !page.isPlaced);

    if (pool.length > 0) {
      groups.push({
        key: 'pool',
        label: 'Havuz — yerleştirilmemiş',
        isPool: true,
        pages: [...pool].sort(byName),
      });
    }

    const byModule = new Map<number, PageListItem[]>();
    for (const page of visible) {
      if (page.moduleId === null) continue;
      const bucket = byModule.get(page.moduleId);
      if (bucket) {
        bucket.push(page);
      } else {
        byModule.set(page.moduleId, [page]);
      }
    }

    // Modül sırası, Sayfa Kataloğu'ndakiyle aynı olsun: ağaç sırası.
    for (const option of this._moduleOptions()) {
      const pages = byModule.get(option.id);
      if (!pages) continue;

      groups.push({
        key: `m${option.id}`,
        label: option.label,
        isPool: false,
        pages: [...pages].sort((a, b) => a.displayOrder - b.displayOrder || byName(a, b)),
      });
      byModule.delete(option.id);
    }

    // Modül ağacı gelmediyse kalanları yine de göster.
    for (const [moduleId, pages] of byModule) {
      groups.push({
        key: `m${moduleId}`,
        label: pages[0]?.moduleName ?? 'Modül',
        isPool: false,
        pages: [...pages].sort(byName),
      });
    }

    return groups;
  });

  readonly isEmpty = computed(() => !this._loading() && this.groups().length === 0);

  /**
   * Bir işleme HÂLÂ bağlanabilecek eylem tanımları.
   * Aynı eylem bir işleme iki kez bağlanamaz; havuz farkı burada hesaplanır.
   */
  availableFor(operation: PageOperation): ActionDefinition[] {
    const attached = new Set(operation.actions.map((action) => action.actionDefinitionId));
    return this._catalog().filter((definition) => !attached.has(definition.id));
  }

  select(pageId: number | null): void {
    this._selectedPageId.set(pageId);
  }

  clearFeedback(): void {
    this._feedback.set(null);
  }

  async load(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const [pages, catalog, endpoints, tree] = await Promise.all([
        firstValueFrom(this.pageApi.getCatalog()),
        firstValueFrom(this.operationApi.getCatalog()),
        firstValueFrom(this.operationApi.getEndpoints()),
        firstValueFrom(this.moduleApi.getTree()),
      ]);

      this._pages.set(pages);
      this._catalog.set(catalog);
      this._endpoints.set(endpoints);
      this._moduleOptions.set(toModuleOptions(tree));

      const current = this._selectedPageId();
      if (current !== null && !pages.some((page) => page.id === current)) {
        this._selectedPageId.set(null);
      }
    } catch (error) {
      this._pages.set([]);
      this._catalog.set([]);
      this._endpoints.set([]);
      this._moduleOptions.set([]);
      this._error.set(toMessage(error));
    } finally {
      this._loading.set(false);
    }
  }

  // ── Eylem sözlüğü komutları ──

  async createDefinition(command: ActionDefinitionCreateCommand): Promise<boolean> {
    return this.runCommand(async () => {
      await firstValueFrom(this.operationApi.createDefinition(command));
      return 'Eylem tanımı oluşturuldu.';
    });
  }

  async updateDefinition(id: number, command: ActionDefinitionUpdateCommand): Promise<boolean> {
    return this.runCommand(() => firstValueFrom(this.operationApi.updateDefinition(id, command)));
  }

  async removeDefinition(id: number): Promise<boolean> {
    return this.runCommand(() => firstValueFrom(this.operationApi.removeDefinition(id)));
  }

  /**
   * Sözlükte bir tanımı yukarı/aşağı taşır.
   * Sunucu kısmi liste kabul etmediği için TÜM sıra gönderilir.
   */
  async shiftDefinition(definition: ActionDefinition, direction: -1 | 1): Promise<boolean> {
    const ordered = reorder(this._catalog().map((item) => item.id), definition.id, direction);
    if (ordered === null) {
      return false;
    }

    return this.runCommand(() =>
      firstValueFrom(this.operationApi.reorderDefinitions({ orderedActionDefinitionIds: ordered })),
    );
  }

  canShiftUp(definition: ActionDefinition): boolean {
    return this._catalog()[0]?.id !== definition.id;
  }

  canShiftDown(definition: ActionDefinition): boolean {
    return this._catalog().at(-1)?.id !== definition.id;
  }

  // ── Sayfa işlemi komutları ──

  async createOperation(command: PageOperationCreateCommand): Promise<boolean> {
    const pageId = this._selectedPageId();
    if (pageId === null) {
      return false;
    }

    return this.runCommand(async () => {
      await firstValueFrom(this.operationApi.createOperation(pageId, command));
      return 'İşlem oluşturuldu.';
    });
  }

  async updateOperation(id: number, command: PageOperationUpdateCommand): Promise<boolean> {
    return this.runCommand(() => firstValueFrom(this.operationApi.updateOperation(id, command)));
  }

  async removeOperation(id: number): Promise<boolean> {
    return this.runCommand(() => firstValueFrom(this.operationApi.removeOperation(id)));
  }

  async shiftOperation(operation: PageOperation, direction: -1 | 1): Promise<boolean> {
    const page = this.selectedPage();
    if (!page) {
      return false;
    }

    const ordered = reorder(page.operations.map((item) => item.id), operation.id, direction);
    if (ordered === null) {
      return false;
    }

    return this.runCommand(() =>
      firstValueFrom(
        this.operationApi.reorderOperations(page.id, { orderedOperationIds: ordered }),
      ),
    );
  }

  canShiftOperationUp(operation: PageOperation): boolean {
    return (this.selectedPage()?.operations[0]?.id ?? null) !== operation.id;
  }

  canShiftOperationDown(operation: PageOperation): boolean {
    return (this.selectedPage()?.operations.at(-1)?.id ?? null) !== operation.id;
  }

  // ── Eylem bağı komutları ──

  async attachAction(operationId: number, command: OperationActionAttachCommand): Promise<boolean> {
    return this.runCommand(async () => {
      await firstValueFrom(this.operationApi.attachAction(operationId, command));
      return 'Eylem işleme bağlandı.';
    });
  }

  async updateAction(id: number, command: OperationActionUpdateCommand): Promise<boolean> {
    return this.runCommand(() => firstValueFrom(this.operationApi.updateAction(id, command)));
  }

  async detachAction(id: number): Promise<boolean> {
    return this.runCommand(() => firstValueFrom(this.operationApi.detachAction(id)));
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

/** Bir kimliği listede bir sıra yukarı/aşağı taşır; taşınamıyorsa null döner. */
function reorder(ids: number[], id: number, direction: -1 | 1): number[] | null {
  const index = ids.indexOf(id);
  const target = index + direction;

  if (index < 0 || target < 0 || target >= ids.length) {
    return null;
  }

  const moved = ids[index];
  const displaced = ids[target];
  if (moved === undefined || displaced === undefined) {
    return null;
  }

  ids[index] = displaced;
  ids[target] = moved;
  return ids;
}

function byName(a: PageListItem, b: PageListItem): number {
  return a.name.localeCompare(b.name, 'tr');
}

function toMessage(error: unknown): string {
  return error instanceof ApiFailure ? error.message : 'Beklenmeyen bir hata oluştu.';
}
