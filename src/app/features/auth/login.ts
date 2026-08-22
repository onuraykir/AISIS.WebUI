import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { SessionService } from '@core/services/session.service';

/**
 * Giriş ekranı — YER TUTUCU.
 *
 * Bilerek shell'in DIŞINDA, kendi tam ekran yerleşimiyle duruyor: burada
 * üst bar, sol menü ve ince bar yok. Asıl tasarım ayrıca yapılacak; şimdilik
 * yalnızca akışın (çıkış -> /giris -> giriş -> /ana-sayfa) çalışması için var.
 */
@Component({
  selector: 'app-login',
  imports: [],
  templateUrl: './login.html',
  styleUrl: './login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);

  signIn(): void {
    this.session.signIn();
    void this.router.navigateByUrl('/ana-sayfa');
  }
}
