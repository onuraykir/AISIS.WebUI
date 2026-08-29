/**
 * Kimlik bloğunun ortak sözleşmesi.
 *
 * Üç kayıt akışı da (öğrenci, akademik, idari) aynı blokla başlar: önce TCKN,
 * sonra role özgü alanlar (K-A). Tek yerde durması, üç ekranın aynı formu üç
 * ayrı tiple anlatmasını engelliyor.
 */

/** `AISIS.Common.Enums.Gender`. */
export const Gender = {
  Unspecified: 0,
  Female: 1,
  Male: 2,
} as const;

export type GenderValue = (typeof Gender)[keyof typeof Gender];

export const GENDER_LABELS: Readonly<Record<number, string>> = {
  [Gender.Unspecified]: 'Belirtilmemiş',
  [Gender.Female]: 'Kadın',
  [Gender.Male]: 'Erkek',
};

export const GENDER_OPTIONS: readonly { value: number; label: string }[] = [
  Gender.Unspecified,
  Gender.Female,
  Gender.Male,
].map((value) => ({ value, label: GENDER_LABELS[value] ?? '—' }));

/** Kayıt akışına giren kimlik bilgisi. Kişi TCKN ile bulunur VEYA oluşturulur. */
export interface PersonIdentity {
  readonly nationalId: string;
  readonly name: string;
  readonly surname: string;
  readonly birthDate: string | null;
  readonly gender: GenderValue;
  readonly email: string;
  readonly phone: string;
}

/** Rol kayıtlarının künyesinde gösterilen kişi özeti. */
export interface PersonSummary {
  readonly id: number;
  readonly nationalId: string;
  readonly name: string;
  readonly surname: string;
  readonly fullName: string;
  readonly birthDate: string | null;
  readonly gender: GenderValue;
  readonly email: string;
  readonly phone: string;
}

/**
 * Kayıt sonucu.
 *
 * `identityDifferences` HATA DEĞİL UYARIDIR (K-B): TCKN kayıtlıysa mevcut kişi
 * kullanılır ve kimlik alanları sessizce ezilmez; girilen ile kayıtlı olan
 * arasındaki fark burada bildirilir. Düzeltme Kişiler ekranından yapılır.
 */
export interface RoleRecordCreated {
  readonly id: number;
  readonly personId: number;
  readonly personExisted: boolean;
  readonly identityDifferences: readonly string[];
}
