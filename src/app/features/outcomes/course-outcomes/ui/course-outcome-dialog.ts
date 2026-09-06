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
import { Textarea } from 'primeng/textarea';

import { CourseOutcome } from '../data-access/course-outcome.models';

export type CourseOutcomeFormResult = {
  readonly code: string;
  readonly description: string;
};

/**
 * Ders çıktısı ekleme / düzenleme.
 *
 * KOD AÇILIŞ İÇİNDE TEKİL: aynı açılışta iki `DÇ1` olamaz. Sunucu da denetliyor,
 * ama çakışmayı burada söylemek hocayı boş bir istekten kurtarıyor.
 */
@Component({
  selector: 'app-course-outcome-dialog',
  imports: [ReactiveFormsModule, Dialog, InputText, Textarea],
  templateUrl: './course-outcome-dialog.html',
  styleUrl: './course-outcome-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CourseOutcomeDialog {
  private readonly fb = inject(FormBuilder);

  readonly visible = model(false);

  readonly outcome = input<CourseOutcome | null>(null);
  readonly saving = input(false);

  /** Bu açılışta kullanılmış kodlar (büyük harfe çevrilmiş). */
  readonly usedCodes = input<readonly string[]>([]);

  /** Hangi açılışa yazılacağı; başlıkta gösteriliyor ki yanlış derse çıktı eklenmesin. */
  readonly offeringLabel = input<string | null>(null);

  readonly save = output<CourseOutcomeFormResult>();

  readonly isEdit = computed(() => this.outcome() !== null);
  readonly heading = computed(() =>
    this.isEdit() ? 'Ders Çıktısını Düzenle' : 'Ders Çıktısı Ekle',
  );

  readonly form = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.maxLength(20)]],
    description: ['', [Validators.required, Validators.maxLength(1000)]],
  });

  /** Zoneless olduğumuz için kontrolün değeri sinyale çevriliyor; şablon bunu türetiyor. */
  private readonly typedCode = toSignal(this.form.controls.code.valueChanges, {
    initialValue: this.form.controls.code.value,
  });

  /** Kod bu açılışta zaten var mı? Düzenlemede kaydın kendi kodu çakışma sayılmaz. */
  readonly codeTaken = computed(() => {
    const typed = this.typedCode().trim().toLocaleUpperCase('tr-TR');
    if (typed.length === 0) return false;

    const own = this.outcome()?.code.trim().toLocaleUpperCase('tr-TR');
    if (own !== undefined && own === typed) return false;

    return this.usedCodes().includes(typed);
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

        // Aynı kayıt için form YENİDEN kurulmaz: kullanıcı yazarken diyalog
        // başka bir sebeple yeniden çizilirse yazdığı metni kaybetmemeli.
        if (this.formKey === key) return;
        this.formKey = key;

        this.form.reset({
          code: outcome?.code ?? '',
          description: outcome?.description ?? '',
        });
      });
    });
  }

  onSubmit(): void {
    if (this.form.invalid || this.codeTaken()) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();

    this.save.emit({
      code: raw.code.trim(),
      description: raw.description.trim(),
    });
  }

  close(): void {
    this.visible.set(false);
  }
}
