# 03 · Ön Kayıt (Aday Öğrenci) Yönetimi

**Sürüm:** MVP · **Kurspro karşılığı:** Ön Kayıtlar

## Amaç
Kuruma bilgi almak için arayan, gelen veya formu dolduran velileri kaybetmemek; kesin kayda dönüşümü takip etmek.

## Akış
```
Yeni aday → Görüşüldü → Deneme dersine geldi → Kesin kayıt
                     ↘ Düşünüyor (hatırlatma) ↘ Vazgeçti (neden)
```

## Ekranlar
- **Aday listesi:** durum, seviye, kaynak, son görüşme, sonraki aksiyon tarihi; filtre ve arama
- **Aday kartı:** veli ve öğrenci bilgisi, görüşme notları zaman çizelgesi, verilen fiyat teklifi (*Finans açıksa*)
- **Hızlı ekle:** telefonla arayan veli için 20 saniyelik form
- **Web formu (opsiyonel):** kurumun sitesine/Instagram'ına konacak ön kayıt linki
- **"Kesin kayda çevir"** butonu → bilgiler öğrenci kaydı ekranına taşınır (bkz. 04)

## Veri alanları
| Alan | Not |
|---|---|
| veli_ad, veli_telefon | zorunlu |
| öğrenci_ad, seviye (3–8), okulu | |
| ilgilendiği_şube | adayı karşılayan/takip eden şube; şubeler arası devredilebilir |
| sorumlu_personel | takipten sorumlu kişi |
| kaynak | tavsiye, Instagram, Google, tabela, eski öğrenci… |
| durum | yeni / görüşüldü / deneme dersi / düşünüyor / kayıt oldu / vazgeçti |
| sonraki_aksiyon_tarihi | hatırlatma için |
| notlar | zaman damgalı görüşme notları |
| vazgeçme_nedeni | fiyat, saat uymadı, başka kurum… |

## Otomasyonlar
- Sonraki aksiyon tarihi gelen adaylar yöneticinin panelinde "Bugün aranacaklar" listesine düşer.
- Ön kayıt formu dolduran veliye otomatik "Teşekkürler, sizi arayacağız" mesajı.
- Deneme dersi tarihi öncesi veliye hatırlatma mesajı.

## Raporlar
- Kaynağa ve **şubeye** göre aday sayısı ve kayda dönüşüm oranı
- Vazgeçme nedenleri dağılımı

## KVKK notu
Aday velinin iletişim izni (açık rıza) kaydedilir; vazgeçen adayların verileri belirlenen süre sonunda silinir/anonimleştirilir.
