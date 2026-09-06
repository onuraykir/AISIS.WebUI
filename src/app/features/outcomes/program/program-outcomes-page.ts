import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ConfirmationService } from 'primeng/api';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Message } from 'primeng/message';
import { Skeleton } from 'primeng/skeleton';
import { Tooltip } from 'primeng/tooltip';

import { HasAction } from '@shared/directives/has-action';
import { ProgramOutcomeStore } from './data-access/program-outcome.store';
import { ProgramOutcome } from './data-access/program-outcome.models';
import { ProgramOutcomeDialog, ProgramOutcomeFormResult } from './ui/program-outcome-dialog';

/**
 * Program Çıktıları ekranı (akıllı bileşen).
 *
 * Program çıktısı derse değil **programa** aittir ve sürümlenir. Ders çıktılarıyla
 * karıştırılmamalı: ders çıktısı bir açılışın kazanımı, program çıktısı mezunun
 * yeterliliği.
 *
 * Listede her satırın yanında **eşik durumu** duruyor. Sebebi somut: yürürlükte
 * eşiği olmayan bir program çıktısı çıktı hesabını **durdurur**, o yüzden eksikliğin
 * burada görünmesi gerekiyor — eşik ekranına gidip tek tek bakmak gerekmemeli.
 */
@Component({
  selector: 'app-program-outcomes-page',
  imports: [
    FormsModule,
    ConfirmDialog,
    Message,
    Skeleton,
    Tooltip,
    HasAction,
    ProgramOutcomeDialog,
  ],
  providers: [ProgramOutcomeStore, ConfirmationService],
  templateUrl: './program-outcomes-page.html',
  styleUrl: './program-outcomes-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgramOutcomesPage implements OnInit {
  private readonly confirmation = inject(ConfirmationService);

  protected readonly store = inject(ProgramOutcomeStore);

  protected readonly dialogOpen = signal(false);
  protected readonly outcomeInDialog = signal<ProgramOutcome | null>(null);

  ngOnInit(): void {
    void this.store.load();
  }

  protected reload(): void {
    void this.store.load();
  }

  protected select(outcome: ProgramOutcome): void {
    void this.store.select(outcome.id);
  }

  protected openCreate(): void {
    this.outcomeInDialog.set(null);
    this.dialogOpen.set(true);
  }

  protected openEdit(outcome: ProgramOutcome): void {
    this.outcomeInDialog.set(outcome);
    this.dialogOpen.set(true);
  }

  protected async onSave(result: ProgramOutcomeFormResult): Promise<void> {
    const editing = this.outcomeInDialog();

    const ok = editing
      ? await this.store.update(editing.id, { id: editing.id, ...result })
      : await this.store.create(result);

    if (ok) this.dialogOpen.set(false);
  }

  protected confirmDelete(outcome: ProgramOutcome): void {
    this.confirmation.confirm({
      header: 'Program çıktısını sil',
      message:
        `"${outcome.code}" silinecek. Bu çıktıya bağlı eşikler ve ders eşleştirmeleri de ` +
        'etkilenir; geçmiş dönemlerin raporları bu çıktıya dayanıyorsa okunamaz hâle gelir.',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sil',
      rejectLabel: 'Vazgeç',
      acceptButtonStyleClass: 'p-button-danger p-button-sm',
      rejectButtonStyleClass: 'p-button-text p-button-sm',
      accept: () => void this.store.remove(outcome.id),
    });
  }
}
