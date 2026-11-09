# Profesyonelleştirme planı

Proje 14 bölüme ayrıldı; her bölümün arayüz kodu kendi klasöründe
(`app/src/bolumler/NN-ad/`), gereksinim dokümanı `docs/bolumler/` altında.
Bölümler **sırayla** ele alınır: bir bölüm bitip kontrol edilmeden sonrakine geçilmez.

## Her bölümde yapılanlar
1. Kod incelemesi: hatalar, uç durumlar, yetki/şube kontrolleri, doküman ile uyum.
2. Hataların düzeltilmesi ve gerekiyorsa bölümün kendi klasörüne bölünmesi.
3. Bölüm iş kuralları için birim testleri (`*.test.ts`, bölüm klasöründe).
4. Bölüm klasörüne `README.md` (amaç, dosyalar, kurallar, testler, bilinen sınırlar).
5. Kontrol: `npm run check` = tip denetimi + tüm testler + build + duman testi.
6. Commit ve GitHub'a push.

## Bölümler ve ajanlar

| # | Bölüm | Klasör | Ajan | Durum |
|---|---|---|---|---|
| 00 | Hazırlık: klasör yapısı, `check`/`smoke` betikleri | — | ana oturum | ✅ |
| 01 | Kurum yapısı ve tanımlar | `app/src/bolumler/01-kurum-yapisi` | 1 | ✅ |
| 02 | Kullanıcılar ve yetkiler | `app/src/bolumler/02-kullanicilar` | 2 | ✅ |
| 03 | Ön kayıt | `app/src/bolumler/03-on-kayit` | 3 | ✅ |
| 04 | Öğrenci, veli ve kayıt | `app/src/bolumler/04-ogrenciler` | 4 | ✅ |
| 05 | Finans | `app/src/bolumler/05-finans` | 5 | ✅ |
| 06 | Ders programı | `app/src/bolumler/06-ders-programi` | 1 | ✅ |
| 07 | Yoklama | `app/src/bolumler/07-yoklama` | 2 | ✅ |
| 08 | Ödev takibi | `app/src/bolumler/08-odevler` | 3 | ✅ |
| 09 | Etüt ve birebir ders | `app/src/bolumler/09-etut` | 4 | ✅ |
| 10 | İletişim ve bildirimler | `app/src/bolumler/10-iletisim` | 5 | ✅ |
| 11 | Veli ve öğrenci portalı | `app/src/bolumler/11-veli-portali` | 1 | ✅ |
| 12 | Yönetim paneli ve raporlar | `app/src/bolumler/12-yonetim-paneli` | 2 | ✅ |
| 13 | Personel | `app/src/bolumler/13-personel` | 3 | ✅ |
| 14 | Altyapı, güvenlik, KVKK | `app/src/bolumler/14-altyapi` | 4 | ✅ |

## Kullanıcı kararları

