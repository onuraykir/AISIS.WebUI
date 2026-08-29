import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiFailure } from '@core/api/api-result.model';
import { ModuleAdminApi } from './module-admin.api';
import { ModuleCreateCommand, ModuleTreeNode, ModuleUpdateCommand } from './module.models';

/** Ekranın kullanıcıya göstereceği tek seferlik geri bildirim. */
export interface StoreFeedback {
  readonly severity: 'success' | 'error';
  readonly text: string;
}

/**
 * Modül Ağacı ekranının durumu.
 *
 * Sorumluluk sınırı: API çağrısı yapar, sonucu sinyallere yazar, hatayı
 * kullanıcıya gösterilebilir mesaja çevirir. Şablon bilgisi (hangi diyalog açık,
 * hangi alan odakta) burada DEĞİL, bileşendedir.
 *
 * Yazma işlemlerinden sonra ağaç yeniden çekilir. İyimser güncelleme bilerek
 * yapılmıyor: sunucudaki kurallar (taşıma, sıralama, kök düzeltme) istemcide
 * tekrar edilmeden doğru sonuç ancak tazelemeyle alınır.
 */
@Injectable()
export class ModuleTreeStore {
  private readonly api = inject(ModuleAdminApi);

  private readonly _tree = signal<readonly ModuleTreeNode[]>([]);
  private readonly _loading = signal(false);
  private readonly _saving = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _feedback = signal<StoreFeedback | null>(null);
  private readonly _selectedId = signal<number | null>(null);

  readonly tree = this._tree.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly saving = this._saving.asReadonly();
  readonly error = this._error.asReadonly();
  readonly feedback = this._feedback.asReadonly();

  /** Ağaçtaki tüm düğümler, düz liste. Arama ve seçim aramaları için. */
  readonly flat = computed<ModuleTreeNode[]>(() => flatten(this._tree()));

  readonly selected = computed<ModuleTreeNode | null>(() => {
    const id = this._selectedId();
    return id === null ? null : (this.flat().find((node) => node.id === id) ?? null);
  });

  readonly isEmpty = computed(() => !this._loading() && this._tree().length === 0);

  readonly rootCount = computed(() => this._tree().length);
  readonly totalCount = computed(() => this.flat().length);
  readonly pageTotal = computed(() =>
    this.flat().reduce((total, node) => total + node.pageCount, 0),
  );

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
      const tree = await firstValueFrom(this.api.getTree());
      this._tree.set(tree);
      this.keepSelectionValid();
    } catch (error) {
      this._tree.set([]);
      this._error.set(toMessage(error));
    } finally {
      this._loading.set(false);
    }
  }

  async create(command: ModuleCreateCommand): Promise<boolean> {
    return this.runCommand(async () => {
      const created = await firstValueFrom(this.api.create(command));
      await this.load();
      this._selectedId.set(created.id);
      return 'Modül oluşturuldu.';
    });
  }

  async update(id: number, command: ModuleUpdateCommand): Promise<boolean> {
    return this.runCommand(() => firstValueFrom(this.api.update(id, command)));
  }

  async move(id: number, newParentModuleId: number | null): Promise<boolean> {
    return this.runCommand(() => firstValueFrom(this.api.move(id, { newParentModuleId })));
  }

  async remove(id: number): Promise<boolean> {
    const ok = await this.runCommand(() => firstValueFrom(this.api.remove(id)));
    if (ok && this._selectedId() === id) {
      this._selectedId.set(null);
    }
    return ok;
  }

  /**
   * Bir düğümü kardeşleri arasında yukarı/aşağı taşır.
   *
   * Sunucu kısmi sıralama listesi kabul etmediği için o seviyedeki TÜM kardeşler
   * yeni sırayla gönderilir.
   */
  async shift(node: ModuleTreeNode, direction: -1 | 1): Promise<boolean> {
    const siblings = this.siblingsOf(node);
    const index = siblings.findIndex((sibling) => sibling.id === node.id);
    const target = index + direction;

    if (index < 0 || target < 0 || target >= siblings.length) {
      return false;
    }

    const ordered = siblings.map((sibling) => sibling.id);
    const moved = ordered[index];
    const displaced = ordered[target];
    if (moved === undefined || displaced === undefined) {
      return false;
    }

    ordered[index] = displaced;
    ordered[target] = moved;

    return this.runCommand(() =>
      firstValueFrom(
        this.api.reorder({ parentModuleId: node.parentModuleId, orderedModuleIds: ordered }),
      ),
    );
  }

  /** Verilen düğümün kardeşleri, ekrandaki sırayla. */
  siblingsOf(node: ModuleTreeNode): readonly ModuleTreeNode[] {
    if (node.parentModuleId === null) {
      return this._tree();
    }

    return this.flat().find((candidate) => candidate.id === node.parentModuleId)?.subModules ?? [];
  }

  /** Modülün taşınabileceği hedefler: kendisi ve alt ağacı hariç ana modüller. */
  moveTargets(node: ModuleTreeNode): ModuleTreeNode[] {
    return this._tree().filter((root) => root.id !== node.id);
  }

  /**
   * Komut sarmalayıcısı: kaydetme bayrağı, hata mesajı ve tazeleme tek yerde.
   * `true` dönerse işlem başarılı.
   */
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

  /** Tazeleme sonrası silinmiş bir düğüm seçili kalmasın. */
  private keepSelectionValid(): void {
    const id = this._selectedId();
    if (id !== null && !this.flat().some((node) => node.id === id)) {
      this._selectedId.set(null);
    }
  }
}

function flatten(nodes: readonly ModuleTreeNode[]): ModuleTreeNode[] {
  const result: ModuleTreeNode[] = [];

  const walk = (list: readonly ModuleTreeNode[]): void => {
    for (const node of list) {
      result.push(node);
      walk(node.subModules);
    }
  };

  walk(nodes);
  return result;
}

function toMessage(error: unknown): string {
  return error instanceof ApiFailure ? error.message : 'Beklenmeyen bir hata oluştu.';
}
