/**
 * Sol menünün GÖRÜNÜM modeli.
 *
 * API sözleşmesi değildir — `MenuModule`/`MenuPage` ağacından türetilir
 * (bkz. core/utils/menu.mapper.ts). Sidebar, breadcrumb ve arama modül ile sayfayı
 * ayırt etmek zorunda kalmasın diye ikisi tek bir düğüm tipine indirgenir.
 */
export interface NavItem {
  /**
   * Ağaç içinde benzersiz. Modüller `m<id>`, sayfalar `p<id>` önekiyle gelir;
   * ikisi ayrı dizilerden numaralandığı için önek olmadan çakışırlardı.
   */
  readonly id: string;

  readonly label: string;

  /** PrimeIcons sınıfı, ör. 'pi pi-users'. */
  readonly icon?: string;

  /**
   * Mutlak yol, ör. '/program-cikti/liste'.
   * Doluysa düğüm bir SAYFADIR; boşsa MODÜLDÜR (tıklanınca açılır/kapanır).
   */
  readonly route?: string;

  readonly children?: readonly NavItem[];
}

/** Sidebar'ın düz liste olarak çizdiği tek satır. Şablonda özyineleme yapmamak içindir. */
export interface NavRow {
  readonly item: NavItem;
  /** 0 = kök. Girinti bu değerden hesaplanır. */
  readonly level: number;
  readonly hasChildren: boolean;
  readonly expanded: boolean;
}
