import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Yönetim ekranlarının ortak başlık şeridi.
 *
 * Beş yönetim ekranı da aynı iskeleti kullanır: solda ne yaptığını anlatan
 * başlık + açıklama, sağda o ekranın eylemleri. Eylemler `[actions]` yuvasına
 * yansıtılır; bu bileşen hangi düğmelerin olduğunu bilmez.
 */
@Component({
  selector: 'app-admin-toolbar',
  imports: [],
  template: `
    <header class="toolbar">
      <div class="toolbar__text">
        <h2 class="toolbar__title">{{ title() }}</h2>
        @if (description()) {
          <p class="toolbar__description">{{ description() }}</p>
        }
      </div>

      <div class="toolbar__actions">
        <ng-content select="[actions]" />
      </div>
    </header>

    <ng-content select="[stats]" />
  `,
  styles: `
    :host {
      display: block;
    }

    .toolbar {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 16px;
    }

    .toolbar__text {
      min-width: 0;
    }

    .toolbar__title {
      margin: 0;
      font-size: 17px;
      font-weight: 700;
      color: var(--p-text-color);
    }

    .toolbar__description {
      margin: 3px 0 0;
      max-width: 70ch;
      color: var(--p-text-muted-color);
      font-size: 12.5px;
      line-height: 1.55;
    }

    .toolbar__actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminToolbar {
  readonly title = input.required<string>();
  readonly description = input<string>('');
}
