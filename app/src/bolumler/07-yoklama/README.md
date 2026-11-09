# Bölüm 07 · Yoklama ve devamsızlık

Gereksinim: `docs/bolumler/07-yoklama.md`. Plan ve kullanıcı kararları: `docs/PROFESYONELLESME.md`.

## Amaç
Öğretmenin derste hızlıca yoklama alması, gelmeyen öğrencinin velisinin aynı gün haberdar olması, yönetimin alınmamış yoklamaları ve devamsızlık oranlarını izlemesi.

## Dosyalar
| Dosya | İçerik |
|---|---|
| `index.tsx` | Sekmeli sayfa (default export `Yoklama`; `main.tsx` tembel yükler, başka bölüm bu dosyadan içe aktarmıyor) |
| `GunlukDersler.tsx` | Günün dersleri, alınmamış yoklama uyarıları |
| `YoklamaEkrani.tsx` | Telefonda hızlı yoklama, kaydetme ve bildirim |
| `DevamsizlikRaporu.tsx` | Dönem / grup bazında devamsızlık, CSV |
| `DersKayitlari.tsx` | Öğretmen ders kayıtları, CSV |
| `ortak.ts` | Durum düğmeleri, tarih biçimi |
| `kurallar.ts` | **Saf iş kuralları** (ekran + sunucu ortak, yalnızca göreli içe aktarma) |
| `kurallar.test.ts`, `sunucu.test.ts` | Birim testleri ve `yazmaDenetle → yoklamaDenetle` testleri |

Sunucu denetimi: `app/server/politika.ts · yoklamaDenetle`; veli izni: `app/server/uygulama.ts · /api/veli/izin`. `devamsizlikOzeti`, `sonrakiDurum`, `yoklamaGecikti` başka bölümler de kullandığı için `lib/kurallar.ts`'te kalır.

## İş kuralları
**Kim, ne zaman** (`yoklamaZamanEngeli`, ekran ve sunucu aynı mesaj)
- Gelecek tarihli veya henüz başlamamış derse yoklama alınamaz; yönetici dahil.
- Aynı gün: dersin öğretmeni alır ve düzeltir. Şube müdürü, genel yönetici, sekreter de yazabilir.
- Geçmiş günü düzeltme: yalnızca şube müdürü ve genel yönetici.
- Alınmamış yoklama: öğretmen ve sekreter 7 gün içinde geç girebilir (ekrandaki "son 7 gün" uyarısı); daha eskisini yönetici girer.
- Öğretmen yalnızca kendi dersini yazar. Rehber öğretmen grubu görür ama başka öğretmenin dersini alamaz. Grubu devreden öğretmen ne yazar ne görür (karar 2026-11-08).

**Oturumun gerçekliği** (`yoklamaOturumu`)
- Oturum kimliği `<satırId>_<tarih>`: satır var, haftanın günü tutuyor, satır o tarihte yürürlükte, tarih sezon içinde. Tarih, satır ve grup alanları kimlikle uyuşmalı (şube kapsamı grup alanından hesaplandığı için bu şart).
- Tatil veya iptal gününe ilk yoklama girilmez. Var olan kayıt düzeltilebilir (Bölüm 06 yoklamalı güne tatil / iptal eklemeyi zaten engeller).

**Öğrenciler ve durumlar**
- Yalnızca o tarihte grupta olan (`grupGecmisi`) ve kaydı aktif öğrenci yazılır. Kaydı olmayan, dondurulmuş, iptal, mezun, başka gruba geçmiş öğrenci reddedilir.
- Düzeltmede eski yoklamadaki öğrenciler kalır: sunucu eski ve yeni durumları birleştirir, ekran onları listeler; sonradan ayrılan öğrencinin geçmişi kaybolmaz.
- Durum: `geldi`, `gelmedi`, `gec`, `izinli`. Konu en fazla 200 karakter, kırpılarak saklanır.
- Öğretmen (hak ediş buna dayanır) ve kayıt zamanı sunucudan yazılır. Yoklama silinemez.

**Devamsızlık oranı** (`devamsizlikOzeti`): `gelmedi / (toplam − izinli)`; payda 0 ise oran 0. Yalnızca yoklaması olan oturumlar sayılır; dondurma döneminde yoklama satırı olmadığı için payda büyümez. İzinli sayısı ayrı gösterilir. Bölüm 04, 11, 12 aynı hesabı kullanır. "Sezon başından" raporu aktif sezonun başlangıcını kullanır.

