/**
 * NOT GİRİŞİ sözleşmesi — `api/AssessmentFile` ve `api/AssessmentData`.
 *
 * İKİ GİRİŞ, TEK OMURGA: dosyadan gelen veri ile gridden gelen veri aynı adımlardan
 * geçer. Tek fark kimliğin nasıl çözüldüğüdür — dosyada **isimden**, gridde **Id'den**.
 * Bu yüzden iki ekran da aynı taslak tipini (`ScoreDraft`) taşır.
 */

/** `AISIS.Common.Enum.ChangeState`. */
export const ChangeState = {
  Unchanged: 0,
  New: 1,
  Modified: 2,
  Deleted: 3,
  /** Veritabanında var, taslakta yok. Öğrencide "boş satır", etkinlikte "dokunulmadı". */
  MissingInFile: 4,
} as const;

export type ChangeStateValue = (typeof ChangeState)[keyof typeof ChangeState];

// ─────────────────────────────────────────────────────────────
// Taslak (istemci taşır, sunucu her adımda yeniden karşılaştırır)
// ─────────────────────────────────────────────────────────────

export interface ScoreDraft {
  courseInSemesterId: number;
  failedRecords: FailedRecord[];
  studentGrades: StudentGradeDraft[];
  assessmentActivityCreates: ActivityDraft[];
  deletions: { activityIds: number[]; activityItemIds: number[]; studentIds: number[] };
}

export interface ActivityDraft {
  activityId: number | null;
  activityName: string;
  courseInSemesterId: number;

  /** Ortak sözlükteki tür (Vize, Final…). Yeni etkinlik için **zorunlu**. */
  activityDefinitionId: number;

  /**
   * Hocanın "iptal" kararı. True ise etkinlik, soruları ve o soruların hücreleri
   * yüklemeye hiç katılmaz.
   */
  isExcluded: boolean;

  items: ItemDraft[];
}

export interface ItemDraft {
  itemId: number | null;
  activityId: number;
  name: string;
  /** Tam puan. 0 = "bu yüklemede girilmedi" — mevcut soruda veritabanı değeri korunur. */
  totalPoints: number;
  sequenceNo: number;
}

export interface StudentGradeDraft {
  studentId: number | null;
  studentNumber: string;
  itemScores: ItemScoreDraft[];
}

export interface ItemScoreDraft {
  activityItemId: number | null;
  activityName: string;
  itemName: string;
  /** `null` = **boş hücre**. Sıfır değildir: veritabanında karşılığı varsa silinir. */
  score: number | null;
}

export interface FailedRecord {
  readonly rowIndex: number;
  readonly column: string;
  readonly identifier?: string;
  readonly errorMessage: string;
}

// ─────────────────────────────────────────────────────────────
// Karşılaştırma (sunucu üretir, salt okunur)
// ─────────────────────────────────────────────────────────────

export interface Confirmation {
  readonly uploadData: ScoreDraft;
  readonly comparison: Comparison;
}

export interface Comparison {
  readonly courseInSemesterId: number;
  readonly activities: readonly ActivityComparison[];
  readonly students: readonly StudentComparison[];
  readonly scores: readonly ScoreComparison[];

  /** Giderilmeden onay verilemez. */
  readonly blockingIssues: readonly ComparisonIssue[];

  /** Onayı ENGELLEMEZ; hocanın görmesi gereken kararlar. */
  readonly warnings: readonly ComparisonIssue[];

  readonly summary: ComparisonSummary;
  readonly canConfirm: boolean;
}

export interface ComparisonIssue {
  readonly code: string;
  readonly message: string;
  readonly identifier?: string;
  readonly rowIndex?: number;
}

export interface ActivityComparison {
  readonly incomingActivityId: number | null;
  readonly activityName: string;
  readonly existingActivityId: number | null;
  readonly existingActivityName: string | null;
  readonly state: ChangeStateValue;
  readonly items: readonly ItemComparison[];
}

export interface ItemComparison {
  readonly incomingItemId: number | null;
  readonly itemName: string;
  readonly existingItemId: number | null;
  readonly existingItemName: string | null;
  readonly state: ChangeStateValue;

