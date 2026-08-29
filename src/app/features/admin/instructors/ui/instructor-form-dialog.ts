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
import { ToggleSwitch } from 'primeng/toggleswitch';

import { GENDER_OPTIONS, GenderValue } from '@features/admin/shared/person/person.models';
import {
  ACADEMIC_DUTY_OPTIONS,
  AcademicDutyValue,
  InstructorCreateCommand,
  InstructorDetail,
  InstructorUpdateCommand,
} from '../data-access/instructor.models';

/** Diyalog ya kayıt açar ya künye günceller; iki ayrı gövde döner. */
export type InstructorFormResult =
  | { readonly mode: 'create'; readonly command: InstructorCreateCommand }
  | { readonly mode: 'edit'; readonly command: InstructorUpdateCommand };

/**
 * Öğretim elemanı kaydı açma / künye düzenleme. İdari şeritteki kalıbın aynısı.
 *
 * UNVAN İLE GÖREV AYRI ALANLAR: unvan kişiye aittir ve künyede durur; görev
 * birime aittir ve her birim bağında ayrı seçilir. Aynı kişi bir bölümde öğretim
 * üyesi, başka bölümde bölüm başkanı olabilir.
 */
@Component({
  selector: 'app-instructor-form-dialog',
  imports: [ReactiveFormsModule, Dialog, InputText, Select, ToggleSwitch],
  templateUrl: './instructor-form-dialog.html',
  styleUrl: './instructor-form-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InstructorFormDialog {
  private readonly fb = inject(FormBuilder);

  readonly visible = model(false);

  /** Dolu ise düzenleme; null ise yeni kayıt. */
  readonly instructor = input<InstructorDetail | null>(null);

  /** `readonly` DEĞİL: p-select mutable dizi bekliyor. */
  readonly departmentOptions = input<{ value: number; label: string; disabled: boolean }[]>([]);

  readonly saving = input(false);

  readonly save = output<InstructorFormResult>();

  readonly isEdit = computed(() => this.instructor() !== null);
  readonly heading = computed(() => (this.isEdit() ? 'Künyeyi Düzenle' : 'Yeni Öğretim Elemanı'));

  readonly genderOptions = [...GENDER_OPTIONS];
  readonly dutyOptions = [...ACADEMIC_DUTY_OPTIONS];

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
    academicTitle: ['', [Validators.maxLength(100)]],
    academicDegree: ['', [Validators.maxLength(100)]],
    isFullTime: [true],
    hireDate: [''],
    firstAssignment: this.fb.nonNullable.group({
      departmentId: [null as number | null, [Validators.required]],
      duty: [1, [Validators.required]],
      startDate: ['', [Validators.required]],
    }),
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
        const instructor = this.instructor();
        const key = instructor ? `edit:${instructor.id}` : 'create';

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
          registryNumber: instructor?.registryNumber ?? '',
          academicTitle: instructor?.academicTitle ?? '',
          academicDegree: instructor?.academicDegree ?? '',
          isFullTime: instructor?.isFullTime ?? true,
          hireDate: toDateInput(instructor?.hireDate ?? null),
          firstAssignment: { departmentId: null, duty: 1, startDate: '' },
        });

        if (instructor) {
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
          academicTitle: raw.academicTitle.trim(),
          academicDegree: raw.academicDegree.trim(),
          isFullTime: raw.isFullTime,
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
        academicTitle: raw.academicTitle.trim(),
        academicDegree: raw.academicDegree.trim(),
        isFullTime: raw.isFullTime,
        hireDate: raw.hireDate || null,
        firstAssignment: {
          departmentId: raw.firstAssignment.departmentId as number,
          duty: raw.firstAssignment.duty as AcademicDutyValue,
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
