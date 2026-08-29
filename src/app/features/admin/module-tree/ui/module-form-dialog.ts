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
import { Textarea } from 'primeng/textarea';
import { ToggleSwitch } from 'primeng/toggleswitch';

import { ModuleTreeNode } from '../data-access/module.models';

export interface ModuleFormValue {
  readonly code: string;
  readonly name: string;
  readonly icon: string;
  readonly description: string;
  readonly isActive: boolean;
}

/** Sık kullanılan ikonlar; elle yazmak yerine tıklanabilsin diye. */
const ICON_SUGGESTIONS = [
  'pi pi-verified',
  'pi pi-check-square',
  'pi pi-chart-bar',
  'pi pi-sliders-h',
  'pi pi-server',
  'pi pi-sitemap',
  'pi pi-lock',
  'pi pi-book',
  'pi pi-users',
  'pi pi-calendar',
  'pi pi-file',
  'pi pi-folder',
];

/**
 * Modül ekleme / düzenleme formu.
 *
 * Salt sunum: kaydetmez, yalnızca geçerli değeri yayar. Kod alanı düzenleme
 * modunda kilitlidir — backend'de de değiştirilemez (ortamlar arası tutamaç).
 */
@Component({
  selector: 'app-module-form-dialog',
  imports: [ReactiveFormsModule, Dialog, InputText, Textarea, ToggleSwitch],
  templateUrl: './module-form-dialog.html',
  styleUrl: './module-form-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModuleFormDialog {
  private readonly fb = inject(FormBuilder);

  readonly visible = model(false);

  /** Düzenlenecek modül; null ise yeni kayıt. */
  readonly module = input<ModuleTreeNode | null>(null);

  /** Yeni kayıt bir modülün altına açılıyorsa üst modülün adı (yalnızca bilgi). */
  readonly parentName = input<string | null>(null);

  readonly saving = input(false);

  readonly save = output<ModuleFormValue>();

  readonly iconSuggestions = ICON_SUGGESTIONS;

  readonly isEdit = computed(() => this.module() !== null);

  readonly heading = computed(() => {
    if (this.isEdit()) {
      return 'Modülü Düzenle';
    }
    return this.parentName() ? `Alt Modül Ekle — ${this.parentName()}` : 'Yeni Ana Modül';
  });

  readonly form = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.maxLength(50), Validators.pattern(/^[A-Z0-9_]+$/)]],
    name: ['', [Validators.required, Validators.maxLength(100)]],
    icon: ['', [Validators.maxLength(50)]],
    description: ['', [Validators.maxLength(500)]],
    isActive: [true],
  });

  /**
   * Formun en son hangi modül için kurulduğu. Sıfırlama YALNIZCA diyalog
   * açıldığında yapılmalı; modül sinyali tazelendiğinde kullanıcının yazdığı
   * silinmemeli.
   */
  private formKey: string | null = null;

  constructor() {
    // Diyalog AÇILDIĞINDA form gelen girdiye göre sıfırlanır; önceki kaydın
    // artıkları yeni forma sızmasın. Açılış boyunca bir daha kurulmaz.
    effect(() => {
      if (!this.visible()) {
        this.formKey = null;
        return;
      }

      untracked(() => {
        const module = this.module();
        const key = module ? `edit:${module.id}` : 'create';

        if (this.formKey === key) {
          return;
        }
        this.formKey = key;

        this.form.reset({
          code: module?.code ?? '',
          name: module?.name ?? '',
          icon: module?.icon ?? '',
          description: module?.description ?? '',
          isActive: module?.isActive ?? true,
        });

        if (module) {
          this.form.controls.code.disable();
        } else {
          this.form.controls.code.enable();
        }
      });
    });
  }

  /** Kod alanı her zaman büyük harf; kullanıcı küçük yazsa da düzeltilir. */
  onCodeInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const upper = input.value.toLocaleUpperCase('en-US').replace(/[^A-Z0-9_]/g, '_');

    if (upper !== input.value) {
      this.form.controls.code.setValue(upper);
    }
  }

  pickIcon(icon: string): void {
    this.form.controls.icon.setValue(icon);
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    // getRawValue: düzenleme modunda kod kilitli olduğu için value'da gelmez.
    const raw = this.form.getRawValue();

    this.save.emit({
      code: raw.code.trim(),
      name: raw.name.trim(),
      icon: raw.icon.trim(),
      description: raw.description.trim(),
      isActive: raw.isActive,
    });
  }

  close(): void {
    this.visible.set(false);
  }
}
