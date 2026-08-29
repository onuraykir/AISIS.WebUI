/**
 * Birim bağlarının ORTAK sözleşmesi.
 *
 * Akademik ve idari şerit aynı kapatma gövdesini ve aynı sebep kümesini kullanır
 * (backend'de `MembershipDtos.cs`). Öğrenci şeridi AYRIDIR: orada sebep
 * `EnrollmentEndReason`'dır — mezuniyet, kayıt silme… — ve bu listeye karışmaz.
 */

/** `AISIS.Common.Enums.AssignmentEndReason`. */
export const AssignmentEndReason = {
  TermEnded: 1,
  Reassigned: 2,
  Resigned: 3,
  Retired: 4,
  ContractEnded: 5,
} as const;

export type AssignmentEndReasonValue =
  (typeof AssignmentEndReason)[keyof typeof AssignmentEndReason];

export const ASSIGNMENT_END_REASON_LABELS: Readonly<Record<number, string>> = {
  [AssignmentEndReason.TermEnded]: 'Görev süresi doldu',
  [AssignmentEndReason.Reassigned]: 'Başka birime atandı',
  [AssignmentEndReason.Resigned]: 'İstifa etti',
  [AssignmentEndReason.Retired]: 'Emekli oldu',
  [AssignmentEndReason.ContractEnded]: 'Sözleşmesi bitti',
};

export const ASSIGNMENT_END_REASON_OPTIONS: readonly { value: number; label: string }[] = [
  AssignmentEndReason.TermEnded,
  AssignmentEndReason.Reassigned,
  AssignmentEndReason.Resigned,
  AssignmentEndReason.Retired,
  AssignmentEndReason.ContractEnded,
].map((value) => ({ value, label: ASSIGNMENT_END_REASON_LABELS[value] ?? '—' }));

/** Bir bağı ya da görev döneminin tamamını kapatır; ikisi de aynı gövde. */
export interface AssignmentCloseCommand {
  readonly endDate: string;
  readonly endReason: AssignmentEndReasonValue;
}

/**
 * Rol kaydı listelerinin ortak süzgeci. Üç şerit de aynı üç soruyu soruyor:
 * hangi birimde, açık mı, hangi metin.
 */
export interface RoleRecordFilter {
  readonly departmentId: number | null;
  readonly onlyOpen: boolean | null;
  readonly search: string;
}
