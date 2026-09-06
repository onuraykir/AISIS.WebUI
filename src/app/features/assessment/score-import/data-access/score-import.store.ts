import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiFailure } from '@core/api/api-result.model';
import { OfferingContextStore } from '@shared/data-access/offering-context.store';
import { ActivityDefinitionAdminApi } from '@features/admin/activity-definitions/data-access/activity-definition-admin.api';
import { ActivityDefinition } from '@features/admin/activity-definitions/data-access/activity-definition.models';
import { AssessmentApi } from '@features/assessment/data-access/assessment.api';
import {
  ActivityComparison,
  BulkUploadResult,
  ChangeState,
  Comparison,
  ItemComparison,
  IssueCode,
  ScoreDraft,
  StudentComparison,
  WarningCode,
} from '@features/assessment/data-access/assessment.models';

export interface StoreFeedback {
  readonly severity: 'success' | 'error';
  readonly text: string;
}

/**
 * Akışın hangi aşamasındayız?
 *
 * `file` dosya seçimi, sonra üç onay, sonra `done`. Aşamalar SIRALIDIR ve geriye
 * dönülebilir — hoca 3. aşamada bir şey fark edip 2'ye dönebilmeli.
 */
export type ImportStage = 'file' | 'students' | 'structure' | 'grades' | 'done';

/**
 * ÜÇ ONAYLI NOT YÜKLEME.
 *
 * DURUMSUZ (S3): sunucuda geçici bir yükleme kaydı yok. Taslak burada, istemcide
 * duruyor; sunucu her adımda karşılaştırmayı **yeniden kuruyor**. Alternatifi geçici
 * bir tablo açmaktı — yarım kalan yüklemeleri ve temizlik işini de beraberinde
 * getirirdi.
 *
 * AŞAMALARIN İŞ BÖLÜMÜ:
 * 1. **Öğrenci** — sınıf listesiyle uzlaştırma. Karar yok, bildirim var: fazlalar
 *    alınmadı, eksikler boş satırla eklendi.
 * 2. **Yapı** — burada KARAR var: açılışta olmayan etkinlik eklenecek mi (ve hangi
 *    türde), eksik tam puanlar ne olacak.
 * 3. **Notlar** — grid. Hoca düzeltir, son onayda yazılır.
 */
@Injectable()
export class ScoreImportStore {
  private readonly api = inject(AssessmentApi);
  private readonly definitionApi = inject(ActivityDefinitionAdminApi);

  readonly context = inject(OfferingContextStore);

  /** Etkinlik türü sözlüğü (Vize, Final…). 2. aşamanın "ekle" kararı bunu seçtiriyor. */
  private readonly _definitions = signal<readonly ActivityDefinition[]>([]);
  readonly definitions = this._definitions.asReadonly();

  readonly definitionOptions = computed(() =>
    this._definitions().map((definition) => ({ value: definition.id, label: definition.name })),
  );

  /** Sözlük ekran açılırken bir kez yüklenir; 2. aşamaya gelindiğinde hazır olmalı. */
  async loadDefinitions(): Promise<void> {
    try {
      this._definitions.set(await firstValueFrom(this.definitionApi.getList('')));
    } catch {
      // Sessiz: sözlük yoksa tür seçimi boş kalır ve kapı zaten geçişi engeller.
      this._definitions.set([]);
    }
  }

  private readonly _stage = signal<ImportStage>('file');
  private readonly _draft = signal<ScoreDraft | null>(null);
  private readonly _comparison = signal<Comparison | null>(null);
  private readonly _result = signal<BulkUploadResult | null>(null);
  private readonly _fileName = signal<string | null>(null);

  private readonly _busy = signal(false);
  private readonly _feedback = signal<StoreFeedback | null>(null);

  readonly stage = this._stage.asReadonly();
  readonly draft = this._draft.asReadonly();
  readonly comparison = this._comparison.asReadonly();
  readonly result = this._result.asReadonly();
  readonly fileName = this._fileName.asReadonly();
  readonly busy = this._busy.asReadonly();
  readonly feedback = this._feedback.asReadonly();

  // ── Türetilenler ──

  readonly blockingIssues = computed(() => this._comparison()?.blockingIssues ?? []);
  readonly warnings = computed(() => this._comparison()?.warnings ?? []);
  readonly canConfirm = computed(() => this._comparison()?.canConfirm ?? false);
  readonly summary = computed(() => this._comparison()?.summary ?? null);

