import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiFailure } from '@core/api/api-result.model';
import { OfferingAdminApi } from '@features/admin/offerings/data-access/offering-admin.api';
import { OfferingListItem } from '@features/admin/offerings/data-access/offering.models';
import { SemesterAdminApi } from '@features/admin/semesters/data-access/semester-admin.api';
import { SemesterListItem } from '@features/admin/semesters/data-access/semester.models';
import { OutcomeMatrixApi } from './outcome-matrix.api';
import {
  MatrixRow,
  OutcomeComparison,
  OutcomeDraft,
  OutcomeGrid,
  OutcomeGridActivity,
  OutcomeGridItem,
} from './matrix.models';

export interface StoreFeedback {
  readonly severity: 'success' | 'error';
  readonly text: string;
}

/**
 * Çıktı Eşleştirme ekranının durumu.
 *
 * BAĞLAM AÇILIŞTIR: çıktılar da etkinlikler de açılışa ait (K-I/B), o yüzden tek
 * anahtar yetiyor.
 *
 * TASLAK YEREL: hoca hücreleri doldururken sunucuya gidilmez. `parse` yalnızca
 * "kaydet"e basılmadan önce, ne olacağını göstermek için çağrılır. Böylece her tuş
 * vuruşunda ağ isteği atılmaz ve hoca yarım bir matrisi rahatça kurabilir.
 */
@Injectable()
export class MatrixStore {
  private readonly api = inject(OutcomeMatrixApi);
  private readonly offeringApi = inject(OfferingAdminApi);
  private readonly semesterApi = inject(SemesterAdminApi);

  private readonly _semesters = signal<readonly SemesterListItem[]>([]);
  private readonly _offerings = signal<readonly OfferingListItem[]>([]);
  private readonly _grid = signal<OutcomeGrid | null>(null);
  private readonly _rows = signal<readonly MatrixRow[]>([]);
  private readonly _deletedIds = signal<readonly number[]>([]);
  private readonly _comparison = signal<OutcomeComparison | null>(null);

  private readonly _loading = signal(false);
  private readonly _saving = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _feedback = signal<StoreFeedback | null>(null);

  readonly semesters = this._semesters.asReadonly();
  readonly offerings = this._offerings.asReadonly();
  readonly grid = this._grid.asReadonly();
  readonly rows = this._rows.asReadonly();
  readonly comparison = this._comparison.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly saving = this._saving.asReadonly();
  readonly error = this._error.asReadonly();
  readonly feedback = this._feedback.asReadonly();

  readonly semesterId = signal<number | null>(null);
  readonly offeringId = signal<number | null>(null);

  readonly activities = computed<readonly OutcomeGridActivity[]>(
    () => this._grid()?.activities ?? [],
  );

  readonly items = computed<readonly OutcomeGridItem[]>(() => this._grid()?.items ?? []);

  /** Etkinlik başına soruları; matriste soru bağı bölümü bundan besleniyor. */
  readonly itemsByActivity = computed(() => {
    const map = new Map<number, OutcomeGridItem[]>();

    for (const item of this.items()) {
      const list = map.get(item.activityId) ?? [];
      list.push(item);
      map.set(item.activityId, list);
    }

    return map;
  });

  /**
   * Satır başına ağırlık toplamı. **N1 kuralı:** bir çıktının ağırlıkları 100
   * etmelidir; ağırlığı hiç olmayan çıktı serbesttir (taslak hâli).
   *
   * Sunucu da tutuyor; burada kaydete basmadan önce görünsün diye.
   */
  readonly weightTotals = computed(() =>
    this._rows().map((row) =>
      Object.values(row.weights).reduce((sum, weight) => sum + (weight || 0), 0),
    ),
  );

  /** Kaydetmeyi engelleyen yerel kural ihlalleri. Sunucu ayrıca denetliyor. */
  readonly localIssues = computed(() => {
    const issues: string[] = [];
    const rows = this._rows();
    const totals = this.weightTotals();

    rows.forEach((row, index) => {
      const code = row.code.trim();

      if (code.length === 0) {
        issues.push(`${index + 1}. satırın kodu boş.`);
        return;
      }

      const total = totals[index];
      if (total !== 0 && total !== 100) {
        issues.push(`'${code}' çıktısının ağırlık toplamı %${total} (0 veya 100 olmalı).`);
      }
    });

    const codes = rows.map((r) => r.code.trim().toLocaleUpperCase('tr-TR')).filter((c) => c);
    const duplicates = codes.filter((c, i) => codes.indexOf(c) !== i);

    for (const duplicate of [...new Set(duplicates)]) {
      issues.push(`'${duplicate}' kodu birden fazla satırda geçiyor.`);
    }

    return issues;
  });

  readonly canSave = computed(() => this.localIssues().length === 0 && this._rows().length > 0);

  clearFeedback(): void {
    this._feedback.set(null);
  }

