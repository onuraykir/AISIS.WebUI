import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiFailure } from '@core/api/api-result.model';
import { ActivityDefinitionAdminApi } from '@features/admin/activity-definitions/data-access/activity-definition-admin.api';
import { ActivityDefinition } from '@features/admin/activity-definitions/data-access/activity-definition.models';
import { SemesterAdminApi } from '@features/admin/semesters/data-access/semester-admin.api';
import {
  SemesterListItem,
  SemesterStatus,
} from '@features/admin/semesters/data-access/semester.models';
import { OfferingAdminApi } from './offering-admin.api';
import {
  AvailableCourse,
  BulkAssignResult,
  CourseInstructorRoleValue,
  InstructorCandidate,
  OfferingActivityCreateCommand,
  OfferingActivityItemCreateCommand,
  OfferingActivityItemUpdateCommand,
  OfferingActivityUpdateCommand,
  OfferingDetail,
  OfferingListItem,
  StudentCandidate,
} from './offering.models';

export interface StoreFeedback {
  readonly severity: 'success' | 'error' | 'warn';
  readonly text: string;
}

/**
 * Ders Açılışı ekranının durumu.
 *
 * BAĞLAM DÖNEMDİR: ekran açılırken güncel döneme düşer, kullanıcı üstteki
 * seçiciden değiştirebilir. Aday listeleri sunucudan gelir ve süzgeçleri de
 * sunucuda çalışır — sınıf listeleri büyüyebilir.
 */
@Injectable()
export class OfferingStore {
  private readonly api = inject(OfferingAdminApi);
  private readonly semesterApi = inject(SemesterAdminApi);
  private readonly definitionApi = inject(ActivityDefinitionAdminApi);

  private readonly _semesters = signal<readonly SemesterListItem[]>([]);
  private readonly _items = signal<readonly OfferingListItem[]>([]);
  private readonly _detail = signal<OfferingDetail | null>(null);
  private readonly _selectedId = signal<number | null>(null);

  private readonly _availableCourses = signal<readonly AvailableCourse[]>([]);
  private readonly _instructorCandidates = signal<readonly InstructorCandidate[]>([]);
  private readonly _studentCandidates = signal<readonly StudentCandidate[]>([]);
  private readonly _activityDefinitions = signal<readonly ActivityDefinition[]>([]);

  private readonly _loading = signal(false);
  private readonly _detailLoading = signal(false);
  private readonly _pickerLoading = signal(false);
  private readonly _saving = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _feedback = signal<StoreFeedback | null>(null);

  readonly semesters = this._semesters.asReadonly();
  readonly items = this._items.asReadonly();
  readonly detail = this._detail.asReadonly();
  readonly selectedId = this._selectedId.asReadonly();
  readonly availableCourses = this._availableCourses.asReadonly();
  readonly instructorCandidates = this._instructorCandidates.asReadonly();
  readonly studentCandidates = this._studentCandidates.asReadonly();
  readonly activityDefinitions = this._activityDefinitions.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly detailLoading = this._detailLoading.asReadonly();
  readonly pickerLoading = this._pickerLoading.asReadonly();
  readonly saving = this._saving.asReadonly();
  readonly error = this._error.asReadonly();
  readonly feedback = this._feedback.asReadonly();

  // ── Bağlam ve süzgeçler ──
  readonly semesterId = signal<number | null>(null);
  readonly search = signal('');

  readonly semester = computed(
    () => this._semesters().find((s) => s.id === this.semesterId()) ?? null,
  );

  readonly semesterOptions = computed(() =>
    this._semesters().map((s) => ({
      value: s.id,
      label: s.isCurrent ? `${s.name} (güncel)` : s.name,
    })),
  );

  /**
   * Dönem ders açılışına yazmaya açık mı? Sunucu da tutuyor; ekran düğmeleri
   * baştan kapatabilsin diye burada da hesaplanıyor.
   */
  readonly semesterWritable = computed(() => {
    const status = this.semester()?.status;
    return status === SemesterStatus.Planned || status === SemesterStatus.Open;
  });

