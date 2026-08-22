import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { LayoutService } from '@core/services/layout.service';
import { ContextBar } from '@layout/context-bar/context-bar';
import { Sidebar } from '@layout/sidebar/sidebar';
import { Topbar } from '@layout/topbar/topbar';

/**
 * Uygulama kabuğu. Yerleşim tek bir CSS grid ile kuruluyor:
 *
 *   ┌──────────────────────────────┐
 *   │ topbar (birincil bar)        │
 *   ├─────────┬────────────────────┤
 *   │ sidebar │ subbar (ince bar)  │
 *   │         ├────────────────────┤
 *   │         │ router-outlet      │
 *   └─────────┴────────────────────┘
 *
 * Sayfa başlığı ayrı bir şerit değil: ince bar hem konumu hem başlığı taşıyor,
 * böylece aynı bilgi iki kez yazılmıyor.
 *
 * Yalnızca içerik sütunu kayar; barlar ve menü sabit kalır.
 */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, Topbar, ContextBar, Sidebar],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  private readonly layout = inject(LayoutService);

  readonly collapsed = this.layout.sidebarCollapsed;
  readonly isMobile = this.layout.isMobile;
  readonly mobileSidebarOpen = this.layout.mobileSidebarOpen;

  closeMobileSidebar(): void {
    this.layout.closeMobileSidebar();
  }
}
