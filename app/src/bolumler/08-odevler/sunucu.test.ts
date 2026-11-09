/**
 * Bölüm 08 sunucu denetimi (server/politika.ts · yazmaDenetle → odevDenetle, okumaSuz, veliVerisi).
 * Örnek veri üzerinde istemcinin göndereceği değişiklik paketleriyle sınanır. Saat sabittir.
 */
import { describe, expect, it } from "vitest";
import { ornekVeriUret, type Db, type Gonderim, type Odev, type ProgramSatiri } from "@/data/model";
import { farkHesapla, farkUygula } from "@/data/fark";
import { veriyiOnar } from "../../../server/veritabani";
import { YetkiHatasi, okumaSuz, veliVerisi, yazmaDenetle, type Aktor } from "../../../server/politika";

const BUGUN = "2026-11-09";
const ZAMAN = `${BUGUN}T15:00`;
const YARIN = "2026-11-10";
const ham = ornekVeriUret();
const db: Db = {
  ...ham,
  odevler: [],
  gonderimler: [],
  moduller: { ...ham.moduller, odev: true },
  gruplar: ham.gruplar.map((g) => (g.id === "g1" ? { ...g, rehberId: "pRehberYok" } : g)),
  program: ham.program.map((p) => ({ ...p, baslangic: "2026-09-01" })),
  kayitlar: ham.kayitlar.map((k) => ({ ...k, tarih: "2026-09-01", grupGecmisi: [{ grupId: k.grupId, tarih: "2026-09-01" }] })),
};
const kisi = (kullaniciId: string): Aktor => {
  const kullanici = db.kullanicilar.find((k) => k.id === kullaniciId)!;
  return { kullanici, personel: db.personel.find((p) => p.id === kullanici.personelId)! };
};
const ogretmenOl = (id: string) => kisi(db.kullanicilar.find((x) => x.rol === "ogretmen" && x.personelId === id)!.id);
const YONETICI = kisi("u0");
const MUDUR = kisi("u1"); // yalnızca s1
const OGRETMEN = ogretmenOl("p4");
const DERS = db.program.find((p) => p.id === "ps1")!.dersId;
const g1 = db.kayitlar.filter((k) => k.grupId === "g1" && k.durum === "aktif").map((k) => k.ogrenciId);
const [OGR, OGR2] = g1;
const VELI = db.ogrenciler.find((o) => o.id === OGR)!.birincilVeliId;
const p4Gruplari = new Set(db.program.filter((p) => p.ogretmenId === "p4").map((p) => p.grupId));
const BASKA_GRUP = db.gruplar.find((g) => g.subeId === "s1" && !p4Gruplari.has(g.id) && g.rehberId !== "p4")!;
const S2_GRUP = db.gruplar.find((g) => g.subeId === "s2")!;

const odev = (p: Partial<Odev> = {}): Odev => ({ id: "odX", ogretmenId: "p4", dersId: DERS, grupId: "g1", ogrenciIds: null, baslik: " Kesirler ", aciklama: "", kaynak: "", verilis: BUGUN, teslim: "2026-11-12", teslimler: {}, notlar: {}, kontrolEdildi: false, ...p });
const vadesi = (p: Partial<Odev> = {}) => odev({ verilis: "2026-11-02", teslim: "2026-11-08", baslik: "Kesirler", ...p });
const gonderim = (id: string, p: Partial<Gonderim> = {}): Gonderim => ({ id, zaman: "x", olay: "odevYapmadi", veliId: VELI, alici: "a", ogrenciId: OGR, subeId: "s1", kanal: "push", metin: "metin", durum: "bekliyor", maliyet: 0, ...p });

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
const yeni = (o: Odev, a?: Aktor, k?: Db) => dene((x) => x.odevler.push(o), a, k);
const degistir = (kaynak: Odev, p: Partial<Odev>, a?: Aktor, k: Db = { ...db, odevler: [kaynak] }, ek?: (x: Db) => void) =>
  dene((x) => {
    x.odevler = x.odevler.map((o) => (o.id === kaynak.id ? { ...o, ...p } : o));
    ek?.(x);
  }, a, k);
