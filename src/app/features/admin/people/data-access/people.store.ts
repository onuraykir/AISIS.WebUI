import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiFailure } from '@core/api/api-result.model';
import { PersonAdminApi } from './person-admin.api';
import { PersonDetail, PersonSearchItem, PersonUpdateCommand } from './people.models';

export interface StoreFeedback {
  readonly severity: 'success' | 'error';
  readonly text: string;
}

/**
 * Kişiler ekranının durumu.
 *
 * Bu ekran şeritlerin BULUŞMA NOKTASI, kayıt yeri değil: buradan yeni kayıt
 * açılmaz, yalnızca aranır, görülür ve kimlik düzeltilir.
 */
@Injectable()
export class PeopleStore {
  private readonly api = inject(PersonAdminApi);

  private readonly _items = signal<readonly PersonSearchItem[]>([]);
  private readonly _detail = signal<PersonDetail | null>(null);
  private readonly _selectedId = signal<number | null>(null);

  private readonly _loading = signal(false);
  private readonly _detailLoading = signal(false);
  private readonly _saving = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _feedback = signal<StoreFeedback | null>(null);

  readonly items = this._items.asReadonly();
  readonly detail = this._detail.asReadonly();
  readonly selectedId = this._selectedId.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly detailLoading = this._detailLoading.asReadonly();
  readonly saving = this._saving.asReadonly();
  readonly error = this._error.asReadonly();
  readonly feedback = this._feedback.asReadonly();

  readonly search = signal('');

  readonly filtersDirty = computed(() => this.search().trim().length > 0);

  readonly total = computed(() => this._items().length);

  /** Hiçbir şeritte açık kaydı olmayan kişiler: geçmişte kalmış kayıtlar. */
  readonly withoutOpenRecordCount = computed(
    () =>
      this._items().filter(
        (item) => item.openStudentCount + item.openInstructorCount + item.openStaffCount === 0,
      ).length,
  );

  clearFeedback(): void {
    this._feedback.set(null);
  }

  resetFilters(): void {
    this.search.set('');
  }

  async load(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const items = await firstValueFrom(this.api.search(this.search()));
      this._items.set(items);

      const id = this._selectedId();
      if (id !== null && !items.some((item) => item.id === id)) {
        this._selectedId.set(null);
        this._detail.set(null);
      }
    } catch (error) {
      this._items.set([]);
      this._error.set(toMessage(error));
    } finally {
      this._loading.set(false);
    }
  }

  async select(id: number | null): Promise<void> {
    this._selectedId.set(id);

    if (id === null) {
      this._detail.set(null);
      return;
    }

    this._detailLoading.set(true);

    try {
      this._detail.set(await firstValueFrom(this.api.getById(id)));
    } catch (error) {
      this._detail.set(null);
      this._feedback.set({ severity: 'error', text: toMessage(error) });
    } finally {
      this._detailLoading.set(false);
    }
  }

  async update(id: number, command: PersonUpdateCommand): Promise<boolean> {
    this._saving.set(true);
    this._feedback.set(null);

    try {
      const message = await firstValueFrom(this.api.update(id, command));

      // TCKN değişmiş olabilir; hem liste hem künye tazelenmeli.
      await this.load();
      await this.select(id);

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

function toMessage(error: unknown): string {
  return error instanceof ApiFailure ? error.message : 'Beklenmeyen bir hata oluştu.';
}
