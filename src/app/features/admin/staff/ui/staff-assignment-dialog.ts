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
  ADMINISTRATIVE_DUTY_OPTIONS,
  AdministrativeDutyValue,
  StaffAssignment,
} from '../data-access/staff.models';

export interface StaffAssignmentFormValue {
  readonly departmentId: number;
  readonly duty: AdministrativeDutyValue;
  readonly isPrimary: boolean;
  readonly startDate: string;
}

/**
 * Görev bağı ekleme / düzenleme.
 *
 * Birim yalnızca EKLEMEDE seçilir: mevcut bir bağın birimini değiştirmek, o
 * birimdeki geçmişi silip başka bir birime yazmak olurdu. Birim değişiyorsa
 * eskisi kapatılır, yenisi açılır — kayıt ikisini de gösterir.
 *
 * Bitiş tarihi burada YOK: kapatma ayrı bir iştir ve sebep ister.
 */
@Component({
  selector: 'app-staff-assignment-dialog',
  imports: [ReactiveFormsModule, Dialog, InputText, Select, ToggleSwitch],
  templateUrl: './staff-assignment-dialog.html',
  styleUrl: './staff-assignment-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StaffAssignmentDialog {
  private readonly fb = inject(FormBuilder);

  readonly visible = model(false);

  /** Dolu ise düzenleme; null ise yeni görev. */
  readonly assignment = input<StaffAssignment | null>(null);

  /** `readonly` DEĞİL: p-select mutable dizi bekliyor. */
  readonly departmentOptions = input<{ value: number; label: string; disabled: boolean }[]>([]);

  readonly saving = input(false);

  readonly save = output<StaffAssignmentFormValue>();

  readonly isEdit = computed(() => this.assignment() !== null);
  readonly heading = computed(() => (this.isEdit() ? 'Görevi Düzenle' : 'Görev Ekle'));

  readonly dutyOptions = [...ADMINISTRATIVE_DUTY_OPTIONS];

  readonly form = this.fb.nonNullable.group({
    departmentId: [null as number | null, [Validators.required]],
    duty: [1, [Validators.required]],
    isPrimary: [false],
    startDate: ['', [Validators.required]],
  });

  /** Bkz. `staff-form-dialog`: sıfırlama yalnızca açılışta yapılmalı. */
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
      duty: raw.duty as AdministrativeDutyValue,
      isPrimary: raw.isPrimary,
      startDate: raw.startDate,
    });
  }

  close(): void {
    this.visible.set(false);
  }
}
