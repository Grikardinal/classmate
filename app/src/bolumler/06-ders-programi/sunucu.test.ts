/**
 * Bölüm 06 sunucu denetimi (server/politika.ts · yazmaDenetle → programDenetle).
 * Örnek veri üzerinde istemcinin göndereceği değişiklik paketleriyle sınanır.
 */
import { describe, expect, it } from "vitest";
import { ornekVeriUret, type Db, type ProgramSatiri, type Yoklama } from "@/data/model";
import { farkHesapla, farkUygula } from "@/data/fark";
import { YetkiHatasi, okumaSuz, yazmaDenetle, type Aktor } from "../../../server/politika";
import { otomasyonlariCalistir } from "../../../server/zamanlayici";
import { programDegistir } from "./kurallar";

const BUGUN = "2026-11-09";
const ZAMAN = `${BUGUN}T10:00`;
const db: Db = { ...ornekVeriUret(), yoklamalar: {}, iptaller: [] };
const aktor = (kullaniciId: string): Aktor => {
  const kullanici = db.kullanicilar.find((k) => k.id === kullaniciId)!;
  return { kullanici, personel: db.personel.find((p) => p.id === kullanici.personelId)! };
};
const YONETICI = aktor("u0");
const MUDUR = aktor("u1"); // yalnızca s1
const ogretmenKullanici = db.kullanicilar.find((k) => k.rol === "ogretmen" && k.personelId === "p4")!;
const OGRETMEN: Aktor = { kullanici: ogretmenKullanici, personel: db.personel.find((p) => p.id === "p4")! };
const ps1 = db.program.find((p) => p.id === "ps1")!;
const sekreterKullanici = db.kullanicilar.find((k) => k.rol === "sekreter" && k.subeIds !== "all" && k.subeIds.includes("s1"))!;
const SEKRETER: Aktor = { kullanici: sekreterKullanici, personel: db.personel.find((p) => p.id === sekreterKullanici.personelId)! };

function dene(fn: (x: Db) => void, a: Aktor = YONETICI, kaynak: Db = db) {
  const taslak = { ...kaynak } as Db;
  for (const k of Object.keys(taslak) as (keyof Db)[]) {
    const v = taslak[k];
    if (Array.isArray(v)) (taslak as Record<string, unknown>)[k] = [...v];
    else if (v && typeof v === "object") (taslak as Record<string, unknown>)[k] = { ...(v as object) };
  }
  fn(taslak);
  const fark = farkHesapla(kaynak, taslak);
  return () => yazmaDenetle(kaynak, farkUygula(kaynak, fark), fark, a, ZAMAN);
}
const reddedilir = (f: () => unknown, mesaj?: RegExp) => {
  expect(f).toThrow(YetkiHatasi);
  if (mesaj) expect(f).toThrow(mesaj);
};
const satir = (x: Partial<ProgramSatiri> = {}): ProgramSatiri => ({ id: "psY", grupId: "g1", gun: 2, saatId: "h3", dersId: "l1", ogretmenId: "p4", derslikId: "d2", baslangic: BUGUN, bitis: null, ...x });
const ekle = (p: ProgramSatiri, a?: Aktor, k?: Db) => dene((x) => x.program.push(p), a, k);
const yoklamali = (tarih: string): Db => ({ ...db, yoklamalar: { [`ps1_${tarih}`]: { oturumId: `ps1_${tarih}`, tarih, satirId: "ps1", grupId: "g1", ogretmenId: "p4", durumlar: {}, konu: "", kayitZamani: "" } as Yoklama } });

