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
| `kurallar.test.ts` | Saf kural testleri (29) |
| `sunucu.test.ts` | `server/politika.ts · yazmaDenetle → kayitDenetle` ve `okumaSuz` testleri (34) |

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
- Durumlar: `aktif`, `dondurulmus`, `iptal`, `mezun`. Yeni kayıt aktif açılır; aktif ⇄ dondurulmuş serbest; her ikisinden iptal;
  **iptal ve mezuniyet geri alınamaz**, bu kayıtlar hiçbir alanıyla değiştirilemez (tek istisna: KVKK anonimleştirmesinde mezun kayıt da iptal edilir).
  "Nakil" ayrı durum değildir (kayıt bozulmadan şube + grup değişir).
- **Mezuniyet (karar 2026-11-07):** sezon geçişinde (Bölüm 01 · `sezonGecisiPlani().mezunlar`) en üst seviye (8. sınıf) gruplarının
  aktif/dondurulmuş kayıtları "mezun" olur; öğrenci taşınsın taşınmasın. Sunucu: yalnızca genel yönetici, yalnızca 8. sınıf grubunun kaydı,
  başka alan değişmeden. Mezun kayıt doluluğa ve `aktifKayit()`'a sayılmaz.
- **Öğrenci durumu kayıtlarından çıkar** (`ogrenciDurumu`): süren (aktif/dondurulmuş) kaydı varsa "aktif", yoksa mezun kaydı varsa "mezun",
  yoksa "ayrıldı". Kaydı değişen öğrencinin durumu bununla uyumlu değilse sunucu paketi reddeder. Öğrenci kartı mezun/ayrıldı rozetini gösterir.
- **Mevcut karttan yeniden kayıt (karar 2026-11-07):** süren kaydı olmayan (ayrılmış / mezun), anonim olmayan öğrencinin kartında
  "Yeniden kayıt" düğmesi sihirbazı `?ogrenci=` ile açar; öğrenci bilgileri ve veli bağları hazır gelir, yeni kart açılmaz, kart güncellenir
  ve öğrenci yeni kayıtla yeniden "aktif" olur. Sihirbazdaki mükerrer uyarısı süren kaydı olmayan karta "Mevcut karttan yeniden kayıt"
  bağlantısı verir. Sezonda tek süren/mezun ana kayıt kuralı aynen geçerli (iptal edilen kaydın sezonuna yeniden kayıt olur).
- Kaydın öğrencisi, sezonu, sözleşme numarası, tarihi ve içe aktarma bağı değişmez; alınmış KVKK onayı değişmez.
- Atama: şube var ve **aktif**, grup var, grubun şubesi ve sezonu kaydınkiyle aynı. Yeni kayıt yalnızca **aktif sezona**
  (sezon geçişi için genel yönetici hariç). Bir öğrencinin sezonda tek ana kaydı olur.
- Grup değişikliği / nakil grup geçmişine bir satır ekler; geçmiş silinemez. İptal ederken grup/şube değiştirilemez.
- Nakil: hedef şube aktif olmalı; kalan taksitler yeni şubeye geçer, ödenmiş tutarlar eski şubede kalır. Hedef kapsamdaysa
  kullanıcı grubu seçer (sunucu eski ve yeni hali denetler).
- **Kapsam dışındaki aktif şubeye nakil (karar 2026-11-07)**, Bölüm 03 aday devri deseniyle: `yazmaDenetle` yalnızca kayıt
  satırında yeni halin kapsamını atlar (`kayitNakli`), eski hal kapsamda olmalı. `kapsamDisiNakilEngeli`: kayıt sürüyor ve aktif sezonda,
  hedef şube aktif, kayıtta yalnızca şube / grup / grup geçmişi (sona bir satır) değişir. Ekran hedef şubenin gruplarını göremediği için
  grubu **sunucu atar** (`nakilHedefGrubu`: aynı seviye, boş kontenjanlı, en boş grup; yoksa ret — kapsam dışına kapasite aşımı yok).
  Kalan taksitlerin devrini de sunucu ekler; paketin diğer koleksiyonlarında (işlem kaydı, taksit, gönderim) kapsam denetimi aynen
  geçerlidir, işlem kaydı devreden şubeye yazılır. Ekran "nakilden sonra bu öğrenciyi göremeyeceksiniz" uyarısını onaylatır, sonra
  veriyi yeniden yükler. Şube tanımları (kişisel veri yok) artık her personele görünür, böylece hedef seçilebilir; kapsam değişmez.
- **Kapasite (karar 2026-11-07):** gruba yeni giren aktif öğrenci (yeni kayıt, grup değişikliği/nakil, dondurmadan dönüş) kontenjanı
  aşarsa **sekreter, şube müdürü veya genel yönetici** onaylar (onay işlem kaydına yazılır). Dondurulmuş kayıt doluluğa sayılmaz.
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

### Ödeme planı
- Negatif peşinat, kesirli taksit sayısı, boş ilk vade reddedilir; taksit 0 ise peşinat net tutara eşit olmalı
  (önceden kalan tutar plansız kalıyordu). İlk vade varsayılanı bugündür (önceden geçmiş bir sabit tarihti).
