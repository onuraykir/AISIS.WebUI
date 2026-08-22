import {
  Directive,
  TemplateRef,
  ViewContainerRef,
  effect,
  inject,
  input,
} from '@angular/core';

import { ActionCode } from '@core/models/menu.model';
import { PermissionService } from '@core/services/permission.service';

/**
 * Eylem yetkisi yoksa içeriği HİÇ RENDER ETMEZ (gizlemez, basmaz).
 *
 * ```html
 * <button *appHasAction="'CREATE'">Yeni Kayıt</button>
 * <button *appHasAction="'CREATE'; operation: 'THRESHOLD'">Yeni Eşik</button>
 * <button *appHasAction="'DELETE'; route: '/tanim/ders'">Sil</button>
 * ```
 *
 * İşlem verilmezse "sayfanın herhangi bir işleminde bu eylem var mı" diye bakılır.
 * Route verilmezse bulunulan sayfaya bakar.
 *
 * DİKKAT: Bu bir güvenlik önlemi değildir, arayüz temizliğidir. Aynı eylem
 * sunucu tarafında da denetlenmek zorundadır.
 */
@Directive({
  selector: '[appHasAction]',
})
export class HasAction {
  private readonly template = inject<TemplateRef<unknown>>(TemplateRef);
  private readonly container = inject(ViewContainerRef);
  private readonly permissions = inject(PermissionService);

  /** Gerekli eylem kodu. */
  readonly appHasAction = input.required<ActionCode>();

  /** Hangi işlemin eylemi? Boş bırakılırsa sayfadaki tüm işlemlere bakılır. */
  readonly appHasActionOperation = input<string | undefined>(undefined);

  /** Başka bir sayfanın yetkisine bakmak için; boş bırakılırsa bulunulan sayfa. */
  readonly appHasActionRoute = input<string | undefined>(undefined);

  private rendered = false;

  constructor() {
    effect(() => {
      const allowed = this.permissions.can(
        this.appHasAction(),
        this.appHasActionOperation(),
        this.appHasActionRoute(),
      );

      if (allowed && !this.rendered) {
        this.container.createEmbeddedView(this.template);
        this.rendered = true;
        return;
      }

      if (!allowed && this.rendered) {
        this.container.clear();
        this.rendered = false;
      }
    });
  }
}
