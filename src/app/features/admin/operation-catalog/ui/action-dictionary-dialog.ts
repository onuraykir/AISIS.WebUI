import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';

import { Dialog } from 'primeng/dialog';
import { Tooltip } from 'primeng/tooltip';

import { ActionDefinition } from '../data-access/operation.models';

/**
 * Ortak eylem sözlüğü (VIEW, CREATE, …).
 *
 * Ana akışta değil, üst çubuktan açılan bir diyalogda: on satırlık bu liste
 * yılda birkaç kez değişir, günlük iş ise sayfaya işlem ve eylem bağlamaktır.
 *
 * Salt sunum: veri çekmez, komut çalıştırmaz; olay yayar.
 */
@Component({
  selector: 'app-action-dictionary-dialog',
  imports: [Dialog, Tooltip],
  templateUrl: './action-dictionary-dialog.html',
  styleUrl: './action-dictionary-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActionDictionaryDialog {
  readonly visible = model(false);

  readonly definitions = input<readonly ActionDefinition[]>([]);
  readonly saving = input(false);

  readonly create = output<void>();
  readonly edit = output<ActionDefinition>();
  readonly remove = output<ActionDefinition>();
  readonly shift = output<{ definition: ActionDefinition; direction: -1 | 1 }>();

  /** Kullanımdaki bir tanım silinemez; sebebi ipucunda yazar. */
  deleteBlockedReason(definition: ActionDefinition): string | null {
    return definition.usageCount > 0
      ? `${definition.usageCount} işlemde kullanılıyor. Önce bağları kaldırın.`
      : null;
  }

  isFirst(definition: ActionDefinition): boolean {
    return this.definitions()[0]?.id === definition.id;
  }

  isLast(definition: ActionDefinition): boolean {
    return this.definitions().at(-1)?.id === definition.id;
  }

  close(): void {
    this.visible.set(false);
  }
}
