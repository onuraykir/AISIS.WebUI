/** `api/StaffAdmin` sözleşmesi — backend DTO'ları ile birebir. */

import {
  AssignmentEndReasonValue,
  RoleRecordFilter,
} from '@features/admin/shared/person/membership.models';
import { PersonIdentity, PersonSummary } from '@features/admin/shared/person/person.models';

/** `AISIS.Common.Enums.AdministrativeDuty`. */
export const AdministrativeDuty = {
  Officer: 1,
  Chief: 2,
  BranchManager: 3,
  HeadOfUnit: 4,
  Secretary: 5,
  SecretaryGeneral: 6,
} as const;

export type AdministrativeDutyValue = (typeof AdministrativeDuty)[keyof typeof AdministrativeDuty];

export const ADMINISTRATIVE_DUTY_LABELS: Readonly<Record<number, string>> = {
  [AdministrativeDuty.Officer]: 'Memur',
  [AdministrativeDuty.Chief]: 'Şef',
  [AdministrativeDuty.BranchManager]: 'Şube Müdürü',
  [AdministrativeDuty.HeadOfUnit]: 'Daire Başkanı',
  [AdministrativeDuty.Secretary]: 'Sekreter',
  [AdministrativeDuty.SecretaryGeneral]: 'Genel Sekreter',
};

/**
 * Seçim listesinin sırası. Etiket haritasından türetilemez: JavaScript nesnesi
 * sayı benzeri anahtarları artan sırada döndürür ve sıra burada hiyerarşiyi
 * anlatıyor — aynı tuzak `DEPARTMENT_LEVEL_OPTIONS`'ta da vardı.
 */
export const ADMINISTRATIVE_DUTY_OPTIONS: readonly { value: number; label: string }[] = [
  AdministrativeDuty.Officer,
  AdministrativeDuty.Chief,
  AdministrativeDuty.BranchManager,
  AdministrativeDuty.HeadOfUnit,
  AdministrativeDuty.Secretary,
  AdministrativeDuty.SecretaryGeneral,
].map((value) => ({ value, label: ADMINISTRATIVE_DUTY_LABELS[value] ?? '—' }));

/**
 * Listedeki bir GÖREV DÖNEMİ — kişi değil.
 *
 * Aynı kişinin birden fazla satırı olabilir: yıllar sonra dönen personelin ikinci
 * bir kaydı açılır, eskisi geçmişiyle durur. Bu yüzden liste kişi başına değil
 * KAYIT başına bir satırdır.
 */
export interface StaffListItem {
  readonly id: number;
  readonly personId: number;

  readonly nationalId: string;
  readonly fullName: string;

  readonly registryNumber: string;
  readonly jobTitle: string;

  readonly hireDate: string | null;

  /** null ise görev sürüyor. Açıklık testinin tek ölçütü budur. */
  readonly endDate: string | null;
  readonly isOpen: boolean;

  readonly primaryDepartmentName: string;
  readonly openAssignmentCount: number;
}

/** Bir görev dönemindeki tek birim bağı. */
export interface StaffAssignment {
  readonly id: number;
  readonly departmentId: number;
  readonly departmentName: string;

  readonly duty: AdministrativeDutyValue;

  /** Kadrosunun bulunduğu birim. Açık bağlar içinde tek olabilir. */
  readonly isPrimary: boolean;

  readonly startDate: string;
  readonly endDate: string | null;
  readonly endReason: AssignmentEndReasonValue | null;
  readonly isOpen: boolean;
}

export interface StaffDetail {
  readonly id: number;
  readonly person: PersonSummary;

  readonly registryNumber: string;
  readonly jobTitle: string;
  readonly hireDate: string | null;
  readonly endDate: string | null;
  readonly isOpen: boolean;

  readonly assignments: readonly StaffAssignment[];
}

/** Kayıt: kişi + görev dönemi + ilk birim bağı, tek işlemde. */
export interface StaffCreateCommand {
  readonly person: PersonIdentity;
  readonly registryNumber: string;
  readonly jobTitle: string;
  readonly hireDate: string | null;
  readonly firstAssignment: StaffAssignmentCreateCommand;
}

/** Kişi bilgileri buradan DEĞİŞMEZ; onlar Kişiler ekranının işi (K-B). */
export interface StaffUpdateCommand {
  readonly registryNumber: string;
  readonly jobTitle: string;
  readonly hireDate: string | null;
}

export interface StaffAssignmentCreateCommand {
  readonly departmentId: number;
  readonly duty: AdministrativeDutyValue;
  readonly isPrimary: boolean;
  readonly startDate: string;
}

export interface StaffAssignmentUpdateCommand {
  readonly duty: AdministrativeDutyValue;
  readonly isPrimary: boolean;
  readonly startDate: string;
}

/** Listeyi daraltan süzgeçler. Hepsi sunucuya gider — süzme veride yapılır. */
export type StaffFilter = RoleRecordFilter;