describe("yetki ve şube kapsamı", () => {
  it("öğretmen 06 yetkisi olsa da program, tatil ve iptal yazamaz", () => {
    reddedilir(ekle(satir(), OGRETMEN), /yönetim/);
    reddedilir(dene((x) => x.tatiller.push({ id: "t9", tarih: "2026-12-07", ad: "A", subeId: "s1" }), OGRETMEN), /yönetim/);
    reddedilir(dene((x) => x.iptaller.push({ oturumId: "ps1_2026-11-23", neden: "x", tarih: BUGUN }), OGRETMEN), /yönetim/);
    reddedilir(dene((x) => (x.program = x.program.filter((p) => p.id !== "ps1")), OGRETMEN));
  });
  it("şube müdürü kendi şubesine yazar, başka şubeye yazamaz", () => {
    expect(ekle(satir(), MUDUR)).not.toThrow();
    reddedilir(ekle(satir({ grupId: "g5", saatId: "h8", gun: 1, derslikId: "d4", dersId: "l2", ogretmenId: "p5" }), MUDUR), /kapsam/);
  });
  it("şube müdürü başka şubenin iptalini yazamaz", () => {
    const p = db.program.find((x) => x.grupId === "g5" && x.gun === 2)!;
    reddedilir(dene((x) => x.iptaller.push({ oturumId: `${p.id}_2026-11-24`, neden: "x", tarih: BUGUN }), MUDUR), /kapsam/);
  });
  it("şube müdürü kendi tatilini ekler; kurum geneli tatil yazamaz", () => {
    expect(dene((x) => x.tatiller.push({ id: "t9", tarih: "2026-12-07", ad: "Tadilat", subeId: "s1" }), MUDUR)).not.toThrow();
    reddedilir(dene((x) => x.tatiller.push({ id: "t9", tarih: "2026-12-07", ad: "Bayram", subeId: null }), MUDUR), /kapsam/);
  });
  it("öğretmen okumada kendi gruplarının programını görür; müdür başka şubeyi görmez", () => {
    const o = okumaSuz(db, OGRETMEN);
    const gruplar = new Set(o.gruplar.map((g) => g.id));
    expect(o.program.every((p) => gruplar.has(p.grupId) || p.ogretmenId === "p4")).toBe(true);
    expect(o.program.some((p) => p.grupId === "g5")).toBe(false);
    expect(okumaSuz(db, MUDUR).program.some((p) => p.grupId === "g5")).toBe(false);
  });
});

describe("çakışma ve uygunluk", () => {
  it("uygun satır kabul edilir", () => {
    expect(ekle(satir())).not.toThrow();
  });
  it("öğretmen, derslik ve grup çakışması reddedilir", () => {
    reddedilir(ekle(satir({ saatId: "h1", dersId: "l2", ogretmenId: "p7", derslikId: "d3" })), /Öğretmen bu saatte/);
    reddedilir(ekle(satir({ saatId: "h1" , derslikId: "d1" })), /Derslik bu saatte/);
    reddedilir(ekle(satir({ gun: 1, saatId: "h1", dersId: "l3", ogretmenId: "p6", derslikId: "d3" })), /bu saatte/);
  });
  it("öğretmenin kapsam dışı şubedeki dersi de çakışır (müdür onu göremez)", () => {
    // p5: g5 (s2) Salı 16:30–17:10; s1 h2 16:50–17:30
    reddedilir(ekle(satir({ saatId: "h2", dersId: "l2", ogretmenId: "p5" }), MUDUR), /Öğretmen bu saatte/);
  });
  it("ileride başlayan satırla örtüşme reddedilir; kapanmış satırla örtüşmez", () => {
    const ileri = { ...db, program: [...db.program, satir({ id: "psI", grupId: "g2", derslikId: "d3", baslangic: "2026-12-07" })] };
    reddedilir(ekle(satir(), YONETICI, ileri), /Öğretmen/);
    expect(ekle(satir({ bitis: "2026-12-06" }), YONETICI, ileri)).not.toThrow();
  });
  it("uygun olmayan öğretmen, başka şubenin dersliği ve yanlış gün tipi reddedilir", () => {
    reddedilir(ekle(satir({ dersId: "l5" }), SEKRETER), /vermiyor/);
    reddedilir(ekle(satir({ derslikId: "d4" })), /Derslik/);
    reddedilir(ekle(satir({ gun: 6 })), /gün/);
  });
  it("sezon dışı ve geçmişten başlayan satır reddedilir", () => {
    reddedilir(ekle(satir({ baslangic: "2027-07-05" })), /sezon/);
    reddedilir(ekle(satir({ baslangic: "2026-11-02" })), /geçmiş/);
  });
});

