import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ConfirmationService } from 'primeng/api';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Skeleton } from 'primeng/skeleton';
import { Tooltip } from 'primeng/tooltip';

import { HasAction } from '@shared/directives/has-action';
import { OfferingContextStore } from '@shared/data-access/offering-context.store';
import { CourseOutcomeStore } from './data-access/course-outcome.store';
import { CourseOutcome } from './data-access/course-outcome.models';
import { CourseOutcomeDialog, CourseOutcomeFormResult } from './ui/course-outcome-dialog';

/**
 * Ders Çıktıları ekranı (akıllı bileşen).
 *
 * ZİNCİRİN İLK HALKASI: çıktı olmadan eşleştirme matrisinde satır olmaz,
 * matris olmadan hesap koşmaz. Bu ekran yazılana kadar çıktılar yalnızca
 * eşleştirme ekranından, matrisin yan ürünü olarak doğabiliyordu.
 *
 * BAĞLAM AÇILIŞTIR (K-I/B): çıktı derse değil, dersin O DÖNEMKİ açılışına
 * bağlıdır. Bu yüzden ekran dönem ve açılış seçimiyle başlar; seçim yapılmadan
 * liste gösterilmez, çünkü "hangi dersin çıktısı" sorusunun cevabı olmadan
 * gösterilen her satır yanıltıcıdır.
 */
@Component({
  selector: 'app-course-outcomes-page',
  imports: [
    FormsModule,
    ConfirmDialog,
    Message,
    Select,
    Skeleton,
    Tooltip,
    HasAction,
    CourseOutcomeDialog,
  ],
  providers: [OfferingContextStore, CourseOutcomeStore, ConfirmationService],
  templateUrl: './course-outcomes-page.html',
  styleUrl: './course-outcomes-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CourseOutcomesPage implements OnInit {
  private readonly confirmation = inject(ConfirmationService);

  protected readonly store = inject(CourseOutcomeStore);
  protected readonly context = inject(OfferingContextStore);

  protected readonly dialogOpen = signal(false);
  protected readonly outcomeInDialog = signal<CourseOutcome | null>(null);

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

  protected reload(): void {
    void this.store.load();
  }

  protected openCreate(): void {
    this.outcomeInDialog.set(null);
    this.dialogOpen.set(true);
  }

  protected openEdit(outcome: CourseOutcome): void {
    this.outcomeInDialog.set(outcome);
    this.dialogOpen.set(true);
  }

  protected async onSave(result: CourseOutcomeFormResult): Promise<void> {
    const editing = this.outcomeInDialog();

    const ok = editing
      ? await this.store.update({ id: editing.id, ...result })
      : await this.store.create(result);

    if (ok) this.dialogOpen.set(false);
  }

  protected confirmDelete(outcome: CourseOutcome): void {
    this.confirmation.confirm({
      header: 'Ders çıktısını sil',
      message:
        `"${outcome.code}" silinecek. Bu çıktının eşleştirme matrisindeki ağırlıkları ve ` +
        'soru bağları da anlamsız kalır; hesaplanmış sonuçları varsa geçmiş raporlarda ' +
        'bu çıktı görünmez olur.',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sil',
      rejectLabel: 'Vazgeç',
      acceptButtonStyleClass: 'p-button-danger p-button-sm',
      rejectButtonStyleClass: 'p-button-text p-button-sm',
      accept: () => void this.store.remove(outcome.id),
    });
  }
}
