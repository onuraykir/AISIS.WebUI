/** `api/PageAdmin` sözleşmesi — backend'deki PageListItemDto ve komut DTO'ları ile birebir. */

// İşlem → eylem ağacı bu ekranda da gösteriliyor; sözleşme İşlem Kataloğu'nda
// tanımlı olduğu için oradan alınır. `import type` olduğu için çalışma anında
// iki özellik arasında bağ oluşmaz.
import type { PageOperation } from '../../operation-catalog/data-access/operation.models';

export interface PageListItem {
  readonly id: number;
  readonly name: string;

  /** Ekranla kurulan tek bağ; uygulamanın yönlendirme tablosunda tanımlı olmalı. */
  readonly route: string;

  readonly icon: string;
  readonly description: string;
  readonly displayOrder: number;
  readonly isActive: boolean;

  /** null ise sayfa HAVUZDA — henüz bir modüle yerleştirilmemiş. */
  readonly moduleId: number | null;
  readonly moduleName: string | null;

  readonly rootModuleId: number | null;
  readonly rootModuleName: string | null;

  /** Bu sayfada tanımlı iş fonksiyonu sayısı. */
  readonly operationCount: number;

  /** Bu sayfanın işlemlerindeki toplam eylem sayısı. */
  readonly actionCount: number;

  /**
   * Uç noktası olmayan eylem sayısı. Salt görünürlük yetkileri (VIEW) ile ucu
   * henüz yazılmamış eylemleri birlikte sayar; ikincisi gözden kaçmamalı.
   */
  readonly unmappedActionCount: number;

  /** Bu sayfanın eylemlerine verilmiş rol yetkisi sayısı — silme/havuza alma engeli. */
  readonly grantCount: number;

  /** Sayfanın işlem → eylem ağacı; künye panelinde açılır. */
  readonly operations: readonly PageOperation[];

  readonly isPlaced: boolean;
}

export interface PageCreateCommand {
  readonly name: string;
  readonly route: string;
  readonly icon: string;
  readonly description: string;
  /** Verilmezse sayfa havuzda oluşur. */
  readonly moduleId: number | null;
  readonly isActive: boolean;
}

/** ModuleId ve sıra bilerek yok — yerleştirme kendi ucundan yönetilir. */
export interface PageUpdateCommand {
  readonly name: string;
  readonly route: string;
  readonly icon: string;
  readonly description: string;
  readonly isActive: boolean;
}

export interface PagePlacementCommand {
  /** null ise sayfa havuza alınır. */
  readonly moduleId: number | null;
}

/** Yerleştirme hedefi olarak sunulan modül (ağaçtan düzleştirilmiş). */
export interface ModuleOption {
  readonly id: number;
  readonly label: string;
  readonly level: number;
}