describe("geçmiş ve yoklama", () => {
  const bol = (yeni: ProgramSatiri | null, g = BUGUN) => (x: Db) => {
    x.program = programDegistir(x.program, ps1, yeni, g, () => "psN");
  };
  it("başlamış satır bölünerek değişir ve kaldırılır", () => {
    expect(dene(bol({ ...ps1, gun: 2, saatId: "h3" }))).not.toThrow();
    expect(dene(bol(null))).not.toThrow();
  });
  it("bugün yoklaması alınmış satır bugünden bölünemez, yarından bölünür", () => {
    const k = yoklamali(BUGUN);
    reddedilir(dene(bol({ ...ps1, gun: 2, saatId: "h3" }), YONETICI, k), /yoklaması/);
    expect(dene(bol({ ...ps1, gun: 2, saatId: "h3" }, "2026-11-10"), YONETICI, k)).not.toThrow();
  });
  it("başlamış satır yerinde değiştirilemez ve silinemez", () => {
    reddedilir(dene((x) => (x.program = x.program.map((p) => (p.id === "ps1" ? { ...p, ogretmenId: "p5" } : p)))), /Başlamış/);
    reddedilir(dene((x) => (x.program = x.program.filter((p) => p.id !== "ps1"))), /silinemez/);
  });
  it("geçmişe dönük kapatma reddedilir; sona ermiş satır yeniden açılamaz", () => {
    reddedilir(dene((x) => (x.program = x.program.map((p) => (p.id === "ps1" ? { ...p, bitis: "2026-10-01" } : p)))), /Geçmiş/);
    const kapali = { ...db, program: db.program.map((p) => (p.id === "ps1" ? { ...p, bitis: "2026-10-01" } : p)) };
    reddedilir(dene((x) => (x.program = x.program.map((p) => (p.id === "ps1" ? { ...p, bitis: null } : p))), YONETICI, kapali), /Başlamış/);
  });
});

describe("tatil ve iptal", () => {
  it("geçmiş tatil silinemez; ileri tatil silinir", () => {
    reddedilir(dene((x) => (x.tatiller = x.tatiller.filter((t) => t.id !== "t1"))), /Geçmiş/);
    expect(dene((x) => (x.tatiller = x.tatiller.filter((t) => t.id !== "t2")))).not.toThrow();
  });
  it("şube müdürünün tatil kaldırma işlem kaydı şubesiyle geçer", () => {
    const k = { ...db, tatiller: [...db.tatiller, { id: "t9", tarih: "2026-12-07", ad: "Tadilat", subeId: "s1" }] };
    const f = dene((x) => {
      x.tatiller = x.tatiller.filter((t) => t.id !== "t9");
      x.islemler.unshift({ id: "ikY", zaman: ZAMAN, kullanici: "x", islem: "Takvim", detay: "kaldırıldı", subeId: "s1" });
    }, MUDUR, k);
    expect(f).not.toThrow();
  });
  it("iptal tarihi sunucudan yazılır", () => {
    const sonuc = dene((x) => x.iptaller.push({ oturumId: "ps1_2026-11-23", neden: "Rapor", tarih: "2020-01-01" }))() as ReturnType<typeof yazmaDenetle>;
    expect(sonuc.koleksiyonlar.iptaller!.yaz[0].tarih).toBe(BUGUN);
  });
  it("tatildeki, yoklamalı veya var olmayan ders iptal edilemez", () => {
    reddedilir(dene((x) => x.iptaller.push({ oturumId: "ps1_2026-11-16", neden: "x", tarih: BUGUN })), /tatil/);
    reddedilir(dene((x) => x.iptaller.push({ oturumId: `ps1_${BUGUN}`, neden: "x", tarih: BUGUN }), YONETICI, yoklamali(BUGUN)), /Yoklaması/);
    reddedilir(dene((x) => x.iptaller.push({ oturumId: "psYok_2026-11-23", neden: "x", tarih: BUGUN })));
  });
});

