# Bölüm 05 · Finans: ödeme planı, tahsilat ve kasa

Gereksinim: `docs/bolumler/05-finans.md`. Plan ve kullanıcı kararları: `docs/PROFESYONELLESME.md`.

## Amaç
Kim ne kadar borçlu, ne zaman ödeyecek, kim gecikti, kasada ne var: tek bakışta görmek ve hatırlatmaları otomatikleştirmek.
Modül **varsayılan olarak kapalıdır** (`moduller.finans`, karar 2026-10-09). Kurum ücret almıyor; modül ücret alan kurumlar
için **Ayarlar → Modüller** ekranından açılır. Kapalıyken finans ekranları gizlenir, sunucu finans verisi göndermez ve yazdırmaz.

## Dosyalar
| Dosya | İçerik |
|---|---|
| `index.tsx` | Sekmeli sayfa (default export `Finans`; `main.tsx` tembel yükler, başka bölüm bu dosyadan içe aktarmıyor) |
| `ortak.tsx` | Sekme tipi, tarih biçimi, kasa etiketi, kayıt durumu etiketi, taksit tablosu |
| `Ozet.tsx` | Bu ay beklenen / tahsil edilen, vadesi geçen, aktif sezonun aylık grafiği, şube karşılaştırma, bu hafta vadesi gelenler |
| `HizliTahsilat.tsx` | Veli/öğrenci arama, kardeşlerin açık taksitleri, tahsilat + makbuz, tahsilat geçmişi, tahsilat iptali |
| `Gecikenler.tsx` | Vadesi geçenler (veli bazında), tekil ve toplu hatırlatma |
| `Kasa.tsx` | Kasa bakiyeleri, hareketler, gün sonu raporu, gider girişi, virman; gider / virman / iade iptali |
| `IndirimOnaylari.tsx` | Yönetici onayı bekleyen indirimler (Özet sekmesinde) |
| `kurallar.ts` | **Saf iş kuralları** (ekran + sunucu ortak, yalnızca göreli içe aktarma) |
| `kurallar.test.ts`, `sunucu.test.ts` | Testler |

Bölüm dışı değişen dosyalar: `server/politika.ts` (`finansDenetle`, `finansGorur`, okuma maskesi, nakil devri),
`server/veritabani.ts` (`veriyiOnar`), `server/uygulama.ts` (yedek geri yüklemede onarım, açılışta kalıcı çevirme, boş kurulum),
`server/zamanlayici.ts` (hatırlatma kuralı), `src/data/mock.ts` + `src/data/model.ts` (fiyat listesi modeli),
Bölüm 01 (`kurallar.ts`, `FiyatListesi.tsx`, `Sezonlar.tsx`, `Subeler.tsx`), Bölüm 04 (`KayitSihirbazi.tsx`, `KayitIslemleri.tsx` uyarı metni).

## Kullanıcı kararları (2026-11-07)
### 1. Fiyat listesi: sezon + şube + seviye
- Model: `fiyatListesi: { sezonId, subeId, seviye, fiyat }[]` (Bölüm 01 kuralları: `fiyatBul`, `fiyatListesiDogrula`).
  Fiyat negatif olmayan, kuruş hassasiyetinde; aynı üçlü bir kez; sezon ve şube var olmalı. **Tanımsız hücre = fiyat yok**, 0 = ücretsiz.
- **Eski veri / yedek uyumu:** eski biçim (`{ şubeId: fiyat }`) okunduğunda `fiyatListesiNormalize` ile çevrilir: eski tek fiyat o şubenin
  **var olan her sezonuna ve her seviyesine (3–8)** yazılır (eski anlamı buydu). Sonradan eklenen sezonun fiyatı ayrıca girilir.
  Çeviri `server/veritabani.ts · veriyiOnar` içinde, hem veritabanından yüklemede (`hepsiniYukle`) hem yedekten geri yüklemede
  (`POST /api/yedek`, yazmadan önce) yapılır; sunucu açılışında çevrilen hal veritabanına kalıcı yazılır. Yeni yazmada eski biçim reddedilir.
