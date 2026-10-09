import { describe, expect, it } from "vitest";
import { aktifKayit, bildirimEkle, grupDoluluk, hedefVeliler, ornekVeriUret, oturumlar, saat, grup, tanimKaynagi, type Db } from "./model";
import { cakismaBul, dakika, type Slot } from "@/lib/kurallar";

const d = ornekVeriUret();
tanimKaynagi(d);
const getDb = () => d;
const guncelle = (fn: (x: Db) => void) => fn(d);

describe("örnek veri tutarlılığı", () => {
  it("her öğrencinin aktif kaydı ve en az bir velisi var", () => {
    for (const o of d.ogrenciler) {
      expect(aktifKayit(d, o.id), o.ad).toBeTruthy();
      expect(o.veliIds.length).toBeGreaterThan(0);
      expect(o.veliIds).toContain(o.birincilVeliId);
      for (const v of o.veliIds) expect(d.veliler.some((x) => x.id === v)).toBe(true);
    }
  });
  it("sözleşme numaraları benzersiz ve şube koduyla başlıyor", () => {
    const nolar = d.kayitlar.map((k) => k.sozlesmeNo);
    expect(new Set(nolar).size).toBe(nolar.length);
    for (const k of d.kayitlar) expect(k.sozlesmeNo.startsWith(k.subeId === "s1" ? "MRK-" : "KZY-")).toBe(true);
  });
  it("veli telefonları benzersiz (giriş telefonla yapılıyor)", () => {
    const t = d.veliler.map((v) => v.telefon);
    expect(new Set(t).size).toBe(t.length);
  });
  it("grup doluluğu kapasiteyi aşmıyor", () => {
    for (const g of d.gruplar) expect(grupDoluluk(d, g.id)).toBeLessThanOrEqual(g.kapasite);
  });
  it("haftalık programda öğretmen / derslik / grup çakışması yok", () => {
    const slotlar: Slot[] = d.program.map((p) => {
      const h = saat(p.saatId)!;
      return { id: p.id, gun: p.gun, bas: dakika(h.baslangic), bit: dakika(h.bitis), ogretmenId: p.ogretmenId, derslikId: p.derslikId, grupId: p.grupId, subeId: grup(d, p.grupId)!.subeId };
    });
    for (const s of slotlar) expect(cakismaBul(s, slotlar), s.id).toEqual([]);
  });
  it("program saatleri grubun şubesine ait", () => {
    for (const p of d.program) expect(saat(p.saatId)!.subeId).toBe(grup(d, p.grupId)!.subeId);
  });
  it("yoklamalar yalnızca gruptaki öğrencileri içeriyor", () => {
    for (const y of Object.values(d.yoklamalar)) {
      for (const oid of Object.keys(y.durumlar)) expect(aktifKayit(d, oid)?.grupId).toBe(y.grupId);
    }
  });
  it("bugün için 6 ders oturumu üretiliyor (Cuma)", () => {
    expect(oturumlar(d, "2026-10-09")).toHaveLength(6);
    expect(oturumlar(d, "2026-10-29").every((o) => o.tatil)).toBe(true); // 29 Ekim
  });
  it("taksit toplamı kayıt net tutarına eşit", () => {
    for (const k of d.kayitlar.slice(0, 20)) {
      const t = d.taksitler.filter((x) => x.kayitId === k.id).reduce((s, x) => s + x.tutar, 0);
      expect(Math.round(t * 100) / 100).toBe(k.net);
    }
  });
});

describe("bildirim üretimi", () => {
  it("kapalı olay bildirim üretmez; açık olay velilere gider", () => {
    const o = d.ogrenciler[0];
    const once = getDb().gonderimler.length;
    guncelle((x) => {
      x.olaylar = x.olaylar.map((e) => (e.key === "devamsizlik" ? { ...e, aktif: false } : e));
      bildirimEkle(x, "devamsizlik", o.id, { saat: "16:00", ders: "Matematik" });
    });
    expect(getDb().gonderimler.length).toBe(once);
    guncelle((x) => {
      x.olaylar = x.olaylar.map((e) => (e.key === "devamsizlik" ? { ...e, aktif: true } : e));
      bildirimEkle(x, "devamsizlik", o.id, { saat: "16:00", ders: "Matematik" });
    });
    const yeni = getDb().gonderimler.slice(once);
    expect(yeni).toHaveLength(o.veliIds.length);
    expect(yeni[0].metin).toContain(`${o.ad} bugün 16:00 Matematik dersine katılmadı`);
    for (const g of yeni) {
      const v = getDb().veliler.find((x) => x.id === g.veliId)!;
      expect(g.kanal).toBe(v.pushAcik ? "push" : "sms");
      expect(g.maliyet > 0).toBe(g.kanal === "sms");
    }
  });
  it("duyuru hedefi şube / seviye / grup bazında doğru veliyi seçer", () => {
    const db = getDb();
    const s2 = hedefVeliler(db, { tur: "sube", deger: "s2" });
    for (const vid of s2) expect(db.ogrenciler.some((o) => o.veliIds.includes(vid) && aktifKayit(db, o.id)?.subeId === "s2")).toBe(true);
    const g1 = hedefVeliler(db, { tur: "grup", deger: "g1" });
    expect(g1.length).toBeGreaterThan(0);
    expect(hedefVeliler(db, { tur: "tum", deger: null }).length).toBeGreaterThanOrEqual(s2.length + g1.length - 5);
  });
});