  /** 1. aşama: dosyada olup sınıf listesinde bulunmayanlar (alınmadı). */
  readonly notEnrolled = computed(() =>
    this.warnings().filter((w) => w.code === WarningCode.StudentNotEnrolled),
  );

  /** 1. aşama: derse kayıtlı olup dosyada bulunmayanlar (boş eklendi). */
  readonly missingStudents = computed<readonly StudentComparison[]>(() =>
    (this._comparison()?.students ?? []).filter((s) => s.state === ChangeState.MissingInFile),
  );

  readonly matchedStudents = computed<readonly StudentComparison[]>(() =>
    (this._comparison()?.students ?? []).filter((s) => s.state !== ChangeState.MissingInFile),
  );

  /** 2. aşama: açılışta olmayan, hocaya sorulan etkinlikler. */
  readonly proposedActivities = computed<readonly ActivityComparison[]>(() =>
    (this._comparison()?.activities ?? []).filter((a) => a.state === ChangeState.New),
  );

  readonly knownActivities = computed<readonly ActivityComparison[]>(() =>
    (this._comparison()?.activities ?? []).filter((a) => a.state !== ChangeState.New),
  );

  /** 2. aşamanın kapısı: tam puanı olmayan sorular. Doldurulmadan 3'e geçilmez. */
  readonly missingMaxPoints = computed(() =>
    this.blockingIssues().filter((i) => i.code === IssueCode.ItemMaxPointMissing),
  );

  /** 2. aşamanın öteki kapısı: türü seçilmemiş yeni etkinlikler. */
  readonly missingTypes = computed(() =>
    this.blockingIssues().filter((i) => i.code === IssueCode.ActivityTypeRequired),
  );

  /**
   * 2. aşamadan 3'e geçilebilir mi?
   *
   * Kapı `canConfirm` DEĞİL: dosya okuma hatası gibi engelleyiciler 1. aşamada zaten
   * yolu kesiyor. Buradaki soru dar: yapı yazılabilir hâlde mi?
   */
  readonly canLeaveStructure = computed(
    () => this.missingMaxPoints().length === 0 && this.missingTypes().length === 0,
  );

  /** 3. aşamanın gridi: satır = öğrenci, kolon = soru. */
  readonly gridColumns = computed(() => {
    const draft = this._draft();
    if (draft === null) return [];

    return draft.assessmentActivityCreates
      .filter((activity) => !activity.isExcluded)
      .flatMap((activity) =>
        activity.items.map((item) => ({
          activityName: activity.activityName,
          itemName: item.name,
          maxPoint: item.totalPoints,
          key: `${activity.activityName}::${item.name}`,
        })),
      );
  });

  clearFeedback(): void {
    this._feedback.set(null);
  }

  // ── Aşama 0: dosya ──

  async upload(file: File): Promise<void> {
    const offeringId = this.context.offeringId();
    if (offeringId === null) return;

    this._busy.set(true);
    this._feedback.set(null);
    this._result.set(null);

    try {
      const confirmation = await firstValueFrom(this.api.parseFile(offeringId, file));

      this._draft.set(confirmation.uploadData);
      this._comparison.set(confirmation.comparison);
      this._fileName.set(file.name);
      this._stage.set('students');
    } catch (error) {
      this.reset();
      this._feedback.set({ severity: 'error', text: toMessage(error) });
    } finally {
      this._busy.set(false);
    }
  }

  reset(): void {
    this._stage.set('file');
    this._draft.set(null);
    this._comparison.set(null);
    this._result.set(null);
    this._fileName.set(null);
  }

  // ── Aşama geçişleri ──

  goTo(stage: ImportStage): void {
    this._stage.set(stage);
  }

  /** 1 → 2. Öğrenci aşamasında karar yok; onay yalnızca "gördüm" demektir. */
  approveStudents(): void {
    this._stage.set('structure');
  }

  /** 2 → 3. Karşılaştırma tazelendikten sonra geçilir; kapı kapalıysa geçilmez. */
  async approveStructure(): Promise<void> {
    await this.refresh();
    if (this.canLeaveStructure()) this._stage.set('grades');
  }

  // ── Aşama 2: kararlar ──

  /** Hoca "ekle" dedi: etkinlik açılacak, türü seçildi. */
  setActivityType(activityName: string, activityDefinitionId: number): void {
    this.patchActivity(activityName, (activity) => ({
      ...activity,
      activityDefinitionId,
      isExcluded: false,
    }));
  }

