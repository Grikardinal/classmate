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
- Çakışma: tatil, öğretmenin randevusu, öğretmenin grup dersi, aynı öğrencinin başka randevusu.
- Online link `http(s)` ile başlar; diğer türlerde link boştur.
- Öğretmen yalnızca kendi adına ve kendi gruplarındaki öğrenciye randevu verir. `olusturan` sunucudan gelir.

**Randevu durumu** (`randevuDurumEngeli`)
- Var olan randevuda yalnızca durum değişir. Planlıdan bir kez çıkılır; sonuçlanan değişmez.
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
- "Veliye bilgi ver" aynı kalan hak için bir kez gider.

## Testler
`npx vitest run src/bolumler/09-etut` (`app/` içinde). Kurallar ve politika testlerinde saat sabittir. Veli API testleri gömülü veritabanında çalışır; tarihi gerçek bugünden ileriye doğru hesaplar.

## Bilinen sınırlar
- Veliye giden `doluSaatler` haftalık şablondur: tek seferlik iptal edilen ders veliye dolu görünür, sunucu ise o slotu kabul eder (slot yalnızca gizlenir, hatalı kayıt oluşmaz).
- Şube müdürü dışındaki personel, başka şubedeki programı görmez; ekran slotu boş gösterebilir, sunucu reddeder.
- Paket satışının taksiti `no: 99` ile ek kalem olarak yazılır (mevcut davranış).

## Açık sorular
1. **Öğrencinin kendi grup dersiyle çakışma.** Şu an yalnızca öğretmenin grup dersi denetleniyor. Öneri: öğrencinin grup dersi saatine randevu engellensin.
2. **Grup etüdü kontenjanı.** Modelde üst sınır yok. Öneri: `ayarlar` altına kurum geneli sınır (örn. 6) eklensin.
3. **Yönetimin iptalinde veliye bildirim.** Şu an gitmiyor, olay tanımı da yok. Öneri: `etutIptal` olayı eklensin; öğretmene de gitsin.
4. **Öğretmene onay ve hatırlatma.** Doküman "veli + öğretmen" diyor; personele bildirim kanalı yok, yalnızca veliye gidiyor. Öneri: Bölüm 10 / 13 personel bildirimi gelince bağlansın; o zamana kadar öğretmen takvimden izlesin.
5. **Yanlış işaretlenen sonucun düzeltilmesi.** Sonuçlanan randevu değişmiyor. Öneri: yalnızca yöneticiye, gerekçeyle ve paket hakkı iadesiyle düzeltme.
6. **Paket bitiyor bilgisinin otomatik gitmesi.** Doküman otomasyon sayıyor, şu an düğmeyle gönderiliyor. Öneri: kalan 1'e düşünce sunucu bir kez göndersin.
7. **Etüdün hak edişe etkisi.** Şu an etüt hak edişe yansımıyor. Öneri: yapılan etütler için kurum ayarıyla (ders başı ücret) dahil edilsin.
8. **Etüt yoklaması.** Doküman "07 ile aynı mantık" diyor; şu an randevu başına tek sonuç var, grup etüdünde öğrenci bazında kayıt yok. Öneri: grup etüdü için öğrenci bazında sonuç eklensin.
9. **Öğrenci ayrılınca planlı randevular.** Kayıt iptalinde randevu ve paket otomatik kapanmıyor. Öneri: Bölüm 04 iptal akışı planlı randevuları iptal etsin, paket iadesi finans kararına bağlansın.
