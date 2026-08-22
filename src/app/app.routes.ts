import { Routes } from '@angular/router';

import { authGuard } from '@core/guards/auth.guard';
import { placeholderLoader } from '@core/routing/implemented-pages';

const HOME_PATH = 'ana-sayfa';

/**
 * Menüde görünmeyen, kullanıcı panelinden açılan sayfalar.
 * Yetkiye tabi değiller; adresleri kodda sabittir.
 */
const accountRoutes: Routes = [
  { path: 'profil', title: 'Profilim' },
  { path: 'ayarlar', title: 'Hesap Ayarları' },
  { path: 'sifre-degistir', title: 'Şifre Değiştir' },
  { path: 'yardim', title: 'Yardım ve Destek' },
].map((entry) => ({
  path: entry.path,
  data: { title: entry.title },
  loadComponent: placeholderLoader,
}));

/**
 * SABİT yollar. Menüden gelen sayfa adresleri buraya çalışma anında eklenir
 * (bkz. core/routing/menu-route-registrar.ts) — kodda gömülü bir menü yoktur.
 */
export const routes: Routes = [
  // Giriş ekranı kabuğun DIŞINDA: kendi tam ekran yerleşimi var.
  {
    path: 'giris',
    loadComponent: () => import('@features/auth/login').then((m) => m.Login),
  },

  // Uygulama kabuğu: üst bar + ince bar + sol menü.
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('@layout/shell/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: HOME_PATH },

      // Ana sayfa menüde YOK: yetkiye tabi bir ekran değil, herkesin açılış sayfası.
      {
        path: HOME_PATH,
        data: { title: 'Ana Sayfa' },
        loadComponent: () => import('@features/dashboard/dashboard').then((m) => m.Dashboard),
      },

      ...accountRoutes,

      // Menüden üretilen route'lar bu satırdan ÖNCE araya eklenir.
      {
        path: '**',
        loadComponent: () => import('@features/not-found/not-found').then((m) => m.NotFound),
      },
    ],
  },
];
