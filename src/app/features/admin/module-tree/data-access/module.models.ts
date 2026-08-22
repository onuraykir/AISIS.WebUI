/**
 * `api/ModuleAdmin` sözleşmesi — backend'deki ModuleTreeNodeDto ve komut DTO'ları
 * ile birebir. Uydurma alan yok.
 */

export interface ModuleTreeNode {
  readonly id: number;
  readonly code: string;
  readonly name: string;
  readonly icon: string;
  readonly description: string;

  /** null ise ANA modül. */
  readonly parentModuleId: number | null;
  readonly rootModuleId: number;

  /** 0 = ana modül, 1 = alt modül. */
  readonly level: number;

  readonly displayOrder: number;
  readonly isActive: boolean;

  /** Doğrudan bu modülün altındaki sayfa sayısı. */
  readonly pageCount: number;

  /** Bir kullanıcı grubunun kapsamında mı? Silme ve alt modül yapma engeli. */
  readonly isBoundToGroups: boolean;

  readonly subModules: readonly ModuleTreeNode[];
}

export interface ModuleCreateCommand {
  readonly code: string;
  readonly name: string;
  readonly icon: string;
  readonly description: string;
  /** null ise ana modül oluşur. */
  readonly parentModuleId: number | null;
  readonly isActive: boolean;
}

/** Kod, üst modül ve sıra bilerek yok — kendi uçlarından yönetilir. */
export interface ModuleUpdateCommand {
  readonly name: string;
  readonly icon: string;
  readonly description: string;
  readonly isActive: boolean;
}

export interface ModuleMoveCommand {
  /** null ise modül ana modül yapılır. */
  readonly newParentModuleId: number | null;
}

export interface ModuleReorderCommand {
  readonly parentModuleId: number | null;
  readonly orderedModuleIds: readonly number[];
}
