import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiFailure } from '@core/api/api-result.model';
import { CourseMappingApi } from './course-mapping.api';
import {
  CourseProgramOutcomeMatrix,
  MatrixCourse,
  MatrixProgramOutcome,
} from './course-mapping.models';

export interface StoreFeedback {
  readonly severity: 'success' | 'error';
  readonly text: string;
}

/**
 * PÇ – DERS EŞLEŞTİRME.
 *
 * TASLAK YEREL, KAYIT SATIR SATIR. Kullanıcı hücreleri işaretlerken sunucuya
 * gidilmiyor; "Kaydet" dendiğinde **yalnızca değişmiş satırlar** gönderiliyor ve her
 * satır kendi isteğiyle yazılıyor.
 *
 * Neden satır satır: uç bir dersin üyeliklerini tümüyle yeniden yazıyor — matrisin
 * doğal birimi satırdır. Kırk dersi tek istekte göndermek, birinin hatası yüzünden
 * otuz dokuzunu da geri almak demekti.
 */
@Injectable()
export class CourseMappingStore {
  private readonly api = inject(CourseMappingApi);

  private readonly _matrix = signal<CourseProgramOutcomeMatrix | null>(null);
  private readonly _loading = signal(false);
  private readonly _saving = signal(false);
  private readonly _feedback = signal<StoreFeedback | null>(null);

  /** Ders Id → işaretli çıktı Id kümesi. Yalnızca DEĞİŞTİRİLMİŞ satırlar burada. */
  private readonly _edits = signal<ReadonlyMap<number, ReadonlySet<number>>>(new Map());

  readonly loading = this._loading.asReadonly();
  readonly saving = this._saving.asReadonly();
  readonly feedback = this._feedback.asReadonly();

  readonly departmentId = signal<number | null>(null);
  readonly search = signal('');

  readonly outcomes = computed<readonly MatrixProgramOutcome[]>(
    () => this._matrix()?.programOutcomes ?? [],
  );

  readonly courses = computed<readonly MatrixCourse[]>(() => this._matrix()?.courses ?? []);

  /** Sunucudan gelen hâl; düzenlenmemiş satırlar bunu gösteriyor. */
  private readonly savedByCourse = computed(() => {
    const map = new Map<number, ReadonlySet<number>>();
    for (const course of this.courses()) {
      map.set(course.courseId, new Set(course.programOutcomeIds));
    }
    return map;
  });

  readonly dirtyCount = computed(() => this._edits().size);

  /**
   * Hiç dersi olmayan çıktılar. Ekranın en önemli uyarısı: o çıktı için hiçbir
   * öğrenciye sonuç yazılmaz ve bu bugüne kadar sessizdi.
   */
  readonly orphanOutcomes = computed(() =>
    this.outcomes().filter((outcome) => this.linkedCountOf(outcome) === 0),
  );

  /** Yürürlükte eşiği olmayan çıktılar; hesap onlar yüzünden durur. */
  readonly thresholdlessOutcomes = computed(() =>
    this.outcomes().filter((outcome) => outcome.passingThreshold === null),
  );

  clearFeedback(): void {
    this._feedback.set(null);
  }

  async load(): Promise<void> {
    this._loading.set(true);
    this._edits.set(new Map());

    try {
      this._matrix.set(
        await firstValueFrom(this.api.getMatrix(this.departmentId(), this.search())),
      );
    } catch (error) {
      this._matrix.set(null);
      this._feedback.set({ severity: 'error', text: toMessage(error) });
    } finally {
      this._loading.set(false);
    }
  }

  isChecked(courseId: number, outcomeId: number): boolean {
    const edits = this._edits();
    const set = edits.get(courseId) ?? this.savedByCourse().get(courseId);
    return set?.has(outcomeId) ?? false;
  }

  isDirty(courseId: number): boolean {
    return this._edits().has(courseId);
  }

  toggle(courseId: number, outcomeId: number): void {
    const saved = this.savedByCourse().get(courseId) ?? new Set<number>();
    const current = this._edits().get(courseId) ?? saved;

    const next = new Set(current);
    next.has(outcomeId) ? next.delete(outcomeId) : next.add(outcomeId);

    const edits = new Map(this._edits());

    // Kayıtlı hâle geri dönüldüyse satır "kirli" olmaktan çıkar; sayaç gerçekten
    // değişenleri saymalı.
    if (sameSet(next, saved)) edits.delete(courseId);
    else edits.set(courseId, next);

    this._edits.set(edits);
  }

  /** Bir dersin işaretli çıktı sayısı; satır sonunda gösteriliyor. */
  countOf(courseId: number): number {
    return (this._edits().get(courseId) ?? this.savedByCourse().get(courseId))?.size ?? 0;
  }

  /**
   * Bir çıktının katkı dersi sayısı — **düzenlemeler dahil**. Sunucudan gelen sayı
   * süzgeçten bağımsızdır; kullanıcı ekranda bir kutu işaretlediğinde "hiç dersi yok"
   * uyarısı anında düşmeli, kaydetmeyi beklememeli.
   */
  linkedCountOf(outcome: MatrixProgramOutcome): number {
    const edits = this._edits();
    if (edits.size === 0) return outcome.linkedCourseCount;

    let delta = 0;

    for (const [courseId, next] of edits) {
      const saved = this.savedByCourse().get(courseId) ?? new Set<number>();
      const was = saved.has(outcome.id);
      const now = next.has(outcome.id);

      if (was && !now) delta--;
      if (!was && now) delta++;
    }

    return outcome.linkedCourseCount + delta;
  }

  /**
   * Değişen satırları sırayla yazar. Biri hata verirse ötekiler yazılmış kalır ve
   * ekran tazelenir — yarısı yazılmış bir matris, hiç yazılmamış gibi gösterilmemeli.
   */
  async save(): Promise<boolean> {
    const edits = this._edits();
    if (edits.size === 0) return false;

    this._saving.set(true);
    this._feedback.set(null);

    const failures: string[] = [];

    try {
      for (const [courseId, outcomeIds] of edits) {
        try {
          await firstValueFrom(
            this.api.setCourseOutcomes(courseId, { programOutcomeIds: [...outcomeIds] }),
          );
        } catch (error) {
          const course = this.courses().find((c) => c.courseId === courseId);
          failures.push(`${course?.courseCode ?? courseId}: ${toMessage(error)}`);
        }
      }

      await this.load();

      if (failures.length > 0) {
        this._feedback.set({ severity: 'error', text: failures.join(' · ') });
        return false;
      }

      this._feedback.set({ severity: 'success', text: `${edits.size} ders güncellendi.` });
      return true;
    } finally {
      this._saving.set(false);
    }
  }

  discard(): void {
    this._edits.set(new Map());
  }
}

function sameSet(a: ReadonlySet<number>, b: ReadonlySet<number>): boolean {
  if (a.size !== b.size) return false;
  for (const value of a) if (!b.has(value)) return false;
  return true;
}

function toMessage(error: unknown): string {
  return error instanceof ApiFailure ? error.message : 'Beklenmeyen bir hata oluştu.';
}
