import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { Tooltip } from 'primeng/tooltip';

import { ModuleTreeNode } from '../data-access/module.models';

/**
 * Ağaçtaki tek bir satır. Salt sunum: veri almaz, kaydetmez, yalnızca olay yayar.
 *
 * Eylem düğmeleri satırın üzerine gelince görünür; klavyeyle gezinenler için
 * odakta da açılır (bkz. scss `:focus-within`).
 */
@Component({
  selector: 'app-module-node-row',
  imports: [Tooltip],
  templateUrl: './module-node-row.html',
  styleUrl: './module-node-row.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModuleNodeRow {
  readonly node = input.required<ModuleTreeNode>();
  readonly selected = input(false);
  readonly expanded = input(true);
  readonly canMoveUp = input(false);
  readonly canMoveDown = input(false);
  readonly busy = input(false);

  /** Yalnızca ana modüllerin altına alt modül eklenebilir (ağaç iki seviyeli). */
  readonly canAddChild = computed(() => this.node().level === 0);

  readonly hasChildren = computed(() => this.node().subModules.length > 0);

  readonly icon = computed(() => this.node().icon || 'pi pi-folder');

  readonly toggle = output<void>();
  readonly select = output<void>();
  readonly addChild = output<void>();
  readonly moveUp = output<void>();
  readonly moveDown = output<void>();
  readonly edit = output<void>();
  readonly remove = output<void>();
}
