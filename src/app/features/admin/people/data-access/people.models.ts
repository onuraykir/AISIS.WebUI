/** `api/PersonAdmin` sözleşmesi — backend DTO'ları ile birebir. */

import { GenderValue, PersonSummary } from '@features/admin/shared/person/person.models';

/**
 * Aramanın bir satırı. Üç şeridin SAYISI burada; ayrıntısı künyede.
 *
 * Sayılar AÇIK kayıtları sayar: "bu kişi öğrenci mi?" sorusunun cevabı satır var
 * mı değil, açık satır var mı'dır. `totalRecordCount` ayrıca duruyor ki geçmişi
 * olan kişi de görünsün.
 */
export interface PersonSearchItem {
  readonly id: number;
  readonly nationalId: string;
  readonly name: string;
  readonly surname: string;
  readonly fullName: string;

  readonly openStudentCount: number;
  readonly openInstructorCount: number;
  readonly openStaffCount: number;

  readonly totalRecordCount: number;
}

/**
 * Bir rol kaydının şerit bağımsız özeti.
 *
 * Üç şerit aynı kutuda gösterilebilsin diye ortak alanlara indirgenmiştir; şeride
 * özgü her şey `detail` içinde tek satırlık metindir.
 */
export interface PersonRoleRecord {
  /** Rol kaydının kimliği. Şeridin kendi ekranına bu numarayla geçilir. */
  readonly id: number;

  /** Öğrenci numarası veya sicil numarası. */
  readonly number: string;

  /** Unvan, seviye, görev gibi şeride özgü özet. */
  readonly detail: string;

  readonly primaryDepartmentName: string;

  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly isOpen: boolean;

  /** Kapanmış kayıtlarda sebep ("Mezun", "Ayrıldı"…); açıkta boş. */
  readonly statusText: string;
}

/**
 * Kişi künyesi: kimlik + ÜÇ ŞERİT AYRI AYRI.
 *
 * Şeritler bilerek tek listede birleştirilmedi: öğrenci numarası ile akademik
 * sicil ayrı kütüklerin sayılarıdır ve aynı anda ikisi de bulunabilir.
 */
export interface PersonDetail {
  readonly person: PersonSummary;

  readonly studentRecords: readonly PersonRoleRecord[];
  readonly instructorRecords: readonly PersonRoleRecord[];
  readonly staffRecords: readonly PersonRoleRecord[];
}

/**
 * Kişi kartının düzeltilmesi.
 *
 * K-B'nin ikinci yarısı: kayıt akışları kimlik alanlarını sessizce EZMEZ, farkı
 * bildirir — düzeltme burada, bilinçli bir eylem olarak yapılır.
 */
export interface PersonUpdateCommand {
  readonly nationalId: string;
  readonly name: string;
  readonly surname: string;
  readonly birthDate: string | null;
  readonly gender: GenderValue;
  readonly email: string;
  readonly phone: string;
}
