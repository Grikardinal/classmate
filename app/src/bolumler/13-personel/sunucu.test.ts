/** Bölüm 13 sunucu denetimi: yazmaDenetle → personelDenetle, okumaSuz. Saat parametreyle verilir. */
import { describe, expect, it } from "vitest";
import { ornekVeriUret, type Db, type Personel, type Randevu, type Yoklama } from "@/data/model";
import { farkHesapla, farkUygula } from "@/data/fark";
import { YetkiHatasi, okumaSuz, yazmaDenetle, type Aktor } from "../../../server/politika";
import type { HakedisKaydi } from "@/data/model";
import { odemeAciklamasi } from "./kurallar";

const BUGUN = "2026-11-09";
const ZAMAN = `${BUGUN}T15:00`;
const AY = "2026-10";
const ham = ornekVeriUret();
const db: Db = {
  ...ham,
  yoklamalar: {}, randevular: [], giderler: [], avanslar: [], islemler: [], hakedisDurum: {},
  moduller: { ...ham.moduller, hakedis: true, finans: true },
};
const kisi = (kullaniciId: string, k: Db = db): Aktor => {
  const kullanici = k.kullanicilar.find((x) => x.id === kullaniciId)!;
  return { kullanici, personel: k.personel.find((p) => p.id === kullanici.personelId)! };
};
const rolden = (r: string, personelId?: string) => db.kullanicilar.find((k) => k.rol === r && (!personelId || k.personelId === personelId))!.id;
const YONETICI = kisi("u0");
const MUDUR = kisi("u1"); // Elif: s1
const SEKRETER = kisi(rolden("sekreter", "p9"));
const OGRETMEN = kisi(rolden("ogretmen", "p4"));
const per = (id: string, k: Db = db) => k.personel.find((p) => p.id === id)!;
const dersiz: Db = { ...db, program: db.program.filter((p) => p.ogretmenId !== "p4") };
const YENI_TEL = "0532 777 77 77";

function dene(fn: (x: Db) => void, a: Aktor = YONETICI, kaynak: Db = db) {
  const taslak = { ...kaynak } as Db;
  for (const k of Object.keys(taslak) as (keyof Db)[]) {
    const v = taslak[k];
    if (Array.isArray(v)) (taslak as Record<string, unknown>)[k] = [...v];
  }
  fn(taslak);
  const fark = farkHesapla(kaynak, taslak);
  return () => yazmaDenetle(kaynak, farkUygula(kaynak, fark), fark, a, ZAMAN);
}
const reddedilir = (f: () => unknown, m?: RegExp) => {
  expect(f).toThrow(YetkiHatasi);
  if (m) expect(f).toThrow(m);
};
const kartYaz = (id: string, degisim: Partial<Personel>, a?: Aktor, k: Db = db) => dene((x) => (x.personel = x.personel.map((p) => (p.id === id ? { ...p, ...degisim } : p))), a, k);
const yeniKart = (x: Partial<Personel> = {}): Personel => ({ id: "pY", ad: "Yeni", soyad: "Kişi", gorev: "ogretmen", telefon: YENI_TEL, eposta: "yeni@ornekkurum.com", subeIds: ["s1"], anaSubeId: "s1", dersIds: [], baslangic: BUGUN, aktif: true, ucretTipi: "ders", dersUcreti: 100, sabitUcret: 0, ...x });
const ilk = <T,>(t: { koleksiyonlar: Record<string, { yaz: unknown[] } | undefined> }, k: string) => t.koleksiyonlar[k]!.yaz[0] as T;

