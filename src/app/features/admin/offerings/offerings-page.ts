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
import { firstValueFrom } from 'rxjs';

import { ConfirmationService } from 'primeng/api';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Skeleton } from 'primeng/skeleton';
import { Tooltip } from 'primeng/tooltip';

import { PermissionService } from '@core/services/permission.service';
import { HasAction } from '@shared/directives/has-action';
import { AdminFilterBar } from '../shared/admin-filter-bar/admin-filter-bar';
import { AdminToolbar } from '../shared/admin-toolbar/admin-toolbar';
import { PickerDialog, PickerItem } from '../shared/picker-dialog/picker-dialog';
import { DepartmentAdminApi } from '../departments/data-access/department-admin.api';
import { DepartmentType } from '../departments/data-access/department.models';
import { ENROLLMENT_KIND_LABELS, EnrollmentKind } from '../students/data-access/student.models';
import { OfferingStore } from './data-access/offering.store';
import {
  COURSE_INSTRUCTOR_ROLE_LABELS,
  COURSE_INSTRUCTOR_ROLE_OPTIONS,
  CourseInstructorRole,
  CourseInstructorRoleValue,
  OfferingActivity,
  OfferingActivityItem,
  OfferingInstructor,
  OfferingListItem,
  OfferingStudent,
} from './data-access/offering.models';
import { OfferingActivityDialog, OfferingActivityFormResult } from './ui/offering-activity-dialog';
import {
  OfferingActivityItemDialog,
  OfferingActivityItemFormResult,
} from './ui/offering-activity-item-dialog';

/**
 * Ders Açılışı ekranı (akıllı bileşen).
 *
 * BAĞLAM DÖNEMDİR: üstte dönem seçicisi var, açılışta güncel döneme düşer.
 * Solda o dönemde açılan dersler, sağda seçili açılışın hocaları, sınıf listesi ve
 * değerlendirme yapısı.
 *
 * Üç seçim ekranı da aynı `app-picker-dialog` ile: ders, hoca, öğrenci. Etkinlik
 * ayrı bir form iletişim kutusu — tek tıkla seçilen bir şey değil, üç alanı var.
 */
