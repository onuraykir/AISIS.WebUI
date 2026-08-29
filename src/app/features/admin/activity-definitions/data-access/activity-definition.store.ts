import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiFailure } from '@core/api/api-result.model';
import { ActivityDefinitionAdminApi } from './activity-definition-admin.api';
import {
  ActivityDefinition,
  ActivityDefinitionCreateCommand,
  ActivityDefinitionUpdateCommand,
} from './activity-definition.models';

export interface StoreFeedback {
  readonly severity: 'success' | 'error';
  readonly text: string;
}

/**
 * Etkinlik Tanımları ekranının durumu.
 *
 * Tek listeli sade bir sözlük; künye paneli yok çünkü satırın kendisi zaten
 * tüm bilgiyi taşıyor.
 */
@Injectable()
export class ActivityDefinitionStore {
  private readonly api = inject(ActivityDefinitionAdminApi);

  private readonly _items = signal<readonly ActivityDefinition[]>([]);
  private readonly _loading = signal(false);
  private readonly _saving = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _feedback = signal<StoreFeedback | null>(null);

  readonly items = this._items.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly saving = this._saving.asReadonly();
  readonly error = this._error.asReadonly();
  readonly feedback = this._feedback.asReadonly();

  readonly search = signal('');

  readonly total = computed(() => this._items().length);

  /** Hiç kullanılmamış tanımlar; sözlüğün ölü kısmı. */
  readonly unusedCount = computed(
    () => this._items().filter((item) => item.usageCount === 0).length,
  );

  clearFeedback(): void {
    this._feedback.set(null);
  }

  async load(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      this._items.set(await firstValueFrom(this.api.getList(this.search())));
    } catch (error) {
      this._items.set([]);
      this._error.set(toMessage(error));
    } finally {
      this._loading.set(false);
    }
  }

  async create(command: ActivityDefinitionCreateCommand): Promise<boolean> {
    return this.runCommand(async () => {
      await firstValueFrom(this.api.create(command));
      return 'Etkinlik tanımı oluşturuldu.';
    });
  }

  async update(id: number, command: ActivityDefinitionUpdateCommand): Promise<boolean> {
    return this.runCommand(() => firstValueFrom(this.api.update(id, command)));
  }

  async remove(id: number): Promise<boolean> {
    return this.runCommand(() => firstValueFrom(this.api.remove(id)));
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

function toMessage(error: unknown): string {
  return error instanceof ApiFailure ? error.message : 'Beklenmeyen bir hata oluştu.';
}
