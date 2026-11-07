# Bölüm 04 · Öğrenci, veli ve kayıt (sözleşme)

Gereksinim: [`docs/bolumler/04-ogrenci-ve-kayit.md`](../../../../docs/bolumler/04-ogrenci-ve-kayit.md) · Plan: `docs/PROFESYONELLESME.md`

## Amaç

Öğrenci ve velinin bilgilerini tek yerde tutmak; her sezon için bir kayıt (sözleşme) açmak, kaydı grup
değişikliği, şube nakli, dondurma ve iptal boyunca bozmadan yönetmek. Öğrenci ve veli **kurum genelinde tektir**,
kayıt şubeye bağlıdır. Kurallar ekranda anında gösterilir, sunucu aynı kuralları her istekte yeniden uygular.

## Dosyalar

| Dosya | İçerik |
|---|---|
| `index.tsx` | Rotalar (`/ogrenciler`, `/ogrenciler/yeni`, `/ogrenciler/:id`); default export `Ogrenciler` (main.tsx `ogrenciler/*`) |
| `OgrenciListesi.tsx` | Aktif sezon kayıtları, arama (ad / veli / telefon), grup ve durum filtresi, sayaçlar |
| `KayitSihirbazi.tsx` | Öğrenci → Veli → Şube ve grup → (Ücret → Ödeme planı) → Kayıt formu; `?aday=` ile ön kayıttan |
| `OgrenciKarti.tsx` | Öğrenci kartı üst bilgisi, dondur / aktifleştir, işlem pencereleri, sekmeler |
| `KartSekmeleri.tsx` | Genel, Veliler, Kayıtlar, Ödemeler, Yoklama, Ödevler, Etüt, Notlar, Belgeler sekmeleri |
| `KayitIslemleri.tsx` | Grup değişikliği, şube nakli, kayıt iptali pencereleri |
| `ortak.tsx` | Tarih biçimi, kayıt durumu rozeti, veli formu tipi |
| `kurallar.ts` | **Saf iş kuralları** (ekran + sunucu ortak; yalnızca göreli içe aktarma) |
| `kurallar.test.ts` | Saf kural testleri (24) |
| `sunucu.test.ts` | `server/politika.ts · yazmaDenetle → kayitDenetle` ve `okumaSuz` testleri (26) |

