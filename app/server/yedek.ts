/**
 * Otomatik yedek (Bölüm 14): her gece veritabanının tam JSON dökümü YEDEK_DIZIN klasörüne yazılır,
 * en az 30 gün saklanır. Ek olarak PostgreSQL tarafında barındırma sağlayıcısının yedeği önerilir.
 */
import { mkdir, readdir, rm, stat, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Db } from "../src/data/model";

export const yedekDizini = () => process.env.YEDEK_DIZIN ?? "./.veri/yedekler";
const ADI = /^classmate-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}\.json$/;

export async function yedekAl(db: Db, saklaGun = 30): Promise<string> {
  const dizin = yedekDizini();
  await mkdir(dizin, { recursive: true });
  const z = new Date();
  const ad = `classmate-${z.toISOString().slice(0, 16).replace(":", "-")}.json`;
  await writeFile(join(dizin, ad), JSON.stringify(db), "utf8");
  for (const y of await yedekleriListele()) if (Date.now() - new Date(y.zaman).getTime() > saklaGun * 86400_000) await rm(join(dizin, y.ad));
  return ad;
}

export async function yedekleriListele(): Promise<{ ad: string; boyut: number; zaman: string }[]> {
  const dizin = yedekDizini();
  let adlar: string[] = [];
  try {
    adlar = (await readdir(dizin)).filter((a) => ADI.test(a));
  } catch {
    return [];
  }
  const l = await Promise.all(adlar.map(async (ad) => ({ ad, boyut: (await stat(join(dizin, ad))).size, zaman: (await stat(join(dizin, ad))).mtime.toISOString() })));
  return l.sort((a, b) => b.zaman.localeCompare(a.zaman));
}

export async function yedekOku(ad: string): Promise<string | null> {
  if (!ADI.test(ad)) return null;
  try {
    return await readFile(join(yedekDizini(), ad), "utf8");
  } catch {
    return null;
  }
}
