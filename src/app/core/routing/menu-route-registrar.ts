import { Injectable, inject } from '@angular/core';
import { Route, Router, Routes } from '@angular/router';

import { MenuModule } from '@core/models/menu.model';
import { flattenMenuPages } from '@core/utils/menu.mapper';
import { IMPLEMENTED_PAGES, placeholderLoader } from './implemented-pages';

/** Kabuğun içindeki, menüden bağımsız sabit yollar. Üretilen route'lar bunlara dokunmaz. */
const STATIC_CHILD_PATHS = new Set(['', 'ana-sayfa', 'profil', 'ayarlar', 'sifre-degistir', 'yardim']);

/**
 * Menü verisinden route üretip router'a yazar.
 *
 * Menü artık kodda tutulmadığı için (mock kaldırıldı) uygulamanın hangi
 * adreslerin var olduğunu ancak API yanıtından öğrenmesi mümkün. Bu servis o
 * yanıtı router yapılandırmasına çevirir.
 *
 * Uygulama başlatılırken çağrılır (bkz. menu-bootstrap.ts); böylece ilk
 * yönlendirme yapılmadan önce route'lar yerinde olur ve derin bağlantı
 * (deep link) çalışır.
 */
@Injectable({ providedIn: 'root' })
export class MenuRouteRegistrar {
  private readonly router = inject(Router);

  apply(menu: readonly MenuModule[]): void {
    const pageRoutes = this.buildPageRoutes(menu);
    if (pageRoutes.length === 0) {
      return;
    }

    this.router.resetConfig(
      this.router.config.map((route) =>
        isShellRoute(route) ? { ...route, children: merge(route.children ?? [], pageRoutes) } : route,
      ),
    );
  }

  private buildPageRoutes(menu: readonly MenuModule[]): Routes {
    return flattenMenuPages(menu)
      .map((page) => ({ path: page.route.replace(/^\//, ''), route: page.route }))
      .filter((entry) => entry.path.length > 0 && !STATIC_CHILD_PATHS.has(entry.path))
      .map((entry) => ({
        path: entry.path,
        loadComponent: IMPLEMENTED_PAGES[entry.route] ?? placeholderLoader,
      }));
  }
}

/** Kabuk route'u: yolu boş ve çocukları olan tek kayıt. */
function isShellRoute(route: Route): boolean {
  return route.path === '' && Array.isArray(route.children);
}

/**
 * Üretilen route'lar sabitlerden SONRA, joker (`**`) route'tan ÖNCE gelmeli:
 * sabitler gölgelenmesin, tanımsız adresler de 404'e düşebilsin.
 */
function merge(existing: Routes, generated: Routes): Routes {
  const wildcardIndex = existing.findIndex((route) => route.path === '**');

  if (wildcardIndex < 0) {
    return [...existing, ...generated];
  }

  return [
    ...existing.slice(0, wildcardIndex),
    ...generated,
    ...existing.slice(wildcardIndex),
  ];
}