- **Fiyat listesi ekranı** (Bölüm 01 sekmesi): sezon seçilir, şube × seviye tablosu düzenlenir; kayıt yalnızca o sezonun satırlarını değiştirir.
  Yeni şube sihirbazı kaynak şubenin tüm fiyatlarını kopyalar.
- **Kayıt sihirbazı:** liste fiyatı = `fiyatBul(aktif sezon, şube, seçilen grubun seviyesi)`; fiyat tanımsızsa Ücret adımı ilerlemez.
  Sunucu yeni ücretli kaydın liste fiyatını fiyat listesiyle karşılaştırır.

### 2. Sezon geçişinde fiyat
- Taşınan kayda eski kaydın **fiyatı, indirimi ve ek hizmeti kopyalanmaz**; hedef sezonun şube + **yeni seviye** fiyatı uygulanır
  (`listeFiyati = net = hedef fiyat`, indirim ve ek hizmet boş). Finans kapalıysa ücret 0.
- **Hedefte fiyat tanımlı değilse (seçilen güvenli davranış): geçiş uyarıyla durur.** `sezonGecisFiyatEngeli` eksik şube/seviyeleri
  listeler ("Hedef sezonda fiyatı tanımlı olmayan şube/seviye var: MRK 6. sınıf…"), "Geçişi başlat" devre dışı kalır; `sezonGecisiPlani`
  aynı durumda hata fırlatır. Gerekçe: fiyatsız kayıt açmak sonradan fark edilmeyen ücretsiz kayıtlar doğurur; geçiş tek seferliktir
  (hedefte grup oluşunca tekrarlanamaz), bu yüzden eksik fiyatla kısmi geçiş yerine önce fiyatın girilmesi istenir.
  Öğrenci taşınmıyorsa veya finans kapalıysa fiyat aranmaz. Ödeme planı geçişte oluşturulmaz (yeni sezonda yeniden alınır).

## Kullanıcı kararları (2026-11-08)
### İade ve cayma bedeli (kayıt iptali)
Finans açıksa ve kaydın ödeme planı varsa Bölüm 04 iptal ekranı **iptal hesabını** önizler; kayıt `iptalHesabi` alanında saklar.
- **Plan toplamı:** ödeme planı taksitleri (ek kalemler, no ≥ 99, hesaba girmez, borç olarak kalır).
- **Kullanılan (hak edilmiş) tutar — seçilen yöntem takvim günü oranı** (`kullanilanTutar`): hizmet başlangıcı (kayıt tarihi, sezon başlangıcından önceyse sezon başlangıcı)
  ile sezon bitişi arasındaki günlerin iptal gününe kadar (dahil) geçen oranı × plan toplamı. Gerekçe: tek ve açık formül, ders programı veya
  yoklama verisine bağlı değil, veliye anlatılabilir. Sezon bilinmiyorsa tamamı kullanılmış sayılır (yönetici düzeltebilir).
- **Cayma bedeli:** `kurum.caymaBedeli` (yüzde veya sabit; yoksa 0). Ayar: Bölüm 01 → Fiyat listesi sekmesinin altı. Yüzde plan toplamı üzerindendir; bedel plan toplamını aşmaz.
- **Hak = min(plan toplamı, kullanılan + cayma).** Ödenen hak'tan fazlaysa **iade = ödenen − hak** (iade ödeneni aşamaz); taksitler ödenen tutarda kapanır.
  Eksikse **kalan borç = hak − ödenen**, en eski vadeli açık taksitlerde kalır; geri kalan taksitler kapatılır (tutar = ödenen, ödenmemişse 0).