**Bildirim**
- Yalnızca yeni `gelmedi` olana gider. Dersin gününde `devamsizlik` ("bugün"), 7 günlük geç giriş penceresinde `devamsizlikGecmis` ("… tarihli derse katılmadı"). Daha eski tarihte yönetici düzeltse de yeni devamsızlık mesajı gitmez (`devamsizlikOlayi`).
- Aynı veliye aynı öğrenci için aynı metin kuyruğa ikinci kez girmez (sunucu; "bugün" metni aynı gün için, tarihli metin her zaman).
- `gelmedi` kaldırılınca (geldi, geç, izinli) sunucu karar verir (`duzeltmePlani`): henüz ulaşmamış (`bekliyor`, `basarisiz`) bildirim kuyruktan silinir ve düzeltme mesajı gitmez; ulaşmışsa o veliye bir kez `devamsizlikDuzeltme` gider. Düzeltme mesajı tarih sınırına bağlı değildir. Silinen bildirimden sonra yeniden `gelmedi` işaretlenirse bildirim yine gider.
- Bildirim satırının oturumunu sunucu yazar (`oturumId`). Bu alandan önceki kayıtlar gün ve ders saatiyle eşleşir.
- `izinSms` kapalı veliye SMS gitmez, kanal push'a döner, maliyet 0 olur (sunucu, bu üç olay için).
- Yeni olaylar eski veriye açılışta varsayılanıyla eklenir (`veriyiOnar`).
- Haftalık eşik aşılınca işlem kaydına uyarı düşer.

**Veli izni** (`izinEngeli`)
- Veli yalnızca kendi çocuğu için, bugünden 60 gün sonrasına kadar, gerçek bir tarihe yazar. Aktif kayıt gerekir, o tarihte grupta yapılacak ders olmalıdır (tatil / iptal reddedilir), aynı tarihe ikinci izin yazılmaz. Personel API'den izin yazamaz.
- İzin, yoklama ekranında varsayılanı `izinli` yapar; öğretmen değiştirebilir.

**Görünürlük:** Şube kapsamı `yazmaDenetle` / `okumaSuz` içindedir. Öğretmene yalnızca kendi gruplarının yoklaması ve velilerin izinleri gider.

**Yedek öğretmen (karar 2026-11-09)**
- Yedek atanmış oturumun yoklamasını yalnızca yedek (ve yönetici) alır; asıl öğretmen alamaz. 7 gün kuralı aynıdır.
- `yoklamaDenetle` `ogretmenId` alanını yedekten yazar; hak ediş buna dayanır.
- Yedeğe öğrencinin yalnızca adı, veli bağı ve maskeli veli gider; doğum, okul, sağlık ve personel notu, izin notu gitmez.

## Testler
`npx vitest run src/bolumler/07-yoklama`. Oturum gerçekliği, tarihe göre grup, kim-ne zaman, durum ve öğrenci doğrulaması, bildirim tekrarı, izin, rapor; sunucuda yetki, şube, devreden öğretmen, alan temizliği, satır birleştirme, SMS izni, izin görünürlüğü. Tarihler sabittir, gerçek saate bağlı değildir.

## Bilinen sınırlar
- Kayıtta dondurma / iptal tarihi yok; kaydı bugün dondurulmuş öğrenci, daha önceki bir derse **ilk kez** girilen geç yoklamada listelenmez. Var olan yoklamada satırı korunur.
- "Dersin başlamasından 15 dk sonra öğretmene hatırlatma" otomasyonu yok: personele bildirim kanalı bulunmuyor. "Öğretmenlere hatırlat" düğmesi yalnızca işlem kaydı yazar; ekran metni buna göre düzeltildi.
- Bildirim ve haftalık eşik uyarısını ekran üretir; öğretmen yalnızca kendi gruplarının yoklamasını gördüğü için, eşik sayımı o gruplarla sınırlıdır.
- `izinSms` denetimi yalnızca devamsızlık olayı için yapıldı; diğer olaylar Bölüm 10'da ele alınmalı.
- Sonradan bildirilen izin, alınmış yoklamayı kendiliğinden değiştirmez.
- Yeni devamsızlık mesajını ekran üretir; pencere sınırını ekran uygular, sunucu tekilleştirir.
- gelmedi (gitti) → geldi (düzeltme gitti) → gelmedi akışında, aynı metin yinelenmediği için veli ikinci devamsızlığı almaz.

## Kapandı (2026-11-08)
1. **İzinli dersler:** orandan çıkarılır (pay ve payda).
2. **Yok → var düzeltmesi:** gitmemiş bildirim kuyruktan silinir; gitmişse veliye düzeltme mesajı gider.
3. **Geçmişe dönük devamsızlık:** tarihli ayrı mesaj gider; yalnızca 7 günlük geç giriş penceresinde.
4. **Sekreter:** aynı gün ve 7 güne kadar geç giriş; geçmiş düzeltme yok (değişiklik yok).
5. **Öğretmenin geç giriş sınırı:** 7 gün (değişiklik yok).
6. **Dersi olmayan güne veli izni:** reddedilir.
