import { describe, expect, it } from "vitest";
import { ornekVeriUret, type Db, type ProgramSatiri, type Yoklama } from "@/data/model";
import {
  aralikGunuOrtusur,
  degisiklikDenetle,
  degisiklikTarihiEngeli,
  enErkenGecerlilik,
  gecerliSatirlar,
  haftaSatirlari,
  iptalYazmaEngeli,
  ogretmenUygunlukEngeli,
  oturumKimligi,
  programCakismalari,
  programDegistir,
  programSatirEngeli,
  programSilmeEngeli,
  programYazmaEngeli,
  sonKilitliOturum,
  tarihGecerli,
  tatilSilmeEngeli,
  tatilYazmaEngeli,
  uygunOgretmenler,
} from "./kurallar";

const BUGUN = "2026-11-09"; // Pazartesi
const db: Db = { ...ornekVeriUret(), yoklamalar: {}, iptaller: [] };
const ps1 = db.program.find((p) => p.id === "ps1")!; // g1 · Pzt · h1 · l1 · p4 · d2
const satir = (x: Partial<ProgramSatiri> = {}): ProgramSatiri => ({ id: "yeni", grupId: "g1", gun: 2, saatId: "h3", dersId: "l1", ogretmenId: "p4", derslikId: "d2", baslangic: BUGUN, bitis: null, ...x });
const yoklama = (satirId: string, tarih: string, grupId = "g1") => ({ [`${satirId}_${tarih}`]: { oturumId: `${satirId}_${tarih}`, tarih, satirId, grupId, ogretmenId: "p4", durumlar: {}, konu: "", kayitZamani: "" } as Yoklama });

describe("tarih yardımcıları", () => {
  it("geçersiz takvim günü reddedilir", () => {
    expect(tarihGecerli("2026-11-09")).toBe(true);
    expect(tarihGecerli("2026-02-30")).toBe(false);
    expect(tarihGecerli("")).toBe(false);
  });
  it("oturum kimliği satır ve tarihe ayrılır", () => {
    expect(oturumKimligi("ps1_2026-11-09")).toEqual({ satirId: "ps1", tarih: "2026-11-09" });
    expect(oturumKimligi("ps_1_2026-11-09")?.satirId).toBe("ps_1");
    expect(oturumKimligi("ps1")).toBeNull();
  });
  it("yürürlük aralığı uçları dahildir", () => {
    const l = [satir({ baslangic: "2026-11-02", bitis: "2026-11-08" })];
    expect(gecerliSatirlar(l, "2026-11-08")).toHaveLength(1);
    expect(gecerliSatirlar(l, "2026-11-09")).toHaveLength(0);
  });
  it("hafta ortasında başlayan satır haftanın kendi gününde sayılır", () => {
    expect(haftaSatirlari([satir({ gun: 3, baslangic: "2026-11-11" })], "2026-11-09")).toHaveLength(1);
    expect(haftaSatirlari([satir({ gun: 1, baslangic: "2026-11-11" })], "2026-11-09")).toHaveLength(0);
  });
  it("aralıklar kesişse de ortak tarih o güne denk gelmiyorsa örtüşme yoktur", () => {
    const a = { baslangic: "2026-11-10", bitis: "2026-11-12" };
    expect(aralikGunuOrtusur(a, { baslangic: "2026-11-01", bitis: null }, 3)).toBe(true);
    expect(aralikGunuOrtusur(a, { baslangic: "2026-11-01", bitis: null }, 1)).toBe(false);
    expect(aralikGunuOrtusur(a, { baslangic: "2026-11-13", bitis: null }, 5)).toBe(false);
  });
});

describe("çakışma", () => {
  it("öğretmen, derslik ve grup çakışması bulunur", () => {
    expect(programCakismalari(satir({ saatId: "h1", dersId: "l2", ogretmenId: "p7", derslikId: "d9" }), db.program, db).map((c) => c.tur)).toEqual(["ogretmen"]);
    expect(programCakismalari(satir({ saatId: "h1", derslikId: "d1" }), db.program, db).map((c) => c.tur)).toEqual(["derslik"]);
    expect(programCakismalari(satir({ gun: 1, saatId: "h1", ogretmenId: "p7", derslikId: "d9" }), db.program, db).map((c) => c.tur)).toContain("grup");
  });
  it("ileri tarihte başlayan satırla da çakışır; kapanmış satırla çakışmaz", () => {
    const ileri = [satir({ id: "a", grupId: "g2", ogretmenId: "p4", derslikId: "d9", baslangic: "2026-12-07" })];
    expect(programCakismalari(satir(), ileri, db)).toHaveLength(1);
    const kapali = [satir({ id: "a", grupId: "g2", derslikId: "d9", baslangic: "2026-11-02", bitis: "2026-11-08" })];
    expect(programCakismalari(satir(), kapali, db)).toHaveLength(0);
  });
  it("kendisiyle çakışmaz", () => {
    expect(programCakismalari(ps1, db.program, db)).toHaveLength(0);
  });
});

