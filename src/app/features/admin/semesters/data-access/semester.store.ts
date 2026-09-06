import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiFailure } from '@core/api/api-result.model';
import { SemesterAdminApi } from './semester-admin.api';
import {
  SemesterClosure,
  SemesterCreateCommand,
  SemesterDetail,
  SemesterListItem,
  SemesterStatus,
  SemesterStatusValue,
  SemesterUpdateCommand,
} from './semester.models';

export interface StoreFeedback {
  readonly severity: 'success' | 'error';
  readonly text: string;
}

/**
 * Dönemler ekranının durumu.
 *
 * Liste ile künye ayrı çekiliyor: künye ayrıca bağlı kayıt sayısını taşıyor ve
 * silme engelinin gerekçesi ondan okunuyor.
 */
@Injectable()
export class SemesterStore {
  private readonly api = inject(SemesterAdminApi);

  private readonly _items = signal<readonly SemesterListItem[]>([]);
  private readonly _detail = signal<SemesterDetail | null>(null);
  private readonly _selectedId = signal<number | null>(null);

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
  readonly status = signal<SemesterStatusValue | null>(null);

  readonly filtersDirty = computed(() => this.search().trim().length > 0 || this.status() !== null);

  readonly total = computed(() => this._items().length);

  /** Açık dönem. Sunucu tek olmasını garantiliyor; liste yine de ilkini alır. */
  readonly openSemester = computed(
    () => this._items().find((item) => item.status === SemesterStatus.Open) ?? null,
  );

  readonly currentSemester = computed(() => this._items().find((item) => item.isCurrent) ?? null);

  clearFeedback(): void {
    this._feedback.set(null);
  }

  resetFilters(): void {
    this.search.set('');
    this.status.set(null);
  }

  async load(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const items = await firstValueFrom(
        this.api.getList({ status: this.status(), search: this.search() }),
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

  async create(command: SemesterCreateCommand): Promise<boolean> {
    return this.runCommand(async () => {
      const created = await firstValueFrom(this.api.create(command));
      this._selectedId.set(created.id);
      return 'Dönem oluşturuldu.';
    });
  }

  async update(id: number, command: SemesterUpdateCommand): Promise<boolean> {
    return this.runCommand(() => firstValueFrom(this.api.update(id, command)));
  }

  async setCurrent(id: number): Promise<boolean> {
    return this.runCommand(() => firstValueFrom(this.api.setCurrent(id)));
  }

  /**
   * Dönemi kapatır. Ön koşulu K3: o dönemin BÜTÜN ders açılışları kapanmış olmalı.
   * Yan etkisi genel program çıktısı sonuçlarının yeniden hesaplanması — bu yüzden
   * düzenleme formundan değil, ayrı bir eylemden yapılıyor.
   */
  async close(id: number): Promise<boolean> {
    return this.runCommand(async () => {
      const closure = await firstValueFrom(this.api.close(id));
      return (
        `${closure.semesterName} kapatıldı; ` +
        `${closure.studentProgramOutcomeResultCount} genel program çıktısı sonucu güncellendi.`
      );
    });
  }

  /** K3 denetimi; kapatmaz. Hangi açılışların açık kaldığını döner. */
  async closurePreview(id: number): Promise<SemesterClosure | null> {
    try {
      return await firstValueFrom(this.api.closurePreview(id));
    } catch (error) {
      this._feedback.set({ severity: 'error', text: toMessage(error) });
      return null;
    }
  }

  async remove(id: number): Promise<boolean> {
    const ok = await this.runCommand(() => firstValueFrom(this.api.remove(id)));

    if (ok && this._selectedId() === id) {
      this._selectedId.set(null);
      this._detail.set(null);
    }

    return ok;
  }

  /** Kaydet, listeyi ve künyeyi tazele, SUNUCUNUN mesajını göster. */
  private async runCommand(action: () => Promise<string>): Promise<boolean> {
    this._saving.set(true);
    this._feedback.set(null);

    try {
      const message = await action();
      await this.load();

      const id = this._selectedId();
      if (id !== null && this._items().some((item) => item.id === id)) {
        await this.select(id);
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
