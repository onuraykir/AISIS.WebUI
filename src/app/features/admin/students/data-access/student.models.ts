/** `api/StudentAdmin` sözleşmesi — backend DTO'ları ile birebir. */

import { RoleRecordFilter } from '@features/admin/shared/person/membership.models';
import { PersonIdentity, PersonSummary } from '@features/admin/shared/person/person.models';

/** `AISIS.Common.Enums.StudentLevel`. */
export const StudentLevel = {
  Associate: 1,
  Bachelor: 2,
  Master: 3,
  Doctorate: 4,
} as const;

export type StudentLevelValue = (typeof StudentLevel)[keyof typeof StudentLevel];

export const STUDENT_LEVEL_LABELS: Readonly<Record<number, string>> = {
  [StudentLevel.Associate]: 'Ön Lisans',
  [StudentLevel.Bachelor]: 'Lisans',
  [StudentLevel.Master]: 'Yüksek Lisans',
  [StudentLevel.Doctorate]: 'Doktora',
};

export const STUDENT_LEVEL_OPTIONS: readonly { value: number; label: string }[] = [
  StudentLevel.Associate,
  StudentLevel.Bachelor,
  StudentLevel.Master,
  StudentLevel.Doctorate,
].map((value) => ({ value, label: STUDENT_LEVEL_LABELS[value] ?? '—' }));

/**
 * `AISIS.Common.Enums.EnrollmentKind`.
 *
 * ANADAL BURADAN OKUNUR — ayrı bir `isPrimary` alanı YOKTUR. İki alan olsaydı
 * çelişebilirlerdi ("anadalı ÇAP olan öğrenci") ve hiçbir kısıt itiraz etmezdi.
 *
 * TEK EKSEN: bu liste yalnızca "bu bağ ne?" sorusunu cevaplar. "Öğrenci nasıl
 * geldi?" (yatay geçiş, dikey geçiş…) ayrı bir eksendir ve buraya karışmaz.
 */
export const EnrollmentKind = {
  Primary: 1,
  DoubleMajor: 2,
  MinorProgram: 3,
  Exchange: 4,
  SpecialStudent: 5,
} as const;

export type EnrollmentKindValue = (typeof EnrollmentKind)[keyof typeof EnrollmentKind];

export const ENROLLMENT_KIND_LABELS: Readonly<Record<number, string>> = {
  [EnrollmentKind.Primary]: 'Anadal',
  [EnrollmentKind.DoubleMajor]: 'Çift Anadal (ÇAP)',
  [EnrollmentKind.MinorProgram]: 'Yandal',
  [EnrollmentKind.Exchange]: 'Değişim Öğrencisi',
  [EnrollmentKind.SpecialStudent]: 'Özel Öğrenci',
};

export const ENROLLMENT_KIND_OPTIONS: readonly { value: number; label: string }[] = [
  EnrollmentKind.Primary,
  EnrollmentKind.DoubleMajor,
  EnrollmentKind.MinorProgram,
  EnrollmentKind.Exchange,
  EnrollmentKind.SpecialStudent,
].map((value) => ({ value, label: ENROLLMENT_KIND_LABELS[value] ?? '—' }));

/**
 * `AISIS.Common.Enums.EnrollmentEndReason`.
 *
 * Personel şeridindeki `AssignmentEndReason` ile KARIŞTIRILMAMALI: orada istifa,
 * emeklilik, atama vardır; burada mezuniyet ve kayıt silme. İki ayrı küme.
 */
export const EnrollmentEndReason = {
  Graduated: 1,
  Withdrawn: 2,
  Dismissed: 3,
  Transferred: 4,
  TermEnded: 5,
} as const;

export type EnrollmentEndReasonValue =
  (typeof EnrollmentEndReason)[keyof typeof EnrollmentEndReason];

export const ENROLLMENT_END_REASON_LABELS: Readonly<Record<number, string>> = {
  [EnrollmentEndReason.Graduated]: 'Mezun oldu',
  [EnrollmentEndReason.Withdrawn]: 'Ayrıldı',
  [EnrollmentEndReason.Dismissed]: 'Kaydı silindi',
  [EnrollmentEndReason.Transferred]: 'Nakil',
  [EnrollmentEndReason.TermEnded]: 'Süresi doldu',
};

export const ENROLLMENT_END_REASON_OPTIONS: readonly { value: number; label: string }[] = [
  EnrollmentEndReason.Graduated,
  EnrollmentEndReason.Withdrawn,
  EnrollmentEndReason.Dismissed,
  EnrollmentEndReason.Transferred,
  EnrollmentEndReason.TermEnded,
].map((value) => ({ value, label: ENROLLMENT_END_REASON_LABELS[value] ?? '—' }));

/**
 * `AISIS.Common.Enums.StudentStatus`.
 *
 * `Active` ve `OnLeave` "sürüyor" demektir; kalanlar kapanmış kaydın SEBEBİDİR.
 * Açıklık testi yine de `endDate == null`'dır — üç şeritte de aynı ölçüt.
 */
