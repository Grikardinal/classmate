// Duman testi: derlenmiş uygulamayı geçici bir veritabanıyla açar, temel sayfa ve
// uçları dener, sonra kapatır. Önce `npm run build` gerekir.
//   npm run smoke
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const PORT = Number(process.env.SMOKE_PORT ?? 3099);
const TABAN = `http://127.0.0.1:${PORT}`;
const dizin = mkdtempSync(path.join(tmpdir(), "classmate-smoke-"));

if (!existsSync("dist/index.html")) {
  console.error("dist/ yok: önce `npm run build` çalıştırın.");
  process.exit(1);
}

const sunucu = spawn(process.execPath, ["--import", "tsx", "server/index.ts", "--uretim"], {
  env: { ...process.env, PORT: String(PORT), PGLITE_DIZIN: dizin, DATABASE_URL: "", DEMO: "1", SMS_SAGLAYICI: "konsol" },
  stdio: ["ignore", "pipe", "pipe"],
});
let gunluk = "";
sunucu.stdout.on("data", (d) => (gunluk += d));
sunucu.stderr.on("data", (d) => (gunluk += d));

const hatalar = [];
const kontrol = (ad, kosul, ayrinti = "") => {
  console.log(`${kosul ? "✓" : "✗"} ${ad}${kosul ? "" : `  ${ayrinti}`}`);
  if (!kosul) hatalar.push(ad);
};

async function bekle() {
  for (let i = 0; i < 120; i++) {
    if (sunucu.exitCode !== null) throw new Error("Sunucu açılırken kapandı");
    try {
      const r = await fetch(`${TABAN}/api/durum`);
      if (r.ok) return r.json();
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Sunucu 60 sn içinde açılmadı");
}

try {
  const durum = await bekle();
  kontrol("/api/durum yanıt veriyor (demo)", durum.demo === true);

  for (const yol of ["/", "/giris", "/veli", "/ogrenciler"]) {
    const r = await fetch(TABAN + yol);
    const metin = await r.text();
    kontrol(`GET ${yol} arayüzü döndürüyor`, r.ok && metin.includes('id="root"'), `durum ${r.status}`);
  }

  const yetkisiz = await fetch(`${TABAN}/api/veri`);
  kontrol("oturumsuz /api/veri 401", yetkisiz.status === 401, `durum ${yetkisiz.status}`);

  const eposta = durum.demoHesaplar?.find((h) => h.rol === "genelYonetici")?.eposta ?? durum.demoHesaplar?.[0]?.eposta;
  const giris = await fetch(`${TABAN}/api/giris`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ eposta, parola: durum.demoParola }),
  });
  let yanit = giris;
  const govde = giris.ok ? await giris.clone().json() : {};
  if (govde.ikiAdim) {
    // İki adımlı doğrulama: demo/konsol modunda kod yanıtta gelir
    yanit = await fetch(`${TABAN}/api/giris/dogrula`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ gecici: govde.gecici, kod: govde.demoKod }),
    });
    kontrol("iki adımlı doğrulama", yanit.ok, `durum ${yanit.status}`);
  }
  const cerez = (yanit.headers.get("set-cookie") ?? "").split(";")[0];
  kontrol(`demo hesabıyla giriş (${eposta})`, giris.ok && !!cerez, `durum ${giris.status}`);

  if (cerez) {
    const veri = await fetch(`${TABAN}/api/veri`, { headers: { cookie: cerez } });
    const db = veri.ok ? await veri.json() : null;
    kontrol("oturumla /api/veri dolu", !!db && Array.isArray(db.ogrenciler) && db.ogrenciler.length > 0, `durum ${veri.status}`);
  }
} catch (e) {
  kontrol("sunucu açılışı", false, String(e?.message ?? e));
} finally {
  sunucu.kill();
  await new Promise((r) => setTimeout(r, 500));
  try { rmSync(dizin, { recursive: true, force: true }); } catch {}
}

if (/Error|Hata:/.test(gunluk) && hatalar.length) console.error("\n--- sunucu günlüğü ---\n" + gunluk);
console.log(hatalar.length ? `\n${hatalar.length} kontrol başarısız.` : "\nDuman testi geçti.");
process.exit(hatalar.length ? 1 : 0);
