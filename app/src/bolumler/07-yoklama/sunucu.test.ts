/**
 * Bölüm 07 sunucu denetimi (server/politika.ts · yazmaDenetle → yoklamaDenetle).
 * Örnek veri üzerinde istemcinin göndereceği değişiklik paketleriyle sınanır. Saat sabittir.
 */
import { describe, expect, it } from "vitest";
import { ornekVeriUret, type Db, type Gonderim, type ProgramSatiri, type Yoklama } from "@/data/model";
import { farkHesapla, farkUygula } from "@/data/fark";
import { YetkiHatasi, ogretmenGruplari, okumaSuz, yazmaDenetle, type Aktor } from "../../../server/politika";

const BUGUN = "2026-11-09"; // pazartesi
const ZAMAN = `${BUGUN}T23:00`;
const ham = ornekVeriUret();
// Kayıt ve grup geçmişi gerçek saate bağlı olmasın
const db: Db = {
  ...ham,
  yoklamalar: {},
  iptaller: [],
  izinler: [],
  gonderimler: [],
  tatiller: [],
  kayitlar: ham.kayitlar.map((k) => ({ ...k, tarih: "2026-09-01", grupGecmisi: [{ grupId: k.grupId, tarih: "2026-09-01" }] })),
};
const kisi = (kullaniciId: string): Aktor => {
  const kullanici = db.kullanicilar.find((k) => k.id === kullaniciId)!;
  return { kullanici, personel: db.personel.find((p) => p.id === kullanici.personelId)! };
};
const rolden = (rol: string, personelId?: string): Aktor => {
  const k = db.kullanicilar.find((x) => x.rol === rol && (!personelId || x.personelId === personelId) && (rol !== "sekreter" || (x.subeIds !== "all" && x.subeIds.includes("s1"))))!;
  return kisi(k.id);
};
const YONETICI = kisi("u0");
const MUDUR = kisi("u1"); // yalnızca s1
const OGRETMEN = rolden("ogretmen", "p4");
const SEKRETER = rolden("sekreter");

const ps1 = db.program.find((p) => p.id === "ps1")!;
const g1Kayitlar = db.kayitlar.filter((k) => k.grupId === "g1" && k.durum === "aktif");
const OGR = g1Kayitlar[0].ogrenciId;
const OGR2 = g1Kayitlar[1].ogrenciId;
const oturum = (t: string) => `ps1_${t}`;
const yok = (t: string, p: Partial<Yoklama> = {}): Yoklama => ({ oturumId: oturum(t), tarih: t, satirId: "ps1", grupId: "g1", ogretmenId: "p4", durumlar: { [OGR]: "gelmedi", [OGR2]: "geldi" }, konu: " Kesirler ", kayitZamani: "sahte", ...p });

function dene(fn: (x: Db) => void, a: Aktor = OGRETMEN, kaynak: Db = db, zaman = ZAMAN) {
  const taslak = { ...kaynak } as Db;
  for (const k of Object.keys(taslak) as (keyof Db)[]) {
    const v = taslak[k];
    if (Array.isArray(v)) (taslak as Record<string, unknown>)[k] = [...v];
    else if (v && typeof v === "object") (taslak as Record<string, unknown>)[k] = { ...(v as object) };
  }
  fn(taslak);
  const fark = farkHesapla(kaynak, taslak);
  return () => yazmaDenetle(kaynak, farkUygula(kaynak, fark), fark, a, zaman);
}
const yaz = (y: Yoklama, a?: Aktor, k?: Db, z?: string) => dene((x) => (x.yoklamalar[y.oturumId] = y), a, k, z);
const reddedilir = (f: () => unknown, mesaj?: RegExp) => {
  expect(f).toThrow(YetkiHatasi);
  if (mesaj) expect(f).toThrow(mesaj);
};
const kayitli = (y: Yoklama): Db => ({ ...db, yoklamalar: { [y.oturumId]: y } });
const yazilan = (d: ReturnType<ReturnType<typeof yaz>>) => d.koleksiyonlar.yoklamalar!.yaz[0] as unknown as Yoklama;
const gonderim = (id: string, p: Partial<Gonderim> = {}): Gonderim => ({ id, zaman: "x", olay: "devamsizlik", veliId: "v1", alici: "a", ogrenciId: OGR, subeId: "s1", kanal: "sms", metin: "Ali bugün 16:00 dersine katılmadı.", durum: "bekliyor", maliyet: 1, ...p });

