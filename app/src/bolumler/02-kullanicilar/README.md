# Bölüm 02 · Kullanıcılar, roller ve yetkiler

Gereksinim: [`docs/bolumler/02-kullanicilar-ve-yetkiler.md`](../../../../docs/bolumler/02-kullanicilar-ve-yetkiler.md)

## Amaç
Kimin sisteme nasıl gireceğini ve neyi görüp yapabileceğini belirler: personel hesapları (rol + şube kapsamı),
veli hesapları (telefon + SMS kodu), rol → bölüm yetki tablosu ve giriş geçmişi.
Yetki = **rol + şube kapsamı**; sunucu bunu her istekte yeniden uygular, ekran yalnızca kolaylık sağlar.

## Dosyalar
| Dosya | İçerik |
|---|---|
| `index.tsx` | Sekmeli sayfa kabuğu (default export `Kullanicilar`, `main.tsx` buradan içe aktarır) |
| `kurallar.ts` | **Saf iş kuralları** (e-posta, parola, rol seviyesi, şube kapsamı, kullanıcı satırı, yetki tablosu). React'e ve `@/` takma adına bağlı değildir; sunucu da aynı dosyayı kullanır |
| `ortak.tsx` | Ekran yardımcıları: `useHesapYonetimi` (oturumdaki kullanıcının kimi yönetebileceği), `kapsamMetni`, `zamanBicim` |
| `PersonelHesaplari.tsx` | Kullanıcı listesi, ekle/düzenle, geçici parola |
| `VeliHesaplari.tsx` | Veli portal daveti ve bildirim izni durumu |
| `RolYetkileri.tsx` | Rol → bölüm yetki tablosu |
| `GirisGecmisi.tsx` | Son 40 giriş denemesi |
| `kurallar.test.ts` | Saf kuralların birim testleri |
| `sunucu.test.ts` | Sunucu tarafı denetim (`server/politika.ts`) ve kimlik uçları (`server/uygulama.ts`) testleri |

Sunucu tarafı:
- `server/politika.ts` · `kullaniciDenetle()` — her `/api/degisiklik` isteğinde `yazmaDenetle()` sonunda çalışır (Bölüm 01'in `tanimDenetle()`'sinden sonra).
- `server/uygulama.ts` — `/api/giris`, `/api/giris/dogrula`, `/api/parola`, `/api/kullanicilar/:id/parola-sifirla`, oturum ara katmanı (`aktorBul`).
- `server/kimlik.ts` — parola özeti (scrypt), oturum, tek kullanımlık kod, deneme sınırı. Parola kuralı `kurallar.ts · parolaKurali`'dan gelir.
- `src/context/AppContext.tsx` · `useOturum().yetki()` ve sunucudaki `yetki()` aynı `bolumYetkisi()` fonksiyonunu kullanır.

## İş kuralları (`kurallar.ts`)
- **Roller ve seviye:** genel yönetici (4) > şube müdürü (3) > sekreter (2) > öğretmen (1).
  Genel yönetici olmayan biri (02 veya 13 yetkisiyle) **kendinden yüksek rol atayamaz**, genel yönetici yetkisi veremez,
  **kendinden yetkili bir hesabı** düzenleyemez/silemez/parolasını sıfırlayamaz ve yalnızca **kendi şube kapsamındaki** hesapları yönetir.
- **Kendi hesabı:** kendi rolü ve şube kapsamı değiştirilemez, kendi hesabı pasife alınamaz ve silinemez
  (kendi personel kartını pasife almak da dahil). Kendi parolası "sıfırla" ile değil, eski parola sorulan "Parola değiştir" ile değişir.
- **Son genel yönetici:** her değişiklikten sonra en az bir **aktif genel yönetici** kalmalıdır. Yedekten geri yüklemede de
  yükleyen kişinin yedekte aktif genel yönetici olması gerekir.
- **Şube kapsamı:** genel yönetici her zaman "tüm şubeler"dir; diğer roller en az bir, tanımlı, yinelenmeyen şubeye atanır
  ("tüm şubeler" yalnızca genel yöneticiye verilir).
- **E-posta:** geçerli biçim, en fazla 120 karakter, kurum içinde **benzersiz**. Karşılaştırma ve saklama `epostaNormalize()` ile yapılır:
  boşluk atılır, küçük harfe çevrilir, Türkçe `I`/`İ`/`ı` harfleri `i` sayılır. Girişte de aynı fonksiyon kullanılır.
- **Hesap satırı:** geçerli rol, var olan personel kartı, personel başına tek hesap, boolean `aktif`/`ikiAdim`.
  `sonGiris` alanını yalnızca sunucu yazar (istemcinin gönderdiği değer yok sayılır).
