import { ChangeDetectionStrategy, Component, effect, inject, input, model, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';

/**
 * Tek alanlı "ad" diyaloğu.
 *
 * Rol ve kullanıcı grubu gibi yalnızca adı düzenlenen kayıtlar için ortak.
 * Her ekran için ayrı bir diyalog yazmak, aynı formu üç kez bakıma sokardı;
 * asıl içerik (yetkiler, kapsam) zaten sayfanın kendisinde yönetiliyor.
 */
@Component({
  selector: 'app-name-dialog',
  imports: [ReactiveFormsModule, Dialog, InputText],
  template: `
    <p-dialog
      [visible]="visible()"
      (visibleChange)="visible.set($event)"
      [header]="heading()"
      [modal]="true"
      [draggable]="false"
      [dismissableMask]="true"
      styleClass="app-dialog"
      [style]="{ width: '400px' }"
    >
      <form class="form" [formGroup]="form" (ngSubmit)="onSubmit()">
        <div class="form__field">
          <label class="form__label" [attr.for]="'name-dialog-input'">{{ label() }}</label>
          <input
            id="name-dialog-input"
            pInputText
            formControlName="name"
            [placeholder]="placeholder()"
            autocomplete="off"
          />

          @if (hint()) {
            <p class="form__help">{{ hint() }}</p>
          }

          @if (form.controls.name.touched && form.controls.name.invalid) {
            <p class="form__error">{{ label() }} zorunludur.</p>
          }
        </div>

        <footer class="form__footer">
          <button type="button" class="btn btn--ghost" [disabled]="saving()" (click)="close()">
            Vazgeç
          </button>
          <button type="submit" class="btn btn--primary" [disabled]="saving()">
            @if (saving()) {
              <i class="pi pi-spin pi-spinner" aria-hidden="true"></i>
            }
            {{ submitLabel() }}
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
      font-size: 12.5px;
      font-weight: 600;
      color: var(--p-text-color);
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

    .form__footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding-top: 4px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NameDialog {
  private readonly fb = inject(FormBuilder);

  readonly visible = model(false);

  readonly heading = input.required<string>();
  readonly label = input('Ad');
  readonly hint = input('');
  readonly placeholder = input('');

  /** Düzenlenen kaydın mevcut adı; boş ise yeni kayıt. */
  readonly value = input('');

  readonly submitLabel = input('Kaydet');
  readonly saving = input(false);

  readonly save = output<string>();

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
  });

  constructor() {
    // Diyalog her açıldığında gelen değere göre sıfırlanır.
    effect(() => {
      if (!this.visible()) {
        return;
      }

      this.form.reset({ name: this.value() });
    });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.save.emit(this.form.getRawValue().name.trim());
  }

  close(): void {
    this.visible.set(false);
  }
}
