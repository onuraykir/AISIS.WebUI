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
import { PickerDialog, PickerItem } from '../shared/picker-dialog/picker-dialog';
import { CourseStore } from './data-access/course.store';
import { CourseDepartment, CourseInstructor, CourseListItem } from './data-access/course.models';
import { CourseDepartmentDialog, CourseDepartmentFormValue } from './ui/course-department-dialog';
import { CourseFormDialog, CourseFormResult } from './ui/course-form-dialog';

/**
 * Dersler ekranı (akıllı bileşen).
 *
 * DÖNEM YOK: bir dersin bir dönemde açılması ayrı bir kayıt ve ayrı bir ekran
 * (Ders Açılışı). Burada tanım, müfredat bağı ve "verebilecek hocalar" havuzu var.
 */
@Component({
  selector: 'app-courses-page',
  imports: [
    FormsModule,
    ConfirmDialog,
    Message,
    Select,
    Skeleton,
    Tooltip,
    HasAction,
    AdminToolbar,
    AdminFilterBar,
    PickerDialog,
    CourseFormDialog,
    CourseDepartmentDialog,
  ],
  providers: [CourseStore, ConfirmationService],
  templateUrl: './courses-page.html',
  styleUrl: './courses-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CoursesPage implements OnInit {
  private readonly confirmation = inject(ConfirmationService);

  protected readonly store = inject(CourseStore);

  protected readonly formOpen = signal(false);
  protected readonly departmentDialogOpen = signal(false);
  protected readonly instructorPickerOpen = signal(false);

  protected readonly editing = signal(false);
  protected readonly linkInDialog = signal<CourseDepartment | null>(null);

  /** Hoca seçicisinin kendi araması; istemcide süzülüyor, liste küçük. */
  protected readonly instructorSearch = signal('');

  protected readonly detail = this.store.detail;

  protected readonly departmentFilterOptions = computed(() => [
    { value: null as number | null, label: 'Tüm bölümler' },
    ...this.store.departmentOptions().map((option) => ({
      value: option.value as number | null,
      label: option.label,
    })),
  ]);

  /**
   * Yeterlilik havuzuna eklenebilecek hocalar.
   * Zaten listede olanlar gerekçesiyle kapalı gelir — gizlemek yerine açıklıyoruz.
   */
  protected readonly instructorCandidates = computed<PickerItem[]>(() => {
    const already = new Set(this.detail()?.qualifiedInstructors.map((i) => i.instructorId) ?? []);
    const needle = this.instructorSearch().trim().toLocaleLowerCase('tr-TR');

    return this.store
      .instructors()
      .filter(
        (instructor) =>
          needle.length === 0 ||
          instructor.fullName.toLocaleLowerCase('tr-TR').includes(needle) ||
          instructor.registryNumber.toLocaleLowerCase('tr-TR').includes(needle),
      )
      .map((instructor) => ({
        id: instructor.id,
        title: `${instructor.academicTitle} ${instructor.fullName}`.trim(),
        subtitle: instructor.primaryDepartmentName || 'Birim bağı yok',
        badges: [{ text: instructor.registryNumber, tone: 'muted' as const }],
        disabled: already.has(instructor.id),
        disabledReason: already.has(instructor.id) ? 'Zaten listede.' : undefined,
      }));
  });

  protected readonly deleteBlockedReason = computed<string | null>(() => {
    const course = this.detail();
    if (!course) {
      return null;
    }

    return course.offeringCount > 0
      ? `Bu ders ${course.offeringCount} dönemde açılmış. Silinemez; geçmiş açılışlar not ve çıktı kayıtlarının dayanağı.`
      : null;
  });

  private searchTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.searchTimer));
  }

  ngOnInit(): void {
    void this.store.load();
    void this.store.loadLookups();
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

  protected select(item: CourseListItem): void {
    void this.store.select(item.id);
  }

  // ── Ders ──

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

  protected async onFormSave(result: CourseFormResult): Promise<void> {
    const ok =
      result.mode === 'create'
        ? await this.store.create(result.command)
        : await this.store.update(this.detail()!.id, result.command);

    if (ok) {
      this.formOpen.set(false);
    }
  }

  protected confirmDelete(): void {
    const course = this.detail();
    if (!course) {
      return;
    }

    this.confirmation.confirm({
      header: 'Dersi sil',
      message: `"${course.courseCode} — ${course.name}" silinecek. Devam edilsin mi?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sil',
      rejectLabel: 'Vazgeç',
      acceptButtonStyleClass: 'p-button-danger p-button-sm',
      rejectButtonStyleClass: 'p-button-text p-button-sm',
      accept: () => void this.store.remove(course.id),
    });
  }

  // ── Müfredat bağı ──

  protected openAddDepartment(): void {
    this.linkInDialog.set(null);
    this.departmentDialogOpen.set(true);
  }

  protected openEditDepartment(link: CourseDepartment): void {
    this.linkInDialog.set(link);
    this.departmentDialogOpen.set(true);
  }

  protected async onDepartmentSave(value: CourseDepartmentFormValue): Promise<void> {
    const editing = this.linkInDialog();

    const ok = editing
      ? await this.store.updateDepartment(editing.id, {
          isRequired: value.isRequired,
          recommendedTerm: value.recommendedTerm,
        })
      : await this.store.addDepartment(this.detail()!.id, value);

    if (ok) {
      this.departmentDialogOpen.set(false);
    }
  }

  protected async removeDepartment(link: CourseDepartment): Promise<void> {
    await this.store.removeDepartment(link.id);
  }

  // ── Verebilecek hocalar ──

  protected openInstructorPicker(): void {
    this.instructorSearch.set('');
    this.instructorPickerOpen.set(true);
  }

  protected async onInstructorsPicked(instructorIds: number[]): Promise<void> {
    if (await this.store.addInstructors(this.detail()!.id, instructorIds)) {
      this.instructorPickerOpen.set(false);
    }
  }

  protected async removeInstructor(instructor: CourseInstructor): Promise<void> {
    await this.store.removeInstructor(instructor.id);
  }
}
