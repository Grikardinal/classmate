# Bölüm 12 · Yönetim paneli ve raporlar

Gereksinim: `docs/bolumler/12-yonetim-paneli-ve-raporlar.md`. Plan ve kullanıcı kararları: `docs/PROFESYONELLESME.md`.

## Amaç
Yöneticinin paneli açtığında kurumun durumunu ve yapılacakları görmesi; öğretmenin kendi işlerini görmesi; raporların süzülüp Excel/PDF alınması. Bölüm veri yazmaz.

## Dosyalar
| Dosya | İçerik |
|---|---|
| `index.tsx` | Sayfa (default export), sekmeler, öğretmene yönlendirme |
| `KarsilamaBandi.tsx` | Selamlama, günün özeti, hızlı işlemler |
| `Panel.tsx` | Kartlar, bugün yapılacaklar, grafikler, son işlemler, şube karşılaştırma |
| `OgretmenPaneli.tsx` | Öğretmenin paneli |
| `Raporlar.tsx` | Rapor seçimi, önizleme, CSV, yazdırma |
| `raporTanimlari.ts` | Rapor tanımları, `raporListesi` (rol/yetki/modül), `raporCsv` |
| `kurallar.ts` | **Saf hesaplar** (ekran ve sunucu ortak; yalnızca göreli içe aktarma) |
| `kurallar.test.ts`, `sunucu.test.ts` | Hesap testleri; `okumaSuz` çıktısıyla rol ve şube testleri |

Sunucu: `app/server/politika.ts · okumaSuz` (asıl sınır). Ekrandaki süzme yalnızca görünümdür.

## Hesap tanımları
Tümü aktif sezon ve seçili şubelerle sınırlıdır (aksi yazılmadıysa).

| Değer | Tanım |
|---|---|
| Aktif öğrenci | Durumu `aktif` olan kayıt. Dondurulmuş, iptal, mezun sayılmaz. "+N bu ay": bu ay kaydolup hâlâ aktif olanlar |
| Doluluk | Aktif kayıt / aktif sezon gruplarının kapasitesi. Kapasite 0 ise %0 |
| Devamsızlık | `devamsizlikOzeti`: gelmedi / (toplam − izinli). Kart: bu haftanın bugüne kadarki dersleri |
| Bu hafta işlenen | Yoklaması alınan / bugüne kadar planlanan ders (iptal ve tatil hariç) |
| Yoklaması alınmayan | Geçmiş gün veya bugün `yoklamaHatirlatmaDk` aşılmış ders |
| Aylık yeni kayıt | Son 6 ay; iptal edilen kayıt sayılmaz. Tarih: kaydın `tarih` alanı |
| Bu ay tahsilat | Vadesi bu ay olan taksitlerin ödeneni / tutarı. Sezon süzmesi yok |
| Vadesi geçen | Vadesi dünden eski, kalanı olan taksitler; tüm sezonlar (borç silinmez), iptal ve dondurulmuş kaydın kalan borcu dahil |
| Vadesi gelen / geciken | Bugün vadeli veya geciken borcu olan tekil veli sayısı |
| Şube tahsilat oranı | Vadesi bugüne kadar gelmiş taksitlerin ödeneni / tutarı |
| Kontrol bekleyen ödev | Yönetim: aktif sezon, teslimi gelmiş, kontrol edilmemiş. Öğretmen: `odevKontrolEdebilir` |

**Ters kayıtlar.** Panel finansı taksit üzerinden hesaplar: tahsilat iptali taksitin ödenenini geri alır, kayıt iptali tutarı düşürür; ayrıca düşülmez. Kasa raporu `kasaHareketleri`ni kullanır, Kasa ekranıyla aynıdır: iptal, iptal gününe ters kayıt olarak düşer; iade çıkıştır.

