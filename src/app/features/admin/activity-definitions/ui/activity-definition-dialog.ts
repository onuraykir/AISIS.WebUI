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

import { ActivityDefinition } from '../data-access/activity-definition.models';

export type ActivityDefinitionFormResult =
  | { readonly mode: 'create'; readonly command: { code: string; name: string } }
  | { readonly mode: 'edit'; readonly command: { name: string } };

/**
 * Etkinlik tanımı ekleme / düzenleme.
 *
 * Düzenlemede **kod kilitli**: ortamlar arası tutamaç odur; ad değişse bile kod
 * sabit kalmalı (aynı karar `Module.Code`, `Department.Code` ve `Course.CourseCode`
 * için de verildi).
 */
@Component({
  selector: 'app-activity-definition-dialog',
  imports: [ReactiveFormsModule, Dialog, InputText],
  templateUrl: './activity-definition-dialog.html',
  styleUrl: './activity-definition-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityDefinitionDialog {
  private readonly fb = inject(FormBuilder);

  readonly visible = model(false);

  readonly definition = input<ActivityDefinition | null>(null);
  readonly saving = input(false);

  readonly save = output<ActivityDefinitionFormResult>();

  readonly isEdit = computed(() => this.definition() !== null);
  readonly heading = computed(() => (this.isEdit() ? 'Tanımı Düzenle' : 'Yeni Etkinlik Tanımı'));

  readonly form = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.maxLength(30), Validators.pattern(/^[A-Z0-9_]+$/)]],
    name: ['', [Validators.required, Validators.maxLength(100)]],
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
        const definition = this.definition();
        const key = definition ? `edit:${definition.id}` : 'create';

        if (this.formKey === key) {
          return;
        }
        this.formKey = key;

        this.form.reset({
          code: definition?.code ?? '',
          name: definition?.name ?? '',
        });

        if (definition) {
          this.form.controls.code.disable();
        } else {
          this.form.controls.code.enable();
        }
      });
    });
  }

  /** Kod her zaman büyük harf; boşluk alt çizgiye döner. */
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

    this.save.emit(
      this.isEdit()
        ? { mode: 'edit', command: { name: raw.name.trim() } }
        : { mode: 'create', command: { code: raw.code.trim(), name: raw.name.trim() } },
    );
  }

  close(): void {
    this.visible.set(false);
  }
}
