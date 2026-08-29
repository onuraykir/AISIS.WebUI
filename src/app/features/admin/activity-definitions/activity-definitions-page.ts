import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';

import { ConfirmationService } from 'primeng/api';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Message } from 'primeng/message';
import { Skeleton } from 'primeng/skeleton';
import { Tooltip } from 'primeng/tooltip';

import { HasAction } from '@shared/directives/has-action';
import { AdminFilterBar } from '../shared/admin-filter-bar/admin-filter-bar';
import { AdminToolbar } from '../shared/admin-toolbar/admin-toolbar';
import { ActivityDefinitionStore } from './data-access/activity-definition.store';
import { ActivityDefinition } from './data-access/activity-definition.models';
import {
  ActivityDefinitionDialog,
  ActivityDefinitionFormResult,
} from './ui/activity-definition-dialog';

/**
 * Etkinlik Tanımları ekranı (akıllı bileşen).
 *
 * ORTAK SÖZLÜK: vize, final, ödev… Ders açılışına etkinlik eklenirken buradan
 * seçilir. Sayfa 120 "Değerlendirme Etkinlikleri" ile karıştırılmamalı — orası
 * bir açılışın kendi yapısı, burası hangi türlerin var olduğu.
 *
 * Tek sütun: satır kod, ad ve kullanım sayısını zaten taşıyor; künye paneli
 * gösterecek fazladan bir şey bulamazdı.
 */
@Component({
  selector: 'app-activity-definitions-page',
  imports: [
    ConfirmDialog,
    Message,
    Skeleton,
    Tooltip,
    HasAction,
    AdminToolbar,
    AdminFilterBar,
    ActivityDefinitionDialog,
  ],
  providers: [ActivityDefinitionStore, ConfirmationService],
  templateUrl: './activity-definitions-page.html',
  styleUrl: './activity-definitions-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityDefinitionsPage implements OnInit {
  private readonly confirmation = inject(ConfirmationService);

  protected readonly store = inject(ActivityDefinitionStore);

  protected readonly dialogOpen = signal(false);
  protected readonly definitionInDialog = signal<ActivityDefinition | null>(null);

  private searchTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.searchTimer));
  }

  ngOnInit(): void {
    void this.store.load();
  }

  protected reload(): void {
    void this.store.load();
  }

  /** Süzme sunucuda; her tuş vuruşunda istek atılmaz. */
  protected onSearchChange(value: string): void {
    this.store.search.set(value);

    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => void this.store.load(), 350);
  }

  protected clearFilters(): void {
    clearTimeout(this.searchTimer);
    this.store.search.set('');
    void this.store.load();
  }

  protected openCreate(): void {
    this.definitionInDialog.set(null);
    this.dialogOpen.set(true);
  }

  protected openEdit(definition: ActivityDefinition): void {
    this.definitionInDialog.set(definition);
    this.dialogOpen.set(true);
  }

  protected async onSave(result: ActivityDefinitionFormResult): Promise<void> {
    const ok =
      result.mode === 'create'
        ? await this.store.create(result.command)
        : await this.store.update(this.definitionInDialog()!.id, result.command);

    if (ok) {
      this.dialogOpen.set(false);
    }
  }

  protected confirmDelete(definition: ActivityDefinition): void {
    this.confirmation.confirm({
      header: 'Tanımı sil',
      message: `"${definition.name}" tanımı silinecek. Devam edilsin mi?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sil',
      rejectLabel: 'Vazgeç',
      acceptButtonStyleClass: 'p-button-danger p-button-sm',
      rejectButtonStyleClass: 'p-button-text p-button-sm',
      accept: () => void this.store.remove(definition.id),
    });
  }

  /** Silme neden engelli? Boşsa serbest. */
  protected deleteBlockedReason(definition: ActivityDefinition): string | null {
    return definition.usageCount > 0
      ? `${definition.usageCount} ders açılışında kullanılıyor. Silinemez; o açılışların etkinlikleri adsız kalırdı.`
      : null;
  }
}