  async loadContext(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const semesters = await firstValueFrom(
        this.semesterApi.getList({ status: null, search: '' }),
      );
      this._semesters.set(semesters);

      if (this.semesterId() === null) {
        this.semesterId.set((semesters.find((s) => s.isCurrent) ?? semesters[0])?.id ?? null);
      }

      await this.loadOfferings();
    } catch (error) {
      this._error.set(toMessage(error));
    } finally {
      this._loading.set(false);
    }
  }

  async loadOfferings(): Promise<void> {
    const semesterId = this.semesterId();
    this.reset();

    if (semesterId === null) {
      this._offerings.set([]);
      return;
    }

    try {
      this._offerings.set(await firstValueFrom(this.offeringApi.getList(semesterId, '')));
    } catch (error) {
      this._offerings.set([]);
      this._error.set(toMessage(error));
    }
  }

  async loadGrid(): Promise<void> {
    const offeringId = this.offeringId();
    if (offeringId === null) {
      this.reset();
      return;
    }

    this._loading.set(true);
    this._feedback.set(null);
    this._comparison.set(null);
    this._deletedIds.set([]);

    try {
      const grid = await firstValueFrom(this.api.getGrid(offeringId));
      this._grid.set(grid);
      this._rows.set(grid.outcomes.map(toMatrixRow));
    } catch (error) {
      this.reset();
      this._feedback.set({ severity: 'error', text: toMessage(error) });
    } finally {
      this._loading.set(false);
    }
  }

  // ── Yerel düzenleme ──

  addRow(): void {
    this._rows.update((rows) => [
      ...rows,
      { courseOutcomeId: null, code: '', description: '', weights: {}, linkedItemIds: new Set() },
    ]);
  }

  updateRow(index: number, patch: Partial<Pick<MatrixRow, 'code' | 'description'>>): void {
    this._rows.update((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  /** Hücreye ağırlık yazar. Boş/0 verilirse anahtar SİLİNİR — seyrek liste böyle korunur. */
  setWeight(index: number, activityId: number, weight: number | null): void {
    this._rows.update((rows) =>
      rows.map((row, i) => {
        if (i !== index) return row;

        const weights = { ...row.weights };

        if (weight === null || weight <= 0) {
          delete weights[activityId];
        } else {
          weights[activityId] = weight;
        }

        return { ...row, weights };
      }),
    );
  }

  toggleItemLink(index: number, itemId: number): void {
    this._rows.update((rows) =>
      rows.map((row, i) => {
        if (i !== index) return row;

        const linked = new Set(row.linkedItemIds);
        linked.has(itemId) ? linked.delete(itemId) : linked.add(itemId);

        return { ...row, linkedItemIds: linked };
      }),
    );
  }

  /**
   * Satırı taslaktan çıkarır. KAYITLI satır ayrıca silme listesine yazılır:
   * taslakta olmamak "dokunma" demektir, "sil" demek değil.
   */
  removeRow(index: number): void {
    const row = this._rows()[index];
    if (!row) return;

    if (row.courseOutcomeId !== null) {
      this._deletedIds.update((ids) => [...ids, row.courseOutcomeId!]);
    }

    this._rows.update((rows) => rows.filter((_, i) => i !== index));
  }

  // ── Sunucu ──

  /** Ne olacağını gösterir; hiçbir şey yazmaz. */
  async preview(): Promise<void> {
    const offeringId = this.offeringId();
    if (offeringId === null) return;

    this._saving.set(true);
    this._feedback.set(null);

    try {
      const confirmation = await firstValueFrom(this.api.parse(offeringId, this.buildDraft()));
      this._comparison.set(confirmation.comparison);
    } catch (error) {
      this._comparison.set(null);
      this._feedback.set({ severity: 'error', text: toMessage(error) });
    } finally {
      this._saving.set(false);
    }
  }

  async save(): Promise<boolean> {
    const offeringId = this.offeringId();
    if (offeringId === null) return false;

    this._saving.set(true);
    this._feedback.set(null);

    try {
      await firstValueFrom(this.api.confirm(offeringId, this.buildDraft()));
      this._feedback.set({ severity: 'success', text: 'Matris kaydedildi.' });

      // Sunucudan TAZE oku: yeni satirlarin Id'leri ancak yazildiktan sonra bilinir.
      await this.loadGrid();
      return true;
    } catch (error) {
      this._feedback.set({ severity: 'error', text: toMessage(error) });
      return false;
    } finally {
      this._saving.set(false);
    }
  }

  private buildDraft(): OutcomeDraft {
    return {
      courseInSemesterId: this.offeringId()!,
      outcomes: this._rows().map((row) => ({
        courseOutcomeId: row.courseOutcomeId,
        code: row.code.trim(),
        description: row.description.trim(),
        weights: Object.entries(row.weights).map(([activityId, weight]) => ({
          activityId: Number(activityId),
          weight,
        })),
        linkedItemIds: [...row.linkedItemIds],
      })),
      deletions: { courseOutcomeIds: this._deletedIds() },
    };
  }

  private reset(): void {
    this._grid.set(null);
    this._rows.set([]);
    this._deletedIds.set([]);
    this._comparison.set(null);
    this.offeringId.set(null);
  }
}

function toMatrixRow(row: {
  id: number;
  code: string;
  description: string;
  weights: readonly { activityId: number; weight: number }[];
  linkedItemIds: readonly number[];
}): MatrixRow {
  const weights: Record<number, number> = {};
  for (const weight of row.weights) {
    weights[weight.activityId] = weight.weight;
  }

  return {
    courseOutcomeId: row.id,
    code: row.code,
    description: row.description,
    weights,
    linkedItemIds: new Set(row.linkedItemIds),
  };
}

function toMessage(error: unknown): string {
  return error instanceof ApiFailure ? error.message : 'Beklenmeyen bir hata oluştu.';
}
