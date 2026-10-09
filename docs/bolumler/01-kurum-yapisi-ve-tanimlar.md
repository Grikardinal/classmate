# 01 · Kurum Yapısı ve Tanımlar

**Sürüm:** MVP · **Kurspro karşılığı:** Kurum ve Şubeler, Tanımlamalar

## Amaç
Sistemin geri kalanının dayandığı temel yapıyı kurmak: dönem, sınıf seviyesi, gruplar, dersler ve derslikler.
Diğer tüm bölümler (kayıt, ödeme, yoklama, ders programı) bu tanımları kullanır.

## Hiyerarşi
Kurumun **birden fazla şubesi** var (karar: 2026-10-09).
Kurspro'daki `Şube → Sezon → Branş → Sınıf` yapısı 3–8. sınıflara göre sadeleştirildi
(TM/MF/EA gibi alan branşları bu yaş grubunda yok):

```
Kurum
 ├─ Sezon (kurum geneli: 2026-2027, "Yaz Okulu 2027")   ← tüm şubeler aynı takvimi kullanır
 └─ Şube (Merkez, Şube 2, …)
     ├─ Derslikler, ders saatleri, kasalar
     └─ Grup (sezon + seviye 3–8; örn. "Merkez 5-A")
         └─ Öğrenci (kayıt üzerinden)
```

**Neden sezon kurum genelinde?** Kurspro'da her şube kendi sezonunu açıyor; bizde tüm şubeler
aynı eğitim yılını izlediği için sezon tek yerde tanımlanır, şubeler arası raporlar kolaylaşır.

## Kurum geneli vs. şubeye özel
| Kurum geneli (tek tanım) | Şubeye özel |
|---|---|
| Sezonlar | Gruplar |
| Dersler | Derslikler |
| İndirim türleri | Ders saatleri (şubelerin çalışma saatleri farklı olabilir) |
| Sözleşme şablonu, logo | Kasalar, banka hesabı / POS |
| Fiyat listesi (varsayılan) | Fiyat (şube bazında farklılaşabilir) |
| Bildirim şablonları | Adres, telefon (makbuzda ve mesajlarda şube bilgisi) |

## Ekranlar
- **Kurum bilgileri:** ad, logo, vergi bilgileri, sözleşme/makbuz başlığı
- **Şubeler:** ad, kısa kod, adres, telefon, şube müdürü, aktif/pasif
- **Sezonlar:** liste + ekle/düzenle, "aktif sezon" seçimi
- **Gruplar:** şube, seviye, ad, kapasite, varsayılan derslik, rehber öğretmen
- **Üst bar şube seçici:** "Tüm şubeler" veya tek şube; tüm listeler ve raporlar buna göre filtrelenir
- **Dersler:** Türkçe, Matematik, Fen Bilimleri, Sosyal Bilgiler, İngilizce, Din Kültürü… (düzenlenebilir)
- **Derslikler:** ad, kapasite
- **Ders saatleri:** hafta içi / hafta sonu saat dilimleri (Ders Programı bölümü kullanır)
- **Tanımlamalar:** banka hesapları, ödeme yöntemleri, indirim türleri, fiyat listesi — *yalnızca Finans modülü açıksa*

## Modül yönetimi (aç/kapat)
Bazı modüller kuruma göre gerekli olmayabilir. Genel yönetici **Ayarlar → Modüller** ekranından açıp kapatır.
Kapalı modülün menüleri, ekranları, bildirimleri, portal sekmeleri ve dashboard kartları **görünmez**;
veritabanı yapısı yerinde durur, açıldığında kaldığı yerden çalışır.

| Modül | Varsayılan (bizim kurum) | Not |
|---|---|---|
| **Finans** (ücret, taksit, tahsilat, kasa) | **Kapalı** | Kurum ücret almıyor; ücret alan kurumlar için hazır (karar: 2026-10-09) |
| Personel hak ediş | Kapalı | Finans'tan bağımsız açılabilir |
| Ön kayıt | Açık | |
| Ödev (v2) | Açık | |
| Etüt / birebir ders (v2) | Açık | Ücretli özel ders paketi yalnızca Finans açıksa |
| Mesajlaşma, anket (v2) | Kapalı | İhtiyaç olunca |

Kapatma kuralları: içinde veri olan bir modül kapatılırsa veri silinmez; yalnızca gizlenir.

## Veri alanları
| Varlık | Alanlar |
|---|---|
| Kurum | ad, logo, e-posta, vergi_no |
| Şube | kurum_id, ad, kod, adres, telefon, müdür_id, aktif_mi |
| Sezon | ad, başlangıç, bitiş, aktif_mi |
| Grup | şube_id, sezon_id, seviye (3–8), ad, kapasite, derslik_id, rehber_ogretmen_id |
| Ders | ad, kısa_ad, renk, aktif_mi |
| Derslik | şube_id, ad, kapasite |
| DersSaati | şube_id, gün_tipi, sıra, başlangıç, bitiş |
| FiyatListesi | sezon_id, seviye, şube_id (boşsa tüm şubeler), tutar |

## İş kuralları
- Aynı anda yalnızca bir **aktif sezon** olur; ekranlar varsayılan olarak aktif sezonu gösterir.
- Grup kapasitesi dolunca kayıtta uyarı verilir (engellenmez, yönetici onaylar).
- Yeni sezona geçişte "önceki sezonun gruplarını kopyala + seviyeyi bir artır" sihirbazı (öğrenciler 5'ten 6'ya geçer).
- İçinde kayıt olan sezon/grup/şube silinemez, yalnızca pasife alınır.
- Grup adı şube içinde benzersizdir; ekranlarda şube kodu ile gösterilir ("MRK 5-A").
- Yeni şube açma sihirbazı: derslikler, ders saatleri ve kasalar başka bir şubeden kopyalanabilir.

## Açık sorular
- Kaç şube var? Fiyatlar şubeler arasında farklı mı?
- Şubelerin ayrı vergi numarası / ayrı şirketi var mı? (Makbuz ve fatura başlığını etkiler.)
- Yaz okulu / ara tatil kampları ayrı sezon mu olacak?
