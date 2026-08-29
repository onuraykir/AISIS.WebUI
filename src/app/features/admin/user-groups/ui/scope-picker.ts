import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { Tooltip } from 'primeng/tooltip';

import { IdName } from '@core/api/api-result.model';

/**
 * Bir kapsam listesinin (modül / birim / rol) çoklu seçimi.
 *
 * Açılır liste yerine çip ızgarası: seçenek sayısı azdır ve yöneticinin
 * "neyin seçili olduğunu" tek bakışta görmesi, listeyi açıp kapatmasından
 * daha önemlidir.
 *
 * Salt sunum: kaydetmez, yalnızca seçili kümeyi yayar.
 */
@Component({
  selector: 'app-scope-picker',
  imports: [Tooltip],
  template: `
    <section class="scope">
      <header class="scope__head">
        <div class="scope__title-block">
          <h4 class="scope__title">
            <i class="{{ icon() }}" aria-hidden="true"></i>
            {{ title() }}
            <span class="scope__count">{{ selected().length }}/{{ options().length }}</span>
          </h4>
          <p class="scope__hint">{{ hint() }}</p>
        </div>

        <div class="scope__actions">
          @if (dirty()) {
            <span class="scope__dirty">kaydedilmedi</span>
            <button type="button" class="linkbtn" [disabled]="saving()" (click)="revert.emit()">
              Geri al
            </button>
            <button
              type="button"
              class="btn btn--primary btn--sm"
              [disabled]="saving()"
              (click)="save.emit()"
            >
              Kaydet
            </button>
          }
        </div>
      </header>

      @if (options().length === 0) {
        <p class="scope__empty">Seçilebilecek kayıt yok.</p>
      } @else {
        <div class="scope__chips">
          @for (option of options(); track option.id) {
            <button
              type="button"
              class="schip"
              [class.schip--on]="isSelected(option.id)"
              [class.schip--blocked]="blockedIds().includes(option.id) && !isSelected(option.id)"
              [attr.aria-pressed]="isSelected(option.id)"
              [pTooltip]="blockedTooltip(option.id)"
              [tooltipDisabled]="!blockedIds().includes(option.id) || isSelected(option.id)"
              tooltipPosition="top"
              [disabled]="saving()"
              (click)="toggle(option.id)"
            >
              <i class="pi" [class.pi-check]="isSelected(option.id)" aria-hidden="true"></i>
              {{ option.name }}
            </button>
          }
        </div>
      }
    </section>
  `,
  styleUrl: './scope-picker.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScopePicker {
  readonly title = input.required<string>();
  readonly hint = input('');
  readonly icon = input('pi pi-list');
  readonly options = input<readonly IdName[]>([]);
  readonly selected = input<readonly number[]>([]);
  readonly dirty = input(false);
  readonly saving = input(false);

  /**
   * Seçimden çıkarılması engellenen kayıtlar (ör. üyesi olan birim).
   * Çip kırmızıya döner ve gerekçe tooltip'te yazar.
   */
  readonly blockedIds = input<readonly number[]>([]);
  readonly blockedReason = input('');

  readonly selectionChange = output<number[]>();
  readonly save = output<void>();
  readonly revert = output<void>();

  private readonly selectedSet = computed(() => new Set(this.selected()));

  isSelected(id: number): boolean {
    return this.selectedSet().has(id);
  }

  blockedTooltip(id: number): string {
    return this.blockedIds().includes(id) ? this.blockedReason() : '';
  }

  toggle(id: number): void {
    const next = new Set(this.selected());
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }

    this.selectionChange.emit([...next]);
  }
}
