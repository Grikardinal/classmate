# Bölüm 10 · İletişim ve bildirimler

Gereksinim: `docs/bolumler/10-iletisim-ve-bildirimler.md`. Plan ve kullanıcı kararları: `docs/PROFESYONELLESME.md`.

## Amaç
Diğer bölümlerin ürettiği olayları veliye doğru kanaldan, doğru metinle, doğru zamanda ulaştırmak. Uygulama bildirimi (web push) ana kanal; SMS kritik durumlar ve yedek.

## Dosyalar
| Dosya | İçerik |
|---|---|
| `index.tsx` | Sekmeli sayfa (default export `Iletisim`) |
| `BildirimMerkezi.tsx` | Olay tablosu, kanal, açık/kapalı, şablon düzenleme |
| `Duyurular.tsx` | Duyuru listesi, yeni duyuru, zamanlanmış duyuruyu gönderme |
| `GonderimKaydi.tsx` | Gönderim kaydı, şube bazında SMS maliyeti, elle tekrar |
| `Ayarlar.tsx` | Gönderim aralığı, birim fiyat, altyapı durumu, yasal notlar |
| `ortak.ts` | Kanal adı, olay adı, tarih biçimi, önizleme değişkenleri |
| `kurallar.ts` | **Saf iş kuralları** (ekran ve sunucu ortak; yalnızca göreli içe aktarma) |
| `kurallar.test.ts`, `sunucu.test.ts` | Birim testleri; `yazmaDenetle → iletisimDenetle`, kuyruk (sahte sağlayıcı), okuma, otomasyon, veli API testleri |

Sunucu: `app/server/politika.ts · iletisimDenetle`, `veliVerisi`; `app/server/gonderim.ts` (Netgsm, web push, kuyruk); `app/server/uygulama.ts · kuyrukCalistir`, `/api/veli/tercih`, `/okundu`, `/talep`, `/push/abone`; `app/server/zamanlayici.ts`. SMS parça hesabı `app/src/lib/kurallar.ts · smsBoyu`.

## İş kuralları
**Kuyruk** (`kuyruguIsle`)
- Satırlar tek tek işlenir, sonuç hemen yazılır. Her satırdan önce güncel veri okunur; gönderim sürerken silinen satır (yoklama düzeltmesi gibi) gitmez, geri de gelmez.
- Çift SMS engeli: sağlayıcıdan önce `gonderimBasladi` kalıcı yazılır. Yazılamazsa SMS gönderilmez. Sonuç yazılamadan süreç düşerse satır sonraki çalışmada "başarısız, iletilip iletilmediği bilinmiyor" olur; kendiliğinden yeniden gönderilmez.
- Otomatik tekrar yok. Personel başarısız satırı en çok 3 kez kuyruğa alır (10 yetkisi). Giriş kodu tekrar edilemez.
- Gönderim aralığı dışında SMS bekler; giriş kodu beklemez. Aralık başlangıcı bitişten önce olmalı (geceye taşan aralık yok).

**SMS izni**
- `izinSms` kapalı veliye SMS gitmez (giriş kodu hariç). Hem kuyruğa girerken hem gönderim anında denetlenir; satır uygulama bildirimine döner, maliyet sıfır.
- Aday: yalnızca rıza vermiş ve aynı pakette eklenen adayın numarasına teşekkür mesajı gider; rıza sonradan kalkarsa gönderilmez.

**Personelin yazdığı gönderim satırı** (`iletisimDenetle`)
- Olayı yalnızca üretebilen rol yazar (`olayUretmeYetkisi`); öğretmen yalnızca yoklama, ödev, etüt olaylarını.
- Alıcı öğrencinin velisi, öğrenci şube kapsamında olmalı. Alıcı metni, şube, kanal, maliyet, durum sunucudan.
- SMS yalnızca olay kanalı uygunsa ve metin şablon kalıbına uyuyorsa (`metinSablonaUyar`); uymayan metin uygulama bildirimi kalır.
- Giriş kodu, düzeltme mesajları, etüt iptali, duyuru satırlarını yalnızca sunucu üretir.
- Devamsızlık bildirimi aynı paketteki gerçek "gelmedi" kaydına bağlıdır; olay türü ve 7 günlük geç giriş penceresi sunucuda uygulanır.

