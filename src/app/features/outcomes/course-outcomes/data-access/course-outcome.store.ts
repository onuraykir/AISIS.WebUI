import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiFailure } from '@core/api/api-result.model';
import { OfferingContextStore } from '@shared/data-access/offering-context.store';
import { CourseOutcomeApi } from './course-outcome.api';
import {
  CourseOutcome,
  CourseOutcomeCreateCommand,
  CourseOutcomeUpdateCommand,
} from './course-outcome.models';

export interface StoreFeedback {
  readonly severity: 'success' | 'error';
  readonly text: string;
}

/**
 * Ders Çıktıları ekranının durumu.
 *
 * BAĞLAM AÇILIŞTIR — dönem/açılış seçimi {@link OfferingContextStore}'da durur,
 * bu store yalnızca o açılışın çıktılarını yönetir.
 */
@Injectable()
export class CourseOutcomeStore {
  private readonly api = inject(CourseOutcomeApi);

  /** Sayfa ile paylaşılan bağlam; aynı örneği sayfa `providers`'ından alıyoruz. */
  readonly context = inject(OfferingContextStore);

  private readonly _items = signal<readonly CourseOutcome[]>([]);
  private readonly _loading = signal(false);
  private readonly _saving = signal(false);
  private readonly _feedback = signal<StoreFeedback | null>(null);

  readonly items = this._items.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly saving = this._saving.asReadonly();
  readonly feedback = this._feedback.asReadonly();

  readonly search = signal('');

  readonly filtered = computed(() => {
    const term = this.search().trim().toLocaleLowerCase('tr-TR');
    if (term.length === 0) return this._items();

    return this._items().filter(
      (item) =>
        item.code.toLocaleLowerCase('tr-TR').includes(term) ||
        item.description.toLocaleLowerCase('tr-TR').includes(term),
    );
  });

  /**
   * Kullanılmış kodlar; diyalog sunucuya gitmeden uyarabilsin diye.
   * Sunucu da denetliyor — bu yalnızca erken geri bildirim.
   */
  readonly usedCodes = computed(() =>
    this._items().map((item) => item.code.trim().toLocaleUpperCase('tr-TR')),
  );

  clearFeedback(): void {
    this._feedback.set(null);
  }

  /** Seçili açılışın çıktılarını getirir. Açılış seçili değilse liste boşalır. */
  async load(): Promise<void> {
    const offeringId = this.context.offeringId();

    if (offeringId === null) {
      this._items.set([]);
      return;
    }

    this._loading.set(true);

    try {
      this._items.set(await firstValueFrom(this.api.getByOffering(offeringId)));
    } catch (error) {
      this._items.set([]);
      this._feedback.set({ severity: 'error', text: toMessage(error) });
    } finally {
      this._loading.set(false);
    }
  }

  async create(command: Omit<CourseOutcomeCreateCommand, 'courseInSemesterId'>): Promise<boolean> {
    const offeringId = this.context.offeringId();
    if (offeringId === null) return false;

    return this.run(() =>
      firstValueFrom(this.api.create({ ...command, courseInSemesterId: offeringId })),
    );
  }

  async update(command: CourseOutcomeUpdateCommand): Promise<boolean> {
    const offeringId = this.context.offeringId();
    if (offeringId === null) return false;

    return this.run(() => firstValueFrom(this.api.update(offeringId, command)));
  }

  async remove(id: number): Promise<boolean> {
    return this.run(() => firstValueFrom(this.api.remove(id)));
  }

  private async run(action: () => Promise<string>): Promise<boolean> {
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
