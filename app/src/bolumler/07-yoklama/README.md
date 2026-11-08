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

**Devamsızlık oranı** (`devamsizlikOzeti`): yalnızca yoklaması olan oturumlar sayılır; dondurma döneminde yoklama satırı olmadığı için payda büyümez. İzinli payda içindedir, ayrı gösterilir (Açık sorular 1). "Sezon başından" raporu aktif sezonun başlangıcını kullanır.

**Bildirim**
- Yalnızca yeni `gelmedi` olana ve yalnızca dersin gününde gider. Şablon "bugün" dediği için geçmişe dönük kayıtta gitmez; ekran bunu söyler.
- Aynı gün aynı veliye aynı öğrenci için aynı metin kuyruğa ikinci kez girmez (sunucu; gelmedi → geldi → gelmedi, iki cihaz).
- `izinSms` kapalı veliye SMS gitmez, kanal push'a döner, maliyet 0 olur (sunucu, yalnızca bu olay için).
- Haftalık eşik aşılınca işlem kaydına uyarı düşer.

**Veli izni** (`izinEngeli`)
- Veli yalnızca kendi çocuğu için, bugünden 60 gün sonrasına kadar, gerçek bir tarihe yazar. Aktif kayıt gerekir, aynı tarihe ikinci izin yazılmaz. Personel API'den izin yazamaz.
- İzin, yoklama ekranında varsayılanı `izinli` yapar; öğretmen değiştirebilir.

**Görünürlük:** Şube kapsamı `yazmaDenetle` / `okumaSuz` içindedir. Öğretmene yalnızca kendi gruplarının yoklaması ve velilerin izinleri gider.

## Testler
`npx vitest run src/bolumler/07-yoklama`. Oturum gerçekliği, tarihe göre grup, kim-ne zaman, durum ve öğrenci doğrulaması, bildirim tekrarı, izin, rapor; sunucuda yetki, şube, devreden öğretmen, alan temizliği, satır birleştirme, SMS izni, izin görünürlüğü. Tarihler sabittir, gerçek saate bağlı değildir.

## Bilinen sınırlar
- Kayıtta dondurma / iptal tarihi yok; kaydı bugün dondurulmuş öğrenci, daha önceki bir derse **ilk kez** girilen geç yoklamada listelenmez. Var olan yoklamada satırı korunur.
- "Dersin başlamasından 15 dk sonra öğretmene hatırlatma" otomasyonu yok: personele bildirim kanalı bulunmuyor. "Öğretmenlere hatırlat" düğmesi yalnızca işlem kaydı yazar; ekran metni buna göre düzeltildi.
- Bildirim ve haftalık eşik uyarısını ekran üretir; öğretmen yalnızca kendi gruplarının yoklamasını gördüğü için, eşik sayımı o gruplarla sınırlıdır.
- `izinSms` denetimi yalnızca devamsızlık olayı için yapıldı; diğer olaylar Bölüm 10'da ele alınmalı.
- Sonradan bildirilen izin, alınmış yoklamayı kendiliğinden değiştirmez. Dersi olmayan güne de izin yazılabilir.

## Açık sorular
1. **Oranın paydası:** İzinli ders paydada mı kalsın (bugün: `gelmedi / toplam`, `lib/kurallar.test.ts` böyle sabitliyor), yoksa çıkarılsın mı (`gelmedi / (toplam − izinli)`)? Bölüm 04 ve 12 de bu hesabı kullanıyor.
2. **Yok → var düzeltmesi:** Veliye gitmiş devamsızlık mesajı için düzeltme mesajı gönderilsin mi? Bugün gönderilmiyor; kuyrukta bekleyen (sessiz saat) SMS de iptal edilmiyor.
3. **Geçmişe dönük devamsızlık:** Geç girilen `gelmedi` için veliye tarihli ayrı bir mesaj gitsin mi? Bugün gitmiyor.
4. **Sekreter:** Yoklama alabilsin mi? Bugün aynı gün ve 7 günlük geç giriş açık, geçmiş düzeltme kapalı.
5. **7 günlük sınır** öğretmen için uygun mu? Doküman yalnızca düzeltmeyi tanımlıyor; sınır ekrandaki uyarıdan alındı.
6. **Dersi olmayan güne veli izni** reddedilsin mi?
