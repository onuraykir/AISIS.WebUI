/**
 * Çıktı hesabının sözleşmesi.
 *
 * ÖNİZLEME VE KAYIT AYNI TİPİ döner; fark yalnızca `isCommitted`. Böylece hoca
 * gördüğü sayıyı kaydetmiş olur — ekran iki farklı biçimle uğraşmaz.
 */
export interface OutcomeCalculation {
  readonly courseInSemesterId: number;
  readonly courseCode: string;

  /** Engelleyici yoksa hesap yazılabilir. */
  readonly canCommit: boolean;

  /** Bu çağrıda veritabanına yazıldı mı? Önizlemede her zaman false. */
  readonly isCommitted: boolean;

  /** Hesabı durduran sorunlar — hepsi birden gelir. */
  readonly blocking: readonly CalculationIssue[];

  /** Hesabı durdurmayan ama görünmesi gereken durumlar. */
  readonly warnings: readonly CalculationIssue[];

  /** Kaç öğrenci × soru puanı 0 sayıldı. */
  readonly zeroCountedScoreCount: number;

  readonly courseOutcomeResults: readonly CourseOutcomeResultRow[];
  readonly programOutcomeResults: readonly ProgramOutcomeResultRow[];

  readonly studentCount: number;
}

export interface CalculationIssue {
  readonly code: string;
  readonly message: string;

  /** Hangi çıktı / etkinlik / öğrenci — satırı işaretlemek için. */
  readonly identifier: string | null;
}

export interface CourseOutcomeResultRow {
  readonly studentId: number;
  readonly studentNumber: string;
  readonly fullName: string;
  readonly courseOutcomeId: number;
  readonly outcomeCode: string;
  readonly achievementLevel: number;
}

export interface ProgramOutcomeResultRow {
  readonly studentId: number;
  readonly studentNumber: string;
  readonly fullName: string;
  readonly programOutcomeId: number;
  readonly outcomeCode: string;

  /** Dersin çıktı ortalaması. "U" olsa bile yazılır. */
  readonly achievementLevel: number;

  /** "1" | "0" | "U" */
  readonly achievement: string;
}

/**
 * DERS KAPANIŞI RAPORU.
 *
 * Kapanış bir hesaplama adımı değil: hesap zaten koştu. Kapanışın işi denetlemek,
 * mühürlemek ve gerekçesini kayda geçirmek. Kapı hesaptan **daha sıkı** — eksik puan
 * hesapta uyarıdır, kapanışta engeldir.
 */
export interface OutcomeClosure {
  readonly courseInSemesterId: number;
  readonly courseCode: string;
  readonly semesterName: string;

  /** Mühür. null ise açılış hâlâ açık. */
  readonly closedAt: string | null;
  readonly closedByUserId: number | null;
  readonly isClosed: boolean;

  readonly canClose: boolean;
  readonly blocking: readonly CalculationIssue[];
  readonly warnings: readonly CalculationIssue[];

  readonly studentCount: number;
  readonly courseOutcomeResultCount: number;
  readonly programOutcomeResultCount: number;

  /** Çıktı başına kapsam; kapanışta hepsinin %100 olması şart. */
  readonly coverage: readonly OutcomeCoverage[];
}

export interface OutcomeCoverage {
  readonly courseOutcomeId: number;
  readonly outcomeCode: string;
  readonly coveragePercent: number;
}

/** Öğrenci satırı: bir öğrencinin bütün çıktı sonuçları tek satırda. */
export interface StudentOutcomeRow {
  readonly studentId: number;
  readonly studentNumber: string;
  readonly fullName: string;

  /** Çıktı kodu -> başarı. Kolon sırası `outcomeCodes` ile aynıdır. */
  readonly levels: readonly number[];

  readonly average: number;
}
