import { AppEnvironment } from './environment.model';

/**
 * Geliştirme ortamı (ng serve).
 *
 * apiUrl bilinçli olarak GÖRELİ: istekler önce Angular dev sunucusuna gider,
 * proxy.conf.json onları https://localhost:7034 adresine yönlendirir.
 * Böylece tarayıcı açısından her şey aynı origin'dedir ve CORS devreye girmez —
 * backend'in Program.cs dosyasında CORS yapılandırması bulunmadığı için bu şart.
 *
 * Backend'i https profiliyle başlatın; yalnızca http (5110) ile çalıştırılırsa
 * 7034 dinlenmez ve proxy ECONNREFUSED verir.
 */
export const environment: AppEnvironment = {
  production: false,
  apiUrl: '/api',
};