- **İade kaydı** (`iadeler`): kasadan çıkış (yönteme göre kasa), makbuz no `ŞUBEKODU-I-00001`, yapan ve zaman sunucudan.
  Yalnızca iptal paketinde, hesaptaki tutarda oluşur; silinemez, değiştirilemez. **İade iptali** tahsilat iptaliyle aynı desen: yönetici, gerekçe, iptal gününe ters kayıt (Kasa sekmesi).
- **Yetki:** kullanılan / cayma düzeltmesi yalnızca yönetici ve en az 3 karakter gerekçeyle. **İade çıkan iptali yalnızca yönetici yapar** (doküman: iade yetkisi yöneticide);
  iade çıkmayan iptali sekreter de yapabilir (hesaplanan tutarlarla).
- **Uyum:** finans kapalıysa veya kullanıcı finans göremiyorsa hesap yazılmaz, Bölüm 04 iptali eskisi gibi çalışır (aday yeniden açılması dahil). `iptalHesabi` gönderilmeyen iptal
  (ör. KVKK anonimleştirmesi) önceki davranışı korur: borç kalır, otomatik hatırlatma gitmez.

### Sekreterin indirimi yönetici onayıyla
- Sekreter sihirbazda tanımlı indirimi seçer; kayıtta `bekleyenIndirim` olarak durur, **net ve plan indirimsiz** hesaplanır. Doğrudan uygulayamaz.
- Yönetici (şube müdürü, genel yönetici) doğrudan uygular. Bekleyenler **Finans → Özet** ekranında listelenir (kayıt kartında da görünür).
- **Onay:** indirim uygulanır, net yeniden hesaplanır, ödenmemiş kısım açık taksitlere eski kalanlarıyla orantılı dağıtılır (`planiYenidenDagit`, toplam = yeni net).
  Ödenen yeni neti aşıyorsa onay verilemez. **Ret:** talep kalkar. Onay kaydı (`indirimOnay`: karar, kim, ne zaman) sunucudan yazılır; sekreter onaylayamaz.

### Gider ve virman iptali
Yönetici en az 3 karakter gerekçeyle iptal eder (Kasa sekmesi); iptal geri alınamaz; iptal gününe ters kayıt düşer, geçmiş günlerin bakiyesi değişmez. Gider ve virman yine silinemez.

## İş kuralları
Tümü `kurallar.ts`'te; sunucu `server/politika.ts · finansDenetle` (yazmaDenetle sonunda) aynı fonksiyonlarla uygular.

### Tutarlar
- Tüm tutarlar TL, **kuruş hassasiyetinde**; karşılaştırmalar kuruş (tam sayı) üzerinden. Geçerli tutar: sonlu, en fazla iki ondalık,
  100 milyon TL altında (`tutarGecerli`). Ekran Türkçe yazımı çözer: `1.250,50`, `1250,5`, `1250.50` (`tutarCoz`).
- **Kayıt ücreti** (`kayitUcreti`): liste fiyatına indirim oranları toplamı (en fazla %100) uygulanır, kuruşa yuvarlanır, ek hizmetler
  indirimsiz eklenir. Net hiçbir zaman negatif olmaz. İndirimler yalnızca tanımlı türler (ad + oran aynı), her biri bir kez; ek hizmetler tanımlı ve tekil.
- **Ödeme planı** (`taksitPlani`, Bölüm 04): taksitlerin toplamı kuruşu kuruşuna nete eşittir (küsurat son taksitte); sunucu kayıtla gelen
  planı denetler (`planToplamEngeli`; ek kalemler, no ≥ 99, hariç).

### Kayıt ücreti (sunucu)
- Finans kapalıyken yeni kaydın ücret alanları sunucuda sıfırlanır, var olanınki değiştirilemez.
- Finans açıkken yeni ücretli kayıt: liste fiyatı fiyat listesindeki fiyat, net = `kayitUcreti`. Fiyat tanımsızsa kayıt açılmaz.
  Ücretsiz kayıt (0 / 0) yalnızca yönetici (genel yönetici, şube müdürü) veya Excel içe aktarma.