Sunucu: `app/server/politika.ts` içinde `kayitDenetle()` (yazmaDenetle sonunda, `onKayitDenetle`'den önce çağrılır),
`veliler` / `ogrenciler` satırlarının sunucu temizliği ve `satirSubeleri()` içindeki öğrenci kapsamı.

## İş kuralları

### Öğrenci
- Ad ve soyad zorunlu (en fazla 80 karakter); doğum tarihi boş ya da geçerli ve bugünden sonra değil; cinsiyet K/E;
  okul ≤ 120, sağlık notu ≤ 500 karakter.
- En az 1, en fazla 3 veli; aynı veli iki kez bağlanamaz; birincil veli velilerden biri olmalı.
- Yeni öğrenci kartı **aynı pakette bir kayıtla** gelir (sihirbaz, Excel içe aktarma). Kaydı olmayan öğrenci hiçbir
  şubeye ait sayılmaz; artık "kurum geneli" gibi herkese görünmez, yalnızca genel yönetici görür.
- Notlar zaman çizelgesidir: yeni not başa eklenir, eski not silinemez/değiştirilemez; yazar ve zamanı sunucu yazar.
- "Ayrıldı" yalnızca tüm kayıtları iptal edilince; ayrılan öğrenci yeniden "aktif" yapılamaz.
- **Mükerrer öğrenci:** aynı ad-soyad (Türkçe harf duyarsız: büyük/küçük, İ/I/ı, `Işıl` = `ISIL` = `isil`, fazla boşluk)
  ve velilerinden biriyle aynı telefon. Sunucu **tüm şubelerde** arar (ekran yalnızca kendi kapsamını görür).
- Genel bilgi formu yalnızca kişisel alanları kaydeder (veli bağları, durum ve notlar kendi işlemleriyle değişir).
- TCKN tutulmaz (gereksinim: zorunlu değil, yalnızca fatura için veliden alınır — modelde alan yok).

### Veli
- Ad zorunlu, telefon geçerli cep telefonu ve **tek biçimde** saklanır (`05xx xxx xx xx`; veli portalı girişi bu biçimle eşleşir),
  e-posta boş ya da geçerli, yakınlık Anne/Baba/Diğer.
- **Veli eşleştirme:** telefon kayıtlı bir veliye aitse sihirbaz "Kardeş olarak bağla" önerir. Ekran başka şubedeki
  velileri göremediği için, yeni velinin telefonu kayıtlı bir veliye aitse **sunucu yeni veliyi yazmaz, öğrenciyi
  (ve aynı paketteki taksit/gönderimleri) mevcut veliye bağlar**. Aynı pakette aynı telefonla iki veli girilemez.
- Var olan velinin telefonu başka bir veliye ait numaraya çevrilemez.

### Kayıt
- Durumlar: `aktif`, `dondurulmus`, `iptal`. Yeni kayıt aktif açılır; aktif ⇄ dondurulmuş serbest; her ikisinden iptal;
  **iptal geri alınamaz** ve iptal edilen kayıt hiçbir alanıyla değiştirilemez. "Mezun" ayrı durum değildir (sezon geçişinde
  en üst seviye yeni sezona taşınmaz, Bölüm 01); "nakil" ayrı durum değildir (kayıt bozulmadan şube + grup değişir).
- Kaydın öğrencisi, sezonu, sözleşme numarası, tarihi ve içe aktarma bağı değişmez; alınmış KVKK onayı değişmez.
- Atama: şube var ve **aktif**, grup var, grubun şubesi ve sezonu kaydınkiyle aynı. Yeni kayıt yalnızca **aktif sezona**
  (sezon geçişi için genel yönetici hariç). Bir öğrencinin sezonda tek ana kaydı olur.
- Grup değişikliği / nakil grup geçmişine bir satır ekler; geçmiş silinemez. İptal ederken grup/şube değiştirilemez.
- Nakil: hedef şube aktif ve kullanıcının kapsamında olmalı (sunucu eski ve yeni şubeyi denetler); kalan taksitler yeni
  şubeye geçer, ödenmiş tutarlar eski şubede kalır.
- **Kapasite:** gruba yeni giren aktif öğrenci (yeni kayıt, grup değişikliği/nakil, dondurmadan dönüş) kontenjanı aşarsa
  yalnızca **şube müdürü veya genel yönetici** onaylayabilir (ekrandaki "yönetici onayı" artık gerçekten yöneticiye bağlı;
  onay kutusu sekretere gösterilmez). Dondurulmuş kayıt doluluğa sayılmaz.
- **Seviye uyumu:** öğrenci modelinde seviye alanı yok, seviye grubun seviyesidir. Sihirbaz farklı seviyede grup seçilince uyarır (engel değil).
- **Sözleşme numarası:** `ŞUBEKODU-YIL-SIRA` (örn. `MRK-2026-0042`); yıl **sezonun başlangıç yılı**; şube koduyla başlamalı ve
  kurum genelinde benzersiz. Ekran nakledilmiş kayıtları göremediği için aynı numarayı üretirse sunucu yeni kayda sıradaki
  boş numarayı verir.

### Kayıt iptali → aday yeniden açılır (kullanıcı kararı 2026-11-07)
- Öğrencinin bir kaydı iptal edilir ve **iptal olmayan başka kaydı kalmazsa** öğrenci "ayrıldı" olur; öğrenciye bağlı
  (`ogrenciId`), kayda dönüşmüş aday aynı pakette yeniden açılır.
- Seçilen durum: **"Görüşüldü"**. Gerekçe: aileyle daha önce görüşülmüş, kurumu tanıyan bir aday; "Yeni aday" geçmişi yok sayar,
  "Deneme dersi" ve "Düşünüyor" ailenin o anki niyetini varsayar. "Görüşüldü" + sonraki aksiyon = bugün, adayı sorumlusunun
  "bugün aranacaklar" listesine düşürür; iptal nedeni yeniden görüşmede öğrenilir.
- Yeniden açılan adayda yalnızca durum, öğrenci bağı (kaldırılır), sonraki aksiyon ve sona eklenen not ("Kayıt iptal edildi (no)…") değişir.
- Bölüm 03'ün "kayda dönüşmüş aday geri alınamaz" kuralı **aynen kalır**; tek istisna sunucuda, `onKayitDenetle` içinde,
  yalnızca aynı pakette kayıt iptali varsa (`iptalPaketiMi`) uygulanır. Ön kayıt modülü kapalıyken ve aktörün 03 yetkisi
  yokken de çalışır. Aday başka şubedeyse (öğrenci nakledilmiş) iptal eden kullanıcı görmese de sunucu adayı pakete ekler.
- KVKK ile anonimleştirilen öğrencinin adayı takibe açılmaz.

### Şube kapsamı ve KVKK
- Okuma/yazma kapsamı sunucuda (`okumaSuz`, `yazmaDenetle`): öğrenci, aktif sezon kaydının (yoksa ilk kaydının) şubesine aittir;
  kayıt şubesine; veli çocuklarının şubelerine. Başka şubenin öğrencisi görülmez/değiştirilemez; nakilde iki şube de kapsamda olmalı.
- Öğretmen yalnızca kendi gruplarının öğrencilerini görür; veli telefonu maskeli, e-posta boş; öğrenci/veli/kayıt yazamaz.
- Sağlık notu: kapsamdaki personel ve öğrencinin öğretmenleri (güvenlik gereği) görür; veli yalnızca kendi çocuğununkini görür.
  Öğrenci notları veliye gitmez. Öğrenci/veli anonimleştirmesi yalnızca KVKK (14) yetkisiyle; anonim kart değiştirilemez.
- "Excel'den aktar" düğmesi yalnızca 14 yetkisi olana görünür.

### Ödeme planı (Bölüm 05 modeli değişmeden, bariz hatalar)
- Negatif peşinat, kesirli taksit sayısı, boş ilk vade reddedilir; taksit 0 ise peşinat net tutara eşit olmalı
  (önceden kalan tutar plansız kalıyordu). İlk vade varsayılanı bugündür (önceden geçmiş bir sabit tarihti).

## Düzeltilen hatalar (özet)
- Mükerrer kontrolü yalnızca ilk velinin telefonuna ve yalnızca görünen öğrencilere bakıyordu; başka şubede aynı öğrenci yeniden açılabiliyordu.
- Başka şubedeki velinin telefonuyla ikinci (yinelenen) veli açılıyordu; veli portalı girişi ve kardeş bağı bozuluyordu.
- Sunucu öğrenci/veli/kayıt satırlarında hiçbir alan kuralı uygulamıyordu (yalnızca kapsam): iptal geri alınabiliyor, sözleşme numarası
  değiştirilebiliyor/yinelenebiliyor, pasif şubeye ve başka şubenin grubuna kayıt yapılabiliyor, notlar silinebiliyordu.
- Sihirbaz pasif şubeleri listeliyordu; önizlemedeki sözleşme no yılı (2026 sabit) ile kaydedilen (bugünün yılı) farklıydı.
- Kapasite aşımı "yönetici onayı" diyordu ama sekreter kendisi onaylayabiliyordu.
- İptal, öğrencinin başka (ör. gelecek sezon) kaydı sürse de öğrenciyi "ayrıldı" yapıyordu.
- Grup değiştir / nakil başka sezonun kaydını aktif sezon grubuna taşıyabiliyor, pasif şubenin gruplarını listeliyordu.
- Genel bilgi kaydı formdaki eski kopyayla veli bağlarını / durumu / notları ezebiliyordu.
- Dondur/aktifleştir işlem kaydına oturum adı yerine "Kullanıcı" yazılıyordu; dondurmadan dönüşte kontenjan denetlenmiyordu.
- Liste sayaçları ("bu ay yeni kayıt", "dondurulmuş") tüm sezonları sayıyordu.
- Kaydı olmayan öğrenci kartı tüm kullanıcılara "kurum geneli" olarak görünüyordu.

## Testler
- `kurallar.test.ts` (24): ad anahtarı ve mükerrer, veli eşleştirme/birleştirme, alan kuralları, notlar, sözleşme no,
  grup/şube/sezon atama, kapasite, durum geçişleri, kayıt satırı, aday yeniden açma, ödeme planı girdisi.
- `sunucu.test.ts` (26): sihirbaz paketi, başka şubedeki mükerrer öğrenci, başka şubedeki veliye bağlama, sözleşme no çakışması,
  pasif şube / başka şube grubu / aktif olmayan sezon, kapasite (sekreter ↔ şube müdürü), iptal geri alınamaz, grup geçmişi,
  nakilde iki şube kapsamı, not yazarı, kayıtsız öğrencinin görünürlüğü, KVKK anonimleştirme, Excel içe aktarma paketi,
  kayıt iptalinde adayın yeniden açılması (ekran göndermese de, modül kapalıyken, aday başka şubedeyken; iptalsiz geri alma yasak).
- Bölüm 03 `sunucu.test.ts` kesin kayıt paketindeki sözleşme no örneği şube koduyla başlayacak biçimde güncellendi (`TEST-1` → `MRK-2026-9001`).

## Bilinen sınırlar
- Örnek verideki kayda dönüşmüş adayların `ogrenciId` bağı yok; bu adaylar kayıt iptalinde yeniden açılamaz (bağ yalnızca sihirbazla kurulur).
- Sihirbaz kayıt formunu ekrandaki numarayla hemen yazdırır; nadir bir çakışmada (nakledilmiş kaydın numarası) sunucu numarayı değiştirir,
  doğru form öğrenci kartı → Belgeler'den yeniden yazdırılmalı.
- Yeniden açılan aday için "yinelenen açık aday" denetimi yapılmaz (aynı çocuk için açık başka aday varsa iki açık aday olur).
- Bölüm 14 Excel içe aktarma sözleşme yılını `2026` sabitiyle üretir ve kapasiteyi denetlemez; sunucu artık kapasiteyi denetlediği için
  14 yetkili yönetici olmayan biri dolu gruba aktaramaz. (Bölüm 14'ün işi; burada değiştirilmedi.)
- Kayıt durumu değişiklikleri (dondurma/aktifleştirme) için ayrı tarihçe tutulmaz; yalnızca işlem kaydına yazılır.
- Kardeş indirimi kardeş eşleşmesi yalnızca ekranın gördüğü velilerle yapılır (fiyat modeli Bölüm 05).

## Açık sorular
1. **Ayrılan öğrencinin yeniden kaydı:** iptal edilen öğrenci tekrar gelirse mevcut kart nasıl yeniden açılsın? Şu an kart "ayrıldı"da kalır,
   mükerrer kontrolü yeni kart açılmasını engeller; yeniden kayıt için bir "yeniden kaydet" akışı gerekiyor.
2. **Kapsam dışına nakil:** Bölüm 03'teki aday devri gibi, tek şubeye yetkili kullanıcı öğrenciyi başka şubeye nakledebilsin mi? Şu an iki şubede de yetki gerekir.
3. **Kapasite onayı:** kapasite aşımını sekreter de onaylayabilmeli mi, yoksa yalnızca şube müdürü/genel yönetici mi (şu anki uygulama)?
4. **Öğretmen görünürlüğü:** öğretmen öğrencinin personel notlarını ve doğum tarihini görmeli mi? Şu an görüyor (sağlık notu güvenlik gereği açık kalmalı).
5. **Mezun durumu:** sezon sonunda en üst seviyedeki öğrencinin kaydı "mezun" olarak işaretlensin mi (şu an kayıt aktif kalır, yeni sezona taşınmaz)?
6. Yeniden açılan aday için "Görüşüldü" yerine başka bir durum (ör. yeni bir "Ayrıldı" aşaması) istenir mi?
