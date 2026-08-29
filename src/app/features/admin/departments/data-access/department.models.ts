/** `api/DepartmentAdmin` sözleşmesi — backend DTO'ları ile birebir. */

/** `AISIS.Common.Enums.DepartmentType`. Backend enum'ları sayı olarak serileştiriyor. */
export const DepartmentType = {
  Academic: 0,
  Administrative: 1,
} as const;

export type DepartmentTypeValue = (typeof DepartmentType)[keyof typeof DepartmentType];

/** `AISIS.Common.Enums.DepartmentLevel`. */
export const DepartmentLevel = {
  /** Üniversitenin örgüt kökü. */
  Rectorate: 7,
  Faculty: 1,
  Institute: 2,
  School: 3,
  Department: 4,
  Program: 5,
  AdministrativeUnit: 6,
} as const;

export type DepartmentLevelValue = (typeof DepartmentLevel)[keyof typeof DepartmentLevel];

export const DEPARTMENT_TYPE_LABELS: Readonly<Record<number, string>> = {
  [DepartmentType.Academic]: 'Akademik',
  [DepartmentType.Administrative]: 'İdari',
};

export const DEPARTMENT_LEVEL_LABELS: Readonly<Record<number, string>> = {
  [DepartmentLevel.Rectorate]: 'Rektörlük',
  [DepartmentLevel.Faculty]: 'Fakülte',
  [DepartmentLevel.Institute]: 'Enstitü',
  [DepartmentLevel.School]: 'Yüksekokul',
  [DepartmentLevel.Department]: 'Bölüm',
  [DepartmentLevel.Program]: 'Program',
  [DepartmentLevel.AdministrativeUnit]: 'İdari Birim',
};

/**
 * Seçim listesinin sırası. Etiket haritasından türetilemez: JavaScript nesnesi
 * sayı benzeri anahtarları ARTAN SIRADA döndürür, yani Rektörlük (7) sona düşerdi.
 * Sıra hiyerarşiyi anlatıyor, alfabetik veya sayısal değil.
 */
export const DEPARTMENT_LEVEL_OPTIONS: readonly { value: number; label: string }[] = [
  DepartmentLevel.Rectorate,
  DepartmentLevel.Faculty,
  DepartmentLevel.Institute,
  DepartmentLevel.School,
  DepartmentLevel.Department,
  DepartmentLevel.Program,
  DepartmentLevel.AdministrativeUnit,
].map((value) => ({ value, label: DEPARTMENT_LEVEL_LABELS[value] ?? '—' }));

/** Tip listesi; iki değer olduğu için sırası doğal. */
export const DEPARTMENT_TYPE_OPTIONS: readonly { value: number; label: string }[] = [
  DepartmentType.Academic,
  DepartmentType.Administrative,
].map((value) => ({ value, label: DEPARTMENT_TYPE_LABELS[value] ?? '—' }));

/** Ağaçtaki bir birim. Sayaçlar yalnızca AÇIK bağları sayar. */
export interface DepartmentTreeNode {
  readonly id: number;
  readonly code: string;
  readonly name: string;
  readonly type: DepartmentTypeValue;
  readonly level: DepartmentLevelValue;
  readonly isActive: boolean;

  /** null ise kök birim. */
  readonly parentDepartmentId: number | null;

  readonly studentCount: number;
  readonly instructorCount: number;
  readonly staffCount: number;
  readonly courseCount: number;
  readonly userCount: number;

  readonly subDepartments: readonly DepartmentTreeNode[];
}

/** Seçim listeleri için düzleştirilmiş birim; `path` ağaçtaki yolu taşır. */
export interface DepartmentOption {
  readonly id: number;
  readonly code: string;
  readonly path: string;
  readonly type: DepartmentTypeValue;
  readonly level: DepartmentLevelValue;
  readonly isActive: boolean;
}

export interface DepartmentCreateCommand {
  readonly code: string;
  readonly name: string;
  readonly type: DepartmentTypeValue;
  readonly level: DepartmentLevelValue;
  /** null ise kök birim oluşur. */
  readonly parentDepartmentId: number | null;
}

/** Kod ve üst birim bilerek yok: kod değişmez, taşıma kendi ucundan yapılır. */
export interface DepartmentUpdateCommand {
  readonly name: string;
  readonly type: DepartmentTypeValue;
  readonly level: DepartmentLevelValue;
  readonly isActive: boolean;
}

export interface DepartmentMoveCommand {
  /** null ise birim köke çıkar. */
  readonly parentDepartmentId: number | null;
}
