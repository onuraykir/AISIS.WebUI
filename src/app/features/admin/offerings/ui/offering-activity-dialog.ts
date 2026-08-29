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

import { ActivityDefinition } from '@features/admin/activity-definitions/data-access/activity-definition.models';
import { OfferingActivity } from '../data-access/offering.models';

export type OfferingActivityFormResult =
  | {
      readonly mode: 'create';
      readonly command: { activityDefinitionId: number; name: string | null; maxPoint: number };
    }
  | { readonly mode: 'edit'; readonly command: { name: string; maxPoint: number } };

/**
 * Açılışa etkinlik ekleme / düzenleme.
 *
 * Düzenlemede **tür kilitli**: etkinliğin türü değişirse altındaki sorular ve
 * çıktı bağları anlamını yitirir — doğrusu silip yeniden eklemek. Ad ve puan
 * serbesttir, çünkü onlar bağları bozmaz.
 *
 * Ad boş bırakılabilir; sunucu tanımın adını kullanır. Tek vizeli bir derste
 * kullanıcıya ayrıca "Vize" yazdırmanın anlamı yok.
 */
@Component({
  selector: 'app-offering-activity-dialog',
  imports: [ReactiveFormsModule, Dialog, InputText, Select],
  templateUrl: './offering-activity-dialog.html',
  styleUrl: './offering-activity-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfferingActivityDialog {
  private readonly fb = inject(FormBuilder);

  readonly visible = model(false);

  readonly activity = input<OfferingActivity | null>(null);
  readonly definitions = input<readonly ActivityDefinition[]>([]);
  readonly saving = input(false);

  /** Bu açılışta zaten kullanılan adlar; sunucuya gitmeden uyarmak için. */
  readonly usedNames = input<readonly string[]>([]);

  readonly save = output<OfferingActivityFormResult>();

  readonly isEdit = computed(() => this.activity() !== null);
  readonly heading = computed(() => (this.isEdit() ? 'Etkinliği Düzenle' : 'Etkinlik Ekle'));

  readonly definitionOptions = computed(() =>
    this.definitions().map((definition) => ({
      value: definition.id,
      label: `${definition.name} (${definition.code})`,
    })),
  );

  readonly form = this.fb.nonNullable.group({
    activityDefinitionId: [0, [Validators.required, Validators.min(1)]],
    name: ['', [Validators.maxLength(150)]],
    maxPoint: [100, [Validators.required, Validators.min(0), Validators.max(1000)]],
  });

  private readonly nameValue = toSignal(this.form.controls.name.valueChanges, {
    initialValue: this.form.controls.name.value,
  });

  private readonly definitionIdValue = toSignal(
    this.form.controls.activityDefinitionId.valueChanges,
    { initialValue: this.form.controls.activityDefinitionId.value },
  );

  /** Seçilen türün adı; ad boş bırakılırsa kaydedilecek olan budur. */
  readonly selectedDefinitionName = computed(
    () => this.definitions().find((d) => d.id === this.definitionIdValue())?.name ?? '',
  );

  /** Kaydedilecek gerçek ad: yazılan varsa o, yoksa tanımın adı. */
  readonly effectiveName = computed(() => this.nameValue().trim() || this.selectedDefinitionName());

  /**
   * Bu ad açılışta zaten var mı? Sunucu da tutuyor (benzersiz dizin); burada
   * kaydete basılmadan söyleniyor.
   */
  readonly nameTaken = computed(() => {
    const name = fold(this.effectiveName());
    return name.length > 0 && this.usedNames().some((used) => fold(used) === name);
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
        const activity = this.activity();
        const key = activity ? `edit:${activity.id}` : 'create';

        if (this.formKey === key) {
          return;
        }
        this.formKey = key;

        this.form.reset({
          activityDefinitionId: activity?.activityDefinitionId ?? 0,
          name: activity?.name ?? '',
          maxPoint: activity?.maxPoint ?? 100,
        });

        if (activity) {
          this.form.controls.activityDefinitionId.disable();
        } else {
          this.form.controls.activityDefinitionId.enable();
        }
      });
    });
  }

  onSubmit(): void {
    if (this.form.invalid || this.nameTaken()) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const typed = raw.name.trim();

    this.save.emit(
      this.isEdit()
        ? { mode: 'edit', command: { name: this.effectiveName(), maxPoint: raw.maxPoint } }
        : {
            mode: 'create',
            command: {
              activityDefinitionId: raw.activityDefinitionId,
              name: typed.length > 0 ? typed : null,
              maxPoint: raw.maxPoint,
            },
          },
    );
  }

  close(): void {
    this.visible.set(false);
  }
}

/** Karşılaştırma için ad katlama; sunucudaki büyük/küçük harfe duyarsız kısıtla aynı niyet. */
function fold(value: string): string {
  return value.trim().toLocaleLowerCase('tr-TR');
}
