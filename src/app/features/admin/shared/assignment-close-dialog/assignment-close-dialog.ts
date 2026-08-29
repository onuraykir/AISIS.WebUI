import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  model,
  output,
  untracked,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';

import {
  ASSIGNMENT_END_REASON_OPTIONS,
  AssignmentCloseCommand,
  AssignmentEndReasonValue,
} from '../person/membership.models';

/**
 * Kapatma diyaloğu. İKİ İŞ için de kullanılır:
 * tek bir görev bağını kapatmak, ya da görev döneminin tamamını sonlandırmak.
 *
 * Gövde ikisinde de aynı — tarih + sebep — ama anlamları çok farklı olduğu için
 * başlık ve açıklama dışarıdan veriliyor. Kullanıcı hangisini yaptığını okumadan
 * onaylamamalı.
 *
 * SEBEP ZORUNLU: veritabanı da "kapanmış bağın sebebi olmalı" diye tutuyor.
 */
@Component({
  selector: 'app-assignment-close-dialog',
  imports: [ReactiveFormsModule, Dialog, InputText, Select],
  templateUrl: './assignment-close-dialog.html',
  styleUrl: './assignment-close-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssignmentCloseDialog {
  private readonly fb = inject(FormBuilder);

  readonly visible = model(false);

  readonly heading = input('Görevi Kapat');

  /** Neyin kapatıldığını anlatan tek cümle; ekran kendi bağlamını verir. */
  readonly description = input('');

  /** Onay düğmesinin metni. Sonlandırma ile kapatma aynı sözcükle anılmamalı. */
  readonly confirmLabel = input('Kapat');

  /** Uyarı tonu: görev döneminin tamamı kapanıyorsa kırmızı düğme. */
  readonly danger = input(false);

  readonly saving = input(false);

  readonly save = output<AssignmentCloseCommand>();

  readonly reasonOptions = [...ASSIGNMENT_END_REASON_OPTIONS];

  readonly form = this.fb.nonNullable.group({
    endDate: ['', [Validators.required]],
    endReason: [null as number | null, [Validators.required]],
  });

  /** Bkz. `staff-form-dialog`: sıfırlama yalnızca açılışta yapılmalı. */
  private opened = false;

  constructor() {
    effect(() => {
      if (!this.visible()) {
        this.opened = false;
        return;
      }

      untracked(() => {
        if (this.opened) {
          return;
        }
        this.opened = true;

        this.form.reset({ endDate: '', endReason: null });
      });
    });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();

    this.save.emit({
      endDate: raw.endDate,
      endReason: raw.endReason as AssignmentEndReasonValue,
    });
  }

  close(): void {
    this.visible.set(false);
  }
}
