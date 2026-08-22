import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { Ripple } from 'primeng/ripple';
import { Tooltip } from 'primeng/tooltip';

import { NavItem, NavRow } from '@core/models/nav-item.model';
import { LayoutService } from '@core/services/layout.service';
import { NavigationService } from '@core/services/navigation.service';
import { buildNavRows } from '@core/utils/nav.util';

/** Klasör düğümü kendi ikonunu vermediyse bu ikon çifti kullanılır. */
const FOLDER_ICON_OPEN = 'pi pi-folder-open';
const FOLDER_ICON_CLOSED = 'pi pi-folder';

/**
 * Sol menü.
 *
 * Ağaç şablonda özyinelemeyle değil, düzleştirilmiş satır listesiyle çiziliyor
 * (bkz. buildNavRows): tip güvenliği tam, açık/kapalı durumu tek bir Set'te.
 */
@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, Ripple, Tooltip],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Sidebar {
  private readonly nav = inject(NavigationService);
  private readonly layout = inject(LayoutService);

  readonly collapsed = this.layout.sidebarCollapsed;
  readonly isMobile = this.layout.isMobile;

  /** Telif satırındaki yıl. Bir kez hesaplanır; yıl dönümünde sayfa zaten yenilenir. */
  readonly currentYear = new Date().getFullYear();

  /**
   * Menü ucunun durumu. Deneme aşamasında görünür tutuluyor;
   * kimlik doğrulama ve menü ucu kalıcı bağlandığında bu gösterge kalkacak.
   */
  readonly menuStatus = this.nav.status;
  readonly menuLoadError = this.nav.loadError;

  /** Kullanıcının elle açtığı klasörler + aktif sayfanın klasörleri. */
  private readonly expandedIds = signal<ReadonlySet<string>>(new Set<string>());

  readonly rows = computed<NavRow[]>(() => {
    const menu = this.nav.menu();

    // Daraltılmış modda alt seviyeler çizilmez; yalnızca kök ikonları görünür.
    if (this.collapsed() && !this.isMobile()) {
      return buildNavRows(menu, new Set<string>());
    }

    return buildNavRows(menu, this.expandedIds());
  });

  constructor() {
    // Adres değiştiğinde o sayfaya giden klasörler kendiliğinden açılır.
    // Kullanıcının elle açtıkları kapanmaz; birleştiriyoruz.
    effect(() => {
      const activeIds = this.nav.activeTrailIds();
      if (activeIds.size === 0) {
        return;
      }
      this.expandedIds.update((current) => new Set([...current, ...activeIds]));
    });
  }

  /** Klasör, aktif sayfaya giden yol üzerinde mi? (kapalıyken de vurgulanır) */
  isOnActiveTrail(id: string): boolean {
    return this.nav.activeTrailIds().has(id);
  }

  folderIcon(row: NavRow): string {
    return row.item.icon ?? (row.expanded ? FOLDER_ICON_OPEN : FOLDER_ICON_CLOSED);
  }

  leafIcon(item: NavItem): string {
    return item.icon ?? 'pi pi-circle-fill';
  }

  /** Girinti: her seviye için sabit adım. Daraltılmış modda hep 0'dır (tek seviye). */
  indent(level: number): number {
    return level * 14;
  }

  onFolderClick(item: NavItem): void {
    // Daraltılmışken klasöre basmak menüyü geri açar ve o klasörü genişletir.
    if (this.collapsed() && !this.isMobile()) {
      this.layout.sidebarCollapsed.set(false);
      this.expandedIds.update((current) => new Set([...current, item.id]));
      return;
    }

    this.expandedIds.update((current) => {
      const next = new Set(current);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.add(item.id);
      }
      return next;
    });
  }

  /** Mobilde bir sayfaya gidildiğinde kayan menü kapanmalı. */
  onLeafClick(): void {
    if (this.isMobile()) {
      this.layout.closeMobileSidebar();
    }
  }
}
