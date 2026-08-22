import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { SessionService } from '@core/services/session.service';

/**
 * Oturum yoksa giriş ekranına gönderir.
 *
 * ŞU AN MOCK: SessionService sabit bir kullanıcı tuttuğu için pratikte hep
 * geçerlidir; yalnızca "Çıkış Yap" sonrası devreye girer. Gerçek kimlik
 * doğrulama bağlanınca token kontrolü buraya eklenecek.
 */
export const authGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  const router = inject(Router);

  return session.isAuthenticated() ? true : router.createUrlTree(['/giris']);
};