describe("okuma: ücret ve kişisel veri", () => {
  it("sekreter ve öğretmen başkasının iletişim ve ücretini görmez, kendininkini görür", () => {
    for (const a of [SEKRETER, OGRETMEN]) {
      const v = okumaSuz(db, a, BUGUN);
      for (const p of v.personel.filter((x) => x.id !== a.personel.id)) expect(p).toMatchObject({ telefon: "", eposta: "", sabitUcret: 0, dersUcreti: 0 });
      expect(v.personel.find((x) => x.id === a.personel.id)!.telefon).toBe(a.personel.telefon);
      expect(v.hakedisDurum).toEqual({});
    }
  });
  it("müdür kapsamındaki öğretmenin ücretini görür; yöneticinin ücretini görmez; başka şube personeli gelmez", () => {
    const k: Db = { ...db, personel: db.personel.map((p) => (p.id === "p0" ? { ...p, sabitUcret: 99000 } : p)) };
    const v = okumaSuz(k, kisi("u1", k), BUGUN);
    expect(v.personel.find((p) => p.id === "p4")!.dersUcreti).toBe(450);
    expect(v.personel.find((p) => p.id === "p0")!.sabitUcret).toBe(0);
    expect(v.personel.some((p) => p.id === "p2")).toBe(false);
  });
  it("avans: 13 yetkisi olmayan yalnızca kendininkini görür", () => {
    const k: Db = { ...db, avanslar: [{ id: "a1", personelId: "p4", tarih: BUGUN, tutar: 5, aciklama: "x", subeId: "s1" }, { id: "a2", personelId: "p6", tarih: BUGUN, tutar: 5, aciklama: "x", subeId: "s1" }] };
    expect(okumaSuz(k, SEKRETER, BUGUN).avanslar).toEqual([]);
    expect(okumaSuz(k, OGRETMEN, BUGUN).avanslar.map((a) => a.id)).toEqual(["a1"]);
    expect(okumaSuz(k, MUDUR, BUGUN).avanslar).toHaveLength(2);
  });
  it("maaş gideri açıklaması ve hak ediş işlem kaydı 13 yetkisi olmayana gitmez", () => {
    const k: Db = {
      ...db,
      giderler: [{ id: "g1", tarih: BUGUN, subeId: "s1", kategori: "Maaş", aciklama: "Ayşe Arslan 2026-10 hak edişi", tutar: 5, kasa: "banka" }],
      islemler: [{ id: "i1", zaman: ZAMAN, kullanici: "x", islem: "Avans", detay: "Ayşe — 5 TL", subeId: "s1" }],
    } as Db;
    const v = okumaSuz(k, SEKRETER, BUGUN);
    expect(v.giderler[0]).toMatchObject({ aciklama: "Personel ödemesi", tutar: 5 });
    expect(v.islemler).toEqual([]);
    expect(okumaSuz(k, MUDUR, BUGUN).giderler[0].aciklama).toContain("Ayşe");
  });
  it("hak ediş durumu şube kapsamıyla süzülür; etüt ücreti yetkisize gitmez", () => {
    const k: Db = { ...db, hakedisDurum: { "2026-09_p4": "odendi", "2026-09_p8": "odendi" }, kurum: { ...db.kurum, etutDersUcreti: 80 }, personel: db.personel.map((p) => (p.id === "p8" ? { ...p, subeIds: ["s2"], anaSubeId: "s2" } : p)) };
    expect(Object.keys(okumaSuz(k, kisi("u1", k), BUGUN).hakedisDurum)).toEqual(["2026-09_p4"]);
    expect(okumaSuz(k, OGRETMEN, BUGUN).kurum.etutDersUcreti).toBeUndefined();
    expect(okumaSuz(k, kisi("u1", k), BUGUN).kurum.etutDersUcreti).toBe(80);
  });
});

