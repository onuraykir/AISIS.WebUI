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
import { Select } from 'primeng/select';
import { ToggleSwitch } from 'primeng/toggleswitch';

import { ActionDefinition, ApiEndpoint, OperationAction } from '../data-access/operation.models';

export interface OperationActionFormValue {
  readonly actionDefinitionId: number;
  readonly endpoint: string | null;
  readonly httpMethod: string | null;
  readonly isActive: boolean;
}

/** Uç nokta seçicisinin bir satırı. Değer, adres + metot çiftini birlikte taşır. */
interface EndpointOption {
  readonly value: string;
  readonly label: string;
  readonly method: string;
  readonly route: string;
  readonly hint: string;
}

/** Adres + metodu tek bir seçim değerinde birleştirir. */
function endpointKey(method: string, route: string): string {
  return `${method} ${route}`;
}

/**
 * İşleme eylem bağlama / bağı düzenleme.
 *
 * İki havuzdan seçim yapılır: eylem HAVUZU (ortak sözlük) ve UÇ NOKTA havuzu
 * (uygulamanın kendi controller rotaları). Adres elle yazılmaz — yanlış yazılan
 * bir rota sessizce hiçbir isteği eşleştirmez, bu da yetkiyi görünmez biçimde
 * boşa düşürürdü.
 *
 * Uç nokta boş bırakılabilir: ucu henüz yazılmamış bir eylem yetkilendirilebilir
 * ama sunucudaki adres eşleştirmesine girmez; ekranda UNAVAILABLE görünür.
 */
@Component({
  selector: 'app-operation-action-dialog',
  imports: [ReactiveFormsModule, Dialog, Select, ToggleSwitch],
  templateUrl: './operation-action-dialog.html',
  styleUrl: './operation-action-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OperationActionDialog {
  private readonly fb = inject(FormBuilder);

  readonly visible = model(false);

  /** Dolu ise mevcut bağ düzenleniyor; null ise yeni bağ kuruluyor. */
  readonly action = input<OperationAction | null>(null);

  /** Bu işleme hâlâ bağlanabilecek eylem tanımları. */
  readonly available = input<readonly ActionDefinition[]>([]);

  /** Uygulamada tanımlı uç noktalar. */
  readonly endpoints = input<readonly ApiEndpoint[]>([]);

  readonly operationName = input('');
  readonly saving = input(false);

  /** Havuz çipinden açıldığında önceden seçili gelecek eylem. */
  readonly preselectDefinitionId = input<number | null>(null);

  readonly save = output<OperationActionFormValue>();

  readonly isEdit = computed(() => this.action() !== null);

  readonly heading = computed(() =>
    this.isEdit()
      ? `Eylemi Düzenle — ${this.action()?.actionName}`
      : `Eylem Bağla — ${this.operationName()}`,
  );

  readonly definitionOptions = computed(() =>
    this.available().map((item) => ({ label: `${item.name} (${item.code})`, value: item.id })),
  );

  /**
   * Uç nokta seçenekleri. Düzenlenen bağın adresi listede yoksa (uç silinmiş
   * veya elle girilmiş) en üste "listede yok" işaretiyle eklenir — sessizce
   * kaybolup yerine boş değer geçmesin.
   */
  readonly endpointOptions = computed<EndpointOption[]>(() => {
    const options = this.endpoints().map((endpoint) => ({
      value: endpointKey(endpoint.httpMethod, endpoint.route),
      label: `${endpoint.httpMethod} ${endpoint.route}`,
      method: endpoint.httpMethod,
      route: endpoint.route,
      hint:
        endpoint.usageCount === 0
          ? 'henüz yetkilendirilmemiş'
          : `${endpoint.usageCount} eylemde kullanılıyor`,
    }));

    const current = this.action();
    if (!current?.endpoint || !current.httpMethod) {
      return options;
    }

    const key = endpointKey(current.httpMethod, current.endpoint);
    if (options.some((option) => option.value === key)) {
      return options;
    }

    return [
      {
        value: key,
        label: `${current.httpMethod} ${current.endpoint}`,
        method: current.httpMethod,
        route: current.endpoint,
        hint: 'uygulamada böyle bir uç yok',
      },
      ...options,
    ];
  });

  readonly form = this.fb.nonNullable.group({
    actionDefinitionId: [null as number | null, [Validators.required]],
    endpointKey: [null as string | null],
    isActive: [true],
  });

  /**
   * Formun en son hangi bağ için kurulduğu. Sıfırlama YALNIZCA diyalog
   * açıldığında yapılmalı; girdi sinyalleri tazelendiğinde kullanıcının
   * seçtikleri silinmemeli.
   *
   * Yeni bağda anahtara ÖN SEÇİM de giriyor: aynı diyalog havuzdaki farklı bir
   * çipten açıldığında form yeniden kurulmalı.
   */
  private formKey: string | null = null;

  constructor() {
    effect(() => {
      if (!this.visible()) {
        this.formKey = null;
        return;
      }

      untracked(() => {
        const action = this.action();
        const key = action ? `edit:${action.id}` : `create:${this.preselectDefinitionId() ?? '-'}`;

        if (this.formKey === key) {
          return;
        }
        this.formKey = key;

        this.form.reset({
          actionDefinitionId: action?.actionDefinitionId ?? this.preselectDefinitionId(),
          endpointKey:
            action?.endpoint && action.httpMethod
              ? endpointKey(action.httpMethod, action.endpoint)
              : null,
          isActive: action?.isActive ?? true,
        });

        if (action) {
          this.form.controls.actionDefinitionId.disable();
        } else {
          this.form.controls.actionDefinitionId.enable();
        }
      });
    });
  }

  onSubmit(): void {
    const raw = this.form.getRawValue();

    if (raw.actionDefinitionId === null) {
      this.form.controls.actionDefinitionId.markAsTouched();
      return;
    }

    const selected = this.endpointOptions().find((option) => option.value === raw.endpointKey);

    this.save.emit({
      actionDefinitionId: raw.actionDefinitionId,
      endpoint: selected?.route ?? null,
      httpMethod: selected?.method ?? null,
      isActive: raw.isActive,
    });
  }

  close(): void {
    this.visible.set(false);
  }
}
