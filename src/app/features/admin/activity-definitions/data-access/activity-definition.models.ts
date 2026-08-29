/** `api/ActivityDefinitionAdmin` sözleşmesi — backend DTO'ları ile birebir. */

/**
 * Değerlendirme etkinliği tanımı — ortak sözlük satırı.
 *
 * Ders açılışına etkinlik eklenirken buradan seçilir; her açılış kendi adını
 * yazmaz. Sade tutuldu: puan, ağırlık ve sorular açılışa aittir.
 */
export interface ActivityDefinition {
  readonly id: number;

  /** Ortamlar arası sabit tutamaç, örn. "MIDTERM". */
  readonly code: string;

  /** Ekranda görünen ad, örn. "Vize". */
  readonly name: string;

  /** Kaç ders açılışında kullanılıyor? Sıfır değilse silinemez. */
  readonly usageCount: number;
}

export interface ActivityDefinitionCreateCommand {
  readonly code: string;
  readonly name: string;
}

/** Kod YOKTUR: bir kez verilir, değişmez. */
export interface ActivityDefinitionUpdateCommand {
  readonly name: string;
}