describe("yetki ve zaman", () => {
  it("öğretmen kendi dersinin bugünkü yoklamasını alır", () => {
    expect(ps1.gun).toBe(1);
    expect(yaz(yok(BUGUN))).not.toThrow();
  });
  it("gelecek tarih ve başlamamış ders kimseye açık değil", () => {
    reddedilir(yaz(yok("2026-11-16"), YONETICI), /Gelecek/);
    reddedilir(yaz(yok(BUGUN), OGRETMEN, db, `${BUGUN}T00:30`), /başlamadan/);
  });
  it("öğretmen aynı gün düzeltir; geçmişi düzeltemez, yönetici düzeltir", () => {
    expect(yaz(yok(BUGUN, { konu: "Yeni" }), OGRETMEN, kayitli(yok(BUGUN)))).not.toThrow();
    const eski = "2026-11-02";
    reddedilir(yaz(yok(eski, { konu: "Yeni" }), OGRETMEN, kayitli(yok(eski))), /yalnızca yönetici/);
    reddedilir(yaz(yok(eski, { konu: "Yeni" }), SEKRETER, kayitli(yok(eski))), /yalnızca yönetici/);
    expect(yaz(yok(eski, { konu: "Yeni" }), MUDUR, kayitli(yok(eski)))).not.toThrow();
  });
  it("öğretmen alınmamış yoklamayı 7 gün içinde girer, daha eskisini giremez", () => {
    expect(yaz(yok("2026-11-02"))).not.toThrow();
    reddedilir(yaz(yok("2026-10-26")), /7 günden eski/);
    expect(yaz(yok("2026-10-26"), MUDUR)).not.toThrow();
  });
  it("aynı gruptaki başka öğretmenin dersini alamaz", () => {
    const baska: ProgramSatiri = { ...ps1, id: "psB", ogretmenId: "p7", saatId: ps1.saatId };
    const k = { ...db, program: [...db.program, baska] };
    reddedilir(yaz(yok(BUGUN, { oturumId: `psB_${BUGUN}`, satirId: "psB" }), OGRETMEN, k), /kendi dersinizin/);
  });
  it("kendi grubu olmayan yoklama ve başka şube reddedilir", () => {
    const p = db.program.find((x) => x.grupId === "g5" && x.gun === 1) ?? db.program.find((x) => x.grupId === "g5")!;
    const y: Yoklama = { ...yok(BUGUN), oturumId: `${p.id}_${BUGUN}`, satirId: p.id, grupId: "g5" };
    reddedilir(yaz(y), /kapsam/); // öğretmenin şubesi dışında; kendi şubesindeki yabancı grup "grubu devreden" testinde
    reddedilir(yaz(y, MUDUR), /kapsam/);
  });
  it("başka şubenin oturumu kendi grubu gibi gönderilemez", () => {
    const p = db.program.find((x) => x.grupId === "g5" && x.gun === 1) ?? db.program.find((x) => x.grupId === "g5")!;
    reddedilir(yaz({ ...yok(BUGUN), oturumId: `${p.id}_${BUGUN}`, satirId: p.id }, MUDUR), /oturumu hatalı|böyle bir ders/);
  });
  it("grubu devreden öğretmen yazamaz ve görmez (karar 2026-11-08)", () => {
    const k: Db = {
      ...db,
      program: db.program.map((p) => (p.ogretmenId === "p4" && p.grupId === "g1" ? { ...p, bitis: "2026-11-08" } : p)),
      gruplar: db.gruplar.map((g) => (g.id === "g1" ? { ...g, rehberId: "p7" } : g)),
      yoklamalar: { [oturum("2026-11-02")]: yok("2026-11-02") },
    };
    expect(ogretmenGruplari(k, "p4", BUGUN).has("g1")).toBe(false);
    reddedilir(yaz(yok("2026-11-02", { konu: "x" }), OGRETMEN, k), /kendi gruplarınızın/);
    expect(okumaSuz(k, OGRETMEN, BUGUN).yoklamalar[oturum("2026-11-02")]).toBeUndefined();
  });
});

describe("oturumun gerçekliği", () => {
  it("olmayan satır, yanlış gün, tatil, iptal reddedilir", () => {
    reddedilir(yaz(yok(BUGUN, { oturumId: `yok_${BUGUN}`, satirId: "yok" }), YONETICI), /böyle bir ders/);
    reddedilir(yaz(yok("2026-11-03"), YONETICI), /böyle bir ders/);
    const tatil = { ...db, tatiller: [{ id: "t", tarih: "2026-11-02", ad: "Tatil", subeId: null }] };
    reddedilir(yaz(yok("2026-11-02"), YONETICI, tatil), /tatil/);
    const iptal = { ...db, iptaller: [{ oturumId: oturum("2026-11-02"), neden: "x", tarih: "2026-11-01" }] };
    reddedilir(yaz(yok("2026-11-02"), YONETICI, iptal), /İptal/);
  });
  it("oturum kimliğiyle uyuşmayan tarih reddedilir", () => {
    reddedilir(yaz(yok(BUGUN, { tarih: "2026-11-02" }), YONETICI), /oturumu hatalı/);
  });
});

