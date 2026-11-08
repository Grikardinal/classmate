# Bölüm 09 · Etüt ve birebir ders

Gereksinim: `docs/bolumler/09-etut-ve-birebir-ders.md`. Plan ve kullanıcı kararları: `docs/PROFESYONELLESME.md`.

## Amaç
Grup dersleri dışındaki ek destek derslerini planlamak: öğretmen müsaitliği, yönetimden veya veli portalından randevu, randevu sonucu, özel ders paketi ve kalan hak. `moduller.etut` ile açılıp kapanır.

## Dosyalar
| Dosya | İçerik |
|---|---|
| `index.tsx` | Sekmeli sayfa (default export `Etut`). `bosSlotlar`, `etutTurAd` buradan da dışa verilir (Bölüm 11 kullanıyor) |
| `Takvim.tsx` | Haftalık takvim, randevu oluşturma penceresi |
| `Randevular.tsx` | Randevu listesi, sonuç işaretleme, iptal |
| `Musaitlikler.tsx` | Müsaitlik ekleme, silme |
| `Paketler.tsx` | Özel ders paketleri, "bitmek üzere" bilgisi |
| `SonucDialog.tsx` | Grup etüdünde öğrenci bazında sonuç, yönetici düzeltmesi |
| `ortak.ts` | Durum rozeti, tarih biçimi |
| `kurallar.ts` | **Saf iş kuralları** (ekran, portal, sunucu ortak; yalnızca göreli içe aktarma) |
| `kurallar.test.ts`, `sunucu.test.ts` | Birim testleri; `yazmaDenetle → etutDenetle`, okuma, otomasyon, veli API testleri |

Sunucu: `app/server/politika.ts · etutDenetle`, `okumaSuz`, `veliVerisi`; `app/server/uygulama.ts · /api/veli/randevu`, `/api/veli/randevu/:id/iptal`. Otomasyon: `app/server/zamanlayici.ts`.

## İş kuralları
**Müsaitlik** (`musaitlikEngeli`)
- Gün 1–7, geçerli saat, başlangıç < bitiş, en az 40 dakika.
- Öğretmen aktif ve o şubede görevli, şube aktif.
- Aynı öğretmenin aynı gündeki aralıkları, şube farklı olsa da çakışamaz. Bitişik aralık serbesttir.

**Boş slot** (`bosSlotlar`)
- Müsaitlik 40 dakikalık slotlara bölünür. Şunlar düşer: öğretmenin iptal edilmemiş randevusu (tüm şubeler), yapılan grup dersi, şube tatili, geçmiş saat, pasif öğretmen veya şube.

**Yeni randevu** (`randevuYeniEngeli`; ekran, veli API ve `etutDenetle` aynı kuralı çalıştırır)
- Slot müsaitlik ızgarasında, süre 40 dakika, başlangıç gelecekte.
- Bireysel, online, özel tek öğrenci; grup etüdü bir veya daha çok öğrenci. Öğrenciler aktif ve bu şubede kayıtlı.
- Çakışma: tatil, öğretmenin randevusu, öğretmenin grup dersi, aynı öğrencinin başka randevusu ve kendi grup dersi. Grup etüdü kontenjanı aşılamaz.
- Online link `http(s)` ile başlar; diğer türlerde link boştur.
- Öğretmen yalnızca kendi adına ve kendi gruplarındaki öğrenciye randevu verir. `olusturan` sunucudan gelir.

**Randevu durumu** (`randevuDurumEngeli`)
- Var olan randevuda yalnızca sonuç değişir. Planlıdan bir kez çıkılır; sonuçlanan randevu yalnızca gerekçeli yönetici düzeltmesiyle değişir (bkz. Kararlar 4).
- Yapıldı / gelmedi başlangıç saatinden sonra işaretlenir. İptal her zaman yapılabilir; başlamış randevuyu öğretmen iptal edemez. Randevu silinemez.

**Paket**
- Kullanılabilir hak = kalan − planlı randevular. Aynı hak iki randevuya verilmez.
- Randevu yapıldıysa hak düşer; gelmediyse `ayarlar.gelmeyenHakDussun` belirler; iptalde düşmez.
- Kalan hakkı sunucu yazar. İstemcinin bayat değeri esas alınmaz, sonuçsuz hak değişikliği reddedilir. Paket tanımı değişmez.
- Paketli randevunun dersi paketin dersidir.
- Paketi öğretmen satamaz. Finans açıksa ücret aynı işlemde ödeme planına eklenir; kapalıyken ücret 0'dır (paket yalnızca hak sayısıdır).

**Veli**
- Yalnızca kendi çocuğu, çocuğun şubesi. Kurallar yazma kuyruğunun içinde değerlendirilir; aynı anda gelen ikinci istek 409 alır.
- Paket hakkı varsa randevu özel ders olur ve paketin dersini alır.
- İptal `ayarlar.etutIptalSaat` saat öncesine kadar (sınır dahil). Grup etüdünde yalnızca kendi çocuğu çıkar; son öğrenci çıkınca randevu iptal olur.

