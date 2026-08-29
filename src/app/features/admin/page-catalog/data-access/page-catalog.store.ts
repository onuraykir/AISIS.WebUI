import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiFailure } from '@core/api/api-result.model';
import { ModuleAdminApi } from '../../module-tree/data-access/module-admin.api';
import { ModuleTreeNode } from '../../module-tree/data-access/module.models';
import { PageAdminApi } from './page-admin.api';
import { ModuleOption, PageCreateCommand, PageListItem, PageUpdateCommand } from './page.models';

export type CatalogFilter = 'all' | 'placed' | 'pool';

export interface StoreFeedback {
  readonly severity: 'success' | 'error';
  readonly text: string;
}

/** Listede modüle göre gruplanmış sayfalar. Havuz her zaman ilk gruptur. */
export interface PageGroup {
  readonly key: string;
  readonly label: string;
  readonly isPool: boolean;
  readonly pages: readonly PageListItem[];
}

/**
 * Sayfa Kataloğu ekranının durumu.
 *
 * İki kaynağı birleştirir: sayfa listesi (PageAdmin) ve modül ağacı
 * (ModuleAdmin) — ikincisi yalnızca yerleştirme hedeflerini adlandırmak için.
 * Ağaç okuma işi zaten modül tarafında çözülmüş olduğundan yeniden yazılmıyor.
 */
@Injectable()
export class PageCatalogStore {
  private readonly pageApi = inject(PageAdminApi);
  private readonly moduleApi = inject(ModuleAdminApi);

  private readonly _pages = signal<readonly PageListItem[]>([]);
  private readonly _moduleOptions = signal<readonly ModuleOption[]>([]);
  private readonly _loading = signal(false);
  private readonly _saving = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _feedback = signal<StoreFeedback | null>(null);
  private readonly _selectedId = signal<number | null>(null);

  readonly pages = this._pages.asReadonly();
  readonly moduleOptions = this._moduleOptions.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly saving = this._saving.asReadonly();
  readonly error = this._error.asReadonly();
  readonly feedback = this._feedback.asReadonly();

  /** Ekran filtreleri; listeyi daraltır ama sayaçları etkilemez. */
  readonly filter = signal<CatalogFilter>('all');
  readonly search = signal('');

  readonly total = computed(() => this._pages().length);
  readonly placedCount = computed(() => this._pages().filter((page) => page.isPlaced).length);
  readonly poolCount = computed(() => this._pages().filter((page) => !page.isPlaced).length);

  readonly selected = computed<PageListItem | null>(() => {
    const id = this._selectedId();
    return id === null ? null : (this._pages().find((page) => page.id === id) ?? null);
  });

  /** Filtre + arama uygulanmış, modüle göre gruplanmış liste. */
  readonly groups = computed<PageGroup[]>(() => {
    const needle = this.search().trim().toLocaleLowerCase('tr-TR');
    const filter = this.filter();

    const visible = this._pages().filter((page) => {
      if (filter === 'placed' && !page.isPlaced) return false;
      if (filter === 'pool' && page.isPlaced) return false;

      if (needle.length === 0) return true;

      return (
        page.name.toLocaleLowerCase('tr-TR').includes(needle) ||
        page.route.toLocaleLowerCase('tr-TR').includes(needle)
      );
    });

    const pool = visible.filter((page) => !page.isPlaced);
    const groups: PageGroup[] = [];

    if (pool.length > 0) {
      groups.push({
        key: 'pool',
        label: 'Havuz — yerleştirilmemiş',
        isPool: true,
        pages: [...pool].sort(byName),
      });
    }

    const placedByModule = new Map<number, PageListItem[]>();
    for (const page of visible) {
      if (page.moduleId === null) continue;
      const bucket = placedByModule.get(page.moduleId);
      if (bucket) {
        bucket.push(page);
      } else {
        placedByModule.set(page.moduleId, [page]);
      }
    }

    // Modül sırası, seçim listesindeki ağaç sırasıyla aynı olsun.
    for (const option of this._moduleOptions()) {
      const pages = placedByModule.get(option.id);
      if (!pages) continue;

      groups.push({
        key: `m${option.id}`,
        label: option.label,
        isPool: false,
        pages: [...pages].sort((a, b) => a.displayOrder - b.displayOrder || byName(a, b)),
      });
      placedByModule.delete(option.id);
    }

    // Modül listesi gelmediyse (demo/hata) kalanları yine de göster.
    for (const [moduleId, pages] of placedByModule) {
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

  select(id: number | null): void {
    this._selectedId.set(id);
  }

  clearFeedback(): void {
    this._feedback.set(null);
  }

  async load(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const [pages, tree] = await Promise.all([
        firstValueFrom(this.pageApi.getCatalog()),
        firstValueFrom(this.moduleApi.getTree()),
      ]);

      this._pages.set(pages);
      this._moduleOptions.set(toModuleOptions(tree));
      this.keepSelectionValid();
    } catch (error) {
      this._pages.set([]);
      this._moduleOptions.set([]);
      this._error.set(toMessage(error));
    } finally {
      this._loading.set(false);
    }
  }

  async create(command: PageCreateCommand): Promise<boolean> {
    return this.runCommand(async () => {
      const created = await firstValueFrom(this.pageApi.create(command));
      await this.load();
      this._selectedId.set(created.id);
      return 'Sayfa oluşturuldu.';
    });
  }

  async update(id: number, command: PageUpdateCommand): Promise<boolean> {
    return this.runCommand(() => firstValueFrom(this.pageApi.update(id, command)));
  }

  /** moduleId null verilirse sayfa havuza alınır. */
  async setPlacement(id: number, moduleId: number | null): Promise<boolean> {
    return this.runCommand(() => firstValueFrom(this.pageApi.setPlacement(id, { moduleId })));
  }

  async remove(id: number): Promise<boolean> {
    const ok = await this.runCommand(() => firstValueFrom(this.pageApi.remove(id)));
    if (ok && this._selectedId() === id) {
      this._selectedId.set(null);
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

  private keepSelectionValid(): void {
    const id = this._selectedId();
    if (id !== null && !this._pages().some((page) => page.id === id)) {
      this._selectedId.set(null);
    }
  }
}

/**
 * Ağacı seçim listesine düzleştirir; alt modüller "Üst › Alt" olarak adlandırılır.
 * İşlem Kataloğu da sayfaları aynı sırayla gruplamak için bunu kullanıyor.
 */
export function toModuleOptions(tree: readonly ModuleTreeNode[]): ModuleOption[] {
  const options: ModuleOption[] = [];

  for (const root of tree) {
    options.push({ id: root.id, label: root.name, level: 0 });

    for (const sub of root.subModules) {
      options.push({ id: sub.id, label: `${root.name} › ${sub.name}`, level: 1 });
    }
  }

  return options;
}

function byName(a: PageListItem, b: PageListItem): number {
  return a.name.localeCompare(b.name, 'tr');
}

function toMessage(error: unknown): string {
  return error instanceof ApiFailure ? error.message : 'Beklenmeyen bir hata oluştu.';
}
