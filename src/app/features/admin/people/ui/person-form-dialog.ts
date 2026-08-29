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
  GENDER_OPTIONS,
  GenderValue,
  PersonSummary,
} from '@features/admin/shared/person/person.models';
import { PersonUpdateCommand } from '../data-access/people.models';

/**
 * Kişi kartının düzeltilmesi. Bu ekranın TEK yazma işlemi.
 *
 * TCKN DE DEĞİŞTİRİLEBİLİR: girişte yanlış yazılmış bir kimlik numarasının
 * düzeltilecek başka yeri yok. Kontrol basamağı ve tekillik sunucuda denetlenir.
 *
 * Kayıt akışları bu alanları bilerek EZMEZ (K-B); düzeltme burada, bilinçli bir
 * eylem olarak yapılır — bir yazım hatasının doğru kaydı sessizce bozması en
 * pahalı sonuçtur.
 */
@Component({
  selector: 'app-person-form-dialog',
  imports: [ReactiveFormsModule, Dialog, InputText, Select],
  templateUrl: './person-form-dialog.html',
  styleUrl: './person-form-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonFormDialog {
  private readonly fb = inject(FormBuilder);

  readonly visible = model(false);

  readonly person = input<PersonSummary | null>(null);

  readonly saving = input(false);

  readonly save = output<PersonUpdateCommand>();

  readonly genderOptions = [...GENDER_OPTIONS];

  readonly form = this.fb.nonNullable.group({
    nationalId: ['', [Validators.required, Validators.pattern(/^\d{11}$/)]],
    name: ['', [Validators.required, Validators.maxLength(100)]],
    surname: ['', [Validators.required, Validators.maxLength(100)]],
    birthDate: [''],
    gender: [0],
    email: ['', [Validators.maxLength(150), Validators.email]],
    phone: ['', [Validators.maxLength(20)]],
  });

  /** Sıfırlama yalnızca açılışta; bkz. `department-form-dialog`. */
  private formKey: string | null = null;

  constructor() {
    effect(() => {
      if (!this.visible()) {
        this.formKey = null;
        return;
      }

      untracked(() => {
        const person = this.person();
        const key = person ? `edit:${person.id}` : 'none';

        if (this.formKey === key) {
          return;
        }
        this.formKey = key;

        this.form.reset({
          nationalId: person?.nationalId ?? '',
          name: person?.name ?? '',
          surname: person?.surname ?? '',
          birthDate: person?.birthDate ? person.birthDate.slice(0, 10) : '',
          gender: person?.gender ?? 0,
          email: person?.email ?? '',
          phone: person?.phone ?? '',
        });
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
      nationalId: raw.nationalId.trim(),
      name: raw.name.trim(),
      surname: raw.surname.trim(),
      birthDate: raw.birthDate || null,
      gender: raw.gender as GenderValue,
      email: raw.email.trim(),
      phone: raw.phone.trim(),
    });
  }

  close(): void {
    this.visible.set(false);
  }
}
