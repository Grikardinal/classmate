# Bölüm 11 · Veli ve öğrenci portalı

Gereksinim: `docs/bolumler/11-veli-ve-ogrenci-portali.md`. Plan ve kullanıcı kararları: `docs/PROFESYONELLESME.md`.

## Amaç
Velinin telefonundan, uygulama indirmeden (PWA) çocuğuyla ilgili her şeyi görmesi; izin bildirmesi, etüt randevusu alması. Personelin `/veli-portali` sayfası yalnızca kullanım durumu ve önizlemedir; velinin uygulaması `/veli/*` altındadır, oturumları (çerez) ayrıdır.

## Dosyalar
| Dosya | İçerik |
|---|---|
| `index.tsx` | Yönetim sayfası (default export), `VeliPortaliUygulamasi`: oturum, veri yükleme, çıkış, rotalar |
| `Giris.tsx` | Telefon + SMS kodu |
| `Kabuk.tsx` | Üst bar, çocuk seçici, alt ve yan menü |
| `AnaSayfa.tsx` | Ana sayfa, "gelemeyecek" bildirimi |
| `Sayfalar.tsx` | Program, yoklama, ödevler, duyurular, ödemeler, öğretmenler, bildirimler |
| `Etut.tsx` | Randevu alma ve iptal |
| `Profil.tsx` | İletişim izinleri, talep, çıkış |
| `ortak.tsx` | Portal bağlamı, ortak parçalar, bildirim açma |
| `push.ts` | Bu cihazın web push aboneliği |
| `kurallar.ts` | **Saf iş kuralları** (ekran ve sunucu ortak; yalnızca göreli içe aktarma) |
| `kurallar.test.ts`, `sunucu.test.ts` | Birim testleri; `veliVerisi` alan denetimi ve veli API testleri |

Sunucu: `app/server/uygulama.ts · /api/veli/*`, `app/server/politika.ts · veliVerisi`, `app/server/kimlik.ts` (kod, deneme sınırı, oturum). `public/sw.js` yalnızca push içindir.

## İş kuralları
**Giriş**
- Telefon + 6 haneli SMS kodu; kod 5 dakika geçerli, tek kullanımlık, en çok 5 deneme. Veritabanına ve gönderim kaydına yazılmaz.
- `demoKod` yalnızca demo modda ve konsol SMS sağlayıcısıyla döner.
- Numaralandırma yok: kayıtsız numaraya da gönderilmeyen bir kod üretilir; `/kod` yanıtı ve `/giris` hata akışı aynıdır. SMS sağlayıcısı beklenmez, yanıt süresi fark etmez.
- Sınırlar (`GIRIS_SINIRLARI`): IP başına 10 dakikada 20 kod, numara başına 10 dakikada 3 ve günde 10 kod, IP başına 10 dakikada 30 giriş denemesi. IP sınırına takılan istek numaranın hakkını tüketmez.
- Aktif kayıtlı çocuğu olmayan veliye kod ve oturum verilmez.

**Oturum**
- Çerez `httpOnly`, `SameSite=Strict`, üretimde `Secure`; süre `ayarlar.oturumGun`. Veli durumu her istekte güncel veriden denetlenir; ekran 60 saniyede bir ve odaklanınca oturumu yoklar, düştüyse veriyi bellekten siler.
- Bağlantı hatası giriş ekranına düşürmez; "Tekrar dene" ekranı çıkar.
- Çıkış sunucuya ulaşamazsa veli "çıktı" gibi gösterilmez (ortak cihaz).

