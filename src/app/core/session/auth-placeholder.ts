import { CurrentUser } from '@core/models/current-user.model';

/**
 * KİMLİK DOĞRULAMA YER TUTUCUSU — menü denemesinin ikinci yarısı.
 *
 * Uygulamanın kabuğu (üst bar, menü, yetki denetimi) oturum açmış bir kullanıcı
 * olmadan hiç açılmaz; giriş ekranı da bağlanacak bir uç bulamaz. Bu yüzden
 * menü denemesi süresince tek bir kimlik burada duruyor.
 *
 * Değerler backend seed'indeki 1 numaralı kullanıcıyla — gizli süper kullanıcı —
 * uyumludur (bkz. MENU_TRIAL_CONTEXT). Kimlik doğrulama kurulduğunda bu dosya SİLİNECEK.
 */
export const AUTH_PLACEHOLDER_USER: CurrentUser = {
  id: '1',
  firstName: 'Sistem',
  lastName: 'Kullanıcısı',
  fullName: 'Sistem Kullanıcısı',
  initials: 'SK',
  title: '—',
  registryNo: '—',
  unit: 'Bilgi İşlem Daire Başkanlığı',
  role: 'Süper Kullanıcı',
  email: 'sistem@cankaya.edu.tr',
  phone: '—',
  lastLoginAt: new Date(),
};
