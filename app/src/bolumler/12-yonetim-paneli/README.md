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
| Aktif öğrenci | Durumu `aktif` olan kayıt. Dondurulmuş, iptal, mezun sayılmaz. "+N bu ay": bu ay kaydolup hâlâ aktif olanlar (içe aktarılanlar hariç) |
| Doluluk | Aktif kayıt / aktif sezon gruplarının kapasitesi. Kapasite 0 ise %0 |
| Devamsızlık | `devamsizlikOzeti`: gelmedi / (toplam − izinli). Kart: bu haftanın bugüne kadarki dersleri |
| Bu hafta işlenen | Yoklaması alınan / bugüne kadar planlanan ders (iptal ve tatil hariç) |
| Yoklaması alınmayan | Geçmiş gün veya bugün `yoklamaHatirlatmaDk` aşılmış ders |
| Aylık yeni kayıt | Son 6 ay; iptal edilen ve içe aktarılan (`iceAktarmaId`) kayıt sayılmaz. Tarih: kaydın `tarih` alanı. İçe aktarılanlar öğrenci toplamlarında sayılır |
| Bu ay tahsilat | Vadesi bu ay olan taksitlerin ödeneni / tutarı. Sezon süzmesi yok |
| Vadesi geçen | Vadesi dünden eski, kalanı olan taksitler; tüm sezonlar (borç silinmez), iptal ve dondurulmuş kaydın kalan borcu dahil |
| Vadesi gelen / geciken | Bugün vadeli veya geciken borcu olan tekil veli sayısı |
| Şube tahsilat oranı | Vadesi bugüne kadar gelmiş taksitlerin ödeneni / tutarı |
| Kontrol bekleyen ödev | Yönetim: aktif sezon, teslimi gelmiş, kontrol edilmemiş. Öğretmen: `odevKontrolEdebilir` |

**Ters kayıtlar.** Panel finansı taksit üzerinden hesaplar: tahsilat iptali taksitin ödenenini geri alır, kayıt iptali tutarı düşürür; ayrıca düşülmez. Kasa raporu `kasaHareketleri`ni kullanır, Kasa ekranıyla aynıdır: iptal, iptal gününe ters kayıt olarak düşer; iade çıkıştır. Tarih aralığı hareketin kendi gününe uygulanır: aslı aralık dışında kalan bir iptalin ters kaydı aralıkta görünür. Varsayılan aralık boştur (tüm hareketler); başlangıç bitişten sonraysa satır üretilmez, dışa aktarma kapanır.

## Rol ve görünürlük
- Finans kartları ve raporları: modül açık + 05 yetkisi + genel yönetici veya şube müdürü (`finansPanelGorur`). Sekreter 05 yetkisiyle finans ekranını kullanabilir ama panelde finans görmez (doküman).
- Kart ve bağlantılar: ilgili bölüm yetkisi yoksa kart tıklanmaz; ön kayıt, etüt, ödev, yoklama satırları gizlenir.
- Raporlar bölüm yetkisine bağlıdır: öğrenci 04, devamsızlık ve ders kaydı 07, ön kayıt 03, ödev 08, mesaj 10, finans 05. Doluluk raporu kişisel veri içermez, yetki istemez. Sekme 12 yetkisine bağlıdır.
- İşlem kaydındaki tutarlı işlemler (`finansIslemiMi`) finans görmeyene sunucudan gitmez; panelde sekretere de gösterilmez.
- Genel Merkez kasası kasa raporunda yalnızca genel yöneticiye, tüm şubeler görünümünde çıkar.
- Şubesiz işlem kaydı yalnızca tüm kapsam seçiliyken görünür.

## Dışa aktarma
- CSV temizliği ortaktır (`lib/kurallar.ts · csvHucre`; `csvOlustur` her hücreye uygular, 07 ve 14 dahil): `=`, `+`, `-`, `@` ile başlayan metnin başına `'` eklenir. Yalnızca rakam ve ayraçtan oluşan değerler (`-5`, `+90 532 ...`) bozulmaz. Ondalık ayraç virgüldür.
- İçe aktarmada (`csvCoz`, `xlsxOku`) `csvOnekiniKaldir` öneki geri alır; `'` veriye girmez.
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

## Kapandı (2026-11-09)
Kararlar: `docs/PROFESYONELLESME.md`.
1. **Aylık beklenen ve tahsil edilen grafiği:** Finans canlıya almada eklenecek; şimdilik kod değişikliği yok.
2. **Kasa raporunda tarih aralığı:** eklendi.
3. **CSV temizliği:** `lib/kurallar.ts`'e taşındı, her dışa aktarmada geçerli.
4. **İçe aktarılan kayıtlar:** yeni kayıt grafiğinden ve "bu ay" sayacından çıkarıldı; öğrenci toplamlarında kalır.
5. **"+N bu ay":** olduğu gibi kaldı.
6. **Sekreterin 05 yetkisi:** Bölüm 14'e devredildi.
