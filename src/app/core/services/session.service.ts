import { Injectable, computed, signal } from '@angular/core';

import { AppNotification, CurrentUser } from '@core/models/current-user.model';
import { AUTH_PLACEHOLDER_USER } from '@core/session/auth-placeholder';

/**
 * Oturum açmış personel.
 *
 * Kimlik doğrulama henüz kurulmadı; kullanıcı {@link AUTH_PLACEHOLDER_USER}
 * yer tutucusundan geliyor — menü denemesinin çalışabilmesi için gerekli.
 * Gerçek kimlik doğrulama bağlandığında yalnızca bu servisin içi değişecek,
 * bileşenler `user()` sinyalini okumaya devam edecek.
 *
 * Bildirimler için bir uç nokta YOK: liste bilerek boş, sahte bildirim üretilmiyor.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly currentUser = signal<CurrentUser | null>(AUTH_PLACEHOLDER_USER);

  readonly user = this.currentUser.asReadonly();

  readonly isAuthenticated = computed(() => this.currentUser() !== null);

  /** Bildirim ucu yazılana kadar boş. */
  readonly notifications = signal<readonly AppNotification[]>([]);

  readonly unreadCount = computed(() => this.notifications().filter((n) => !n.read).length);

  markAllNotificationsRead(): void {
    this.notifications.update((list) => list.map((n) => ({ ...n, read: true })));
  }

  /** Yer tutucu kimliği geri koyar; gerçek giriş akışı sonra bağlanacak. */
  signIn(): void {
    this.currentUser.set(AUTH_PLACEHOLDER_USER);
  }

  signOut(): void {
    this.currentUser.set(null);
  }
}
