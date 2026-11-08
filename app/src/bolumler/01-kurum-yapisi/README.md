# Bölüm 01 · Kurum yapısı ve tanımlar

Gereksinim: [`docs/bolumler/01-kurum-yapisi-ve-tanimlar.md`](../../../../docs/bolumler/01-kurum-yapisi-ve-tanimlar.md)

## Amaç
Sistemin geri kalanının dayandığı temel tanımları yönetir: kurum bilgileri, şubeler, sezonlar, gruplar,
dersler, derslikler, ders saatleri, (Finans açıksa) fiyat listesi ve modül anahtarları.
Kayıt, yoklama, ders programı, finans gibi bölümler bu tanımları okur.

## Dosyalar
| Dosya | İçerik |
|---|---|
| `index.tsx` | Sekmeli sayfa kabuğu (default export `KurumYapisi`, `main.tsx` buradan içe aktarır) |
| `kurallar.ts` | **Saf iş kuralları** (doğrulama, sezon geçişi planı, ders saati sıralama…). React'e ve `@/` takma adına bağlı değildir; sunucu da aynı dosyayı kullanır |
| `ortak.tsx` | Ortak ekran yardımcıları: `useGenel`, `useSubeTanimYazar`, `SadeceGenel`, `HataMetni`, `tarihGoster` |
| `KurumBilgileri.tsx` | Kurum adı, e-posta, vergi no, logo, makbuz başlığı |
| `Subeler.tsx` | Şube kartları, pasife alma, yeni şube sihirbazı (derslik/ders saati kopyalama) |
| `Sezonlar.tsx` | Sezon listesi, sezon ekleme, aktif sezon seçimi, yeni sezona geçiş sihirbazı |
| `Gruplar.tsx` | Aktif sezonun grupları, grup ekleme/düzenleme |
| `Dersler.tsx` | Ders listesi, renk, aktif/pasif, yeni ders |
| `Derslikler.tsx` | Şubeye özel derslikler, kapasite, pasife/aktife alma, silme |
| `DersSaatleri.tsx` | Şubeye özel hafta içi / hafta sonu dilimleri, pasife/aktife alma, silme |
| `FiyatListesi.tsx` | Şube bazında liste fiyatı (yalnızca Finans modülü açıkken) |
| `Moduller.tsx` | Modül aç/kapat |
| `kurallar.test.ts` | Saf kuralların birim testleri |
| `sunucu.test.ts` | Sunucu tarafı denetimin (`server/politika.ts`) testleri |

Sunucu tarafı: `server/politika.ts` içindeki `tanimDenetle()` her `/api/degisiklik` isteğinde
`yazmaDenetle()` sonunda çalışır ve aşağıdaki kuralları ekrandan bağımsız olarak yeniden uygular.
Kural ihlali `YetkiHatasi` olarak döner (HTTP 403, mesaj kullanıcıya gösterilir, istemci sunucudaki hali yeniden yükler).

## Yetki
- **Kurum geneli** (kurum, şube, sezon, ders, fiyat listesi, modüller): yalnızca genel yönetici. Sunucuda `GENEL_TANIM` / tekil ayar kuralı.
- **Şubeye özel** (grup, derslik, ders saati): genel yönetici veya Bölüm 02'den "01" yetkisi verilmiş rol;
  sunucu ayrıca şube kapsamını denetler (başka şubeye yazamaz). Varsayılan yetkilerde yalnızca genel yönetici.
- Silme yalnızca derslik ve ders saatinde vardır (ve yalnızca hiç kullanılmamışsa); şube, sezon, grup ve ders silinmez, pasife alınır.

## İş kuralları (`kurallar.ts`)
- **Kurum:** ad boş olamaz; e-posta girildiyse geçerli olmalı; vergi no 10 (VKN) veya 11 (TCKN) hane;
  logo yalnızca PNG/JPEG/SVG veri adresi ve en fazla 200 KB.
- **Şube:** ad dolu; kısa kod 2–5 harf (Türkçe büyük harfe çevrilir); kod ve ad kurum içinde benzersiz
  (büyük/küçük harf ve boşluk farkı sayılmaz). Aktif sezonda aktif/dondurulmuş kaydı olan şube pasife alınamaz
  (geçmiş sezon kayıtları engel değildir). Yeni şube sihirbazı derslik ve ders saatlerini yeni kimliklerle kopyalar.
- **Sezon:** ad dolu ve benzersiz; bitiş başlangıçtan sonra; her zaman **tam bir** aktif sezon olur
  (ilk tanımlanan sezon otomatik aktif olur).