describe("öğretmen uygunluğu", () => {
  it("örnek programdaki tüm satırlar kurallara uyar", () => {
    for (const p of db.program) expect(programSatirEngeli(p, undefined, db)).toBeNull();
  });
  it("şube, aktiflik, ders ve görev denetlenir", () => {
    expect(ogretmenUygunlukEngeli("", "l1", "s1", db.personel)).toMatch(/seçilmeli/);
    expect(ogretmenUygunlukEngeli("yok", "l1", "s1", db.personel)).toMatch(/öğretmen değil/);
    expect(ogretmenUygunlukEngeli("p4", "l1", "s2", db.personel)).toMatch(/görevli değil/);
    expect(ogretmenUygunlukEngeli("p4", "l5", "s1", db.personel)).toMatch(/vermiyor/);
    const pasif = db.personel.map((p) => (p.id === "p4" ? { ...p, aktif: false } : p));
    expect(ogretmenUygunlukEngeli("p4", "l1", "s1", pasif)).toMatch(/pasif/);
    expect(uygunOgretmenler(pasif, "l1", "s1").some((p) => p.id === "p4")).toBe(false);
  });
});

describe("satır alanları", () => {
  it("başka şubenin dersliği veya saati, gün tipi, sezon ve tarih sırası reddedilir", () => {
    expect(programSatirEngeli(satir({ derslikId: "d4" }), undefined, db)).toMatch(/Derslik grubun/);
    expect(programSatirEngeli(satir({ saatId: "h7" }), undefined, db)).toMatch(/saati grubun/);
    expect(programSatirEngeli(satir({ gun: 6 }), undefined, db)).toMatch(/gün/);
    expect(programSatirEngeli(satir({ gun: 8 }), undefined, db)).toMatch(/Gün hatalı/);
    expect(programSatirEngeli(satir({ baslangic: "2027-07-01" }), undefined, db)).toMatch(/sezonu/);
    expect(programSatirEngeli(satir({ bitis: "2027-07-01" }), undefined, db)).toMatch(/sezonunu/);
    expect(programSatirEngeli(satir({ bitis: "2026-11-01" }), undefined, db)).toMatch(/önce/);
  });
  it("değişmemiş eski atama kaydı kilitlemez", () => {
    const eski = satir({ ogretmenId: "p7", baslangic: "2026-12-07" });
    expect(programSatirEngeli({ ...eski, derslikId: "d1" }, eski, db)).toBeNull();
    expect(programSatirEngeli({ ...eski, ogretmenId: "p6", dersId: "l5" }, eski, db)).not.toBeNull();
  });
});