**Duyuru**
- Şube personeli kendi şubesine, grubuna veya kendi şubeleriyle sınırlı seviyeye (`subeIds`) gönderir; "tüm veliler" genel yöneticide.
- Alıcılar, gönderen, okundu listesi, gönderim satırları sunucudan; veli başına tek satır. Şube değişkenleri velinin hedefteki çocuğunun şubesinden.
- Gönderilmiş duyuru değişmez; zamanlanmış duyuru yalnızca gönderilebilir (çift tıklama iki kez göndermez). Bildirim merkezinde "Duyuru" kapalıysa satır üretilmez, portalda görünür.

**Şablon ve ayarlar**
- Yalnızca genel yönetici değiştirir. Şablon olayın değişkenleriyle sınırlı (`sablonEngeli`), en çok 500 karakter. Değişken değerleri yeniden açılmaz. Olay adı, finans, modül alanı değişmez.

**SMS sağlayıcı ve maliyet**
- `smsBoyu`: GSM 160/153, Türkçe 155/150, Unicode 70/67; uzantı karakteri iki sayılır.
- Netgsm: başarı HTTP 200 ve 00/01/02. Hata metinlerinde kullanıcı adı ve şifre gizlenir; bilinmeyen yanıtın gövdesi kayda yazılmaz.

**Veli uçları**
- Abonelik yalnızca bilinen push servislerine (sunucu iç ağa istek atamasın), yalnızca gerekli alanlar. 404/410 alan abonelik silinir. Bildirimi kapatanın abonelikleri silinir.
- Talep 500 karakter, saatte 5. Okundu yalnızca alıcısı olunan duyuruda. Veliye giden gönderim satırında hata, maliyet, alıcı yok.

## Testler
`npx vitest run src/bolumler/10-iletisim`

## Bilinen sınırlar
- Veri süreç belleğinde tutulur; uygulama tek süreç varsayar. İki süreç aynı veritabanında çalışırsa çift gönderim engeli geçerli olmaz.
- Şablon denetimi değişken yerlerine yazılan metni tanımaz; personel bu alanlara (en çok 300 karakter) kısa serbest metin koyabilir.
- Şablona uymayan metin uygulama içi bildirim olarak gidebilir. Metin gönderim kaydında izlenebilir.
- Duyurunun SMS yedeği yalnızca satır oluşurken push kapalı veliye gider; abonelik sonradan geçersizleşirse SMS'e düşmez (duyuru olayı varsayılanı "uygulama").
- Veli portaldan çıkınca cihaz aboneliği silinmez (Bölüm 11 istemcisinin uç noktayı bildirmesi gerekir).
- Unicode karakter içeren şablonlarda (“ ” —) maliyet ihtiyatlı hesaplanır; Netgsm `dil=TR` faturası farklı olabilir.
- Gönderim aralığı olay bazında değil, kurum genelindedir.

## Açık sorular
1. **Öğretmene etüt onay/hatırlatma bildirimi:** personel bildirim kanalı yok (push aboneliği ve `Gonderim.veliId` yalnızca veli için). *Öneri:* yeni kanal kurmadan öğretmenin takvim ekranında göstermek; gerekirse ileride personel push'u ayrı iş olarak ele alınsın.
2. **Devamsızlık ve SMS izni:** doküman devamsızlığın "herkese kesin ulaşmalı" olduğunu söylüyor, ama izni kapatan veliye SMS gitmiyor. *Öneri:* izne uyulsun (07, 08, 09 kararlarıyla tutarlı); izin kapatılırken ekranda uyarı gösterilsin.
3. **Ders iptali ve acil duyurular gece beklesin mi?** Şu an aralık dışında bekliyor. *Öneri:* doküman gereği beklesin; gece iptali için sabah gönderim yeterli.
4. **Takılı satır:** iletildiği bilinmiyor, otomatik tekrar yok. *Öneri:* böyle kalsın; çift SMS, eksik SMS'ten sonra personelce düzeltilebilir.
5. **Netgsm kimliği URL'de gidiyor (GET).** *Öneri:* sağlayıcı hesabı netleşince Netgsm'in başlıkla kimlik doğrulayan API'sine geçilsin.
6. **Serbest metinli uygulama bildirimi:** şablona uymayan satırın tamamen reddi önceki bölümlerin test verilerini de değiştirmeyi gerektirir. *Öneri:* ayrı temizlik işiyle reddedilsin.