- **Sezon geçişi:** hedef, aktif sezondan sonra başlayan bir sezondur ve hedefte grup olmamalıdır (iki kez yapılamaz).
  3–7. sınıf grupları seviye +1 ile kopyalanır ("5-A" → "6-A"), 8. sınıflar mezun olur: karar 2026-11-07 ile 8. sınıf
  gruplarının aktif/dondurulmuş kayıtları `sezonGecisiPlani().mezunlar` ile "mezun" durumuna geçer (öğrenci taşınsın taşınmasın),
  başka süren kaydı olmayan öğrencinin durumu da "mezun" olur (Bölüm 04 · `ogrenciDurumu`; sunucu: kayitDenetle).
  Pasif veya artık o şubede olmayan rehber öğretmen yeni gruba taşınmaz.
  Öğrenci taşıma seçilirse aktif kayıtlar yeni kayıt olarak açılır: **yeni sözleşme numarası** (hedef sezonun yılı,
  şube içinde sıralı, mevcut numaralarla çakışmaz), **KVKK onayı boş** (yeniden alınır), içe aktarma bağı kopyalanmaz.
- **Grup:** ad dolu ve aynı şube + sezon içinde benzersiz; seviye 3–8; kapasite 1–500 tam sayı;
  derslik seçildiyse grubun şubesine ait olmalı; rehber öğretmen seçildiyse o şubede görevli aktif personel olmalı.
  Var olan grubun şubesi/sezonu değiştirilemez; kayıtlı öğrencisi olan grubun seviyesi değiştirilemez.
  Kapasite dolduğunda kayıt engellenmez (Bölüm 04 uyarır).
- **Ders:** ad dolu ve benzersiz; kısa ad 1–4 karakter (boşsa adın ilk 3 harfi); renk `#RRGGBB`.
- **Derslik:** ad dolu ve şube içinde benzersiz; kapasite 1–500 tam sayı; başka şubeye taşınamaz.
  Bir grubun varsayılan dersliğiyse veya ders programında (geçmiş satırlar dahil) geçiyorsa silinemez; **pasife alınabilir** (aşağıya bakın).
- **Ders saati:** `SS:DD` biçimi; bitiş başlangıçtan sonra; aynı şube ve gün tipinde örtüşme yok (uç uca değmek serbest);
  ders programında (geçmiş dahil) kullanılan dilim silinemez, **pasife alınabilir**; ekleme/silmede sıra numaraları başlangıç saatine göre yeniden verilir.
- **Derslik / ders saati pasif durumu** (karar 2026-11-07: "sil + pasif" ikisi de):
  - `aktif` alanı (`Derslik.aktif`, `DersSaati.aktif`, isteğe bağlı boolean). Alan yoksa (eski veri, yedek) kayıt **aktif sayılır**
    (`tanimAktif()` → `aktif !== false`). Yeni kayıtlar `aktif: true` ile eklenir; boolean dışı değer reddedilir.
  - Hiç kullanılmamış kayıt silinebilir; kullanılmış kayıt silinemez (sil düğmesi devre dışı, nedeni ipucunda), pasife alınır
    ve istenince tekrar aktife alınır. Geçmiş program satırları ve yoklamalar değişmez.
  - Pasif kayıt listede soluk ve "Pasif" etiketiyle görünür.
  - Pasif kayıt **yeni** atamada seçilemez: grup varsayılan dersliği (`grupDogrula`) ve ders programı satırı
    (`programAtamaEngeli`: derslik ve ders saati). Seçim listeleri `secilebilirTanimlar()` ile pasifleri çıkarır;
    mevcut seçili değer pasifse "(pasif)" ekiyle görünür kalır.
  - Yalnızca **değişen** atama denetlenir (sunucu ve ekran aynı desen): pasife alınmadan önce yapılmış, değişmemiş atama
    kilitlenmez (grubun başka alanı düzenlenebilir, program satırı bitirilebilir/kaldırılabilir). Geçmişi olan program satırı
    düzenlenince yeni satır açıldığından (`programDegistir`), pasif dilimdeki dersin değişikliği için önce aktif dilime taşınması gerekir.
  - Ders programı ızgarasında pasif dilim yalnızca o hafta görüntülenen bir dersi varsa "(pasif)" ekiyle satır olarak görünür;
    boş hücresine ders eklenemez, ders sürüklenemez.
- **Fiyat listesi:** her değer sonlu ve negatif olmayan sayı.
- **Modüller:** değerler yalnızca `true/false`.

## Bu bölümde düzeltilen hatalar
- Sezon geçişinde taşınan kayıtlar eski **KVKK onayını** kopyalıyordu (ekranda "yeniden alınmalı" yazmasına rağmen).
- Sezon geçişinde sözleşme numarası yalnızca yılı +1 yapıyordu; hedef yılda zaten verilmiş numarayla **çakışabiliyordu**.
  Ayrıca içe aktarma bağı (`iceAktarmaId`) kopyalanıyor, yeni kayıt "içe aktarmayı geri al" ile silinebilir hale geliyordu.
