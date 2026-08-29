/** `api/InstructorAdmin` sözleşmesi — backend DTO'ları ile birebir. */

import {
  AssignmentEndReasonValue,
  RoleRecordFilter,
} from '@features/admin/shared/person/membership.models';
import { PersonIdentity, PersonSummary } from '@features/admin/shared/person/person.models';

/**
 * `AISIS.Common.Enums.AcademicDuty`.
 *
 * UNVAN İLE KARIŞTIRILMAMALI: unvan (`academicTitle`) kişiye aittir — "Doç. Dr."
 * kişinin kendisidir. GÖREV birime aittir: aynı kişi bir bölümde öğretim üyesi,
 * başka bölümde bölüm başkanı olabilir ve bunlar iki ayrı bağdır.
 */
export const AcademicDuty = {
  Member: 1,
  HeadOfDepartment: 2,
  DeputyHeadOfDepartment: 3,
  Dean: 4,
  ViceDean: 5,
  Director: 6,
  Coordinator: 7,
  BoardMember: 8,
} as const;

export type AcademicDutyValue = (typeof AcademicDuty)[keyof typeof AcademicDuty];

export const ACADEMIC_DUTY_LABELS: Readonly<Record<number, string>> = {
  [AcademicDuty.Member]: 'Öğretim Elemanı',
  [AcademicDuty.HeadOfDepartment]: 'Bölüm Başkanı',
  [AcademicDuty.DeputyHeadOfDepartment]: 'Bölüm Başkan Yardımcısı',
  [AcademicDuty.Dean]: 'Dekan',
  [AcademicDuty.ViceDean]: 'Dekan Yardımcısı',
  [AcademicDuty.Director]: 'Müdür',
  [AcademicDuty.Coordinator]: 'Koordinatör',
  [AcademicDuty.BoardMember]: 'Kurul Üyesi',
};

/** Sıra hiyerarşiyi anlatıyor; etiket haritasından türetilemez. */
export const ACADEMIC_DUTY_OPTIONS: readonly { value: number; label: string }[] = [
  AcademicDuty.Member,
  AcademicDuty.HeadOfDepartment,
  AcademicDuty.DeputyHeadOfDepartment,
  AcademicDuty.Dean,
  AcademicDuty.ViceDean,
  AcademicDuty.Director,
  AcademicDuty.Coordinator,
  AcademicDuty.BoardMember,
].map((value) => ({ value, label: ACADEMIC_DUTY_LABELS[value] ?? '—' }));

/**
 * Listedeki bir AKADEMİK GÖREV DÖNEMİ — kişi değil.
 *
 * Aynı kişinin birden fazla satırı olabilir; ayrıca aynı kişi idari kütükte de
 * kayıtlı olabilir. İki kütük ayrıdır: aynı sicil numarası ikisinde de bulunabilir.
 */
export interface InstructorListItem {
  readonly id: number;
  readonly personId: number;

  readonly nationalId: string;
  readonly fullName: string;

  readonly registryNumber: string;
  readonly academicTitle: string;

  /** Kadrolu mu, ders saati ücretli mi? */
  readonly isFullTime: boolean;

  readonly hireDate: string | null;

  /** null ise görev sürüyor. Açıklık testinin tek ölçütü budur. */
  readonly endDate: string | null;
  readonly isOpen: boolean;

  readonly primaryDepartmentName: string;
  readonly openAssignmentCount: number;
}

/** Bir görev dönemindeki tek birim bağı. */
export interface InstructorAssignment {
  readonly id: number;
  readonly departmentId: number;
  readonly departmentName: string;

  readonly duty: AcademicDutyValue;

  /** Kadrosunun bulunduğu birim. Açık bağlar içinde tek olabilir. */
  readonly isPrimary: boolean;

  readonly startDate: string;
  readonly endDate: string | null;
  readonly endReason: AssignmentEndReasonValue | null;
  readonly isOpen: boolean;
}

export interface InstructorDetail {
  readonly id: number;
  readonly person: PersonSummary;

  readonly registryNumber: string;
  readonly academicTitle: string;
  readonly academicDegree: string;
  readonly isFullTime: boolean;
  readonly hireDate: string | null;
  readonly endDate: string | null;
  readonly isOpen: boolean;

  readonly assignments: readonly InstructorAssignment[];
}

/** Kayıt: kişi + görev dönemi + ilk birim bağı, tek işlemde. */
export interface InstructorCreateCommand {
  readonly person: PersonIdentity;
  readonly registryNumber: string;
  readonly academicTitle: string;
  readonly academicDegree: string;
  readonly isFullTime: boolean;
  readonly hireDate: string | null;
  readonly firstAssignment: InstructorAssignmentCreateCommand;
}

/** Kişi bilgileri buradan DEĞİŞMEZ; onlar Kişiler ekranının işi (K-B). */
export interface InstructorUpdateCommand {
  readonly registryNumber: string;
  readonly academicTitle: string;
  readonly academicDegree: string;
  readonly isFullTime: boolean;
  readonly hireDate: string | null;
}

export interface InstructorAssignmentCreateCommand {
  readonly departmentId: number;
  readonly duty: AcademicDutyValue;
  readonly isPrimary: boolean;
  readonly startDate: string;
}

export interface InstructorAssignmentUpdateCommand {
  readonly duty: AcademicDutyValue;
  readonly isPrimary: boolean;
  readonly startDate: string;
}

/** Listeyi daraltan süzgeçler. Hepsi sunucuya gider — süzme veride yapılır. */
export type InstructorFilter = RoleRecordFilter;
