# 05 · Finans: Ödeme Planı, Tahsilat ve Kasa

**Sürüm:** MVP sonrası (temel) · v2 (sanal POS, e-fatura) · **Kurspro karşılığı:** Tahsilat, Temel Muhasebe, Ödeme Sistemi

> **Durum: modül var ama varsayılan olarak KAPALI** (karar: 2026-10-09).
> Bizim kurum öğrencilerden ücret almıyor. Modül, ücret alan kurumlar için hazır tutulur ve
> **Ayarlar → Modüller** ekranından açılır (bkz. 01). Kapalıyken kayıt sihirbazındaki ücret/ödeme adımları,
> veli portalındaki Ödemeler sekmesi, finans bildirimleri ve dashboard'daki finans kartları görünmez.
>
> Geliştirme sırası: pilot kurumda kullanılmayacağı için MVP çekirdeğinden **sonra** yapılır; ancak
> veri modeli ve modül anahtarı baştan buna göre tasarlanır.

## Amaç
Kim ne kadar borçlu, ne zaman ödeyecek, kim gecikti, kasada ne var — tek bakışta görmek ve hatırlatmaları otomatikleştirmek.

## Ödeme planı ve taksitler
- Kayıtta oluşturulur: peşinat + N taksit, vade günü (örn. her ayın 5'i).
- Taksitler elle düzenlenebilir (tutar, tarih), değişiklik kaydı tutulur.
- Ek hizmetler (kitap, etüt paketi) ayrı kalem veya mevcut plana eklenebilir.

## Tahsilat
- **Hızlı tahsilat ekranı:** öğrenci/veli ara → açık taksitler → tutar gir → yöntem (nakit, havale/EFT, kredi kartı/POS) → makbuz.
- Kısmi ödeme desteklenir; fazla ödeme sonraki taksite aktarılır.
- Kardeşlerin borçları veli bazında birlikte görülür ve tek tahsilatla ödenebilir.
- Makbuz PDF + veliye otomatik "ödemeniz alındı" mesajı.

## Kasa ve gelir-gider
- **Her şubenin kendi kasaları** vardır: Nakit kasa, POS; banka hesabı şubeye özel veya ortak olabilir
- Tahsilat, **öğrencinin kayıtlı olduğu şubenin** kasasına yazılır (veli başka şubede ödese bile; hangi şubede alındığı ayrıca kaydedilir)
- Gider şubeye atanır; ortak giderler (yazılım, muhasebeci, reklam) "Genel Merkez" olarak girilir
- Şubeler arası virman (örn. şube nakit kasasından merkez banka hesabına)
- Gelir: tahsilatlardan otomatik
- Gider: kira, fatura, maaş, kırtasiye… (kategori + belge fotoğrafı)
- Gün sonu kasa raporu, kasalar arası virman

## Ekranlar
- Öğrenci/veli **cari hesap** (borç–alacak dökümü)
- **Vadesi geçenler** listesi (gecikme günü, tutar, son hatırlatma tarihi)
- Bugün / bu hafta vadesi gelenler
- Kasa hareketleri, gider girişi
- Finans özeti: aylık beklenen vs. tahsil edilen, tahsilat oranı — **şube bazında ve konsolide**
- Şube karşılaştırma: ciro, tahsilat oranı, gider, öğrenci başı gelir

## Otomasyonlar
- Vadeden **3 gün önce** veliye hatırlatma, vade günü bilgi, **gecikmede 3. ve 10. gün** nazik hatırlatma (günler ayarlanabilir).
- Ödeme alınınca otomatik teşekkür + makbuz linki.
- Ay sonunda yöneticiye tahsilat özeti.

## v2
- Sanal POS (iyzico / PayTR) ile veli portalından **online ödeme**
- e-Arşiv fatura (Paraşüt vb. entegrasyonu)
- Kredi kartına otomatik çekim (abonelik)

## İş kuralları
- Tahsilat silinemez, yalnızca **iptal** edilir (gerekçe + kullanıcı kaydı).
- İndirim/iade yetkisi yalnızca yöneticide.
- Tüm tutarlar TL, kuruş hassasiyetinde tutulur.

## Açık sorular
- ~~Ödemeler nasıl alınıyor?~~ → Kurum ücret almıyor; modül pasif. Aşağıdakiler modül ilk açılacak kurumla netleşecek:
  - Ödeme yöntemleri (nakit, havale, POS), şube bazında ayrı POS
  - Şube kasaları ayrı mı, tek hesap mı
  - Fatura mı, makbuz mu