| Tarih | Konu | Karar | Nerede uygulanacak |
|---|---|---|---|
| 2026-11-07 | Fiyat listesi modeli (doküman: sezon + seviye + şube; kod: yalnızca şube) | Sezon + şube + seviye bazında fiyat; eski biçim açılışta/yedekte çevrilir | Bölüm 05 ✅ |
| 2026-11-07 | Sezon geçişinde fiyat / indirim / ek hizmet | Eski kayıttan kopyalanmaz, **yeni sezonun fiyatları** uygulanır | Bölüm 05 ✅ (hedef fiyat tanımsızsa geçiş uyarıyla durur) |
| 2026-11-07 | Programda kullanılmış derslik / ders saati | **Sil + pasif** ikisi de olsun: kullanılmamış kayıt silinir, kullanılmış kayıt pasife alınır (geçmiş korunur, yeni programda seçilemez) | Bölüm 01 ek iş ✅ |
| 2026-11-07 | Aday şube devri | Tek şubeden sorumlu müdür de adayı **başka şubeye devredebilir** (devirden sonra aday onun kapsamından çıkar) | Bölüm 03 ek iş ✅ |
| 2026-11-07 | Kaydı iptal edilen öğrencinin adayı | Aday **yeniden açılır** (kayda dönüşmüş durumundan çıkar, "Görüşüldü") | Bölüm 04 ✅ |
| 2026-11-07 | İptal sonrası geri dönen öğrenci | Yeni kart açılmaz; **mevcut kart üzerinden yeni kayıt** açılır | Bölüm 04 ek iş ✅ |
| 2026-11-07 | Öğrenci nakli | Tek şubeye yetkili kullanıcı da öğrenciyi **başka aktif şubeye nakledebilir** | Bölüm 04 ek iş ✅ |
| 2026-11-07 | Kapasite aşımı onayı | **Sekreter de** onaylayabilir | Bölüm 04 ek iş ✅ |
| 2026-11-07 | Öğretmenin gördüğü öğrenci alanları | Personel notları ve doğum tarihi **görünür kalır** (değişiklik yok) | — |
| 2026-11-07 | Sezon sonunda en üst seviye | Kaydı **"mezun"** olarak işaretlenir | Bölüm 04 ek iş ✅ |
| 2026-11-07 | Yeniden açılan aday durumu | **"Görüşüldü"** kalır (değişiklik yok) | — |
| 2026-11-08 | İptal edilen kaydın kalan borcu | **İade ve cayma bedeli yapısı** kurulur | Bölüm 05 ek iş ✅ |
| 2026-11-08 | Dondurulan kaydın vadeleri | Taksitler **aynen sürer**, yalnızca otomatik hatırlatma durur (değişiklik yok) | — |
| 2026-11-08 | Sekreterin indirim uygulaması | Sekreter uygulayabilir, **yönetici onayıyla** geçerli olur | Bölüm 05 ek iş ✅ |
| 2026-11-08 | Yanlış girilen gider / virman | Yönetici **gerekçeyle iptal** eder, iptal gününe **ters kayıt** düşer | Bölüm 05 ek iş ✅ |
| 2026-11-08 | İptal edilmiş kaydın tahsilatı | **İptal edilemez**; yanlış tahsilat kayıt iptalinden önce düzeltilir | Bölüm 05 ek iş ✅ |
| 2026-11-08 | Grubu devreden öğretmenin erişimi | **Kesilir** (grup ve öğrencileri artık görmez) | Bölüm 06 ek iş ✅ |
| 2026-11-08 | Branş dışı (yedek) öğretmen ataması | **Yalnızca yönetici** yapabilir | Bölüm 06 ek iş ✅ |
| 2026-11-08 | Ders iptalinin geri alınması | Dersin **tarihi geçmediyse** geri alınabilir | Bölüm 06 ek iş ✅ |
| 2026-11-08 | Şube müdürü, öğretmenin diğer şubelerdeki dersleri | Yalnızca **dolu saat** olarak görür, ders ayrıntısı yok | Bölüm 06 ek iş ✅ |
| 2026-11-08 | Sezon bitince açık ders satırları | **Sezon sonu tarihiyle otomatik kapanır** | Bölüm 06 ek iş ✅ |
| 2026-11-08 | İzinli dersler ve devamsızlık oranı | İzinli dersler **orandan çıkarılır** (pay ve payda) | Bölüm 07 ek iş ✅ |
| 2026-11-08 | Yoklama "yok"tan "var"a düzeltilince | Veliye **düzeltme mesajı** gider, kuyrukta bekleyen SMS **iptal edilir** | Bölüm 07 ek iş ✅ |
| 2026-11-08 | Geçmişe dönük girilen devamsızlık | Veliye **tarihli ayrı mesaj** gider | Bölüm 07 ek iş ✅ |
| 2026-11-08 | Sekreterin yoklama alması | Aynı gün ve 7 güne kadar geç giriş; geçmiş düzeltme yok (değişiklik yok) | — |
| 2026-11-08 | Öğretmenin geç giriş sınırı | **7 gün** (değişiklik yok) | — |
| 2026-11-08 | Dersi olmayan güne veli izni | **Reddedilir** | Bölüm 07 ek iş ✅ |
| 2026-11-08 | Teslimden önce ödev kontrolü | **Engelli** kalır (değişiklik yok); kontrol edilmiş ödevi yalnızca yönetici siler | — |
| 2026-11-08 | Grubu devralan öğretmen | Önceki öğretmenin kontrol bekleyen ödevlerini **kontrol edebilir** | Bölüm 08 ek iş ✅ |
| 2026-11-08 | Rehber öğretmenin ödev vermesi | Yalnızca **kendi dersinden** | Bölüm 08 ek iş ✅ |
| 2026-11-08 | Ödev kontrolünü düzeltme süresi | Öğretmene **7 gün**, sonrası yönetici | Bölüm 08 ek iş ✅ |
| 2026-11-08 | "Yapmadı" düzeltilince | Bildirim gitmişse veliye **tek düzeltme mesajı** | Bölüm 08 ek iş ✅ |
| 2026-11-08 | Öğrencinin grup dersiyle çakışan randevu | **Engellenir** | Bölüm 09 ek iş ✅ |
| 2026-11-08 | Grup etüdü kontenjanı | Kurum geneli ayar, **varsayılan 6** | Bölüm 09 ek iş ✅ |
| 2026-11-08 | Yönetim randevu iptali | Veliye **bildirim gider** | Bölüm 09 ek iş ✅ |
| 2026-11-08 | Öğretmene etüt onay/hatırlatma bildirimi | Personel bildirim kanalıyla birlikte değerlendirilir | Bölüm 10 |
| 2026-11-08 | Yanlış işaretlenen etüt sonucu | **Yalnızca yönetici**, gerekçeyle, paket hakkı iadesiyle düzeltir | Bölüm 09 ek iş ✅ |
| 2026-11-08 | "Paket bitiyor" bildirimi | Kalan hak 1'e düşünce sunucu **bir kez otomatik** gönderir | Bölüm 09 ek iş ✅ |
| 2026-11-08 | Etüdün öğretmen hak edişine yansıması | Kurum ayarıyla **ders başı ücret** | Bölüm 13 ✅ |
| 2026-11-08 | Grup etüdünde yoklama | **Öğrenci bazında** sonuç | Bölüm 09 ek iş ✅ |
| 2026-11-08 | Kayıt iptalinde randevu ve paket | Planlı randevular iptal edilir; paket hakkı/iadesi finans açıksa iptal hesabına bağlanır | Bölüm 09 ek iş ✅ |
| 2026-11-09 | Öğretmene etüt bildirimi | Yeni kanal kurulmaz, **takvim ekranında** gösterilir | Bölüm 10 ek iş ✅ |
| 2026-11-09 | Devamsızlıkta SMS izni | İzne uyulur; veli izni kapatırken **ekranda uyarı** çıkar | Bölüm 10 ek iş ✅ |
| 2026-11-09 | Sessiz saatte ders iptali | Sabahı bekler (değişiklik yok) | — |
| 2026-11-09 | Takılı kalan gönderim | Otomatik tekrar yok, personel karar verir (değişiklik yok) | — |
| 2026-11-09 | Netgsm kimlik bilgisi | SMS hesabı netleşince güvenli yönteme geçilir | Canlıya alma |
| 2026-11-09 | Şablona uymayan metin | **Tamamen reddedilir** | Bölüm 10 ek iş ✅ |
| 2026-11-09 | IP başlığı (`x-forwarded-for`) | Ters vekil başlığı kendisi yazar | Canlıya alma |
| 2026-11-09 | İkinci velinin taksitleri görmesi | Çocuğa bağlı her veli görür (değişiklik yok) | — |
| 2026-11-09 | Ayrılan çocuğun açık borcu | Portalda **Ödemeler ekranında görünür** | Bölüm 11 ek iş ✅ |
| 2026-11-09 | Sağlık notu ve veli | Veliye **gönderilmez** (değişiklik yok) | — |
| 2026-11-09 | Veli randevu iptali | **Onay penceresi** eklenir | Bölüm 11 ek iş ✅ |
| 2026-11-09 | Tek çocuğu ayrılan velinin borcu | Portal girişi açılmaz, borç takibi personelde (değişiklik yok) | — |
| 2026-11-09 | "Aylık beklenen ve tahsil edilen" grafiği | Finans modülü canlıya alınınca eklenir | Finans canlıya alma |
| 2026-11-09 | Kasa raporu tarih aralığı | **Eklenir** | Bölüm 12 ek iş ✅ |
| 2026-11-09 | Excel/CSV enjeksiyon temizliği | Ortak koda taşınır, 07 ve 14'e de uygulanır | Bölüm 12 ek iş ✅ |
| 2026-11-09 | İçe aktarılan kayıtlar | Yeni kayıt grafiğinden **çıkarılır** | Bölüm 12 ek iş ✅ |
| 2026-11-09 | Önceki aya göre değişim | Şimdilik "+N bu ay" (değişiklik yok) | — |
| 2026-11-09 | Sekreterin finans yetkisi | Panel yönetime kalır; varsayılan yetki dokümanla uyumlu (değişiklik yok) | Bölüm 14 ✅ |
| 2026-11-09 | Ödenmiş aya sonradan gelen düzeltme | Ödenen tutar **dondurulur**, fark sonraki aya taşınır | Bölüm 13 ek iş ✅ |
| 2026-11-09 | Fazla avans | Sonraki aya **otomatik devreder** | Bölüm 13 ek iş ✅ |
| 2026-11-09 | Ödeme gideri iptali | Hak ediş **"onaylandı"ya döner** | Bölüm 13 ek iş ✅ |
| 2026-11-09 | Sabit maaşlı öğretmene etüt ücreti | Ek iş sayılır, eklenir (değişiklik yok) | — |
| 2026-11-09 | Ay ortası başlayan sabit maaşlı | Oranlama yok, **yönetici elle düzeltir** | Bölüm 13 ek iş ✅ |
| 2026-11-09 | Öğretmenin hak ediş görünümü | Salt okunur **"Hak edişim"** | Bölüm 13 ek iş ✅ |
| 2026-11-09 | Yedek öğretmen | **Oturum bazlı** atama | Bölüm 13 ek iş ✅ |
| 2026-11-09 | Saklama süresi dolunca anonimleştirme | **Haftalık otomatik açık** (kullanıcı talebiyle ilk yıl beklenmeden); borcu olan öğrenci otomatik işlenmez, yöneticiye kalır | Bölüm 14 ek iş ✅ |
| 2026-11-09 | Borcu olan öğrencinin anonimleştirilmesi | **Uyarı** çıkar, karar yöneticide; hukuk danışmanına sorulacak | Bölüm 14 ek iş ✅ |
| 2026-11-09 | Finans kayıtları saklama süresi | Mali müşavir onayıyla **10 yıl** | Bölüm 14 ek iş ✅ |
| 2026-11-09 | Şube müdürüne içe aktarma | **Açılmaz** (değişiklik yok) | — |
| 2026-11-09 | Yedek dosyası şifreleme | Canlıya geçerken **şifrelenir** | Canlıya alma |
| 2026-11-09 | Yazı tipi (Google Fonts) | Uygulamanın **içine alınır** | Bölüm 14 ek iş ✅ |
| 2026-11-09 | `DEMO` varsayılanı | Yeni davranış korunur (değişiklik yok) | — |

## Kontrol komutları (`app/` içinde)
- `npm run check` — hepsini sırayla çalıştırır
- `npm run typecheck`, `npm test`, `npm run build`, `npm run smoke`
