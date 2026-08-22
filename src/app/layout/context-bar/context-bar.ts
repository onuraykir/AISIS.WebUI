import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Tooltip } from 'primeng/tooltip';

import { NavigationService } from '@core/services/navigation.service';

/**
 * İnce bar — sayfanın kimlik şeridi.
 *
 * Hem konumu (breadcrumb) hem sayfa başlığını (zincirin son halkası) taşır.
 * Ayrı bir sayfa başlığı bileşeni bilerek yok: aynı bilgiyi iki kez yazmamak için.
 *
 * Not: Akademik dönem / birim çipleri kaldırıldı — o bilgiyi verecek bir uç
 * nokta yok, sahte değer gösterilmiyor. Uç yazıldığında buraya geri gelecek.
 */
@Component({
  selector: 'app-context-bar',
  imports: [RouterLink, Tooltip],
  templateUrl: './context-bar.html',
  styleUrl: './context-bar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContextBar {
  private readonly nav = inject(NavigationService);

  readonly trail = this.nav.activeTrail;

  /** Zincir zaten ana sayfayla başlıyorsa ayrıca ev ikonu göstermeye gerek yok. */
  readonly showHome = computed(() => this.trail().at(0)?.route !== '/ana-sayfa');

  /** Sayfayı favorilere alma; kalıcı saklama ucu yazılana kadar oturum içinde. */
  private readonly favoriteIds = signal<ReadonlySet<string>>(new Set<string>());

  readonly canFavorite = computed(() => !!this.nav.activeItem()?.route);

  readonly isFavorite = computed(() => {
    const id = this.nav.activeItem()?.id;
    return id !== undefined && this.favoriteIds().has(id);
  });

  toggleFavorite(): void {
    const id = this.nav.activeItem()?.id;
    if (id === undefined) {
      return;
    }

    this.favoriteIds.update((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }
}
