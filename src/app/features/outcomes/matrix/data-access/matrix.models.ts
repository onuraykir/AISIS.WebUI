/**
 * AĞIRLIK MATRİSİ sözleşmesi.
 *
 * Matris ders çıktılarını (satır) değerlendirme etkinlikleriyle (kolon) ağırlık
 * üzerinden, sorularla da bağ üzerinden ilişkilendirir. Çıktı hesabının hem
 * **payını** (hangi soru hangi çıktıyı ölçüyor) hem **ağırlığını** (etkinliğin o
 * çıktıdaki payı) burası belirler.
 *
 * İKİ ADIM: `parse` hiçbir şey yazmaz, önizleme döner; `confirm` yazar ve
 * karşılaştırmayı sunucuda **yeniden** kurar.
 */

export interface OutcomeGrid {
  readonly courseInSemesterId: number;
  readonly courseName: string;

  readonly outcomes: readonly OutcomeGridRow[];
  readonly activities: readonly OutcomeGridActivity[];
  readonly items: readonly OutcomeGridItem[];
}

export interface OutcomeGridRow {
  readonly id: number;
  readonly code: string;
  readonly description: string;

  /** SEYREK liste: ağırlığı olmayan etkinlik burada bulunmaz, hücre boş görünür. */
  readonly weights: readonly OutcomeWeight[];

  readonly linkedItemIds: readonly number[];
}

export interface OutcomeGridActivity {
  readonly id: number;
  readonly name: string;
  readonly maxPoint: number;
}

export interface OutcomeGridItem {
  readonly id: number;
  readonly activityId: number;
  readonly name: string;
  readonly sequenceNo: number;

  /** Çıktı hesabının paydası. Sıfırsa hesap koşmaz. */
  readonly maxPoint: number;
}

export interface OutcomeWeight {
  readonly activityId: number;
  readonly weight: number;
}

// ── Yazma taslağı ──

/**
 * Bir satırın taslakta OLMAMASI "dokunma" demektir (upsert), "sil" demek değildir.
 * Silme yalnızca `deletions` ile açıkça istenir.
 */
export interface OutcomeDraft {
  readonly courseInSemesterId: number;
  readonly outcomes: readonly OutcomeDraftRow[];
  readonly deletions: { readonly courseOutcomeIds: readonly number[] };
}

export interface OutcomeDraftRow {
  /** null ise YENİ çıktı. */
  readonly courseOutcomeId: number | null;
  readonly code: string;
  readonly description: string;

  /** Boş gönderilirse bu çıktının TÜM ağırlıkları silinir. */
  readonly weights: readonly OutcomeWeight[];

  /** Boş gönderilirse bu çıktının tüm soru bağları silinir. */
  readonly linkedItemIds: readonly number[];
}

// ── Önizleme ──

export interface OutcomeConfirmation {
  readonly draft: OutcomeDraft;
  readonly comparison: OutcomeComparison;
}

export interface OutcomeComparison {
  readonly courseInSemesterId: number;
  readonly outcomes: readonly OutcomeRowComparison[];
  readonly deletions: readonly OutcomeDeletionComparison[];
  readonly blockingIssues: readonly OutcomeBlockingIssue[];
  readonly summary: OutcomeComparisonSummary;
  readonly canConfirm: boolean;
}

/** 0 Unchanged · 1 New · 2 Modified · 3 Deleted — sunucudaki `ChangeState`. */
export type ChangeState = 0 | 1 | 2 | 3;

export const CHANGE_STATE = {
  Unchanged: 0,
  New: 1,
  Modified: 2,
  Deleted: 3,
} as const;

export interface OutcomeRowComparison {
  readonly incomingId: number | null;
  readonly existingId: number | null;
  readonly code: string;
  readonly description: string;
  readonly existingCode: string | null;
  readonly existingDescription: string | null;
  readonly state: ChangeState;
  readonly weights: readonly OutcomeWeightComparison[];

  /** Kural gereği 0 veya 100 olmalı. */
  readonly weightTotal: number;

  readonly itemLinks: readonly OutcomeItemLinkComparison[];
}

export interface OutcomeWeightComparison {
  readonly activityId: number;
  readonly activityName: string;
  readonly newWeight: number | null;
  readonly existingWeight: number | null;
  readonly state: ChangeState;
}

export interface OutcomeItemLinkComparison {
  readonly activityItemId: number;
  readonly itemName: string;
  readonly activityId: number;
  readonly activityName: string;
  readonly maxPoint: number;
  readonly state: ChangeState;
}

export interface OutcomeDeletionComparison {
  readonly courseOutcomeId: number;
  readonly code: string;
  readonly affectedWeightCount: number;
  readonly affectedItemLinkCount: number;
}

export interface OutcomeBlockingIssue {
  readonly code: string;
  readonly message: string;
  readonly identifier: string | null;
}

export interface OutcomeComparisonSummary {
  readonly newOutcomeCount: number;
  readonly modifiedOutcomeCount: number;
  readonly unchangedOutcomeCount: number;
  readonly deletedOutcomeCount: number;
  readonly newWeightCount: number;
  readonly modifiedWeightCount: number;
  readonly deletedWeightCount: number;
  readonly newItemLinkCount: number;
  readonly deletedItemLinkCount: number;
}

/**
 * EKRANDA DÜZENLENEN satır. Sunucudan gelenden ayrı bir tip: burada ağırlık
 * **seyrek liste değil**, etkinlik başına doldurulmuş bir sözlük — hücreye yazmak
 * listede arama yapmayı gerektirmesin.
 */
export interface MatrixRow {
  courseOutcomeId: number | null;
  code: string;
  description: string;

  /** activityId -> ağırlık (yüzde). Boş hücre = anahtar yok. */
  weights: Record<number, number>;

  /** Bağlı soru Id'leri. */
  linkedItemIds: Set<number>;
}
