import { NavItem, NavRow } from '@core/models/nav-item.model';

/** Ağacı tek düzeye indirir. Route üretimi ve arama için kullanılır. */
export function flattenNav(items: readonly NavItem[]): NavItem[] {
  const result: NavItem[] = [];

  const walk = (list: readonly NavItem[]): void => {
    for (const item of list) {
      result.push(item);
      if (item.children) {
        walk(item.children);
      }
    }
  };

  walk(items);
  return result;
}

/**
 * Verilen adrese giden düğüm zincirini döner (kökten yaprağa).
 * Breadcrumb ve "aktif klasörü otomatik aç" davranışı bunu kullanır.
 * Eşleşme yoksa boş dizi döner.
 */
export function findNavTrail(items: readonly NavItem[], url: string): NavItem[] {
  const target = normalizeUrl(url);

  const walk = (list: readonly NavItem[], trail: readonly NavItem[]): NavItem[] | null => {
    for (const item of list) {
      const next = [...trail, item];

      if (item.route && normalizeUrl(item.route) === target) {
        return next;
      }

      if (item.children) {
        const found = walk(item.children, next);
        if (found) {
          return found;
        }
      }
    }
    return null;
  };

  return walk(items, []) ?? [];
}

/**
 * Ağacı, sidebar'ın çizeceği görünür satır listesine dönüştürür.
 * Kapalı klasörlerin altı hiç üretilmez; böylece şablonda özyineleme gerekmez.
 */
export function buildNavRows(items: readonly NavItem[], expandedIds: ReadonlySet<string>): NavRow[] {
  const rows: NavRow[] = [];

  const walk = (list: readonly NavItem[], level: number): void => {
    for (const item of list) {
      const hasChildren = (item.children?.length ?? 0) > 0;
      const expanded = hasChildren && expandedIds.has(item.id);

      rows.push({ item, level, hasChildren, expanded });

      if (expanded && item.children) {
        walk(item.children, level + 1);
      }
    }
  };

  walk(items, 0);
  return rows;
}

/** Menüde etiketi arar; yalnızca gezinilebilir (route'u olan) düğümleri döner. */
export function searchNav(items: readonly NavItem[], term: string): NavItem[] {
  const needle = term.trim().toLocaleLowerCase('tr-TR');
  if (needle.length < 2) {
    return [];
  }

  return flattenNav(items).filter(
    (item) => !!item.route && item.label.toLocaleLowerCase('tr-TR').includes(needle),
  );
}

/** Sorgu dizesini ve sondaki eğik çizgiyi atar: '/a/b/?x=1' -> '/a/b'. */
function normalizeUrl(url: string): string {
  const withoutQuery = url.split(/[?#]/)[0] ?? url;
  return withoutQuery.length > 1 ? withoutQuery.replace(/\/+$/, '') : withoutQuery;
}
