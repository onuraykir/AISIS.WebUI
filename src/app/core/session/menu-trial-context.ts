/**
 * MENÜ DENEMESİ İÇİN geçici kimlik.
 *
 * `GET /api/Menu` kullanıcı ve birim ister; kimlik doğrulama henüz kurulmadı.
 * Değerler backend seed'iyle uyumludur: 1 = sistem.yonetici,
 * 3 = Bilgi İşlem Daire Başkanlığı.
 *
 * Kimlik doğrulama geldiğinde bu dosya SİLİNECEK; ikisi de UserContext'ten
 * okunacak ve uç noktanın imzası sadeleşecek.
 */
export const MENU_TRIAL_CONTEXT = {
  userId: 1,
  departmentId: 3,
} as const;