export const StudentStatus = {
  Active: 1,
  OnLeave: 2,
  Graduated: 3,
  Withdrawn: 4,
  Dismissed: 5,
  Transferred: 6,
} as const;

export type StudentStatusValue = (typeof StudentStatus)[keyof typeof StudentStatus];

export const STUDENT_STATUS_LABELS: Readonly<Record<number, string>> = {
  [StudentStatus.Active]: 'Etkin',
  [StudentStatus.OnLeave]: 'Kaydı dondurulmuş',
  [StudentStatus.Graduated]: 'Mezun',
  [StudentStatus.Withdrawn]: 'Ayrıldı',
  [StudentStatus.Dismissed]: 'Kaydı silindi',
  [StudentStatus.Transferred]: 'Nakil',
};

/** Listedeki bir ÖĞRENCİLİK DÖNEMİ — kişi değil (Ö3). */
export interface StudentListItem {
  readonly id: number;
  readonly personId: number;

  readonly nationalId: string;
  readonly fullName: string;

  readonly studentNumber: string;
  readonly enrollmentYear: number;
  readonly gpa: number;

  readonly status: StudentStatusValue;

  readonly admissionDate: string | null;

  /** null ise öğrencilik sürüyor. Açıklık testinin tek ölçütü budur. */
  readonly endDate: string | null;
  readonly isOpen: boolean;

  /** Açık ANADAL bağının birimi; `EnrollmentKind.Primary`'den okunur. */
  readonly primaryDepartmentName: string;
  readonly openEnrollmentCount: number;
}

/** Bir öğrencilik kaydının bir bölümle bağı. Anadal, ÇAP ve yandal AYRI satırlardır. */
export interface StudentEnrollment {
  readonly id: number;
  readonly departmentId: number;
  readonly departmentName: string;

  readonly level: StudentLevelValue;
  readonly enrollmentKind: EnrollmentKindValue;

  /** Sunucuda `enrollmentKind === Primary`'den TÜRETİLİR; saklanan alan değildir. */
  readonly isPrimary: boolean;

  readonly startDate: string;
  readonly endDate: string | null;
  readonly endReason: EnrollmentEndReasonValue | null;
  readonly isOpen: boolean;
}

export interface StudentDetail {
  readonly id: number;
  readonly person: PersonSummary;

  readonly studentNumber: string;
  readonly admissionDate: string | null;
  readonly enrollmentYear: number;
  readonly gpa: number;

  readonly status: StudentStatusValue;
  readonly endDate: string | null;

  /** Yalnızca mezun kayıtlarda dolar. */
  readonly graduationDate: string | null;

  readonly isOpen: boolean;

  readonly enrollments: readonly StudentEnrollment[];
}

/**
 * Kayıt: kişi + öğrencilik dönemi + ilk bölüm bağı, tek işlemde.
 *
 * İlk bağ HER ZAMAN anadaldır (R2) — ÇAP'ı olup anadalı olmayan öğrenci yoktur —
 * bu yüzden gövdede kayıt türü sorulmaz.
 */
export interface StudentCreateCommand {
  readonly person: PersonIdentity;
  readonly studentNumber: string;
  readonly admissionDate: string | null;
  readonly enrollmentYear: number;
  readonly firstEnrollment: StudentFirstEnrollmentCommand;
}

export interface StudentFirstEnrollmentCommand {
  readonly departmentId: number;
  readonly level: StudentLevelValue;
  readonly startDate: string;
}

/** Kişi bilgileri buradan DEĞİŞMEZ; onlar Kişiler ekranının işi (K-B). */
export interface StudentUpdateCommand {
  readonly studentNumber: string;
  readonly admissionDate: string | null;
  readonly enrollmentYear: number;
  readonly gpa: number;
}

export interface StudentEnrollmentCreateCommand {
  readonly departmentId: number;
  readonly level: StudentLevelValue;
  readonly enrollmentKind: EnrollmentKindValue;
  readonly startDate: string;
}

export interface StudentEnrollmentUpdateCommand {
  readonly level: StudentLevelValue;
  readonly enrollmentKind: EnrollmentKindValue;
  readonly startDate: string;
}

/** Bir bölüm bağını kapatır. Sebep `EnrollmentEndReason`'dandır. */
export interface EnrollmentCloseCommand {
  readonly endDate: string;
  readonly endReason: EnrollmentEndReasonValue;
}

/**
 * Öğrenciliğin TAMAMINI sonlandıran uçların ortak gövdesi.
 *
 * Sebep gövdede değil UÇTA: mezuniyet, ayrılma, kayıt silme ve nakil ayrı
 * yetkilerdir ve farklı alanlar yazarlar (mezuniyette `graduationDate` da dolar).
 */
export interface StudentEndCommand {
  readonly endDate: string;
}

/** Listeyi daraltan süzgeçler. Hepsi sunucuya gider — süzme veride yapılır. */
export type StudentFilter = RoleRecordFilter;
