import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiFailure } from '@core/api/api-result.model';
import { OfferingContextStore } from '@shared/data-access/offering-context.store';
import { AssessmentApi } from '@features/assessment/data-access/assessment.api';
import {
  AssessmentGrid,
  BulkUploadResult,
  Comparison,
  ScoreDraft,
} from '@features/assessment/data-access/assessment.models';

export interface StoreFeedback {
  readonly severity: 'success' | 'error';
  readonly text: string;
}

/** Grid kolonu: bir sorunun kimliği ve başlığı. */
export interface ScoreColumn {
  readonly itemId: number;
  readonly activityId: number;
  readonly activityName: string;
  readonly itemName: string;
  readonly maxPoint: number;
}

/**
 * ÖĞRENCİ NOTLARI — elle giriş kolu.
 *
 * Dosya kolunun aynı omurgası, tek farkı kimliğin **Id'den** çözülmesi. Bu yüzden
 * üç aşama yok: yapı zaten sistemde tanımlı, uzlaştırılacak bir dosya yok. Ekran
 * doğrudan notlara açılıyor.
 *
 * TASLAK YEREL: hoca hücreleri doldururken sunucuya gidilmiyor. "Ne değişecek?"
 * ancak istendiğinde sorulur; kaydetme karşılaştırmayı sunucuda yeniden kurdurur.
 */
@Injectable()
export class ScoreGridStore {
  private readonly api = inject(AssessmentApi);

  readonly context = inject(OfferingContextStore);

  private readonly _grid = signal<AssessmentGrid | null>(null);
  private readonly _comparison = signal<Comparison | null>(null);
  private readonly _result = signal<BulkUploadResult | null>(null);

  /** `${studentId}::${itemId}` -> puan. `null` = boş hücre (varsa mevcut puan silinir). */
  private readonly _edits = signal<ReadonlyMap<string, number | null>>(new Map());

  private readonly _loading = signal(false);
  private readonly _saving = signal(false);
  private readonly _feedback = signal<StoreFeedback | null>(null);

  readonly grid = this._grid.asReadonly();
  readonly comparison = this._comparison.asReadonly();
  readonly result = this._result.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly saving = this._saving.asReadonly();
  readonly feedback = this._feedback.asReadonly();

  readonly students = computed(() => this._grid()?.students ?? []);

  readonly columns = computed<readonly ScoreColumn[]>(() =>
    (this._grid()?.activities ?? []).flatMap((activity) =>
      activity.items.map((item) => ({
        itemId: item.id,
        activityId: activity.id,
        activityName: activity.name,
        itemName: item.name,
        maxPoint: item.maxPoint,
      })),
    ),
  );

  /** Sunucudan gelen mevcut puanlar; düzenlenmemiş hücreler bunu gösteriyor. */
  private readonly savedScores = computed(() => {
    const map = new Map<string, number>();
    for (const score of this._grid()?.scores ?? []) {
      map.set(cellKey(score.studentId, score.activityItemId), score.score);
    }
    return map;
  });

  readonly dirtyCount = computed(() => this._edits().size);

  readonly hasStructure = computed(() => this.columns().length > 0);

  clearFeedback(): void {
    this._feedback.set(null);
  }

  async load(): Promise<void> {
    const offeringId = this.context.offeringId();

    this._comparison.set(null);
    this._result.set(null);
    this._edits.set(new Map());

    if (offeringId === null) {
      this._grid.set(null);
      return;
    }

    this._loading.set(true);

    try {
      this._grid.set(await firstValueFrom(this.api.getGrid(offeringId)));
    } catch (error) {
      this._grid.set(null);
      this._feedback.set({ severity: 'error', text: toMessage(error) });
    } finally {
      this._loading.set(false);
    }
  }

  /** Hücrenin gösterilecek değeri: düzenlendiyse düzenleme, yoksa kayıtlı puan. */
  valueOf(studentId: number, itemId: number): number | null {
    const key = cellKey(studentId, itemId);
    const edits = this._edits();

    if (edits.has(key)) return edits.get(key) ?? null;
    return this.savedScores().get(key) ?? null;
  }

