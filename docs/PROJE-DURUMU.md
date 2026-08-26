# AISIS — Proje Durumu ve Devir Notu

> Bu belge, 21–22 Ağustos 2026 oturumunda yapılan işin tamamını ve devam edecek
> oturumun ihtiyaç duyacağı bağlamı içerir. Yeni bir oturuma başlarken önce bunu okuyun.

---

## 1. Projeler ve konumları

| | Yol |
|---|---|
| **Frontend** | `c:\Users\OnurAykır\source\repos\AISIS.WebUI` (Angular 20, kendi git deposu) |
| **Backend** | `c:\Users\OnurAykır\source\repos\onuraykir\AuthenticationSolution` (.NET 9, **ayrı** git deposu) |

`AuthenticationSolution.sln` beş proje içerir: `AISIS.WebApi`, `AISIS.BusinessLogicLayer`,
`AISIS.DataAccessLayer`, `AISIS.Common`, `AISIS.ExcelReader`.

**AISIS nedir:** Çankaya Üniversitesi için **program çıktısı / akreditasyon değerlendirme
sistemi** (ABET tarzı). Öğrenci işleri sistemi DEĞİLDİR. Alan kavramları: `ProgramOutcome`,
`CourseOutcome`, `ProgramOutcomeThreshold`, `AssessmentActivity`, `ActivityItem`,
`StudentActivityScore`, iki fazlı Excel içe aktarım (blueprint → scores), çıktı hesabı
ve dönem/öğrenci raporları.

### Çalıştırma

```
# Backend — https profiliyle başlatılmalı (7034); yalnızca http (5110) ile proxy ECONNREFUSED verir
dotnet run --project AISIS.WebApi --launch-profile https

# Frontend
npx ng serve --port 4300      # 4200 başka bir projede (Hsys-Web) kullanılıyor
```

`proxy.conf.json` → `/api` istekleri `https://localhost:7034` adresine gider; CORS gerekmez.

---

## 2. Yapılanlar

### 2.1 Frontend kabuğu (layout)

- **Üst bar**: hamburger + Çankaya logosu, sağ uçta global arama (Ctrl+K), tema anahtarı,
  bildirim paneli, kullanıcı paneli (klasik açılır pencere, çıkış dahil).
- **İnce bar**: breadcrumb'ın son halkası sayfa başlığıdır (ayrı başlık şeridi yok),
  favori yıldızı. İnce barın altına `sticky` gölge ile içerik bağlanır.
- **Sol menü**: çok seviyeli klasör ağacı, daraltılabilir (tercih `localStorage`),
  aktif klasör kendiliğinden açılır, altta telif ve sürüm satırı. Menü boşsa
  listenin kendi alanında durum bloğu çıkar (bkz. §2.5).
- **Giriş ekranı** kabuğun dışında, `/giris` — tasarımı henüz yapılmadı (yer tutucu).
- **Palet**: logodan türetildi. Marka sarısı `#FFED00` yalnızca vurgu; kabuk sıcak antrasit
  `#191714`, içerik sıcak nötr (`--app-content-bg: #e5e3d9`, yüzey `#f7f6f1`).
  PrimeNG yüzey token'ları (`--p-content-background` vb.) `:root`'ta ezildi — PrimeNG
  teması `@layer primeng` içinde olduğu için katmansız bildirimlerimiz her koşulda kazanır.

### 2.2 Backend — yetkilendirme yapısı (Faz 1–6)

Şema:

```
Module ─┐  (ParentModuleId = null → ANA MODÜL, ağaç en fazla 2 seviye)
        └─< Module (alt modül)
              └─< Page ─< PageOperation ─< OperationAction >─ ActionDefinition
                 (menü yaprağı) (iş fonksiyonu) (yetkinin birimi)  (ortak eylem havuzu)

UserGroup ─< UserGroupModule >──── Module       ← KAPSAM: NE (yalnız ana modül)
UserGroup ─< UserGroupDepartment >─ Department  ← KAPSAM: NEREDE
UserGroup ─< GroupRoles >─ Role ─< RolePermission >─ OperationAction  ← İZİN

UserInGroup (UserId, GroupId, DepartmentId) ── bileşik FK ──> UserGroupDepartment
```