  /**
   * Değerlendirme yapısı, açılışın kendisinden DAHA GENİŞ bir kapıdan geçer:
   * not girişi fazı tam da sınavın yapıldığı ve etkinliğin girildiği zamandır.
   * Yalnızca kapalı dönem donuktur. Sunucudaki `SemesterRules.CheckActivityWritable`
   * ile aynı kural.
   */
  readonly activityWritable = computed(() => {
    const status = this.semester()?.status;
    return status !== undefined && status !== SemesterStatus.Closed;
  });

  readonly activityLockReason = computed(() => {
    const semester = this.semester();
    return !semester || this.activityWritable()
      ? null
      : `"${semester.name}" kapatılmış; değerlendirme yapısı değiştirilemez.`;
  });

  readonly semesterLockReason = computed(() => {
    const semester = this.semester();
    if (!semester || this.semesterWritable()) {
      return null;
    }

    return semester.status === SemesterStatus.Grading
      ? `"${semester.name}" not girişinde; ders açılışı değiştirilemez.`
      : `"${semester.name}" kapatılmış; ders açılışı değiştirilemez.`;
  });

  readonly total = computed(() => this._items().length);
  readonly totalStudents = computed(() =>
    this._items().reduce((sum, item) => sum + item.studentCount, 0),
  );

  /** Hocası atanmamış açılışlar: dönem başlamadan kapatılması gereken boşluk. */
  readonly withoutInstructorCount = computed(
    () => this._items().filter((item) => item.instructorCount === 0).length,
  );

  clearFeedback(): void {
    this._feedback.set(null);
  }

  /** Dönem listesi bir kez çekilir; güncel dönem varsayılan bağlam olur. */
  async loadSemesters(): Promise<void> {
    try {
      const semesters = await firstValueFrom(
        this.semesterApi.getList({ status: null, search: '' }),
      );

      this._semesters.set(semesters);

      if (this.semesterId() === null) {
        const current = semesters.find((s) => s.isCurrent) ?? semesters[0];
        this.semesterId.set(current?.id ?? null);
      }
    } catch (error) {
      this._semesters.set([]);
      this._error.set(toMessage(error));
    }
  }

  async load(): Promise<void> {
    if (this.semesterId() === null) {
      this._items.set([]);
      return;
    }

    this._loading.set(true);
    this._error.set(null);

    try {
      const items = await firstValueFrom(this.api.getList(this.semesterId(), this.search()));
      this._items.set(items);

      const id = this._selectedId();
      if (id !== null && !items.some((item) => item.id === id)) {
        this._selectedId.set(null);
        this._detail.set(null);
      }
    } catch (error) {
      this._items.set([]);
      this._error.set(toMessage(error));
    } finally {
      this._loading.set(false);
    }
  }

  async select(id: number | null): Promise<void> {
    this._selectedId.set(id);

    if (id === null) {
      this._detail.set(null);
      return;
    }

    this._detailLoading.set(true);

    try {
      this._detail.set(await firstValueFrom(this.api.getById(id)));
    } catch (error) {
      this._detail.set(null);
      this._feedback.set({ severity: 'error', text: toMessage(error) });
    } finally {
      this._detailLoading.set(false);
    }
  }

  // ── Ders açma ──

  async loadAvailableCourses(departmentId: number | null, search: string): Promise<void> {
    this._pickerLoading.set(true);

    try {
      this._availableCourses.set(
        await firstValueFrom(this.api.getAvailableCourses(this.semesterId(), departmentId, search)),
      );
    } catch (error) {
      this._availableCourses.set([]);
      this._feedback.set({ severity: 'error', text: toMessage(error) });
    } finally {
      this._pickerLoading.set(false);
    }
  }

  async openCourses(courseIds: readonly number[]): Promise<boolean> {
    const semesterId = this.semesterId();
    if (semesterId === null) {
      return false;
    }

    return this.runBulk(() => firstValueFrom(this.api.create(semesterId, courseIds)));
  }

