import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiFailure } from '@core/api/api-result.model';
import { OfferingContextStore } from '@shared/data-access/offering-context.store';
import { OfferingAdminApi } from '@features/admin/offerings/data-access/offering-admin.api';
import {
  OfferingActivity,
  OfferingActivityItemCreateCommand,
  OfferingActivityItemUpdateCommand,
  OfferingDetail,
} from '@features/admin/offerings/data-access/offering.models';

export interface StoreFeedback {
  readonly severity: 'success' | 'error';
  readonly text: string;
}

/**
 * DEĞERLENDİRME ETKİNLİKLERİ — hocanın soru ekranı.
 *
 * Etkinliğin KENDİSİ burada açılmaz: etkinlikler açılışın iskeletidir ve dönem
 * başında ders açılışı ekranından girilir. Burada yapılan iş **soru yazmaktır** —
 * hoca sınavı dönem ortasında yazar ve sorularını o zaman ekler.
 *
 * TAM PUAN ZORUNLU: çıktı hesabının paydası, bir çıktıya bağlı soruların tam
 * puanları toplamıdır. Sıfır tam puanlı bir soru kümesi paydayı sıfıra düşürür ve
 * hesap reddedilir — sunucu da aynı kuralı uyguluyor.
 *
 * Yazma uçları ders açılışının komut servisinde: soru açılışın parçası, tek yazar
 * orası. Bu ekran o servisi çağırıyor, ikinci bir yazar açmıyor.
 */
@Injectable()
export class ActivityItemsStore {
  private readonly api = inject(OfferingAdminApi);

  readonly context = inject(OfferingContextStore);

  private readonly _detail = signal<OfferingDetail | null>(null);
  private readonly _loading = signal(false);
  private readonly _saving = signal(false);
  private readonly _feedback = signal<StoreFeedback | null>(null);

  readonly detail = this._detail.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly saving = this._saving.asReadonly();
  readonly feedback = this._feedback.asReadonly();

  readonly activities = computed<readonly OfferingActivity[]>(
    () => this._detail()?.activities ?? [],
  );

  /**
   * Tam puanı girilmemiş sorular. Ekranın asıl uyarısı bu: hesabın hangi soru
   * yüzünden duracağını, hesap koşmadan önce göstermek gerekiyor.
   */
  readonly itemsWithoutMaxPoint = computed(() =>
    this.activities().flatMap((activity) =>
      activity.items
        .filter((item) => item.maxPoint <= 0)
        .map((item) => ({ activityName: activity.name, itemName: item.name })),
    ),
  );

  /** Hiç sorusu olmayan etkinlikler; sınavı henüz yazılmamış demektir. */
  readonly activitiesWithoutItems = computed(() =>
    this.activities().filter((activity) => activity.items.length === 0),
  );

  readonly totalItemCount = computed(() =>
    this.activities().reduce((sum, activity) => sum + activity.items.length, 0),
  );

  clearFeedback(): void {
    this._feedback.set(null);
  }

  async load(): Promise<void> {
    const offeringId = this.context.offeringId();

    if (offeringId === null) {
      this._detail.set(null);
      return;
    }

    this._loading.set(true);

    try {
      this._detail.set(await firstValueFrom(this.api.getById(offeringId)));
    } catch (error) {
      this._detail.set(null);
      this._feedback.set({ severity: 'error', text: toMessage(error) });
    } finally {
      this._loading.set(false);
    }
  }

  async addItem(activityId: number, command: OfferingActivityItemCreateCommand): Promise<boolean> {
    return this.run(() => firstValueFrom(this.api.addActivityItem(activityId, command)));
  }

  async updateItem(itemId: number, command: OfferingActivityItemUpdateCommand): Promise<boolean> {
    return this.run(() => firstValueFrom(this.api.updateActivityItem(itemId, command)));
  }

  async removeItem(itemId: number): Promise<boolean> {
    return this.run(() => firstValueFrom(this.api.removeActivityItem(itemId)));
  }

  private async run(action: () => Promise<unknown>): Promise<boolean> {
    this._saving.set(true);
    this._feedback.set(null);

    try {
      const message = await action();
      await this.load();

      this._feedback.set({
        severity: 'success',
        text: typeof message === 'string' ? message : 'Kaydedildi.',
      });
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
