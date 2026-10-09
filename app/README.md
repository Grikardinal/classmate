# Classmate

Kurs yönetim sistemi: React 18 + Vite + Tailwind CSS 4 arayüzü, Node (Hono) API, PostgreSQL.
Arayüz bileşenleri shadcn/ui ve [21st.dev](https://21st.dev) ile aynı yapıda (`src/components/ui`).

## Çalıştırma

```bash
npm install
npm run dev      # API (3001) + arayüz (5173) birlikte → http://localhost:5173
npm test         # iş kuralları, örnek veri ve API testleri (vitest)
npm run build    # arayüzü derle
npm run start    # üretim: derlenmiş arayüz + API tek portta (PORT, varsayılan 3001)
```

- **Personel girişi:** `/giris` — demo kurulumunda hesaplar giriş ekranında listelenir, parola `Classmate2026`.
  Genel yönetici iki adımlı doğrulama kullanır; SMS test modunda kod ekranda ve sunucu konsolunda görünür.
- **Veli portalı:** `/veli` — telefon + SMS koduyla giriş (demo velileri giriş ekranında).

## Yapılandırma (`.env`)
`.env.example` dosyasını `.env` olarak kopyalayın.

| Değişken | Anlamı |
|---|---|
| `DEMO` | `1` (varsayılan): uydurma örnek veriyle kurulur. `0`: boş kurum + `ILK_YONETICI_*` ile ilk yönetici (ilk girişte parola değiştirmesi istenir) |
| `DATABASE_URL` | Boşsa gömülü PostgreSQL (PGlite, `./.veri/pg`). Canlıda gerçek PostgreSQL bağlantısı |
| `SMS_SAGLAYICI` | `konsol` (gönderilmez, konsola yazılır) veya `netgsm` (`NETGSM_KULLANICI`, `NETGSM_SIFRE`, `NETGSM_BASLIK`) |
| `VAPID_PUBLIC` / `VAPID_PRIVATE` | Web push anahtarları; boşsa ilk açılışta üretilip veritabanında saklanır |
| `YEDEK_DIZIN` | Gece otomatik yedeklerin klasörü (varsayılan `./.veri/yedekler`, 30 gün saklanır) |

## Mimari
| Yol | İçerik |
|---|---|
| `server/uygulama.ts` | API uçları: giriş/çıkış, iki adımlı doğrulama, veri, değişiklik, parola, yedek, veli portalı, push aboneliği |
| `server/politika.ts` | **Yetki**: rol + şube kapsamı her okuma ve yazmada sunucuda uygulanır; öğretmen yalnızca kendi grupları; veli yalnızca kendi çocukları |
| `server/kimlik.ts` | scrypt parola özeti, httpOnly çerezli oturumlar, SMS kodları, deneme sınırı |
| `server/gonderim.ts` | SMS sağlayıcıları, web push, gönderim kuyruğu (push yoksa SMS'e düşme, saat aralığı) |
| `server/zamanlayici.ts` | Otomasyonlar: zamanlanmış duyuru, etüt/ödev/taksit hatırlatmaları |
| `server/veritabani.ts` | PostgreSQL / PGlite; her koleksiyon kendi tablosunda, `sube_id` sütunuyla |
| `server/yedek.ts` | Gece otomatik JSON yedeği |
| `src/data/model.ts` | Ortak veri modeli, örnek veri üretimi, yardımcılar (sunucu + tarayıcı) |
| `src/data/store.ts` | Tarayıcı deposu: değişiklikleri sunucuya gönderir, reddedilirse sunucudaki hali geri yükler |
| `src/bolumler/NN-*.tsx` | **Her bölüm ayrı dosya** (docs/bolumler ile aynı numaralar) |
| `src/layout/Giris.tsx` | Personel girişi, oturum kapısı, parola değiştirme |

## Güvenlik notları
- Oturum çerezleri `httpOnly`, `SameSite=Strict`; üretimde `Secure`. Yazma istekleri yalnızca JSON kabul eder.
- Giriş: 15 dakikada 5 hatalı denemeden sonra geçici kilit. SMS kodu 5 dakika geçerli, en çok 5 deneme; numara kayıtlı olsa da olmasa da aynı yanıt.
- Gönderim kayıtlarında giriş kodları saklanmaz. İşlem kaydı ve tahsilatlar silinemez/değiştirilemez (tahsilat yalnızca iptal).
- Öğretmene veli telefonları maskeli gider; veliye personelin iletişim bilgileri gitmez.

## Bilinen sınırlar
- Sunucu tek süreç olarak tasarlandı (veri bellekte tutulup her değişiklik veritabanına yazılır). Birden çok sunucu örneği için paylaşılan önbellek gerekir.
- Netgsm entegrasyonu gerçek hesapla denenmedi (hesap bilgisi yok); test modu (`konsol`) çalışır durumda.
- E-posta gönderimi yok; yeni kullanıcı ve parola sıfırlamada geçici parola yöneticiye bir kez gösterilir.