## Rol ve görünürlük
- Finans kartları ve raporları: modül açık + 05 yetkisi + genel yönetici veya şube müdürü (`finansPanelGorur`). Sekreter 05 yetkisiyle finans ekranını kullanabilir ama panelde finans görmez (doküman).
- Kart ve bağlantılar: ilgili bölüm yetkisi yoksa kart tıklanmaz; ön kayıt, etüt, ödev, yoklama satırları gizlenir.
- Raporlar bölüm yetkisine bağlıdır: öğrenci 04, devamsızlık ve ders kaydı 07, ön kayıt 03, ödev 08, mesaj 10, finans 05. Doluluk raporu kişisel veri içermez, yetki istemez. Sekme 12 yetkisine bağlıdır.
- İşlem kaydındaki tutarlı işlemler (`finansIslemiMi`) finans görmeyene sunucudan gitmez; panelde sekretere de gösterilmez.
- Genel Merkez kasası kasa raporunda yalnızca genel yöneticiye, tüm şubeler görünümünde çıkar.
- Şubesiz işlem kaydı yalnızca tüm kapsam seçiliyken görünür.

## Dışa aktarma
- CSV: `=`, `+`, `-`, `@` veya sekmeyle başlayan metin hücresinin başına `'` eklenir (`csvHucre`). Sayı hücrelerine dokunulmaz, ondalık ayraç virgüldür (Türkçe Excel `12.5`i tarihe çeviriyordu).
- Yazdırma HTML kaçışlıdır; açılır pencere engellenirse uyarı çıkar.

## Testler
`npx vitest run src/bolumler/12-yonetim-paneli`
- `kurallar.test.ts`: selamlama, ay sınırı, durum ve sezon süzmesi, sıfıra bölme, izinli kuralı, finans toplamları, tekil veli, şube karşılaştırma, son işlemler, CSV.
- `sunucu.test.ts`: `okumaSuz` çıktısıyla rapor listesi, şube sızıntısı, kasa ters kayıtları, Genel Merkez, eski sezon, boş kurulum.

## Bilinen sınırlar
- "+N bu ay" önceki aya göre gerçek fark değildir: kayıtta iptal/dondurma tarihi tutulmadığı için bu ay ayrılanlar düşülemez.
- Şube süzmesi tek şube seçildiğinde tahsilat oranı tüm sezonların taksitlerini içerir.
- Grafik bileşeni tek serilidir.
- Önizleme ilk 25 satırdır; dosyada tümü vardır.
- `14-altyapi/index.tsx` içinde `AKTIF_SEZON === "z2"` sabiti duruyor (bu bölümün dışında).

## Açık sorular
1. **"Aylık beklenen vs. tahsil edilen" grafiği** dokümanda var, kodda yok; iki serili grafik yeni bileşen ister. Öneri: Finans modülü canlıya alınınca ekleyelim.
2. **Kasa raporunda tarih aralığı** dokümanda var, kodda yok. Öneri: ekleyelim; büyük veride dosya boyutunu da düşürür.
3. **`csvOlustur` ortak** ve 07 (ders kayıtları, devamsızlık) ile 14 (işlem kaydı, dışa aktarım) dosyaları hâlâ temizlemeden yazıyor. Öneri: `csvHucre` mantığını `lib/kurallar.ts`'e taşıyıp hepsine uygulayalım; 14'ün içe aktarma şablonu ayrıca denenmeli.
4. **İçe aktarılan kayıtlar** "aylık yeni kayıt"ta içe aktarma ayında toplu görünür. Öneri: `iceAktarmaId` taşıyanları grafikten çıkaralım.
5. **"Önceki aya göre değişim"** için kayıtta durum değişikliği tarihi gerekir. Öneri: şimdilik "+N bu ay" kalsın; gerçek fark istenirse kayıt şemasına çıkış tarihi eklensin.
6. **Sekreterin 05 yetkisi** varsayılan açık: finans verisi sunucudan gelir, panelde gizlenir. Öneri: doküman kuralı korunsun; panel yalnızca yönetim içindir.