Veritabanında garanti altına alınanlar:
- `CK_Module_Level_Parent`, `CK_Module_Root_Self` — ağaç derinliği ve kök tutarlılığı
- `CK_Page_Module_Root_Together` — sayfa ya havuzda (ikisi null) ya yerleşik (ikisi dolu)
- `CK_OperationAction_Endpoint_Method_Together`, `CK_OperationAction_HttpMethod`
- `CK_UserGroupModule_RootOnly` + `(ModuleId, ModuleLevel)` → `Module(Id, Level)` bileşik FK
  — gruba yalnızca ana modül bağlanabilir
- `UserInGroup(GroupId, DepartmentId)` → `UserGroupDepartment` bileşik FK
  — kullanıcı, grubunun yetkili olmadığı birime atanamaz
- Tüm unique index'ler `[IsDeleted] = 0` filtreli

**Seed** (`DbSeeds/AuthorizationSeed.cs`, `HasData`): 3 birim, 10 eylem tanımı,
10 modül, 20 sayfa, 33 sayfa işlemi ve eylemleri, 4 rol, rol izinleri kural ile
üretiliyor ve **bir gizli süper kullanıcı**. Örnek kullanıcı / grup / üyelik YOK —
bunlar kuruma özel verilerdir, süper kullanıcı kendi ekranlarından açar (§3.6).
Yönetim ekranlarının kendi uç noktaları da seed'de tanımlı — sistem kendi kendini
yönetiyor. Ayrıntı: §3.5.

### 2.3 Backend — yönetim uçları (Faz 7)

