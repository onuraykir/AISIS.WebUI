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

import { ProgramOutcome } from '../data-access/program-outcome.models';

export type ProgramOutcomeFormResult = {
  readonly code: string;
  readonly description: string;
  readonly version: string;
  readonly isActive: boolean;
};

/**
 * Program çıktısı ekleme / düzenleme.
 *
 * SÜRÜM ZORUNLU: akreditasyon döngüsünde çıktı metinleri değişir ve geçmiş dönemin
 * raporu eski sürüme dayanmalıdır. Sürümsüz bir çıktı, hangi döngüye ait olduğu
 * bilinmeyen bir çıktıdır.
 */
@Component({
  selector: 'app-program-outcome-dialog',
  imports: [ReactiveFormsModule, Dialog, InputText],
  templateUrl: './program-outcome-dialog.html',
  styleUrl: './program-outcome-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgramOutcomeDialog {
  private readonly fb = inject(FormBuilder);

  readonly visible = model(false);

  readonly outcome = input<ProgramOutcome | null>(null);
  readonly saving = input(false);

  /** Aynı sürümde kullanılmış kodlar; sunucuya gitmeden uyarmak için. */
  readonly usedCodes = input<readonly string[]>([]);

  readonly save = output<ProgramOutcomeFormResult>();

  readonly isEdit = computed(() => this.outcome() !== null);
  readonly heading = computed(() =>
    this.isEdit() ? 'Program Çıktısını Düzenle' : 'Program Çıktısı Ekle',
  );

  readonly form = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.maxLength(20)]],
    description: ['', [Validators.required, Validators.maxLength(500)]],
    version: ['', [Validators.required, Validators.maxLength(20)]],
    isActive: [true],
  });

  private formKey: string | null = null;

  constructor() {
    effect(() => {
      if (!this.visible()) {
        this.formKey = null;
        return;
      }

      untracked(() => {
        const outcome = this.outcome();
        const key = outcome ? `edit:${outcome.id}` : 'create';

        if (this.formKey === key) return;
        this.formKey = key;

        this.form.reset({
          code: outcome?.code ?? '',
          description: outcome?.description ?? '',
          version: outcome?.version ?? '',
          isActive: outcome?.isActive ?? true,
        });
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
      code: raw.code.trim(),
      description: raw.description.trim(),
      version: raw.version.trim(),
      isActive: raw.isActive,
    });
  }

  close(): void {
    this.visible.set(false);
  }
}
