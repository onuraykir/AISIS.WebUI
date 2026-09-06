/** `api/CourseInSemesterAdmin` sözleşmesi — backend DTO'ları ile birebir. */

import { SemesterStatusValue } from '@features/admin/semesters/data-access/semester.models';
import {
  EnrollmentKindValue,
  StudentLevelValue,
} from '@features/admin/students/data-access/student.models';

/** `AISIS.Common.Enums.CourseInstructorRole`. */
export const CourseInstructorRole = {
  Coordinator: 1,
  Instructor: 2,
  Assistant: 3,
} as const;

export type CourseInstructorRoleValue =
  (typeof CourseInstructorRole)[keyof typeof CourseInstructorRole];

export const COURSE_INSTRUCTOR_ROLE_LABELS: Readonly<Record<number, string>> = {
  [CourseInstructorRole.Coordinator]: 'Sorumlu',
  [CourseInstructorRole.Instructor]: 'Öğretim Elemanı',
  [CourseInstructorRole.Assistant]: 'Yardımcı',
};

/**
 * Sıra sorumluluğu anlatıyor. TEKİLLİK KISITI YOK: bir açılışın birden fazla
 * sorumlu hocası olabilir — ortak yürütülen derslerde sorumluluk paylaşılır.
 */
export const COURSE_INSTRUCTOR_ROLE_OPTIONS: readonly { value: number; label: string }[] = [
  CourseInstructorRole.Coordinator,
  CourseInstructorRole.Instructor,
  CourseInstructorRole.Assistant,
].map((value) => ({ value, label: COURSE_INSTRUCTOR_ROLE_LABELS[value] ?? '—' }));

/** Bir dönemde açılmış ders. */
export interface OfferingListItem {
  readonly id: number;
  readonly courseId: number;
  readonly courseCode: string;
  readonly courseName: string;
  readonly akts: number;

  readonly instructorCount: number;
  readonly studentCount: number;
  readonly activityCount: number;

  /** Dersin müfredatında bulunduğu bölümler; aday öğrencilerin geldiği yer. */
  readonly departmentNames: readonly string[];
}

export interface OfferingInstructor {
  readonly id: number;
  readonly instructorId: number;
  readonly fullName: string;
  readonly academicTitle: string;
  readonly registryNumber: string;
  readonly role: CourseInstructorRoleValue;
}

export interface OfferingStudent {
  readonly id: number;
  readonly studentId: number;
  readonly studentNumber: string;
  readonly fullName: string;

  /** Açık anadal bölümü; ÇAP'lı öğrencide ders başka bölümden olabilir. */
  readonly primaryDepartmentName: string;
}

/**
 * Açılışın bir değerlendirme etkinliği — bu dönemin vizesi, finali, ödevi.
 *
 * Etkinlik **derse değil açılışa** bağlı: aynı ders her dönem yeniden açılır ve
 * her açılışın vizesi ayrı bir kayıttır. Türü ortak sözlükten
 * (`/tanim/etkinlik`) gelir; puan ve sorular buraya aittir.
 */
export interface OfferingActivity {
  readonly id: number;

  readonly activityDefinitionId: number;
  readonly activityDefinitionCode: string;
  readonly activityDefinitionName: string;

  /** Açılış içinde benzersiz; not dosyasındaki sütun başlığı budur. */
  readonly name: string;

  readonly maxPoint: number;

  readonly itemCount: number;

  /** Girilmiş puan sayısı; sıfırdan büyükse etkinlik silinemez. */
  readonly scoreCount: number;

  /** Etkinliğin soruları, sıraya göre. */
  readonly items: readonly OfferingActivityItem[];
}

/**
 * Etkinliğin bir sorusu.
 *
 * `maxPoint` ÇIKTI HESABININ PAYDASIDIR: bir ders çıktısının başarısı, ona bağlı
 * soruların alınan puanları / tam puanları oranından çıkar. Sorular bugün yalnızca
 * not Excel'inden doğuyor ve dosyada tam puan alanı yok — yani **sıfırla** doğuyorlar.
 * Sıfır kalan bir soru kümesi hesabı tümden engeller; bu ekran o eksiği kapatır.
 */
export interface OfferingActivityItem {
  readonly id: number;
  readonly name: string;
  readonly maxPoint: number;
  readonly sequenceNo: number;

  /** Girilmiş puan sayısı; sıfırdan büyükse soru silinemez. */
  readonly scoreCount: number;
}

export interface OfferingActivityItemCreateCommand {
  readonly name: string;
  readonly maxPoint: number;

  /** Verilmezse sunucu sona ekler. */
  readonly sequenceNo: number | null;
}

export interface OfferingActivityItemUpdateCommand {
  readonly name: string;
  readonly maxPoint: number;
  readonly sequenceNo: number;
}

export interface OfferingActivityCreateCommand {
  readonly activityDefinitionId: number;

  /** Boş bırakılırsa tanımın adı kullanılır. */
  readonly name: string | null;

  readonly maxPoint: number;
}

/** Tanım YOKTUR: türü değişen etkinlik silinip yeniden eklenir. */
export interface OfferingActivityUpdateCommand {
  readonly name: string;
  readonly maxPoint: number;
}

export interface OfferingDetail {
  readonly id: number;

  readonly semesterId: number;
  readonly semesterName: string;
  readonly semesterStatus: SemesterStatusValue;

  readonly courseId: number;
  readonly courseCode: string;
  readonly courseName: string;
  readonly akts: number;

  readonly departmentNames: readonly string[];

  readonly instructors: readonly OfferingInstructor[];
  readonly students: readonly OfferingStudent[];
  readonly activities: readonly OfferingActivity[];
}

/** Bu dönemde henüz açılmamış ders — açılış seçim listesi. */
export interface AvailableCourse {
  readonly id: number;
  readonly courseCode: string;
  readonly name: string;
  readonly akts: number;
  readonly departmentNames: readonly string[];
  readonly qualifiedInstructorCount: number;
}

/**
 * Aday hoca. Liste TÜM açık öğretim elemanlarını içerir; iki bayrak sıralamayı
 * belirler — yeterlilik havuzu seçimi daraltmaz, öne alır.
 */
export interface InstructorCandidate {
  readonly instructorId: number;
  readonly fullName: string;
  readonly academicTitle: string;
  readonly registryNumber: string;
  readonly departmentNames: readonly string[];
  readonly isQualified: boolean;
  readonly isInCourseDepartment: boolean;
}

/**
 * Aday öğrenci.
 *
 * `matchedEnrollmentKind` adaylığı DOĞURAN bağı söyler: ÇAP'lı bir öğrenci bu
 * derse anadalından değil ÇAP'ından giriyor olabilir ve ekranda öyle görünür.
 */
export interface StudentCandidate {
  readonly studentId: number;
  readonly studentNumber: string;
  readonly fullName: string;
  readonly matchedDepartmentName: string;
  readonly matchedEnrollmentKind: EnrollmentKindValue;
  readonly level: StudentLevelValue;
  readonly enrollmentYear: number;
}

/** Toplu işlem sonucu: kaç eklendi, kaç atlandı, neden. */
export interface BulkAssignResult {
  readonly addedCount: number;
  readonly skippedCount: number;
  readonly skipped: readonly string[];
}