describe("kararlar 2026-11-08", () => {
  const devredilmis: Db = { ...db, program: db.program.map((p) => (p.grupId === "g2" && p.ogretmenId === "p4" ? { ...p, bitis: "2026-10-01" } : p)) };

  it("grubu devreden öğretmen grubu ve öğrencilerini görmez, rehberi olduğu grubu görür", () => {
    const o = okumaSuz(devredilmis, OGRETMEN, BUGUN);
    expect(o.gruplar.some((g) => g.id === "g2")).toBe(false);
    expect(o.gruplar.some((g) => g.id === "g1")).toBe(true);
    expect(o.kayitlar.some((k) => k.grupId === "g2")).toBe(false);
    expect(okumaSuz(db, OGRETMEN, BUGUN).gruplar.some((g) => g.id === "g2")).toBe(true);
  });
  it("devredilen grubun yoklaması öğretmene gitmez ve yazamaz", () => {
    const y = { oturumId: "ps6_2026-10-03", tarih: "2026-10-03", satirId: "ps8", grupId: "g2", ogretmenId: "p4", durumlar: { o1: "geldi" }, konu: "", kayitZamani: "" } as Yoklama;
    const k = { ...devredilmis, yoklamalar: { [y.oturumId]: y } };
    expect(Object.keys(okumaSuz(k, OGRETMEN, BUGUN).yoklamalar)).toHaveLength(0);
    reddedilir(dene((x) => (x.yoklamalar[y.oturumId] = { ...y, konu: "değişti" }), OGRETMEN, k), /kendi gruplar/);
  });
  it("branş dışı atama yöneticide geçer, sekreterde geçmez", () => {
    const y = satir({ dersId: "l5" });
    expect(ekle(y, YONETICI)).not.toThrow();
    expect(ekle(y, MUDUR)).not.toThrow();
    reddedilir(ekle(y, SEKRETER), /vermiyor/);
  });
  it("branş dışı olsa da pasif veya başka şubedeki öğretmen atanamaz", () => {
    reddedilir(ekle(satir({ grupId: "g5", saatId: "h8", gun: 1, derslikId: "d4", dersId: "l1", ogretmenId: "p4" })), /görevli değil/);
  });

  const iptalli = (oturumId: string): Db => ({ ...db, iptaller: [{ oturumId, neden: "x", tarih: "2026-11-01" }] });
  const geriAl = (x: Db) => (x.iptaller = []);
  it("tarihi geçmemiş iptal (bugün dahil) geri alınır", () => {
    expect(dene(geriAl, MUDUR, iptalli("ps1_2026-11-23"))).not.toThrow();
    expect(dene(geriAl, YONETICI, iptalli(`ps1_${BUGUN}`))).not.toThrow();
  });
  it("tarihi geçmiş veya yoklamalı iptal geri alınamaz; öğretmen geri alamaz", () => {
    reddedilir(dene(geriAl, YONETICI, iptalli("ps1_2026-11-02")), /geçmiş/);
    reddedilir(dene(geriAl, YONETICI, { ...yoklamali("2026-11-23"), iptaller: iptalli("ps1_2026-11-23").iptaller }), /Yoklaması/);
    reddedilir(dene(geriAl, OGRETMEN, iptalli("ps1_2026-11-23")));
  });
  it("iptalin başka alanı değiştirilemez", () => {
    reddedilir(dene((x) => (x.iptaller = [{ ...x.iptaller[0], neden: "başka" }]), YONETICI, iptalli("ps1_2026-11-23")), /değiştirilemez/);
  });

  it("şube müdürü diğer şubedeki dersi ayrıntısız dolu saat olarak alır", () => {
    const o = okumaSuz(db, MUDUR, BUGUN);
    expect(o.program.some((p) => p.grupId === "g5")).toBe(false);
    const dolu = o.doluSaatler!.filter((s) => s.ogretmenId === "p5" && s.gun === 2);
    expect(dolu.some((s) => s.bas === "16:30")).toBe(true);
    expect(Object.keys(dolu[0]).sort()).toEqual(["baslangic", "bas", "bit", "bitis", "gun", "ogretmenId"].sort());
    expect(JSON.stringify(o.doluSaatler)).not.toMatch(/"g5"|"l2"|"d4"/);
  });
  it("genel yönetici ve sekreter dolu saat almaz; genel yönetici ayrıntıyı görür", () => {
    expect(okumaSuz(db, YONETICI, BUGUN).doluSaatler).toBeUndefined();
    expect(okumaSuz(db, SEKRETER, BUGUN).doluSaatler).toBeUndefined();
    expect(okumaSuz(db, YONETICI, BUGUN).program.some((p) => p.grupId === "g5")).toBe(true);
  });
  it("dolu saat geri yazılamaz: farka girmez", () => {
    const fark = farkHesapla(db, { ...db, doluSaatler: [{ ogretmenId: "p5", gun: 1, bas: "10:00", bit: "11:00", baslangic: BUGUN, bitis: null }] });
    expect(JSON.stringify(fark)).not.toContain("doluSaatler");
  });

  it("otomasyon biten sezonun açık satırlarını kapatır, tekrar çalışınca değişmez", () => {
    const k: Db = { ...db, sezonlar: db.sezonlar.map((z) => (z.id === "z2" ? { ...z, bitis: "2026-10-01" } : z)) };
    const a = otomasyonlariCalistir(k);
    expect(a.program.every((p) => p.bitis === "2026-10-01")).toBe(true);
    expect(a.islemler.length).toBe(k.islemler.length + 1);
    const b = otomasyonlariCalistir(a);
    expect(b.program).toBe(a.program);
    expect(b.islemler.length).toBe(a.islemler.length);
  });
  it("sezonu sürerken otomasyon programa dokunmaz", () => {
    expect(otomasyonlariCalistir(db).program).toBe(db.program);
  });
});
