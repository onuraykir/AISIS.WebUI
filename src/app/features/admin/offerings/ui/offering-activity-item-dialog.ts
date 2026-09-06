import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';

import { OfferingActivityItem } from '../data-access/offering.models';

export type OfferingActivityItemFormResult =
  | {
      readonly mode: 'create';
      readonly command: { name: string; maxPoint: number; sequenceNo: number | null };
    }
  | {
      readonly mode: 'edit';
      readonly command: { name: string; maxPoint: number; sequenceNo: number };
    };

/**
 * Etkinliğe soru ekleme / düzenleme.
 *
 * TAM PUAN BU EKRANIN ASIL SEBEBİ. Çıktı hesabının paydası, bir ders çıktısına
 * bağlı soruların tam puanları toplamıdır. Sorular bugün yalnızca not Excel'inden
 * doğuyor ve dosyada tam puan alanı yok — yani **sıfırla** doğuyorlar. Sıfır kalan
 * bir soru kümesi hesabı tümden engeller, çünkü paydaya bölünemez.
 *
 * Bu yüzden buradaki kural sunucudakiyle aynı ve etkinlik puanından daha katıdır:
 * **sıfır kabul edilmez**.
 */
@Component({
  selector: 'app-offering-activity-item-dialog',
  imports: [ReactiveFormsModule, Dialog, InputText],
  templateUrl: './offering-activity-item-dialog.html',
  styleUrl: './offering-activity-item-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfferingActivityItemDialog {
  private readonly fb = inject(FormBuilder);

  readonly visible = model(false);

  readonly item = input<OfferingActivityItem | null>(null);
  readonly activityName = input('');
  readonly saving = input(false);

  /** Bu etkinlikte zaten kullanılan soru adları; sunucuya gitmeden uyarmak için. */
  readonly usedNames = input<readonly string[]>([]);

  readonly save = output<OfferingActivityItemFormResult>();

  readonly isEdit = computed(() => this.item() !== null);
  readonly heading = computed(() => (this.isEdit() ? 'Soruyu Düzenle' : 'Soru Ekle'));

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    // min(0.01): sıfır tam puan hesabı engeller — sunucudaki kuralın aynısı.
    maxPoint: [10, [Validators.required, Validators.min(0.01), Validators.max(1000)]],
    sequenceNo: [1, [Validators.required, Validators.min(0)]],
  });

  private readonly nameValue = toSignal(this.form.controls.name.valueChanges, {
    initialValue: this.form.controls.name.value,
  });

  /** Bu ad etkinlikte zaten var mı? Sunucu da tutuyor; burada kaydete basılmadan söyleniyor. */
  readonly nameTaken = computed(() => {
    const name = fold(this.nameValue());
    const current = this.item();

    return (
      name.length > 0 &&
      this.usedNames().some(
        (used) => fold(used) === name && fold(current?.name ?? '') !== name,
      )
    );
  });

  /** Sıfırlama yalnızca açılışta; bkz. `offering-activity-dialog`. */
  private formKey: string | null = null;

  constructor() {
    effect(() => {
      if (!this.visible()) {
        this.formKey = null;
        return;
      }

      untracked(() => {
        const item = this.item();
        const key = item ? `edit:${item.id}` : 'create';

        if (this.formKey === key) {
          return;
        }
        this.formKey = key;

        this.form.reset({
          name: item?.name ?? '',
          maxPoint: item?.maxPoint ?? 10,
          sequenceNo: item?.sequenceNo ?? this.usedNames().length + 1,
        });
      });
    });
  }

  onSubmit(): void {
    if (this.form.invalid || this.nameTaken()) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const name = raw.name.trim();

    this.save.emit(
      this.isEdit()
        ? { mode: 'edit', command: { name, maxPoint: raw.maxPoint, sequenceNo: raw.sequenceNo } }
        : {
            mode: 'create',
            command: { name, maxPoint: raw.maxPoint, sequenceNo: raw.sequenceNo },
          },
    );
  }

  close(): void {
    this.visible.set(false);
  }
}

/** Karşılaştırma için ad katlama; sunucudaki kuralla aynı niyet. */
function fold(value: string): string {
  return value.trim().toLocaleLowerCase('tr-TR');
}
