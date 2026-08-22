import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClient } from '@core/api/api-client';
import { MenuModule } from '@core/models/menu.model';

/**
 * `GET /api/Menu` — kullanıcının izinli menü ağacı.
 *
 * userId ve departmentId şimdilik sorgu parametresi; kimlik doğrulama kurulunca
 * ikisi de sunucu tarafında UserContext'ten gelecek ve bu imza sadeleşecek.
 */
@Injectable({ providedIn: 'root' })
export class MenuApi {
  private readonly api = inject(ApiClient);

  getMenu(userId: number, departmentId: number): Observable<MenuModule[]> {
    return this.api.get<MenuModule[]>('Menu', { userId, departmentId });
  }
}