- **Bölüm 05 (karar 2026-11-07):** sihirbazın liste fiyatı fiyat listesinden **sezon + şube + grubun seviyesi** ile alınır; fiyat
  tanımsızsa Ücret adımı ilerlemez. Net tutar `kayitUcreti` ile kuruş hassasiyetinde hesaplanır (önceden TL'ye yuvarlanıyordu).
  Ücret, indirim ve plan toplamı sunucuda `finansDenetle` ile de denetlenir. Kalan taksit devri artık **her** nakilde sunucuda
  tamamlanır (finans kapalıyken veya finans yetkisi yokken ekran taksitleri görmez). Ayrıntı: `../05-finans/README.md`.

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
- `kurallar.test.ts` (29): ad anahtarı ve mükerrer, veli eşleştirme/birleştirme, alan kuralları, notlar, sözleşme no,
  grup/şube/sezon atama, kapasite, durum geçişleri, kayıt satırı, aday yeniden açma, ödeme planı girdisi;
  ek kararlar: öğrenci durumu (aktif/mezun/ayrıldı), yeniden kayıt, mezuniyet, nakil hedef grubu, kapsam dışına nakil.
- `sunucu.test.ts` (34): sihirbaz paketi, başka şubedeki mükerrer öğrenci, başka şubedeki veliye bağlama, sözleşme no çakışması,
  pasif şube / başka şube grubu / aktif olmayan sezon, kapasite (sekreter onaylar, öğretmen yazamaz), iptal geri alınamaz, grup geçmişi,
  not yazarı, kayıtsız öğrencinin görünürlüğü, KVKK anonimleştirme, Excel içe aktarma paketi, kayıt iptalinde adayın yeniden açılması;
  ek kararlar: mevcut karttan yeniden kayıt, şube tanımlarının görünürlüğü, kapsam dışına nakil (sunucu grup + taksit devri, öğrenci
  kapsamdan çıkar; işlem kaydı / taksit hedefe yazılamaz; başka alan, pasif şube, dolu hedef reddedilir), Bölüm 01 sezon geçişi paketiyle
  mezuniyet, mezuniyetin yetkisi ve geri alınamazlığı.
- Bölüm 03 `sunucu.test.ts` kesin kayıt paketindeki sözleşme no örneği şube koduyla başlayacak biçimde güncellendi (`TEST-1` → `MRK-2026-9001`).

## Bilinen sınırlar
- Örnek verideki kayda dönüşmüş adayların `ogrenciId` bağı yok; bu adaylar kayıt iptalinde yeniden açılamaz (bağ yalnızca sihirbazla kurulur).
- Sihirbaz kayıt formunu ekrandaki numarayla hemen yazdırır; nadir bir çakışmada (nakledilmiş kaydın numarası) sunucu numarayı değiştirir,
  doğru form öğrenci kartı → Belgeler'den yeniden yazdırılmalı.
- Yeniden açılan aday için "yinelenen açık aday" denetimi yapılmaz (aynı çocuk için açık başka aday varsa iki açık aday olur).
- Bölüm 14 Excel içe aktarma sözleşme yılını `2026` sabitiyle üretir ve kapasiteyi denetlemez (Bölüm 14'ün işi; burada değiştirilmedi).
- Kapsam dışına nakilde hedef grup otomatik seçilir (aynı seviye, en boş); kullanıcı grubu seçemez, hedef şube sonra grubu değiştirebilir.
- Öğrenci listesi yalnızca aktif sezonu gösterir; sezon geçişinden sonra eski sezonun mezun kayıtları listede değil, öğrenci kartında görünür.
- Kayıt durumu değişiklikleri (dondurma/aktifleştirme) için ayrı tarihçe tutulmaz; yalnızca işlem kaydına yazılır.
- Kardeş indirimi kardeş eşleşmesi yalnızca ekranın gördüğü velilerle yapılır (fiyat modeli Bölüm 05).

## Açık sorular
Şu an açık soru yok. Kapanan sorular:

1. **Ayrılan öğrencinin yeniden kaydı:** Kapandı (2026-11-07): yeni kart açılmaz, mevcut karttan yeniden kayıt (uygulandı).
2. **Kapsam dışına nakil:** Kapandı (2026-11-07): tek şubeye yetkili kullanıcı da başka aktif şubeye nakleder (uygulandı).
3. **Kapasite onayı:** Kapandı (2026-11-07): sekreter de onaylayabilir (uygulandı).
4. **Öğretmen görünürlüğü:** Kapandı (2026-11-07): değişiklik yok, öğretmen personel notlarını ve doğum tarihini görmeye devam eder.
5. **Mezun durumu:** Kapandı (2026-11-07): sezon geçişinde en üst seviye kaydı "mezun" olur (uygulandı).
6. **Yeniden açılan adayın durumu:** Kapandı (2026-11-07): değişiklik yok, "Görüşüldü" kalır.
