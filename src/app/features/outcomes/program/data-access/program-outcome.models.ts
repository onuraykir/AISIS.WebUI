/**
 * PROGRAM ÇIKTISI ve EŞİĞİ.
 *
 * Program çıktısı derse değil **programa** aittir ve sürümlenir: akreditasyon
 * döngüsünde çıktı metinleri değişir, geçmiş dönemin raporu eski sürüme dayanmalıdır.
 *
 * Eşik, çıktı hesabının **son adımıdır**: öğrencinin ders çıktısı ortalaması (0–5)
 * bu değerle karşılaştırılıp başarılı/başarısız kararına dönüşür. Yürürlükte eşiği
 * olmayan bir program çıktısı hesabı **durdurur**.
 */

export interface ProgramOutcome {
  readonly id: number;
  readonly code: string;
  readonly description: string;
  readonly isActive: boolean;
  readonly version: string;
}

export interface ProgramOutcomeCreateCommand {
  readonly code: string;
  readonly description: string;
  readonly isActive: boolean;
  readonly version: string;
}

export interface ProgramOutcomeUpdateCommand {
  readonly id: number;
  readonly code: string;
  readonly description: string;
  readonly isActive: boolean;
  readonly version: string;
}

/**
 * Bir program çıktısının eşik değeri.
 *
 * `minValue` GEÇME EŞİĞİDİR — hesap bunu okuyor. `targetValue` programın hedefi;
 * raporlamada kullanılır, karara girmez.
 *
 * Bir çıktının EN FAZLA BİR eşiği yürürlükte olabilir.
 */
export interface ProgramOutcomeThreshold {
  readonly id: number;
  readonly programOutcomeId: number;

  /** Geçme eşiği, 0–5 ölçeğinde. Hesabın okuduğu değer budur. */
  readonly minValue: number;

  /** Programın hedefi; raporlama için. Karara girmez. */
  readonly targetValue: number;

  readonly isActive: boolean;
}

export interface ProgramOutcomeThresholdCreateCommand {
  readonly programOutcomeId: number;
  readonly minValue: number;
  readonly targetValue: number;
  readonly isActive: boolean;
}

export interface ProgramOutcomeThresholdUpdateCommand {
  readonly id: number;
  readonly programOutcomeId: number;
  readonly minValue: number;
  readonly targetValue: number;
  readonly isActive: boolean;
}
