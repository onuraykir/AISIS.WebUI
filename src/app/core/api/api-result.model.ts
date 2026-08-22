/**
 * Backend'in tek yanıt zarfı (AISIS.Common.Contract.ApiResult).
 *
 * HER uç nokta bu gövdeyi döner — başarıda da hatada da. HTTP durum kodu ayrıca
 * anlamlıdır (400/404), ama gövde her zaman aynı biçimdedir.
 */
export interface ApiResult<T = null> {
  readonly isSuccess: boolean;
  readonly message: string;
  readonly result: T | null;
}

/** Oluşturma komutlarının dönüşü: yalnızca yeni kaydın kimliği. */
export interface CreatedId {
  readonly id: number;
}

/** Seçim listeleri için en küçük ortak sözleşme. */
export interface IdName {
  readonly id: number;
  readonly name: string;
}

/**
 * Sunucudan gelen "işlem başarısız" durumunu taşıyan hata.
 *
 * Ağ hatasından (bağlantı yok, 500) ayrılır: bu, backend'in kuralı ihlal
 * ettiğimizi söylediği ve kullanıcıya AYNEN gösterilebilecek bir mesajdır.
 */
export class ApiFailure extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiFailure';
  }
}