- Grup kaydederken derslik/rehber "Seçiniz" bırakılsa bile **ilk derslik ve ilk öğretmen sessizce atanıyordu**
  (rehber öğretmen grubun öğrenci verisini görmeye başlar).
- Derslik ve ders saati silme kontrolü yalnızca bitişi boş program satırlarına bakıyordu; bitişi ileri tarihli
  (hâlâ geçerli) satırlar ve geçmiş satırlar atlanıyordu.
- Derslik kapasitesine eksi/ondalık değer yazılabiliyordu; her tuş vuruşunda sunucuya yazılıyordu.
- Grup/ders/derslik adı benzersizliği Türkçe büyük/küçük harfe duyarsız değildi ("İ"/"i"); derslik ve şube adında hiç yoktu.
- Fiyat listesine negatif/boş değer kaydedilebiliyordu.
- Aktif sezon yoksa Gruplar sekmesi ve sezon geçişi sihirbazı çöküyordu.
- Şube pasife alma kontrolü geçmiş sezonun "aktif" kalan kayıtlarını da sayıyordu (sezon geçişinden sonra hiçbir şube pasife alınamazdı).
- Gruplar sekmesindeki ekle/düzenle düğmeleri yetkisi olmayan rollere de görünüyordu; derslik ve ders saati ekranı ise
  "01" yetkisi verilmiş rolleri hiç yazdırmıyordu (sunucu izin verirken). İkisi de `useSubeTanimYazar` ile tutarlı hale getirildi.
- Finans modülü kapatıldığında açık kalan "Fiyat listesi" sekmesi görünmeye devam ediyordu.
- Yukarıdaki kuralların **hiçbiri sunucuda uygulanmıyordu**; API'ye doğrudan istekle yinelenen şube kodu, çakışan
  ders saati, iki aktif sezon, kullanımdaki dersliği silme vb. yapılabiliyordu. Artık `tanimDenetle()` reddeder.

## Testler
`npm test` (veya `npx vitest run src/bolumler/01-kurum-yapisi`):
- `kurallar.test.ts` — 41 test: örnek verinin kurallara uyması, kurum/şube/sezon/grup/ders/derslik/ders saati doğrulamaları,
  sezon geçişi planı (mezuniyet, sözleşme no, KVKK, rehber), sıralama, derslik/ders saati aktif-pasif (eski veri uyumu,
  seçim listesi, pasif atama yasağı, değişmeyen atamanın kilitlenmemesi).
- `sunucu.test.ts` — 25 test: sunucunun reddettiği paketler (yinelenen kod, pasife alma, iki aktif sezon, kullanımdaki derslik,
  çakışan saat, başka şubenin dersliği, şube/sezon değişmezliği, şube müdürü kapsamı ve yetkisi, pasif derslik/ders saatine
  yeni program satırı veya grup ataması, pasif kaydın silinememesi).

## Bilinen sınırlar / açık sorular
- **Sezon düzenleme yok.** Doküman "ekle/düzenle" diyor; şu an yalnızca ekleme ve aktif yapma var. Yanlış tarihli sezon düzeltilemez.
- **Fiyat listesi modeli dokümandan farklı.** Doküman `sezon + seviye + şube` bazında fiyat tanımlıyor; veri modeli
  (`fiyatListesi: Record<şubeId, number>`) yalnızca şube bazında tek fiyat tutuyor. Model değişikliği Bölüm 05 ile birlikte kararlaştırılmalı.
- ~~Derslik ve ders saatinde pasif durumu yok.~~ **Kapandı (2026-11-07):** "sil + pasif" kararıyla `aktif` alanı eklendi; ayrıntı İş kuralları bölümünde.
- **Kasalar** dokümanda şubeye özel tanım olarak geçiyor; bu bölümde ekranı yok (Bölüm 05'e bırakıldı).
- **Şube müdürü alanı serbest metin.** Doküman `müdür_id` diyor; personelle bağlantı kurulmadı.
- **Şube telefonu doğrulanmıyor** (sabit hat biçimleri çeşitli; `telefonNormalize` yalnızca cep telefonu kabul ediyor).
- **Sezon geçişinde fiyat/indirim/ek hizmetler** eski kayıttan aynen kopyalanıyor; yeni sezon fiyatının uygulanıp
  uygulanmayacağı Finans kararına bağlı.
- **Aktif sezon değişikliği onay istemiyor**; tek tıkla tüm sistemin varsayılan sezonu değişir.
- Kural ihlalleri sunucuda `YetkiHatasi` (HTTP 403) olarak dönüyor; ayrı bir "doğrulama hatası" (400) türü `server/uygulama.ts`
  değişikliği gerektirdiği için bu bölümde eklenmedi.
- Grup adı benzersizliği şube + **sezon** içinde uygulanıyor (her sezonda "5-A" olabilir); doküman yalnızca "şube içinde" diyor.
