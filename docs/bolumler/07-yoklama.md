# 07 · Yoklama ve Devamsızlık

**Sürüm:** MVP · **Kurspro karşılığı:** Sınıf Yoklamaları, "Sınıf Yoklamaları ve Konular" (mobil)

## Amaç
Öğretmenin derste 30 saniyede yoklama alması ve velinin çocuğunun gelmediğini **anında** öğrenmesi.
3–8. sınıf velileri için en değerli özelliklerden biri budur.

## Akış
1. Öğretmen telefonundan "Bugünkü derslerim" → ilgili ders oturumu
2. Öğrenci listesi (fotoğraflı), varsayılan herkes **geldi**; gelmeyene dokun → **yok**, geç gelene → **geç**
3. İşlenen **konu** yazılır (kısa not; veliler görür)
4. Kaydet → gelmeyenlerin velilerine otomatik bildirim

## Durumlar
`geldi` · `gelmedi` · `geç geldi` · `izinli` (veli önceden bildirdiyse)

## Ekranlar
- Öğretmen: bugünkü dersler, yoklama ekranı, alınmamış yoklamalar uyarısı
- Yönetici / şube müdürü: günlük yoklama durumu (hangi derslerde yoklama alınmadı), devamsızlık listesi — şube filtreli
- Öğrenci kartı: devamsızlık geçmişi ve oranı
- Veli portalı: yoklama geçmişi + işlenen konular; **"Yarın gelemeyecek" izin bildirimi** gönderme

## Otomasyonlar
- Yoklamada `gelmedi` → veliye anında mesaj: "Ayşe bugün 16:00 Matematik dersine katılmadı."
- Dersin başlamasından 15 dk sonra yoklama alınmadıysa öğretmene hatırlatma.
- Haftada **3+ devamsızlık** → yöneticiye uyarı (eşik ayarlanabilir).

## Raporlar
- Şube/grup/öğrenci/ay bazında devamsızlık oranı
- Öğretmen ders kayıtları (hangi ders işlendi, hangi konu) — Kurspro'daki "Öğretmen Ders Kayıtları"

## İş kuralları
- Yoklama geçmişe dönük düzeltilebilir (aynı gün öğretmen, sonrasında yalnızca yönetici).
- İzinli devamsızlık, devamsızlık oranına ayrı gösterilir.

## v2
- QR kod / kart ile giriş-çıkış ("çocuğunuz kuruma giriş yaptı / çıktı" bildirimi)
