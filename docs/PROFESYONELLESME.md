# Profesyonelleştirme planı

Proje 14 bölüme ayrıldı; her bölümün arayüz kodu kendi klasöründe
(`app/src/bolumler/NN-ad/`), gereksinim dokümanı `docs/bolumler/` altında.
Bölümler **sırayla** ele alınır: bir bölüm bitip kontrol edilmeden sonrakine geçilmez.

## Her bölümde yapılanlar
1. Kod incelemesi: hatalar, uç durumlar, yetki/şube kontrolleri, doküman ile uyum.
2. Hataların düzeltilmesi ve gerekiyorsa bölümün kendi klasörüne bölünmesi.
3. Bölüm iş kuralları için birim testleri (`*.test.ts`, bölüm klasöründe).
4. Bölüm klasörüne `README.md` (amaç, dosyalar, kurallar, testler, bilinen sınırlar).
5. Kontrol: `npm run check` = tip denetimi + tüm testler + build + duman testi.
6. Commit ve GitHub'a push.

## Bölümler ve ajanlar

| # | Bölüm | Klasör | Ajan | Durum |
|---|---|---|---|---|
| 00 | Hazırlık: klasör yapısı, `check`/`smoke` betikleri | — | ana oturum | ✅ |
| 01 | Kurum yapısı ve tanımlar | `app/src/bolumler/01-kurum-yapisi` | 1 | ✅ |
| 02 | Kullanıcılar ve yetkiler | `app/src/bolumler/02-kullanicilar` | 2 | ⏳ |
| 03 | Ön kayıt | `app/src/bolumler/03-on-kayit` | 3 | ⏳ |
| 04 | Öğrenci, veli ve kayıt | `app/src/bolumler/04-ogrenciler` | 4 | ⏳ |
| 05 | Finans | `app/src/bolumler/05-finans` | 5 | ⏳ |
| 06 | Ders programı | `app/src/bolumler/06-ders-programi` | 1 | ⏳ |
| 07 | Yoklama | `app/src/bolumler/07-yoklama` | 2 | ⏳ |
| 08 | Ödev takibi | `app/src/bolumler/08-odevler` | 3 | ⏳ |
| 09 | Etüt ve birebir ders | `app/src/bolumler/09-etut` | 4 | ⏳ |
| 10 | İletişim ve bildirimler | `app/src/bolumler/10-iletisim` | 5 | ⏳ |
| 11 | Veli ve öğrenci portalı | `app/src/bolumler/11-veli-portali` | 1 | ⏳ |
| 12 | Yönetim paneli ve raporlar | `app/src/bolumler/12-yonetim-paneli` | 2 | ⏳ |
| 13 | Personel | `app/src/bolumler/13-personel` | 3 | ⏳ |
| 14 | Altyapı, güvenlik, KVKK | `app/src/bolumler/14-altyapi` | 4 | ⏳ |

## Kontrol komutları (`app/` içinde)
- `npm run check` — hepsini sırayla çalıştırır
- `npm run typecheck`, `npm test`, `npm run build`, `npm run smoke`
