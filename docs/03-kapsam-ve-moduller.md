# Kapsam ve Modüller

> Ayrıntılar her bölümün kendi dosyasında: [docs/bolumler/](bolumler/)

## Hedef
- **Kurum:** kendi kurumumuz (tek kurum, **çok şubeli**)
- **Öğrenci profili:** 3–8. sınıf
- **Ana kullanıcılar:** yönetici, öğretmen, **veli** (öğrenci hesabı opsiyonel)
- **Esin kaynağı:** Kurspro

## Kapsam dışı (bilinçli kararlar)
- Sınav analizi: TYT/AYT/LGS sonuç analizi, optik okuma, karne, puan sıralaması, "Haftanın Yıldızları"
- Uzaktan sınav, sözlü not sistemi
- Yapay zekâ sesli arama / soru çözümü (ileride yeniden değerlendirilebilir)
- Bordro, SGK, vergi hesapları
- Çok kurumlu SaaS yapısı

## MVP (1. sürüm)
| Bölüm | İçerik |
|---|---|
| 01 Kurum yapısı | Şube, sezon, seviye (3–8), grup, ders, derslik, ders saatleri, şube seçici |
| 02 Kullanıcılar | Genel yönetici, şube müdürü, sekreter, öğretmen, veli, öğrenci; şube kapsamlı yetki |
| 03 Ön kayıt | Aday takibi, hatırlatmalar, kesin kayda çevirme |
| 01 Modül yönetimi | Modül aç/kapat altyapısı (Finans, hak ediş vb.) |
| 04 Öğrenci ve kayıt | Kayıt sihirbazı, veli bağlantısı, kayıt formu PDF |
| 06 Ders programı | Haftalık grid, çakışma kontrolü, tatil/iptal |
| 07 Yoklama | Hızlı yoklama, işlenen konu, veliye anında bildirim |
| 10 İletişim | Push (ana kanal) + SMS (kritik/yedek), duyurular, bildirim merkezi |
| 11 Veli portalı | PWA: program, yoklama, ödevler, duyurular |
| 12 Dashboard | KPI kartları, bugün yapılacaklar, temel raporlar |
| 13 Personel | Personel kartı ve grup atamaları |
| 14 Altyapı | Güvenlik, yedekleme, KVKK, **Excel'den içe aktarma sihirbazı** |

## MVP sonrası — pasif modül
- 05 Finans: taksit planı, tahsilat, makbuz, kasa, gider (yapılır, **varsayılan kapalı**)

## v2
- 05 Online ödeme (sanal POS), e-arşiv fatura
- 08 Ödev takibi
- 09 Etüt ve birebir ders randevuları
- 10 WhatsApp, veli–öğretmen mesajlaşma, anket
- 13 Ders bazlı otomatik hak ediş

## v3
- Yerel mobil uygulamalar (iOS/Android)
- QR ile giriş-çıkış bildirimi
- Ödev/devam bazlı motivasyon rozetleri

## Veri modeli özeti
```
Kurum ─┬─ Sezon (kurum geneli)
       └─ Şube ─┬─ Derslik, DersSaati, Kasa
                └─ Grup(sezon, seviye 3–8) ─── Kayıt(şube) ─── Öğrenci ─── Veli (çoka-çok)
                     │                           └── Taksit ── Tahsilat ── KasaHareketi(şube)
                     └─ ProgramSatırı ── DersOturumu ── Yoklama
Ders (kurum geneli), Personel ↔ Şube (çoka-çok), Kullanıcı(rol + şube kapsamı)
OnKayit, Bildirim, Duyuru, İşlemKaydı
(v2) Ödev, ÖdevTeslim, Etüt, ÖzelDersPaketi, HakEdiş
```

## Açık kararlar
- ~~Tek şube mi, birden fazla şube mi?~~ → **Birden fazla şube** (2026-10-09)
- Kaç şube var; fiyatlar ve kasalar şubeye göre ayrı mı?
- Teknoloji yığını
- ~~WhatsApp MVP'de mi?~~ → Push + SMS MVP'de, WhatsApp v2 (2026-10-09)
- SMS sağlayıcısı (kurumun mevcut hesabı var mı?)
- ~~Mevcut veriler nerede?~~ → Excel (2026-10-09); örnek dosya ile sütun yapısı netleşecek
- ~~Ödeme yöntemleri~~ → Kurum ücret almıyor; Finans modülü pasif (2026-10-09)
