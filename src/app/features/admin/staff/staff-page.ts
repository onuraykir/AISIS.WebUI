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
import { ActivatedRoute } from '@angular/router';

import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Skeleton } from 'primeng/skeleton';
import { Tooltip } from 'primeng/tooltip';

import { HasAction } from '@shared/directives/has-action';
import { AdminFilterBar } from '../shared/admin-filter-bar/admin-filter-bar';
import { AdminToolbar } from '../shared/admin-toolbar/admin-toolbar';
import { AssignmentCloseDialog } from '../shared/assignment-close-dialog/assignment-close-dialog';
import {
  ASSIGNMENT_END_REASON_LABELS,
  AssignmentCloseCommand,
} from '../shared/person/membership.models';
import { StaffStore } from './data-access/staff.store';
import {
  ADMINISTRATIVE_DUTY_LABELS,
  StaffAssignment,
  StaffListItem,
} from './data-access/staff.models';
import { StaffAssignmentDialog, StaffAssignmentFormValue } from './ui/staff-assignment-dialog';
import { StaffFormDialog, StaffFormResult } from './ui/staff-form-dialog';

/** Kapatma diyaloğunun neyi kapattığı. Aynı gövde, iki farklı iş. */
type CloseIntent =
  | { readonly kind: 'assignment'; readonly assignment: StaffAssignment }
  | { readonly kind: 'record' };

/**
 * Çalışanlar ekranı (akıllı bileşen).
 *
 * Solda GÖREV DÖNEMİ listesi — kişi listesi değil. Aynı kişinin birden fazla
 * satırı olabilir; sağdaki künye seçili dönemin birim bağlarını gösterir.
 *
 * SİLME YOK: kayıt silinmez, sonlandırılır. Geçmiş kayıtlar akreditasyon
 * hesaplarına dayanak olabiliyor.
 */
