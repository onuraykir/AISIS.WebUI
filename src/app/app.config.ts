import {
  ApplicationConfig,
  LOCALE_ID,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { registerLocaleData } from '@angular/common';
import localeTr from '@angular/common/locales/tr';

import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';

import { NavigationService } from '@core/services/navigation.service';
import { routes } from './app.routes';

// Tarih ve sayı formatlarının tr-TR olması için locale verisini kaydeder.
// Bu satır olmadan date ve number pipe'ları İngilizce formatlar (ör. 8/20/2026).
registerLocaleData(localeTr);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([]), withFetch()),

    // Menü ve ondan üretilen route'lar İLK YÖNLENDİRMEDEN ÖNCE yüklenir;
    // aksi halde derin bağlantı (deep link) 404'e düşerdi.
    // Hata durumunda uygulama yine açılır: menü boş kalır, sabit yollar çalışır.
    provideAppInitializer(() => inject(NavigationService).load()),

    // PrimeNG'nin overlay bileşenleri (dialog, select, datepicker, popover, toast)
    // animasyon sağlayıcısı olmadan sessizce açılmaz.
    provideAnimationsAsync(),

    { provide: LOCALE_ID, useValue: 'tr-TR' },

    providePrimeNG({
      theme: {
        preset: Aura,
        options: {
          // Varsayılan değer 'system'dir; bırakılırsa kullanıcının işletim sistemi
          // koyu temadaysa uygulama da koyu açılır. Kontrolü kendimizde tutuyoruz:
          // koyu tema istendiğinde <html> etiketine .app-dark sınıfı eklenir.
          darkModeSelector: '.app-dark',
          // Tailwind veya başka bir utility CSS eklenirse özgüllük savaşı yaşanmasın diye
          // PrimeNG stilleri kendi cascade layer'ına alınıyor.
          cssLayer: {
            name: 'primeng',
            order: 'theme, base, primeng',
          },
        },
      },
      ripple: true,
      translation: {
        dayNames: ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'],
        dayNamesShort: ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'],
        dayNamesMin: ['Pz', 'Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct'],
        monthNames: [
          'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
          'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
        ],
        monthNamesShort: [
          'Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz',
          'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara',
        ],
        today: 'Bugün',
        clear: 'Temizle',
        dateFormat: 'dd.mm.yy',
        firstDayOfWeek: 1,
        weekHeader: 'Hf',
        chooseYear: 'Yıl Seç',
        chooseMonth: 'Ay Seç',
        chooseDate: 'Tarih Seç',
        prevDecade: 'Önceki On Yıl',
        nextDecade: 'Sonraki On Yıl',
        prevYear: 'Önceki Yıl',
        nextYear: 'Sonraki Yıl',
        prevMonth: 'Önceki Ay',
        nextMonth: 'Sonraki Ay',
        prevHour: 'Önceki Saat',
        nextHour: 'Sonraki Saat',
        prevMinute: 'Önceki Dakika',
        nextMinute: 'Sonraki Dakika',
        prevSecond: 'Önceki Saniye',
        nextSecond: 'Sonraki Saniye',
        am: 'ÖÖ',
        pm: 'ÖS',

        accept: 'Evet',
        reject: 'Hayır',
        choose: 'Seç',
        upload: 'Yükle',
        cancel: 'İptal',
        completed: 'Tamamlandı',
        pending: 'Bekliyor',

        emptyMessage: 'Kayıt bulunamadı',
        emptyFilterMessage: 'Sonuç bulunamadı',
        emptySelectionMessage: 'Seçili kayıt yok',
        emptySearchMessage: 'Sonuç bulunamadı',
        searchMessage: '{0} sonuç bulundu',
        selectionMessage: '{0} kayıt seçildi',
        fileSizeTypes: ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],

        // Tablo / kolon filtre menüsü
        matchAll: 'Tümü',
        matchAny: 'Herhangi biri',
        addRule: 'Kural Ekle',
        removeRule: 'Kuralı Kaldır',
        apply: 'Uygula',
        startsWith: 'İle başlar',
        contains: 'İçerir',
        notContains: 'İçermez',
        endsWith: 'İle biter',
        equals: 'Eşittir',
        notEquals: 'Eşit değildir',
        noFilter: 'Filtre yok',
        lt: 'Küçüktür',
        lte: 'Küçük veya eşittir',
        gt: 'Büyüktür',
        gte: 'Büyük veya eşittir',
        is: 'Şudur',
        isNot: 'Şu değildir',
        before: 'Öncesi',
        after: 'Sonrası',
        dateIs: 'Tarih',
        dateIsNot: 'Tarih değil',
        dateBefore: 'Tarihinden önce',
        dateAfter: 'Tarihinden sonra',

        // Şifre gücü göstergesi
        weak: 'Zayıf',
        medium: 'Orta',
        strong: 'Güçlü',
        passwordPrompt: 'Şifre giriniz',

        // Erişilebilirlik (ekran okuyucu) metinleri
        aria: {
          trueLabel: 'Evet',
          falseLabel: 'Hayır',
          nullLabel: 'Seçili değil',
          star: '1 yıldız',
          stars: '{star} yıldız',
          selectAll: 'Tüm kayıtlar seçildi',
          unselectAll: 'Tüm kayıtların seçimi kaldırıldı',
          close: 'Kapat',
          previous: 'Önceki',
          next: 'Sonraki',
          navigation: 'Gezinme',
          scrollTop: 'Yukarı Kaydır',
          moveTop: 'En Üste Taşı',
          moveUp: 'Yukarı Taşı',
          moveDown: 'Aşağı Taşı',
          moveBottom: 'En Alta Taşı',
          moveToTarget: 'Hedefe Taşı',
          moveToSource: 'Kaynağa Taşı',
          moveAllToTarget: 'Tümünü Hedefe Taşı',
          moveAllToSource: 'Tümünü Kaynağa Taşı',
          pageLabel: '{page}. sayfa',
          firstPageLabel: 'İlk Sayfa',
          lastPageLabel: 'Son Sayfa',
          nextPageLabel: 'Sonraki Sayfa',
          prevPageLabel: 'Önceki Sayfa',
          rowsPerPageLabel: 'Sayfa başına kayıt',
          previousPageLabel: 'Önceki Sayfa',
          jumpToPageDropdownLabel: 'Sayfaya Git',
          jumpToPageInputLabel: 'Sayfaya Git',
          selectRow: 'Satır seçildi',
          unselectRow: 'Satır seçimi kaldırıldı',
          expandRow: 'Satır genişletildi',
          collapseRow: 'Satır daraltıldı',
          showFilterMenu: 'Filtre menüsünü göster',
          hideFilterMenu: 'Filtre menüsünü gizle',
          filterOperator: 'Filtre operatörü',
          filterConstraint: 'Filtre kısıtı',
          editRow: 'Satırı düzenle',
          saveEdit: 'Değişikliği kaydet',
          cancelEdit: 'Düzenlemeyi iptal et',
          listView: 'Liste görünümü',
          gridView: 'Tablo görünümü',
          slide: 'Slayt',
          slideNumber: '{slideNumber}. slayt',
          zoomImage: 'Görseli büyüt',
          zoomIn: 'Yakınlaştır',
          zoomOut: 'Uzaklaştır',
          rotateRight: 'Sağa döndür',
          rotateLeft: 'Sola döndür',
        },
      },
    }),
  ],
};
