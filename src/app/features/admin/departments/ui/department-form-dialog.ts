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
  DEPARTMENT_LEVEL_OPTIONS,
  DEPARTMENT_TYPE_OPTIONS,
  DepartmentLevelValue,
  DepartmentTreeNode,
  DepartmentTypeValue,
} from '../data-access/department.models';

export interface DepartmentFormValue {
  readonly code: string;
  readonly name: string;
  readonly type: DepartmentTypeValue;
  readonly level: DepartmentLevelValue;
  readonly parentDepartmentId: number | null;
  readonly isActive: boolean;
}

/**
 * Birim ekleme / düzenleme.
 *
 * Düzenlemede **kod kilitli**: bir kez verilir, ortamlar arası aktarım ona dayanır
 * (aynı karar `Module.Code` ve `ActionDefinition.Code` için de verildi).
 *
 * Üst birim yalnızca YENİ kayıtta seçilir; mevcut birimin taşınması ayrı bir
 * işlemdir çünkü döngü denetimi gerektirir.
 */
@Component({
  selector: 'app-department-form-dialog',
  imports: [ReactiveFormsModule, Dialog, InputText, Select, ToggleSwitch],
  templateUrl: './department-form-dialog.html',
  styleUrl: './department-form-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DepartmentFormDialog {
  private readonly fb = inject(FormBuilder);

  readonly visible = model(false);

  /** Dolu ise düzenleme; null ise yeni kayıt. */
  readonly department = input<DepartmentTreeNode | null>(null);

  /**
   * Yeni kayıtta üst birim seçenekleri.
   * `readonly` DEĞİL: p-select `options` girdisi mutable dizi bekliyor.
   */
  readonly parentOptions = input<{ id: number | null; label: string }[]>([]);

  readonly saving = input(false);

  readonly save = output<DepartmentFormValue>();

  readonly isEdit = computed(() => this.department() !== null);
  readonly heading = computed(() => (this.isEdit() ? 'Birimi Düzenle' : 'Yeni Birim'));

  readonly typeOptions = [...DEPARTMENT_TYPE_OPTIONS];
  readonly levelOptions = [...DEPARTMENT_LEVEL_OPTIONS];

  readonly form = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.maxLength(20), Validators.pattern(/^[A-Z0-9_]+$/)]],
    name: ['', [Validators.required, Validators.maxLength(150)]],
    type: [0, [Validators.required]],
    level: [4, [Validators.required]],
    parentDepartmentId: [null as number | null],
    isActive: [true],
  });

  /**
   * Formun en son hangi kayıt için kurulduğu. Sıfırlama YALNIZCA diyalog
   * açıldığında yapılmalı.
   *
   * effect'in tek tetikleyicisi `visible()` gibi görünse de PrimeNG'nin overlay'i
   * ve girdi sinyallerinin tazelenmesi effect'i yeniden çalıştırabiliyor; korumasız
   * hâlde kullanıcı bir açılır listeden seçim yaptığı anda form sıfırlanıyordu.
   */
  private formKey: string | null = null;

  constructor() {
    effect(() => {
      // Tek izlenen sinyal: diyalog açık mı. Kaydın kendisi untracked okunuyor ki
      // girdi tazelenmesi sıfırlamayı tetiklemesin.
      if (!this.visible()) {
        this.formKey = null;
        return;
      }

      untracked(() => {
        const department = this.department();
        const key = department ? `edit:${department.id}` : 'create';

        // Aynı açılış için ikinci kez kurma.
        if (this.formKey === key) {
          return;
        }
        this.formKey = key;

        this.form.reset({
          code: department?.code ?? '',
          name: department?.name ?? '',
          type: department?.type ?? 0,
          level: department?.level ?? 4,
          parentDepartmentId: department?.parentDepartmentId ?? null,
          isActive: department?.isActive ?? true,
        });

        if (department) {
          this.form.controls.code.disable();
          this.form.controls.parentDepartmentId.disable();
        } else {
          this.form.controls.code.enable();
          this.form.controls.parentDepartmentId.enable();
        }
      });
    });
  }

  onCodeInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const upper = input.value.toLocaleUpperCase('en-US').replace(/[^A-Z0-9_]/g, '_');

    if (upper !== input.value) {
      this.form.controls.code.setValue(upper);
    }
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();

    this.save.emit({
      code: raw.code.trim(),
      name: raw.name.trim(),
      type: raw.type as DepartmentTypeValue,
      level: raw.level as DepartmentLevelValue,
      parentDepartmentId: raw.parentDepartmentId,
      isActive: raw.isActive,
    });
  }

  close(): void {
    this.visible.set(false);
  }
}