`Services/AuthorizationComponent/` altında **Queries/** ve **Commands/** ayrı:

| Controller | Kapsam |
|---|---|
| `MenuController` | `GET api/Menu?userId=&departmentId=` — izinli menü ağacı |
| `ModuleAdminController` | tree · roots · CRUD · move · reorder |
| `PageAdminController` | catalog(±havuz) · by-module · CRUD · placement · reorder |
| `OperationAdminController` | eylem havuzu CRUD/reorder · uç nokta listesi · sayfa işlemleri · işlem eylemleri |
| `RoleAdminController` | roller CRUD + eylem yetki matrisi + replace |
| `UserGroupAdminController` | gruplar CRUD + modules/departments/roles (replace) + üyelik + lookups |

DI tek satır: `builder.Services.AddAuthorizationComponent()`.

### 2.4 Frontend — yönetim ekranları (Faz 7)

`features/admin/` altında beş ekran, hepsi aynı kalıpta
(`data-access/` → models · api · store, `ui/` → salt sunum, akıllı sayfa bileşeni):

1. **Modül Ağacı** (`/sistem/modul-agaci`) — ağaç + künye paneli, taşıma, sıralama
2. **Sayfa Kataloğu** (`/sistem/sayfa-katalogu`) — havuz/yerleşik gruplama, yerleştirme
3. **İşlem Kataloğu** (`/sistem/islem-katalogu`) — eylem havuzu + sayfanın işlemleri +
   her işlemin eylemleri, HTTP metodu rozetleri (bkz. §3.5)
4. **Roller** (`/sistem/rol`) — modül→sayfa→işlem→eylem matrisi, **taslak** üzerinde
   çalışır, replace ile kaydeder
5. **Kullanıcı Grupları** (`/sistem/kullanici-grubu`) — üç kapsam bölümü (ayrı ayrı kaydedilir) + üyelikler

Ortak parçalar: `features/admin/shared/` (`admin-toolbar`, `name-dialog`, `code-name-dialog`),
`src/styles/_admin.scss` (stats, board, row, state, detail paneli, pane başlığı).

### 2.5 Menü artık API'den (Faz 8 — deneme)

- `core/api/menu.api.ts` → `GET /api/Menu`
- `NavigationService.load()` uygulama başlarken **`provideAppInitializer`** ile çağrılır;
  böylece route'lar ilk yönlendirmeden önce yerinde olur (derin bağlantı çalışır).
- Menü yanıtı sayfa başına `operations: [{ code, name, actions }]` taşır (§3.5).
- `core/routing/menu-route-registrar.ts` menü yanıtını router yapılandırmasına çevirir;
  `core/routing/implemented-pages.ts` **kodda kalan tek bağdır** (adres → bileşen).
- API yoksa uygulama açılmaya devam eder: menü boş, sabit yollar çalışır,
  durum `idle | loaded | failed` olarak menü alanında ve ana sayfada görünür.
- Menü **yalnızca açılışta bir kez** çekiliyor. Backend geç ayağa kalkarsa menü boş
  kalır ve kendiliğinden tekrar denenmez. Bunun yerine **menü listesinin kendi
  alanında** bir boş durum bloğu var (`nav__state`): üç sebebi ayırıyor —
  yükleniyor / alınamadı / görüntülenecek sayfa yok — ve son ikisinde
  "Yeniden dene" düğmesi sunuyor. Ana sayfadaki hata kutusunda da aynı düğme var.
  `NavigationService.load()` eşzamanlı çağrıya karşı korumalı. Otomatik yeniden
  deneme bilerek yok: "sunucu yok" durumu maskelenmemeli.

---

## 3. Mimari kararlar (bunlara uyulacak)

1. **Command / Query ayrımı** — okuma ve yazma servisleri ayrı sınıflarda, ayrı klasörlerde.
   Komutlar okuma modeli dönmez; `Create*` yalnızca `CreatedIdDto` döner.
2. **Her uç noktanın gövdesi `ApiResult`/`ApiResult<T>`**, imzada da tipli
   (`ActionResult<ApiResult<T>>`). Düz string dönen dal yok. HTTP durum kodu korunur.
3. **Değişmezler `Rules/` altında tek yerde** (`ModuleTreeRules`, `PageRules`,
   `ProcessRules`, `UserGroupRules`). Aynı kural veritabanında da vardır; oradaki son
   savunma hattı, buradaki kullanıcıya anlaşılır mesaj vermek için.
4. **Doğrulama servis içinde** (FluentValidation + `ValidationGuard`), MVC filtresinde değil —
   servis başka yerden çağrıldığında da kurallar işlesin diye.
5. **Çok satırlı işlemler açık transaction'da** (taşıma, sıralama, replace).
6. **Kapsam ve izin listeleri replace semantiğinde** — ekran kümenin tamamını gönderir,
   farkı sunucu hesaplar; eşzamanlı düzenlemede kaybolan kutucuk olmaz.
7. **FE'de iki model ayrı**: API sözleşmesi (`MenuModule`, `PageListItem`…) ve görünüm
   modeli (`NavItem`). Arada tek bir dönüştürücü var.
8. **FE katman sınırları**: `*.api.ts` yalnızca HTTP; `*.store.ts` durum + hata mesajı;
   `ui/` bileşenleri veri almaz, olay yayar. Store'lar **bileşen seviyesinde** sağlanır.
9. **İyimser güncelleme yok** — sunucudaki kuralları istemcide tekrar etmek yerine
   yazma sonrası tazelenir.
10. **Yetki iki yerde birden** denetlenir: arayüzde `*appHasAction` düğmeyi hiç basmaz,
    sunucuda `OperationAction.Endpoint` + `HttpMethod` isteği durdurur. Düğme gizlemek
    güvenlik değildir.
11. **Uç nokta elle yazılmaz**: yetkilendirilen adres uygulamanın ApiExplorer
    listesinden seçilir. Elle yazılan bir rota hiçbir isteği eşleştirmez ve yetkiyi
    sessizce boşa düşürür.

---

## 3.5 Action katmanı (Faz 9 — UYGULANDI)

> 22 Ağustos 2026'da uygulandı. Bu bölüm artık bir karar değil, yürürlükteki yapının
> tarifidir.

### Neden gerekti

Yetkinin birimi `PageProcess` (sayfa + işlem) idi ve bu bağ **tek** uç nokta tutuyordu.
Üç şey kırılıyordu:

- Çok adımlı işler eşlenemiyordu: `blueprint/parse` + `blueprint/confirm` ikisi birden
  `IMPORT`'un altına sığmıyordu.
- İkincil uçlar (`reorder`, `placement`, `move`) yerini bulamıyordu.
- Aynı sayfadaki farklı iş fonksiyonları ayrışamıyordu: "Çıktı Yönetimi"nde ekleme
  yetkisi verip "Eşik Yönetimi"nde vermemek mümkün değildi.

### Yürürlükteki yapı

Sayfanın altında **iki seviye** var ve yetki en alttakine veriliyor:

```
Module → SubModule → Page → PageOperation (İŞLEM) → OperationAction (EYLEM)
                                                          ▲
                                                    yetki burada verilir
```

| Seviye | Nedir | Örnek | Nereden gelir |
|---|---|---|---|
| **PageOperation** | Sayfadaki iş fonksiyonu | "Çıktı Yönetimi", "Eşik Yönetimi" | Sayfaya özel, serbest tanımlanır |
| **OperationAction** | O işlemin bir eylemi + uç noktası | "Ekle" → `POST api/ProgramOutcome/create-program-outcome` | Ortak havuzdan (`ActionDefinition`) seçilir |

Uç nokta ve HTTP metodu `OperationAction`'dadır; her eylem tam olarak bir uca karşılık
gelir. `parse`/`confirm` ayrı eylemlerdir, ek bir tabloya gerek kalmamıştır.

### Şema

| Tablo | Not |
|---|---|
| `ActionDefinition` | Ortak eylem havuzu. `ProcessDefinition`'ın yerini aldı, satırlar aynı (VIEW, CREATE…). |
| `PageOperation` | Id, PageId, Code, Name, Description, DisplayOrder, IsActive |
| `OperationAction` | Id, PageOperationId, ActionDefinitionId, Endpoint?, HttpMethod?, DisplayOrder, IsActive |
| `RolePermission` | `OperationActionId`'ye bağlanır |
| `Page.Operations` | `PageProcesses`'in yerini aldı |

`PageProcess` **kaldırıldı**; uyumluluk şimi bırakılmadı.

Kısıtlar:
- `PageOperation`: `(PageId, Code)` unique (filtreli), `(PageId, DisplayOrder)` index
- `OperationAction`: `(PageOperationId, ActionDefinitionId)` unique (filtreli),
  `(Endpoint, HttpMethod)` **non-unique** index — aynı uç birden fazla yerden
  kullanılabilir; eşleşenlerden herhangi birine yetkisi olan geçer
- `CK_OperationAction_Endpoint_Method_Together`, `CK_OperationAction_HttpMethod`
- Yetki yalnızca **yerleştirilmiş** sayfanın eylemine verilebilir (`RootModuleId IS NOT NULL`)

### Uç noktalar controller'lardan okunuyor

`IApiEndpointCatalog` (BLL sözleşmesi) → `ApiExplorerEndpointCatalog` (WebApi
gerçekleştirimi, `IApiDescriptionGroupCollectionProvider` üzerinden). `GET
api/OperationAdmin/endpoints` uygulamanın **gerçek** rotalarını ve her birinin kaç
eyleme bağlı olduğunu döner.

Sonuç: yönetim ekranında adres **elle yazılmaz**, listeden seçilir. Yanlış yazılan bir
rota hiçbir isteği eşleştirmez ve yetkiyi sessizce boşa düşürürdü. "Eşlenmemiş uç"
sayacı da buradan geliyor — hangi adresin hâlâ yetkilendirilmediği görünür.

Bu, bileşenin WebApi katmanına olan **tek** bağımlılığıdır; kaydı `Program.cs`'te
tek satırdır (`AddAuthorizationComponent` dışında).

### Sayfanın işlem → eylem ağacı nereden gelir

`PageAdmin/catalog` yanıtında: `PageListItemDto.Operations`. Ayrı bir "board" ucu
**yok** — aynı ağacı iki uçtan döndürmek iki farklı tazelik hâli demek olurdu.
İşlem Kataloğu ekranı zaten sol listesi için tüm sayfa kataloğunu çekiyor; sağ bölme
aynı veriden besleniyor.

`OperationAdmin` yalnızca sözlüğü, uç nokta listesini ve **yazma** uçlarını taşır.

### İşlemi kim tanımlar

Yönetici. `PageOperation` sayfanın bir bölümüdür: "Grid İşlemleri", "Eşik Yönetimi",
"Şablon İçe Aktarım". Altına ortak sözlükten Görüntüle / Ekle / Güncelle / Sil
eylemleri bağlanır.

Arayüz tarafındaki karşılığı doğrudan budur: sayfa açıldığında menüden gelen
`operations` listesiyle her bölümün düğmeleri kendi işlem koduna göre basılır —
`*appHasAction="'CREATE'; operation: 'GRID'"`.

### Menü sözleşmesi

```
MenuPageDto {
  id, name, route, icon, displayOrder,
  operations: [ { code, name, actions: ["VIEW", "CREATE"] } ]
}
```

**Sayfa görünürlük kuralı:** sayfa menüde görünür ⟺ **herhangi bir işleminde** `VIEW`
yetkisi var.

### Backend dosyaları

| | |
|---|---|
| Entity | `ActionDefinition`, `PageOperation`, `OperationAction` |
| Mapping | `ActionDefinitionMapping`, `PageOperationMapping`, `OperationActionMapping` |
| Kurallar | `Rules/OperationRules.cs` (`ProcessRules` yerine) |
| Servis | `OperationQueryService` / `OperationCommandService` |
| Controller | `OperationAdminController` — catalog · endpoints · operation/{id} · action/{id} |
| Doğrulayıcı | `OperationValidators.cs` |

### Frontend

- `core/models/menu.model.ts` → `ActionCode`, `MenuOperation`, `MenuPage.operations`
- `PermissionService.can(action, operationCode?, route?)` — işlem verilmezse
  "herhangi bir işlemde bu eylem var mı" diye bakar
- `shared/directives/has-action.ts`:
  `*appHasAction="'CREATE'"` ve `*appHasAction="'CREATE'; operation: 'THRESHOLD'"`
  (`has-process.ts` silindi)
- **İşlem Kataloğu** (`features/admin/operation-catalog/`) **sayfa merkezli**: solda
  sayfa listesi (modüle göre gruplu, `Hepsi / İşlemsiz / Havuz` süzgeci + arama),
  sağda seçili sayfanın işlem kartları. Her kartta eylem listesi ve "bağlanabilir
  eylemler" çip havuzu; çipe tıklayınca uç nokta seçtiren diyalog açılır.
  Ekranın okunuşu hiyerarşinin kendisidir: **sayfa → işlem → eylem**.
  Ortak eylem sözlüğü ana akışta DEĞİL, üst çubuktaki "Eylem Sözlüğü" diyaloğunda —
  on satırlık, yılda birkaç kez değişen bir tanım listesi günlük işin önüne geçmemeli.
- **Roller matrisi** dört seviyeli, seçim **eylem** seviyesinde: modül / sayfa / işlem /
  tek eylem. Üstteki üç kutucuk yalnızca toplu seçim kısayolu; kısmi durum her seviyede
  ayrı gösterilir. Taslak mantığı korundu, `operationActionIds` ile replace edilir.
- **Sayfa Kataloğu** künyesinde işlem → eylem ağacı ve uç noktaları görünür;
  sayaçlar `operationCount` / `actionCount` / `unmappedActionCount`.
- Metot rozetleri (`GET`/`POST`/`PUT`/`PATCH`/`DELETE`/`UNAVAILABLE`) ve `.endpoint`
  satırı `src/styles/_admin.scss`'e taşındı — üç ekran birden kullanıyor.
- `features/admin/shared/code-name-dialog/` — "değişmez kod + ad + açıklama" formu;
  eylem tanımı ve sayfa işlemi aynı diyaloğu paylaşıyor.
- `operation-catalog/ui/action-dictionary-dialog` — salt sunum; sözlüğü listeler,
  komutları olay olarak yayar.

`UNAVAILABLE`: eylemin arkasında çağrılacak bir uç yok. İki hâli birden kapsar — salt
görünürlük yetkileri (`VIEW`) ve ucu henüz yazılmamış eylemler. Sunucudaki adres
eşleştirmesine girmezler; ikisi de gözden kaçmamalı diye rozetle işaretlenir.

### Seed

`AuthorizationSeed` sıfırdan kuruldu: 20 sayfa → **33 işlem** → eylemler, gerçek
controller rotalarıyla. `SeedIds` içinde `Act` bloğu ve iki türetici var
(`PageOperationId(pageId, index)`, `OperationActionId(operationId, actionId)`).

Örnek — Kullanıcı Grupları sayfası beş işleme ayrıldı (`GROUP`, `SCOPE_MODULE`,
`SCOPE_DEPARTMENT`, `GROUP_ROLE`, `MEMBERSHIP`); üç ayrı `ASSIGN` ucu eski yapıda
tek satıra sığmıyordu.

## 3.6 Süper kullanıcı ve şifre altyapısı (UYGULANDI)

> 23 Ağustos 2026. Kimlik doğrulamanın (Faz 2) ilk dilimi: şifre altyapısı ve süper
> kullanıcı. Login/JWT/refresh token **henüz yok**.

### Süper kullanıcı bir flag, rol değil

`User.IsSuperUser`. Yetki denetimini baştan geçer: menü tam ağacı döner, ileride
gelecek uç nokta eşleştirmesi aranmaz.

**Neden rol/grup değil:** bu bir *break-glass* hesabıdır ve **yönettiği verinin
doğruluğuna bağlı olmamalıdır**. Tüm roller silinse, grup kapsamı bozulsa veya bir
modül yanlışlıkla pasifleştirilse bile sisteme girilip düzeltilebilmelidir. Gruba
üye yapılsaydı, koruma yine yönetilen verinin doğru kalmasına bağlı olurdu — bu
yüzden seed'de süper kullanıcının **grubu, rolü ve üyeliği yoktur**.

`MenuQueryService.GetFullMenuAsync()` süper kullanıcıya her aktif modülü, sayfayı,
işlemi ve eylemi döner. Boş modüller de gelir: içini doldurabilmesi için görmesi gerekir.

### `User` alanları

| Eklendi | Kaldırıldı |
|---|---|
| `IsSuperUser`, `IsActive`, `MustChangePassword` | `Password` (düz metin) |
| `PasswordHash`, `PasswordSalt`, `PasswordAlgorithm` | |

`UserName` / `Email` unique index'leri `[IsDeleted] = 0` filtreli hâle getirildi
(proje kuralıydı, eksikti).

Yol haritasındaki `SecurityStamp`, `AccessFailedCount`, `LockoutEndUtc`,
`LastLoginAt` ve `RefreshToken` tablosu **bilerek eklenmedi**: kullanan kod
gelmeden kolon açmıyoruz. Login turunda gelecekler.

### Şifre hash'leme

`Pbkdf2PasswordHasher` — PBKDF2-HMAC-SHA256, **600.000 iterasyon**, 128-bit salt,
256-bit türev. BCL içinde (`Rfc2898DeriveBytes.Pbkdf2`), ek paket yok.

`PasswordAlgorithm` kolonu `PBKDF2-SHA256-600000` yazar; **iterasyon sayısı
etiketin parçasıdır**. Parametreler yükseltildiğinde eski satırlar kendi
etiketleriyle doğrulanmaya devam eder. Tanınmayan etiket sessizce geçmez, `false`
döner.

### İlk şifre: seed'de değil, ilk açılışta

Seed süper kullanıcıyı **şifresiz** kurar — yani giriş yapamaz. Şifre uygulamanın
ilk açılışında `SuperUser:InitialPassword` yapılandırmasından okunur
(`SuperUserInitializer`, `Program.cs`'ten bir kez çağrılır).

**Neden seed'de değil:** migration SQL'ine gömülen bir varsayılan şifre, depoyu
okuyan herkesin eline geçer ve migration geçmişinden hiç silinmez. Bu yolda sır
kaynak kodda hiç durmaz; her ortam kendi şifresini verir.

```
# Geliştirme
dotnet user-secrets set "SuperUser:InitialPassword" "..." --project AISIS.WebApi

# Canlı
SuperUser__InitialPassword=...
```

Kurulum **idempotent**: şifre bir kez yazıldıktan sonra bir daha dokunulmaz, aksi
halde her açılış kullanıcının kendi şifresini ezerdi. Yapılandırma yoksa hesap
şifresiz kalır ve açılışta uyarı loglanır — sessizce bir varsayılana düşmek,
"kurulumu unuttum" hâlini fark edilmez bir açığa çevirirdi.

Kurulan hesapta `MustChangePassword = true`: yapılandırmadaki şifre birden fazla
kişinin görebileceği bir yerde durur.

### Şifre değiştirme — oturum gerektirmez

`POST api/Account/change-password` → `{ userName, currentPassword, newPassword }`

Mevcut şifreyi bilmek kimliğin kendisidir; JWT beklemez. Login yazılmadan önce de
süper kullanıcı kendisine verilen ilk şifreyi değiştirebilsin diye böyle. Login
geldiğinde bu uç geçerliliğini korur.

Kullanıcı yok / şifre yanlış / hesap pasif dallarının **hepsi aynı mesajı** döner:
hangi kullanıcı adının var olduğu dışarıya sızmasın.

Kurallar `Rules/PasswordRules.cs`'te: en az 10 karakter, en fazla 128, baş/son
boşluk yok, yeni şifre eskisiyle aynı olamaz. Karmaşıklık kuralı yerine uzunluk
esas alındı — kural doldurmak için uydurulmuş kısa parolalar daha zayıf.

### Bilinen açık uçlar

- **Rate limiting yok.** Bu uç mevcut şifreyi doğruladığı için bir deneme yüzeyidir;
  login turunda lockout (`AccessFailedCount`, `LockoutEndUtc`) ve rate limit ile
  birlikte sertleştirilecek.
- **Koruma kuralları yazılmadı** (süper kullanıcı silinemez / pasifleştirilemez,
  son süper kullanıcının flag'i alınamaz). Bugün kullanıcıya dokunan bir ekran
  veya uç yok; çağıranı olmayan kural yazmadık. `/sistem/kullanici` ekranı
  yazıldığında `UserRules` ile birlikte gelecek.
- **K4 ile çakışma:** yol haritası `User.PersonId`'yi zorunlu + unique planlıyor.
  Süper kullanıcının `Person` kaydı yok. K4 uygulanırken `PersonId` nullable olmalı
  ve check constraint `IsSuperUser = 1 OR PersonId IS NOT NULL` konmalı.
- Frontend'de şifre değiştirme ekranı yok; uç Swagger'dan çağrılabilir. Giriş
  ekranıyla birlikte gelecek.

---

## 4. Açık işler

### 4.1 Hemen sıradakiler

- [x] **Tek başlangıç migration'ı üretildi ve uygulandı** (24 Ağustos).
      Eski dört migration ve veritabanı silindi; yerine
      `20260823210638_basics_initial_migration`: 41 tablo, tüm kısıtlar ve seed tek
      dosyada. Silinen `Faz0_SemaHijyeni`'de elle yazılmış SQL yoktu.

      > `has-pending-model-changes` / `migrations list` çağrılarını `--no-build` ile
      > çalıştırırsan derlenmiş **eski** derlemeyi okur ve olmayan bir kayma bildirir.
      > Önce `dotnet build AISIS.DataAccessLayer`.

- [x] **Süper kullanıcının şifresi kuruldu.** `AISIS.WebApi.csproj`'ye `UserSecretsId`
      eklendi; şifre user-secrets'tan okunup ilk açılışta hash'lendi. Log:
      *"Super kullanicinin ilk sifresi yapilandirmadan kuruldu."*

- [x] **Uçlar ilk kez gerçek veriye karşı denendi** (24 Ağustos). Hepsi geçti:

      | Uç | Sonuç |
      |---|---|
      | `GET /api/Menu?userId=1` | 5 ana modül, 20 sayfa, süper kullanıcı tam ağaç |
      | `GET /api/OperationAdmin/catalog` | 10 eylem tanımı |
      | `GET /api/OperationAdmin/endpoints` | 76 uç keşfedildi, 13'ü eşlenmemiş |
      | `GET /api/PageAdmin/catalog` | 20 sayfa, işlem → eylem ağacıyla |
      | `GET /api/ModuleAdmin/tree` | 5 ana modül |
      | `GET /api/RoleAdmin/1/permissions` | 20 sayfa · 33 işlem · 102 eylem, 102'si verilmiş |
      | `GET /api/UserGroupAdmin` | 0 kayıt (beklenen: seed'de grup yok) |
      | `POST /api/Account/change-password` | dört dal da doğru (aşağıda) |

      Şifre ucunun doğrulaması: yanlış şifre ve olmayan kullanıcı **aynı** genel
      mesajı döndü (kullanıcı adı sızdırmıyor); doğru şifre + kısa yeni şifre
      uzunluk kuralına düştü — yani PBKDF2 doğrulaması gerçek hash'e karşı çalışıyor.

- [ ] **Kimlik doğrulama — kalan kısım.** Şifre altyapısı ve süper kullanıcı
      yapıldı (§3.6). Kalan: JWT login, refresh token, lockout, `UserContext`.
      Bkz. `AuthenticationSolution/docs/AUTH-TASARIM-YOL-HARITASI.md`.
      Geldiğinde silinecek iki dosya: `core/session/menu-trial-context.ts` ve
      `core/session/auth-placeholder.ts`; `MenuController`'ın query parametreleri de kalkacak.
- [ ] **Yetki middleware'i**: gelen isteğin adres+metodunu `OperationAction` ile
      eşleştirip kullanıcının iznine bakan katman. Action katmanı geldiği için ikincil
      uçlar artık eşlenebiliyor; ek tabloya gerek yok. Kural: eşleşen eylemlerden
      **herhangi birine** yetkisi olan geçer. Eşleşmeyen (uçsuz) eylemler denetime
      girmez.
- [ ] **Giriş ekranı tasarımı** — şu an yer tutucu.

### 4.2 Ertelenmiş / eksik

- [ ] Liste ekranı araç çubuğu kalıbı (sayfa içi arama + kolon filtreleri + dışa aktar),
      ilk gerçek liste ekranıyla birlikte `shared/` altında kurulacak.
- [ ] `/sistem/kullanici` (Kullanıcılar) ekranı — controller'ı henüz yok, seed'de endpoint boş.
- [ ] Pano (dashboard) içerik ucu — ana sayfa şu an dürüst bir "bağlanmadı" ekranı.
- [ ] Bildirim ucu — zil boş.
- [ ] Akademik dönem / birim bağlam ucu — ince bardaki çipler bu yüzden kaldırıldı.
- [ ] Yönetim ekranlarındaki **"Örnek veriyle göster" demo modu kaldırıldı**
      (kapsam dışı bir temizlikti; Onur "böyle kalsın" dedi). Geri istenirse
      5 store + 5 şablon + 5 demo dosyası yeniden yazılacak.

---

## 5. Yaşanan ve çözülen tuzak: mapping'te `override` unutmak

Migration uygulanırken alınan hata:

```
Introducing FOREIGN KEY constraint 'FK_AssessmentActivityInCourseOutcomes_CourseOutcomes_CourseOutcomeId'
on table 'AssessmentActivityInCourseOutcomes' may cause cycles or multiple cascade paths.
```

**Sebep:** `AssessmentActivityInCourseOutcomeMapping` sınıfı `AISISBaseEntityMapping<T>`'den
türüyordu ama `Configure` metodunda **`override` yoktu**. Metot base'i yalnızca *gizliyor*;
EF ise arayüz (`IEntityTypeConfiguration`) üzerinden **base'in** `Configure`'unu çağırıyor.
Sonuç: o dosyadaki hiçbir ayar uygulanmıyordu — `CourseOutcome` için yazılan `Restrict` de.
EF varsayılan `Cascade`'i kullandı ve `Course → AssessmentActivity → bu tablo` ile
`Course → CourseOutcome → bu tablo` iki cascade yolu oluştu.

Derleme bunu **CS0114** uyarısıyla zaten söylüyordu.

**Çözüm:** `override` + `base.Configure(builder)` (Id birincil anahtar, kardeş join tablosu
`ActivityItemInCourseOutcome` ile aynı kalıp) + bileşik anahtar yerine
`(AssessmentActivityId, CourseOutcomeId)` üzerinde filtreli unique index.

**Ders:** Bir mapping `AISISBaseEntityMapping<T>`'den türüyorsa `Configure` **override**
olmalı. Doğrudan `IEntityTypeConfiguration<T>` uygulayan mapping'lerde (`GroupRoles`,
`UserInGroup`, `UserGroupModule`, `UserGroupDepartment`) `public void` doğrudur.
Kontrol: `grep -rl "public void Configure" DbMappings` → çıkanların hepsi arayüzü
doğrudan uygulamalı.

---

## 6. Küçük ama unutulmaması gerekenler

- `Module` sınıf adı `System.Reflection.Module` ile çakışabilir; şu an sorun yok.
- Bileşen stili bütçesi **4 kB** (uyarı) / 8 kB (hata). Uyarı çıkarsa genellikle
  duplikasyon işaretidir → `src/styles/_admin.scss`'e taşıyın. HTTP metodu rozetleri
  (`.method--*`) ve `.endpoint` satırı bu yüzden zaten orada.
- PrimeNG v20'de `styleClass` kullanımdan kalktı; `class` kullanın. Ancak `p-popover`
  içeriği `<body>`'ye taşındığı için onun stilleri **global** olmak zorunda.
- Kod yorumları .cs dosyalarında **ASCII Türkçe** (diakritiksiz) yazılıyor; markdown ve
  görünen metinlerde tam Türkçe.
- Backend `dotnet ef dbcontext info --project AISIS.DataAccessLayer --startup-project
  AISIS.DataAccessLayer --no-build` ile model doğrulanabiliyor (DB'ye dokunmaz).