describe("geçmişin korunması", () => {
  const kilitli = { ...db, yoklamalar: yoklama("ps1", BUGUN) };
  const iptalli = { ...db, iptaller: [{ oturumId: "ps1_2026-11-23", neden: "x", tarih: BUGUN }] };

  it("son kilitli oturum yoklama ve iptalden bulunur", () => {
    expect(sonKilitliOturum(ps1, kilitli)).toBe(BUGUN);
    expect(sonKilitliOturum(ps1, iptalli)).toBe("2026-11-23");
    expect(sonKilitliOturum(ps1, db)).toBeNull();
  });
  it("değişiklik en erken kilitli oturumdan sonra başlar", () => {
    expect(enErkenGecerlilik(ps1, db, BUGUN)).toBe(BUGUN);
    expect(enErkenGecerlilik(ps1, kilitli, BUGUN)).toBe("2026-11-10");
    expect(enErkenGecerlilik(ps1, iptalli, BUGUN)).toBe("2026-11-24");
  });
  it("geçmiş, kilitli ve bitişten sonraki tarih reddedilir", () => {
    expect(degisiklikTarihiEngeli(ps1, "2026-11-08", db, BUGUN)).toMatch(/geçmişe/);
    expect(degisiklikTarihiEngeli(ps1, BUGUN, kilitli, BUGUN)).toMatch(/yoklaması/);
    expect(degisiklikTarihiEngeli(ps1, "2026-11-10", kilitli, BUGUN)).toBeNull();
    expect(degisiklikTarihiEngeli({ ...ps1, bitis: "2026-11-20" }, "2026-11-21", db, BUGUN)).toMatch(/sona eriyor/);
    expect(degisiklikTarihiEngeli(ps1, "bozuk", db, BUGUN)).toMatch(/hatalı/);
  });
  it("başlamış satır kapatılır, yeni satır açılır", () => {
    const l = programDegistir([ps1], ps1, { ...ps1, gun: 2 }, BUGUN, () => "n");
    expect(l).toHaveLength(2);
    expect(l[0]).toMatchObject({ id: "ps1", gun: 1, bitis: "2026-11-08" });
    expect(l[1]).toMatchObject({ id: "n", gun: 2, baslangic: BUGUN, bitis: null });
  });
  it("yeni satır eski satırın bitişini korur", () => {
    const e = { ...ps1, bitis: "2026-12-31" };
    expect(programDegistir([e], e, { ...e, gun: 2 }, BUGUN, () => "n")[1].bitis).toBe("2026-12-31");
  });
  it("başlamamış satır yerinde değişir veya silinir; başlamış satır silinmez, kapanır", () => {
    const g = { ...ps1, baslangic: "2026-12-07" };
    expect(programDegistir([g], g, { ...g, gun: 2 }, BUGUN, () => "n")).toEqual([{ ...g, gun: 2 }]);
    expect(programDegistir([g], g, null, BUGUN, () => "n")).toEqual([]);
    expect(programDegistir([ps1], ps1, null, BUGUN, () => "n")).toEqual([{ ...ps1, bitis: "2026-11-08" }]);
  });
});

describe("pencere ve sürükle-bırak ortak denetimi", () => {
  it("bölünen satır kendi eski parçasıyla çakışmaz", () => {
    const s = degisiklikDenetle(db, ps1, { ...ps1, dersId: "l1", derslikId: "d2" }, BUGUN, BUGUN);
    expect(s.cakismalar).toHaveLength(0);
    expect(s.tarihEngeli).toBeNull();
    expect(s.satir.baslangic).toBe(BUGUN);
  });
  it("hedef saat doluysa çakışma, pasif saatse atama engeli döner", () => {
    expect(degisiklikDenetle(db, ps1, { ...ps1, gun: 2, saatId: "h1", derslikId: "d1" }, BUGUN, BUGUN).cakismalar.length).toBeGreaterThan(0);
    const pasifli = { ...db, dersSaatleri: db.dersSaatleri.map((h) => (h.id === "h3" ? { ...h, aktif: false } : h)) };
    expect(degisiklikDenetle(pasifli, ps1, { ...ps1, gun: 2, saatId: "h3" }, BUGUN, BUGUN).atamaEngeli).toMatch(/pasif/);
  });
  it("yeni satır geçmişten başlayamaz", () => {
    expect(degisiklikDenetle(db, undefined, satir({ baslangic: "2026-11-02" }), "2026-11-02", BUGUN).tarihEngeli).toMatch(/geçmiş/);
  });
  it("şubeler arası geçiş uyarısı tarih aralığına bakar", () => {
    // p5: g5 Salı h7 (s2) 16:30–17:10; s1 h3 17:40 → 30 dk
    const y = satir({ dersId: "l2", ogretmenId: "p5" });
    const sonuc = degisiklikDenetle({ ...db, ayarlar: { ...db.ayarlar, subeGecisDk: 45 } }, undefined, y, BUGUN, BUGUN);
    expect(sonuc.gecisler.length).toBe(1);
  });
});

describe("sunucu satır kuralları", () => {
  it("yalnızca kapatma: dün en erken, kilitli oturumdan önce olamaz", () => {
    expect(programYazmaEngeli({ ...ps1, bitis: "2026-11-08" }, ps1, db, BUGUN)).toBeNull();
    expect(programYazmaEngeli({ ...ps1, bitis: "2026-11-07" }, ps1, db, BUGUN)).toMatch(/Geçmiş/);
    expect(programYazmaEngeli({ ...ps1, bitis: "2026-11-08" }, ps1, { ...db, yoklamalar: yoklama("ps1", BUGUN) }, BUGUN)).toMatch(/yoklaması/);
  });
  it("başlamış satırın alanı değişemez; silinemez", () => {
    expect(programYazmaEngeli({ ...ps1, dersId: "l2" }, ps1, db, BUGUN)).toMatch(/Başlamış/);
    expect(programSilmeEngeli(ps1, db, BUGUN)).toMatch(/silinemez/);
  });
  it("yoklamalı satır silinemez; başlamamış boş satır silinir", () => {
    const g = { ...ps1, baslangic: "2026-12-07" };
    expect(programSilmeEngeli(g, db, BUGUN)).toBeNull();
    expect(programSilmeEngeli(g, { ...db, yoklamalar: yoklama("ps1", "2026-12-07") }, BUGUN)).toMatch(/Yoklaması/);
  });
});

