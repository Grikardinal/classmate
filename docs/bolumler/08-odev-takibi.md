# 08 · Ödev Takibi

**Sürüm:** v2 (MVP'den hemen sonra) · **Kurspro karşılığı:** Ödev Takibi, "Ödevlerim"

## Amaç
Öğretmenin verdiği ödevleri velinin görmesi ve teslim durumunun takip edilmesi.
3–8. sınıflarda ödevin evde yapılmasını veli takip ettiği için veli tarafı kritik.

## Akış
1. Öğretmen ödev oluşturur: grup veya seçili öğrenciler, ders, açıklama, kaynak (kitap sayfa aralığı), ek dosya/fotoğraf, teslim tarihi
2. Veli ve öğrenci bildirim alır, portalda görür
3. Teslim: öğretmen derste kontrol edip işaretler (`yaptı` / `eksik` / `yapmadı`) — **opsiyonel:** öğrenci/veli fotoğraf yükler
4. Öğretmen kısa geri bildirim yazabilir

## Ekranlar
- Öğretmen: ödev listesi, yeni ödev, teslim kontrol ekranı (yoklama ekranı gibi hızlı)
- Veli/öğrenci: aktif ödevler, geçmiş ödevler, durumlar
- Yönetici: öğretmen bazında verilen ödev sayısı, teslim oranları

## Veri alanları
| Varlık | Alanlar |
|---|---|
| Ödev | öğretmen_id, ders_id, hedef (grup/öğrenci), başlık, açıklama, kaynak, ekler, veriliş, teslim_tarihi |
| ÖdevTeslim | ödev_id, öğrenci_id, durum, yüklenen_dosya, öğretmen_notu |

## Otomasyonlar
- Yeni ödevde veliye bildirim
- Teslimden 1 gün önce hatırlatma
- `yapmadı` işaretlenince veliye bilgi

## Kapsam dışı
- Puanlama/not sistemi ve sınav analizi **bu projede yok** (karar: 2026-10-09).
