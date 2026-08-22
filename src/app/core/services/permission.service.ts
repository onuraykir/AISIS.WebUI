import { Injectable, computed, inject } from '@angular/core';

import { ActionCode, MenuOperation } from '@core/models/menu.model';
import { NavigationService } from '@core/services/navigation.service';
import { flattenMenuPages } from '@core/utils/menu.mapper';

/**
 * "Bu kullanıcı bu sayfanın bu işleminde bu eylemi yapabilir mi?" sorusunun tek cevabı.
 *
 * Kaynak menü ucudur: sayfa başına gelen `operations` listesi. Ayrı bir yetki
 * çağrısı yoktur — menüyü çeken istek yetkileri de getirmiş olur.
 *
 * DİKKAT: Bu yalnızca ARAYÜZ içindir. Düğmeyi gizlemek güvenlik değildir;
 * isteği elle atan biri sunucu tarafında (OperationAction.Endpoint + HttpMethod)
 * durdurulur. İkisi birlikte çalışmak zorundadır.
 */
@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly nav = inject(NavigationService);

  /** Adres -> sayfanın işlemleri. Menü değişmedikçe yeniden hesaplanmaz. */
  private readonly operationsByRoute = computed(() => {
    const map = new Map<string, readonly MenuOperation[]>();

    for (const page of flattenMenuPages(this.nav.menuTree())) {
      map.set(normalize(page.route), page.operations);
    }

    return map;
  });

  /** Bulunulan sayfadaki işlemler. */
  readonly currentOperations = computed<readonly MenuOperation[]>(
    () => this.operationsByRoute().get(normalize(this.nav.url())) ?? [],
  );

  /**
   * Verilen eylem yapılabilir mi?
   *
   * @param action Eylem kodu, ör. 'CREATE'.
   * @param operation İşlem kodu. Verilmezse "herhangi bir işlemde bu eylem var mı"
   *   diye bakılır — tek işlemli sayfalarda çağrıyı sadeleştirir.
   * @param route Boş bırakılırsa bulunulan sayfaya bakar.
   */
  can(action: ActionCode, operation?: string, route?: string): boolean {
    const operations =
      route === undefined
        ? this.currentOperations()
        : (this.operationsByRoute().get(normalize(route)) ?? []);

    if (operation === undefined) {
      return operations.some((item) => item.actions.includes(action));
    }

    return operations.some((item) => item.code === operation && item.actions.includes(action));
  }

  /** Sayfanın menüde görünür olup olmadığı; route guard'ı bunu kullanır. */
  canOpen(route: string): boolean {
    return this.can('VIEW', undefined, route);
  }
}

/** Sorgu dizesini ve sondaki eğik çizgiyi atar. */
function normalize(route: string): string {
  const withoutQuery = route.split(/[?#]/)[0] ?? route;
  return withoutQuery.length > 1 ? withoutQuery.replace(/\/+$/, '') : withoutQuery;
}
