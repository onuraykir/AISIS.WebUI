/**
 * Oturumu açık personel.
 *
 * NOT: Şu an mock veriyle dolduruluyor (bkz. core/mocks/mock-session.ts).
 * Gerçek uçtan gelen alan adları netleşince bu arayüz ona göre güncellenecek.
 */
export interface CurrentUser {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly fullName: string;

  /** Ekranlarda avatar yerine kullanılan baş harfler, ör. 'OA'. */
  readonly initials: string;

  /** Akademik/idari ünvan, ör. 'Öğr. Gör.'. */
  readonly title: string;

  /** Sicil numarası. */
  readonly registryNo: string;

  /** Bağlı olduğu birim, ör. 'Bilgi İşlem Daire Başkanlığı'. */
  readonly unit: string;

  /** Uygulama içindeki yetki rolü, ör. 'Sistem Yöneticisi'. */
  readonly role: string;

  readonly email: string;
  readonly phone: string;

  /** Varsa profil fotoğrafı; yoksa `initials` gösterilir. */
  readonly avatarUrl?: string;

  readonly lastLoginAt: Date;
}

/** Üst barda ve bildirim panelinde gösterilen bildirim. */
export interface AppNotification {
  readonly id: string;
  readonly title: string;
  readonly detail: string;
  readonly createdAt: Date;
  readonly read: boolean;
  readonly severity: 'info' | 'success' | 'warn' | 'danger';
}
