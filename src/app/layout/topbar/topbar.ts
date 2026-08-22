import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

import { Avatar } from 'primeng/avatar';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';
import { Popover } from 'primeng/popover';
import { Ripple } from 'primeng/ripple';
import { Tooltip } from 'primeng/tooltip';

import { NavItem } from '@core/models/nav-item.model';
import { LayoutService } from '@core/services/layout.service';
import { NavigationService } from '@core/services/navigation.service';
import { SessionService } from '@core/services/session.service';
import { searchNav } from '@core/utils/nav.util';

/**
 * Birincil (üst) bar: hamburger + logo, sağ uçta arama / tema / bildirim /
 * kullanıcı paneli.
 *
 * Buradaki arama GLOBAL'dir: sayfadan bağımsız çalışır ve sonuçta bir yere
 * GİDER. Sayfa içi filtreleme (tablo arama) buraya değil, ilgili ekranın kendi
 * araç çubuğuna aittir — aksi halde sayfa değiştikçe kutunun anlamı değişir.
 * Şu an yalnızca menüde arıyor; kayıt araması (öğrenci no, sicil, ders kodu)
 * API bağlanınca aynı panele ikinci grup olarak eklenecek.
 */
@Component({
  selector: 'app-topbar',
  imports: [
    DatePipe,
    RouterLink,
    Avatar,
    IconField,
    InputIcon,
    InputText,
    Popover,
    Ripple,
    Tooltip,
  ],
  templateUrl: './topbar.html',
  styleUrl: './topbar.scss',
  host: {
    '(document:keydown)': 'onDocumentKeydown($event)',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Topbar {
  private readonly router = inject(Router);
  private readonly nav = inject(NavigationService);
  private readonly layout = inject(LayoutService);
  private readonly session = inject(SessionService);

  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  readonly user = this.session.user;
  readonly notifications = this.session.notifications;
  readonly unreadCount = this.session.unreadCount;
  readonly darkMode = this.layout.darkMode;
  readonly sidebarCollapsed = this.layout.sidebarCollapsed;

  readonly query = signal('');
  readonly results = computed<NavItem[]>(() => searchNav(this.nav.menu(), this.query()));

  onSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.query.set(input.value);
  }

  clearSearch(): void {
    this.query.set('');
  }

  goToResult(item: NavItem): void {
    this.clearSearch();
    this.searchInput()?.nativeElement.blur();
    if (item.route) {
      void this.router.navigateByUrl(item.route);
    }
  }

  /** Ctrl/Cmd+K aramayı odaklar, Esc temizleyip çıkar. */
  onDocumentKeydown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.searchInput()?.nativeElement.focus();
      return;
    }

    if (event.key === 'Escape' && this.query()) {
      this.clearSearch();
      this.searchInput()?.nativeElement.blur();
    }
  }

  toggleSidebar(): void {
    this.layout.toggleSidebar();
  }

  toggleDarkMode(): void {
    this.layout.toggleDarkMode();
  }

  markAllRead(): void {
    this.session.markAllNotificationsRead();
  }

  /** MOCK: oturumu boşaltıp giriş ekranına döner. Token temizliği sonra eklenecek. */
  signOut(): void {
    this.session.signOut();
    void this.router.navigateByUrl('/giris');
  }
}
