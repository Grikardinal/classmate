# 13 · Personel ve Öğretmen Yönetimi

**Sürüm:** MVP (personel kartı) · v2 (hak ediş, maaş) · **Kurspro karşılığı:** Personel (avans, maaş, prim)

## Amaç
Öğretmen ve personel bilgilerini tutmak; ders saatine göre çalışan öğretmenlerin hak edişini
**işlenen derslerden otomatik** hesaplamak (Teachworks'ün güçlü yanı).

## Personel kartı (MVP)
- Ad, telefon, e-posta, görev (öğretmen/sekreter/şube müdürü/yönetici), branş(lar), işe başlama tarihi
- **Bağlı şube(ler):** öğretmen birden fazla şubede ders verebilir; ana şube ayrıca belirtilir
- Bağlı kullanıcı hesabı (02)
- Atandığı gruplar ve haftalık ders saati

## Hak ediş (v2 · varsayılan KAPALI)
Ayrı bir modül anahtarıyla açılır (bkz. 01). Ödemeler finansa gider olarak yazılacağı için Finans modülü de açık olmalıdır;
Finans kapalıyken hak ediş yalnızca **ders sayısı raporu** olarak çalışır (öğretmen başına işlenen ders, şube bazında).

| Ücret tipi | Hesap |
|---|---|
| Sabit maaş | Aylık sabit |
| Ders başı | İşlenen ders oturumu × ders ücreti |
| Karma | Sabit + ek ders başı |

- "İşlenen ders" = yoklaması alınmış ve `işlendi` durumundaki oturum (06–07).
- Ay sonu **hak ediş özeti**: öğretmen bazında ders sayısı, tutar; yönetici onayı.
- Birden fazla şubede çalışan öğretmenin hak edişi **şubelere göre ayrıştırılır** (her şubenin gideri doğru görünsün).
- Ders ücreti şubeye göre farklı olabilir.
- Avans ve ödemeler kaydedilir; ödenince finansa gider olarak düşer (05).

## Ekranlar
- Personel listesi, personel kartı
- Aylık hak ediş tablosu (onay/ödendi)
- Avans / ödeme girişi

## Not
Bordro, SGK ve vergi hesapları **kapsam dışı**; muhasebeciye aktarılacak özet rapor üretilir.
