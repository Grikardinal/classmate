# Classmate — Kurs Yönetim Sistemi

![Classmate](app/public/logo.svg)

Arayüz projesi: [app/](app/README.md) (React + Tailwind, 21st.dev/shadcn uyumlu bileşenler).

3–8. sınıf öğrencilerine ders veren **kendi kurumumuz** için kayıt, ödeme, ders programı, yoklama,
ödev ve veli iletişimini tek yerde toplayan otomasyon sistemi.

**Esin kaynağı:** Kurspro (kurspro.net) · Ek ilham: Teachworks (otomatik hak ediş/fatura)

## Temel kararlar (2026-10-09)
- Tek kurum için yapılıyor (çok kurumlu SaaS değil); kurumun **birden fazla şubesi** var.
- Hedef: 3–8. sınıf öğrencileri; **ana kullanıcı veli**.
- **Sınav analizi modülü yok** (TYT/AYT/LGS analizi, karne, sıralama kapsam dışı).
- Kurum **ücret almıyor**: Finans modülü yapılacak ama **varsayılan kapalı** (ücret alan kurumlar için açılabilir).
- Mevcut veriler **Excel**'de → Excel'den içe aktarma sihirbazı MVP'de.
- Bildirim: **uygulama içi push** ana kanal (ücretsiz) + kritik durumlarda **SMS**; WhatsApp v2.
- MVP önce web + mobil uyumlu (PWA); yerel mobil uygulama sonra.

## Bölümler

| # | Bölüm | Sürüm |
|---|---|---|
| 01 | [Kurum yapısı ve tanımlar](docs/bolumler/01-kurum-yapisi-ve-tanimlar.md) | MVP |
| 02 | [Kullanıcılar ve yetkiler](docs/bolumler/02-kullanicilar-ve-yetkiler.md) | MVP |
| 03 | [Ön kayıt (aday) yönetimi](docs/bolumler/03-on-kayit.md) | MVP |
| 04 | [Öğrenci, veli ve kayıt](docs/bolumler/04-ogrenci-ve-kayit.md) | MVP |
| 05 | [Finans: ödeme planı, tahsilat, kasa](docs/bolumler/05-finans.md) | MVP sonrası · **varsayılan kapalı** |
| 06 | [Ders programı](docs/bolumler/06-ders-programi.md) | MVP |
| 07 | [Yoklama ve devamsızlık](docs/bolumler/07-yoklama.md) | MVP |
| 08 | [Ödev takibi](docs/bolumler/08-odev-takibi.md) | v2 |
| 09 | [Etüt ve birebir ders](docs/bolumler/09-etut-ve-birebir-ders.md) | v2 |
| 10 | [İletişim ve bildirimler](docs/bolumler/10-iletisim-ve-bildirimler.md) | MVP / v2 |
| 11 | [Veli ve öğrenci portalı](docs/bolumler/11-veli-ve-ogrenci-portali.md) | MVP |
| 12 | [Yönetim paneli ve raporlar](docs/bolumler/12-yonetim-paneli-ve-raporlar.md) | MVP |
| 13 | [Personel ve öğretmen](docs/bolumler/13-personel.md) | MVP / v2 |
| 14 | [Altyapı, güvenlik ve KVKK](docs/bolumler/14-altyapi-guvenlik-kvkk.md) | Tümü |

## Arka plan dokümanları
| Dosya | İçerik |
|---|---|
| [docs/01-pazar-arastirmasi.md](docs/01-pazar-arastirmasi.md) | Rakip araştırması, en iyi 3 örnek |
| [docs/02-kurspro-analizi.md](docs/02-kurspro-analizi.md) | Kurspro ekranları, menüleri, veri yapısı |
| [docs/03-kapsam-ve-moduller.md](docs/03-kapsam-ve-moduller.md) | Sürümlere göre kapsam ve açık kararlar |
| [docs/04-yol-haritasi.md](docs/04-yol-haritasi.md) | Aşamalar ve sıradaki adımlar |

## Durum
- [x] Pazar araştırması ve Kurspro analizi
- [x] Hedef ve kapsam kararı
- [x] Bölüm dokümanları (taslak)
- [ ] Bölümlerdeki açık soruların cevaplanması
- [ ] Teknoloji seçimi
- [x] Uygulama adı ve logo (Classmate)
- [x] Arayüz: 14 bölümün tamamı (örnek veriyle çalışan, tıklanabilir prototip) + veli portalı (PWA)
- [x] İş kuralları birim testleri (33 test)
- [x] Arka uç: Node API + PostgreSQL (geliştirmede gömülü), sunucu tarafı rol/şube yetkisi
- [x] Gerçek giriş: personel e-posta + parola (+ SMS ile iki adım), veli telefon + SMS kodu
- [x] Gönderim: SMS sağlayıcısı (test modu + Netgsm), web push, gönderim kuyruğu ve otomatik hatırlatmalar
- [x] Şube/sezon/ders/derslik/ders saati yönetimi, personel Excel aktarımı, gece otomatik yedek
- [ ] Kurumun SMS hesabı (Netgsm) ve sunucu barındırma ile canlıya alma
- [ ] MVP geliştirme
