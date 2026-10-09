# Kurspro Analizi

Kaynaklar: kurspro.net ana sayfa, kurspro.net/videolar, wiki.kurspro.net (bilgi tabanı),
resmi mobil uygulama ekran görüntüleri (kurspro.net/img/app/01-06.png). Demo hesabı açılmadı;
analiz herkese açık içeriğe dayanıyor.

## Roller ve girişler
- Kurumsal giriş (yönetici/personel) — `/i`
- Öğretmen, Öğrenci, Veli girişi — `/o`
- Mobil giriş alanları: **Kurum Kodu** + **TCKN veya Sözleşme No** + **Parola**, dil seçimi.

## Veri hiyerarşisi (ilk kurulum sırası)
```
Kurum
 └─ Şube
     └─ Sezon (örn. 2025-2026)
         └─ Branş (TM, MF, EA ...)
             └─ Sınıf / Grup
                 └─ Öğrenci
Personel → ayrı menü (Personel Listesi)
```
Ek tanımlar: banka hesabı, sanal POS, derslik.

## Yönetici paneli
**Dashboard (tanıtım görselinden):**
- KPI kartları: Aktif Öğrenci, Aylık Ciro, Tahsilat %, Devamsızlık %
- Aylık Kayıt Grafiği (çubuk), Son İşlemler listesi
- Alt kartlar: Randevular, Kasa Durumu vb.
- Sol tarafta ikonlu dar menü, koyu tema

**Ana menü (wiki'den):**
| Menü | İşlev |
|---|---|
| Kurum ve Şubeler | Kurum, şube, sezon, branş, sınıf tanımları |
| Ön Kayıtlar | Aday öğrenci (lead) yönetimi |
| Öğrenciler | Kayıt, güncelleme, sözleşme |
| Ders Programı | Ders saatleri, sınıf/öğretmen programı, çıktı |
| Sınıf Yoklamaları | Yoklama alma ve raporlama |
| Kullanıcılar | Kullanıcı hesapları, yetki grupları |
| Raporlar | Devamsızlık, öğretmen ders kayıtları, ödeme planları |
| Personel | Personel, avans, maaş, prim |
| Etüt | Bireysel, sınıf, karma, online etüt |
| Muhasebe | Gelir/gider, kasa hareketleri |
| İstatistikler | Doluluk oranları, taksit alacakları, sezon cirosu |
| Tanımlamalar | Banka, sanal POS, derslik |
| Ölçme ve Değerlendirme | TYT/AYT/LGS analizi, karne, zayıf konu, sıralama |
| Ödev Takibi | Bireysel/sınıf/şube ödevi, puanlama |
| Anket | Memnuniyet anketi, davet mesajı, anlık sonuç |
| Bulut | Kurum içi doküman paylaşımı, erişim yetkisi |
| Uzaktan Eğitim | Video albümleri (YouTube/Vimeo embed), PDF/Word/Excel |
| Uzaktan Sınav | Online sınav |
| SMS | Toplu/bireysel SMS, otomatik hatırlatma |

**Eğitim videoları:** İlk Kurulum, Yeni Sözleşme Oluşturma, Tahsilat, Temel Muhasebe, Hızlı Erişim
(YouTube: @kurs-pro).

## Öğrenci / veli mobil uygulaması
| Ekran | İçerik |
|---|---|
| Giriş | Kurum kodu + TCKN/sözleşme no + parola |
| Ana sayfa | "Haftanın Yıldızları" — TYT/LGS sekmeli ilk 3 öğrenci (puan, net, şube, sınıf) |
| Yan menü | Ana Sayfa, Ödevlerim, Çalışma Programlarım, Sınav Sonuçlarım, Sözlü Notlarım, Etüt Randevusu Al, Etüt Randevularım, Uzaktan Sınavlar, Öğretmenlerim, Özel Ders Kayıtlarım, Sınıf Yoklamaları ve Konular, Özel/Sınıf Ders Programım |
| Sohbet | Sınıf sohbet odaları + öğretmen/öğrenci ile özel sohbet; fotoğraf, video, kamera, ses, belge |
| Haber akışı | Blog/duyuru kartları |
| Alt menü | Ajandam · Soru Gönder · Ödevlerim · Sınavlarım |

## Yapay zekâ özellikleri
- Sesli AI arama asistanı (satış/ön kayıt takibi, görüşme skoru)
- Performans analizi → zayıf konulara göre haftalık çalışma programı
- Anlık soru çözümü (öğrenci fotoğraf gönderir, adım adım çözüm)
- Zayıf konulardan mini test üretimi

## Ticari model
- 7 gün ücretsiz deneme, farklı lisans paketleri (kurspro.net/ucretler)
- Ödeme entegrasyonları: iyzico, PayTR · Muhasebe: Paraşüt
