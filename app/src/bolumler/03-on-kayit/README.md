# Bölüm 03 · Ön kayıt (aday öğrenci) yönetimi

Gereksinim: [`docs/bolumler/03-on-kayit.md`](../../../../docs/bolumler/03-on-kayit.md)

## Amaç
Bilgi almak için arayan, gelen veya web formunu dolduran velileri kaybetmemek; görüşme, deneme dersi ve
hatırlatma adımlarını takip edip adayı kesin kayda (Bölüm 04 kayıt sihirbazı) dönüştürmek.

## Dosyalar
| Dosya | İçerik |
|---|---|
| `index.tsx` | Sayfa kabuğu: özet kartlar, "Bugün aranacaklar", sekmeler (default export `OnKayit`, `main.tsx` buradan içe aktarır) |
| `kurallar.ts` | **Saf iş kuralları** (durum akışı, alan doğrulama, yinelenen aday, sorumlu seçimi, dönüşüm oranı, tam yazma denetimi `adayYazmaEngeli`). React'e ve `@/` takma adına bağlı değildir; sunucu da aynı dosyayı kullanır |
| `ortak.tsx` | `tarihKisa`, `AksiyonTarihi`, `useAdayDenetimi` (kaydetmeden önce sunucuyla aynı denetim) |
| `AdayListesi.tsx` | Liste, arama (ad/telefon; boşluk ve büyük/küçük harf farkı yok), durum ve kaynak filtresi |
| `AdayPanosu.tsx` | Durum sütunları arasında sürükle-bırak |
| `AdayRaporlari.tsx` | Kaynağa ve şubeye göre dönüşüm, vazgeçme nedenleri |
| `AdayKarti.tsx` | Aday kartı: bilgiler, durum, şube devri, sorumlu, teklif (Finans açıksa), KVKK bilgisi, not zaman çizelgesi, "Kesin kayda çevir" |
| `HizliEkle.tsx` | Telefonla arayan veli için kısa form |
| `WebFormu.tsx` | Kurum sitesine konacak ön kayıt formunun önizlemesi (açık rıza zorunlu, teşekkür SMS'i kuyruğa) |
| `kurallar.test.ts` | Saf kuralların birim testleri |
| `sunucu.test.ts` | Sunucu denetiminin (`server/politika.ts` · `onKayitDenetle`, `okumaSuz`) testleri |

Sunucu tarafı: `server/politika.ts` içindeki `onKayitDenetle()` her `/api/degisiklik` isteğinde
`yazmaDenetle()` sonunda çalışır ve `adayYazmaEngeli()` ile aynı kuralları ekrandan bağımsız uygular.
`yazmaDenetle()` aday satırını yazmadan önce telefonu tek biçime (`05xx xxx xx xx`) çevirir, ad boşluklarını temizler,
oluşturma tarihini sunucu zamanından koyar ve yeni eklenen notların yazar/zamanını oturumdaki kullanıcıdan yazar.

## Yetki ve şube kapsamı
- **Yazma:** Bölüm 03 yetkisi. Bölüm 04 yetkisi tek başına yalnızca **kesin kayıt dönüşümüne** izin verir
  (sihirbaz adayı "kayıt oldu" yapar). Bölüm 14 yetkisi yalnızca vazgeçen adayın **anonimleştirilmesine** izin verir.
  Öğretmen (varsayılan) aday verisini ne görür ne yazar.
- **Okuma:** aday kişisel veri içerdiği için yalnızca 03 veya 04 yetkisi olan roller (ve genel yönetici) görür;
  her kullanıcı yalnızca kapsamındaki şubelerin adaylarını görür.
- **Şube kapsamı:** adayın eski ve yeni şubesi kullanıcının kapsamında olmalı; başka şubenin adayı görülmez ve değiştirilmez.
  Genel yönetici tüm şubeler arasında devredebilir. **Tek istisna, kapsam dışına devir** (karar 2026-11-07; aşağıda):
  `yazmaDenetle` yeni hal için kapsam denetimini yalnızca var olan adayın şubesi değiştiğinde atlar, kuralı `onKayitDenetle` uygular.
  Diğer koleksiyonlarda ve yeni adayda kapsam denetimi aynen geçerlidir.
- **Modül:** `onKayit` modülü kapalıyken sunucu aday yazmayı reddeder (sayfa da menüden kalkar).
  Tek istisna KVKK anonimleştirmesidir (Bölüm 14), saklama yükümlülüğü modülden bağımsızdır.
- Aday silinmez; vazgeçti olarak işaretlenir, saklama süresi dolunca anonimleştirilir.

## İş kuralları (`kurallar.ts`)
- **Alanlar:** veli adı (en az 2, en fazla 80 karakter) ve cep telefonu zorunlu (`telefonNormalize`: `+90`, `90`, baştaki 0'sız
  yazımlar kabul; sabit hat ve eksik hane reddedilir). Öğrenci adı boşsa "—". Sınıf 3–8. Tarihler `YYYY-AA-GG`.
  Fiyat teklifi boş veya ≥ 0. Not metni boş olamaz, en fazla 2000 karakter.
- **Durum akışı:** yeni / görüşüldü / deneme dersi / düşünüyor / vazgeçti arasında serbest geçiş (vazgeçen aday geri dönebilir).
  "Kayıt oldu" **yalnızca** kesin kayıt sihirbazıyla, öğrenci kartı aynı pakette oluşturularak verilir; elle veya panoda
  sürükleyerek seçilemez. Kayda dönüşmüş aday **geri alınamaz** ve bilgileri kilitlenir (öğrenci kartından yönetilir).
  Yeni aday doğrudan "kayıt" durumunda eklenemez; bir öğrenci kartı yalnızca bir adaya bağlanabilir.
- **Vazgeçme nedeni** yalnızca vazgeçen adayda tutulur ve orada zorunludur (panoya bırakılırsa "Diğer").
- **Görüşme notları** zaman çizelgesidir: eski notlar silinmez/değiştirilmez, yalnızca sona eklenir.
- **Şube ve sorumlu:** yeni aday veya devirde şube aktif olmalı. Sorumlu personel adayın şubesinde görevli, aktif ve
  öğretmen olmayan biri olmalı (yeni adayda, devirde veya sorumlu değişince denetlenir). Hızlı ekle ekleyeni,
  web formu şubenin sekreterini (yoksa şube müdürünü) sorumlu yapar; devirde sorumlu yeni şubeye göre önerilir.
- **Kapsam dışına devir** (karar 2026-11-07, `adayDevirEngeli`): kapsamı sınırlı kullanıcı (ör. tek şubeli şube müdürü,
  03 yetkili sekreter) kendi kapsamındaki adayı kapsamı dışındaki **aktif** bir şubeye devredebilir; devirden sonra aday onun
  kapsamından çıkar ve görünmez. Kurallar: devreden adayın **eski** şubesinde yetkili olmalı (03 yetkisi + kapsam);
  hedef şube aktif olmalı; aynı pakette adayın **başka alanı değişemez** (yalnızca şube, sorumlu ve sona eklenen not —
  en güvenli seçenek: önce değişiklik kaydedilir, sonra devredilir); sorumlu hedef şubeden `varsayilanSorumlu()` ile
  **sunucuda** atanır (ekran hedef şubenin tüm personelini göremeyebilir), hedefte uygun personel yoksa devir reddedilir;
  kayda dönmüş ve anonim aday devredilemez. İşlem kaydı ("Aday devri") devreden şubeye yazılır. Ekran hedef listesinde
  tüm aktif şubeleri gösterir, kapsam dışı hedefte "devirden sonra bu adayı göremeyeceksiniz" uyarısı ve onay ister.
- **Yinelenen aday:** aynı veli telefonu (normalize edilerek) ve aynı öğrenci adıyla (ya da birinin adı yoksa) **açık** bir
  aday varken yenisi eklenemez. Farklı adlı kardeş, sonuçlanmış veya anonim aday engel değildir.
- **Kesin kayda çevir:** kayda dönmüş veya anonimleştirilmiş aday çevrilemez; Bölüm 04 sihirbazı da böyle bir adayı
  (`?aday=` parametresiyle) ön doldurmaz. Dönüşümde vazgeçme nedeni temizlenir. Veli eşleştirme (aynı telefonlu mevcut
  veliye bağlama), mükerrer öğrenci, grup kapasitesi, aktif sezon ve sözleşme numarası Bölüm 04 sihirbazının kurallarıdır.
- **Bugün aranacaklar:** açık ve sonraki aksiyon tarihi bugün veya geçmiş olan adaylar (Bölüm 12 paneli de aynı tanımı kullanır).
- **Dönüşüm oranı:** sonuçlanan (kayıt + vazgeçti) adaylar içinde kayıt olanların yüzdesi.
- **KVKK:** açık rıza (`rizaVar`) kaydedilir; web formunda rıza işaretlenmeden gönderilemez. Vazgeçen adaylar Bölüm 14'te
  `saklamaAyAday` sonunda anonimleştirilir (`veliTelefon = "*** *** ** **"`, notlar silinir); anonim aday değiştirilemez,
  anonimleştirmede kişisel alanlar dışında bir şey değişemez.

## Testler
- `kurallar.test.ts` (21 test): durum geçişi, alan doğrulama, not ekleme, arama, sayımlar, yinelenen aday, sorumlu seçimi, tam yazma engeli, anonimleştirme, kapsam dışına devir.
- `sunucu.test.ts` (23 test): telefon/ad normalizasyonu ve sunucu alanları, şube kapsamı (okuma/yazma/devir), öğretmen ve yetkisiz rol,
  durum akışı, notların korunması, kesin kayıt paketi, modül kapalı, KVKK anonimleştirme, silme yasağı,
  kapsam dışına devir (sunucuda sorumlu ataması, devirden sonra görünmezlik, başka alan/pasif şube/kayıtlı aday reddi, istisnanın başka koleksiyona sızmaması).

Çalıştırma (`app/` içinde): `npx vitest run src/bolumler/03-on-kayit`

## Bilinen sınırlar / açık sorular
- ~~Şubeler arası devir~~ — **karar verildi (2026-11-07): evet**, kapsam dışındaki aktif şubeye devir yapılabilir (yukarıda).
- **Kayıt iptali:** kesin kayıt Bölüm 04'te iptal edilirse aday şu an "kayıt oldu" kalır. Karar (2026-11-07): aday yeniden açılır — Bölüm 04'te uygulanacak.
- **Gerçek web formu:** `WebFormu.tsx` personel oturumuyla çalışan bir önizlemedir; kimlik doğrulamasız genel bir uç
  (`/api/on-kayit`, hız sınırı, bot koruması) yoktur. Yeni özellik olduğu için bu bölümde eklenmedi.
- **Deneme dersi hatırlatması** ve "teşekkür" dışındaki otomasyonlar Bölüm 10'un (iletişim) işidir; burada denetlenmedi.
- **Hızlı eklemede açık rıza** zorunlu değildir (sözlü onay işaretlenebilir); rızası olmayan adaya SMS gönderilmemesi Bölüm 10'da ele alınmalı.
- Eski verideki "kayıt oldu" adayların bir kısmında öğrenci bağı (`ogrenciId`) yok; bunlar kilitli kalır, otomatik eşleştirilmez.
- Fiyat teklifi yalnızca sayıdır; sezon/fiyat listesiyle ilişkisi Bölüm 05 kararına bağlıdır.