  /** Hoca "iptal" dedi: etkinlik ve altındaki her şey yüklemeye katılmayacak. */
  setActivityExcluded(activityName: string, isExcluded: boolean): void {
    this.patchActivity(activityName, (activity) => ({ ...activity, isExcluded }));
  }

  /** Eksik tam puanı yerinde doldurma (E3). Kural değişmiyor: doldurulmazsa geçiş yok. */
  setItemMaxPoint(activityName: string, itemName: string, maxPoint: number): void {
    this.patchActivity(activityName, (activity) => ({
      ...activity,
      items: activity.items.map((item) =>
        item.name === itemName ? { ...item, totalPoints: maxPoint } : item,
      ),
    }));
  }

  // ── Aşama 3: not düzenleme ──

  setScore(studentNumber: string, activityName: string, itemName: string, score: number | null): void {
    const draft = this._draft();
    if (draft === null) return;

    this._draft.set({
      ...draft,
      studentGrades: draft.studentGrades.map((grade) => {
        if (grade.studentNumber !== studentNumber) return grade;

        const existing = grade.itemScores.find(
          (s) => s.activityName === activityName && s.itemName === itemName,
        );

        // Hücre taslakta yoksa yeni bir giriş açılır: dosyada boş bırakılmış bir
        // hücreye hoca gridden puan girebilmeli.
        if (existing === undefined) {
          return {
            ...grade,
            itemScores: [
              ...grade.itemScores,
              { activityItemId: null, activityName, itemName, score },
            ],
          };
        }

        return {
          ...grade,
          itemScores: grade.itemScores.map((s) =>
            s.activityName === activityName && s.itemName === itemName ? { ...s, score } : s,
          ),
        };
      }),
    });
  }

  scoreOf(studentNumber: string, key: string): number | null {
    const [activityName, itemName] = key.split('::');

    return (
      this._draft()
        ?.studentGrades.find((g) => g.studentNumber === studentNumber)
        ?.itemScores.find((s) => s.activityName === activityName && s.itemName === itemName)
        ?.score ?? null
    );
  }

  // ── Sunucuyla tazeleme ve yazma ──

  /** Taslağı sunucuya gönderip karşılaştırmayı yeniden kurdurur. Yazmaz. */
  async refresh(): Promise<void> {
    const draft = this._draft();
    if (draft === null) return;

    this._busy.set(true);

    try {
      const confirmation = await firstValueFrom(this.api.review(draft));
      this._comparison.set(confirmation.comparison);
    } catch (error) {
      this._feedback.set({ severity: 'error', text: toMessage(error) });
    } finally {
      this._busy.set(false);
    }
  }

  /** Son onay: taslak yazılır. Sunucu karşılaştırmayı bir kez daha kurar. */
  async confirm(): Promise<boolean> {
    const draft = this._draft();
    if (draft === null) return false;

    this._busy.set(true);
    this._feedback.set(null);

    try {
      const result = await firstValueFrom(this.api.confirmFile(draft));

      this._result.set(result);
      this._stage.set('done');
      return true;
    } catch (error) {
      this._feedback.set({ severity: 'error', text: toMessage(error) });
      await this.refresh();
      return false;
    } finally {
      this._busy.set(false);
    }
  }

  // ── Yardımcı ──

  /**
   * Taslaktaki bir etkinliği değiştirir. Kimlik ADDIR — dosya kolunda Id yoktur ve
   * ad zaten değiştirilemez (A3), bu yüzden güvenli bir anahtardır.
   */
  private patchActivity(
    activityName: string,
    patch: (activity: ScoreDraft['assessmentActivityCreates'][number]) => ScoreDraft['assessmentActivityCreates'][number],
  ): void {
    const draft = this._draft();
    if (draft === null) return;

    this._draft.set({
      ...draft,
      assessmentActivityCreates: draft.assessmentActivityCreates.map((activity) =>
        activity.activityName === activityName ? patch(activity) : activity,
      ),
    });
  }
}

/** Bir etkinliğin taslaktaki hâli; şablon karar kutularını bununla besliyor. */
export function itemsOf(comparison: ActivityComparison): readonly ItemComparison[] {
  return comparison.items;
}

function toMessage(error: unknown): string {
  return error instanceof ApiFailure ? error.message : 'Beklenmeyen bir hata oluştu.';
}
