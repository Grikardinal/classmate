/**
 * PostgreSQL bağlantısı.
 * - DATABASE_URL tanımlıysa gerçek PostgreSQL sunucusu (pg)
 * - değilse gömülü PostgreSQL (PGlite): PGLITE_DIZIN (varsayılan ./.veri/pg; testlerde "memory://")
 *
 * Şema: her koleksiyon kendi tablosunda tutulur (id, sube_id, veri jsonb). Şubeye bağlı her satırda sube_id
 * doludur; kapsam sorguları ve raporlar bu sütunla filtrelenir. Kimlik/oturum tabloları ayrıdır.
 */
import { SURUM, type Db } from "../src/data/model";

export type Satir = Record<string, unknown>;
export type Sorgu = (sql: string, params?: unknown[]) => Promise<Satir[]>;
export type Veritabani = {
  q: Sorgu;
  islem<T>(fn: (q: Sorgu) => Promise<T>): Promise<T>;
  kapat(): Promise<void>;
  tur: "postgres" | "pglite";
};

export async function baglan(): Promise<Veritabani> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const pg = (await import("pg")).default;
    const havuz = new pg.Pool({ connectionString: url, max: 10 });
    const q: Sorgu = async (sql, params) => (await havuz.query(sql, params as unknown[])).rows;
    return {
      tur: "postgres",
      q,
      async islem(fn) {
        const istemci = await havuz.connect();
        try {
          await istemci.query("begin");
          const sonuc = await fn(async (sql, params) => (await istemci.query(sql, params as unknown[])).rows);
          await istemci.query("commit");
          return sonuc;
        } catch (e) {
          await istemci.query("rollback");
          throw e;
        } finally {
          istemci.release();
        }
      },
      kapat: () => havuz.end(),
    };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const dizin = process.env.PGLITE_DIZIN ?? "./.veri/pg";
  if (!dizin.includes("://")) (await import("node:fs")).mkdirSync(dizin, { recursive: true });
  const vt = new PGlite(dizin);
  await vt.waitReady;
  const q: Sorgu = async (sql, params) => (await vt.query<Satir>(sql, params as unknown[])).rows;
  return {
    tur: "pglite",
    q,
    islem: (fn) => vt.transaction(async (tx) => fn(async (sql, params) => (await tx.query<Satir>(sql, params as unknown[])).rows)),
    kapat: () => vt.close(),
  };
}

import { KOLEKSIYONLAR, TEKILLER, anahtar, type Degisiklik, type Koleksiyon } from "../src/data/fark";
export { KOLEKSIYONLAR, TEKILLER, anahtar, type Degisiklik, type Koleksiyon };
export type { Tekil } from "../src/data/fark";

const tablo = (k: Koleksiyon) => `k_${k.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase())}`;

export async function semaKur(vt: Veritabani) {
  const ddl = [
    ...KOLEKSIYONLAR.map(
      (k) => `create table if not exists ${tablo(k)} (
        id text primary key,
        sira bigserial,
        sube_id text,
        veri jsonb not null,
        guncelleme timestamptz not null default now()
      );
      create index if not exists ${tablo(k)}_sube on ${tablo(k)} (sube_id);`,
    ),
    `create table if not exists tekil (anahtar text primary key, veri jsonb not null)`,
    `create table if not exists parola (kullanici_id text primary key, ozet text not null, degistirmeli boolean not null default false)`,
    `create table if not exists oturum (
      belirtec_ozet text primary key, tur text not null, sahip_id text not null,
      bitis timestamptz not null, olusturma timestamptz not null default now(), cihaz text)`,
    `create table if not exists push_abonelik (endpoint text primary key, veli_id text not null, abonelik jsonb not null, olusturma timestamptz not null default now())`,
  ];
  for (const s of ddl) for (const parca of s.split(";").map((x) => x.trim()).filter(Boolean)) await vt.q(parca);
}

/** Tüm veriyi belleğe yükler; boşsa null döner */
export async function hepsiniYukle(vt: Veritabani): Promise<Db | null> {
  // Yalnızca veri ayarlarını oku (vapid gibi sunucu sırları ayrı tutulur); kurum kaydı yoksa kurulum yapılmamıştır
  const tekil = (await vt.q("select anahtar, veri from tekil")).filter((t) => (TEKILLER as readonly string[]).includes(String(t.anahtar)));
  if (!tekil.some((t) => t.anahtar === "kurum")) return null;
  const db = { surum: SURUM } as unknown as Record<string, unknown>;
  for (const t of tekil) db[t.anahtar as string] = t.veri;
  for (const k of KOLEKSIYONLAR) {
    const satirlar = (await vt.q(`select veri from ${tablo(k)} order by sira`)).map((r) => r.veri as Satir);
    db[k] = k === "yoklamalar" ? Object.fromEntries(satirlar.map((s) => [s.oturumId, s])) : satirlar;
  }
  return db as unknown as Db;
}

/** Değişiklikleri tek işlemde (transaction) yazar. subeBul: satırın şube kimliği (kapsam sütunu) */
export async function yaz(vt: Veritabani, d: Degisiklik, subeBul: (k: Koleksiyon, s: Satir) => string | null) {
  await vt.islem(async (q) => {
    for (const [k, v] of Object.entries(d.koleksiyonlar) as [Koleksiyon, { yaz: Satir[]; sil: string[] }][]) {
      for (const s of v.yaz)
        await q(
          `insert into ${tablo(k)} (id, sube_id, veri, guncelleme) values ($1, $2, $3, now())
           on conflict (id) do update set sube_id = excluded.sube_id, veri = excluded.veri, guncelleme = now()`,
          [anahtar(k, s), subeBul(k, s), JSON.stringify(s)],
        );
      for (const id of v.sil) await q(`delete from ${tablo(k)} where id = $1`, [id]);
    }
    for (const [a, veri] of Object.entries(d.tekil))
      await q(`insert into tekil (anahtar, veri) values ($1, $2) on conflict (anahtar) do update set veri = excluded.veri`, [a, JSON.stringify(veri)]);
  });
}

/** Tüm veriyi baştan yazar (ilk kurulum, yedekten geri yükleme) */
export async function tamamenYaz(vt: Veritabani, db: Db, subeBul: (k: Koleksiyon, s: Satir) => string | null) {
  await vt.islem(async (q) => {
    for (const k of KOLEKSIYONLAR) await q(`delete from ${tablo(k)}`);
    // vapid anahtarları korunur (yedek geri yüklense de cihaz abonelikleri bozulmasın)
    await q("delete from tekil where anahtar <> 'vapid'");
  });
  const kayit = db as unknown as Record<string, unknown>;
  const d: Degisiklik = { koleksiyonlar: {}, tekil: {} };
  for (const k of KOLEKSIYONLAR) {
    const v = kayit[k];
    d.koleksiyonlar[k] = { yaz: (Array.isArray(v) ? v : Object.values((v as object) ?? {})) as Satir[], sil: [] };
  }
  for (const t of TEKILLER) d.tekil[t] = kayit[t];
  await yaz(vt, d, subeBul);
}