- Var olan kaydın ücret / indirimi yalnızca yönetici tarafından ve tutarlı netle değişir (doküman: "indirim yetkisi yalnızca yöneticide").
  Ücret alanı değişmeyen yazmalar (grup değişikliği, dondurma…) denetlenmez; eski / tutarsız veri kilitlenmez.

### Taksit
- Yeni taksit: finans açık; süren (aktif / dondurulmuş) kayda; kaydın öğrencisi ve şubesi; öğrencinin velisi; tutar > 0; ödenen 0; geçerli vade.
- Ödenen tutar **yalnızca aynı paketteki tahsilat veya tahsilat iptali kadar** değişir (`odemeFarklari`); tahsilatın dağıtıldığı taksit
  aynı işlemde güncellenmelidir. **Fazla tahsilat yoktur** (ödenen ≤ tutar).
- Kayıt, öğrenci, veli ve sıra değişmez. Şube yalnızca kaydıyla birlikte değişir (nakil devri). Tutar / vade değişikliği yalnızca yönetici;
  tutar ödenenin altına inemez. Taksit silinemez.

### Tahsilat
- Finans açık; yöntem nakit / havale-EFT / POS; tutar = dağılımın toplamı; her dağılım satırı **ödeyen velinin çocuğunun** taksiti;
  tahsilat **öğrencinin kayıtlı olduğu şubenin kasasına** yazılır (`subeId` = taksitin şubesi); **alındığı şube** ayrıca tutulur, var ve
  yetki kapsamında olmalı. Ekran ödemeyi en eski vadeden dağıtır; kısmi ödeme desteklenir, fazlası sonraki taksite geçer; toplam borçtan
  fazla tutar alınmaz. Kardeşlerin taksitleri farklı şubelerdeyse şube başına ayrı tahsilat (ve makbuz no) oluşur.
- **Makbuz no** `ŞUBEKODU-M-00001`, şube kodu başına sıradaki numara (`yeniMakbuzNo`). Çakışırsa (ör. aynı anda iki kullanıcı)
  sunucu şubenin sıradaki boş numarasını verir; numara iki tahsilatta olmaz.
- Tahsil eden ve tahsilat zamanı sunucudan yazılır.
- **Geçmiş tahsilat değiştirilemez ve silinemez.** Düzeltme yalnızca **iptal** ile: genel yönetici veya şube müdürü, en az 3 karakter gerekçe;
  iptal eden ve zaman sunucudan; iptal geri alınamaz. İptalde taksitlerin ödeneni aynı paketle geri düşer.
  **Ters kayıt:** kasada iptal edilen tahsilatın girişi kendi gününde kalır, iptal gününde aynı tutarda çıkış hareketi görünür;
  böylece geçmiş günlerin gün sonu bakiyesi iptalle değişmez (`kasaHareketleri`).

### Kasa, gider, virman
- Her şubenin nakit, POS ve banka kasası; Genel Merkez yalnızca banka hesabı (`merkez:banka`). Havale/EFT bankaya, kart POS'a yazılır.
- Bakiye = hareketlerin toplamı (`kasaBakiyesi`); **gün sonu raporu** her kasa için açılış (önceki gün sonu), günün girişi / çıkışı ve kapanışı verir.
- **Başka şubenin kasası:** kullanıcı yalnızca kapsamındaki şubelerin kasalarını görür ve kullanır; Genel Merkez yalnızca genel yönetici (`kasaErisimi`).
  Başka şubede ödeme alınsa da para öğrencinin şubesinin kasasına yazılır (doküman kuralı); alındığı şube makbuzda ve kayıtta görünür.
- **Gider:** tutar, tarih (bugünden sonra olamaz), kasa türü, kategori ve açıklama; Genel Merkez (ortak) gider yalnızca genel yönetici.
  Girilen gider değiştirilemez / silinemez, yalnızca yönetici gerekçeyle iptal eder. Kasayı eksiye düşürecek gider uyarılır (engellenmez).