  async removeOffering(id: number): Promise<boolean> {
    const ok = await this.runCommand(() => firstValueFrom(this.api.remove(id)));

    if (ok && this._selectedId() === id) {
      this._selectedId.set(null);
      this._detail.set(null);
    }

    return ok;
  }

  // ── Hoca ──

  async loadInstructorCandidates(offeringId: number): Promise<void> {
    this._pickerLoading.set(true);

    try {
      this._instructorCandidates.set(
        await firstValueFrom(this.api.getInstructorCandidates(offeringId)),
      );
    } catch (error) {
      this._instructorCandidates.set([]);
      this._feedback.set({ severity: 'error', text: toMessage(error) });
    } finally {
      this._pickerLoading.set(false);
    }
  }

  /**
   * Seçilen hocaları atar.
   * <para>
   * Uç TEK hoca alıyor (her birinin rolü ayrı olabilir); seçim çoklu olduğu için
   * istekler sırayla atılıp sonuç birleştirilir. Biri başarısız olsa bile kalanlar
   * denenir — ne olduğunu söylemek "hiçbiri olmadı" demekten yararlı.
   * </para>
   */
  async assignInstructors(
    offeringId: number,
    instructorIds: readonly number[],
    role: CourseInstructorRoleValue,
  ): Promise<boolean> {
    this._saving.set(true);
    this._feedback.set(null);

    let added = 0;
    const failures: string[] = [];

    for (const instructorId of instructorIds) {
      try {
        await firstValueFrom(this.api.addInstructor(offeringId, instructorId, role));
        added++;
      } catch (error) {
        failures.push(toMessage(error));
      }
    }

    await this.refresh();
    this._saving.set(false);

    this._feedback.set(
      failures.length === 0
        ? { severity: 'success', text: `${added} öğretim elemanı derse atandı.` }
        : {
            severity: 'warn',
            text: `${added} atandı, ${failures.length} atanamadı. ${[...new Set(failures)].join(' ')}`,
          },
    );

    return added > 0;
  }

  async updateInstructorRole(
    assignmentId: number,
    role: CourseInstructorRoleValue,
  ): Promise<boolean> {
    return this.runCommand(() => firstValueFrom(this.api.updateInstructorRole(assignmentId, role)));
  }

  async removeInstructor(assignmentId: number): Promise<boolean> {
    return this.runCommand(() => firstValueFrom(this.api.removeInstructor(assignmentId)));
  }

  // ── Öğrenci ──

  async loadStudentCandidates(
    offeringId: number,
    departmentId: number | null,
    search: string,
  ): Promise<void> {
    this._pickerLoading.set(true);

    try {
      this._studentCandidates.set(
        await firstValueFrom(this.api.getStudentCandidates(offeringId, departmentId, search)),
      );
    } catch (error) {
      this._studentCandidates.set([]);
      this._feedback.set({ severity: 'error', text: toMessage(error) });
    } finally {
      this._pickerLoading.set(false);
    }
  }

  async addStudents(offeringId: number, studentIds: readonly number[]): Promise<boolean> {
    return this.runBulk(() => firstValueFrom(this.api.addStudents(offeringId, studentIds)));
  }

  async removeStudent(enrollmentId: number): Promise<boolean> {
    return this.runCommand(() => firstValueFrom(this.api.removeStudent(enrollmentId)));
  }

  // ── Değerlendirme etkinliği ──

  /** Ortak sözlük bir kez çekilir; seçim ekranı bundan beslenir. */
  async loadActivityDefinitions(): Promise<void> {
    if (this._activityDefinitions().length > 0) {
      return;
    }

    try {
      this._activityDefinitions.set(await firstValueFrom(this.definitionApi.getList('')));
    } catch (error) {
      this._activityDefinitions.set([]);
      this._feedback.set({ severity: 'error', text: toMessage(error) });
    }
  }

