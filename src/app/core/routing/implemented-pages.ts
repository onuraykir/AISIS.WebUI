import { Type } from '@angular/core';

/**
 * YAZILMIŞ ekranlar: adres -> bileşen.
 *
 * Kodda kalan tek bağ budur (bkz. docs/AUTHORIZATION-MODUL-YAPISI.md §5).
 * İçinde başlık, ikon, sıra veya yetki yok — hepsi menü verisinden gelir.
 * Yeni bir ekran yazıldığında buraya tek satır eklenir.
 *
 * Adresler menüdeki `Page.Route` ile birebir aynı olmalıdır; eşleşmeyen adres
 * "hazırlanmadı" ekranına düşer.
 */
export const IMPLEMENTED_PAGES: Record<string, () => Promise<Type<unknown>>> = {
  '/ders-cikti/liste': () =>
    import('@features/outcomes/course-outcomes/course-outcomes-page').then(
      (m) => m.CourseOutcomesPage,
    ),
  '/ders-cikti/hesap': () =>
    import('@features/outcomes/calculation/calculation-page').then((m) => m.CalculationPage),
  '/ders-cikti/eslestirme': () =>
    import('@features/outcomes/matrix/matrix-page').then((m) => m.MatrixPage),
  '/program-cikti/liste': () =>
    import('@features/outcomes/program/program-outcomes-page').then((m) => m.ProgramOutcomesPage),
  '/program-cikti/ders-eslestirme': () =>
    import('@features/outcomes/course-mapping/course-mapping-page').then(
      (m) => m.CourseMappingPage,
    ),
  '/program-cikti/esik-deger': () =>
    import('@features/outcomes/program/thresholds-page').then((m) => m.ThresholdsPage),
  '/degerlendirme/etkinlik': () =>
    import('@features/assessment/activities/activities-page').then((m) => m.ActivitiesPage),
  '/degerlendirme/not-yukle': () =>
    import('@features/assessment/score-import/score-import-page').then((m) => m.ScoreImportPage),
  '/degerlendirme/notlar': () =>
    import('@features/assessment/scores/scores-page').then((m) => m.ScoresPage),
  '/tanim/bolum': () =>
    import('@features/admin/departments/department-tree-page').then((m) => m.DepartmentTreePage),
  '/tanim/ders': () => import('@features/admin/courses/courses-page').then((m) => m.CoursesPage),
  '/tanim/ders-acilisi': () =>
    import('@features/admin/offerings/offerings-page').then((m) => m.OfferingsPage),
  '/tanim/etkinlik': () =>
    import('@features/admin/activity-definitions/activity-definitions-page').then(
      (m) => m.ActivityDefinitionsPage,
    ),
  '/tanim/donem': () =>
    import('@features/admin/semesters/semesters-page').then((m) => m.SemestersPage),
  '/tanim/kisi': () => import('@features/admin/people/people-page').then((m) => m.PeoplePage),
  '/tanim/ogrenci': () =>
    import('@features/admin/students/students-page').then((m) => m.StudentsPage),
  '/tanim/ogretim-elemani': () =>
    import('@features/admin/instructors/instructors-page').then((m) => m.InstructorsPage),
  '/tanim/personel': () => import('@features/admin/staff/staff-page').then((m) => m.StaffPage),
  '/sistem/modul-agaci': () =>
    import('@features/admin/module-tree/module-tree-page').then((m) => m.ModuleTreePage),
  '/sistem/sayfa-katalogu': () =>
    import('@features/admin/page-catalog/page-catalog-page').then((m) => m.PageCatalogPage),
  '/sistem/islem-katalogu': () =>
    import('@features/admin/operation-catalog/operation-catalog-page').then(
      (m) => m.OperationCatalogPage,
    ),
  '/sistem/rol': () => import('@features/admin/roles/roles-page').then((m) => m.RolesPage),
  '/sistem/kullanici-grubu': () =>
    import('@features/admin/user-groups/user-groups-page').then((m) => m.UserGroupsPage),
};

/** Henüz yazılmamış ekranların düştüğü geçici sayfa. */
export const placeholderLoader = () =>
  import('@features/placeholder/placeholder-page').then((m) => m.PlaceholderPage);
