/** `api/RoleAdmin` sözleşmesi — backend DTO'ları ile birebir. */

export interface RoleListItem {
  readonly id: number;
  readonly name: string;

  /** Role verilmiş eylem izni sayısı. */
  readonly permissionCount: number;

  /** Rolü kullanan grup sayısı — silme engeli. */
  readonly groupCount: number;
}

export interface MatrixAction {
  /** Yetkinin verildiği birim: işlemin tek eylemi. */
  readonly operationActionId: number;
  readonly code: string;
  readonly name: string;

  /** Uç noktası olmayan eylem UNAVAILABLE rozetiyle görünür; yine de yetkilendirilir. */
  readonly endpoint: string | null;
  readonly httpMethod: string | null;

  readonly isGranted: boolean;
}

export interface MatrixOperation {
  readonly operationId: number;
  readonly code: string;
  readonly name: string;
  readonly actions: readonly MatrixAction[];
}

export interface MatrixPage {
  readonly pageId: number;
  readonly pageName: string;
  readonly route: string;
  readonly operations: readonly MatrixOperation[];
}

export interface MatrixModule {
  readonly id: number;
  readonly name: string;
  readonly icon: string;
  readonly subModules: readonly MatrixModule[];
  readonly pages: readonly MatrixPage[];
}

/**
 * Yetki matrisi. YALNIZCA yerleştirilmiş sayfalar gelir; havuzdaki sayfa
 * yetkilendirilemez.
 */
export interface RolePermissionMatrix {
  readonly roleId: number;
  readonly roleName: string;
  readonly modules: readonly MatrixModule[];
}

export interface RoleCreateCommand {
  readonly name: string;
}

export interface RoleUpdateCommand {
  readonly name: string;
}

/** Rolün izinlerini TAMAMEN değiştirir (replace). */
export interface RolePermissionSetCommand {
  readonly operationActionIds: readonly number[];
}
