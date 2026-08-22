import { ChangeDetectionStrategy, Component, computed, effect, inject, input, model, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { ToggleSwitch } from 'primeng/toggleswitch';

export interface CodeNameValue {
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly isActive: boolean;
}

/**
 * "Değişmez kod + ad + açıklama" diyaloğu.
 *
 * Eylem tanımı ile sayfa işlemi farklı kavramlar ama formları birebir aynı;
 * ikisini ayrı yazmak aynı doğrulamayı iki yerde bakıma sokardı. Kod
 * düzenlemede kilitlidir: bir kez verilir, sonra yetkiler ona dayanır.
 */
@Component({
  selector: 'app-code-name-dialog',
  imports: [ReactiveFormsModule, Dialog, InputText, Textarea, ToggleSwitch],
  template: `
    <p-dialog
      [visible]="visible()"
      (visibleChange)="visible.set($event)"
      [header]="heading()"
      [modal]="true"
      [draggable]="false"
      [dismissableMask]="true"
      styleClass="app-dialog"
      [style]="{ width: '440px' }"
    >
      <form class="form" [formGroup]="form" (ngSubmit)="onSubmit()">
        <div class="form__field">
          <label class="form__label" for="code-name-code">
            Kod
            @if (isEdit()) {
              <span class="form__hint">değiştirilemez</span>
            }
          </label>
          <input
            id="code-name-code"
            pInputText
            formControlName="code"
            [placeholder]="codePlaceholder()"
            autocomplete="off"
            spellcheck="false"
            (input)="onCodeInput($event)"
          />
          <p class="form__help">{{ codeHelp() }}</p>

          @if (form.controls.code.touched && form.controls.code.invalid) {
            <p class="form__error">Kod zorunludur ve yalnızca A–Z, 0–9, alt çizgi içerebilir.</p>
          }
        </div>

        <div class="form__field">
          <label class="form__label" for="code-name-name">Ad</label>
          <input
            id="code-name-name"
            pInputText
            formControlName="name"
            [placeholder]="namePlaceholder()"
          />

          @if (form.controls.name.touched && form.controls.name.invalid) {
            <p class="form__error">Ad zorunludur.</p>
          }
        </div>

        <div class="form__field">
          <label class="form__label" for="code-name-description">Açıklama</label>
          <textarea
            id="code-name-description"
            pTextarea
            formControlName="description"
            rows="2"
            [placeholder]="descriptionPlaceholder()"
          ></textarea>
        </div>

        @if (showActive() && isEdit()) {
          <div class="form__switch">
            <p-toggleswitch formControlName="isActive" inputId="code-name-active" />
            <label for="code-name-active">
              <span class="form__switch-title">Aktif</span>
              <span class="form__switch-help">{{ activeHelp() }}</span>
            </label>
          </div>
        }

        <footer class="form__footer">
          <button type="button" class="btn btn--ghost" [disabled]="saving()" (click)="close()">
            Vazgeç
          </button>
          <button type="submit" class="btn btn--primary" [disabled]="saving()">
            @if (saving()) {
              <i class="pi pi-spin pi-spinner" aria-hidden="true"></i>
            }
            {{ isEdit() ? 'Kaydet' : 'Oluştur' }}
          </button>
        </footer>
      </form>
    </p-dialog>
  `,
  styles: `
    .form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .form__field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .form__label {
      display: flex;
      align-items: baseline;
      gap: 8px;
      font-size: 12.5px;
      font-weight: 600;
      color: var(--p-text-color);
    }

    .form__hint {
      font-weight: 400;
      font-size: 11px;
      color: var(--p-text-muted-color);
    }

    .form__help {
      margin: 0;
      color: var(--p-text-muted-color);
      font-size: 11.5px;
      line-height: 1.55;
    }

    .form__error {
      margin: 0;
      color: #dc2626;
      font-size: 11.5px;
    }

    .form__switch {
      display: flex;
      align-items: flex-start;
      gap: 11px;
      padding: 12px;
      border: 1px solid var(--p-content-border-color);
      border-radius: 10px;
    }

    .form__switch label {
      display: flex;
      flex-direction: column;
      gap: 2px;
      cursor: pointer;
    }

    .form__switch-title {
      font-size: 12.5px;
      font-weight: 600;
      color: var(--p-text-color);
    }

    .form__switch-help {
      font-size: 11.5px;
      line-height: 1.5;
      color: var(--p-text-muted-color);
    }

    .form__footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding-top: 4px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CodeNameDialog {
  private readonly fb = inject(FormBuilder);

  readonly visible = model(false);

  readonly heading = input.required<string>();

  /** Dolu ise düzenleme; null ise yeni kayıt. */
  readonly value = input<CodeNameValue | null>(null);

  readonly codePlaceholder = input('EXPORT');
  readonly codeHelp = input('Yetki kontrollerinde kullanılan sabit anahtar. Yalnızca A–Z, 0–9 ve alt çizgi.');
  readonly namePlaceholder = input('');
  readonly descriptionPlaceholder = input('Bu ne yapar?');

  /** Aktiflik anahtarı yalnızca düzenlemede ve yalnızca destekleyen kayıtlarda. */
  readonly showActive = input(false);
  readonly activeHelp = input('Pasif kayıt menüde dönmez; verilmiş rol yetkileri silinmez.');

  readonly saving = input(false);

  readonly save = output<CodeNameValue>();

  readonly isEdit = computed(() => this.value() !== null);

  readonly form = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.maxLength(50), Validators.pattern(/^[A-Z0-9_]+$/)]],
    name: ['', [Validators.required, Validators.maxLength(100)]],
    description: ['', [Validators.maxLength(500)]],
    isActive: [true],
  });

  constructor() {
    effect(() => {
      if (!this.visible()) {
        return;
      }

      const value = this.value();

      this.form.reset({
        code: value?.code ?? '',
        name: value?.name ?? '',
        description: value?.description ?? '',
        isActive: value?.isActive ?? true,
      });

      if (value) {
        this.form.controls.code.disable();
      } else {
        this.form.controls.code.enable();
      }
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
      description: raw.description.trim(),
      isActive: raw.isActive,
    });
  }

  close(): void {
    this.visible.set(false);
  }
}
