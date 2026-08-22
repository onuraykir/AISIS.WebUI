import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';

import { environment } from '@env/environment';
import { ApiFailure, ApiResult } from '@core/api/api-result.model';

/**
 * Tüm uç noktaların ortak girişi.
 *
 * Tek işi `ApiResult` zarfını açmak: başarıda `result`'ı, başarısızlıkta
 * sunucunun kendi mesajını taşıyan bir {@link ApiFailure} döner. Böylece özellik
 * servisleri `isSuccess` kontrolü yazmak zorunda kalmaz.
 *
 * Ağ/sunucu hataları da aynı tipe indirgenir — çağıran taraf tek bir hata
 * biçimiyle uğraşır.
 */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);

  get<T>(path: string, params?: Record<string, string | number | boolean>): Observable<T> {
    return this.unwrap(this.http.get<ApiResult<T>>(this.url(path), { params: toParams(params) }));
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.unwrap(this.http.post<ApiResult<T>>(this.url(path), body));
  }

  put<T>(path: string, body: unknown): Observable<T> {
    return this.unwrap(this.http.put<ApiResult<T>>(this.url(path), body));
  }

  delete<T>(path: string): Observable<T> {
    return this.unwrap(this.http.delete<ApiResult<T>>(this.url(path)));
  }

  /**
   * Veri döndürmeyen komutlar için: yanıt gövdesindeki `message` çağırana verilir
   * ki ekran kullanıcıya sunucunun kendi ifadesini gösterebilsin.
   */
  command(request: Observable<ApiResult<unknown>>): Observable<string> {
    return request.pipe(
      map((response) => {
        if (!response.isSuccess) {
          throw new ApiFailure(response.message || 'İşlem tamamlanamadı.', 200);
        }
        return response.message;
      }),
      catchError((error: unknown) => throwError(() => toFailure(error))),
    );
  }

  /** Komut çağrıları için hazır yardımcılar (mesajı döner). */
  postCommand(path: string, body: unknown): Observable<string> {
    return this.command(this.http.post<ApiResult<unknown>>(this.url(path), body));
  }

  putCommand(path: string, body: unknown): Observable<string> {
    return this.command(this.http.put<ApiResult<unknown>>(this.url(path), body));
  }

  deleteCommand(path: string): Observable<string> {
    return this.command(this.http.delete<ApiResult<unknown>>(this.url(path)));
  }

  private url(path: string): string {
    return `${environment.apiUrl}/${path.replace(/^\//, '')}`;
  }

  private unwrap<T>(request: Observable<ApiResult<T>>): Observable<T> {
    return request.pipe(
      map((response) => {
        if (!response.isSuccess) {
          throw new ApiFailure(response.message || 'İşlem tamamlanamadı.', 200);
        }
        // Başarılı yanıtta result'ın dolu olması backend sözleşmesinin garantisi.
        return response.result as T;
      }),
      catchError((error: unknown) => throwError(() => toFailure(error))),
    );
  }
}

function toParams(params?: Record<string, string | number | boolean>): HttpParams | undefined {
  if (!params) {
    return undefined;
  }

  let httpParams = new HttpParams();
  for (const [key, value] of Object.entries(params)) {
    httpParams = httpParams.set(key, String(value));
  }
  return httpParams;
}

/**
 * Her hatayı tek biçime indirger.
 *
 * 400/404 yanıtlarının gövdesi de ApiResult olduğu için sunucunun mesajı
 * korunur; yalnızca gerçek ağ/sunucu çöküşlerinde genel metin kullanılır.
 */
function toFailure(error: unknown): ApiFailure {
  if (error instanceof ApiFailure) {
    return error;
  }

  if (error instanceof HttpErrorResponse) {
    const body = error.error as ApiResult<unknown> | string | null;

    if (body && typeof body === 'object' && typeof body.message === 'string' && body.message) {
      return new ApiFailure(body.message, error.status);
    }

    if (error.status === 0) {
      return new ApiFailure('Sunucuya ulaşılamadı. API çalışıyor mu?', 0);
    }

    return new ApiFailure(`Sunucu hatası (${error.status}).`, error.status);
  }

  return new ApiFailure('Beklenmeyen bir hata oluştu.', -1);
}
