import { MenuModule, MenuPage } from '@core/models/menu.model';
import { NavItem } from '@core/models/nav-item.model';

/**
 * API menü ağacını sidebar'ın kullandığı NavItem ağacına çevirir.
 *
 * Neden ayrı iki model: API sözleşmesi backend'e aittir ve değişirse burada tek
 * bir dönüştürücü güncellenir; sidebar, breadcrumb ve arama hiç etkilenmez.
 */
export function menuToNavItems(modules: readonly MenuModule[]): NavItem[] {
  return [...modules]
    .sort(byDisplayOrder)
    .map((module) => moduleToNavItem(module));
}

/** Ağaçtaki tüm sayfaları düz liste olarak döner (route üretimi ve arama için). */
export function flattenMenuPages(modules: readonly MenuModule[]): MenuPage[] {
  const pages: MenuPage[] = [];

  const walk = (list: readonly MenuModule[]): void => {
    for (const module of list) {
      pages.push(...module.pages);
      walk(module.subModules);
    }
  };

  walk(modules);
  return pages;
}

/** Adresten sayfayı bulur; yetki kontrolleri bunun üzerinden yürür. */
export function findMenuPageByRoute(
  modules: readonly MenuModule[],
  route: string,
): MenuPage | null {
  const target = normalizeRoute(route);
  return flattenMenuPages(modules).find((page) => normalizeRoute(page.route) === target) ?? null;
}

function moduleToNavItem(module: MenuModule): NavItem {
  // Modül ve sayfa Id'leri ayrı dizilerden geldiği için önek veriliyor;
  // aksi halde 1 numaralı modül ile 1 numaralı sayfa aynı anahtara düşerdi.
  const children: NavItem[] = [
    ...[...module.subModules].sort(byDisplayOrder).map((sub) => moduleToNavItem(sub)),
    ...[...module.pages].sort(byDisplayOrder).map((page) => pageToNavItem(page)),
  ];

  return {
    id: `m${module.id}`,
    label: module.name,
    icon: module.icon || undefined,
    children,
  };
}

function pageToNavItem(page: MenuPage): NavItem {
  return {
    id: `p${page.id}`,
    label: page.name,
    icon: page.icon || undefined,
    route: page.route,
  };
}

function byDisplayOrder(a: { displayOrder: number }, b: { displayOrder: number }): number {
  return a.displayOrder - b.displayOrder;
}

/** Sorgu dizesini ve sondaki eğik çizgiyi atar. */
function normalizeRoute(route: string): string {
  const withoutQuery = route.split(/[?#]/)[0] ?? route;
  return withoutQuery.length > 1 ? withoutQuery.replace(/\/+$/, '') : withoutQuery;
}
