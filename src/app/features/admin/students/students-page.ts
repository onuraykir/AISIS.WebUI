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
import { StudentEndKind } from './data-access/student-admin.api';
import { StudentStore } from './data-access/student.store';
import {
  ENROLLMENT_END_REASON_LABELS,
  ENROLLMENT_KIND_LABELS,
  EnrollmentCloseCommand,
  EnrollmentKind,
  STUDENT_LEVEL_LABELS,
  STUDENT_STATUS_LABELS,
  StudentEndCommand,
  StudentEnrollment,
  StudentListItem,
  StudentStatus,
} from './data-access/student.models';
import { EnrollmentCloseDialog } from './ui/enrollment-close-dialog';
import { StudentEndDialog } from './ui/student-end-dialog';
import {
  StudentEnrollmentDialog,
  StudentEnrollmentFormValue,
} from './ui/student-enrollment-dialog';
import { StudentFormDialog, StudentFormResult } from './ui/student-form-dialog';

/** Kayıt seviyesindeki dört sonlandırma ucunun ekrandaki karşılığı. */
interface EndOption {
  readonly kind: StudentEndKind;
  readonly action: 'GRADUATE' | 'WITHDRAW' | 'DISMISS' | 'TRANSFER';
  readonly label: string;
  readonly heading: string;
  readonly description: string;
  readonly danger: boolean;
}

const END_OPTIONS: readonly EndOption[] = [
  {
    kind: 'graduate',
    action: 'GRADUATE',
    label: 'Mezun Et',
    heading: 'Öğrenciyi Mezun Et',
    description: 'Öğrencilik mezuniyetle kapanacak ve mezuniyet tarihi bu tarih olacak.',
    danger: false,
  },
  {
    kind: 'withdraw',
    action: 'WITHDRAW',
    label: 'Ayrılış İşle',
    heading: 'Ayrılışı İşle',
    description: 'Öğrenci kendi isteğiyle ayrıldı olarak kaydedilecek.',
    danger: false,
  },
  {
    kind: 'transfer',
    action: 'TRANSFER',
    label: 'Nakil',
    heading: 'Nakil İşle',
    description: 'Öğrenci başka bir kuruma naklen ayrıldı olarak kaydedilecek.',
    danger: false,
  },
  {
    kind: 'dismiss',
    action: 'DISMISS',
    label: 'Kaydını Sil',
    heading: 'Kaydı Sil',
    description: 'Öğrencilik idari kararla sonlandırılacak. Bu ağır bir işlemdir.',
    danger: true,
  },
];

/**
 * Öğrenciler ekranı (akıllı bileşen).
 *
 * Personel ekranlarıyla aynı iskelet, iki yerde ayrışıyor:
 *
 * 1. **Anadal ayrı bir kutu değil**, kayıt türünden okunuyor.
 * 2. **Sonlandırma iki seviyeli (K-D)**: bir bölüm kaydı kapanabilir (ÇAP'tan
 *    mezun olmak) ya da öğrenciliğin tamamı kapanabilir. İkincisi dört ayrı uç
 *    ve dört ayrı yetkidir — kayıt silmek mezun etmekle aynı şey değildir.
 *
 * Ayrıca kayıt dondurma var: sonlandırma değil, kayıt açık kalıyor.
 */
