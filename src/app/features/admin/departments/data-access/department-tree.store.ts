import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiFailure } from '@core/api/api-result.model';
import { DepartmentAdminApi } from './department-admin.api';
import {
  DepartmentCreateCommand,
  DepartmentTreeNode,
  DepartmentType,
  DepartmentUpdateCommand,
} from './department.models';

export interface StoreFeedback {
  readonly severity: 'success' | 'error';
  readonly text: string;
}

/** Ağaçta çizilen tek satır: düğüm + derinliği + açık mı. */
export interface DepartmentRow {
  readonly node: DepartmentTreeNode;
  readonly depth: number;
  readonly expanded: boolean;
  readonly hasChildren: boolean;
}

/**
 * Birim Ağacı ekranının durumu.
 *
 * Ağaç sunucudan iç içe geliyor; ekran onu çizmek için düz satırlara indiriyor.
 * Açık/kapalı klasörler burada tutuluyor — sunucuya ait bir bilgi değil.
 */
@Injectable()
export class DepartmentTreeStore {
  private readonly api = inject(DepartmentAdminApi);

  private readonly _tree = signal<readonly DepartmentTreeNode[]>([]);
  private readonly _selectedId = signal<number | null>(null);
  private readonly _collapsedIds = signal<ReadonlySet<number>>(new Set<number>());

  private readonly _loading = signal(false);
  private readonly _saving = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _feedback = signal<StoreFeedback | null>(null);

  readonly tree = this._tree.asReadonly();
  readonly selectedId = this._selectedId.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly saving = this._saving.asReadonly();
  readonly error = this._error.asReadonly();
  readonly feedback = this._feedback.asReadonly();

  readonly search = signal('');

  /** Ağaçtaki tüm düğümler, düz liste. Sayaç ve arama bunun üzerinden. */
  private readonly flat = computed(() => flatten(this._tree()));

  readonly total = computed(() => this.flat().length);
  readonly academicCount = computed(
    () => this.flat().filter((n) => n.type === DepartmentType.Academic).length,
  );
  readonly administrativeCount = computed(
    () => this.flat().filter((n) => n.type === DepartmentType.Administrative).length,
  );
  readonly inactiveCount = computed(() => this.flat().filter((n) => !n.isActive).length);

  readonly selected = computed<DepartmentTreeNode | null>(() => {
    const id = this._selectedId();
    return id === null ? null : (this.flat().find((n) => n.id === id) ?? null);
  });

  /**
   * Çizilecek satırlar. Arama varsa ağaç DÜZLEŞİR: eşleşen düğüm derin bir yerde
   * olabilir, klasör açmaya zorlamak yerine hepsi tek seviyede gösterilir.
   */
  readonly rows = computed<DepartmentRow[]>(() => {
    const needle = this.search().trim().toLocaleLowerCase('tr-TR');

    if (needle.length > 0) {
      return this.flat()
        .filter(
          (node) =>
            node.name.toLocaleLowerCase('tr-TR').includes(needle) ||
            node.code.toLocaleLowerCase('tr-TR').includes(needle),
        )
        .map((node) => ({ node, depth: 0, expanded: true, hasChildren: false }));
    }

    const collapsed = this._collapsedIds();
    const rows: DepartmentRow[] = [];

    const walk = (nodes: readonly DepartmentTreeNode[], depth: number): void => {
      for (const node of nodes) {
        const hasChildren = node.subDepartments.length > 0;
        const expanded = !collapsed.has(node.id);

        rows.push({ node, depth, expanded, hasChildren });

        if (hasChildren && expanded) {
          walk(node.subDepartments, depth + 1);
        }
      }
    };

    walk(this._tree(), 0);
    return rows;
  });

  /** Taşıma hedefleri: kendisi ve alt ağacı hariç her birim + "kök" seçeneği. */
  moveTargets(node: DepartmentTreeNode): { id: number | null; label: string }[] {
    const blocked = new Set(flatten([node]).map((n) => n.id));

    return [
      { id: null, label: 'Kök birim (üstü yok)' },
      ...this.flat()
        .filter((candidate) => !blocked.has(candidate.id))
        .map((candidate) => ({ id: candidate.id as number | null, label: candidate.name })),
    ];
  }

  select(id: number | null): void {
    this._selectedId.set(id);
  }

  toggle(id: number): void {
    this._collapsedIds.update((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  clearFeedback(): void {
    this._feedback.set(null);
  }

  async load(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      this._tree.set(await firstValueFrom(this.api.getTree()));

      const id = this._selectedId();
      if (id !== null && !this.flat().some((n) => n.id === id)) {
        this._selectedId.set(null);
      }
    } catch (error) {
      this._tree.set([]);
      this._error.set(toMessage(error));
    } finally {
      this._loading.set(false);
    }
  }

  async create(command: DepartmentCreateCommand): Promise<boolean> {
    return this.runCommand(async () => {
      const created = await firstValueFrom(this.api.create(command));
      await this.load();
      this._selectedId.set(created.id);
      return 'Birim oluşturuldu.';
    });
  }

  async update(id: number, command: DepartmentUpdateCommand): Promise<boolean> {
    return this.runCommand(() => firstValueFrom(this.api.update(id, command)));
  }

  async move(id: number, parentDepartmentId: number | null): Promise<boolean> {
    return this.runCommand(() => firstValueFrom(this.api.move(id, { parentDepartmentId })));
  }

  async remove(id: number): Promise<boolean> {
    const ok = await this.runCommand(() => firstValueFrom(this.api.remove(id)));
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
}

/** Ağacı düz listeye indirir (kök + tüm alt birimler). */
function flatten(nodes: readonly DepartmentTreeNode[]): DepartmentTreeNode[] {
  const all: DepartmentTreeNode[] = [];

  const walk = (list: readonly DepartmentTreeNode[]): void => {
    for (const node of list) {
      all.push(node);
      walk(node.subDepartments);
    }
  };

  walk(nodes);
  return all;
}

function toMessage(error: unknown): string {
  return error instanceof ApiFailure ? error.message : 'Beklenmeyen bir hata oluştu.';
}