describe("tatil", () => {
  const t = { id: "t9", tarih: "2026-12-07", ad: "Kapanış", subeId: "s1" };
  it("geçerli tatil kabul edilir; ad, tarih, şube denetlenir", () => {
    expect(tatilYazmaEngeli(t, undefined, db, BUGUN)).toBeNull();
    expect(tatilYazmaEngeli({ ...t, ad: " " }, undefined, db, BUGUN)).toMatch(/adı/);
    expect(tatilYazmaEngeli({ ...t, tarih: "" }, undefined, db, BUGUN)).toMatch(/hatalı/);
    expect(tatilYazmaEngeli({ ...t, subeId: "sYok" }, undefined, db, BUGUN)).toMatch(/Şube/);
  });
  it("geçmiş tarih, yinelenen kapsam ve yoklamalı gün reddedilir", () => {
    expect(tatilYazmaEngeli({ ...t, tarih: "2026-11-01" }, undefined, db, BUGUN)).toMatch(/Geçmiş/);
    expect(tatilYazmaEngeli({ ...t, tarih: "2026-11-16", subeId: null }, undefined, db, BUGUN)).toMatch(/zaten/);
    expect(tatilYazmaEngeli(t, undefined, { ...db, yoklamalar: yoklama("ps1", "2026-12-07") }, BUGUN)).toMatch(/yoklaması/);
    expect(tatilYazmaEngeli({ ...t, subeId: "s2" }, undefined, { ...db, yoklamalar: yoklama("ps1", "2026-12-07") }, BUGUN)).toBeNull();
  });
  it("geçmiş tatil kaldırılamaz", () => {
    expect(tatilSilmeEngeli({ ...t, tarih: "2026-11-01" }, BUGUN)).toMatch(/Geçmiş/);
    expect(tatilSilmeEngeli(t, BUGUN)).toBeNull();
  });
});

describe("iptal ve telafi", () => {
  const i = { oturumId: "ps1_2026-11-23", neden: "Rapor", tarih: BUGUN };
  it("geçerli iptal kabul edilir", () => {
    expect(iptalYazmaEngeli(i, undefined, db, BUGUN)).toBeNull();
    expect(iptalYazmaEngeli({ ...i, telafi: "2026-11-28" }, undefined, db, BUGUN)).toBeNull();
  });
  it("var olmayan oturum, yanlış gün, geçmiş reddedilir", () => {
    expect(iptalYazmaEngeli({ ...i, oturumId: "psYok_2026-11-23" }, undefined, db, BUGUN)).toMatch(/bulunamadı/);
    expect(iptalYazmaEngeli({ ...i, oturumId: "ps1_2026-11-24" }, undefined, db, BUGUN)).toMatch(/bulunamadı/);
    expect(iptalYazmaEngeli({ ...i, oturumId: "ps1_2026-11-02" }, undefined, db, BUGUN)).toMatch(/Geçmiş/);
  });
  it("neden, yoklama, tatil ve telafi denetlenir", () => {
    expect(iptalYazmaEngeli({ ...i, neden: "" }, undefined, db, BUGUN)).toMatch(/neden/);
    expect(iptalYazmaEngeli(i, undefined, { ...db, yoklamalar: yoklama("ps1", "2026-11-23") }, BUGUN)).toMatch(/Yoklaması/);
    expect(iptalYazmaEngeli({ ...i, oturumId: "ps1_2026-11-16" }, undefined, db, BUGUN)).toMatch(/tatil/);
    expect(iptalYazmaEngeli({ ...i, telafi: "2026-11-20" }, undefined, db, BUGUN)).toMatch(/önce/);
    expect(iptalYazmaEngeli({ ...i, oturumId: "ps1_2026-11-09", telafi: "2026-11-16" }, undefined, db, BUGUN)).toMatch(/tatil/);
  });
  it("iptal sonradan değiştirilemez", () => {
    expect(iptalYazmaEngeli(i, i, db, BUGUN)).toMatch(/değiştirilemez/);
  });
});
