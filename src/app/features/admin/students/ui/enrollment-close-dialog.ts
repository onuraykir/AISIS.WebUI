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
  ENROLLMENT_END_REASON_OPTIONS,
  EnrollmentCloseCommand,
  EnrollmentEndReasonValue,
} from '../data-access/student.models';

/**
 * Bir BÖLÜM KAYDINI kapatır (K-D, bağ seviyesi).
 *
 * Personel şeridindeki kapatma diyaloğuyla aynı iş gibi görünür ama sebep kümesi
 * farklıdır: orada istifa/emeklilik/atama, burada mezuniyet/kayıt silme. Bu yüzden
 * ortak bileşen değil, ayrı bileşen.
 *
 * ÖĞRENCİLİK BUNDAN ETKİLENMEZ: ÇAP'lı öğrenci anadaldan mezun olmadan ÇAP'tan
 * mezun olabilir.
 */
@Component({
  selector: 'app-enrollment-close-dialog',
  imports: [ReactiveFormsModule, Dialog, InputText, Select],
  templateUrl: './enrollment-close-dialog.html',
  styleUrl: './enrollment-close-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EnrollmentCloseDialog {
  private readonly fb = inject(FormBuilder);

  readonly visible = model(false);

  /** Hangi bölüm kaydının kapandığını anlatan tek cümle. */
  readonly description = input('');

  readonly saving = input(false);

  readonly save = output<EnrollmentCloseCommand>();

  readonly reasonOptions = [...ENROLLMENT_END_REASON_OPTIONS];

  readonly form = this.fb.nonNullable.group({
    endDate: ['', [Validators.required]],
    endReason: [null as number | null, [Validators.required]],
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
      endReason: raw.endReason as EnrollmentEndReasonValue,
    });
  }

  close(): void {
    this.visible.set(false);
  }
}
