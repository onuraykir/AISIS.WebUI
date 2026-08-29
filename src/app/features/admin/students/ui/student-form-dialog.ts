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
  STUDENT_LEVEL_OPTIONS,
  StudentCreateCommand,
  StudentDetail,
  StudentLevelValue,
  StudentUpdateCommand,
} from '../data-access/student.models';

/** Diyalog ya kayıt açar ya künye günceller; iki ayrı gövde döner. */
export type StudentFormResult =
  | { readonly mode: 'create'; readonly command: StudentCreateCommand }
  | { readonly mode: 'edit'; readonly command: StudentUpdateCommand };

/**
 * Öğrencilik kaydı açma / künye düzenleme.
 *
 * İLK BÖLÜM KAYDINDA TÜR SORULMAZ: ilk bağ her zaman ANADALDIR (R2) — ÇAP'ı olup
 * anadalı olmayan öğrenci yoktur. ÇAP ve yandal sonradan, künye panelinden eklenir.
 *
 * Öğrenci numarası ELLE girilir, üretilmez (K-C): öğrenci işleri sisteminde zaten
 * üretiliyor, AISIS kaydediyor.
 */
@Component({
  selector: 'app-student-form-dialog',
  imports: [ReactiveFormsModule, Dialog, InputText, Select],
  templateUrl: './student-form-dialog.html',
  styleUrl: './student-form-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StudentFormDialog {
  private readonly fb = inject(FormBuilder);

  readonly visible = model(false);

  /** Dolu ise düzenleme; null ise yeni kayıt. */
  readonly student = input<StudentDetail | null>(null);

  /** `readonly` DEĞİL: p-select mutable dizi bekliyor. */
  readonly departmentOptions = input<{ value: number; label: string; disabled: boolean }[]>([]);

  readonly saving = input(false);

  readonly save = output<StudentFormResult>();

  readonly isEdit = computed(() => this.student() !== null);
  readonly heading = computed(() => (this.isEdit() ? 'Künyeyi Düzenle' : 'Yeni Öğrenci'));

  readonly genderOptions = [...GENDER_OPTIONS];
  readonly levelOptions = [...STUDENT_LEVEL_OPTIONS];

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
    studentNumber: ['', [Validators.required, Validators.maxLength(20)]],
    admissionDate: [''],
    enrollmentYear: [
      new Date().getFullYear(),
      [Validators.required, Validators.min(1900), Validators.max(2100)],
    ],
    gpa: [0, [Validators.min(0), Validators.max(4)]],
    firstEnrollment: this.fb.nonNullable.group({
      departmentId: [null as number | null, [Validators.required]],
      level: [2, [Validators.required]],
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
        const student = this.student();
        const key = student ? `edit:${student.id}` : 'create';

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
          studentNumber: student?.studentNumber ?? '',
          admissionDate: toDateInput(student?.admissionDate ?? null),
          enrollmentYear: student?.enrollmentYear ?? new Date().getFullYear(),
          gpa: student?.gpa ?? 0,
          firstEnrollment: { departmentId: null, level: 2, startDate: '' },
        });

        if (student) {
          this.form.controls.person.disable();
          this.form.controls.firstEnrollment.disable();
          this.form.controls.gpa.enable();
        } else {
          this.form.controls.person.enable();
          this.form.controls.firstEnrollment.enable();
          // Yeni kayıtta ortalama girilmez: henüz ders alınmadı.
          this.form.controls.gpa.disable();
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
          studentNumber: raw.studentNumber.trim(),
          admissionDate: raw.admissionDate || null,
          enrollmentYear: raw.enrollmentYear,
          gpa: raw.gpa,
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
        studentNumber: raw.studentNumber.trim(),
        admissionDate: raw.admissionDate || null,
        enrollmentYear: raw.enrollmentYear,
        firstEnrollment: {
          departmentId: raw.firstEnrollment.departmentId as number,
          level: raw.firstEnrollment.level as StudentLevelValue,
          startDate: raw.firstEnrollment.startDate,
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
