import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';

import { Dialog } from 'primeng/dialog';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';
import { Skeleton } from 'primeng/skeleton';

/** Satırdaki küçük etiket. Ton, neden orada olduğunu anlatır. */
export interface PickerBadge {
  readonly text: string;
  readonly tone?: 'brand' | 'muted' | 'warn';
  readonly tooltip?: string;
}

/** Seçilebilir bir satır. Ekranlar kendi DTO'sunu bu şekle çevirir. */
export interface PickerItem {
  readonly id: number;
  readonly title: string;
  readonly subtitle?: string;
  readonly badges?: readonly PickerBadge[];

  /** Seçilemez satır; sebebi ipucunda gösterilir. Gizlemek yerine açıklıyoruz. */
  readonly disabled?: boolean;
  readonly disabledReason?: string;
}

/**
 * Çoklu seçim diyaloğu — ders seçimi, aday hoca, aday öğrenci hepsi bunu kullanır.
 *
 * SUNUM BİLEŞENİ: veriyi kendisi çekmez. Arama ve süzgeçler sunucuda çalıştığı için
 * yükleme sorumluluğu sayfada kalır; buradan yalnızca `searchChange` haber verilir.
 * Böylece aynı diyalog hem küçük listelerle hem yüzlerce satırla çalışır.
 *
 * Ek süzgeçler `[filters]` yuvasına yansıtılır; bileşen hangi süzgeçlerin olduğunu
 * bilmez — `app-admin-toolbar` ve `app-admin-filter-bar` ile aynı yaklaşım.
 */
@Component({
  selector: 'app-picker-dialog',
  imports: [Dialog, IconField, InputIcon, InputText, Skeleton],
  templateUrl: './picker-dialog.html',
  styleUrl: './picker-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PickerDialog {
  readonly visible = model(false);

  readonly heading = input('Seçim');
  readonly description = input('');

  readonly items = input<readonly PickerItem[]>([]);

  readonly loading = input(false);
  readonly saving = input(false);

  /** İki yönlü: arama sunucuda çalışıyor, değeri sayfa tutuyor. */
  readonly search = model('');
  readonly searchPlaceholder = input('Ara…');

  readonly confirmLabel = input('Ekle');
  readonly emptyText = input('Uygun kayıt yok.');

  /** Seçilen kimlikler. Boş seçimle onaylanamaz. */
  readonly confirm = output<number[]>();

  private readonly selected = signal<ReadonlySet<number>>(new Set<number>());

  readonly selectedCount = computed(() => this.selected().size);

  readonly selectableCount = computed(() => this.items().filter((i) => !i.disabled).length);

  readonly allSelected = computed(() => {
    const count = this.selectableCount();
    return count > 0 && this.selected().size === count;
  });

  constructor() {
    // Diyalog her açılışta temiz başlar; önceki seçim sızmasın.
    effect(() => {
      if (this.visible()) {
        untracked(() => this.selected.set(new Set<number>()));
      }
    });
  }

  protected isSelected(id: number): boolean {
    return this.selected().has(id);
  }

  protected toggle(item: PickerItem): void {
    if (item.disabled) {
      return;
    }

    this.selected.update((current) => {
      const next = new Set(current);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.add(item.id);
      }
      return next;
    });
  }

  /** Görünen (süzülmüş) satırların hepsini seçer veya bırakır. */
  protected toggleAll(): void {
    const selectable = this.items().filter((i) => !i.disabled);

    this.selected.set(
      this.allSelected() ? new Set<number>() : new Set(selectable.map((i) => i.id)),
    );
  }

  protected onSearchInput(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected badgeClass(badge: PickerBadge): string {
    return `picker__badge picker__badge--${badge.tone ?? 'muted'}`;
  }

  protected onConfirm(): void {
    if (this.selectedCount() === 0) {
      return;
    }

    this.confirm.emit([...this.selected()]);
  }

  protected close(): void {
    this.visible.set(false);
  }
}
