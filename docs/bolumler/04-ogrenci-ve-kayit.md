# 04 · Öğrenci, Veli ve Kayıt (Sözleşme)

**Sürüm:** MVP · **Kurspro karşılığı:** Öğrenciler, Yeni Sözleşme Oluşturma

## Amaç
Öğrencinin ve velinin bilgilerini tek yerde tutmak; her sezon için bir kayıt (sözleşme) oluşturup
ödeme planını buna bağlamak.

## Kayıt sihirbazı (tek ekranda adım adım)
1. **Öğrenci:** ad, soyad, doğum tarihi, seviye, okulu, okul sınıfı/şubesi, sağlık notu (alerji vb.)
2. **Veli(ler):** anne/baba/diğer; telefon, e-posta, meslek; birincil iletişim kişisi; kardeş bağlantısı
3. **Şube, grup ve hizmetler:** şube → grup seçimi (doluluk gösterilir), ek hizmetler (etüt paketi, yaz okulu, materyal/kitap)
4. **Ücret** *(yalnızca Finans modülü açıksa)*: şubenin liste fiyatı, indirimler (kardeş, erken kayıt, personel), net tutar
5. **Ödeme planı** *(yalnızca Finans modülü açıksa)*: peşinat + taksit sayısı + ilk vade → otomatik taksitler (bkz. 05)
6. **Kayıt formu / sözleşme:** Finans kapalıyken ücret maddesi olmayan **kayıt ve muvafakat formu**; şablondan PDF üretimi, yazdır/imzala veya veliye linkle onaylatma; KVKK aydınlatma ve rıza onayları

## Öğrenci kartı (profil)
Sekmeler: Genel bilgi · Veliler · Kayıtlar (sezonlar) · Ödemeler *(Finans açıksa)* · Yoklama · Ödevler · Etüt · Notlar · Belgeler

> Bizim kurumda Finans kapalı olduğu için kayıt sihirbazı 4 adıma iner: Öğrenci → Veli → Şube/Grup → Kayıt formu.

## Veri alanları
| Varlık | Alanlar |
|---|---|
| Öğrenci | ad, soyad, doğum_tarihi, cinsiyet, okul, okul_sınıfı, sağlık_notu, fotoğraf, durum |
| Veli | ad, soyad, telefon, e-posta, yakınlık, birincil_mi, iletişim_izinleri |
| Kayıt | öğrenci_id, sezon_id, şube_id, grup_id, sözleşme_no, durum (aktif/dondurulmuş/iptal); *Finans açıksa:* liste_fiyatı, indirimler, net_tutar |
| Belge | kayıt_id, tür (sözleşme, rıza), dosya, onay_tarihi |

## İş kuralları
- Bir öğrencinin sezon başına bir ana kaydı olur; ek hizmetler kayda kalem olarak eklenir.
- **Kayıt iptali:** öğrenci gruptan çıkar, geçmiş korunur; Finans açıksa iade/kalan borç hesabı yapılır.
- **Grup değişikliği:** kayıt bozulmadan grup değiştirilebilir, tarihçesi tutulur.
- **Öğrenci ve veli kurum genelinde tektir;** kayıt şubeye bağlıdır. Aynı öğrenci başka şubede tekrar
  oluşturulmaz (telefon/ad ile mükerrer kontrolü).
- **Şube nakli:** kayıt yeni şubenin grubuna taşınır; kalan taksitler yeni şubeye devredilir,
  ödenmiş tutarlar eski şubenin kasasında kalır. Fiyat farkı varsa yönetici onayıyla düzeltme kalemi eklenir.
- Kardeşler farklı şubelerde olabilir; kardeş indirimi ve veli borç görünümü şube fark etmeksizin çalışır.
- Sözleşme numarası şube kodu ile başlar (örn. MRK-2026-0042).
- TCKN **zorunlu değil**; yalnızca fatura için gerekirse veliden alınır.
- Sözleşme numarası otomatik ve şube içinde sıralı.

## Otomasyonlar
- Kayıt tamamlanınca veliye: hoş geldiniz mesajı + veli portalı giriş linki + ders programı.
- Doğum günü mesajı (opsiyonel, veliye).

## Açık sorular
- Mevcut kayıt formu / veli izin metniniz var mı? Şablona dönüştürülecek.
- ~~Öğrenci listeniz şu an nerede?~~ → **Excel** (2026-10-09). İçe aktarma aracı MVP'de (bkz. 14).
  Örnek bir Excel dosyası (kişisel veriler silinmiş/uydurulmuş) sütun eşleştirmesi için gerekli.
