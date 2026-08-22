import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Tanımsız adreslerde gösterilir. Shell'in içinde açılır; menü ve barlar korunur. */
@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  template: `
    <div class="app-card not-found">
      <span class="not-found__code">404</span>
      <h2 class="not-found__title">Sayfa bulunamadı</h2>
      <p class="not-found__text">
        Aradığınız adres taşınmış veya hiç var olmamış olabilir.
      </p>
      <a class="not-found__link" routerLink="/ana-sayfa">
        <i class="pi pi-home" aria-hidden="true"></i> Ana sayfaya dön
      </a>
    </div>
  `,
  styles: `
    .not-found {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 64px 24px;
      text-align: center;
    }

    .not-found__code {
      font-size: 44px;
      font-weight: 800;
      line-height: 1;
      color: var(--app-brand);
      text-shadow: 0 1px 0 rgb(0 0 0 / 25%);
    }

    .not-found__title {
      margin: 0;
      font-size: 18px;
      color: var(--p-text-color);
    }

    .not-found__text {
      margin: 0;
      color: var(--p-text-muted-color);
      font-size: 13px;
    }

    .not-found__link {
      margin-top: 8px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--p-primary-color);
      font-size: 13px;
      text-decoration: none;
    }

    .not-found__link:hover {
      text-decoration: underline;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFound {}
