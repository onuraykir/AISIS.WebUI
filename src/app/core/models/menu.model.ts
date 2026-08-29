/**
 * `GET /api/Menu` yanıtının sözleşmesi.
 *
 * Backend'deki MenuModuleDto / MenuPageDto ile birebir aynıdır; burada tek satır
 * bile uydurma alan yoktur. Sunum için kullanılan NavItem ağacı bundan TÜRETİLİR
 * (bkz. core/utils/menu.mapper.ts) — API sözleşmesi ile görünüm modeli bilerek ayrı.
 */

/**
 * Ortak eylem sözlüğündeki kodlar (ActionDefinition.Code).
 *
 * `VIEW` YOKTUR ve olmayacak: görünürlük bir eylem değil kapsam sorusudur.
 * Sayfa, kullanıcının grubunun modül kapsamındaysa menüde çıkar; bu liste
 * yalnızca YAZMA eylemlerini taşır.
 */
export type ActionCode =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'IMPORT'
  | 'EXPORT'
  | 'APPROVE'
  | 'REJECT'
  | 'PRINT'
  /** Yerleştirme / atama: sayfayı modüle koymak, role yetki vermek, gruba kapsam bağlamak. */
  | 'ASSIGN'
  | 'GRADUATE'
  | 'WITHDRAW'
  | 'DISMISS'
  | 'TRANSFER'
  /** Kaydı sonlandırmadan askıya alır / geri açar. */
  | 'SUSPEND'
  | 'RESUME';

/**
 * Sayfadaki bir iş fonksiyonu ve kullanıcının o fonksiyondaki eylemleri.
 *
 * Aynı ekranda birden fazla iş fonksiyonu olabilir ("Çıktı Yönetimi",
 * "Eşik Yönetimi") ve yetki her birine ayrı verilir — düğmeler de bu ayrımı
 * izler: eşikte ekleme yetkisi olmayan kullanıcı o bölümde "Yeni" görmez.
 */
export interface MenuOperation {
  /** Sayfa içinde değişmez tutamaç, ör. 'THRESHOLD'. */
  readonly code: string;

  readonly name: string;

  /** Kullanıcının bu işlemde yapabildiği eylemler. */
  readonly actions: readonly ActionCode[];
}

/** Menüdeki bir sayfa ve kullanıcının o sayfada sahip olduğu işlemler. */
export interface MenuPage {
  readonly id: number;
  readonly name: string;

  /** Uygulamanın yönlendirme tablosundaki adres, ör. '/program-cikti/liste'. */
  readonly route: string;

  readonly icon: string;
  readonly displayOrder: number;

  /**
   * Bu sayfadaki iş fonksiyonları ve her birinde izinli eylemler.
   *
   * BOŞ OLABİLİR — ve bu normaldir: sayfayı görmek kapsamdan gelir, eylemler
   * rolden. Hiçbir yazma yetkisi olmayan kullanıcı sayfayı salt okunur görür.
   * Boş liste "sayfa yok" demek değildir.
   *
   * DİKKAT: Bu bir güvenlik önlemi değildir — sunucu tarafı da denetler.
   */
  readonly operations: readonly MenuOperation[];
}

/**
 * Menü ağacının bir düğümü. Ana modül ve alt modül aynı tiptir;
 * alt modüllerin `subModules` listesi boştur.
 *
 * İçinde görünür sayfa kalmayan düğümler yanıta hiç konmaz.
 */
export interface MenuModule {
  readonly id: number;

  /** Ortamlar arası sabit tutamaç, ör. 'ACCREDITATION'. */
  readonly code: string;

  readonly name: string;
  readonly icon: string;
  readonly displayOrder: number;
  readonly subModules: readonly MenuModule[];
  readonly pages: readonly MenuPage[];
}

/** Backend'in ApiResult<T> sarmalayıcısı. */
export interface ApiResult<T> {
  readonly isSuccess: boolean;
  readonly message: string;
  readonly result: T | null;
}
