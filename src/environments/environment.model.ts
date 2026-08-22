/**
 * Ortam ayarlarının sözleşmesi.
 *
 * environment.ts ve environment.development.ts bu arayüzü uygular; böylece
 * birine alan eklenip diğerine eklenmediğinde derleme hatası alınır.
 */
export interface AppEnvironment {
  /** Üretim derlemesi mi? Log seviyesi, debug panelleri vb. için. */
  readonly production: boolean;

  /**
   * API kök adresi. Sonunda eğik çizgi OLMAMALI.
   * Servislerde `${environment.apiUrl}/Numune/Liste` şeklinde kullanılır.
   */
  readonly apiUrl: string;
}
