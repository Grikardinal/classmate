# Bölüm 13 · Personel ve öğretmen

Gereksinim: [`docs/bolumler/13-personel.md`](../../../../docs/bolumler/13-personel.md)

## Amaç
Öğretmen ve personel kartlarını tutar; ders başı çalışan öğretmenin hak edişini işlenen derslerden ve yapılan etütlerden hesaplar.
Hak ediş ayrı modül anahtarıyla açılır. Finans kapalıyken yalnızca ders sayısı raporu çalışır.

## Dosyalar
| Dosya | İçerik |
|---|---|
| `kurallar.ts` | Saf kurallar: kart doğrulama, maskeleme, pasife alma, silme, hak ediş hesabı, durum akışı, avans. Ekran ve sunucu ortak kullanır |
| `index.tsx` | Sekmeler, default export |
| `PersonelListesi.tsx`, `PersonelKarti.tsx`, `PersonelEkle.tsx`, `PersonelForm.tsx` | Personel ekranları |
| `HakEdis.tsx`, `AvansDialog.tsx` | Aylık hak ediş tablosu, etüt ücreti ayarı, avans girişi |
| `ortak.ts` | Ekrana özel yardımcılar |
| `server/politika.ts · personelDenetle` | Sunucu denetimi; maskeleme `okumaSuz` içinde |
| `kurallar.test.ts`, `sunucu.test.ts` | Testler |

## İş kuralları
**Kart**
- Ad, soyad, geçerli cep telefonu zorunlu; e-posta isteğe bağlı ama geçerli olmalı. Telefon ve e-posta kurum genelinde benzersizdir; müdürün görmediği şube de sayılır.
- Telefon, e-posta, tarih ve branş yalnızca yeni kayıtta veya değiştiyse denetlenir; kurulumda oluşan eksik kayıtlar kilitlenmez.
- Kapsam: kartın bütün şubeleri aktörün kapsamında olmalı. Birden çok şubeli personeli kapsamı yetmeyen müdür yalnızca görüntüler.
- Kimse kendi görevini değiştiremez. Genel yönetici olmayan kişi kendi şubesini ve ücretini değiştiremez, üst görev atayamaz, üst görevlinin kartına dokunamaz.
- Programda açık dersi veya planlı etüdü olan öğretmen pasife alınamaz, görevi değiştirilemez, dersi olan şubeden çıkarılamaz.
- Pasife alınan personelin hesabı da kapanır (`kullaniciDenetle`, Bölüm 02).
- Kart silinmez. Tek istisna içe aktarmanın geri alınmasıdır; o da ders, yoklama, etüt, müsaitlik, avans, ödev, rehberlik, hak ediş kaydı yoksa olur.

**Veri görünürlüğü**
- İletişim: genel yönetici, 13 yetkilisi, kişinin kendisi.
- Ücret: genel yönetici, kişinin kendisi, 13 yetkilisi yalnızca kendinden alt görevdekiler için.
- Avans: 13 yetkisi yoksa yalnızca kendi avansı. Hak ediş durumu şube kapsamıyla süzülür, 13 yetkisi yoksa gitmez.
- Maaş giderinin açıklaması ve hak ediş işlem kayıtları 13 yetkisi olmayana gitmez. Gider tutarı kasa tutsun diye kalır.
- Maskeli gelen alanlar yazarken eski değerle korunur.