- **Virman:** iki geçerli ve farklı kasa, tutar, tarih; **kaynak kasada yeterli bakiye** olmalı; Genel Merkez kasasından yalnızca genel yönetici.
  Şube kasasından Genel Merkez'e aktarım (şube kapsamındaki kullanıcı) sunucuda serbesttir. Girilen virman değiştirilemez, yalnızca yönetici gerekçeyle iptal eder.

### Dondurulan, iptal edilen ve nakledilen kaydın taksitleri
- **Nakil:** kalan (ödenmemiş) taksitler yeni şubeye devredilir, ödenmiş tutarlar eski şubenin kasasında kalır. Bölüm 04'ün sunucu devri
  korunmuştur ve artık **her nakilde** (kapsam içi de) sunucuda tamamlanır: finans kapalıyken veya finans yetkisi yokken ekran taksitleri görmez.
- **İptal / dondurma:** dondurmada taksitler aynen sürer. İptalde finans açıksa iptal hesabı uygulanır (karar 2026-11-08, yukarıda); kalan borç
  **silinmez**, cari hesapta görünür ve tahsil edilebilir ("kayıt iptal" / "donduruldu" etiketi).
  Bu kayıtların taksitlerine **otomatik hatırlatma ve toplu ("Hepsine hatırlat") hatırlatma gitmez** (`otomatikHatirlatmaUygun`);
  tekil hatırlatma elle gönderilebilir. Aktif ve mezun kaydın taksitleri hatırlatılır.

### Yetki ve gizlilik
- **Finans verisini görme** (`finansGorur`): modül açık + 05 yetkisi + öğretmen değil. Görmeyene taksit, tahsilat, gider, virman gitmez;
  **kayıtların ücret alanları** (liste fiyatı, indirim, net) sıfırlanarak gider. Bu kullanıcının yazdığı kayıtta sunucu ücret alanlarını
  eski değerle korur (maskeli veri gerçeğin üzerine yazılmaz).
- Öğretmen hiçbir yoldan finans yazamaz (Bölüm 02). Veli yalnızca kendi çocuklarının taksitlerini (modül açıkken) görür.
- Şube kapsamı `yazmaDenetle` içinde: taksit / tahsilat / gider şubesine, virman her iki kasanın şubesine göre.

## Bu bölümde düzeltilen hatalar
- **Sunucu tahsilatı hiç denetlemiyordu:** tutar ile dağılım uyuşmazlığı, başka velinin çocuğuna / başka şubenin kasasına tahsilat,
  kapsam dışı "alındığı şube", sıfır / küsuratlı tutar kabul ediliyordu.
- **Taksitin ödenen tutarı tahsilatsız değiştirilebiliyordu** (04/09 yetkisiyle taksit yazan herkes borcu "ödendi" yapabiliyordu);
  fazla tahsilat (ödenen > tutar) ve taksit tutarının ödenenin altına indirilmesi mümkündü.
- **Modül kapalıyken** sunucu taksit, tahsilat, gider ve virman yazmaya izin veriyor, finans verisini 05 yetkili herkese gönderiyordu.
- **Kayıt ücreti (liste fiyatı, indirim, net) öğretmene ve 05 yetkisi olmayanlara** kayıtlarla birlikte gidiyordu.
- Kayıt ücreti sunucuda denetlenmiyordu: istenen liste fiyatı, tanımsız / uydurma indirim (ör. %100), nete uymayan plan yazılabiliyordu.
- Sihirbaz neti **TL'ye yuvarlıyordu** (kuruş kayboluyordu); fiyat yalnızca şubeye göreydi.
- **Makbuz no** `tahsilatlar.length + 1` ile üretiliyordu: kullanıcının gördüğü (kapsamla süzülmüş) listeye göre olduğundan
  çakışıyordu; sunucu benzersizliği denetlemiyordu.
