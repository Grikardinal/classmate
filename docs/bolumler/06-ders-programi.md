# 06 · Ders Programı

**Sürüm:** MVP · **Kurspro karşılığı:** Ders Programı

## Amaç
Hangi grubun hangi gün, hangi saatte, hangi dersi, hangi öğretmenle ve hangi derslikte işlediğini planlamak
ve herkese (öğretmen, veli) doğru programı göstermek.

## Ekranlar
- **Haftalık grid:** satırlar ders saatleri, sütunlar günler; hücreye sürükle-bırak ile ders + öğretmen + derslik atama
- Görünümler: grup bazında · öğretmen bazında · derslik bazında
- Görünümler şube seçiciye göre filtrelenir; öğretmen görünümü **tüm şubeleri** birlikte gösterir
- **Çakışma uyarıları:** aynı öğretmen / aynı derslik aynı saatte iki yerde olamaz
- **Şubeler arası geçiş uyarısı:** öğretmenin farklı şubelerdeki iki dersi arasında yeterli süre yoksa
  (ayarlanabilir, örn. 30 dk) uyarı
- Yazdırma/PDF: grup programı, öğretmen programı (Kurspro'daki çıktı özelliği)
- **Takvim istisnaları:** resmi tatil, ara tatil, tek seferlik ders iptali/telafi

## Veri alanları
| Varlık | Alanlar |
|---|---|
| ProgramSatırı | grup_id, gün, ders_saati_id, ders_id, öğretmen_id, derslik_id, geçerlilik_başlangıç/bitiş |
| DersOturumu | program_satırı_id, tarih, durum (planlı/işlendi/iptal/telafi), konu |
| TatilGünü | tarih, ad, şube_id (boşsa tüm şubeler) |

## İş kuralları
- Haftalık şablon → her gün için **ders oturumları** otomatik üretilir; yoklama ve öğretmen ders kayıtları bu oturumlara bağlanır.
- Program değişikliği geçmiş oturumları etkilemez, belirtilen tarihten itibaren geçerli olur.
- Okul saatleriyle uyum için hafta içi akşam ve hafta sonu saat dilimleri ayrı tanımlanabilir.
- Ders saatleri şubeye özeldir; resmi tatiller kurum genelinde, şubeye özel kapanışlar (tadilat vb.) şube bazında girilir.

## Otomasyonlar
- Ders iptali/değişikliğinde ilgili grubun velilerine otomatik bildirim.
- Öğretmene ertesi günün programı (opsiyonel, akşam bildirimi).

## v2
- Öğretmen müsaitliğine göre otomatik program önerisi.
- Google Calendar / iCal paylaşımı.
