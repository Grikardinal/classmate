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
- Avans kendi şubesinin payından düşülür, artarsa diğer şubelerden. Finans gideri iptal edilen avans düşülmez.
- Akış: yok → onaylandı → ödendi, geri dönüş yok. Onay ay bitince verilir. Çok şubeli öğretmeni genel yönetici onaylar. Ödemeyi yalnızca genel yönetici işaretler.
- Ödeme giderleri sunucuda hesaplanan şube dağılımıyla karşılaştırılır; uyuşmazsa reddedilir.
- Pasif veya henüz başlamamış öğretmen için o ayda dersi yoksa satır (ve sabit maaş) çıkmaz.
- Avans değiştirilemez, silinemez; tarih sunucudan gelir, aynı pakette eşleşen Maaş gideri olmalı.

## Testler
`npx vitest run src/bolumler/13-personel`

## Bilinen sınırlar
- Modelde TC, IBAN, ayrılış tarihi ve personel izni yok; bu yüzden ilgili kurallar da yok.
- Ders ücreti şubeye göre farklılaşmıyor (gereksinimde "olabilir" deniyor).
- Yedek öğretmen için ayrı oturum ataması yok; yoklama program satırındaki öğretmene yazılır.
- Kart görevi değişince hesabın rolü ve şube kapsamı kendiliğinden değişmez (Bölüm 02 ekranından yapılır).
- Grup rehberliği pasife almayı engellemez.
- Toplu personel içe aktarmada (Bölüm 14) ekran denetimi kurum genelini görmez; sunucu yinelenen satırda bütün paketi reddeder.
- Tek maaş ödemesi olan şubede sekreter gider tutarından kişiyi tahmin edebilir.

## Açık sorular
1. **Ödenmiş aya sonradan gelen değişiklik:** Geç girilen yoklama veya etüt düzeltmesi ödenmiş ayın ekrandaki tutarını değiştirir, gider değişmez. Öneri: ödeme anında tutarı dondurup farkı sonraki aya "düzeltme" satırı olarak taşımak.
2. **Fazla avans:** Avans hak edişi aşarsa ödenecek eksi görünür, fark sonraki aya taşınmaz. Öneri: farkı otomatik sonraki aya devretmek.
3. **Ödeme gideri iptal edilirse:** Durum "ödendi" kalır. Öneri: gider iptalinde durumu "onaylandı"ya döndürmek.
4. **Sabit maaşlı öğretmene etüt ücreti:** Şimdilik her ücret tipine ekleniyor. Öneri: ek iş sayıldığı için böyle kalsın; istenmezse tek satırla sabit tip hariç tutulur.
5. **Ay ortasında başlayan veya ayrılan sabit maaşlı:** Tam ay yazılıyor. Öneri: gün oranlaması yerine genel yöneticinin elle düzeltebileceği bir alan.
6. **Öğretmenin kendi hak edişini görmesi:** Şu an ekran yalnızca yöneticilerde; öğretmen sadece kendi ücret alanlarını ve avansını alır. Öneri: öğretmene salt okunur "Hak edişim" görünümü.
7. **Yedek öğretmene ödeme:** Öneri: oturum bazlı yedek ataması eklenip yoklama `ogretmenId` alanının ona yazılması.
