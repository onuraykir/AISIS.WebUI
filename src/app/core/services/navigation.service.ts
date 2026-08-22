import { Injectable, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { firstValueFrom } from 'rxjs';

import { MenuApi } from '@core/api/menu.api';
import { MenuModule } from '@core/models/menu.model';
import { NavItem } from '@core/models/nav-item.model';
import { MENU_TRIAL_CONTEXT } from '@core/session/menu-trial-context';
import { MenuRouteRegistrar } from '@core/routing/menu-route-registrar';
import { menuToNavItems } from '@core/utils/menu.mapper';
import { findNavTrail } from '@core/utils/nav.util';

/** Menünün durumu. Geliştirme sırasında görünür tutuluyor. */
export type MenuStatus = 'idle' | 'loaded' | 'failed';

/**
 * Menü ağacının ve "şu an neredeyiz" bilgisinin tek kaynağı.
 *
 * Sidebar (aktif klasörü açma), ince bar (breadcrumb) ve sayfa başlığı
 * aynı `activeTrail` sinyalini okur; böylece üçü asla birbirinden ayrışmaz.
 *
 * Menü YALNIZCA `GET /api/Menu` ucundan gelir; kodda gömülü bir menü yoktur.
 * Uç yanıt vermezse menü boş kalır ve durum `failed` olarak okunabilir —
 * sessizce sahte bir ağaca düşülmez.
 */
@Injectable({ providedIn: 'root' })
export class NavigationService {
  private readonly router = inject(Router);
  private readonly menuApi = inject(MenuApi);
  private readonly routeRegistrar = inject(MenuRouteRegistrar);

  /** API sözleşmesindeki ham menü ağacı. */
  readonly menuTree = signal<readonly MenuModule[]>([]);

  private readonly _status = signal<MenuStatus>('idle');
  private readonly _loadError = signal<string | null>(null);

  readonly status = this._status.asReadonly();
  readonly loadError = this._loadError.asReadonly();

  /** Sidebar'ın kullandığı görünüm ağacı; ham ağaçtan türetilir. */
  readonly menu = computed<readonly NavItem[]>(() => menuToNavItems(this.menuTree()));

  /**
   * Menüyü `GET /api/Menu` üzerinden doldurur ve route'ları kaydeder.
   *
   * DENEME AŞAMASI: kullanıcı ve birim kimliği henüz oturumdan gelmiyor
   * (bkz. MENU_TRIAL_CONTEXT). Kimlik doğrulama kurulunca parametreler kalkacak.
   *
   * Hata durumunda uygulama ÇALIŞMAYA DEVAM EDER: menü boş kalır, sabit
   * yollar (ana sayfa, profil) erişilebilirliğini korur.
   */
  async load(): Promise<void> {
    try {
      const tree = await firstValueFrom(
        this.menuApi.getMenu(MENU_TRIAL_CONTEXT.userId, MENU_TRIAL_CONTEXT.departmentId),
      );

      this.menuTree.set(tree);
      this.routeRegistrar.apply(tree);

      this._status.set('loaded');
      this._loadError.set(
        tree.length === 0 ? 'API boş menü döndü (yetki veya kapsam tanımlı değil).' : null,
      );
    } catch (error) {
      this.menuTree.set([]);
      this._status.set('failed');
      this._loadError.set(error instanceof Error ? error.message : 'Menü alınamadı.');
    }
  }

  /** Yönlendirme sonrası güncel adres. Zoneless olduğumuz için sinyale çevriliyor. */
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  /** Dışarıya açık güncel adres; yetki kontrolleri bunu kullanır. */
  readonly url = this.currentUrl;

  /**
   * Menüde yeri olmayan sayfalar (ana sayfa, profil, ayarlar…) başlığını route
   * `data.title` alanından verir. Yoksa null.
   */
  private readonly routeTitle = computed<string | null>(() => {
    this.currentUrl(); // adres değişince yeniden hesaplansın

    let route = this.router.routerState.snapshot.root;
    while (route.firstChild) {
      route = route.firstChild;
    }

    const title: unknown = route.data['title'];
    return typeof title === 'string' ? title : null;
  });

  /** Kökten aktif yaprağa kadar düğüm zinciri. */
  readonly activeTrail = computed<NavItem[]>(() => {
    const trail = findNavTrail(this.menu(), this.currentUrl());
    if (trail.length > 0) {
      return trail;
    }

    const title = this.routeTitle();
    return title ? [{ id: 'route-title', label: title }] : [];
  });

  /** Aktif zincirdeki id'ler; klasörleri "açık" ve "aktif" işaretlemek için. */
  readonly activeTrailIds = computed(() => new Set(this.activeTrail().map((item) => item.id)));

  /** Bulunulan sayfanın menü düğümü. */
  readonly activeItem = computed<NavItem | null>(() => this.activeTrail().at(-1) ?? null);

  /** Sayfa başlığı: menü etiketi -> route başlığı -> uygulama adı. */
  readonly pageTitle = computed(() => this.activeItem()?.label ?? 'AISIS');
}