- Tahsilat zamanı istemciden geliyordu (geçmiş tarihli tahsilat yazılabiliyordu); artık sunucu zamanı.
- Tahsilat iptali gerekçe uzunluğunu sunucuda denetlemiyordu.
- **İptal edilen tahsilat kasa geçmişinden tümüyle siliniyordu** (geçmiş günlerin bakiyesi geriye dönük değişiyordu); artık ters kayıt.
- Gider ve virman sunucuda denetlenmiyordu: negatif / sıfır tutar, gelecek tarih, aynı kasaya virman, geçersiz kasa, Genel Merkez kasasından
  şube müdürünün virmanı, bakiyesiz virman, girilmiş giderin değiştirilmesi mümkündü.
- Gün sonu raporu "bugünün" değil tüm zamanların (gelecek tarihli gider dahil) bakiyesini veriyordu; açılış / kapanış yoktu.
- İptal edilen / dondurulan kaydın taksitlerine **otomatik gecikme hatırlatması** gitmeye devam ediyordu.
- Kapsam içi nakilde finans kapalıyken (ekran taksit görmediği için) kalan taksitler eski şubede kalıyordu.
- Aylık grafik sabit ayları (2026-09 … 2027-02) gösteriyordu; artık aktif sezonun ayları. "Ekim gideri" başlığı her ay için yanlıştı.
- Tutar kutusu Türkçe yazımı (`1.250,50`) çözemiyordu.

## Testler
`npx vitest run src/bolumler/05-finans`:
- `kurallar.test.ts` — 38 test (13'ü 2026-11-08 kararları: iptal hesabı, cayma, iade, indirim onayı, plan dağıtımı, gider / virman iptali): örnek verinin kurallara uyması, tutar / kuruş ve Türkçe tutar çözümü, kayıt ücreti (indirim, ek hizmet,
  %100 sınırı), indirim / ek hizmet doğrulaması, yeni ve var olan kaydın ücret kuralları, plan toplamı, taksit kuralları (yeni, ödenen farkı,
  fazla tahsilat, yönetici düzenlemesi), hatırlatma uygunluğu, tahsilat ve iptal kuralları, ödeme farkları, makbuz no, kasa hareketleri
  (ters kayıt, öğrencinin şubesinin kasası), gün sonu, kasa erişimi, gider ve virman kuralları, sezon ayları.