const sil = (o: Odev, a?: Aktor, k: Db = { ...db, odevler: [o] }) => dene((x) => (x.odevler = x.odevler.filter((y) => y.id !== o.id)), a, k);
const reddedilir = (f: () => unknown, mesaj?: RegExp) => {
  expect(f).toThrow(YetkiHatasi);
  if (mesaj) expect(f).toThrow(mesaj);
};
const yazilan = (f: ReturnType<typeof dene>) => f().koleksiyonlar.odevler!.yaz[0] as unknown as Odev;
const gonderimler = (f: ReturnType<typeof dene>) => (f().koleksiyonlar.gonderimler?.yaz ?? []) as unknown as Gonderim[];
const KAPALI: Db = { ...db, moduller: { ...db.moduller, odev: false } };

describe("yetki ve modül", () => {
  it("öğretmen kendi grubuna ödev verir", () => expect(yeni(odev())).not.toThrow());
  it("modül kapalıyken yazma, kontrol, silme reddedilir", () => {
    reddedilir(yeni(odev(), YONETICI, KAPALI), /kapalı/);
    const v = vadesi();
    reddedilir(degistir(v, { teslimler: { [OGR]: "yapti" }, kontrolEdildi: true }, MUDUR, { ...KAPALI, odevler: [v] }), /kapalı/);
    reddedilir(sil(v, YONETICI, { ...KAPALI, odevler: [v] }), /kapalı/);
  });
  it("öğretmen kendi ogretmenId'si ile başka gruba yazamaz", () => reddedilir(yeni(odev({ grupId: BASKA_GRUP.id })), /kendi grup/));
  it("öğretmen başkasının ödevini sahiplenemez, değiştiremez, silemez", () => {
    const b = vadesi({ ogretmenId: "p7" });
    reddedilir(degistir(b, { ogretmenId: "p4" }), /yalnızca teslim kontrolü/);
    reddedilir(degistir(vadesi({ ogretmenId: "p7", dersId: "dersYok" }), { baslik: "x" }), /kendi ödev/);
    reddedilir(sil(b), /kendi/);
  });
  it("dersi devralan öğretmen kontrol eder; ogretmenId değişmez, kontrol tarihi sunucudan", () => {
    const b = vadesi({ ogretmenId: "p7" });
    expect(yazilan(degistir(b, { teslimler: { [OGR]: "yapti" }, kontrolEdildi: true, kontrolTarihi: "2030-01-01" }))).toMatchObject({ ogretmenId: "p7", kontrolTarihi: BUGUN });
    reddedilir(degistir(b, { baslik: "Yeni", teslimler: { [OGR]: "yapti" }, kontrolEdildi: true }), /yalnızca teslim kontrolü/);
  });
  it("rehber başka dersten ödev veremez ama grubu görür", () => {
    const k: Db = { ...db, gruplar: db.gruplar.map((g) => (g.id === "g1" ? { ...g, rehberId: "p7" } : g)) };
    reddedilir(yeni(odev({ ogretmenId: "p7" }), ogretmenOl("p7"), k), /kendi dersiniz/);
  });
  it("öğretmen 7 günden eski kontrolü düzeltemez, müdür düzeltir", () => {
    const v = vadesi({ kontrolEdildi: true, kontrolTarihi: "2026-11-01", teslimler: { [OGR]: "yapti" } });
    reddedilir(degistir(v, { teslimler: { [OGR]: "eksik" } }), /7 günden eski/);
    expect(degistir(v, { teslimler: { [OGR]: "eksik" } }, MUDUR)).not.toThrow();
  });
  it("grubu devreden öğretmen ödevini değiştiremez, silemez ve görmez (karar 2026-11-08)", () => {
    const k: Db = { ...db, program: db.program.map((p) => (p.ogretmenId === "p4" && p.grupId === "g1" ? { ...p, bitis: "2026-11-01" } : p)), odevler: [vadesi()] };
    reddedilir(degistir(k.odevler[0], { teslimler: { [OGR]: "yapti" }, kontrolEdildi: true }, OGRETMEN, k), /kendi grup/);
    reddedilir(sil(k.odevler[0], OGRETMEN, k), /kendi/);
    expect(okumaSuz(k, OGRETMEN, BUGUN).odevler).toEqual([]);
  });
  it("rehber grubun ödevini görür", () => {
    const k: Db = { ...db, gruplar: db.gruplar.map((g) => (g.id === "g1" ? { ...g, rehberId: "p7" } : g)), odevler: [vadesi()] };
    expect(okumaSuz(k, ogretmenOl("p7"), BUGUN).odevler).toHaveLength(1);
  });
  it("şube kapsamı dışına yazılamaz, genel yönetici yazar", () => {
    reddedilir(yeni(odev({ grupId: S2_GRUP.id, dersId: db.program.find((p) => p.grupId === S2_GRUP.id)!.dersId }), MUDUR), /kapsam/);
    expect(yeni(odev({ grupId: S2_GRUP.id, dersId: db.program.find((p) => p.grupId === S2_GRUP.id)!.dersId }), YONETICI)).not.toThrow();
  });
  it("kontrol edilmiş ödevi öğretmen silemez, yönetici siler", () => {
    const v = vadesi({ kontrolEdildi: true, teslimler: { [OGR]: "yapti" } });
    reddedilir(sil(v), /yönetici/);
    expect(sil(v, MUDUR)).not.toThrow();
  });
});

