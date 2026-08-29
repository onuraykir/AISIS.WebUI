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

import { CourseDepartment } from '../data-access/course.models';

export interface CourseDepartmentFormValue {
  readonly departmentId: number;
  readonly isRequired: boolean;
  readonly recommendedTerm: number | null;
}

/**
 * Dersi bir bölümün müfredatına ekler ya da oradaki yerini düzenler.
 *
 * ZORUNLULUK VE YARIYIL BÖLÜME AİT, derse değil: aynı ders Bilgisayar'da zorunlu,
 * Endüstri'de seçmeli olabilir. Bu yüzden bu alanlar ders formunda değil burada.
 *
 * Düzenlemede bölüm kilitli — bölüm değişiyorsa bu bağ silinip yenisi kurulur.
 */
@Component({
  selector: 'app-course-department-dialog',
  imports: [ReactiveFormsModule, Dialog, InputText, Select, ToggleSwitch],
  templateUrl: './course-department-dialog.html',
  styleUrl: './course-department-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CourseDepartmentDialog {
  private readonly fb = inject(FormBuilder);

  readonly visible = model(false);

  /** Dolu ise düzenleme; null ise yeni müfredat bağı. */
  readonly link = input<CourseDepartment | null>(null);

  /** `readonly` DEĞİL: p-select mutable dizi bekliyor. */
  readonly departmentOptions = input<{ value: number; label: string; disabled: boolean }[]>([]);

  readonly saving = input(false);

  readonly save = output<CourseDepartmentFormValue>();

  readonly isEdit = computed(() => this.link() !== null);
  readonly heading = computed(() => (this.isEdit() ? 'Müfredat Bağını Düzenle' : 'Müfredata Ekle'));

  readonly form = this.fb.nonNullable.group({
    departmentId: [null as number | null, [Validators.required]],
    isRequired: [true],
    recommendedTerm: [null as number | null, [Validators.min(1), Validators.max(16)]],
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
        const link = this.link();
        const key = link ? `edit:${link.id}` : 'create';

        if (this.formKey === key) {
          return;
        }
        this.formKey = key;

        this.form.reset({
          departmentId: link?.departmentId ?? null,
          isRequired: link?.isRequired ?? true,
          recommendedTerm: link?.recommendedTerm ?? null,
        });

        if (link) {
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
      isRequired: raw.isRequired,
      // Boş bırakılan yarıyıl "belirtilmemiş" demek; 0 yazmıyoruz.
      recommendedTerm: raw.recommendedTerm ? Number(raw.recommendedTerm) : null,
    });
  }

  close(): void {
    this.visible.set(false);
  }
}
