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
import { InstructorStore } from './data-access/instructor.store';
import {
  ACADEMIC_DUTY_LABELS,
  InstructorAssignment,
  InstructorListItem,
} from './data-access/instructor.models';
import {
  InstructorAssignmentDialog,
  InstructorAssignmentFormValue,
} from './ui/instructor-assignment-dialog';
import { InstructorFormDialog, InstructorFormResult } from './ui/instructor-form-dialog';

/** Kapatma diyaloğunun neyi kapattığı. Aynı gövde, iki farklı iş. */
type CloseIntent =
  | { readonly kind: 'assignment'; readonly assignment: InstructorAssignment }
  | { readonly kind: 'record' };

/**
 * Öğretim Elemanları ekranı (akıllı bileşen).
 *
 * Çalışanlar ekranıyla aynı iskelet — iki şerit iki farklı dille anlatılmasın.
 * Fark alanlarda ve tek bir kuralda: aynı bölümde farklı görevler yan yana
 * yürüyebilir, çünkü akademik çakışma anahtarına GÖREV de giriyor.
 *
 * SİLME YOK: kayıt silinmez, sonlandırılır.
 */
@Component({
  selector: 'app-instructors-page',
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
    InstructorFormDialog,
    InstructorAssignmentDialog,
    AssignmentCloseDialog,
  ],
  providers: [InstructorStore],
  templateUrl: './instructors-page.html',
  styleUrl: './instructors-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InstructorsPage implements OnInit {
  protected readonly store = inject(InstructorStore);

  protected readonly formOpen = signal(false);
  protected readonly assignmentOpen = signal(false);
  protected readonly closeOpen = signal(false);

  protected readonly assignmentInDialog = signal<InstructorAssignment | null>(null);
  protected readonly closeIntent = signal<CloseIntent | null>(null);

  /** Düzenleme diyaloğu künyeden beslenir; liste satırında tüm alanlar yok. */
  protected readonly editing = signal(false);

  protected readonly detail = this.store.detail;

  protected readonly openStates = [
    { value: true, label: 'Yalnızca açık' },
    { value: false, label: 'Yalnızca kapanmış' },
    { value: null, label: 'Hepsi' },
  ];

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

    return (
      `"${intent.assignment.departmentName}" birimindeki ` +
      `${ACADEMIC_DUTY_LABELS[intent.assignment.duty] ?? 'görev'} kapanacak. ` +
      'Görev dönemi ve diğer bağlar açık kalır.'
    );
  });

  /** Görev dönemi kapalıysa yazma eylemlerinin hepsi anlamsız. */
  protected readonly recordClosed = computed(() => this.detail()?.isOpen === false);

  private readonly route = inject(ActivatedRoute);

  private searchTimer?: ReturnType<typeof setTimeout>;

  constructor() {
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

  protected select(item: InstructorListItem): void {
    void this.store.select(item.id);
  }

  protected dutyLabel(assignment: InstructorAssignment): string {
    return ACADEMIC_DUTY_LABELS[assignment.duty] ?? '—';
  }

  protected endReasonLabel(assignment: InstructorAssignment): string {
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

  protected async onFormSave(result: InstructorFormResult): Promise<void> {
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

  protected openEditAssignment(assignment: InstructorAssignment): void {
    this.assignmentInDialog.set(assignment);
    this.assignmentOpen.set(true);
  }

  protected async onAssignmentSave(value: InstructorAssignmentFormValue): Promise<void> {
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

  protected openCloseAssignment(assignment: InstructorAssignment): void {
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
