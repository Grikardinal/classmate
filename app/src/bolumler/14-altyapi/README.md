# Bölüm 14 · Teknik altyapı, güvenlik ve KVKK

Gereksinim: `docs/bolumler/14-altyapi-guvenlik-kvkk.md`. Plan ve kullanıcı kararları: `docs/PROFESYONELLESME.md`.

## Amaç
Kurumun Excel verisini güvenle içeri almak, veriyi yedeklemek ve dışa aktarmak, önemli işlemleri izlemek, kişisel veri başvurularını karşılamak ve uygulamanın üretimde güvenli varsayılanlarla çalışmasını sağlamak.

## Dosyalar
| Dosya | İçerik |
|---|---|
| `index.tsx` | Sekmeler (default export) |
| `IceAktarma.tsx` | Öğrenci sihirbazı, önceki aktarımlar |
| `PersonelAktarma.tsx` | Personel içe aktarma |
| `DisaAktarma.tsx` | CSV dışa aktarma, yedek alma ve geri yükleme |
| `IslemKaydi.tsx` | İşlem kaydı |
| `Kvkk.tsx` | Veri sahibi başvurusu, saklama süreleri |
| `SistemAyarlari.tsx` | Ayarlar |
| `sablonlar.ts` | Excel şablon sütunları |
| `kurallar.ts` | **Saf iş kuralları** (ekran ve sunucu ortak; yalnızca göreli içe aktarma) |
| `kurallar.test.ts`, `sunucu.test.ts` | Birim, yazma denetimi ve API testleri |

Sunucu: `app/server/uygulama.ts` (HTTP güvenliği, `/api/yedek*`, `/api/kvkk/anonimlestir`, `/api/demo/sifirla`), `politika.ts` (`yazmaDenetle`), `yedek.ts`, `veritabani.ts · tamamenYaz`, `index.ts · demoModu`.

## İş kuralları
**Yedek**
- Tüm yedek uçları yalnızca genel yönetici; tam indirme işlem kaydına yazılır.
- Yedekte parola özeti, oturum, push aboneliği ve VAPID anahtarı yoktur (ayrı tablolar).
- Gece 03:00'ten sonra otomatik yedek, 30 gün saklama. Yazma geçici dosya + yeniden adlandırma ile; başarısız gece yedeği dakikada bir yeniden denenir.
- Dosya adı yalnızca sunucunun ürettiği kalıba uyabilir (yol geçişi yok).
- Geri yükleme: biçim doğrulaması (zorunlu alanlar, satır kimlikleri, tekrar eden kimlik), en çok 64 MB, öncesinde otomatik yedek, **tek veritabanı işlemi** (yarıda kalırsa eski veri durur). Yöneticiyi dışarıda bırakan yedek reddedilir.
- Geri yükleme KVKK silmesini geri almaz: mevcut veride anonim olan kişi yedekte açıksa yeniden anonimleştirilir, başvuru kayıtları korunur.