@Component({
  selector: 'app-students-page',
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
    StudentFormDialog,
    StudentEnrollmentDialog,
    EnrollmentCloseDialog,
    StudentEndDialog,
  ],
  providers: [StudentStore],
  templateUrl: './students-page.html',
  styleUrl: './students-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StudentsPage implements OnInit {
  protected readonly store = inject(StudentStore);

  protected readonly formOpen = signal(false);
  protected readonly enrollmentOpen = signal(false);
  protected readonly closeOpen = signal(false);
  protected readonly endOpen = signal(false);

  protected readonly enrollmentInDialog = signal<StudentEnrollment | null>(null);
  protected readonly enrollmentToClose = signal<StudentEnrollment | null>(null);
  protected readonly endOption = signal<EndOption | null>(null);

  /** Düzenleme diyaloğu künyeden beslenir; liste satırında tüm alanlar yok. */
  protected readonly editing = signal(false);

  protected readonly detail = this.store.detail;
  protected readonly endOptions = END_OPTIONS;

  protected readonly openStates = [
    { value: true, label: 'Yalnızca açık' },
    { value: false, label: 'Yalnızca kapanmış' },
    { value: null, label: 'Hepsi' },
  ];

  protected readonly departmentFilterOptions = computed(() => [
    { value: null as number | null, label: 'Tüm bölümler', disabled: false },
    ...this.store.departmentOptions().map((option) => ({
      value: option.value as number | null,
      label: option.label,
      disabled: false,
    })),
  ]);

  /** Öğrencilik kapalıysa yazma eylemlerinin hepsi anlamsız. */
  protected readonly recordClosed = computed(() => this.detail()?.isOpen === false);

  protected readonly onLeave = computed(() => this.detail()?.status === StudentStatus.OnLeave);

  /**
   * Diyaloğa açılırken düzenlenen kaydın DIŞINDA bir açık anadal var mı?
   * Varsa "anadal" seçimi sunucuda reddedilir; kullanıcı önceden uyarılıyor.
   */
  protected readonly hasOtherOpenPrimary = computed(() => {
    const editing = this.enrollmentInDialog();

    return (
      this.detail()?.enrollments.some(
        (enrollment) =>
          enrollment.isOpen &&
          enrollment.enrollmentKind === EnrollmentKind.Primary &&
          enrollment.id !== editing?.id,
      ) ?? false
    );
  });

  protected readonly closeDescription = computed(() => {
    const enrollment = this.enrollmentToClose();
    if (!enrollment) {
      return '';
    }

    return (
      `"${enrollment.departmentName}" bölümündeki ` +
      `${ENROLLMENT_KIND_LABELS[enrollment.enrollmentKind] ?? 'kayıt'} kapanacak.`
    );
  });

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

  protected select(item: StudentListItem): void {
    void this.store.select(item.id);
  }

  // ── Etiketler ──

  protected statusLabel(status: number): string {
    return STUDENT_STATUS_LABELS[status] ?? '—';
  }

  protected kindLabel(enrollment: StudentEnrollment): string {
    return ENROLLMENT_KIND_LABELS[enrollment.enrollmentKind] ?? '—';
  }

  protected levelLabel(enrollment: StudentEnrollment): string {
    return STUDENT_LEVEL_LABELS[enrollment.level] ?? '—';
  }

  protected endReasonLabel(enrollment: StudentEnrollment): string {
    return enrollment.endReason === null
      ? ''
      : (ENROLLMENT_END_REASON_LABELS[enrollment.endReason] ?? '—');
  }

  protected isOnLeave(item: StudentListItem): boolean {
    return item.status === StudentStatus.OnLeave;
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

  protected async onFormSave(result: StudentFormResult): Promise<void> {
    const ok =
      result.mode === 'create'
        ? await this.store.create(result.command)
        : await this.store.update(this.detail()!.id, result.command);

    if (ok) {
      this.formOpen.set(false);
    }
  }

  // ── Bölüm kayıtları ──

  protected openAddEnrollment(): void {
    this.enrollmentInDialog.set(null);
    this.enrollmentOpen.set(true);
  }

  protected openEditEnrollment(enrollment: StudentEnrollment): void {
    this.enrollmentInDialog.set(enrollment);
    this.enrollmentOpen.set(true);
  }

  protected async onEnrollmentSave(value: StudentEnrollmentFormValue): Promise<void> {
    const editing = this.enrollmentInDialog();

    const ok = editing
      ? await this.store.updateEnrollment(editing.id, {
          level: value.level,
          enrollmentKind: value.enrollmentKind,
          startDate: value.startDate,
        })
      : await this.store.addEnrollment(this.detail()!.id, {
          departmentId: value.departmentId,
          level: value.level,
          enrollmentKind: value.enrollmentKind,
          startDate: value.startDate,
        });

    if (ok) {
      this.enrollmentOpen.set(false);
    }
  }

  protected openCloseEnrollment(enrollment: StudentEnrollment): void {
    this.enrollmentToClose.set(enrollment);
    this.closeOpen.set(true);
  }

  protected async onEnrollmentClose(command: EnrollmentCloseCommand): Promise<void> {
    const enrollment = this.enrollmentToClose();
    if (!enrollment) {
      return;
    }

    if (await this.store.closeEnrollment(enrollment.id, command)) {
      this.closeOpen.set(false);
    }
  }

  // ── Öğrenciliğin tamamı ──

  protected openEnd(option: EndOption): void {
    this.endOption.set(option);
    this.endOpen.set(true);
  }

  protected async onEndSave(command: StudentEndCommand): Promise<void> {
    const option = this.endOption();
    if (!option) {
      return;
    }

    if (await this.store.end(this.detail()!.id, option.kind, command)) {
      this.endOpen.set(false);
    }
  }

  protected async toggleLeave(): Promise<void> {
    await this.store.setOnLeave(this.detail()!.id, !this.onLeave());
  }
}
