import { ChangeDetectionStrategy, Component, computed, effect, inject, input, model, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import { ToggleSwitch } from 'primeng/toggleswitch';

import { ModuleOption, PageListItem } from '../data-access/page.models';

export interface PageFormValue {
  readonly name: string;
  readonly route: string;
  readonly icon: string;
  readonly description: string;
  readonly moduleId: number | null;
  readonly isActive: boolean;
}

/** Adres standardı: küçük harf, kelimeler tire, bölümler eğik çizgi. */
const ROUTE_PATTERN = /^\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9:{}]+(?:-[a-z0-9]+)*)*$/;

/**
 * Sayfa ekleme / düzenleme formu.
 *
 * Modül seçimi YALNIZCA yeni kayıtta var: mevcut sayfanın yeri "Yerleştirme"
 * bölümünden yönetilir, kazara taşınmasın diye.
 */
@Component({
  selector: 'app-page-form-dialog',
  imports: [ReactiveFormsModule, Dialog, InputText, Textarea, ToggleSwitch, Select],
  templateUrl: './page-form-dialog.html',
  styleUrl: './page-form-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageFormDialog {
  private readonly fb = inject(FormBuilder);

  readonly visible = model(false);
  readonly page = input<PageListItem | null>(null);
  readonly moduleOptions = input<readonly ModuleOption[]>([]);
  readonly saving = input(false);

  readonly save = output<PageFormValue>();

  readonly isEdit = computed(() => this.page() !== null);
  readonly heading = computed(() => (this.isEdit() ? 'Sayfayı Düzenle' : 'Yeni Sayfa'));

  /** "Havuzda bırak" seçeneği listenin başında durur. */
  readonly placementOptions = computed(() => [
    { id: null as number | null, label: 'Havuzda bırak (yerleştirme)', level: 0 },
    ...this.moduleOptions(),
  ]);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    route: ['', [Validators.required, Validators.maxLength(200), Validators.pattern(ROUTE_PATTERN)]],
    icon: ['', [Validators.maxLength(50)]],
    description: ['', [Validators.maxLength(500)]],
    moduleId: [null as number | null],
    isActive: [true],
  });

  constructor() {
    effect(() => {
      if (!this.visible()) {
        return;
      }

      const page = this.page();

      this.form.reset({
        name: page?.name ?? '',
        route: page?.route ?? '',
        icon: page?.icon ?? '',
        description: page?.description ?? '',
        moduleId: page?.moduleId ?? null,
        isActive: page?.isActive ?? true,
      });

      // Düzenlemede yer değiştirme bu formdan yapılmaz.
      if (page) {
        this.form.controls.moduleId.disable();
      } else {
        this.form.controls.moduleId.enable();
      }
    });
  }

  /** Adres her zaman küçük harf ve başında eğik çizgi. */
  onRouteInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.toLocaleLowerCase('en-US').replace(/\s+/g, '-');

    if (value.length > 0 && !value.startsWith('/')) {
      value = `/${value}`;
    }

    if (value !== input.value) {
      this.form.controls.route.setValue(value);
    }
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();

    this.save.emit({
      name: raw.name.trim(),
      route: raw.route.trim(),
      icon: raw.icon.trim(),
      description: raw.description.trim(),
      moduleId: raw.moduleId,
      isActive: raw.isActive,
    });
  }

  close(): void {
    this.visible.set(false);
  }
}