describe("öğrenciler ve durumlar", () => {
  it("kaydı olmayan ve geçersiz durum reddedilir", () => {
    reddedilir(yaz(yok(BUGUN, { durumlar: { yabanci: "geldi" } })), /kaydı olmayan/);
    reddedilir(yaz(yok(BUGUN, { durumlar: { [OGR]: "belki" as never } })), /Geçersiz/);
  });
  it("dondurulmuş, iptal ve mezun kayıt yazılamaz", () => {
    for (const durum of ["dondurulmus", "iptal", "mezun"] as const) {
      const k = { ...db, kayitlar: db.kayitlar.map((x) => (x.ogrenciId === OGR ? { ...x, durum } : x)) };
      reddedilir(yaz(yok(BUGUN), OGRETMEN, k), /kaydı olmayan/);
    }
  });
  it("sunucu alanları ve temizlik", () => {
    const y = yazilan(yaz(yok(BUGUN, { ogretmenId: "p7" }), YONETICI)());
    expect(y.ogretmenId).toBe(ps1.ogretmenId);
    expect(y.konu).toBe("Kesirler");
    expect(y.kayitZamani).toBe(ZAMAN);
  });
  it("düzeltme, ayrılan öğrencinin satırını silmez", () => {
    const eski = yok(BUGUN, { durumlar: { [OGR]: "geldi", ayrilan: "gelmedi" } });
    const y = yazilan(yaz(yok(BUGUN, { durumlar: { [OGR]: "gelmedi" } }), OGRETMEN, kayitli(eski))());
    expect(y.durumlar).toEqual({ [OGR]: "gelmedi", ayrilan: "gelmedi" });
  });
  it("yoklama silinemez", () => {
    reddedilir(dene((x) => delete x.yoklamalar[oturum(BUGUN)], YONETICI, kayitli(yok(BUGUN))), /silinemez/);
  });
});

describe("bildirim", () => {
  const veli = db.veliler[0];
  const paket = (g: Gonderim, a: Aktor = OGRETMEN, k: Db = db) => dene((x) => x.gonderimler.push(g), a, k)().koleksiyonlar.gonderimler!.yaz as unknown as Gonderim[];
  it("aynı gün aynı devamsızlık metni ikinci kez kuyruğa girmez", () => {
    const k = { ...db, gonderimler: [gonderim("g0", { veliId: veli.id, zaman: `${BUGUN}T16:10` })] };
    expect(paket(gonderim("g1", { veliId: veli.id }), OGRETMEN, k)).toEqual([]);
  });
  it("başka günün devamsızlığı gider", () => {
    const k = { ...db, gonderimler: [gonderim("g0", { veliId: veli.id, zaman: "2026-11-02T16:10" })] };
    expect(paket(gonderim("g1", { veliId: veli.id }), OGRETMEN, k)).toHaveLength(1);
  });
  it("SMS izni kapalı veliye SMS gitmez, push'a döner", () => {
    const k = { ...db, veliler: db.veliler.map((v) => (v.id === veli.id ? { ...v, izinSms: false } : v)) };
    const [g] = paket(gonderim("g1", { veliId: veli.id }), OGRETMEN, k);
    expect(g.kanal).toBe("push");
    expect(g.maliyet).toBe(0);
  });
  it("SMS izni açık veliye SMS gider", () => {
    const k = { ...db, veliler: db.veliler.map((v) => (v.id === veli.id ? { ...v, izinSms: true } : v)) };
    expect(paket(gonderim("g1", { veliId: veli.id }), OGRETMEN, k)[0].kanal).toBe("sms");
  });
});

describe("veli izni ve okuma", () => {
  const izin = (ogrenciId: string) => ({ id: "iz1", ogrenciId, tarih: "2026-11-16", not: "Rapor", veliId: "v1", olusturma: ZAMAN });
  it("personel izin yazamaz", () => {
    reddedilir(dene((x) => x.izinler.push(izin(OGR)), OGRETMEN), /veli portalından/);
    reddedilir(dene((x) => x.izinler.push(izin(OGR)), YONETICI), /veli portalından/);
  });
  it("öğretmen yalnızca kendi gruplarının iznini görür", () => {
    const gruplar = ogretmenGruplari(db, "p4", BUGUN);
    const baska = db.kayitlar.find((k) => k.subeId === "s1" && !gruplar.has(k.grupId))!;
    const k = { ...db, izinler: [izin(OGR), { ...izin(baska.ogrenciId), id: "iz2" }] };
    expect(okumaSuz(k, OGRETMEN, BUGUN).izinler.map((i) => i.id)).toEqual(["iz1"]);
    expect(okumaSuz(k, MUDUR, BUGUN).izinler).toHaveLength(2);
  });
  it("şube müdürü başka şubenin yoklamasını görmez", () => {
    const p = db.program.find((x) => x.grupId === "g5")!;
    const y: Yoklama = { ...yok(BUGUN), oturumId: `${p.id}_${BUGUN}`, satirId: p.id, grupId: "g5" };
    expect(okumaSuz({ ...db, yoklamalar: { [y.oturumId]: y } }, MUDUR, BUGUN).yoklamalar[y.oturumId]).toBeUndefined();
  });
});