describe("personel kartı yazma", () => {
  it("sekreter ve öğretmen kart değiştiremez", () => {
    reddedilir(kartYaz("p4", { ad: "X" }, SEKRETER));
    reddedilir(kartYaz("p4", { ad: "X" }, OGRETMEN));
  });
  it("sunucu alanları doğrular ve temizler", () => {
    reddedilir(dene((x) => x.personel.push(yeniKart({ telefon: "12" }))), /telefon/);
    reddedilir(dene((x) => x.personel.push(yeniKart({ ad: " " }))), /Ad boş/);
    reddedilir(dene((x) => x.personel.push(yeniKart({ dersUcreti: -5 }))), /Ücret/);
    const t = dene((x) => x.personel.push(yeniKart({ ad: "  Yeni   Ad ", telefon: "5327777777", eposta: " YENI@X.COM ", iceAktarmaId: "sahte" })))();
    const s = ilk<Personel>(t, "personel");
    expect(s).toMatchObject({ ad: "Yeni Ad", telefon: YENI_TEL, eposta: "yeni@x.com" });
    expect(s.iceAktarmaId).toBeUndefined();
  });
  it("yinelenen telefon ve e-posta kurum genelinde engellenir (müdürün görmediği şube dahil)", () => {
    reddedilir(dene((x) => x.personel.push(yeniKart({ telefon: per("p2").telefon })), MUDUR), /telefonla/);
    reddedilir(dene((x) => x.personel.push(yeniKart({ eposta: per("p2").eposta.toUpperCase() })), MUDUR), /e-postayla/);
  });
  it("şube kapsamı: başka şube kartı ve kapsam dışına atama reddedilir", () => {
    reddedilir(kartYaz("p2", { ad: "X" }, MUDUR), /kapsam/);
    reddedilir(kartYaz("p6", { subeIds: ["s1", "s2"] }, MUDUR), /kapsam/);
    reddedilir(dene((x) => x.personel.push(yeniKart({ subeIds: ["s2"], anaSubeId: "s2" })), MUDUR), /kapsam/);
  });
  it("yetki yükseltme ve kendi kartı", () => {
    reddedilir(kartYaz("p6", { gorev: "genel-yonetici" }, MUDUR), /Genel yönetici/);
    reddedilir(kartYaz("p1", { sabitUcret: 99999 }, MUDUR), /ücret/);
    reddedilir(kartYaz("p1", { gorev: "sekreter" }, MUDUR), /görevinizi/);
    expect(kartYaz("p1", { telefon: YENI_TEL }, MUDUR)).not.toThrow();
  });
  it("maskeli ücret yazılırken korunur (02 yetkili, 13 yetkisiz aktör eski ücreti silemez)", () => {
    const k: Db = { ...db, rolYetkileri: { ...db.rolYetkileri, "sube-muduru": { ...db.rolYetkileri["sube-muduru"], "13": false, "02": true } } };
    const t = kartYaz("p9", { ad: "Yeni", telefon: "", eposta: "", sabitUcret: 0 }, kisi("u1", k), k)();
    expect(ilk<Personel>(t, "personel")).toMatchObject({ ad: "Yeni", telefon: per("p9").telefon, eposta: per("p9").eposta, sabitUcret: per("p9").sabitUcret });
  });
  it("dersi olan öğretmen pasife alınamaz; dersi yoksa hesap da kapanır", () => {
    reddedilir(kartYaz("p4", { aktif: false }), /dersi var/);
    const t = kartYaz("p4", { aktif: false }, YONETICI, dersiz)();
    expect(t.koleksiyonlar.kullanicilar!.yaz).toEqual([expect.objectContaining({ personelId: "p4", aktif: false })]);
  });
  it("planlı etüdü olan öğretmen pasife alınamaz", () => {
    const r = { id: "r1", ogretmenId: "p4", subeId: "s1", tarih: "2026-11-10", bas: "14:00", bit: "14:40", tur: "bireysel", ogrenciIds: [], dersId: "l2", durum: "planli", link: "", paketId: null, olusturan: "yonetim" } as Randevu;
    reddedilir(kartYaz("p4", { aktif: false }, YONETICI, { ...dersiz, randevular: [r] }), /etüt/);
  });
  it("silme: elle silinemez; bağlı kaydı olan içe aktarılan personel de silinemez", () => {
    reddedilir(dene((x) => (x.personel = x.personel.filter((p) => p.id !== "p6"))), /silinemez/);
    const k: Db = { ...db, personel: [...db.personel, yeniKart({ iceAktarmaId: "ip1" })] };
    expect(dene((x) => (x.personel = x.personel.filter((p) => p.id !== "pY")), YONETICI, k)).not.toThrow();
    const bagli: Db = { ...k, avanslar: [{ id: "a1", personelId: "pY", tarih: BUGUN, tutar: 5, aciklama: "x", subeId: "s1" }] };
    reddedilir(dene((x) => (x.personel = x.personel.filter((p) => p.id !== "pY")), YONETICI, bagli), /pasife/);
  });
});