describe("alanlar", () => {
  it("boş başlık, geçersiz ve geçmiş teslim tarihi", () => {
    reddedilir(yeni(odev({ baslik: "  " })), /boş/);
    reddedilir(yeni(odev({ teslim: "2026-13-01" })), /Geçersiz/);
    reddedilir(yeni(odev({ teslim: "2026-11-08" })), /önce/);
  });
  it("var olmayan grup ve grubun almadığı ders", () => {
    reddedilir(yeni(odev({ grupId: "yok" }), YONETICI), /Grup/);
    reddedilir(yeni(odev({ dersId: "yok" }), YONETICI), /Ders/);
    const baska = db.dersler.find((x) => !db.program.some((p) => p.grupId === "g1" && p.dersId === x.id))!;
    reddedilir(yeni(odev({ dersId: baska.id }), YONETICI), /almıyor/);
  });
  it("öğretmen aynı gruptaki başka öğretmenin dersini veremez", () => {
    const satir: ProgramSatiri = { ...db.program.find((p) => p.id === "ps1")!, id: "psB", ogretmenId: "p7", dersId: "lB" };
    const k: Db = { ...db, program: [...db.program, satir], dersler: [...db.dersler, { ...db.dersler[0], id: "lB" }] };
    reddedilir(yeni(odev({ dersId: "lB" }), OGRETMEN, k), /kendi dersiniz/);
  });
  it("öğretmen, veriliş ve teslim alanları sunucudan yazılır", () => {
    const s = yazilan(yeni(odev({ verilis: "2020-01-01", teslimler: { [OGR]: "yapti" }, notlar: { [OGR]: "x" }, kontrolEdildi: true })));
    expect(s).toMatchObject({ baslik: "Kesirler", ogretmenId: "p4", verilis: BUGUN, teslimler: {}, notlar: {}, kontrolEdildi: false });
  });
  it("yöneticinin verdiği ödevin öğretmeni programdan gelir", () => expect(yazilan(yeni(odev({ ogretmenId: "p0-sahte" }), MUDUR)).ogretmenId).toBe("p4"));
  it("güncellemede öğretmen ve veriliş değişmez, grup taşınamaz", () => {
    const v = vadesi();
    expect(yazilan(degistir(v, { ogretmenId: "p7", verilis: BUGUN }, MUDUR))).toMatchObject({ ogretmenId: "p4", verilis: "2026-11-02" });
    reddedilir(degistir(v, { grupId: BASKA_GRUP.id }, MUDUR), /grubu/);
  });
});

describe("teslim kontrolü", () => {
  const isaret = { teslimler: { [OGR]: "yapti", [OGR2]: "eksik" }, kontrolEdildi: true } as Partial<Odev>;
  it("kendi ödevini işaretler", () => expect(degistir(vadesi(), isaret)).not.toThrow());
  it("grupta olmayan öğrenci ve geçersiz durum reddedilir", () => {
    reddedilir(degistir(vadesi(), { teslimler: { yabanci: "yapti" }, kontrolEdildi: true }), /hedefinde/);
    reddedilir(degistir(vadesi(), { teslimler: { [OGR]: "x" as "yapti" }, kontrolEdildi: true }), /Geçersiz/);
  });
  it("teslim tarihi gelmeden işaretlenemez", () => reddedilir(degistir(odev(), isaret), /gelmeden/));
  it("kontrol geri alınamaz", () => {
    const v = vadesi({ kontrolEdildi: true, teslimler: { [OGR]: "yapti" } });
    reddedilir(degistir(v, { kontrolEdildi: false }), /geri alınamaz/);
  });
  it("gruptan ayrılan öğrencinin eski durumu korunur", () => {
    const v = vadesi({ kontrolEdildi: true, teslimler: { ayrilan: "eksik" }, notlar: { ayrilan: "not" } });
    expect(yazilan(degistir(v, { teslimler: { [OGR]: "yapti" }, notlar: {} }))).toMatchObject({ teslimler: { ayrilan: "eksik", [OGR]: "yapti" }, notlar: { ayrilan: "not" } });
  });
});

