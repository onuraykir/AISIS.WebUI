import { DOCUMENT, Injectable, computed, effect, inject, signal } from '@angular/core';

/** Kullanıcı tercihlerinin saklandığı anahtarlar. */
const STORAGE_SIDEBAR = 'aisis.sidebar.collapsed';
const STORAGE_THEME = 'aisis.theme.dark';

/** Bu genişliğin altında sidebar, içeriği itmek yerine üstüne kayan panel olur. */
const MOBILE_BREAKPOINT = 1024;

/**
 * Kabuğun (topbar + sidebar) görsel durumu.
 *
 * Tek bir yerde tutuluyor ki hem topbar'daki hamburger hem sidebar hem de
 * route değişiminde mobil menüyü kapatan mantık aynı sinyalleri okusun.
 */
@Injectable({ providedIn: 'root' })
export class LayoutService {
  private readonly document = inject(DOCUMENT);

  /** Masaüstünde sidebar daraltıldı mı? (yalnızca ikonlar görünür) */
  readonly sidebarCollapsed = signal(this.readFlag(STORAGE_SIDEBAR, false));

  /** Mobilde kayan menü açık mı? */
  readonly mobileSidebarOpen = signal(false);

  readonly darkMode = signal(this.readFlag(STORAGE_THEME, false));

  /** Pencere genişliği; yalnızca mobil/masaüstü ayrımı için izleniyor. */
  private readonly viewportWidth = signal(this.document.defaultView?.innerWidth ?? 1600);

  readonly isMobile = computed(() => this.viewportWidth() < MOBILE_BREAKPOINT);

  constructor() {
    const view = this.document.defaultView;
    view?.addEventListener('resize', () => this.viewportWidth.set(view.innerWidth));

    // PrimeNG teması .app-dark seçicisine bağlı (bkz. app.config.ts).
    effect(() => {
      this.document.documentElement.classList.toggle('app-dark', this.darkMode());
      this.writeFlag(STORAGE_THEME, this.darkMode());
    });

    effect(() => this.writeFlag(STORAGE_SIDEBAR, this.sidebarCollapsed()));
  }

  /** Hamburger düğmesi: mobilde paneli açar/kapatır, masaüstünde daraltır/genişletir. */
  toggleSidebar(): void {
    if (this.isMobile()) {
      this.mobileSidebarOpen.update((open) => !open);
      return;
    }
    this.sidebarCollapsed.update((collapsed) => !collapsed);
  }

  closeMobileSidebar(): void {
    this.mobileSidebarOpen.set(false);
  }

  toggleDarkMode(): void {
    this.darkMode.update((dark) => !dark);
  }

  private readFlag(key: string, fallback: boolean): boolean {
    try {
      const raw = this.document.defaultView?.localStorage.getItem(key);
      return raw === null || raw === undefined ? fallback : raw === 'true';
    } catch {
      // Gizli sekmede veya storage kapalıyken patlamasın.
      return fallback;
    }
  }

  private writeFlag(key: string, value: boolean): void {
    try {
      this.document.defaultView?.localStorage.setItem(key, String(value));
    } catch {
      /* sessizce geç */
    }
  }
}
