/** `api/CourseAdmin` sözleşmesi — backend DTO'ları ile birebir. */

/**
 * Ders TANIMI. Dönem bilgisi taşımaz: bir dersin bir dönemde açılması ayrı bir
 * kayıttır ve Ders Açılışı ekranının işidir.
 */
export interface CourseListItem {
  readonly id: number;
  readonly courseCode: string;
  readonly name: string;
  readonly akts: number;

  readonly departmentCount: number;
  readonly qualifiedInstructorCount: number;

  /** Kaç dönemde açılmış? Sıfır değilse silinemez. */
  readonly offeringCount: number;
}

/**
 * Dersin bir bölümün müfredatındaki yeri.
 *
 * ZORUNLULUK BÖLÜME AİT: aynı ders bir bölümde zorunlu, başkasında seçmeli olabilir.
 */
export interface CourseDepartment {
  readonly id: number;
  readonly departmentId: number;
  readonly departmentName: string;
  readonly departmentCode: string;
  readonly isRequired: boolean;
  readonly recommendedTerm: number | null;
}

/** Dersi verebilecek hoca. ATAMA DEĞİLDİR — açılışta aday listesini daraltır. */
export interface CourseInstructor {
  readonly id: number;
  readonly instructorId: number;
  readonly fullName: string;
  readonly academicTitle: string;
  readonly registryNumber: string;
  readonly isOpen: boolean;
}

export interface CourseDetail {
  readonly id: number;
  readonly courseCode: string;
  readonly name: string;
  readonly akts: number;
  readonly offeringCount: number;

  readonly departments: readonly CourseDepartment[];
  readonly qualifiedInstructors: readonly CourseInstructor[];
}

export interface CourseCreateCommand {
  readonly courseCode: string;
  readonly name: string;
  readonly akts: number;
}

/** Kod YOKTUR: bir kez verilir, Excel eşlemesi ona dayanır. */
export interface CourseUpdateCommand {
  readonly name: string;
  readonly akts: number;
}

export interface CourseDepartmentCreateCommand {
  readonly departmentId: number;
  readonly isRequired: boolean;
  readonly recommendedTerm: number | null;
}

export interface CourseDepartmentUpdateCommand {
  readonly isRequired: boolean;
  readonly recommendedTerm: number | null;
}

export interface CourseFilter {
  readonly departmentId: number | null;
  readonly search: string;
}
