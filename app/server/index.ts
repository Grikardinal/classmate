/**
 * Classmate sunucusu.
 *   npm run dev    → API (3001) + Vite (5173, /api istekleri API'ye yönlenir)
 *   npm run start  → derlenmiş arayüz + API tek portta (PORT, varsayılan 3001)
 *
 * Ortam değişkenleri: .env.example dosyasına bakın.
 */
import { existsSync, readFileSync } from "node:fs";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { baglan, semaKur } from "./veritabani";
import { pushHazirla, smsSaglayiciOlustur } from "./gonderim";
import { uygulamaOlustur } from "./uygulama";

// .env dosyası varsa yükle (basit KEY=VALUE)
if (existsSync(".env"))
  for (const satir of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = satir.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }

const uretim = process.env.NODE_ENV === "production" || process.argv.includes("--uretim");
const demo = process.env.DEMO !== "0";
const port = Number(process.env.PORT ?? 3001);

const vt = await baglan();
await semaKur(vt);
const sms = smsSaglayiciOlustur();
const push = await pushHazirla(vt, process.env.PUSH_ILETISIM ?? "bilgi@classmate.app").catch((e) => {
  console.warn("Web push hazırlanamadı:", e.message);
  return null;
});
const { app, otomasyonCalistir, gunlukYedek } = await uygulamaOlustur({ vt, sms, push, demo, uretim });

if (uretim) {
  app.use("/*", serveStatic({ root: "./dist" }));
  app.get("*", serveStatic({ path: "./dist/index.html" }));
}

serve({ fetch: app.fetch, port }, () => {
  console.log(`Classmate API: http://localhost:${port}  ·  veritabanı: ${vt.tur}  ·  SMS: ${sms.ad}  ·  push: ${push ? "açık" : "kapalı"}  ·  ${demo ? "DEMO verisi" : "gerçek kurulum"}`);
});

// Otomasyonlar ve gönderim kuyruğu: dakikada bir
const zamanlayici = setInterval(() => {
  void otomasyonCalistir().catch((e) => console.error("Otomasyon hatası:", e));
  void gunlukYedek().catch((e) => console.error("Yedek hatası:", e));
}, 60_000);
void otomasyonCalistir().catch((e) => console.error("Otomasyon hatası:", e));

for (const sinyal of ["SIGINT", "SIGTERM"] as const)
  process.on(sinyal, async () => {
    clearInterval(zamanlayici);
    await vt.kapat();
    process.exit(0);
  });

// Beklenmeyen bir hata sunucuyu düşürmesin; günlüğe yazılsın
process.on("unhandledRejection", (e) => console.error("Yakalanmamış hata:", e));