**HTTP güvenliği**
- CSP, `X-Frame-Options: SAMEORIGIN` (veli önizleme iframe'i), `nosniff`, HSTS. `/api/*` yanıtları `no-store`.
- Çerez `HttpOnly`, `SameSite=Strict`, üretimde `Secure`. Yazma isteklerinde içerik türü tam olarak `application/json` olmalı.
- Gövde sınırı 8 MB (geri yükleme 64 MB). Bozuk gövde 400, beklenmeyen hata 500 ve genel mesaj; ayrıntı yalnızca günlükte.
- `/api/durum` üretimde (demo dışı) altyapı bilgisi vermez. `/api/demo/sifirla` yalnızca demoda ve genel yöneticiye açık.

**Üretim yapılandırması**
- `DEMO` tanımsızsa üretimde kapalı, geliştirmede açık. `render.yaml` demoyu açıkça `1` yapar.
- Demo dışı ilk kurulumda `ILK_YONETICI_PAROLA` zorunlu ve parola kuralına uymalı; denetim veriden önce yapılır.
- Konsol SMS üretimde telefon ve kodu günlüğe yazmaz. Açılışta eksik yapılandırma uyarıları basılır (sır içermez).

**Eşzamanlılık**
- Tüm yazmalar tek süreçte sıralı kuyruktan geçer; önce veritabanı işlemi, başarılıysa bellek güncellenir. Başarısız yazma bellekte iz bırakmaz.

**İçe aktarma**
- En çok 10 MB ve 5000 satır; `.xlsx` içindeki aşırı büyük dosya reddedilir.
- Sözleşme yılı aktif sezonun başlangıcından. Kapasite aşımı satır uyarısıdır. Okunamayan doğum tarihi uyarıyla boş aktarılır.
- `iceAktarmaId` yalnızca aynı pakette açılan partiyle yazılır; Bölüm 05'in "ücretsiz kayıt" istisnası bu alana dayandığı için istemci tek başına bu istisnayı kullanamaz. Fiyat modeliyle uyum: aktarılan kayıt 0/0 açılır, taksit üretilmez.
- Geri alma aynı pakette parti işaretlenince geçerlidir; aktarımdan sonra yoklama, ödeme, izin veya etüt girildiyse reddedilir.

**KVKK**
- Anonimleştirme sunucuda yapılır (`/api/kvkk/anonimlestir`, hepsi ya da hiçbiri, yalnızca genel yönetici). Kapsam: kimlik alanları, sağlık notu, notlar, izin ve ödev notu, bağlı aday, gelecekteki etüt, gönderim metinleri (bekleyenler gönderilmez), işlem kaydındaki ad, veli için push aboneliği ve oturumlar.
- Korunan: kimliksiz yoklama, kayıt satırları ve finans satırları (finans satırında ad yoktur).
- Aktif öğrencisi olan veli anonimleştirilemez.
- Finans açıkken açık taksiti olan öğrenci: ekranda toplam tutar gösterilir; sunucu `borcOnay: true` olmadan 409 döner. Borç satırı ve tutar kalır, kişi bilgisi anonimleşir, onay işlem kaydına yazılır.
- Finans kayıtları (taksit, tahsilat, iade, gider) `FINANS_SAKLAMA_YIL` = 10 yıl dolmadan silinemez. **Mali müşavir onayı gerekiyor.** Süre dolsa da uygulamada silme aracı yoktur.
- Saklama süresi dolan aday ve ayrılan öğrenci sayısı gösterilir; yönetici tek tuşla da anonimleştirebilir.
- **Haftalık otomatik iş** (`kvkkHaftalik`, `otomatikAnonimlestirmePlani`): `kvkkOtomatik` ayarı (yalnızca genel yönetici; alan yoksa açık). Gece 03:00 sonrası, haftada bir; demoda çalışmaz. Önce yedek alır, yedek alınamazsa o hafta işlem yapmaz. Tek çalıştırmada en çok 500 kişi. Süren kaydı olan öğrenci işlenmez; borçlu öğrenci KVKK ekranında "Elle karar bekliyor"da kalır. Veli yalnızca tüm çocukları anonimse, kendisine bağlı borç ve açık adayı yoksa işlenir. İşlem kaydı `Sistem` adıyla ve yalnızca sayı içerir.

**İşlem kaydı**: kullanıcı ve zaman sunucudan; değiştirilemez, silinemez, şube kapsamı sunucuda. "Sistem" adı yalnızca devamsızlık uyarısında kabul edilir. KVKK başvuru kaydı da değiştirilemez.

**Ayarlar**: yalnızca genel yönetici; tüm sayısal alanların sunucu sınırı `AYAR_SINIRLARI`'ndadır.

**Bölüm 12'den devir (sekreter 05):** Doküman 02 sekretere tahsilat verir, finans raporlarını hariç tutar. Varsayılan `05: true` buna uyuyor; raporlar zaten `finansPanelGorur` ile kapalı. Varsayılan değiştirilmedi, mevcut kurulumların rol tablosuna dokunulmadı.

## Testler
`npx vitest run src/bolumler/14-altyapi`. Yedek dosyaları geçici klasöre yazılır.

## Bilinen sınırlar
- **Tek süreç:** veri bellekte, kuyruk ve deneme sayaçları süreç içinde. İkinci kopya çalıştırılamaz.
- **Sürüm çakışması yok:** iki kullanıcı aynı satırı değiştirirse son yazan kazanır (satır düzeyinde).
- İşlem kaydı uygulama düzeyinde değişmezdir; veritabanı yöneticisi ve yedekten geri yükleme onu değiştirebilir.
- Yedeklerdeki anonimleştirilmiş kişilerin eski kopyaları saklama süresi (30 gün) dolana dek durur.
- Dosya yedeği kurulum sunucusunun diskindedir; Render ücretsiz planda kalıcı değildir.
- Fiilen yalnızca genel yönetici içe aktarabilir: 14 yetkisi verilmiş şube kullanıcısının parti, KVKK ve genel işlem kaydı satırları "kurum geneli" olduğu için reddedilir.
- Aktarılan öğrencinin cinsiyeti şablonda sütun olmadığı için "K" yazılır; `kvkkOnay` boştur, aydınlatma kayıt ekranında alınmalıdır.
- Şube kullanıcısı kapsamı dışındaki bir veliyi göremez; aynı telefonlu satır aktarımda reddedilir.

## Canlıya alma kontrol listesi
1. `DEMO=0` (veya tanımsız), güçlü `ILK_YONETICI_PAROLA`; ilk girişten sonra ortamdan kaldırın.
2. `DATABASE_URL` ile yönetilen PostgreSQL ve sağlayıcı yedeği; KVKK açısından uygun bölge.
3. Yalnızca HTTPS; `npm run start` (`--uretim`, `Secure` çerez).
4. **Ters vekil `x-forwarded-for` başlığını kendisi yazmalı** (istemciden geleni silerek); aksi halde IP başına deneme sınırı aşılabilir.
5. **Netgsm kimliği güvenli yönteme geçirilmeli** (şu an HTTP GET parametresinde; IP kısıtlı API alt kullanıcısı ve POST/başlık). `SMS_SAGLAYICI=netgsm`, onaylı başlık.
6. `YEDEK_DIZIN` kalıcı diskte, yalnızca sunucu kullanıcısı erişebilir; yedeği ayrıca şifreli olarak başka yere kopyalayın.
7. Ayda bir yedekten dönüş testi (doküman gereği): yedeği ayrı kurulumda geri yükleyin.
8. Tek kopya çalıştırın (otomatik ölçeklemeyi kapatın).
9. Aydınlatma metni sürümü, yurt dışı aktarım (Render, web push, WhatsApp) değerlendirmesi.
10. Sunucu günlüklerine erişimi sınırlayın.
11. **Yedek dosyası şifreleme** devreye alınmalı (karar 2026-11-09; anahtar yönetimiyle birlikte).
12. Finans modülü açılınca "aylık beklenen ve tahsil edilen" grafiği eklenmeli (Bölüm 12 kararı).
13. **Mali müşavir onayı:** finans kayıtlarının 10 yıl saklanması.
14. **Hukuk danışmanı onayı:** açık borçlu öğrencinin anonimleştirilmesi, aydınlatma ve rıza metinleri.

## Kapandı (2026-11-09)
Kararlar: `docs/PROFESYONELLESME.md`.
1. **Saklama süresi dolunca anonimleştirme:** haftalık otomatik, varsayılan açık; ayardan kapatılabilir.
2. **Borcu olan öğrenci:** uyarı ve açık onay, karar yöneticide; hukuk danışmanına sorulacak (kontrol listesi 14).
3. **Finans kayıtları saklama:** 10 yıl; mali müşavir onayı gerekiyor (kontrol listesi 13).
4. **Şube müdürüne içe aktarma:** açılmaz (değişiklik yok).
5. **Yedek dosyası şifreleme:** canlıya geçerken yapılır (kontrol listesi 11).
6. **Yazı tipi:** uygulamanın içine alındı (`@fontsource/plus-jakarta-sans`, OFL-1.1, latin + latin-ext); CSP'de Google alan adı yok.
7. **`DEMO` varsayılanı:** yeni davranış korunur (değişiklik yok).
