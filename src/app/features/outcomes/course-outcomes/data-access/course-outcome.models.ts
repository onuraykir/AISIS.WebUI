/**
 * DERS ÇIKTISI — `api/CourseOutcome` sözleşmesi.
 *
 * Ders çıktısı bir **açılışın** kazanımıdır, dersin tanımının değil (K-I/B).
 * Sebebi somut: derse bağlıyken aynı vize bütün dönemlerde ortaktı; 2026 için
 * şablon değiştirildiğinde 2025'in puanları da gidiyor ve dersi tekrar alan
 * öğrencinin iki denemesi ayrışamıyordu.
 *
 * Kod açılış içinde TEKİLDİR: aynı açılışta iki `DÇ1` olamaz.
 */

export interface CourseOutcome {
  readonly id: number;
  readonly courseInSemesterId: number;
  readonly code: string;
  readonly description: string;
}

export interface CourseOutcomeCreateCommand {
  readonly courseInSemesterId: number;
  readonly code: string;
  readonly description: string;
}

/**
 * Güncelleme gövdesi. AÇILIŞ BİLGİSİ BURADA YOK — adreste gider
 * (`update-course-outcome/{courseInSemesterId}`) ve sunucu gövdedeki `id` ile
 * karşılaştırıp sahipliği doğrular.
 */
export interface CourseOutcomeUpdateCommand {
  readonly id: number;
  readonly code: string;
  readonly description: string;
}
