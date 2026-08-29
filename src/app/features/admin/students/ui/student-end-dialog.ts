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

import { StudentEndCommand } from '../data-access/student.models';

/**
 * ÖĞRENCİLİĞİN TAMAMINI sonlandırır (K-D, kayıt seviyesi).
 *
 * SEBEP SORULMAZ — sebep zaten hangi düğmeye basıldığıdır. Mezuniyet, ayrılma,
 * kayıt silme ve nakil AYRI UÇLAR ve AYRI YETKİLERDİR: kayıt silmek mezun
 * etmekten çok daha ağır bir işlemdir ve farklı alanlar yazar (mezuniyette
 * mezuniyet tarihi de dolar).
 *
 * Bu yüzden gövdede yalnızca tarih var; ne olduğu başlıkta yazıyor.
 */
@Component({
  selector: 'app-student-end-dialog',
  imports: [ReactiveFormsModule, Dialog, InputText],
  templateUrl: './student-end-dialog.html',
  styleUrl: './student-end-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StudentEndDialog {
  private readonly fb = inject(FormBuilder);

  readonly visible = model(false);

  readonly heading = input('Öğrenciliği Sonlandır');

  /** Ne olacağını anlatan tek cümle; ekran kendi bağlamını verir. */
  readonly description = input('');

  readonly confirmLabel = input('Sonlandır');

  /** Kayıt silme gibi ağır işlemlerde kırmızı düğme. */
  readonly danger = input(false);

  readonly saving = input(false);

  readonly save = output<StudentEndCommand>();

  readonly form = this.fb.nonNullable.group({
    endDate: ['', [Validators.required]],
  });

  /** Sıfırlama yalnızca açılışta; bkz. `department-form-dialog`. */
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

        this.form.reset({ endDate: '' });
      });
    });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.save.emit({ endDate: this.form.getRawValue().endDate });
  }

  close(): void {
    this.visible.set(false);
  }
}