describe("bildirim", () => {
  const yapmadi = { teslimler: { [OGR]: "yapmadi" }, kontrolEdildi: true } as Partial<Odev>;
  const ekle = (g: Gonderim) => (x: Db) => x.gonderimler.push(g);
  it("yeni ödev bildirimi ödeve bağlanır; hedef dışına gitmez", () => {
    const f = dene((x) => {
      x.odevler.push(odev({ ogrenciIds: [OGR2] }));
      x.gonderimler.push(gonderim("g1", { olay: "yeniOdev", ogrenciId: OGR2, veliId: db.ogrenciler.find((o) => o.id === OGR2)!.veliIds[0] }), gonderim("g2", { olay: "yeniOdev", ogrenciId: OGR }));
    });
    const l = gonderimler(f);
    expect(l.map((g) => g.id)).toEqual(["g1"]);
    expect(l[0].odevId).toBe("odX");
  });
  it("modül kapalıyken ödev bildirimi kuyruğa girmez", () => expect(gonderimler(dene(ekle(gonderim("g1", { olay: "odevHatirlatma" })), MUDUR, KAPALI))).toEqual([]));
  it("yapmadı bildirimi aynı ödev için ikinci kez gitmez", () => {
    const v = vadesi();
    expect(gonderimler(degistir(v, yapmadi, OGRETMEN, undefined, ekle(gonderim("g1"))))[0].odevId).toBe(v.id);
    const k: Db = { ...db, odevler: [v], gonderimler: [gonderim("eski", { odevId: v.id, durum: "iletildi" })] };
    expect(gonderimler(degistir(v, yapmadi, OGRETMEN, k, ekle(gonderim("g2"))))).toEqual([]);
  });
  it("aynı başlıklı başka ödevin bildirimi engellenmez", () => {
    const v = vadesi();
    const k: Db = { ...db, odevler: [v], gonderimler: [gonderim("eski", { odevId: "baska", durum: "iletildi" })] };
    expect(gonderimler(degistir(v, yapmadi, OGRETMEN, k, ekle(gonderim("g2"))))).toHaveLength(1);
  });
  it("işaretlenmemiş öğrenci için yapmadı bildirimi yazılamaz", () => expect(gonderimler(dene(ekle(gonderim("g1"))))).toEqual([]));
  it("yapmadı kaldırılınca gitmemiş bildirim silinir, gitmiş kalır", () => {
    const v = vadesi({ kontrolEdildi: true, teslimler: { [OGR]: "yapmadi", [OGR2]: "yapmadi" } });
    const k: Db = { ...db, odevler: [v], gonderimler: [gonderim("a", { odevId: v.id }), gonderim("b", { odevId: v.id, ogrenciId: OGR2, durum: "iletildi" })] };
    const f = degistir(v, { teslimler: { [OGR]: "yapti", [OGR2]: "yapti" } }, OGRETMEN, k);
    expect(f().koleksiyonlar.gonderimler!.sil).toEqual(["a"]);
  });
  describe("düzeltme mesajı", () => {
    const v = vadesi({ kontrolEdildi: true, teslimler: { [OGR]: "yapmadi" } });
    const calistir = (gs: Gonderim[], k: Partial<Db> = {}) => degistir(v, { teslimler: { [OGR]: "yapti" } }, OGRETMEN, { ...db, odevler: [v], gonderimler: gs, ...k })().koleksiyonlar.gonderimler;
    const gitmis = gonderim("a", { odevId: v.id, durum: "iletildi" });
    it("gitmiş bildirime veliye tek düzeltme gider", () => {
      const s = calistir([gitmis])!;
      expect(s.sil).toEqual([]);
      const l = s.yaz as unknown as Gonderim[];
      expect(l).toHaveLength(1);
      expect(l[0]).toMatchObject({ olay: "odevDuzeltme", veliId: VELI, ogrenciId: OGR, odevId: v.id, subeId: "s1" });
    });
    it("gitmemiş bildirimde düzeltme gitmez, kuyruktan silinir", () => {
      const s = calistir([gonderim("a", { odevId: v.id, durum: "bekliyor" })])!;
      expect(s.sil).toEqual(["a"]);
      expect(s.yaz).toEqual([]);
    });
    it("düzeltme ikinci kez gitmez", () => expect(calistir([gitmis, gonderim("d", { olay: "odevDuzeltme", odevId: v.id, durum: "iletildi" })])).toBeUndefined());
    it("başka ödevin bildirimi sayılmaz", () => expect(calistir([gonderim("a", { odevId: "baska", durum: "iletildi" })])).toBeUndefined());
    it("olay kapalıysa gitmez; SMS izni kapalıysa push olur", () => {
      expect(calistir([gitmis], { olaylar: db.olaylar.map((o) => (o.key === "odevDuzeltme" ? { ...o, aktif: false } : o)) })!.yaz).toEqual([]);
      const sms = calistir([gitmis], { olaylar: db.olaylar.map((o) => (o.key === "odevDuzeltme" ? { ...o, kanal: "sms" as const } : o)), veliler: db.veliler.map((x) => (x.id === VELI ? { ...x, izinSms: false } : x)) })!;
      expect(sms.yaz[0]).toMatchObject({ kanal: "push", maliyet: 0 });
    });
    it("istemci düzeltme mesajı yazamaz", () => expect(gonderimler(dene(ekle(gonderim("g1", { olay: "odevDuzeltme" }))))).toEqual([]));
    it("eski veriye olay eklenir", () => expect(veriyiOnar({ ...db, olaylar: db.olaylar.filter((o) => o.key !== "odevDuzeltme") }).olaylar.map((o) => o.key)).toContain("odevDuzeltme"));
  });
  it("hatırlatma aynı ödev için bir kez, başkasının ödevine öğretmenden gitmez", () => {
    const y = odev({ teslim: YARIN, baslik: "Y" });
    const k: Db = { ...db, odevler: [y] };
    expect(gonderimler(dene(ekle(gonderim("g1", { olay: "odevHatirlatma" })), OGRETMEN, k))[0].odevId).toBe(y.id);
    const gitti: Db = { ...k, gonderimler: [gonderim("e", { olay: "odevHatirlatma", odevId: y.id, durum: "iletildi" })] };
    expect(gonderimler(dene(ekle(gonderim("g2", { olay: "odevHatirlatma" })), OGRETMEN, gitti))).toEqual([]);
    const baska: Db = { ...db, odevler: [{ ...y, ogretmenId: "p7" }] };
    expect(gonderimler(dene(ekle(gonderim("g3", { olay: "odevHatirlatma" })), OGRETMEN, baska))).toEqual([]);
  });
  it("SMS izni kapalı veliye SMS gitmez", () => {
    const v = vadesi();
    const k: Db = { ...db, odevler: [v], veliler: db.veliler.map((x) => (x.id === VELI ? { ...x, izinSms: false } : x)) };
    expect(gonderimler(degistir(v, yapmadi, OGRETMEN, k, ekle(gonderim("g1", { kanal: "sms", maliyet: 1 }))))[0]).toMatchObject({ kanal: "push", maliyet: 0 });
  });
});

describe("veli portalı", () => {
  const k: Db = { ...db, odevler: [vadesi({ teslimler: { [OGR]: "yapti", [OGR2]: "eksik" }, notlar: { [OGR2]: "gizli" } }), vadesi({ id: "odY", ogrenciIds: [OGR2] })] };
  it("yalnızca kendi çocuğunun ödevini ve durumunu görür", () => {
    if (db.ogrenciler.find((o) => o.id === OGR2)!.veliIds.includes(VELI)) return;
    const l = veliVerisi(k, VELI).odevler;
    expect(l.map((o) => o.id)).toEqual(["odX"]);
    expect(l[0].teslimler).toEqual({ [OGR]: "yapti" });
    expect(l[0].notlar).toEqual({});
  });
  it("modül kapalıyken ödev gitmez", () => expect(veliVerisi({ ...k, moduller: KAPALI.moduller }, VELI).odevler).toEqual([]));
});
