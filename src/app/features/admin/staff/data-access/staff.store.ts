import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiFailure } from '@core/api/api-result.model';
import { DepartmentAdminApi } from '@features/admin/departments/data-access/department-admin.api';
import {
  DepartmentOption,
  DepartmentType,
} from '@features/admin/departments/data-access/department.models';
import { AssignmentCloseCommand } from '@features/admin/shared/person/membership.models';
import { StaffAdminApi } from './staff-admin.api';
import {
  StaffAssignmentCreateCommand,
  StaffAssignmentUpdateCommand,
  StaffCreateCommand,
  StaffDetail,
  StaffListItem,
  StaffUpdateCommand,
} from './staff.models';

export interface StoreFeedback {
  readonly severity: 'success' | 'error' | 'warn';
  readonly text: string;
}

/**
 * Çalışanlar ekranının durumu.
 *
 * Liste ile künye AYRI çekiliyor: liste kayıt başına özet, künye seçili kaydın
 * bütün birim bağları. Bağları listeye gömmek her satırda kullanılmayan veri
 * taşırdı.
 *
 * SÜZME SUNUCUDA: liste zaten sayfalanmaya aday, istemcide süzmek yanlış sayı
 * gösterirdi. Süzgeç değişince liste yeniden çekilir.
 */
@Injectable()
export class StaffStore {
  private readonly api = inject(StaffAdminApi);
  private readonly departmentApi = inject(DepartmentAdminApi);

  private readonly _items = signal<readonly StaffListItem[]>([]);
  private readonly _detail = signal<StaffDetail | null>(null);
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
  readonly departments = this._departments.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly detailLoading = this._detailLoading.asReadonly();
  readonly saving = this._saving.asReadonly();
  readonly error = this._error.asReadonly();
  readonly feedback = this._feedback.asReadonly();

  // ── Süzgeçler ──
  readonly search = signal('');
  readonly departmentId = signal<number | null>(null);
  readonly onlyOpen = signal<boolean | null>(true);

  /** Varsayılan dışına çıkıldı mı? "Temizle" bağlantısı buna bakar. */
  readonly filtersDirty = computed(
    () =>
      this.search().trim().length > 0 || this.departmentId() !== null || this.onlyOpen() !== true,
  );

  readonly total = computed(() => this._items().length);
  readonly openCount = computed(() => this._items().filter((item) => item.isOpen).length);
  readonly closedCount = computed(() => this._items().filter((item) => !item.isOpen).length);

  /** Görev bağı seçicisinde yalnızca İDARİ birimler çıkar. */
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

      // Seçili kayıt süzgeç dışında kaldıysa künye paneli boşalır; aksi hâlde
      // ekranda listede olmayan bir kaydın künyesi asılı kalırdı.
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

  /** Birim seçenekleri bir kez çekilir; ekran boyunca değişmez. */
  async loadDepartments(): Promise<void> {
    try {
      this._departments.set(
        await firstValueFrom(this.departmentApi.getOptions(DepartmentType.Administrative)),
      );
    } catch {
      // Birim listesi gelmezse ekran çalışmaya devam eder; görev bağı diyaloğu
      // boş seçicisiyle açılır ve kullanıcı zaten kaydedemez.
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

  async create(command: StaffCreateCommand): Promise<boolean> {
    this._saving.set(true);
    this._feedback.set(null);

    try {
      const created = await firstValueFrom(this.api.create(command));
      await this.load();
      await this.select(created.id);

      // Kimlik farkı hata değil uyarıdır (K-B): kayıt açıldı, düzeltme
      // Kişiler ekranından yapılır. Sessizce yutulursa kimse fark etmez.
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
                ? 'Çalışan kaydı oluşturuldu; kişi zaten kayıtlıydı.'
                : 'Çalışan kaydı oluşturuldu.',
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

  async update(id: number, command: StaffUpdateCommand): Promise<boolean> {
    return this.runCommand(() => firstValueFrom(this.api.update(id, command)));
  }

  async end(id: number, command: AssignmentCloseCommand): Promise<boolean> {
    return this.runCommand(() => firstValueFrom(this.api.end(id, command)));
  }

  async addAssignment(staffId: number, command: StaffAssignmentCreateCommand): Promise<boolean> {
    return this.runCommand(async () => {
      await firstValueFrom(this.api.addAssignment(staffId, command));
      return 'Görev eklendi.';
    });
  }

  async updateAssignment(
    assignmentId: number,
    command: StaffAssignmentUpdateCommand,
  ): Promise<boolean> {
    return this.runCommand(() => firstValueFrom(this.api.updateAssignment(assignmentId, command)));
  }

  async closeAssignment(assignmentId: number, command: AssignmentCloseCommand): Promise<boolean> {
    return this.runCommand(() => firstValueFrom(this.api.closeAssignment(assignmentId, command)));
  }

  /**
   * Komutun ortak kabuğu: kaydet, listeyi ve künyeyi tazele, sunucunun mesajını
   * göster. Mesaj sunucudan geliyor — "son açık bağ kapandı" gibi uyarıları
   * ekranda yeniden üretmek iki yerde iki farklı doğru üretirdi.
   */
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