  /** ETKİN tam puan: gelen değer, yoksa veritabanındaki. 0 ise kapı kapalı. */
  readonly maxPoint: number;
  readonly existingMaxPoint: number | null;
}

export interface StudentComparison {
  readonly incomingStudentId: number | null;
  readonly studentNumber: string;
  readonly existingStudentId: number | null;
  readonly state: ChangeStateValue;
  readonly fullName: string | null;
}

export interface ScoreComparison {
  readonly studentNumber: string;
  readonly activityName: string;
  readonly itemName: string;
  readonly newScore: number | null;
  readonly existingScore: number | null;
  readonly state: ChangeStateValue;
}

export interface ComparisonSummary {
  readonly newActivityCount: number;
  readonly newItemCount: number;
  readonly newStudentCount: number;
  readonly newScoreCount: number;
  readonly modifiedActivityCount: number;
  readonly modifiedItemCount: number;
  readonly modifiedScoreCount: number;
  readonly unchangedScoreCount: number;
  readonly deletedScoreCount: number;

  /** Dosyada geçip sınıf listesinde bulunmadığı için ALINMAYAN satır sayısı. */
  readonly notEnrolledStudentCount: number;

  /** Derse kayıtlı olup dosyada bulunmayan, gride boş eklenen öğrenci sayısı. */
  readonly missingInFileStudentCount: number;
}

/** Sunucudaki `ComparisonIssueCodes` / `ComparisonWarningCodes` ile birebir. */
export const IssueCode = {
  ItemMaxPointMissing: 'ITEM_MAX_POINT_MISSING',
  ScoreExceedsMaxPoint: 'SCORE_EXCEEDS_MAX_POINT',
  NegativeScore: 'NEGATIVE_SCORE',
  ActivityTypeRequired: 'ACTIVITY_TYPE_REQUIRED',
  NameIsImmutable: 'NAME_IS_IMMUTABLE',
  StructureDeleteNotAllowed: 'STRUCTURE_DELETE_NOT_ALLOWED',
  UnknownItem: 'UNKNOWN_ITEM',
  FileReadError: 'FILE_READ_ERROR',
} as const;

export const WarningCode = {
  StudentNotEnrolled: 'STUDENT_NOT_ENROLLED',
  StudentMissingInFile: 'STUDENT_MISSING_IN_FILE',
  ActivityNotInOffering: 'ACTIVITY_NOT_IN_OFFERING',
  ActivityExcluded: 'ACTIVITY_EXCLUDED',
} as const;

// ─────────────────────────────────────────────────────────────
// Faz 0 gridi (elle giriş kolunun başlangıcı)
// ─────────────────────────────────────────────────────────────

export interface AssessmentGrid {
  readonly courseInSemesterId: number;
  readonly courseCode: string;
  readonly courseName: string;
  readonly semesterName: string;
  readonly activities: readonly GridActivity[];
  readonly students: readonly GridStudent[];
  /** SEYREK liste: puanı olmayan hücre burada yoktur. */
  readonly scores: readonly GridScore[];
}

export interface GridActivity {
  readonly id: number;
  readonly name: string;
  readonly activityDefinitionId: number;
  readonly activityDefinitionName: string;
  readonly maxPoint: number;
  readonly items: readonly GridItem[];
}

export interface GridItem {
  readonly id: number;
  readonly activityId: number;
  readonly name: string;
  readonly sequenceNo: number;
  readonly maxPoint: number;
}

export interface GridStudent {
  readonly id: number;
  readonly studentNumber: string;
  readonly fullName: string;
}

export interface GridScore {
  readonly id: number;
  readonly studentId: number;
  readonly activityItemId: number;
  readonly score: number;
}

// ─────────────────────────────────────────────────────────────
// Yazma sonucu
// ─────────────────────────────────────────────────────────────

export interface BulkUploadResult {
  readonly totalCount: number;
  readonly successCount: number;
  readonly failedCount: number;
  readonly createdActivityCount: number;
  readonly createdItemCount: number;
  readonly createdScoreCount: number;
  readonly updatedScoreCount: number;
  readonly unchangedScoreCount: number;
  readonly updatedItemMaxPointCount: number;
  readonly deletedScoreCount: number;
  readonly notEnrolledCount: number;
  readonly failedRecords: readonly FailedRecord[];
}