**Hak ediş**
- İşlenen ders: öğretmenin yoklaması alınmış, iptal veya tatile denk gelmeyen oturumu. Oturum kimliği tekil olduğu için bir ders iki öğretmene sayılmaz. Yoklamadaki `ogretmenId` sunucuda program satırından yazılır.
- Yoklama düzeltmesi yalnızca öğrenci durumlarını değiştirir; ders sayısını değiştirmez.
- Etüt (karar 2026-11-08): kurum ayarı `Kurum.etutDersUcreti`, varsayılan 0, yalnızca genel yönetici değiştirir. Yalnızca "yapıldı" randevu sayılır; `sonuclar` varsa en az bir öğrenci gelmiş olmalı. Sonuç düzeltmesi hesaba kendiliğinden yansır. Ücret tüm ücret tiplerine eklenir.
- Tutarlar kuruş tamsayısıyla hesaplanır; şube payları toplama tam eşittir. Sabit maaş ana şubeye, ders ücreti dersin şubesine, etüt randevunun şubesine yazılır.
- Avans kendi şubesinin payından düşülür, artarsa diğer şubelerden; hak edişi aşan kısım sonraki aya devreder. Finans gideri iptal edilen avans düşülmez.
- Akış: yok → onaylandı → ödendi, geri dönüş yok. Onay ay bitince verilir. Çok şubeli öğretmeni genel yönetici onaylar. Ödemeyi yalnızca genel yönetici işaretler.
- Ödeme giderleri sunucuda hesaplanan şube dağılımıyla karşılaştırılır; uyuşmazsa reddedilir.
- Pasif veya henüz başlamamış öğretmen için o ayda dersi yoksa satır (ve sabit maaş) çıkmaz.
- Avans değiştirilemez, silinemez; tarih sunucudan gelir, aynı pakette eşleşen Maaş gideri olmalı.

## Testler
`npx vitest run src/bolumler/13-personel`

## Bilinen sınırlar
- Modelde TC, IBAN, ayrılış tarihi ve personel izni yok; bu yüzden ilgili kurallar da yok.
- Ders ücreti şubeye göre farklılaşmıyor (gereksinimde "olabilir" deniyor).
- Ödenmiş aydan sonra iptal edilen avans, donmuş devri geriye dönük değiştirmez.
- Kart görevi değişince hesabın rolü ve şube kapsamı kendiliğinden değişmez (Bölüm 02 ekranından yapılır).
- Grup rehberliği pasife almayı engellemez.
- Toplu personel içe aktarmada (Bölüm 14) ekran denetimi kurum genelini görmez; sunucu yinelenen satırda bütün paketi reddeder.
- Tek maaş ödemesi olan şubede sekreter gider tutarından kişiyi tahmin edebilir.

## Açık sorular
- **Sabit maaşlı öğretmene etüt ücreti:** Ek iş sayılır, her ücret tipine eklenir (karar 2026-11-09, değişiklik yok).

## Kapandı (2026-11-09)
1. **Ödenmiş aya sonradan gelen değişiklik:** Ödemede tutar, ders ve etüt sayısı, birim ücretler sunucuda `hakedisDurum[...].donmus` alanına yazılır; ekran donmuş tutarı gösterir. Sonradan doğan fark ödeme anındaki birimle hesaplanır, sonraki ilk ödenmemiş aya "önceki ay farkı" olarak girer; `aktarilan` iki kez sayılmayı önler. Dondurulmamış eski satırda fark yoktur.
2. **Fazla avans:** Ayın hak edişini aşan avans (ve net eksiye düşüren negatif fark veya düzeltme) sonraki aya devreder; net eksi çıkmaz. Pasif öğretmende kalan devir görünür kalır.
3. **Ödeme gideri iptali:** `personelDenetle` hak edişi "onaylandı"ya döndürür, donmuş tutarı siler, aktarılan farkı geri açar. Ödemenin diğer şube giderleri aynı gerekçeyle birlikte iptal olur; kapsam dışı gider varsa müdür iptal edemez, genel yönetici yapar.
5. **Ay ortası sabit maaş:** Oranlama yok. Yönetici (çok şubeli öğretmende genel yönetici) ay için işaretli tutar ve en az 3 karakter gerekçe girer; kim ve ne zaman sunucudan, "Hak ediş düzeltmesi" işlem kaydına yazılır, ödenmiş ayda yapılamaz.
6. **Hak edişim:** Öğretmene salt okunur `/hak-edisim` sayfası. Veri `okumaSuz` içinde sunucuda hesaplanır (`Db.hakedisim`), koleksiyon değildir, geri yazılamaz; etüt ücreti ve gider gitmez.
7. **Yedek öğretmen:** Oturum bazlı atama (`yedekAtamalari`, Bölüm 06). Yoklamadaki `ogretmenId` yedekten yazılır, ders hak edişte yedeğe sayılır.
