import { SlicePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ConfirmationService } from 'primeng/api';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Skeleton } from 'primeng/skeleton';
import { Tooltip } from 'primeng/tooltip';

import { HasAction } from '@shared/directives/has-action';
import { AdminFilterBar } from '../shared/admin-filter-bar/admin-filter-bar';
import { AdminToolbar } from '../shared/admin-toolbar/admin-toolbar';
import { SemesterStore } from './data-access/semester.store';
import {
  SEMESTER_STATUS_HINTS,
  SEMESTER_STATUS_LABELS,
  SEMESTER_STATUS_OPTIONS,
  SemesterClosure,
  SemesterListItem,
  SemesterStatus,
} from './data-access/semester.models';
import { SemesterFormDialog, SemesterFormResult } from './ui/semester-form-dialog';

/**
 * Dönemler ekranı (akıllı bileşen).
 *
 * Dönem, ders açılışlarının ve not girişinin bağlamı. İki kural ekranda görünür
 * olmalı: aynı anda yalnızca bir dönem AÇIK olabilir, ve yalnızca bir dönem
 * GÜNCEL olabilir. İkisi de veritabanında zorlanıyor; arayüz sadece anlatıyor.
 */
@Component({
  selector: 'app-semesters-page',
  imports: [
    SlicePipe,
    FormsModule,
    ConfirmDialog,
    Message,
    Select,
    Skeleton,
    Tooltip,
    HasAction,
    AdminToolbar,
    AdminFilterBar,
    SemesterFormDialog,
  ],
  providers: [SemesterStore, ConfirmationService],
  templateUrl: './semesters-page.html',
  styleUrl: './semesters-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SemestersPage implements OnInit {
  private readonly confirmation = inject(ConfirmationService);

  protected readonly store = inject(SemesterStore);

  protected readonly formOpen = signal(false);

  /** Düzenleme diyaloğu künyeden beslenir; liste satırında tüm alanlar yok. */
  protected readonly editing = signal(false);

  protected readonly detail = this.store.detail;

  /** K3 raporu: kapatılabilir mi, hangi açılışlar açık kaldı. */
  protected readonly closure = signal<SemesterClosure | null>(null);

  protected readonly statusFilterOptions = [
    { value: null as number | null, label: 'Tüm durumlar' },
    ...SEMESTER_STATUS_OPTIONS.map((option) => ({
      value: option.value as number | null,
      label: option.label,
    })),
  ];

  /** Açık dönemin adı; formda çakışma uyarısı buna bakar. */
  protected readonly openSemesterName = computed(() => this.store.openSemester()?.name ?? null);

  protected readonly statusHint = computed(() => {
    const status = this.detail()?.status;
    return status === undefined ? '' : (SEMESTER_STATUS_HINTS[status] ?? '');
  });

  /** Silme neden engelli? Boşsa serbest. */
  protected readonly deleteBlockedReason = computed<string | null>(() => {
    const semester = this.detail();
    if (!semester) {
      return null;
    }

    if (semester.isCurrent) {
      return 'Güncel dönem silinemez. Önce başka bir dönemi güncel yapın.';
    }

    return semester.linkedRecordCount > 0
      ? `Bu döneme bağlı ${semester.linkedRecordCount} kayıt var. Silinemez; kapatarak salt okunur hâle getirin.`
      : null;
  });

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

  protected applyFilters(): void {
    clearTimeout(this.searchTimer);
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
    this.store.resetFilters();
    void this.store.load();
  }

  protected select(item: SemesterListItem): void {
    this.closure.set(null);
    void this.store.select(item.id).then(() => this.loadClosure());
  }

  protected statusLabel(status: number): string {
    return SEMESTER_STATUS_LABELS[status] ?? '—';
  }

  /** Rozet sınıfı; dört durum dört farklı okuma. */
  protected statusClass(status: number): string {
    switch (status) {
      case SemesterStatus.Open:
        return 'row__badge--open';
      case SemesterStatus.Grading:
        return 'row__badge--grading';
      case SemesterStatus.Closed:
        return 'row__badge--closed';
      default:
        return 'row__badge--planned';
    }
  }

  protected isClosed(): boolean {
    return this.detail()?.status === SemesterStatus.Closed;
  }

  // ── Komutlar ──

  protected openCreate(): void {
    this.editing.set(false);
    this.formOpen.set(true);
  }

  protected openEdit(): void {
    if (!this.detail()) {
      return;
    }
    this.editing.set(true);
    this.formOpen.set(true);
  }

  protected async onFormSave(result: SemesterFormResult): Promise<void> {
    const ok =
      result.mode === 'create'
        ? await this.store.create(result.command)
        : await this.store.update(this.detail()!.id, result.command);

    if (ok) {
      this.formOpen.set(false);
    }
  }

  protected async makeCurrent(): Promise<void> {
    await this.store.setCurrent(this.detail()!.id);
  }

  // ── Dönem kapanışı ──
  //
  // K3 raporu künye AÇILDIĞINDA çekiliyor: "kapatabilir miyim" sorusunun cevabı
  // düğmeye basmadan önce görünmeli, hangi açılışların açık kaldığı dahil.

  protected async loadClosure(): Promise<void> {
    const semester = this.detail();

    if (!semester || semester.status === SemesterStatus.Closed) {
      this.closure.set(null);
      return;
    }

    this.closure.set(await this.store.closurePreview(semester.id));
  }

  protected confirmClose(): void {
    const semester = this.detail();
    const report = this.closure();
    if (!semester || !report) return;

    this.confirmation.confirm({
      header: 'Dönemi kapat',
      message:
        `"${semester.name}" kapatılacak ve öğrencilerin dersler ötesi program çıktısı ` +
        'sonuçları yeniden hesaplanacak. Kapalı dönem salt okunur olur.',
      icon: 'pi pi-lock',
      acceptLabel: 'Kapat',
      rejectLabel: 'Vazgeç',
      acceptButtonStyleClass: 'p-button-sm',
      rejectButtonStyleClass: 'p-button-text p-button-sm',
      accept: () => void this.store.close(semester.id).then(() => this.loadClosure()),
    });
  }

  /** Kapatma neden engelli? Boşsa serbest. */
  protected closeBlockedReason(): string | null {
    const report = this.closure();

    if (!report) return 'Kapanış durumu yükleniyor.';
    if (report.isClosed) return 'Dönem zaten kapalı.';

    return report.canClose
      ? null
      : `${report.openOfferings.length} ders açılışı hâlâ açık.`;
  }

  protected confirmDelete(): void {
    const semester = this.detail();
    if (!semester) {
      return;
    }

    this.confirmation.confirm({
      header: 'Dönemi sil',
      message: `"${semester.name}" dönemi silinecek. Devam edilsin mi?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sil',
      rejectLabel: 'Vazgeç',
      acceptButtonStyleClass: 'p-button-danger p-button-sm',
      rejectButtonStyleClass: 'p-button-text p-button-sm',
      accept: () => void this.store.remove(semester.id),
    });
  }
}
