# 10 · İletişim ve Bildirimler

**Sürüm:** MVP (SMS + duyuru) · v2 (WhatsApp, mesajlaşma) · **Kurspro karşılığı:** SMS Bildirimleri, WhatsApp Business, Sohbet, Anket

## Amaç
Diğer bölümlerin ürettiği olayları (devamsızlık, ödeme, ödev, ders iptali) veliye doğru kanaldan,
doğru metinle ve doğru zamanda ulaştırmak. Sistemin "otomasyon" hissini veren bölüm budur.

## Kanallar
| Kanal | Kullanım | Sürüm |
|---|---|---|
| **Uygulama içi bildirim** | Veli portalı / PWA push | MVP |
| **SMS** | Kritik ve herkese ulaşması gerekenler | MVP |
| **WhatsApp Business API** | Hatırlatmalar, duyurular, makbuz | v2 |
| E-posta | Makbuz, aylık özet (opsiyonel) | v2 |

## Kanal kararı (2026-10-09)
Kurum ücret almadığı için **maliyet** belirleyici. Seçim:

1. **Uygulama içi bildirim (PWA push) — ana kanal, ücretsiz.** Veli portalını telefonuna ekleyen herkes alır.
2. **SMS — yalnızca kritik durumlar ve yedek:**
   - Giriş kodu (OTP)
   - Devamsızlık bildirimi (çocuk güvenliği; herkese kesin ulaşmalı)
   - Ders iptali / acil duyuru
   - Push bildirimini açmamış velilere yedek gönderim
3. **WhatsApp — v2'de değerlendirilecek.** Velilerin en çok kullandığı kanal ama Meta işletme doğrulaması,
   onaylı şablonlar ve mesaj başı ücret gerektiriyor; MVP için gereksiz yük.

**Neden?**
- Push ücretsiz; SMS mesaj başı ücretli. Rutin bildirimleri (ödev, duyuru, etüt) push'a vermek SMS maliyetini en aza indirir.
- iPhone'da web push yalnızca portal ana ekrana eklenince çalışır (iOS 16.4+); bu yüzden kritik mesajlarda SMS yedeği şart.
- Giriş kodu SMS'i maliyetini düşürmek için "beni hatırla" ile uzun oturum (örn. 90 gün) kullanılır.
- Devamsızlık ve ders iptali gibi bilgilendirme mesajları İYS izni gerektirmez; tanıtım mesajı gönderilmeyecek.

## Bildirim merkezi
Tüm otomatik mesajlar tek tabloda yönetilir:

| Olay | Varsayılan kanal | Açık/Kapalı | Şablon |
|---|---|---|---|
| Devamsızlık | uygulama + SMS | ✔ | "{öğrenci} bugün {saat} {ders} dersine katılmadı. {şube_adı}" |
| Ders iptali/değişikliği | uygulama + SMS | ✔ | … |
| Hoş geldiniz / portal daveti | SMS | ✔ | … (portala giriş linki) |
| Yeni ödev | uygulama | ✔ | … |
| Etüt hatırlatma | uygulama | ✔ | … |
| Duyuru | uygulama (+ isteğe bağlı SMS) | ✔ | … |
| Taksit hatırlatma (vade -3 gün) | uygulama + SMS | *Finans açıksa* | … |
| Gecikmiş ödeme | uygulama + SMS | *Finans açıksa* | … |
| Ödeme alındı | uygulama | *Finans açıksa* | … |

"uygulama + SMS": push gönderilir; veli push'u etkinleştirmemişse SMS gider (yedek mantığı).

Yönetici her olayı açıp kapatabilir, metni değiştirebilir, gönderim saat aralığını sınırlayabilir (örn. 08:00–21:00).

## Duyurular
- Hedef: tüm veliler / **şube** / seviye / grup / seçili kişiler
- Şube personeli yalnızca kendi şubesine duyuru gönderebilir; kurum geneli duyuru genel yöneticide
- Mesajlarda `{şube_adı}`, `{şube_telefonu}` değişkenleri (veli doğru şubeyi arasın)
- Kanal seçimi, zamanlanmış gönderim, okundu bilgisi (uygulama içi)
- Örnek: "Cumartesi resmi tatil nedeniyle ders yapılmayacaktır."

## Mesajlaşma (v2)
- Veli ↔ öğretmen / yönetim birebir mesaj (Kurspro'daki sohbet ekranı)
- Öğretmenin kişisel numarasını paylaşmadan iletişim
- Sınıf grubu sohbeti **yok** (moderasyon yükü; bilinçli karar, sonra değerlendirilebilir)

## Anket (v2)
- Dönem sonu veli memnuniyet anketi, sonuç istatistikleri

## Gönderim kaydı
Her mesaj: alıcı, şube, kanal, metin, gönderim zamanı, durum (iletildi/başarısız), maliyet.
SMS maliyeti şube bazında raporlanır.

## Yasal notlar
- **İYS (İleti Yönetim Sistemi):** tanıtım/kampanya mesajları için izin zorunlu; bilgilendirme mesajları (devamsızlık, ödeme) muaf ama ayrımı doğru yapılmalı.
- SMS başlığı (originator) için operatör başvurusu gerekir.
- WhatsApp Business API için Meta işletme doğrulaması ve onaylı şablonlar gerekir; mesaj başı ücretlidir.

## Açık sorular
- ~~Kanal tercihi~~ → Push ana kanal + kritik durumlarda SMS; WhatsApp v2 (2026-10-09)
- Kurumun mevcut bir SMS hesabı / başlığı var mı? Yoksa SMS sağlayıcısı seçilecek (maliyet karşılaştırması teknoloji seçimiyle birlikte).
