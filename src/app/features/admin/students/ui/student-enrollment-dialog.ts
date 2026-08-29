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
import { Select } from 'primeng/select';

import {
  ENROLLMENT_KIND_OPTIONS,
  EnrollmentKind,
  EnrollmentKindValue,
  STUDENT_LEVEL_OPTIONS,
  StudentEnrollment,
  StudentLevelValue,
} from '../data-access/student.models';

export interface StudentEnrollmentFormValue {
  readonly departmentId: number;
  readonly level: StudentLevelValue;
  readonly enrollmentKind: EnrollmentKindValue;
  readonly startDate: string;
}

/**
 * Bölüm kaydı ekleme / düzenleme (ÇAP, yandal, yatay geçiş sonrası yeni anadal).
 *
 * ANADAL AYRI BİR KUTU DEĞİL: kayıt türünden okunuyor. İki alan olsaydı
 * çelişebilirlerdi — "anadalı ÇAP olan öğrenci" gibi bir satır oluşurdu.
 *
 * PERSONELDEN AYRILDIĞI YER: orada yeni bağ "ana birim" işaretlenince eskisi
 * sessizce düşer. Burada düşmez — açık anadal varken ikinci anadal açmak yatay
 * geçiştir ve eskisinin KAPATILMASINI gerektirir; sunucu reddeder. Kullanıcı
 * kaydete basmadan önce uyarılıyor.
 */
@Component({
  selector: 'app-student-enrollment-dialog',
  imports: [ReactiveFormsModule, Dialog, InputText, Select],
  templateUrl: './student-enrollment-dialog.html',
  styleUrl: './student-enrollment-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StudentEnrollmentDialog {
  private readonly fb = inject(FormBuilder);

  readonly visible = model(false);

  /** Dolu ise düzenleme; null ise yeni bölüm kaydı. */
  readonly enrollment = input<StudentEnrollment | null>(null);

  /** `readonly` DEĞİL: p-select mutable dizi bekliyor. */
  readonly departmentOptions = input<{ value: number; label: string; disabled: boolean }[]>([]);

  /** Öğrencinin BAŞKA bir açık anadalı var mı? Uyarı buna bakıyor. */
  readonly hasOtherOpenPrimary = input(false);

  readonly saving = input(false);

  readonly save = output<StudentEnrollmentFormValue>();

  readonly isEdit = computed(() => this.enrollment() !== null);
  readonly heading = computed(() => (this.isEdit() ? 'Bölüm Kaydını Düzenle' : 'Bölüm Kaydı Ekle'));

  readonly levelOptions = [...STUDENT_LEVEL_OPTIONS];
  readonly kindOptions = [...ENROLLMENT_KIND_OPTIONS];

  readonly form = this.fb.nonNullable.group({
    departmentId: [null as number | null, [Validators.required]],
    level: [2, [Validators.required]],
    // Varsayılan ÇAP: anadal zaten kayıt açılışında yazıldı.
    enrollmentKind: [2, [Validators.required]],
    startDate: ['', [Validators.required]],
  });

  private readonly kind = toSignal(this.form.controls.enrollmentKind.valueChanges, {
    initialValue: this.form.controls.enrollmentKind.value,
  });

  /** Anadal seçildi ve öğrencinin başka bir açık anadalı var: bu kayıt reddedilir. */
  readonly primaryConflict = computed(
    () => this.kind() === EnrollmentKind.Primary && this.hasOtherOpenPrimary(),
  );

  /** Sıfırlama yalnızca açılışta; bkz. `department-form-dialog`. */
  private formKey: string | null = null;

  constructor() {
    effect(() => {
      if (!this.visible()) {
        this.formKey = null;
        return;
      }

      untracked(() => {
        const enrollment = this.enrollment();
        const key = enrollment ? `edit:${enrollment.id}` : 'create';

        if (this.formKey === key) {
          return;
        }
        this.formKey = key;

        this.form.reset({
          departmentId: enrollment?.departmentId ?? null,
          level: enrollment?.level ?? 2,
          enrollmentKind: enrollment?.enrollmentKind ?? 2,
          startDate: enrollment ? enrollment.startDate.slice(0, 10) : '',
        });

        if (enrollment) {
          this.form.controls.departmentId.disable();
        } else {
          this.form.controls.departmentId.enable();
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

    this.save.emit({
      departmentId: raw.departmentId as number,
      level: raw.level as StudentLevelValue,
      enrollmentKind: raw.enrollmentKind as EnrollmentKindValue,
      startDate: raw.startDate,
    });
  }

  close(): void {
    this.visible.set(false);
  }
}
