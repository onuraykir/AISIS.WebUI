/** `api/OperationAdmin` sözleşmesi — backend DTO'ları ile birebir. */

/** Ortak eylem havuzundaki bir tanım (VIEW, CREATE, …). */
export interface ActionDefinition {
  readonly id: number;
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly displayOrder: number;

  /** Kaç sayfa işleminde kullanılıyor? Silme engeli. */
  readonly usageCount: number;
}

/** Bir işleme bağlanmış eylem. YETKİNİN BİRİMİ BUDUR. */
export interface OperationAction {
  readonly id: number;
  readonly pageOperationId: number;
  readonly actionDefinitionId: number;
  readonly actionCode: string;
  readonly actionName: string;

  /** Boş olabilir: her eylemin arkasında bir uç nokta yoktur (ör. VIEW). */
  readonly endpoint: string | null;
  readonly httpMethod: string | null;

  readonly displayOrder: number;
  readonly isActive: boolean;

  /** Bu eyleme verilmiş rol yetkisi sayısı — kaldırma engeli. */
  readonly grantCount: number;
}

/** Sayfadaki bir iş fonksiyonu ve eylemleri. */
export interface PageOperation {
  readonly id: number;
  readonly pageId: number;
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly displayOrder: number;
  readonly isActive: boolean;
  readonly actions: readonly OperationAction[];
}

/**
 * Uygulamada gerçekten tanımlı bir uç nokta. Controller rotalarından okunur;
 * eylem bağlarken adres elle yazılmaz, bu listeden seçilir.
 */
export interface ApiEndpoint {
  readonly route: string;
  readonly httpMethod: string;
  readonly controller: string;
  readonly action: string;

  /** Kaç eyleme bağlı? 0 ise bu uç henüz yetkilendirilmemiş. */
  readonly usageCount: number;
}

export interface ActionDefinitionCreateCommand {
  readonly code: string;
  readonly name: string;
  readonly description: string;
}

/** Code bilerek yok: bir kez verilir, değişmez. */
export interface ActionDefinitionUpdateCommand {
  readonly name: string;
  readonly description: string;
}

export interface ActionDefinitionReorderCommand {
  readonly orderedActionDefinitionIds: readonly number[];
}

export interface PageOperationCreateCommand {
  readonly code: string;
  readonly name: string;
  readonly description: string;
}

/** Code bilerek yok: bir kez verilir, değişmez. */
export interface PageOperationUpdateCommand {
  readonly name: string;
  readonly description: string;
  readonly isActive: boolean;
}

export interface PageOperationReorderCommand {
  readonly orderedOperationIds: readonly number[];
}

export interface OperationActionAttachCommand {
  readonly actionDefinitionId: number;
  readonly endpoint: string | null;
  readonly httpMethod: string | null;
}

export interface OperationActionUpdateCommand {
  readonly endpoint: string | null;
  readonly httpMethod: string | null;
  readonly isActive: boolean;
}
