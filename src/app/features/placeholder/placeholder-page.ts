import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { PermissionService } from '@core/services/permission.service';
import { HasAction } from '@shared/directives/has-action';

/**
 * Menüdeki her sayfa için geçici ekran.
 *
 * Mock aşamasında route'lar menü verisinden otomatik üretiliyor (app.routes.ts) ve
 * hepsi buraya düşüyor; böylece menünün tamamı gezilebilir oluyor.
 *
 * Ayrıca yetki zincirinin ucunu görünür kılar: bulunulan sayfada hangi işlemlerde
 * hangi eylemlerin izinli olduğunu ve düğmelerin buna göre nasıl basılıp
 * basılmadığını gösterir.
 */
@Component({
  selector: 'app-placeholder-page',
  imports: [HasAction],
  templateUrl: './placeholder-page.html',
  styleUrl: './placeholder-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlaceholderPage {
  private readonly permissions = inject(PermissionService);

  readonly operations = this.permissions.currentOperations;
}
