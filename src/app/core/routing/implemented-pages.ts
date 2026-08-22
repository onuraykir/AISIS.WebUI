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
