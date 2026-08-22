import { AppEnvironment } from './environment.model';

/**
 * Üretim ortamı (ng build --configuration production).
 *
 * apiUrl'i dağıtım şeklinize göre ayarlayın:
 *
 *  1) Angular çıktısı API ile AYNI sunucuda sunuluyorsa
 *     (dist klasörü AISIS.WebApi/wwwroot içine kopyalanıyorsa):
 *       apiUrl: '/api'      -> göreli kalsın, CORS gerekmez
 *
 *  2) Angular AYRI bir sunucuda (IIS/nginx) ise:
 *       apiUrl: 'https://aisis-api.kurum.gov.tr/api'
 *     Bu durumda backend'de CORS açılmalı:
 *       builder.Services.AddCors(...);  app.UseCors("AngularPolicy");
 *
 * Controller'ların tamamı [Route("api/[controller]")] kullandığı için '/api'
 * öneki hem geliştirmede hem üretimde aynı şekilde çalışır; proxy tarafında
 * yol yeniden yazma (pathRewrite) gerekmez.
 */
export const environment: AppEnvironment = {
  production: true,
  apiUrl: '/api',
};
