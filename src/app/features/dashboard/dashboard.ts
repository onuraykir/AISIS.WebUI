import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { NavigationService } from '@core/services/navigation.service';

/**
 * Ana sayfa.
 *
 * İçerik henüz bağlanmadı: pano için bir uç nokta yok ve buraya sahte sayı
 * koymak, gerçek veriyle karıştırılma riski taşır. Şimdilik menüden gelen
 * gerçek durumu gösteriyor.
 */
@Component({
  selector: 'app-dashboard',
  imports: [RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {
  private readonly nav = inject(NavigationService);

  readonly menuStatus = this.nav.status;
  readonly menuError = this.nav.loadError;
  readonly menuLoading = this.nav.loading;

  /** Menü açılışta alınamadıysa sayfayı yenilemeden tekrar dener. */
  retryMenu(): void {
    void this.nav.load();
  }

  readonly moduleCount = computed(() => this.nav.menuTree().length);

  readonly pageCount = computed(() => {
    let total = 0;

    const walk = (modules: readonly { pages: readonly unknown[]; subModules: readonly unknown[] }[]): void => {
      for (const module of modules) {
        total += module.pages.length;
        walk(module.subModules as readonly { pages: readonly unknown[]; subModules: readonly unknown[] }[]);
      }
    };

    walk(this.nav.menuTree());
    return total;
  });
}
