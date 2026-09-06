/** `api/SemesterAdmin` sözleşmesi — backend DTO'ları ile birebir. */

/**
 * `AISIS.Common.Enums.SemesterStatus`.
 *
 * Tek bir `isActive` bayrağı yerine durum var: "aktif değil" üç ayrı şeyi birden
 * anlatırdı — henüz açılmadı, notları giriliyor, kapandı.
 */
export const SemesterStatus = {
  Planned: 1,
  Open: 2,
  Grading: 3,
  Closed: 4,
} as const;

export type SemesterStatusValue = (typeof SemesterStatus)[keyof typeof SemesterStatus];

export const SEMESTER_STATUS_LABELS: Readonly<Record<number, string>> = {
  [SemesterStatus.Planned]: 'Hazırlık',
  [SemesterStatus.Open]: 'Açık',
  [SemesterStatus.Grading]: 'Not girişi',
  [SemesterStatus.Closed]: 'Kapalı',
};

/** Ne yapılabildiğini anlatan tek satır; formda seçimin altında gösterilir. */
export const SEMESTER_STATUS_HINTS: Readonly<Record<number, string>> = {
  [SemesterStatus.Planned]: 'Ders açılışı kurulur, not girilmez.',
  [SemesterStatus.Open]: 'Ders dönemi sürüyor. Aynı anda yalnızca bir dönem açık olabilir.',
  [SemesterStatus.Grading]: 'Ders bitti, yalnızca not girişi açık.',
  [SemesterStatus.Closed]: 'Salt okunur. Çıktı hesapları donar.',
};

/** Sıra yaşam döngüsünü anlatıyor; etiket haritasından türetilemez. */
export const SEMESTER_STATUS_OPTIONS: readonly { value: number; label: string }[] = [
  SemesterStatus.Planned,
  SemesterStatus.Open,
  SemesterStatus.Grading,
  SemesterStatus.Closed,
].map((value) => ({ value, label: SEMESTER_STATUS_LABELS[value] ?? '—' }));

/** Listedeki bir dönem. Sıralama başlangıç tarihine göre, yeniden eskiye. */
/**
 * DÖNEM KAPANIŞI RAPORU.
 *
 * Ders kapanışından farkı: burada yeni bir **ölçüm** yapılmaz. Ders sonuçları zaten
 * donmuştur; dönem kapanışı onları toplar ve öğrencinin dersler ötesi program çıktısı
 * sonucunu üretir.
 */
export interface SemesterClosure {
  readonly semesterId: number;
  readonly semesterName: string;

  readonly isClosed: boolean;

  /** K3 sağlandı mı? */
  readonly canClose: boolean;

  /** Hâlâ açık ders açılışları — adlarıyla, çünkü kullanıcı hangisi olduğunu bilmeli. */
  readonly openOfferings: readonly string[];

  readonly offeringCount: number;
  readonly closedOfferingCount: number;

  readonly affectedStudentCount: number;
  readonly studentProgramOutcomeResultCount: number;
}

export interface SemesterListItem {
  readonly id: number;
  readonly code: string;
  readonly name: string;

  readonly startDate: string;
  readonly endDate: string;

  readonly status: SemesterStatusValue;

  /** Uygulamanın varsayılan dönemi mi? */
  readonly isCurrent: boolean;

  readonly courseCount: number;
}

export interface SemesterDetail {
  readonly id: number;
  readonly code: string;
  readonly name: string;

  readonly startDate: string;
  readonly endDate: string;

  readonly status: SemesterStatusValue;
  readonly isCurrent: boolean;

  readonly courseCount: number;

  /** Bu döneme bağlı tüm kayıtların toplamı; sıfır değilse silinemez. */
  readonly linkedRecordCount: number;
}

/** Kod bir kez verilir ve değişmez. */
export interface SemesterCreateCommand {
  readonly code: string;
  readonly name: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly status: SemesterStatusValue;
}

/**
 * Kod YOK: değişmez. `isCurrent` de yok — güncel dönemi seçmek ayrı bir uçtur,
 * çünkü aynı işlemde eskisinin düşürülmesi gerekir.
 */
export interface SemesterUpdateCommand {
  readonly name: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly status: SemesterStatusValue;
}

export interface SemesterFilter {
  readonly status: SemesterStatusValue | null;
  readonly search: string;
}
