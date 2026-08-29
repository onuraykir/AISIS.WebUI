import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiFailure } from '@core/api/api-result.model';
import { DepartmentAdminApi } from '@features/admin/departments/data-access/department-admin.api';
import {
  DepartmentOption,
  DepartmentType,
} from '@features/admin/departments/data-access/department.models';
import { StudentAdminApi, StudentEndKind } from './student-admin.api';
import {
  EnrollmentCloseCommand,
  StudentCreateCommand,
  StudentDetail,
  StudentEndCommand,
  StudentEnrollmentCreateCommand,
  StudentEnrollmentUpdateCommand,
  StudentListItem,
  StudentStatus,
  StudentUpdateCommand,
} from './student.models';

export interface StoreFeedback {
  readonly severity: 'success' | 'error' | 'warn';
  readonly text: string;
}

/**
 * Öğrenciler ekranının durumu. Personel şeritleriyle aynı kalıp; iki fark:
 *
 * 1. Birim seçicisi yalnızca AKADEMİK birimleri getirir — öğrenci idari birime
 *    kaydedilemez ve bu kural veritabanında zorunlu. Seçicide hiç görünmesin ki
 *    kullanıcı yanlış seçip hata almasın.
 * 2. Sonlandırma iki seviyeli: bir bölüm bağı kapanabilir (ÇAP'tan mezun olmak)
 *    ya da öğrenciliğin tamamı kapanabilir.
 */
@Injectable()
export class StudentStore {
  private readonly api = inject(StudentAdminApi);
  private readonly departmentApi = inject(DepartmentAdminApi);

  private readonly _items = signal<readonly StudentListItem[]>([]);
  private readonly _detail = signal<StudentDetail | null>(null);
  private readonly _selectedId = signal<number | null>(null);
  private readonly _departments = signal<readonly DepartmentOption[]>([]);

  private readonly _loading = signal(false);
  private readonly _detailLoading = signal(false);
  private readonly _saving = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _feedback = signal<StoreFeedback | null>(null);

  readonly items = this._items.asReadonly();
  readonly detail = this._detail.asReadonly();
  readonly selectedId = this._selectedId.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly detailLoading = this._detailLoading.asReadonly();
  readonly saving = this._saving.asReadonly();
  readonly error = this._error.asReadonly();
  readonly feedback = this._feedback.asReadonly();

  // ── Süzgeçler ──
  readonly search = signal('');
  readonly departmentId = signal<number | null>(null);
  readonly onlyOpen = signal<boolean | null>(true);

  readonly filtersDirty = computed(
    () =>
      this.search().trim().length > 0 || this.departmentId() !== null || this.onlyOpen() !== true,
  );

  readonly total = computed(() => this._items().length);
  readonly openCount = computed(() => this._items().filter((item) => item.isOpen).length);
  readonly closedCount = computed(() => this._items().filter((item) => !item.isOpen).length);

  /** Kaydı dondurulmuş sayısı: açık ama etkin değil. */
  readonly onLeaveCount = computed(
    () => this._items().filter((item) => item.status === StudentStatus.OnLeave).length,
  );

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
    this.onlyOpen.set(true);
  }

  async load(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const items = await firstValueFrom(
        this.api.getList({
          departmentId: this.departmentId(),
          onlyOpen: this.onlyOpen(),
          search: this.search(),
        }),
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

  /** Öğrenci yalnızca AKADEMİK birime kaydedilebilir (Ö1). */
  async loadDepartments(): Promise<void> {
    try {
      this._departments.set(
        await firstValueFrom(this.departmentApi.getOptions(DepartmentType.Academic)),
      );
    } catch {
      this._departments.set([]);
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

  async create(command: StudentCreateCommand): Promise<boolean> {
    this._saving.set(true);
    this._feedback.set(null);

    try {
      const created = await firstValueFrom(this.api.create(command));
      await this.load();
      await this.select(created.id);

      // Kimlik farkı hata değil uyarıdır (K-B).
      this._feedback.set(
        created.identityDifferences.length > 0
          ? {
              severity: 'warn',
              text:
                'Kayıt açıldı. Bu TCKN zaten kayıtlıydı ve girilen bilgiler farklı: ' +
                `${created.identityDifferences.join(' · ')}. ` +
                'Kayıtlı kimlik bilgisi korundu; düzeltme Kişiler ekranından yapılır.',
            }
          : {
              severity: 'success',
              text: created.personExisted
                ? 'Öğrencilik kaydı oluşturuldu; kişi zaten kayıtlıydı.'
                : 'Öğrencilik kaydı oluşturuldu.',
            },
      );

      return true;
    } catch (error) {
      this._feedback.set({ severity: 'error', text: toMessage(error) });
      return false;
    } finally {
      this._saving.set(false);
    }
  }

  async update(id: number, command: StudentUpdateCommand): Promise<boolean> {
    return this.runCommand(() => firstValueFrom(this.api.update(id, command)));
  }

  async addEnrollment(
    studentId: number,
    command: StudentEnrollmentCreateCommand,
  ): Promise<boolean> {
    return this.runCommand(async () => {
      await firstValueFrom(this.api.addEnrollment(studentId, command));
      return 'Bölüm kaydı eklendi.';
    });
  }

  async updateEnrollment(
    enrollmentId: number,
    command: StudentEnrollmentUpdateCommand,
  ): Promise<boolean> {
    return this.runCommand(() => firstValueFrom(this.api.updateEnrollment(enrollmentId, command)));
  }

  async closeEnrollment(enrollmentId: number, command: EnrollmentCloseCommand): Promise<boolean> {
    return this.runCommand(() => firstValueFrom(this.api.closeEnrollment(enrollmentId, command)));
  }

  async end(id: number, kind: StudentEndKind, command: StudentEndCommand): Promise<boolean> {
    return this.runCommand(() => firstValueFrom(this.api.end(id, kind, command)));
  }

  async setOnLeave(id: number, onLeave: boolean): Promise<boolean> {
    return this.runCommand(() => firstValueFrom(this.api.setOnLeave(id, onLeave)));
  }

  /** Kaydet, listeyi ve künyeyi tazele, SUNUCUNUN mesajını göster. */
  private async runCommand(action: () => Promise<string>): Promise<boolean> {
    this._saving.set(true);
    this._feedback.set(null);

    // Secim komuttan ONCE okunuyor: sonlandirma kaydi suzgecin disina cikarabilir
    // (varsayilan suzgec "yalnizca acik") ve load() secimi dusururdu. Kullanici az
    // once yaptigi isin sonucunu gormeli.
    const selectedId = this._selectedId();

    try {
      const message = await action();
      await this.load();

      if (selectedId !== null) {
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