describe("avans", () => {
  const paket = (x: Db, tutar = 100, gider: Partial<Db["giderler"][number]> = {}, av: Partial<Db["avanslar"][number]> = {}) => {
    x.avanslar.push({ id: "a1", personelId: "p4", tarih: "2000-01-01", tutar, aciklama: " Avans ", subeId: "s1", giderId: "g1", ...av });
    x.giderler.push({ id: "g1", tarih: BUGUN, subeId: "s1", kategori: "Maaş", aciklama: "Ayşe avans", tutar, kasa: "nakit", ...gider });
  };
  it("tarih sunucudan, açıklama temiz", () => expect(ilk<{ tarih: string; aciklama: string }>(dene((x) => paket(x), MUDUR)(), "avanslar")).toMatchObject({ tarih: BUGUN, aciklama: "Avans" }));
  it("gidersiz, farklı tutarlı, başka şubeye avans reddedilir", () => {
    reddedilir(dene((x) => x.avanslar.push({ id: "a1", personelId: "p4", tarih: BUGUN, tutar: 5, aciklama: "", subeId: "s1" }), MUDUR), /gideri/);
    reddedilir(dene((x) => paket(x, 100, { tutar: 90 }), MUDUR), /gideri/);
    reddedilir(dene((x) => paket(x, 100, {}, { subeId: "s2" })), /ana şube/);
  });
  it("sekreter avans yazamaz; müdür çok şubeli öğretmene yazamaz", () => {
    reddedilir(dene((x) => paket(x), SEKRETER));
    reddedilir(dene((x) => paket(x, 100, {}, { personelId: "p5" }), MUDUR), /genel yönetici/);
  });
  it("hak ediş modülü kapalıyken yazılamaz; değiştirilemez, silinemez", () => {
    reddedilir(dene((x) => paket(x), YONETICI, { ...db, moduller: { ...db.moduller, hakedis: false } }), /modülleri/);
    const k: Db = { ...db, avanslar: [{ id: "a1", personelId: "p4", tarih: BUGUN, tutar: 5, aciklama: "x", subeId: "s1" }] };
    reddedilir(dene((x) => (x.avanslar = [{ ...x.avanslar[0], tutar: 1 }]), YONETICI, k), /değiştirilemez/);
    reddedilir(dene((x) => (x.avanslar = []), YONETICI, k), /silinemez/);
  });
});

describe("hak ediş durumu ve ödeme", () => {
  const oturum = `pr_${AY}-06`;
  const yok = { oturumId: oturum, satirId: "pr", grupId: db.program.find((p) => p.ogretmenId === "p4")!.grupId, tarih: `${AY}-06`, ogretmenId: "p4", konu: "", durumlar: {}, kayitZamani: "" } as Yoklama;
  const onayli: Db = { ...db, yoklamalar: { [oturum]: yok }, hakedisDurum: { [`${AY}_p4`]: "onaylandi" } };
  const durum = (k: string, v: "onaylandi" | "odendi") => (x: Db) => (x.hakedisDurum = { ...x.hakedisDurum, [k]: v });
  const giderli = (tutar: number) => (x: Db) => {
    durum(`${AY}_p4`, "odendi")(x);
    x.giderler.push({ id: "g1", tarih: BUGUN, subeId: "s1", kategori: "Maaş", aciklama: odemeAciklamasi(per("p4"), AY), tutar, kasa: "banka" });
  };
  it("müdür kapsamındakini onaylar; bu ay ve başka şube reddedilir", () => {
    expect(dene(durum(`${AY}_p4`, "onaylandi"), MUDUR)).not.toThrow();
    reddedilir(dene(durum("2026-11_p4", "onaylandi"), MUDUR), /Ay bitmeden/);
    reddedilir(dene(durum(`${AY}_p5`, "onaylandi"), MUDUR), /genel yönetici/);
  });
  it("ödeme: yalnızca genel yönetici, hesaplanan tutarla", () => {
    expect(dene(giderli(450), YONETICI, onayli)).not.toThrow();
    reddedilir(dene(giderli(1), YONETICI, onayli), /uyuşmuyor/);
    reddedilir(dene(durum(`${AY}_p4`, "odendi"), YONETICI, onayli), /uyuşmuyor/);
    reddedilir(dene(giderli(450), MUDUR, onayli), /genel yönetici/);
  });
  it("etüt ücreti ödemeye girer", () => {
    const r = { id: "r1", ogretmenId: "p4", subeId: "s1", tarih: `${AY}-07`, bas: "14:00", bit: "14:40", tur: "bireysel", ogrenciIds: [], dersId: "l2", durum: "yapildi", link: "", paketId: null, olusturan: "yonetim" } as Randevu;
    const k: Db = { ...onayli, randevular: [r], kurum: { ...db.kurum, etutDersUcreti: 50 } };
    expect(dene(giderli(500), YONETICI, k)).not.toThrow();
    reddedilir(dene(giderli(450), YONETICI, k), /uyuşmuyor/);
  });
  it("geri alınamaz; müdürün yazması görmediği satırları silmez", () => {
    reddedilir(dene((x) => (x.hakedisDurum = {}), YONETICI, onayli), /geri alınamaz/);
    const k: Db = { ...db, personel: db.personel.map((p) => (p.id === "p8" ? { ...p, subeIds: ["s2"], anaSubeId: "s2" } : p)), hakedisDurum: { "2026-09_p8": "odendi" } };
    const f = { koleksiyonlar: {}, tekil: { hakedisDurum: { [`${AY}_p4`]: "onaylandi" } } };
    const t = yazmaDenetle(k, farkUygula(k, f), f, kisi("u1", k), ZAMAN);
    expect(t.tekil.hakedisDurum).toEqual({ "2026-09_p8": "odendi", [`${AY}_p4`]: { durum: "onaylandi" } });
  });
  it("sekreter durum yazamaz; finans kapalıyken onay yok", () => {
    reddedilir(dene(durum(`${AY}_p4`, "onaylandi"), SEKRETER));
    reddedilir(dene(durum(`${AY}_p4`, "onaylandi"), YONETICI, { ...db, moduller: { ...db.moduller, finans: false } }), /modülleri/);
  });
});