- `sunucu.test.ts` — 46 test (17'si 2026-11-08 kararları): modül kapalıyken yazma / okuma / maske / nakil devri; okuma kapsamı ve yetkisiz roller; tahsilat
  (kabul, makbuz çakışması, tutar, fazla tahsilat, tahsilatsız ödenen, yanlış veli / kasa / şube, öğretmen); iptal (yetki, gerekçe, geri
  alınamazlık, silinemezlik); kayıt ücreti ve plan (sihirbaz paketi, fiyat listesi, tanımsız fiyat, plan toplamı, indirim, ücretsiz kayıt,
  yönetici düzenlemesi, Bölüm 01 sezon geçişi paketi); taksit; gider ve virman.

Önceki bölüm testlerinde kararların gerektirdiği değişiklikler:
- Bölüm 01 `kurallar.test.ts`: fiyat listesi testleri yeni modele çevrildi (+ `fiyatBul`, eski biçim çevirisi, sezon fiyatı yazma) ve
  sezon geçişinde fiyat kopyalanmaması / hedef fiyat / tanımsız fiyatta durma testleri eklendi (41 → 48).
- Bölüm 01 `sunucu.test.ts`: negatif fiyat paketi yeni biçimle yazıldı; eski biçim ve yinelenen satır reddi eklendi (test sayısı aynı).
- Bölüm 04 testleri değişmedi.

## Bilinen sınırlar / açık sorular
- ~~İptal edilen kaydın kalan borcu~~ **Kapandı (2026-11-08):** iade ve cayma bedeli yapısı kuruldu (yukarıda).
- ~~Dondurulan kayıt~~ **Kapandı (2026-11-08):** taksitler aynen sürer (vadeler kaymaz), yalnızca otomatik hatırlatma durur; değişiklik gerekmedi.
- **Taksit elle düzenleme** (doküman: "tutar, tarih; değişiklik kaydı tutulur"): sunucu yöneticiye izin veriyor ama **ekranı yok**;
  değişiklik kaydı (eski/yeni değer) modeli de yok.
- ~~İndirim yetkisi~~ **Kapandı (2026-11-08):** sekreterin indirimi yönetici onayıyla geçerli olur (yukarıda).
- **Burs** türü yok (indirim türleri ve ek hizmet fiyatları `src/data/mock.ts` içinde sabit; ayarlanabilir değil).
- **İndirim talebi** yalnızca kayıt sırasında oluşturulur; var olan kayda sekreter talep açamaz (yönetici doğrudan değiştirir).
- ~~İptal hesabından sonra tahsilat iptali~~ **Kapandı (2026-11-08):** iptal edilmiş kaydın tahsilatı iptal edilemez (`tahsilatKayitIptalEngeli`; birden çok kayda dağılmış
  tahsilatta tek bir iptal kayıt yeter, iptal hesabı olmayan kayıt iptalleri de dahil). Yanlış tahsilat kayıt iptalinden önce düzeltilmelidir. Ekranda düğme kapalıdır ve nedeni yazar.
- **İade iptali** yalnızca kasaya ters kayıt düşer; kaydın iptal hesabı ve kapanmış taksitler değişmez, kayıt iptali geri alınamaz.
- **Virman iptalinde bakiye denetimi yok:** hedef kasa o sırada yetersizse ters kayıt onu eksiye düşürebilir.
- **İptal sonrası iade makbuzu** yazdırma ekranı yok; numara kasa hareketlerinde ve cari geçmişte görünür.
- **Fazla ödeme:** toplam borçtan fazlası alınmıyor (avans / alacak bakiyesi modeli yok). Doküman "fazla ödeme sonraki taksite aktarılır"
  diyor; bu, açık taksitler içinde yapılıyor.
- **Kasa açılış / kapanış:** gün sonu raporu hesaplanan açılış / kapanışı veriyor; fiili sayım, kasa farkı ve "gün kapatma" (kapanmış güne
  hareket girilememesi) yok. Gider tarihi geçmişe girilebildiği için geçmiş günün bakiyesi gider girişiyle değişebilir.
- ~~Gider / virman düzeltme~~ **Kapandı (2026-11-08):** yönetici gerekçeyle iptal eder, iptal gününe ters kayıt düşer.
- **Kasayı eksiye düşüren gider** yalnızca uyarılıyor; engellensin mi?
- **Şube kullanıcısının Genel Merkez'e virmanı:** sunucu izin veriyor, ekran Genel Merkez kasasını yalnızca genel yöneticiye listeliyor.
- **Makbuz** sunucu yeniden numaralarsa (eşzamanlı çakışma) yazdırılan makbuzdaki numara ekrandaki eski numara olabilir; yeniden yazdırma doğru numarayı verir.
- **Belge fotoğrafı** gider formunda seçilebiliyor ama sunucuya yüklenmiyor (dosya saklama altyapısı yok).
- Makbuz PDF, e-arşiv, sanal POS, ay sonu yönetici özeti ve "ödemeniz alındı" dışındaki otomasyonlar bu bölümde ele alınmadı.
- Etüt paketi ücreti (Bölüm 09) ve hak ediş gideri (Bölüm 13) bu bölümün kurallarından geçer (yeni taksit / gider); kendi ekranları değiştirilmedi.
- Kural ihlalleri `YetkiHatasi` (HTTP 403) olarak döner (Bölüm 01'deki not).