@Component({
  selector: 'app-offerings-page',
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
    OfferingActivityDialog,
    OfferingActivityItemDialog,
  ],
  providers: [OfferingStore, ConfirmationService],
  templateUrl: './offerings-page.html',
  styleUrl: './offerings-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfferingsPage implements OnInit {
  private readonly confirmation = inject(ConfirmationService);
  private readonly departmentApi = inject(DepartmentAdminApi);
  private readonly permissions = inject(PermissionService);

  protected readonly store = inject(OfferingStore);

  protected readonly coursePickerOpen = signal(false);
  protected readonly instructorPickerOpen = signal(false);
  protected readonly studentPickerOpen = signal(false);
  protected readonly activityDialogOpen = signal(false);
  protected readonly activityInDialog = signal<OfferingActivity | null>(null);

  protected readonly itemDialogOpen = signal(false);
  protected readonly itemInDialog = signal<OfferingActivityItem | null>(null);

  /** Soru diyaloğunun bağlamı: hangi etkinliğin sorusu düzenleniyor. */
  protected readonly activityOfItemDialog = signal<OfferingActivity | null>(null);

  /** Seçim ekranlarının kendi süzgeçleri; hepsi sunucuda çalışıyor. */
  protected readonly courseSearch = signal('');
  protected readonly courseDepartmentId = signal<number | null>(null);
  protected readonly instructorSearch = signal('');
  protected readonly studentSearch = signal('');
  protected readonly studentDepartmentId = signal<number | null>(null);

  /** Toplu hoca atamasında uygulanacak rol; satır satır sonradan değişebilir. */
  protected readonly assignRole = signal<CourseInstructorRoleValue>(
    CourseInstructorRole.Instructor,
  );

  protected readonly detail = this.store.detail;
  protected readonly roleOptions = [...COURSE_INSTRUCTOR_ROLE_OPTIONS];

  /**
   * Rol seçicisi ayrı bir yetki. Yetkisi olmayan rolü DEĞİŞTİREMEZ ama GÖREBİLİR:
   * seçici yerine düz bir rozet basılır — bilgiyi gizlemek yerine eylemi kapatıyoruz.
   */
  protected readonly canEditRole = computed(() =>
    this.permissions.can('UPDATE', 'OFFERING_INSTRUCTOR'),
  );

  /**
   * Düzenlenen etkinliğin kendi adı çakışma sayılmaz; kalanlar sayılır.
   */
  protected readonly usedActivityNames = computed(() => {
    const editingId = this.activityInDialog()?.id ?? null;

    return (this.detail()?.activities ?? [])
      .filter((activity) => activity.id !== editingId)
      .map((activity) => activity.name);
  });

  /** Aynı etkinlik içindeki diğer soru adları; çakışma buradan okunuyor. */
  protected readonly usedItemNames = computed(
    () => this.activityOfItemDialog()?.items.map((item) => item.name) ?? [],
  );

  private readonly departments = signal<{ value: number | null; label: string }[]>([]);

  protected readonly departmentFilterOptions = computed(() => [
    { value: null as number | null, label: 'Tüm bölümler' },
    ...this.departments(),
  ]);

  /** Seçili açılışın dersi hangi bölümlerde? Öğrenci süzgeci bununla daraltılıyor. */
  protected readonly offeringDepartmentOptions = computed(() => {
    const names = this.detail()?.departmentNames ?? [];

    return [
      { value: null as number | null, label: 'Tüm bölümler' },
      ...this.departments().filter((d) => names.includes(d.label.split(' › ').pop() ?? d.label)),
    ];
  });

  // ── Seçim listeleri ──

  protected readonly courseItems = computed<PickerItem[]>(() =>
    this.store.availableCourses().map((course) => ({
      id: course.id,
      title: `${course.courseCode} — ${course.name}`,
      subtitle:
        course.departmentNames.length > 0
          ? course.departmentNames.join(' · ')
          : 'Hiçbir müfredatta değil',
      badges: [
        { text: `${course.akts} AKTS`, tone: 'muted' as const },
        ...(course.departmentNames.length === 0
          ? [
              {
                text: 'Müfredatsız',
                tone: 'warn' as const,
                tooltip: 'Açılsa bile aday öğrenci çıkmaz',
              },
            ]
          : []),
      ],
    })),
  );

  protected readonly instructorItems = computed<PickerItem[]>(() =>
    this.store.instructorCandidates().map((candidate) => ({
      id: candidate.instructorId,
      title: `${candidate.academicTitle} ${candidate.fullName}`.trim(),
      subtitle:
        candidate.departmentNames.length > 0
          ? candidate.departmentNames.join(' · ')
          : 'Açık birim görevi yok',
      badges: [
        ...(candidate.isQualified
          ? [
              {
                text: 'Verebilir',
                tone: 'brand' as const,
                tooltip: 'Ders tanımındaki yeterlilik listesinde',
              },
            ]
          : []),
        ...(candidate.isInCourseDepartment
          ? [{ text: 'Dersin bölümünde', tone: 'muted' as const }]
          : []),
        { text: candidate.registryNumber, tone: 'muted' as const },
      ],
    })),
  );

  protected readonly studentItems = computed<PickerItem[]>(() =>
    this.store.studentCandidates().map((candidate) => {
      const kind = candidate.matchedEnrollmentKind;

      return {
        id: candidate.studentId,
        title: `${candidate.studentNumber} — ${candidate.fullName}`,
        subtitle: `${candidate.matchedDepartmentName} · ${candidate.enrollmentYear} girişli`,
        badges: [
          {
            // ÇAP ve yandal ayrı renkte: aday listesine anadalından değil o bağdan
            // giriyorlar ve kullanıcı bunu görmeli.
            text: ENROLLMENT_KIND_LABELS[kind] ?? '—',
            tone: kind === EnrollmentKind.Primary ? ('muted' as const) : ('brand' as const),
            tooltip: 'Adaylığı doğuran kayıt',
          },
        ],
      };
    }),
  );

  private searchTimer?: ReturnType<typeof setTimeout>;
  private pickerTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.searchTimer);
      clearTimeout(this.pickerTimer);
    });
  }

  async ngOnInit(): Promise<void> {
    await this.store.loadSemesters();
    await this.store.load();

    try {
      const options = await firstValueFrom(this.departmentApi.getOptions(DepartmentType.Academic));
      this.departments.set(options.map((o) => ({ value: o.id, label: o.path })));
    } catch {
      this.departments.set([]);
    }
  }

  protected reload(): void {
    void this.store.load();
  }

  protected onSemesterChange(semesterId: number): void {
    this.store.semesterId.set(semesterId);
    void this.store.select(null);
    void this.store.load();
  }

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

  protected select(item: OfferingListItem): void {
    void this.store.select(item.id);
  }

  protected roleLabel(role: number): string {
    return COURSE_INSTRUCTOR_ROLE_LABELS[role] ?? '—';
  }

  // ── Ders açma ──

  protected openCoursePicker(): void {
    this.courseSearch.set('');
    this.courseDepartmentId.set(null);
    this.coursePickerOpen.set(true);
    void this.store.loadAvailableCourses(null, '');
  }

  /** Seçim ekranındaki arama sunucuda; yazarken beklenir. */
  protected onCourseSearchChange(value: string): void {
    this.courseSearch.set(value);
    this.debouncePicker(() =>
      this.store.loadAvailableCourses(this.courseDepartmentId(), this.courseSearch()),
    );
  }

  protected onCourseDepartmentChange(departmentId: number | null): void {
    this.courseDepartmentId.set(departmentId);
    void this.store.loadAvailableCourses(departmentId, this.courseSearch());
  }

  protected async onCoursesPicked(courseIds: number[]): Promise<void> {
    if (await this.store.openCourses(courseIds)) {
      this.coursePickerOpen.set(false);
    }
  }

  protected confirmRemoveOffering(item: OfferingListItem): void {
    this.confirmation.confirm({
      header: 'Açılışı kaldır',
      message:
        `"${item.courseCode}" bu dönemden kaldırılacak.` +
        (item.studentCount > 0 ? ` ${item.studentCount} kayıtlı öğrenci var.` : ''),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Kaldır',
      rejectLabel: 'Vazgeç',
      acceptButtonStyleClass: 'p-button-danger p-button-sm',
      rejectButtonStyleClass: 'p-button-text p-button-sm',
      accept: () => void this.store.removeOffering(item.id),
    });
  }

  // ── Hoca ──

  protected openInstructorPicker(): void {
    this.instructorSearch.set('');
    this.assignRole.set(CourseInstructorRole.Instructor);
    this.instructorPickerOpen.set(true);
    void this.store.loadInstructorCandidates(this.detail()!.id);
  }

  protected async onInstructorsPicked(instructorIds: number[]): Promise<void> {
    const ok = await this.store.assignInstructors(
      this.detail()!.id,
      instructorIds,
      this.assignRole(),
    );

    if (ok) {
      this.instructorPickerOpen.set(false);
    }
  }

  protected async onRoleChange(
    assignment: OfferingInstructor,
    role: CourseInstructorRoleValue,
  ): Promise<void> {
    if (role !== assignment.role) {
      await this.store.updateInstructorRole(assignment.id, role);
    }
  }

  protected async removeInstructor(assignment: OfferingInstructor): Promise<void> {
    await this.store.removeInstructor(assignment.id);
  }

  // ── Öğrenci ──

  protected openStudentPicker(): void {
    this.studentSearch.set('');
    this.studentDepartmentId.set(null);
    this.studentPickerOpen.set(true);
    void this.store.loadStudentCandidates(this.detail()!.id, null, '');
  }

  protected onStudentSearchChange(value: string): void {
    this.studentSearch.set(value);
    this.debouncePicker(() =>
      this.store.loadStudentCandidates(
        this.detail()!.id,
        this.studentDepartmentId(),
        this.studentSearch(),
      ),
    );
  }

  protected onStudentDepartmentChange(departmentId: number | null): void {
    this.studentDepartmentId.set(departmentId);
    void this.store.loadStudentCandidates(this.detail()!.id, departmentId, this.studentSearch());
  }

  protected async onStudentsPicked(studentIds: number[]): Promise<void> {
    if (await this.store.addStudents(this.detail()!.id, studentIds)) {
      this.studentPickerOpen.set(false);
    }
  }

  protected async removeStudent(student: OfferingStudent): Promise<void> {
    await this.store.removeStudent(student.id);
  }

  // ── Değerlendirme etkinliği ──

  protected openActivityCreate(): void {
    this.activityInDialog.set(null);
    this.activityDialogOpen.set(true);
    void this.store.loadActivityDefinitions();
  }

  protected openActivityEdit(activity: OfferingActivity): void {
    this.activityInDialog.set(activity);
    this.activityDialogOpen.set(true);
    void this.store.loadActivityDefinitions();
  }

  protected async onActivitySave(result: OfferingActivityFormResult): Promise<void> {
    const ok =
      result.mode === 'create'
        ? await this.store.addActivity(this.detail()!.id, result.command)
        : await this.store.updateActivity(this.activityInDialog()!.id, result.command);

    if (ok) {
      this.activityDialogOpen.set(false);
    }
  }

  protected confirmRemoveActivity(activity: OfferingActivity): void {
    this.confirmation.confirm({
      header: 'Etkinliği kaldır',
      message:
        `"${activity.name}" bu açılıştan kaldırılacak.` +
        (activity.itemCount > 0 ? ` Altındaki ${activity.itemCount} soru da gidecek.` : ''),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Kaldır',
      rejectLabel: 'Vazgeç',
      acceptButtonStyleClass: 'p-button-danger p-button-sm',
      rejectButtonStyleClass: 'p-button-text p-button-sm',
      accept: () => void this.store.removeActivity(activity.id),
    });
  }

  // ── Sorular ──
  //
  // TAM PUAN NEDEN BURADA: çıktı hesabının paydası, bir ders çıktısına bağlı
  // soruların tam puanları toplamıdır. Sorular not Excel'inden sıfır tam puanla
  // doğuyor (dosyada alan yok) ve sıfır payda hesabı tümden engelliyor — düzeltmenin
  // tek yolu bu ekran.

  protected openItemCreate(activity: OfferingActivity): void {
    this.activityOfItemDialog.set(activity);
    this.itemInDialog.set(null);
    this.itemDialogOpen.set(true);
  }

  protected openItemEdit(activity: OfferingActivity, item: OfferingActivityItem): void {
    this.activityOfItemDialog.set(activity);
    this.itemInDialog.set(item);
    this.itemDialogOpen.set(true);
  }

  protected async onItemSave(result: OfferingActivityItemFormResult): Promise<void> {
    const ok =
      result.mode === 'create'
        ? await this.store.addActivityItem(this.activityOfItemDialog()!.id, result.command)
        : await this.store.updateActivityItem(this.itemInDialog()!.id, result.command);

    if (ok) {
      this.itemDialogOpen.set(false);
    }
  }

  protected confirmRemoveItem(item: OfferingActivityItem): void {
    this.confirmation.confirm({
      header: 'Soruyu kaldır',
      message: `"${item.name}" sorusu kaldırılacak. Çıktı eşleştirmesindeki bağları da gider.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Kaldır',
      rejectLabel: 'Vazgeç',
      acceptButtonStyleClass: 'p-button-danger p-button-sm',
      rejectButtonStyleClass: 'p-button-text p-button-sm',
      accept: () => void this.store.removeActivityItem(item.id),
    });
  }

  /** Sorunun silinmesi neden engelli? Boşsa serbest. */
  protected itemDeleteBlockedReason(item: OfferingActivityItem): string | null {
    if (!this.store.activityWritable()) {
      return this.store.activityLockReason();
    }

    return item.scoreCount > 0
      ? `${item.scoreCount} girilmiş puan var. Soru silinemez; önce puanları temizleyin.`
      : null;
  }

  /** Silme neden engelli? Boşsa serbest. */
  protected activityDeleteBlockedReason(activity: OfferingActivity): string | null {
    if (!this.store.activityWritable()) {
      return this.store.activityLockReason();
    }

    return activity.scoreCount > 0
      ? `${activity.scoreCount} girilmiş puan var. Etkinlik silinemez; önce puanları temizleyin.`
      : null;
  }

  /** Seçim ekranı aramaları da sunucuda; her tuş vuruşunda istek atılmaz. */
  private debouncePicker(action: () => Promise<void>): void {
    clearTimeout(this.pickerTimer);
    this.pickerTimer = setTimeout(() => void action(), 350);
  }
}
