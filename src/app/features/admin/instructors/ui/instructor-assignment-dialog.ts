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

import {
  ACADEMIC_DUTY_OPTIONS,
  AcademicDutyValue,
  InstructorAssignment,
} from '../data-access/instructor.models';

export interface InstructorAssignmentFormValue {
  readonly departmentId: number;
  readonly duty: AcademicDutyValue;
  readonly isPrimary: boolean;
  readonly startDate: string;
}

/**
 * Akademik görev bağı ekleme / düzenleme.
 *
 * İdari şeritten TEK FARKI: aynı birimde birden fazla görev meşrudur. Kişi bir
 * bölümde hem öğretim üyesi olup hem bölüm başkanlığı yapabilir — bunlar iki ayrı
 * bağdır. Engellenen şey aynı görevde eşzamanlı iki açık kayıttır.
 *
 * Birim yalnızca EKLEMEDE seçilir; bitiş tarihi burada yok, kapatma sebep ister.
 */
@Component({
  selector: 'app-instructor-assignment-dialog',
  imports: [ReactiveFormsModule, Dialog, InputText, Select, ToggleSwitch],
  templateUrl: './instructor-assignment-dialog.html',
  styleUrl: './instructor-assignment-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InstructorAssignmentDialog {
  private readonly fb = inject(FormBuilder);

  readonly visible = model(false);

  /** Dolu ise düzenleme; null ise yeni görev. */
  readonly assignment = input<InstructorAssignment | null>(null);

  /** `readonly` DEĞİL: p-select mutable dizi bekliyor. */
  readonly departmentOptions = input<{ value: number; label: string; disabled: boolean }[]>([]);

  readonly saving = input(false);

  readonly save = output<InstructorAssignmentFormValue>();

  readonly isEdit = computed(() => this.assignment() !== null);
  readonly heading = computed(() => (this.isEdit() ? 'Görevi Düzenle' : 'Görev Ekle'));

  readonly dutyOptions = [...ACADEMIC_DUTY_OPTIONS];

  readonly form = this.fb.nonNullable.group({
    departmentId: [null as number | null, [Validators.required]],
    duty: [1, [Validators.required]],
    isPrimary: [false],
    startDate: ['', [Validators.required]],
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
        const assignment = this.assignment();
        const key = assignment ? `edit:${assignment.id}` : 'create';

        if (this.formKey === key) {
          return;
        }
        this.formKey = key;

        this.form.reset({
          departmentId: assignment?.departmentId ?? null,
          duty: assignment?.duty ?? 1,
          isPrimary: assignment?.isPrimary ?? false,
          startDate: assignment ? assignment.startDate.slice(0, 10) : '',
        });

        if (assignment) {
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
      duty: raw.duty as AcademicDutyValue,
      isPrimary: raw.isPrimary,
      startDate: raw.startDate,
    });
  }

  close(): void {
    this.visible.set(false);
  }
}
