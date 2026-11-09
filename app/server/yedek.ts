/**
 * Otomatik yedek (Bölüm 14): her gece veritabanının tam JSON dökümü YEDEK_DIZIN klasörüne yazılır,
 * en az 30 gün saklanır. Ek olarak PostgreSQL tarafında barındırma sağlayıcısının yedeği önerilir.
 */
import { mkdir, readdir, rename, rm, stat, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Db } from "../src/data/model";
import { YEDEK_SAKLAMA_GUN, yedekAdiGecerli, yedekAdiUret, yedekSuresiDoldu } from "../src/bolumler/14-altyapi/kurallar";

export const yedekDizini = () => process.env.YEDEK_DIZIN ?? "./.veri/yedekler";

export async function yedekAl(db: Db, saklaGun = YEDEK_SAKLAMA_GUN): Promise<string> {
  const dizin = yedekDizini();
  await mkdir(dizin, { recursive: true });
  const ad = yedekAdiUret(new Date());
  // Önce geçici dosyaya: yarıda kalan yazma bozuk bir yedek bırakmasın (geçici ad listeye girmez). Yalnızca sunucu kullanıcısı okuyabilir.
  const gecici = join(dizin, `${ad}.${process.pid}.tmp`);
  await writeFile(gecici, JSON.stringify(db), { encoding: "utf8", mode: 0o600 });
  await rename(gecici, join(dizin, ad));
  const simdi = Date.now();
  for (const y of await yedekleriListele()) if (yedekSuresiDoldu(y.zaman, simdi, saklaGun)) await rm(join(dizin, y.ad));
  return ad;
}

export async function yedekleriListele(): Promise<{ ad: string; boyut: number; zaman: string }[]> {
  const dizin = yedekDizini();
  let adlar: string[] = [];
  try {
    adlar = (await readdir(dizin)).filter(yedekAdiGecerli);
  } catch {
    return [];
  }
  const l = await Promise.all(adlar.map(async (ad) => ({ ad, boyut: (await stat(join(dizin, ad))).size, zaman: (await stat(join(dizin, ad))).mtime.toISOString() })));
  return l.sort((a, b) => b.zaman.localeCompare(a.zaman));
}

export async function yedekOku(ad: string): Promise<string | null> {
  if (!yedekAdiGecerli(ad)) return null;
  try {
    return await readFile(join(yedekDizini(), ad), "utf8");
  } catch {
    return null;
  }
}
