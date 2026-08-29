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
  SEMESTER_STATUS_HINTS,
  SEMESTER_STATUS_OPTIONS,
  SemesterDetail,
  SemesterStatus,
  SemesterStatusValue,
} from '../data-access/semester.models';

/** Diyalog ya dönem açar ya günceller; iki ayrı gövde döner. */
export type SemesterFormResult =
  | {
      readonly mode: 'create';
      readonly command: {
        code: string;
        name: string;
        startDate: string;
        endDate: string;
        status: SemesterStatusValue;
      };
    }
  | {
      readonly mode: 'edit';
      readonly command: {
        name: string;
        startDate: string;
        endDate: string;
        status: SemesterStatusValue;
      };
    };

/**
 * Dönem ekleme / düzenleme.
 *
 * Düzenlemede **kod kilitli**: bir kez verilir, ortamlar arası aktarım ona dayanır
 * (aynı karar `Module.Code` ve `Department.Code` için de verildi).
 *
 * Güncel dönem bu formdan seçilmez — o ayrı bir işlemdir, çünkü aynı anda
 * eskisinin düşürülmesi gerekir.
 */
@Component({
  selector: 'app-semester-form-dialog',
  imports: [ReactiveFormsModule, Dialog, InputText, Select],
  templateUrl: './semester-form-dialog.html',
  styleUrl: './semester-form-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SemesterFormDialog {
  private readonly fb = inject(FormBuilder);

  readonly visible = model(false);

  /** Dolu ise düzenleme; null ise yeni dönem. */
  readonly semester = input<SemesterDetail | null>(null);

  /** Şu an açık olan dönemin adı; "açık" seçilirse uyarı buna bakar. */
  readonly openSemesterName = input<string | null>(null);

  readonly saving = input(false);

  readonly save = output<SemesterFormResult>();

  readonly isEdit = computed(() => this.semester() !== null);
  readonly heading = computed(() => (this.isEdit() ? 'Dönemi Düzenle' : 'Yeni Dönem'));

  readonly statusOptions = [...SEMESTER_STATUS_OPTIONS];

  readonly form = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.maxLength(30), Validators.pattern(/^[A-Z0-9-]+$/)]],
    name: ['', [Validators.required, Validators.maxLength(100)]],
    startDate: ['', [Validators.required]],
    endDate: ['', [Validators.required]],
    status: [1, [Validators.required]],
  });

  private readonly statusValue = toSignal(this.form.controls.status.valueChanges, {
    initialValue: this.form.controls.status.value,
  });

  /** Seçili durumun ne anlama geldiği; seçicinin altında gösterilir. */
  readonly statusHint = computed(() => SEMESTER_STATUS_HINTS[this.statusValue()] ?? '');

  /**
   * "Açık" seçildi ve BAŞKA bir dönem zaten açık: sunucu reddedecek.
   * Kullanıcı kaydete basmadan önce uyarılıyor.
   */
  readonly openConflict = computed(() => {
    if (this.statusValue() !== SemesterStatus.Open) {
      return null;
    }

    const openName = this.openSemesterName();
    const editing = this.semester();

    // Zaten açık olan dönemi düzenliyorsak çakışma yok.
    return openName !== null && openName !== editing?.name ? openName : null;
  });

  private readonly startDate = toSignal(this.form.controls.startDate.valueChanges, {
    initialValue: this.form.controls.startDate.value,
  });

  private readonly endDate = toSignal(this.form.controls.endDate.valueChanges, {
    initialValue: this.form.controls.endDate.value,
  });

  /**
   * Bitiş, başlangıçtan önce mi? Sunucu da tutuyor (CK_Semesters_Period);
   * burada anında görünsün diye. `yyyy-MM-dd` metinleri sözlük sırasında
   * karşılaştırılabilir, ayrıca tarihe çevirmeye gerek yok.
   */
  readonly periodInvalid = computed(() => {
    const start = this.startDate();
    const end = this.endDate();
    return start.length > 0 && end.length > 0 && end < start;
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
        const semester = this.semester();
        const key = semester ? `edit:${semester.id}` : 'create';

        if (this.formKey === key) {
          return;
        }
        this.formKey = key;

        this.form.reset({
          code: semester?.code ?? '',
          name: semester?.name ?? '',
          startDate: semester ? semester.startDate.slice(0, 10) : '',
          endDate: semester ? semester.endDate.slice(0, 10) : '',
          status: semester?.status ?? SemesterStatus.Planned,
        });

        if (semester) {
          this.form.controls.code.disable();
        } else {
          this.form.controls.code.enable();
        }
      });
    });
  }

  /** Kod her zaman büyük harf; kullanıcı küçük yazsa da düzeltilir. */
  onCodeInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const upper = input.value.toLocaleUpperCase('en-US').replace(/[^A-Z0-9-]/g, '-');

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
    const status = raw.status as SemesterStatusValue;

    if (this.isEdit()) {
      this.save.emit({
        mode: 'edit',
        command: {
          name: raw.name.trim(),
          startDate: raw.startDate,
          endDate: raw.endDate,
          status,
        },
      });
      return;
    }

    this.save.emit({
      mode: 'create',
      command: {
        code: raw.code.trim(),
        name: raw.name.trim(),
        startDate: raw.startDate,
        endDate: raw.endDate,
        status,
      },
    });
  }

  close(): void {
    this.visible.set(false);
  }
}
