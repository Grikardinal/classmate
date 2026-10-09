# 14 · Teknik Altyapı, Güvenlik ve KVKK

**Sürüm:** Tüm sürümler (MVP'den itibaren)

## Amaç
Sistemin güvenli, yedekli, hızlı ve yasal olarak uygun çalışması. Görünmeyen ama her bölümün dayandığı katman.

## Mimari (öneri — karar bekliyor)
- **Tek web uygulaması:** yönetim paneli + öğretmen ekranları + veli/öğrenci portalı (rol bazlı), mobil uyumlu, PWA
- **Sunucu + veritabanı:** ilişkisel veritabanı (PostgreSQL) — finans verisi için şart
- **Arka plan işleri:** zamanlanmış bildirimler (vade hatırlatma, yoklama uyarısı) için kuyruk/cron
- **Dosya deposu:** sözleşme PDF'leri, ödev ekleri, gider belgeleri
- **Barındırma:** Türkiye'de veya KVKK açısından uygun bir bulut sağlayıcı

Teknoloji yığını seçenekleri ayrı bir karar dokümanında karşılaştırılacak.

## Güvenlik
- HTTPS, güçlü parola politikası, personel için iki adımlı doğrulama (opsiyonel)
- Rol + **şube kapsamı** bazlı erişim (02) sunucu tarafında zorunlu kontrol; şubeye bağlı her tabloda `şube_id`
  bulunur ve sorgular otomatik filtrelenir (bir şubenin verisi diğerine sızmaz — test senaryosu olarak yazılır)
- İşlem kaydı (audit log): finans, kayıt iptali, yetki değişiklikleri
- Oturum zaman aşımı; veli tarafında SMS kodu deneme limiti

## Yedekleme
- Günlük otomatik veritabanı yedeği, en az 30 gün saklama
- Yedekten geri dönüş ayda bir test edilir
- Yönetici tüm verisini Excel olarak dışa aktarabilir (veri sahipliği)

## KVKK
Çocuklara ait kişisel veri işlendiği için özen gerekir:
- **Veri minimizasyonu:** TCKN zorunlu değil; sağlık notu yalnızca gerekirse
- **Aydınlatma metni** ve **açık rıza** kayıtta alınır, sürümü ve tarihi saklanır (04)
- İletişim izinleri ayrı ayrı (SMS / WhatsApp / e-posta, bilgilendirme / tanıtım)
- Saklama süreleri: ayrılan öğrenci ve vazgeçen aday verisi için süre sonunda silme/anonimleştirme
- Veri sahibi başvurusu (bilgi talebi, silme) için yönetici aracı
- Yurt dışına veri aktarımı (bulut, WhatsApp) açısından değerlendirme

## Performans ve kullanılabilirlik
- Kayıt dönemi (Ağustos–Eylül) yoğunluğuna hazırlık
- Telefonda 3G'de bile kullanılabilir hız

## Excel'den içe aktarma (MVP — kurumun mevcut verisi Excel'de)
Adım adım sihirbaz:
1. **Şablon indir** (önerilen sütunlar) *veya* mevcut Excel'i olduğu gibi yükle
2. **Sütun eşleştirme:** "Öğrenci Adı Soyadı" → ad + soyad, "Veli Tel" → veli telefonu vb.; ad-soyad tek sütundaysa bölme
3. **Şube / sezon / grup seçimi:** dosya tek şubeyse sabit seçilir, birden fazla şube içeriyorsa sütundan okunur
4. **Önizleme ve doğrulama:** hatalı telefon, boş zorunlu alan, tanımsız grup adı, mükerrer öğrenci (aynı ad + veli telefonu)
   — satır satır uyarı, düzeltip tekrar dene
5. **Aktar:** öğrenci + veli + kayıt oluşturulur; kardeşler aynı veli telefonundan otomatik eşleştirilir
6. **Rapor:** kaç kayıt eklendi / atlandı; atlananlar Excel olarak indirilebilir

Kurallar:
- Aktarım geri alınabilir (aynı aktarım partisinden gelen kayıtlar toplu silinebilir) — deneme yapmayı güvenli kılar
- Telefonlar tek formata çevrilir (05xx xxx xx xx)
- Finans açıksa borç/taksit sütunları da aktarılabilir
- Personel listesi için ayrı, aynı mantıkta içe aktarma
