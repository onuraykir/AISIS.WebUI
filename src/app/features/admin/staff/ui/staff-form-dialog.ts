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
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';

import { GENDER_OPTIONS, GenderValue } from '@features/admin/shared/person/person.models';
import {
  ADMINISTRATIVE_DUTY_OPTIONS,
  AdministrativeDutyValue,
  StaffCreateCommand,
  StaffDetail,
  StaffUpdateCommand,
} from '../data-access/staff.models';

/** Diyalog ya kayıt açar ya künye günceller; iki ayrı gövde döner. */
export type StaffFormResult =
  | { readonly mode: 'create'; readonly command: StaffCreateCommand }
  | { readonly mode: 'edit'; readonly command: StaffUpdateCommand };

/**
 * Çalışan kaydı açma / künye düzenleme.
 *
 * KAYIT AÇARKEN üç blok birden doldurulur: kimlik, sicil, ilk görev. Sunucu bunu
 * tek işlemde yazar (R1) çünkü birimsiz bir görev dönemi anlamsızdır (R2).
 *
 * DÜZENLERKEN kimlik alanları YOKTUR. Kişi kartı bu ekranın malı değil: aynı kişi
 * aynı anda öğrenci ve öğretim elemanı da olabilir, adını üç ekrandan üç ayrı
 * yerde düzenlemek kaydı bozardı. Düzeltme Kişiler ekranından yapılır (K-B).
 */
@Component({
  selector: 'app-staff-form-dialog',
  imports: [ReactiveFormsModule, Dialog, InputText, Select],
  templateUrl: './staff-form-dialog.html',
  styleUrl: './staff-form-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StaffFormDialog {
  private readonly fb = inject(FormBuilder);

  readonly visible = model(false);

  /** Dolu ise düzenleme; null ise yeni kayıt. */
  readonly staff = input<StaffDetail | null>(null);

  /** İdari birimler. `readonly` DEĞİL: p-select mutable dizi bekliyor. */
  readonly departmentOptions = input<{ value: number; label: string; disabled: boolean }[]>([]);

  readonly saving = input(false);

  readonly save = output<StaffFormResult>();

  readonly isEdit = computed(() => this.staff() !== null);
  readonly heading = computed(() => (this.isEdit() ? 'Künyeyi Düzenle' : 'Yeni Çalışan'));

  readonly genderOptions = [...GENDER_OPTIONS];
  readonly dutyOptions = [...ADMINISTRATIVE_DUTY_OPTIONS];

  readonly form = this.fb.nonNullable.group({
    person: this.fb.nonNullable.group({
      nationalId: ['', [Validators.required, Validators.pattern(/^\d{11}$/)]],
      name: ['', [Validators.required, Validators.maxLength(100)]],
      surname: ['', [Validators.required, Validators.maxLength(100)]],
      birthDate: [''],
      gender: [0],
      email: ['', [Validators.maxLength(150), Validators.email]],
      phone: ['', [Validators.maxLength(20)]],
    }),
    registryNumber: ['', [Validators.required, Validators.maxLength(20)]],
    jobTitle: ['', [Validators.maxLength(100)]],
    hireDate: [''],
    firstAssignment: this.fb.nonNullable.group({
      departmentId: [null as number | null, [Validators.required]],
      duty: [1, [Validators.required]],
      startDate: ['', [Validators.required]],
    }),
  });

  /**
   * Formun en son hangi kayıt için kurulduğu. Sıfırlama YALNIZCA diyalog
   * açıldığında yapılmalı; korumasız hâlde bir açılır listeden seçim yapmak
   * effect'i yeniden çalıştırıp girilen her şeyi siliyordu.
   */
  private formKey: string | null = null;

  constructor() {
    effect(() => {
      if (!this.visible()) {
        this.formKey = null;
        return;
      }

      untracked(() => {
        const staff = this.staff();
        const key = staff ? `edit:${staff.id}` : 'create';

        if (this.formKey === key) {
          return;
        }
        this.formKey = key;

        this.form.reset({
          person: {
            nationalId: '',
            name: '',
            surname: '',
            birthDate: '',
            gender: 0,
            email: '',
            phone: '',
          },
          registryNumber: staff?.registryNumber ?? '',
          jobTitle: staff?.jobTitle ?? '',
          hireDate: toDateInput(staff?.hireDate ?? null),
          firstAssignment: { departmentId: null, duty: 1, startDate: '' },
        });

        // Düzenlemede kimlik ve ilk görev blokları hiç gönderilmez; devre dışı
        // bırakılmazsa "zorunlu alan" doğrulaması formu boşuna geçersiz yapardı.
        if (staff) {
          this.form.controls.person.disable();
          this.form.controls.firstAssignment.disable();
        } else {
          this.form.controls.person.enable();
          this.form.controls.firstAssignment.enable();
        }
      });
    });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();

    if (this.isEdit()) {
      this.save.emit({
        mode: 'edit',
        command: {
          registryNumber: raw.registryNumber.trim(),
          jobTitle: raw.jobTitle.trim(),
          hireDate: raw.hireDate || null,
        },
      });
      return;
    }

    this.save.emit({
      mode: 'create',
      command: {
        person: {
          nationalId: raw.person.nationalId.trim(),
          name: raw.person.name.trim(),
          surname: raw.person.surname.trim(),
          birthDate: raw.person.birthDate || null,
          gender: raw.person.gender as GenderValue,
          email: raw.person.email.trim(),
          phone: raw.person.phone.trim(),
        },
        registryNumber: raw.registryNumber.trim(),
        jobTitle: raw.jobTitle.trim(),
        hireDate: raw.hireDate || null,
        firstAssignment: {
          // Doğrulama geçtiyse birim seçilmiştir.
          departmentId: raw.firstAssignment.departmentId as number,
          duty: raw.firstAssignment.duty as AdministrativeDutyValue,
          // İlk bağ HER ZAMAN ana birimdir (R2); kullanıcıya sorulmaz.
          isPrimary: true,
          startDate: raw.firstAssignment.startDate,
        },
      },
    });
  }

  close(): void {
    this.visible.set(false);
  }
}

/** ISO tarih-saati `<input type="date">`in beklediği `yyyy-MM-dd` biçimine indirir. */
function toDateInput(value: string | null): string {
  return value ? value.slice(0, 10) : '';
}
