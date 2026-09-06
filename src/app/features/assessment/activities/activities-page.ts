import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ConfirmationService } from 'primeng/api';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Skeleton } from 'primeng/skeleton';
import { Tooltip } from 'primeng/tooltip';

import { HasAction } from '@shared/directives/has-action';
import { OfferingContextStore } from '@shared/data-access/offering-context.store';
import {
  OfferingActivity,
  OfferingActivityItem,
} from '@features/admin/offerings/data-access/offering.models';
import {
  OfferingActivityItemDialog,
  OfferingActivityItemFormResult,
} from '@features/admin/offerings/ui/offering-activity-item-dialog';
import { ActivityItemsStore } from './data-access/activity-items.store';

/**
 * Değerlendirme Etkinlikleri — **hocanın soru ekranı**.
 *
 * Etkinliklerin kendisi burada açılmaz; onlar açılışın iskeleti ve dönem başında
 * ders açılışı ekranından girilir. Burada yapılan iş soru yazmaktır: gerçek hayatta
 * ders açıldığında syllabus bellidir, ama hoca sınavını dönem ortasında yazar ve
 * sorularını o zaman ekler.
 *
 * Bu yetki 157'den (bölümün ders açma ekranı) buraya taşındı — hoca sınavına soru
 * eklemek için bölümün ekranına gitmek zorunda kalmasın diye.
 */
@Component({
  selector: 'app-activities-page',
  imports: [
    FormsModule,
    ConfirmDialog,
    Message,
    Select,
    Skeleton,
    Tooltip,
    HasAction,
    OfferingActivityItemDialog,
  ],
  providers: [OfferingContextStore, ActivityItemsStore, ConfirmationService],
  templateUrl: './activities-page.html',
  styleUrl: './activities-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivitiesPage implements OnInit {
  private readonly confirmation = inject(ConfirmationService);

  protected readonly store = inject(ActivityItemsStore);
  protected readonly context = inject(OfferingContextStore);

  protected readonly itemDialogOpen = signal(false);
  protected readonly activityOfDialog = signal<OfferingActivity | null>(null);
  protected readonly itemInDialog = signal<OfferingActivityItem | null>(null);

  /**
   * Diyalogun çakışma uyarısı için: AYNI ETKİNLİKTEKİ soru adları.
   * Tekillik açılışın tamamında değil, etkinlik başına geçerli — iki farklı sınavda
   * "Q1" bulunabilir.
   */
  protected readonly usedItemNames = computed<readonly string[]>(() => {
    const activity = this.activityOfDialog();
    if (activity === null) return [];

    const editing = this.itemInDialog();

    return activity.items
      .filter((item) => item.id !== editing?.id)
      .map((item) => item.name);
  });

  ngOnInit(): void {
    void this.context.load();
  }

  protected onSemesterChange(semesterId: number | null): void {
    this.context.semesterId.set(semesterId);
    void this.context.loadOfferings().then(() => this.store.load());
  }

  protected onOfferingChange(offeringId: number | null): void {
    this.context.offeringId.set(offeringId);
    void this.store.load();
  }

  protected openItemCreate(activity: OfferingActivity): void {
    this.activityOfDialog.set(activity);
    this.itemInDialog.set(null);
    this.itemDialogOpen.set(true);
  }

  protected openItemEdit(activity: OfferingActivity, item: OfferingActivityItem): void {
    this.activityOfDialog.set(activity);
    this.itemInDialog.set(item);
    this.itemDialogOpen.set(true);
  }

  protected async onItemSave(result: OfferingActivityItemFormResult): Promise<void> {
    const activity = this.activityOfDialog();
    const item = this.itemInDialog();

    const ok =
      result.mode === 'create'
        ? activity !== null && (await this.store.addItem(activity.id, result.command))
        : item !== null && (await this.store.updateItem(item.id, result.command));

    if (ok) this.itemDialogOpen.set(false);
  }

  protected confirmRemoveItem(item: OfferingActivityItem): void {
    this.confirmation.confirm({
      header: 'Soruyu kaldır',
      message:
        `"${item.name}" silinecek. Çıktı matrisinde bu soruya bağlı çıktı varsa bağ da ` +
        'kopar; hesaplanmış sonuçlar bir sonraki hesapta değişir.',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sil',
      rejectLabel: 'Vazgeç',
      acceptButtonStyleClass: 'p-button-danger p-button-sm',
      rejectButtonStyleClass: 'p-button-text p-button-sm',
      accept: () => void this.store.removeItem(item.id),
    });
  }

  /** Puanı girilmiş soru silinemez: tek istekle not kaybı sessiz veri kaybıdır. */
  protected itemDeleteBlockedReason(item: OfferingActivityItem): string | null {
    return item.scoreCount > 0
      ? `${item.scoreCount} girilmiş puan var; önce puanları temizleyin.`
      : null;
  }
}