@Component({
  selector: 'app-staff-page',
  imports: [
    SlicePipe,
    FormsModule,
    Message,
    Select,
    Skeleton,
    Tooltip,
    HasAction,
    AdminToolbar,
    AdminFilterBar,
    StaffFormDialog,
    StaffAssignmentDialog,
    AssignmentCloseDialog,
  ],
  providers: [StaffStore],
  templateUrl: './staff-page.html',
  styleUrl: './staff-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StaffPage implements OnInit {
  protected readonly store = inject(StaffStore);

  protected readonly formOpen = signal(false);
  protected readonly assignmentOpen = signal(false);
  protected readonly closeOpen = signal(false);

  protected readonly assignmentInDialog = signal<StaffAssignment | null>(null);
  protected readonly closeIntent = signal<CloseIntent | null>(null);

  /** Düzenleme diyaloğu künyeden beslenir; liste satırında tüm alanlar yok. */
  protected readonly editing = signal(false);

  protected readonly detail = this.store.detail;

  protected readonly openStates = [
    { value: true, label: 'Yalnızca açık' },
    { value: false, label: 'Yalnızca kapanmış' },
    { value: null, label: 'Hepsi' },
  ];

  /** Süzgeç seçicisi için birim listesi; başına "hepsi" seçeneği eklenir. */
  protected readonly departmentFilterOptions = computed(() => [
    { value: null as number | null, label: 'Tüm birimler', disabled: false },
    ...this.store.departmentOptions().map((option) => ({
      value: option.value as number | null,
      label: option.label,
      disabled: false,
    })),
  ]);

  protected readonly closeHeading = computed(() =>
    this.closeIntent()?.kind === 'record' ? 'Görev Dönemini Sonlandır' : 'Görevi Kapat',
  );

  protected readonly closeDescription = computed(() => {
    const intent = this.closeIntent();
    if (!intent) {
      return '';
    }

    if (intent.kind === 'record') {
      const open = this.detail()?.assignments.filter((a) => a.isOpen).length ?? 0;
      return (
        'Görev dönemi kapanacak ve kalan ' +
        `${open} açık birim bağı aynı sebeple kapatılacak. ` +
        'Kayıt silinmez; geçmişiyle birlikte listede kalır.'
      );
    }

    return `"${intent.assignment.departmentName}" birimindeki görev kapanacak. Görev dönemi açık kalır.`;
  });

  /** Görev dönemi kapalıysa yazma eylemlerinin hepsi anlamsız. */
  protected readonly recordClosed = computed(() => this.detail()?.isOpen === false);

  private readonly route = inject(ActivatedRoute);

  private searchTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    // Ekrandan çıkılırken bekleyen istek iptal edilir; aksi hâlde sayfa yok
    // olduktan sonra bir yükleme daha tetiklenirdi.
    inject(DestroyRef).onDestroy(() => clearTimeout(this.searchTimer));
  }

  ngOnInit(): void {
    // Kişiler ekranından "şeride git" ile gelinmiş olabilir. Gelen TCKN aramaya
    // konur ve açıklık süzgeci KALDIRILIR: hub geçmiş kayıtları da gösteriyor,
    // buraya gelince kaybolmaları şaşırtıcı olurdu.
    const incoming = this.route.snapshot.queryParamMap.get('ara');
    if (incoming) {
      this.store.search.set(incoming);
      this.store.onlyOpen.set(null);
    }

    void this.store.load();
    void this.store.loadDepartments();
  }

  protected reload(): void {
    void this.store.load();
  }

  protected applyFilters(): void {
    clearTimeout(this.searchTimer);
    void this.store.load();
  }

  /**
   * Metin süzgeci yazarken beklenir.
   *
   * Süzme sunucuda yapılıyor; her tuş vuruşunda istek atmak listeyi tek harflik
   * eşleşmelerle doldurup boşaltırdı ve yanıtlar sırasız dönebilirdi.
   */
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

  protected select(item: StaffListItem): void {
    void this.store.select(item.id);
  }

  protected dutyLabel(assignment: StaffAssignment): string {
    return ADMINISTRATIVE_DUTY_LABELS[assignment.duty] ?? '—';
  }

  protected endReasonLabel(assignment: StaffAssignment): string {
    return assignment.endReason === null
      ? ''
      : (ASSIGNMENT_END_REASON_LABELS[assignment.endReason] ?? '—');
  }

  // ── Künye ──

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

  protected async onFormSave(result: StaffFormResult): Promise<void> {
    const ok =
      result.mode === 'create'
        ? await this.store.create(result.command)
        : await this.store.update(this.detail()!.id, result.command);

    if (ok) {
      this.formOpen.set(false);
    }
  }

  // ── Görev bağları ──

  protected openAddAssignment(): void {
    this.assignmentInDialog.set(null);
    this.assignmentOpen.set(true);
  }

  protected openEditAssignment(assignment: StaffAssignment): void {
    this.assignmentInDialog.set(assignment);
    this.assignmentOpen.set(true);
  }

  protected async onAssignmentSave(value: StaffAssignmentFormValue): Promise<void> {
    const editing = this.assignmentInDialog();

    const ok = editing
      ? await this.store.updateAssignment(editing.id, {
          duty: value.duty,
          isPrimary: value.isPrimary,
          startDate: value.startDate,
        })
      : await this.store.addAssignment(this.detail()!.id, {
          departmentId: value.departmentId,
          duty: value.duty,
          isPrimary: value.isPrimary,
          startDate: value.startDate,
        });

    if (ok) {
      this.assignmentOpen.set(false);
    }
  }

  // ── Kapatma ve sonlandırma ──

  protected openCloseAssignment(assignment: StaffAssignment): void {
    this.closeIntent.set({ kind: 'assignment', assignment });
    this.closeOpen.set(true);
  }

  protected openEndRecord(): void {
    this.closeIntent.set({ kind: 'record' });
    this.closeOpen.set(true);
  }

  protected async onCloseSave(command: AssignmentCloseCommand): Promise<void> {
    const intent = this.closeIntent();
    if (!intent) {
      return;
    }

    const ok =
      intent.kind === 'record'
        ? await this.store.end(this.detail()!.id, command)
        : await this.store.closeAssignment(intent.assignment.id, command);

    if (ok) {
      this.closeOpen.set(false);
    }
  }
}
