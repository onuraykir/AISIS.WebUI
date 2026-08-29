import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiFailure } from '@core/api/api-result.model';
import { DepartmentAdminApi } from '@features/admin/departments/data-access/department-admin.api';
import {
  DepartmentOption,
  DepartmentType,
} from '@features/admin/departments/data-access/department.models';
import { InstructorAdminApi } from '@features/admin/instructors/data-access/instructor-admin.api';
import { InstructorListItem } from '@features/admin/instructors/data-access/instructor.models';
import { CourseAdminApi } from './course-admin.api';
import {
  CourseCreateCommand,
  CourseDepartmentCreateCommand,
  CourseDepartmentUpdateCommand,
  CourseDetail,
  CourseListItem,
  CourseUpdateCommand,
} from './course.models';

export interface StoreFeedback {
  readonly severity: 'success' | 'error' | 'warn';
  readonly text: string;
}

/**
 * Dersler ekranının durumu.
 *
 * Üç şey bir arada yönetiliyor ama üçü ayrı yetki: ders tanımı, müfredat bağı ve
 * "verebilecek hocalar" havuzu.
 */
@Injectable()
export class CourseStore {
  private readonly api = inject(CourseAdminApi);
  private readonly departmentApi = inject(DepartmentAdminApi);
  private readonly instructorApi = inject(InstructorAdminApi);

  private readonly _items = signal<readonly CourseListItem[]>([]);
  private readonly _detail = signal<CourseDetail | null>(null);
  private readonly _selectedId = signal<number | null>(null);
  private readonly _departments = signal<readonly DepartmentOption[]>([]);
  private readonly _instructors = signal<readonly InstructorListItem[]>([]);

  private readonly _loading = signal(false);
  private readonly _detailLoading = signal(false);
  private readonly _saving = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _feedback = signal<StoreFeedback | null>(null);

  readonly items = this._items.asReadonly();
  readonly detail = this._detail.asReadonly();
  readonly selectedId = this._selectedId.asReadonly();
  readonly instructors = this._instructors.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly detailLoading = this._detailLoading.asReadonly();
  readonly saving = this._saving.asReadonly();
  readonly error = this._error.asReadonly();
  readonly feedback = this._feedback.asReadonly();

  // ── Süzgeçler ──
  readonly search = signal('');
  readonly departmentId = signal<number | null>(null);

  readonly filtersDirty = computed(
    () => this.search().trim().length > 0 || this.departmentId() !== null,
  );

  readonly total = computed(() => this._items().length);

  /** Hiçbir bölümün müfredatında olmayan dersler: açılsa bile öğrenci adayı çıkmaz. */
  readonly orphanCount = computed(
    () => this._items().filter((item) => item.departmentCount === 0).length,
  );

  /** Ders yalnızca AKADEMİK birimin müfredatına girebilir. */
  readonly departmentOptions = computed(() =>
    this._departments().map((option) => ({
      value: option.id,
      label: option.path,
      disabled: !option.isActive,
    })),
  );

  clearFeedback(): void {
    this._feedback.set(null);
  }

  resetFilters(): void {
    this.search.set('');
    this.departmentId.set(null);
  }

  async load(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const items = await firstValueFrom(
        this.api.getList({ departmentId: this.departmentId(), search: this.search() }),
      );

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

  async loadLookups(): Promise<void> {
    try {
      this._departments.set(
        await firstValueFrom(this.departmentApi.getOptions(DepartmentType.Academic)),
      );
    } catch {
      this._departments.set([]);
    }

    try {
      // Yeterlilik havuzuna yalnızca görevi süren hocalar eklenebilir.
      this._instructors.set(
        await firstValueFrom(
          this.instructorApi.getList({ departmentId: null, onlyOpen: true, search: '' }),
        ),
      );
    } catch {
      this._instructors.set([]);
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

  async create(command: CourseCreateCommand): Promise<boolean> {
    return this.runCommand(async () => {
      const created = await firstValueFrom(this.api.create(command));
      this._selectedId.set(created.id);
      return 'Ders oluşturuldu.';
    });
  }

  async update(id: number, command: CourseUpdateCommand): Promise<boolean> {
    return this.runCommand(() => firstValueFrom(this.api.update(id, command)));
  }

  async remove(id: number): Promise<boolean> {
    const ok = await this.runCommand(() => firstValueFrom(this.api.remove(id)));

    if (ok && this._selectedId() === id) {
      this._selectedId.set(null);
      this._detail.set(null);
    }

    return ok;
  }

  async addDepartment(courseId: number, command: CourseDepartmentCreateCommand): Promise<boolean> {
    return this.runCommand(async () => {
      await firstValueFrom(this.api.addDepartment(courseId, command));
      return 'Ders bölümün müfredatına eklendi.';
    });
  }

  async updateDepartment(linkId: number, command: CourseDepartmentUpdateCommand): Promise<boolean> {
    return this.runCommand(() => firstValueFrom(this.api.updateDepartment(linkId, command)));
  }

  async removeDepartment(linkId: number): Promise<boolean> {
    return this.runCommand(() => firstValueFrom(this.api.removeDepartment(linkId)));
  }

  /**
   * Yeterlilik havuzuna toplu ekleme.
   * <para>
   * Uç TEK hoca alıyor; seçim ekranı çoklu olduğu için istekler sırayla atılır ve
   * sonuç birleştirilir. Bir tanesi başarısız olsa bile kalanlar denenir —
   * "hiçbiri eklenmedi" demek yerine ne olduğunu söylemek daha yararlı.
   * </para>
   */
  async addInstructors(courseId: number, instructorIds: readonly number[]): Promise<boolean> {
    this._saving.set(true);
    this._feedback.set(null);

    let added = 0;
    const failures: string[] = [];

    for (const instructorId of instructorIds) {
      try {
        await firstValueFrom(this.api.addInstructor(courseId, instructorId));
        added++;
      } catch (error) {
        failures.push(toMessage(error));
      }
    }

    await this.load();
    if (this._selectedId() !== null) {
      await this.select(this._selectedId());
    }

    this._saving.set(false);

    this._feedback.set(
      failures.length === 0
        ? { severity: 'success', text: `${added} öğretim elemanı derse eklendi.` }
        : {
            severity: 'warn',
            text:
              `${added} eklendi, ${failures.length} eklenemedi. ` +
              [...new Set(failures)].join(' '),
          },
    );

    return added > 0;
  }

  async removeInstructor(linkId: number): Promise<boolean> {
    return this.runCommand(() => firstValueFrom(this.api.removeInstructor(linkId)));
  }

  /** Kaydet, listeyi ve künyeyi tazele, SUNUCUNUN mesajını göster. */
  private async runCommand(action: () => Promise<string>): Promise<boolean> {
    this._saving.set(true);
    this._feedback.set(null);

    const selectedId = this._selectedId();

    try {
      const message = await action();
      await this.load();

      if (selectedId !== null && this._items().some((item) => item.id === selectedId)) {
        await this.select(selectedId);
      }

      this._feedback.set({ severity: 'success', text: message });
      return true;
    } catch (error) {
      this._feedback.set({ severity: 'error', text: toMessage(error) });
      return false;
    } finally {
      this._saving.set(false);
    }
  }
}

function toMessage(error: unknown): string {
  return error instanceof ApiFailure ? error.message : 'Beklenmeyen bir hata oluştu.';
}
