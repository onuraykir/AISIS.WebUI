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

import { CourseDetail } from '../data-access/course.models';

export type CourseFormResult =
  | {
      readonly mode: 'create';
      readonly command: { courseCode: string; name: string; akts: number };
    }
  | { readonly mode: 'edit'; readonly command: { name: string; akts: number } };

/**
 * Ders tanımı ekleme / düzenleme.
 *
 * Düzenlemede **kod kilitli**: Excel eşlemesi ders koduna dayanıyor, sonradan
 * değişmesi geçmiş yüklemeleri eşleşmez hâle getirirdi.
 *
 * Müfredat bağı ve verebilecek hocalar bu formda YOK — ikisi de ayrı yetki ve
 * künye panelinden yönetiliyor.
 */
@Component({
  selector: 'app-course-form-dialog',
  imports: [ReactiveFormsModule, Dialog, InputText],
  templateUrl: './course-form-dialog.html',
  styleUrl: './course-form-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CourseFormDialog {
  private readonly fb = inject(FormBuilder);

  readonly visible = model(false);

  readonly course = input<CourseDetail | null>(null);
  readonly saving = input(false);

  readonly save = output<CourseFormResult>();

  readonly isEdit = computed(() => this.course() !== null);
  readonly heading = computed(() => (this.isEdit() ? 'Dersi Düzenle' : 'Yeni Ders'));

  readonly form = this.fb.nonNullable.group({
    courseCode: [
      '',
      [Validators.required, Validators.maxLength(20), Validators.pattern(/^[A-Z0-9]+$/)],
    ],
    name: ['', [Validators.required, Validators.maxLength(150)]],
    akts: [0, [Validators.required, Validators.min(0), Validators.max(60)]],
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
        const course = this.course();
        const key = course ? `edit:${course.id}` : 'create';

        if (this.formKey === key) {
          return;
        }
        this.formKey = key;

        this.form.reset({
          courseCode: course?.courseCode ?? '',
          name: course?.name ?? '',
          akts: course?.akts ?? 0,
        });

        if (course) {
          this.form.controls.courseCode.disable();
        } else {
          this.form.controls.courseCode.enable();
        }
      });
    });
  }

  /** Ders kodu her zaman büyük harf ve boşluksuz. */
  onCodeInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const upper = input.value.toLocaleUpperCase('en-US').replace(/[^A-Z0-9]/g, '');

    if (upper !== input.value) {
      this.form.controls.courseCode.setValue(upper);
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
        ? { mode: 'edit', command: { name: raw.name.trim(), akts: raw.akts } }
        : {
            mode: 'create',
            command: {
              courseCode: raw.courseCode.trim(),
              name: raw.name.trim(),
              akts: raw.akts,
            },
          },
    );
  }

  close(): void {
    this.visible.set(false);
  }
}
