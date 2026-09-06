import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiFailure } from '@core/api/api-result.model';
import { ProgramOutcomeApi } from './program-outcome.api';
import {
  ProgramOutcome,
  ProgramOutcomeCreateCommand,
  ProgramOutcomeThreshold,
  ProgramOutcomeThresholdCreateCommand,
  ProgramOutcomeThresholdUpdateCommand,
  ProgramOutcomeUpdateCommand,
} from './program-outcome.models';

export interface StoreFeedback {
  readonly severity: 'success' | 'error';
  readonly text: string;
}

/**
 * Program Çıktıları ekranının durumu — liste + seçilenin eşikleri.
 *
 * İKİ SAYFA TEK STORE: çıktı ve eşiği ayrı sayfalarda görünse de tek bir kavramın
 * iki yüzü. Eşiksiz çıktı hesabı durdurduğu için ikisini bir arada tutmak, "hangi
 * çıktının eşiği eksik" sorusunu tek bakışta cevaplatıyor.
 */
@Injectable()
export class ProgramOutcomeStore {
  private readonly api = inject(ProgramOutcomeApi);

  private readonly _items = signal<readonly ProgramOutcome[]>([]);
  private readonly _thresholds = signal<readonly ProgramOutcomeThreshold[]>([]);
  private readonly _selectedId = signal<number | null>(null);

  private readonly _loading = signal(false);
  private readonly _thresholdsLoading = signal(false);
  private readonly _saving = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _feedback = signal<StoreFeedback | null>(null);

  readonly items = this._items.asReadonly();
  readonly thresholds = this._thresholds.asReadonly();
  readonly selectedId = this._selectedId.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly thresholdsLoading = this._thresholdsLoading.asReadonly();
  readonly saving = this._saving.asReadonly();
  readonly error = this._error.asReadonly();
  readonly feedback = this._feedback.asReadonly();

  readonly search = signal('');

  readonly selected = computed(
    () => this._items().find((item) => item.id === this._selectedId()) ?? null,
  );

  readonly filtered = computed(() => {
    const term = this.search().trim().toLocaleLowerCase('tr-TR');
    if (term.length === 0) return this._items();

    return this._items().filter(
      (item) =>
        item.code.toLocaleLowerCase('tr-TR').includes(term) ||
        item.description.toLocaleLowerCase('tr-TR').includes(term),
    );
  });

  readonly activeCount = computed(() => this._items().filter((i) => i.isActive).length);

  /** Yürürlükteki eşik; hesabın okuduğu satır budur. */
  readonly activeThreshold = computed(
    () => this._thresholds().find((t) => t.isActive) ?? null,
  );

  clearFeedback(): void {
    this._feedback.set(null);
  }

  async load(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const items = await firstValueFrom(this.api.getAll());
      this._items.set(items);

      const id = this._selectedId();
      if (id !== null && !items.some((item) => item.id === id)) {
        this._selectedId.set(null);
        this._thresholds.set([]);
      }
    } catch (error) {
      this._items.set([]);
      this._error.set(toMessage(error));
    } finally {
      this._loading.set(false);
    }
  }

  async select(id: number): Promise<void> {
    this._selectedId.set(id);
    this._thresholdsLoading.set(true);
    this._thresholds.set([]);

    try {
      this._thresholds.set(await firstValueFrom(this.api.getThresholds(id)));
    } catch (error) {
      this._feedback.set({ severity: 'error', text: toMessage(error) });
    } finally {
      this._thresholdsLoading.set(false);
    }
  }

  // ── Program çıktısı ──

  async create(command: ProgramOutcomeCreateCommand): Promise<boolean> {
    return this.runCommand(() => firstValueFrom(this.api.create(command)));
  }

  async update(id: number, command: ProgramOutcomeUpdateCommand): Promise<boolean> {
    return this.runCommand(() => firstValueFrom(this.api.update(id, command)));
  }

  async remove(id: number): Promise<boolean> {
    const ok = await this.runCommand(() => firstValueFrom(this.api.remove(id)));

    if (ok && this._selectedId() === id) {
      this._selectedId.set(null);
      this._thresholds.set([]);
    }

    return ok;
  }

  // ── Eşik ──

  async createThreshold(command: ProgramOutcomeThresholdCreateCommand): Promise<boolean> {
    return this.runThresholdCommand(() => firstValueFrom(this.api.createThreshold(command)));
  }

  async updateThreshold(command: ProgramOutcomeThresholdUpdateCommand): Promise<boolean> {
    return this.runThresholdCommand(() => firstValueFrom(this.api.updateThreshold(command)));
  }

  async activateThreshold(thresholdId: number): Promise<boolean> {
    const outcomeId = this._selectedId();
    if (outcomeId === null) return false;

    return this.runThresholdCommand(() =>
      firstValueFrom(this.api.activateThreshold(outcomeId, thresholdId)),
    );
  }

  async removeThreshold(thresholdId: number): Promise<boolean> {
    const outcomeId = this._selectedId();
    if (outcomeId === null) return false;

    return this.runThresholdCommand(() =>
      firstValueFrom(this.api.removeThreshold(outcomeId, thresholdId)),
    );
  }

  // ── Ortak kabuklar ──

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

  /** Eşik komutları listeyi değil, seçili çıktının eşiklerini tazeler. */
  private async runThresholdCommand(action: () => Promise<string>): Promise<boolean> {
    this._saving.set(true);
    this._feedback.set(null);

    try {
      const message = await action();

      const id = this._selectedId();
      if (id !== null) await this.select(id);

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
