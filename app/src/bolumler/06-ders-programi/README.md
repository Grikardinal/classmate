# Bölüm 06 · Ders programı

Gereksinim: `docs/bolumler/06-ders-programi.md`. Plan ve kullanıcı kararları: `docs/PROFESYONELLESME.md`.

## Amaç
Hangi grubun hangi gün ve saatte, hangi dersi, hangi öğretmenle ve hangi derslikte işlediğini planlamak; öğretmene ve veliye
doğru programı göstermek. Haftalık şablondan her gün için ders oturumları üretilir (`oturumlar`, `data/model.ts`); yoklama bu oturumlara bağlanır.

## Dosyalar
| Dosya | İçerik |
|---|---|
| `index.tsx` | Sekmeli sayfa (default export `DersProgrami`; `main.tsx` tembel yükler, başka bölüm bu dosyadan içe aktarmıyor) |
| `HaftalikProgram.tsx` | Görünüm seçimi (grup / öğretmen / derslik), hafta gezintisi, yazdırma |
| `ProgramGrid.tsx` | Haftalık grid ve sürükle-bırak |
| `DersDialog.tsx` | Ders ekleme, düzenleme, kaldırma penceresi |
| `OgretmenAjandasi.tsx` | Öğretmenin tüm şubelerdeki haftası |
| `TatilIptal.tsx` | Tatil günleri, tek seferlik iptal ve telafi |
| `ortak.ts` | Tarih biçimi, görünüm tipi, veli bildirimi |
| `kurallar.ts` | **Saf iş kuralları** (ekran + sunucu ortak, yalnızca göreli içe aktarma) |
| `kurallar.test.ts`, `sunucu.test.ts` | Birim testleri ve `yazmaDenetle → programDenetle` testleri |

Sunucu denetimi: `app/server/politika.ts · programDenetle`. Pasif derslik / ders saati kuralı Bölüm 01'dedir (`programAtamaEngeli`).

## İş kuralları
**Çakışma**
- Aynı öğretmen, derslik veya grup aynı saatte iki yerde olamaz. Yürürlük tarihleri kesişen ve aynı güne denk gelen satırlar karşılaştırılır; ileride başlayan satırlar da sayılır.
- Sunucu tüm şubelerde arar: şube müdürü başka şubedeki dersi göremez, sunucu mesajı da o dersin ayrıntısını vermez.
- Şubeler arası geçiş süresi yetersizse uyarı çıkar, onayla geçilir. Onay yalnızca ekrandadır. Sürükle-bırakta uyarı çıkarsa taşıma pencerede onaylanır.

**Atama**
- Öğretmen: öğretmen görevinde, aktif, grubun şubesinde görevli ve o dersi verebilen olmalı.
- Derslik ve ders saati grubun şubesine ait olmalı; saatin gün tipi (hafta içi / sonu) güne uymalı; ders aktif, şube aktif olmalı.
- Başlangıç grubun sezonu içinde, bitiş sezonu aşmamalı ve başlangıçtan önce olmamalı.
- Var olan satırda yalnızca değişen alan denetlenir; eski atama kaydı kilitlemez. Bölünen satırın yeni parçası yeni atama sayılır.

**Geçmişin korunması**
- Değişiklik belirtilen tarihten itibaren geçerlidir. Başlamış satır kapatılır, yeni satır açılır; yeni satır eski bitişi korur. Başlamamış satır yerinde değişir veya silinir.
- Yoklama ve iptal oturuma satır kimliğiyle bağlıdır. Bu yüzden değişiklik, satırın yoklaması veya iptali olan son oturumundan sonra başlar (`enErkenGecerlilik`). Sürükle-bırak bu tarihi kendiliğinden kullanır; gösterilen haftaya bakmaz.
- Sunucu: başlamış satır yalnızca kapatılabilir (en erken dün), yoklamalı oturumdan önce kapatılamaz, silinemez. Geçmişten başlayan yeni satır yazılamaz.

**Tatil, iptal, telafi**
- Tatil: ad ve geçerli tarih zorunlu; geçmiş tarihe eklenemez, geçmiş tatil kaldırılamaz; aynı tarih + kapsam yinelenemez; yoklaması alınmış güne eklenemez. Kurum geneli tatili yalnızca genel yönetici yazar.
- İptal: gerçek bir oturum olmalı; geçmiş, tatil veya yoklamalı ders iptal edilemez; neden zorunlu; telafi dersten önce veya tatil gününe olamaz; sonradan değiştirilemez. İptal tarihi sunucudan yazılır.

**Yetki ve görünürlük**
- Düzenleme 06 yetkisiyle yönetim içindir. Öğretmen 06'yı görür ama program, tatil, iptal yazamaz (sunucuda da).
- Öğretmen yalnızca kendi ajandasını görür; okuma filtresi `okumaSuz` kendi gruplarının satırlarını gönderir.
- Program değişikliği ve kaldırma grubun birincil velilerine bildirilir, geçerlilik tarihi mesajdadır; pencerede kapatılabilir, sürükle-bırakta her zaman gider. İptalde tüm veliler bildirilir. Bildirimi ekran üretir.

## Testler
`npx vitest run src/bolumler/06-ders-programi`. Tarih ve örtüşme, çakışma, öğretmen uygunluğu, satır alanları, geçmişin korunması, ortak denetim, tatil, iptal; sunucuda yetki, şube kapsamı, kapsam dışı çakışma, bölme, yoklamalı satır.

## Bilinen sınırlar
- Şubeler arası geçiş onayı sunucuda denetlenmez (uyarıdır).
- Bitişi olmayan satır, sezon bitse de oturum üretir (`oturumlar` sezonu bilmez).
- Şube müdürü öğretmen görünümünde yalnızca kendi şubesindeki dersleri görür; doküman "tüm şubeler" der, tam görünüm yalnızca kapsamı yeten kullanıcıdadır.
- İleride iptal edilmiş dersi olan satırın değişikliği o iptalden sonraya kalır; iptali geri alma ekranı yoktur.
- Öğretmene ertesi gün bildirimi (opsiyonel) bu bölümde yoktur.

## Açık sorular
1. Grubu başka öğretmene geçen öğretmen, kapanmış satır yüzünden grubu ve öğrencileri görmeye devam ediyor (`ogretmenGruplari`, istemcide `AppContext`). Geçmiş ders kayıtlarını görebilmesi mi, kişisel veriyi görmemesi mi öncelikli?
2. Bu şubede dersi verebilen öğretmen yoksa önceki ekran tüm öğretmenleri listeliyordu; artık atama engelleniyor. Branş dışı (yedek) öğretmen ataması istenir mi?
3. İptal geri alınabilmeli mi? Alınabilirse ileri tarihli iptal değişikliği de öne çekilebilir.
4. Şube müdürü öğretmenin diğer şubelerdeki derslerini (en azından dolu / boş olarak) görmeli mi?
5. Sezon bittiğinde açık satırlar kendiliğinden kapansın mı?
