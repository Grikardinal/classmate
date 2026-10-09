# 12 · Yönetim Paneli (Dashboard) ve Raporlar

**Sürüm:** MVP · **Kurspro karşılığı:** Yönetici Paneli, Raporlar, İstatistikler

## Amaç
Yöneticinin sabah paneli açtığında kurumun durumunu 10 saniyede görmesi ve yapılacakları bilmesi.

## Dashboard
Üst bardaki şube seçiciye göre çalışır: **"Tüm şubeler"** (konsolide) veya tek şube.
Şube müdürü yalnızca kendi şubesini görür.

**KPI kartları** (Kurspro'daki yapıdan uyarlandı):
| Kart | Açıklama |
|---|---|
| Aktif öğrenci | Bu sezon aktif kayıt sayısı (önceki aya göre değişim) |
| Bu ay tahsilat | Tahsil edilen / beklenen (₺ ve %) |
| Vadesi geçen | Toplam tutar ve veli sayısı |
| Devamsızlık | Bu hafta devamsızlık oranı |
| Doluluk | Toplam kapasite / kayıtlı öğrenci |

> "Bu ay tahsilat" ve "Vadesi geçen" kartları, finans grafikleri ve finans raporları **yalnızca Finans modülü açıksa** görünür.
> Bizim kurumda bunların yerine şu kartlar gösterilir: **Bu hafta işlenen ders** (planlanan/işlenen),
> **Yoklaması alınmayan ders**, **Bekleyen ön kayıt**.

**Bugün yapılacaklar:**
- Aranacak adaylar (03)
- Vadesi gelen / geciken ödemeler (05)
- Yoklaması alınmamış dersler (07)
- Bugünkü etüt randevuları (09)

**Grafikler:**
- Aylık yeni kayıt (çubuk)
- Aylık beklenen vs. tahsil edilen
- Seviye bazında öğrenci dağılımı (3–8)
- **Şube karşılaştırma** (yalnızca "Tüm şubeler" görünümünde): öğrenci sayısı, doluluk, tahsilat oranı, devamsızlık

**Son işlemler:** kayıtlar, tahsilatlar, iptaller (zaman sırası)

## Raporlar (filtrele + Excel/PDF indir)
Tüm raporlarda şube filtresi ve "şubeye göre grupla" seçeneği bulunur.
| Rapor | Bölüm |
|---|---|
| Öğrenci listesi (seviye/grup/durum) | 04 |
| Grup doluluk raporu | 01 |
| Ödeme planları ve borç durumu | 05 |
| Vadesi geçenler | 05 |
| Kasa / gelir-gider (tarih aralığı) | 05 |
| Devamsızlık raporu | 07 |
| Öğretmen ders kayıtları | 06–07 |
| Ön kayıt dönüşüm raporu | 03 |
| Ödev teslim oranları (v2) | 08 |
| Gönderilen mesajlar ve maliyet | 10 |

## İş kuralları
- Finans kartları ve raporları yalnızca genel yönetici (tüm şubeler) ve şube müdürü (kendi şubesi) görür.
- Öğretmen kendi paneline düşer: bugünkü dersler, alınmamış yoklamalar, ödev kontrolleri.