- **Personel pasife alınınca** bağlı hesap da aynı pakette pasife alınır ve oturumları kapanır (hesabı göremeyen şube müdürü
  Bölüm 13'ten pasife alsa bile). Aktör o hesabı yönetemiyorsa değişiklik reddedilir.
- **Parola:** 8–128 karakter, en az bir harf (Türkçe dahil) ve bir rakam; değiştirirken tekrar eşleşmeli ve eskisinden farklı olmalı.
  Ekran (`Giris.tsx · ParolaDegistir`) ve sunucu aynı `parolaDegisimDogrula()` fonksiyonunu kullanır.
- **Rol yetki tablosu:** yalnızca genel yönetici değiştirir; tablo tüm rolleri içermeli, yalnızca 01–14 bölüm kodları ve boolean değerler olmalı;
  genel yöneticinin hiçbir bölümü kapatılamaz. Yetki yalnızca değer `true` ise verilir.

## Kimlik ve oturum (sunucu)
- Parola özeti (`scrypt`) ayrı `parola` tablosundadır; `Db`'ye hiç yüklenmez, hiçbir uçta istemciye gitmez (test edildi).
- Kullanıcı bulunamasa da sahte özetle scrypt çalışır (yanıt süresinden e-postanın kayıtlı olduğu anlaşılmasın);
  aşırı uzun parola girdisi scrypt'e verilmez.
- **Deneme sınırı:** e-posta + IP başına 5, e-posta başına 20 deneme / 15 dk (`x-forwarded-for` değiştirilerek aşılamaz).
  İki adımlı hesapta sayaç ancak **ikinci adım tamamlanınca** sıfırlanır; ayrıca kullanıcı başına 15 dakikada en çok 5 kod gönderilir.
- **İki adım kodu:** 6 hane, 5 dk geçerli, en çok 5 deneme, başarıda silinir (tekrar kullanılamaz).
- **Parola değiştirme:** kullanıcı başına 5 hatalı "mevcut parola" denemesi / 15 dk; başarıda bu oturum dışındaki tüm oturumlar kapanır.
- **Parola sıfırlama:** geçici parola üretir, "değiştirmeli" işaretler, hedefin tüm oturumlarını kapatır.
- **Oturum:** personel 8 saat (httpOnly, SameSite=Strict çerez; veritabanında yalnızca belirtecin SHA-256 özeti).
  Her istekte hesap **ve personel kartı** yeniden kontrol edilir; pasife alınan kullanıcı bir sonraki istekte düşer, oturum satırları da silinir.
  Süresi dolan oturumlar yeni oturum açılırken temizlenir.

## Bu bölümde düzeltilen hatalar
- **E-posta Türkçe harf sorunu:** giriş `toLocaleLowerCase("tr-TR")` kullanıyordu; `I` harfi `ı` olduğu için "SELIN@…" veya
  "Ismail@…" yazan kullanıcı giriş yapamıyordu (`server/uygulama.ts · /api/giris`).
- **Yinelenen e-posta** hiçbir yerde (ekranda düzenleme, sunucuda hiç) engellenmiyordu; aynı e-postalı ikinci hesap açılabiliyordu.
- **Yetki yükseltme:** 02 yetkisi verilen sekreter birini şube müdürü yapabiliyor, şube müdürünün hesabını düzenleyebiliyordu;
  yalnızca "genel yönetici" ataması engelleniyordu. Varsayılan 13 yetkisiyle şube müdürü de aynı yoldan yazabiliyordu.
- **Parola sıfırlama kapsamı:** 02 yetkili kullanıcı **başka şubedeki** ve **kendinden yetkili** hesapların parolasını sıfırlayıp
  hesabı ele geçirebiliyordu; kendi parolasını eski parola sorulmadan sıfırlayabiliyordu.
- **Kendi şube kapsamı** sunucuda kilitli değildi (yalnızca rol ve aktiflik kilitliydi); kendi hesabını silme de açıktı (içe aktarılmış personelde).
- **Pasif personelin hesabı açık kalıyordu:** şube müdürü (02 yetkisi yok, hesabı göremez) Bölüm 13'ten personeli pasife alınca
  kullanıcı hesabı aktif kalıyor, ayrılan personel girişe devam edebiliyordu.
- **İki adım kaba kuvvet:** doğru parola girilince deneme sayacı ikinci adımdan önce sıfırlanıyordu; parolayı bilen biri
  sınırsız yeni kod isteyip (her biri 5 deneme) kodu deneyebiliyor, SMS maliyeti doğurabiliyordu.
- **Deneme sınırı IP başlığıyla aşılabiliyordu** (`x-forwarded-for` her istekte değiştirilerek).
- **Parola değişince diğer oturumlar kapanmıyordu**; aynı (geçici) parola "yeni parola" olarak yeniden kaydedilebiliyordu;
  "mevcut parola" alanı sınırsız denenebiliyordu.
- **Ekran/sunucu parola kuralı farklıydı:** ekran "rakam + herhangi bir rakam dışı karakter" istiyordu (`12345678!` geçiyordu), sunucu harf istiyordu.
- **Rol yetki tablosu doğrulanmıyordu:** genel yönetici API'den kendi "02" yetkisini kapatıp kullanıcı yönetimini kilitleyebilir,
  boolean olmayan değer yazabilirdi. Ekran `?? false` ile sunucu `=== true` ile okuyordu (farklı sonuç verebilirdi).
- **Düzenleme formu:** genel yöneticiden başka role geçince kapsam "tüm şubeler" kalıyor, tüm şubeler işaretli görünürken
  form geçersiz sayılıp kaydedilemiyordu. Kendi şube kapsamı düzenlenebilir görünüyordu.
- **Ekran yetki dışı seçenek sunuyordu:** rol listesinde her rol (genel yönetici dahil), şube listesinde kapsam dışı şubeler,
  yönetilemeyen hesaplarda "Düzenle"/"Parola sıfırla", genel yönetici olmayana rol tablosu anahtarları açık görünüyordu.
  Yeni kullanıcı formunda varsayılan şube sabit `s1` idi (başka şubenin müdürü için kapsam dışı).
- **İşlem kaydı eksikti:** e-posta ve iki adımlı doğrulama değişiklikleri yazılmıyordu; şube kapsamı değişikliği yalnızca "değişti" diyordu.
- `sonGiris` istemciden yazılabiliyordu; süresi dolan oturum ve kod kayıtları hiç temizlenmiyordu.

## Testler
`npm test` (veya `npx vitest run src/bolumler/02-kullanicilar`):
- `kurallar.test.ts` — 19 test: örnek verinin kurallara uyması, e-posta normalleştirme (İ/I/ı) ve benzersizlik, parola kuralı,
  rol seviyesi ve atama, yönetim/sıfırlama engeli, kendi hesabı, kullanıcı satırı, son genel yönetici, rol yetki tablosu.
- `sunucu.test.ts` — 26 test:
  - politika: yetki yükseltme (müdür/sekreter/öğretmen), kapsam, kendi hesabı, `sonGiris`, son genel yönetici, yinelenen e-posta,
    personel pasife alınınca hesap, rol tablosu;
  - API: büyük harfli / Türkçe `I`'lı e-postayla giriş, parola özetinin hiçbir yanıtta olmaması, IP değiştirerek deneme sınırını aşamama,
    iki adım kodunun tek kullanımlık olması ve 5 hata sonrası geçersizleşmesi, kod isteme sınırı, pasife alınan kullanıcının oturumunun kapanması,
    parola değişince diğer oturumların kapanması, parola sıfırlamada kapsam/rol/kendi hesabı engelleri.

## Bilinen sınırlar / açık sorular
- **Eşit seviye yönetimi:** şube müdürü (02/13 yetkisiyle) aynı şubedeki **başka bir şube müdürünü** düzenleyip pasife alabilir;
  sekreter başka bir sekreteri. "Kendinden yüksek" engellendi, "eşit" serbest bırakıldı. Kesin kural kurum kararı.
- **Şube müdürünün varsayılan 13 (personel) yetkisi** kullanıcı hesabı da yazdırıyor (Bölüm 13 "hesap aç"). Bu sayede 02 yetkisi olmadan da
  kapsamındaki alt rollere hesap açabiliyor, ama parola sıfırlayamıyor (sıfırlama 02 ister) — yeni hesabın parolasını genel yönetici üretmeli.
  Bu ayrımın istenip istenmediği netleşmeli.
- **Genel yönetici için iki adım zorunlu değil:** kendi hesabında kapatabilir (Bölüm 14 güvenlik listesinde yalnızca uyarı olarak görünür).
- **Deneme sınırı ve kodlar bellekte:** sunucu yeniden başlayınca sıfırlanır; birden çok sunucu örneğinde paylaşılmaz.
  E-posta başına 20 deneme sınırı, saldırganın bir hesabı 15 dakika kilitlemesine (hizmet engelleme) izin verir.
- **IP adresi `x-forwarded-for` başlığından okunuyor**; ters vekil arkasında değilse istemci bu başlığı uydurabilir (e-posta başına sınır bunu sınırlar).
- **Oturum süresi sabit 8 saat** (kayan değil, ayardan değiştirilemez); veli oturumu `ayarlar.oturumGun` gün.
- **Rol değişikliğinde oturum kapanmıyor:** yetkiler her istekte güncel veriden okunduğu için gerekli değil, ancak açık ekran bir sonraki
  veri yenilemesine kadar eski menüyü gösterebilir.
- **Öğrenci hesabı** (dokümanda opsiyonel, veli tarafından açılan kullanıcı adı + parola) yok.
- **Personel girişi yalnızca e-postayla**; doküman "e-posta/telefon + parola" diyor.
- **Pasif hesap mesajı** yalnızca parola doğruysa "Hesabınız pasif" der; aksi halde genel hata mesajı (bilinçli).
- **Bölüm 14 içe aktarma** e-posta karşılaştırmasında hâlâ `toLocaleLowerCase("tr-TR")` kullanıyor; sunucu artık yinelenen e-postayı
  reddettiği için veri bozulmaz, ancak ekrandaki ön kontrol "I" harfli e-postaları kaçırabilir (Bölüm 14'te ele alınmalı).
- Kural ihlalleri sunucuda `YetkiHatasi` (HTTP 403) olarak dönüyor (Bölüm 01 ile aynı); ayrı bir doğrulama hatası (400) türü yok.