describe("ek kararlar 2026-11-09", () => {
  const oturum = `pr_${AY}-06`;
  const yok = { oturumId: oturum, satirId: "pr", grupId: db.program.find((p) => p.ogretmenId === "p4")!.grupId, tarih: `${AY}-06`, ogretmenId: "p4", konu: "", durumlar: {}, kayitZamani: "" } as Yoklama;
  const onayli: Db = { ...db, yoklamalar: { [oturum]: yok }, hakedisDurum: { [`${AY}_p4`]: "onaylandi" } };
  const aciklama = odemeAciklamasi(per("p4"), AY);
  const ode = (x: Db) => {
    x.hakedisDurum = { ...x.hakedisDurum, [`${AY}_p4`]: "odendi" };
    x.giderler.push({ id: "g1", tarih: BUGUN, subeId: "s1", kategori: "Maaş", aciklama, tutar: 450, kasa: "banka" });
  };
  const durumu = (t: { tekil: Record<string, unknown> }, k = `${AY}_p4`) => (t.tekil.hakedisDurum as Record<string, HakedisKaydi>)[k];

  it("ödemede tutar sunucuda dondurulur; istemcinin donmus alanı dikkate alınmaz", () => {
    const t = dene((x) => { ode(x); x.hakedisDurum[`${AY}_p4`] = { durum: "odendi", donmus: { tutar: 1 } as never }; }, YONETICI, onayli)();
    expect(durumu(t).donmus).toMatchObject({ tutar: 450, dersSayisi: 1, birimDers: 450, odenecek: 450, giderIds: ["g1"], aktarilan: 0 });
  });
  const odenmis = (): Db => {
    const t = dene(ode, YONETICI, onayli)();
    return { ...onayli, hakedisDurum: t.tekil.hakedisDurum as Db["hakedisDurum"], giderler: t.koleksiyonlar.giderler!.yaz as unknown as Db["giderler"] };
  };
  const iptal = (x: Db, neden = "yanlış ödeme") => (x.giderler = x.giderler.map((g) => (g.id === "g1" ? { ...g, iptal: { neden, kullanici: "sahte", zaman: "x" } } : g)));
  it("gider iptal edilince onaylandıya döner, dondurulan tutar silinir", () => {
    const t = dene(iptal, YONETICI, odenmis())();
    expect(durumu(t).durum).toBe("onaylandi");
    expect(durumu(t).donmus).toBeUndefined();
  });
  it("finansın iptal kuralı korunur: gerekçesiz iptal reddedilir, sekreter iptal edemez", () => {
    reddedilir(dene((x) => iptal(x, "a"), YONETICI, odenmis()), /gerekçesi/);
    reddedilir(dene(iptal, SEKRETER, odenmis()), /yönetici/);
  });
  it("çok şubeli ödemede diğer şube gideri de iptal olur; kapsam dışıysa müdür iptal edemez", () => {
    const k = odenmis();
    const iki: Db = { ...k, giderler: [...k.giderler, { id: "g2", tarih: BUGUN, subeId: "s2", kategori: "Maaş", aciklama, tutar: 10, kasa: "banka" }], hakedisDurum: { [`${AY}_p4`]: { ...(k.hakedisDurum[`${AY}_p4`] as HakedisKaydi) } } };
    const t = dene(iptal, YONETICI, iki)();
    expect(t.koleksiyonlar.giderler!.yaz.map((g) => g.id).sort()).toEqual(["g1", "g2"]);
    expect((t.koleksiyonlar.giderler!.yaz.find((g) => g.id === "g2") as { iptal?: unknown }).iptal).toBeTruthy();
    reddedilir(dene(iptal, MUDUR, iki), /genel yönetici/);
  });
  it("elle düzeltme: kim, ne zaman sunucudan; işlem kaydına yazılır; ödenmiş ayda yok", () => {
    const yaz = (x: Db) => (x.hakedisDurum = { ...x.hakedisDurum, [`${AY}_p4`]: { durum: "onaylandi", duzeltme: { tutar: 100, neden: " ay ortası ", kullanici: "sahte", zaman: "x" } } });
    const t = dene(yaz, YONETICI, onayli)();
    expect(durumu(t).duzeltme).toEqual({ tutar: 100, neden: "ay ortası", kullanici: "Ahmet Er", zaman: ZAMAN });
    expect(t.koleksiyonlar.islemler!.yaz[0]).toMatchObject({ islem: "Hak ediş düzeltmesi", kullanici: "Ahmet Er", subeId: "s1" });
    reddedilir(dene(yaz, YONETICI, odenmis()), /Ödenmiş/);
    reddedilir(dene(yaz, SEKRETER, onayli));
  });
  it("Hak edişim: yalnızca öğretmene ve yalnızca kendi verisi; yazma yok", () => {
    const v = okumaSuz(onayli, OGRETMEN, BUGUN);
    expect(v.hakedisim!.find((r) => r.ay === AY)).toMatchObject({ durum: "onaylandi", dersSayisi: 1, odenecek: 450 });
    expect(v.hakedisDurum).toEqual({});
    expect(okumaSuz(onayli, kisi(rolden("ogretmen", "p6")), BUGUN).hakedisim!.find((r) => r.ay === AY)?.dersSayisi ?? 0).toBe(0);
    expect(okumaSuz(onayli, MUDUR, BUGUN).hakedisim).toBeUndefined();
    expect(okumaSuz({ ...onayli, moduller: { ...onayli.moduller, hakedis: false } }, OGRETMEN, BUGUN).hakedisim).toBeUndefined();
    reddedilir(dene((x) => (x.hakedisDurum = { ...x.hakedisDurum, [`${AY}_p4`]: "odendi" }), OGRETMEN, onayli));
  });
  it("yedekle alınan ders hak edişte yedeğe yazılır", () => {
    const k: Db = { ...db, yoklamalar: { [oturum]: { ...yok, ogretmenId: "p7" } } };
    expect(okumaSuz(k, kisi(rolden("ogretmen", "p7")), BUGUN).hakedisim!.find((r) => r.ay === AY)?.dersSayisi).toBe(1);
    expect(okumaSuz(k, OGRETMEN, BUGUN).hakedisim!.find((r) => r.ay === AY)?.dersSayisi ?? 0).toBe(0);
  });
});

describe("etüt ücreti ayarı", () => {
  const ayar = (u: unknown) => (x: Db) => (x.kurum = { ...x.kurum, etutDersUcreti: u as number });
  it("genel yönetici değiştirir, müdür değiştiremez, geçersiz değer reddedilir", () => {
    expect(dene(ayar(75.5))).not.toThrow();
    reddedilir(dene(ayar(75.5), MUDUR), /genel yönetici|yetkiniz/);
    reddedilir(dene(ayar(-1)), /pozitif/);
  });
});