**Görünürlük**
- Veliye başka öğrencinin randevusu kimliksiz gider (öğrenci, ders, tür, link, paket yok). Öğretmenin grup dersleri yalnızca gün ve saat olarak gider (`doluSaatler`). Başka şubenin müsaitliği ve öğretmeni gitmez. Modül kapalıyken etüt verisi gitmez; finans kapalıyken paket ücreti gitmez.
- Öğretmen yalnızca kendi randevu, müsaitlik ve paketini görür. Paket ücreti finans görmeyen rollere 0 gider. Randevusundaki başka grubun öğrencisini yalnızca adıyla görür.

**Bildirim**
- Randevu onayı `etutHatirlatma` olayıyla birincil veliye gider ve randevuya bağlanır (`Gonderim.randevuId`). Karşılığı olmayan bildirim düşer; aynı veliye ikinci onay gitmez. SMS izni kapalı veliye SMS gitmez.
- 1 saat kala hatırlatma her randevu için bir kez üretilir, SMS iznine uyar.
- Yönetim iptali ve "paket bitiyor" bildirimleri için bkz. Kararlar 3 ve 5.

## Testler
`npx vitest run src/bolumler/09-etut` (`app/` içinde). Kurallar ve politika testlerinde saat sabittir. Veli API testleri gömülü veritabanında çalışır; tarihi gerçek bugünden ileriye doğru hesaplar.

## Bilinen sınırlar
- Veliye giden `doluSaatler` haftalık şablondur: tek seferlik iptal edilen ders veliye dolu görünür, sunucu ise o slotu kabul eder (slot yalnızca gizlenir, hatalı kayıt oluşmaz).
- Şube müdürü dışındaki personel, başka şubedeki programı görmez; ekran slotu boş gösterebilir, sunucu reddeder.
- Paket satışının taksiti `no: 99` ile ek kalem olarak yazılır (mevcut davranış).

## Kararlar (2026-11-08)
**Kapandı (2026-11-08)**
1. **Öğrencinin kendi grup dersiyle çakışma:** engellenir (`ogrenciDersiCakisir`). Tatil veya iptal günündeki ders sayılmaz. Portal bu slotları göstermez.
2. **Grup etüdü kontenjanı:** `ayarlar.etutGrupKontenjan`, alan yoksa 6, 1–50 arası. Ayar Bölüm 14 Sistem ayarlarında; yalnızca genel yönetici değiştirir.
3. **Yönetim iptalinde bildirim:** `etutIptal` olayını sunucu üretir, randevuya bağlar, SMS iznini uygular. İstemci bu olayı yazamaz. Veli kendi iptal edince gitmez. Eksik olay `veriyiOnar` ile eklenir.
4. **Sonuç düzeltme:** yalnızca şube müdürü veya genel yönetici, en az 3 karakter gerekçeyle. Hak sunucuda iade edilir veya düşülür. Gerekçe, kim, ne zaman `Randevu.duzeltmeler` içinde; işlem kaydına yazılır. İptale çevrilemez.
5. **Paket bitiyor:** kalan hak 1'e düşünce sunucu `paketBitiyor` olayını gönderir. Paket başına bir kez gider; hak iadesinden sonra tekrar 1'e düşerse gitmez. "Veliye bilgi ver" düğmesi aynı tekilleştirmeye dahildir.
6. **Öğrenci bazında sonuç:** `Randevu.sonuclar`; en az bir öğrenci geldiyse randevu "yapıldı" sayılır. Grup etüdünde her öğrencinin paketi `Randevu.paketIds` ile ayrı işlenir (paketin dersi randevunun dersi olmalı). Alan yoksa durum tüm öğrencilere uygulanır. Veliye yalnızca kendi çocuğunun sonucu gider, düzeltme gerekçesi gitmez.
7. **Kayıt iptali** (`etutKayitIptali`): öğrencinin başka süren (aktif, dondurulmuş) kaydı yoksa planlı randevuları sunucu kapatır; grup etüdünden yalnızca o çıkar. Finans açıksa kullanılmamış hak bedeli = ücret × kalan / toplam (`iptalPaketOzeti`). Paket taksitinde ödenen, kullanılan bedeli aşıyorsa fark `IptalHesabi.paketIade` olarak iadeye eklenir, kalan borç varsa ondan mahsup edilir. Ödenmemiş kısım taksitten silinir, paketin kalan hakkı sıfırlanır. Taksiti bulunamayan eski paketten iade çıkmaz. Finans kapalıysa veya kullanıcı iptal hesabı görmüyorsa yalnızca randevular kapanır.

**Bölüm 10 / 13'e devredildi**
- **Öğretmene onay ve hatırlatma** (Bölüm 10): personel bildirim kanalıyla birlikte değerlendirilecek. O zamana kadar öğretmen takvimden izler.
- **Etüdün hak edişe yansıması** (Bölüm 13): kurum ayarıyla ders başı ücret.