**Çıkış ve push (Bölüm 10'dan devredilen iş)**
- Çıkışta yalnızca bu cihazın aboneliği silinir (uç + veli eşleşmesiyle), tarayıcıdaki abonelik de bırakılır. Son cihaz da çıktıysa `pushAcik` kapanır; böylece kanal SMS'e döner, "Bildirimleri aç" yeniden görünür.
- Cihaz aboneliği olmadan `pushAcik: true` yazılamaz.

**Veri sınırı (`veliVerisi`)**
- İzin listesiyle kurulur (`...db` yok): Db'ye eklenen yeni alan derleme hatası verir, kendiliğinden veliye gitmez.
- Gitmeyenler: diğer velinin kimliği, personel iletişim ve ücret bilgisi, öğrenci notları, sağlık notu, sözleşme fiyatı ve indirimler, iptal hesabı, fiyat listesi, aday, tahsilat, işlem kaydı, otomasyon kaydı, vergi no, şube müdürü adı, ilgisiz şubeler, duyuru göndereni ve diğer alıcılar.
- Yoklamada yalnızca kendi çocuğunun satırı; çocuğun olmadığı oturum hiç gitmez.
- Kaydı sona eren çocuk (Finans açıkken, açık taksiti varsa): yalnızca adı ve açık taksitleri gider; yoklama, ödev, program, kayıt gitmez. İzin ve randevu yazılamaz.
- Kapalı modül: finans/ödev/etüt verisi ve bu modüllerin geçmiş bildirimleri gitmez.

**Yazma uçları**
- Yalnızca kendi aktif çocuğu için. Veli başına dakikada 120 yazma; saatte 30 izin ve 30 randevu isteği (`YAZMA_SINIRLARI`).

**Korunan kararlar**
- Devam oranı `devamsizlikOzeti` ile (izinli dersler hariç); hesaplanacak ders yoksa "—".
- SMS iznini kapatırken uyarı ve onay. Dersi olmayan güne izin reddedilir (ekranda düğme de kapalıdır).
- Grup etüdünde veli yalnızca kendi çocuğunun sonucunu görür, yalnızca onu çıkarır.
- Veli randevu iptali onay penceresinden geçer.

**Önbellek**
- Service worker bilinçli olarak önbellek tutmaz, veri yalnızca bellektedir. `/api/veli/*` yanıtları `Cache-Control: no-store`. Çıkıştan sonra cihazda veri kalmaz. Çevrimdışı kullanım yoktur.

## Testler
`npx vitest run src/bolumler/11-veli-portali`. `kurallar.test.ts`: saf kurallar. `sunucu.test.ts`: `veliVerisi` alan denetimi, numaralandırma, kod ve IP sınırları, tek kullanım, çerez, çıkışta abonelik, yazma uçları. Gerçek SMS gönderilmez.

## Bilinen sınırlar
- Kod ve deneme sayaçları bellektedir; sunucu yeniden başlayınca sıfırlanır, birden çok süreçte paylaşılmaz.
- Saldırgan bir kurbanın numarasına kod isteyerek o numaranın saatlik hakkını doldurabilir (SMS bombalamaya karşı kabul edilen bedel).
- Aynı telefonla iki veli kartı varsa ilk eşleşen açılır; Bölüm 04'teki birleştirme bunu giderir.
- Personelin veli kartını pasife alma alanı yoktur; erişim, aktif kayıtlı çocuk kalmayınca kesilir.
- Tek çocuğu ayrılan velinin portal oturumu yoktur (giriş aktif kayıtlı çocuk ister); açık borcu ekranda yalnızca aktif kayıtlı başka çocuğu olan veli görür.
- Telefon numarası personelce değiştirilince açık oturumlar kapanmaz.
- Manifest yalnızca SVG simge içerir; bazı Android sürümlerinde ana ekrana ekleme için PNG gerekebilir.

## Kapanan sorular
Kararlar: `docs/PROFESYONELLESME.md`.
1. **IP sınırının güvenilirliği:** Kapandı (2026-11-09). Ters vekil `x-forwarded-for` başlığını kendisi yazar. **Canlıya almada** yapılacak; numara başına sınır her durumda geçerlidir.
2. **Boşanmış / ikinci veli ödemeleri:** Kapandı (2026-11-09). Çocuğa bağlı her veli taksitleri görür (değişiklik yok).
3. **Ayrılan çocuğun borcu:** Kapandı (2026-11-09). Açık taksitler Ödemeler ekranında "Kaydı sona erdi" etiketiyle görünür.
4. **Sağlık notu:** Kapandı (2026-11-09). Veliye gönderilmez (değişiklik yok).
5. **Randevu iptali onayı:** Kapandı (2026-11-09). Uygulama içi onay penceresi eklendi.
