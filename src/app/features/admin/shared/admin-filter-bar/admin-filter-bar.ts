import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';

import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';

/**
 * Liste ekranlarının ortak süzme şeridi.
 *
 * ÜST BARDAKİ ARAMA İLE KARIŞTIRILMAMALI: üst bar "git" demektir — uygulamanın
 * herhangi bir yerine sıçratır. Bu ise "süz" demektir; bulunulan listeyi daraltır
 * ve sayfadan çıkmaz. İkisi ayrı iş yaptığı için ayrı yerlerde duruyor.
 *
 * Metin kutusu burada, geri kalan süzgeçler `[filters]` yuvasına yansıtılır —
 * bileşen hangi süzgeçlerin olduğunu bilmez, tıpkı `app-admin-toolbar`ın hangi
 * düğmelerin olduğunu bilmemesi gibi.
 */
@Component({
  selector: 'app-admin-filter-bar',
  imports: [IconField, InputIcon, InputText],
  template: `
    <div class="filters">
      <p-iconfield class="filters__search">
        <p-inputicon class="pi pi-filter" />
        <input
          pInputText
          type="search"
          [placeholder]="placeholder()"
          [attr.aria-label]="placeholder()"
          [value]="search()"
          (input)="onInput($event)"
        />
      </p-iconfield>

      <div class="filters__extra">
        <ng-content select="[filters]" />
      </div>

      @if (dirty()) {
        <button type="button" class="filters__clear" (click)="clear.emit()">
          <i class="pi pi-times" aria-hidden="true"></i>
          Süzgeçleri temizle
        </button>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .filters {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .filters__search {
      flex: 1 1 220px;
      min-width: 180px;
      max-width: 340px;
    }

    .filters__search input {
      width: 100%;
    }

    .filters__extra {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .filters__clear {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 0;
      border: 0;
      background: none;
      color: var(--p-text-muted-color);
      font-size: 12px;
      cursor: pointer;
    }

    .filters__clear:hover {
      color: var(--p-text-color);
      text-decoration: underline;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminFilterBar {
  /** İki yönlü: sayfa kendi süzgeç durumunu tutar. */
  readonly search = model<string>('');

  readonly placeholder = input('Listede süz…');

  /** Herhangi bir süzgeç uygulanmış mı? "Temizle" bağlantısı buna bakar. */
  readonly dirty = input(false);

  readonly clear = output<void>();

  protected onInput(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }
}