  async addActivity(offeringId: number, command: OfferingActivityCreateCommand): Promise<boolean> {
    return this.runCommand(async () => {
      await firstValueFrom(this.api.addActivity(offeringId, command));
      return 'Etkinlik açılışa eklendi.';
    });
  }

  async updateActivity(
    activityId: number,
    command: OfferingActivityUpdateCommand,
  ): Promise<boolean> {
    return this.runCommand(() => firstValueFrom(this.api.updateActivity(activityId, command)));
  }

  async removeActivity(activityId: number): Promise<boolean> {
    return this.runCommand(() => firstValueFrom(this.api.removeActivity(activityId)));
  }

  // ── Sorular ──
  //
  // TAM PUAN NEDEN ÖNEMLİ: çıktı hesabının paydası, bir çıktıya bağlı soruların tam
  // puanları toplamıdır. Excel'den doğan sorular sıfır tam puanla geliyor ve o hâl
  // hesabı engelliyor; bu üçlü, paydayı düzeltmenin tek yolu.

  async addActivityItem(
    activityId: number,
    command: OfferingActivityItemCreateCommand,
  ): Promise<boolean> {
    return this.runCommand(async () => {
      await firstValueFrom(this.api.addActivityItem(activityId, command));
      return `${command.name} sorusu eklendi.`;
    });
  }

  async updateActivityItem(
    itemId: number,
    command: OfferingActivityItemUpdateCommand,
  ): Promise<boolean> {
    return this.runCommand(() => firstValueFrom(this.api.updateActivityItem(itemId, command)));
  }

  async removeActivityItem(itemId: number): Promise<boolean> {
    return this.runCommand(() => firstValueFrom(this.api.removeActivityItem(itemId)));
  }

  /**
   * Tam puanı girilmemiş soru sayısı. Sıfırdan büyükse çıktı hesabı KOŞMAZ:
   * o soruların bağlı olduğu çıktının paydası sıfıra düşer.
   */
  readonly itemsMissingMaxPoint = computed(
    () =>
      this._detail()
        ?.activities.flatMap((activity) => activity.items)
        .filter((item) => item.maxPoint <= 0).length ?? 0,
  );

  // ── Ortak kabuklar ──

  /**
   * Toplu işlemin sonucunu gösterir. ATLANANLAR SESSİZCE YUTULMAZ: sunucu her
   * atlanan satırın gerekçesini döndürüyor, kullanıcı hepsini görüyor.
   */
  private async runBulk(action: () => Promise<BulkAssignResult>): Promise<boolean> {
    this._saving.set(true);
    this._feedback.set(null);

    try {
      const result = await action();
      await this.refresh();

      this._feedback.set(
        result.skippedCount === 0
          ? { severity: 'success', text: `${result.addedCount} kayıt eklendi.` }
          : {
              severity: 'warn',
              text:
                `${result.addedCount} eklendi, ${result.skippedCount} atlandı — ` +
                result.skipped.join(' '),
            },
      );

      return result.addedCount > 0;
    } catch (error) {
      this._feedback.set({ severity: 'error', text: toMessage(error) });
      return false;
    } finally {
      this._saving.set(false);
    }
  }

  private async runCommand(action: () => Promise<string>): Promise<boolean> {
    this._saving.set(true);
    this._feedback.set(null);

    try {
      const message = await action();
      await this.refresh();

      this._feedback.set({ severity: 'success', text: message });
      return true;
    } catch (error) {
      this._feedback.set({ severity: 'error', text: toMessage(error) });
      return false;
    } finally {
      this._saving.set(false);
    }
  }

  /** Liste ve künyeyi birlikte tazeler; seçim korunur. */
  private async refresh(): Promise<void> {
    const selectedId = this._selectedId();

    await this.load();

    if (selectedId !== null && this._items().some((item) => item.id === selectedId)) {
      await this.select(selectedId);
    }
  }
}

function toMessage(error: unknown): string {
  return error instanceof ApiFailure ? error.message : 'Beklenmeyen bir hata oluştu.';
}
