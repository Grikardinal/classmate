# 11 · Veli ve Öğrenci Portalı

**Sürüm:** MVP (web, mobil uyumlu) · v3 (yerel mobil uygulama) · **Kurspro karşılığı:** Kurspro Öğrenci & Veli uygulaması

## Amaç
Velinin telefonundan, uygulama indirmeden, çocuğuyla ilgili her şeyi görebilmesi.
MVP'de **PWA** (ana ekrana eklenebilen web uygulaması) olarak yapılır; mağaza uygulaması sonraya kalır.

## Ana sayfa (veli)
- Çocuk seçici (birden fazla çocuk varsa; kardeşler farklı şubelerde olabilir)
- Çocuğun şubesi: ad, adres (harita linki), telefon
- Bugünün dersleri ve saatleri
- Son yoklama durumu
- Bekleyen ödevler
- Yaklaşan ödeme ve toplam borç (*Finans açıksa*)
- **"Bildirimleri aç" çağrısı:** push izni verilmemişse en üstte gösterilir (SMS maliyetini düşürür, bkz. 10)
- Son duyurular

## Menü
(Kurspro'nun mobil menüsünden uyarlandı, sınav bölümleri çıkarıldı)
- Ana Sayfa
- Ders Programı
- Yoklama ve İşlenen Konular
- Ödevler
- Etüt Randevuları (v2)
- Ödemeler (taksitler, makbuzlar; v2'de online ödeme) — *yalnızca Finans açıksa*
- Duyurular
- Mesajlar (v2)
- Öğretmenler
- Profil ve iletişim izinleri

**Alt menü (mobil):** Ana Sayfa · Program · Yoklama · Ödevler · Duyurular
(Finans açıksa "Yoklama" yerine "Ödemeler" seçilebilir)

## Veli aksiyonları
- "Yarın gelemeyecek" izin bildirimi
- Etüt randevusu alma (v2)
- Online ödeme (v2)
- İletişim bilgisi güncelleme talebi

## Öğrenci görünümü
Veli görünümünün sadeleştirilmiş hali: program, ödevler, duyurular. **Ödemeler gizli.**

## Kurspro'dan bilinçli olarak alınmayanlar
- "Haftanın Yıldızları" puan sıralaması → sınav analizi olmadığı için yok; ileride ödev/devam bazlı "rozetler" düşünülebilir
- Sınav Sonuçları, Uzaktan Sınavlar, Sözlü Notları

## Tasarım ilkeleri
- Önce telefon; büyük dokunma alanları, sade dil
- Giriş: telefon + SMS kodu, "beni hatırla"
- Açık/koyu tema