  isDirty(studentId: number, itemId: number): boolean {
    return this._edits().has(cellKey(studentId, itemId));
  }

  setValue(studentId: number, itemId: number, value: number | null): void {
    const key = cellKey(studentId, itemId);
    const saved = this.savedScores().get(key) ?? null;

    const next = new Map(this._edits());

    // Kayıtlı değere geri dönülürse düzenleme listesinden düşer; "3 hücre değişti"
    // sayısı, gerçekten değişenleri saymalı.
    if (saved === value) next.delete(key);
    else next.set(key, value);

    this._edits.set(next);
    this._comparison.set(null);
  }

  /** Sunucuya sorar: bu taslak kaydedilirse ne olur? Yazmaz. */
  async preview(): Promise<void> {
    const draft = this.buildDraft();
    if (draft === null) return;

    this._saving.set(true);
    this._feedback.set(null);

    try {
      const confirmation = await firstValueFrom(this.api.parseGrid(draft));
      this._comparison.set(confirmation.comparison);
    } catch (error) {
      this._feedback.set({ severity: 'error', text: toMessage(error) });
    } finally {
      this._saving.set(false);
    }
  }

  async save(): Promise<boolean> {
    const draft = this.buildDraft();
    if (draft === null) return false;

    this._saving.set(true);
    this._feedback.set(null);

    try {
      const result = await firstValueFrom(this.api.confirmGrid(draft));

      this._result.set(result);
      await this.load();
      return true;
    } catch (error) {
      this._feedback.set({ severity: 'error', text: toMessage(error) });
      return false;
    } finally {
      this._saving.set(false);
    }
  }

  /**
   * Taslağı kurar.
   *
   * YALNIZCA DEĞİŞEN HÜCRELER gönderilir. Bütün gridi göndermek de çalışırdı ama
   * değişmemiş her hücre sunucuda "Unchanged" olarak yeniden hesaplanırdı; 60
   * öğrenci × 20 soru = 1200 gereksiz karşılaştırma.
   *
   * Yapı (etkinlik/soru) TAM gönderilir: sunucu soruları ada göre çözüyor ve
   * eksik gönderilen bir soru "tanımsız soruya puan girilmiş" hatasına dönerdi.
   */
  private buildDraft(): ScoreDraft | null {
    const grid = this._grid();
    if (grid === null) return null;

    const columnsById = new Map(this.columns().map((column) => [column.itemId, column]));

    const grades = this.students()
      .map((student) => {
        const scores = [...this._edits().entries()]
          .filter(([key]) => key.startsWith(`${student.id}::`))
          .map(([key, value]) => {
            const itemId = Number(key.split('::')[1]);
            const column = columnsById.get(itemId);

            return {
              activityItemId: itemId,
              activityName: column?.activityName ?? '',
              itemName: column?.itemName ?? '',
              score: value,
            };
          });

        return { studentId: student.id, studentNumber: student.studentNumber, itemScores: scores };
      })
      .filter((grade) => grade.itemScores.length > 0);

    return {
      courseInSemesterId: grid.courseInSemesterId,
      failedRecords: [],
      studentGrades: grades,
      assessmentActivityCreates: grid.activities.map((activity) => ({
        activityId: activity.id,
        activityName: activity.name,
        courseInSemesterId: grid.courseInSemesterId,
        activityDefinitionId: activity.activityDefinitionId,
        isExcluded: false,
        items: activity.items.map((item) => ({
          itemId: item.id,
          activityId: activity.id,
          name: item.name,
          totalPoints: item.maxPoint,
          sequenceNo: item.sequenceNo,
        })),
      })),
      deletions: { activityIds: [], activityItemIds: [], studentIds: [] },
    };
  }
}

function cellKey(studentId: number, itemId: number): string {
  return `${studentId}::${itemId}`;
}

function toMessage(error: unknown): string {
  return error instanceof ApiFailure ? error.message : 'Beklenmeyen bir hata oluştu.';
}
