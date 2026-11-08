# Bölüm 08 · Ödev takibi

Gereksinim: `docs/bolumler/08-odev-takibi.md`. Plan ve kullanıcı kararları: `docs/PROFESYONELLESME.md`.

## Amaç
Öğretmenin verdiği ödevi velinin görmesi, teslim durumunun derste hızlıca işaretlenmesi, yönetimin verilen ödev ve teslim oranlarını izlemesi. `moduller.odev` ile açılıp kapanır. Puanlama yok.

## Dosyalar
| Dosya | İçerik |
|---|---|
| `index.tsx` | Sekmeli sayfa (default export `Odevler`; `main.tsx` tembel yükler, başka bölüm bu dosyadan içe aktarmıyor) |
| `OdevListesi.tsx` | Liste, özet kartları, hatırlatma, silme onayı |
| `TeslimKontrol.tsx` | Hızlı işaretleme, "yapmadı" bildirimi |
| `YeniOdev.tsx` | Yeni ödev formu |
| `TeslimOranlari.tsx` | Öğretmen ve grup bazında oranlar |
| `ortak.ts` | Tarih biçimi, durum düğmeleri |
| `kurallar.ts` | **Saf iş kuralları** (ekran + sunucu + otomasyon ortak, yalnızca göreli içe aktarma) |
| `kurallar.test.ts`, `sunucu.test.ts` | Birim testleri ve `yazmaDenetle → odevDenetle` testleri |

Sunucu: `app/server/politika.ts · odevDenetle`, `veliVerisi`. Otomasyon: `app/server/zamanlayici.ts`.

## İş kuralları
**Kim**
- Yazma için 08 yetkisi gerekir (genel yönetici, şube müdürü, öğretmen). Şube kapsamı `yazmaDenetle` içindedir.
- Modül kapalıyken ödev yazılamaz, silinemez, ödev bildirimi kuyruğa girmez, veliye ödev gitmez.
- Öğretmen yalnızca bugünkü kendi grubuna (`ogretmenGruplariHesapla`) ve kendi dersinden verir; rehberse grubun programındaki her dersten verebilir.
- Öğretmen yalnızca kendi ödevini değiştirir, siler, kontrol eder. Rehber, grubundaki diğer ödevleri yalnızca görür.
- Grubu devreden öğretmen grubu, öğrencileri, ödevlerini görmez ve yazamaz (karar 2026-11-08).
- Kontrol edilmiş ödevi öğretmen silemez, yönetici siler. Ekran silmeden önce onay ister.

**Alanlar** (`odevYazmaEngeli`)
- Başlık zorunlu (en fazla 200), açıklama en fazla 2000, kaynak en fazla 500 karakter; kırpılarak saklanır.
- Grup ve ders var olmalı; grup dersi almalı (bugün veya ileride geçerli program satırı).
- Teslim tarihi gerçek bir tarih, verilme tarihinden önce değil.
- Seçili öğrenciler boş olamaz, grupta olmalı. Grup sonradan değişmez.
- Var olan kayıtta yalnızca değişen alan denetlenir; program değişse de eski ödev kontrol edilebilir.
- `ogretmenId`, `verilis` ve ilk teslim alanları sunucudan gelir. Yöneticinin verdiği ödevin öğretmeni, o dersin açık program satırındaki öğretmendir. Güncellemede öğretmen ve veriliş değişmez.

**Teslim kontrolü**
- Durumlar: `yapti`, `eksik`, `yapmadi`. Hedef: teslim tarihinde grupta olan, kaydı aktif öğrenci (`odevHedefleri`).
- Teslim tarihi gelmeden kontrol kaydedilemez. Kontrol geri alınamaz; durumlar sonradan düzeltilebilir.
- Hedefte olmayan öğrenci reddedilir. Sonradan ayrılan öğrencinin eski durumu ve notu korunur (sunucu birleştirir).
- Not en fazla 300 karakter, yalnızca `eksik` / `yapmadi` için saklanır.
- Kim kontrol ettiği işlem kaydında görünür (kullanıcı ve zaman sunucudan).

**Bildirim**
- Sunucu her ödev bildirimini gerçek bir ödeve bağlar (`Gonderim.odevId`); karşılığı olmayan bildirim düşer.
- Aynı veliye, aynı öğrenci ve ödev için aynı olay ikinci kez gitmez. Bu alandan önceki kayıtlar metinle eşleşir.
- "Şimdi gönder" ile 19:00 otomasyonu çift hatırlatma üretmez. Kontrol edilmiş ödeve hatırlatma gitmez.
- `yapmadı` kaldırılınca henüz gitmemiş bildirim kuyruktan silinir.
- `izinSms` kapalı veliye SMS gitmez; kanal uygulama içine döner, maliyet 0 olur.

**Oran** (`teslimOzeti`): `yaptı / işaretlenen öğrenci`, yalnızca kontrol edilmiş ödevlerde. Hiç kontrol yoksa "—". Öğretmen yalnızca kendi ödevlerinin oranını görür.

**Veli portalı** (`veliOdevleri`): yalnızca çocuğun hedefinde olduğu ve kaydı iptal olmayan grubun ödevi; durum ve not yalnızca kendi çocuğunun.

## Testler
`npx vitest run src/bolumler/08-odevler`. Ders ve hedef hesabı, alanlar, kontrol, silme, temizleme, bildirim tekrarı, oran; sunucuda modül, yetki, şube, devreden öğretmen, rehber, sunucu alanları, bildirim bağlama, SMS izni, veli görünümü. Tarihler sabittir, gerçek saate bağlı değildir.

## Bilinen sınırlar
- Ek dosya yüklenmez; yalnızca dosya adı kaynak alanına yazılır. Öğrenci / veli fotoğraf yüklemesi yok (doküman: opsiyonel).
- Silinen ödevin kuyrukta bekleyen "yeni ödev" bildirimi silinmez.
- Teslim tarihinden önce gruba katılan öğrenci, ödev verildikten sonra gelse de hedefte görünür; ödev bildirimi almamıştır.
- Bildirim metnini ekran üretir; sunucu bağlar, tekilleştirir, süzer.
- Ödev bildirimleri yalnızca birincil veliye gider (mevcut davranış).

## Açık sorular
1. **Teslimden önce kontrol:** Bu bölümde engellendi (erken "yapmadı" bildirimi yanlış gidiyordu). Öneri: böyle kalsın; öğretmen erken kontrol etmek isterse teslim tarihini ona göre verir.
2. **Grubu devralan öğretmen, önceki öğretmenin kontrol bekleyen ödevleri:** Şu an yalnızca yönetici kontrol edebilir. Öneri: yeni öğretmene devredilmesi; ayrı iş olarak.
3. **Rehberin başka dersten ödev vermesi:** Şu an verebilir (yoklamadan farklı). Öneri: yalnızca kendi dersi olacak şekilde daraltılması, kullanıcı onayıyla.
4. **Kontrolün düzeltilebileceği süre:** Şu an sınırsız. Öneri: öğretmene 7 gün (yoklama geç giriş penceresiyle aynı), sonrası yönetici.
5. **"Yapmadı" düzeltilince veliye mesaj:** Gitmiş bildirim için düzeltme mesajı yok. Öneri: yoklamadaki gibi tek düzeltme mesajı (yeni olay gerektirir).
