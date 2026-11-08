/** Bölüm 09 saf kurallar. Saat sabittir; örnek veri yalnızca kişi ve kayıtlar için kullanılır. */
import { describe, expect, it } from "vitest";
import { aktifKayit, ornekVeriUret, type Db, type Musaitlik, type Paket, type Randevu } from "@/data/model";
import {
  baslamisMi,
  bosSlotlar,
  etutBildirimiYineleniyor,
  kullanilabilirHak,
  musaitlikEngeli,
  ogretmenDersAraliklari,
  paketBildirimiGitti,
  grupKontenjani,
  kalanHakUygula,
  ogrenciDersiCakisir,
  ogrenciSonucu,
  sonucHakFarklari,
  paketDegisimEngeli,
  randevuDurumEngeli,
  randevuYeniEngeli,
  SLOT_DOLU,
  uygunPaket,
  veliEtutVerisi,
  veliIptalEngeli,
  ogrencileriCikar,
  veliRandevuPlani,
} from "./kurallar";

const AN = { bugun: "2026-11-09", simdi: "15:00" }; // pazartesi
const SALI = "2026-11-10";
const ham = ornekVeriUret();
const mu: Musaitlik = { id: "mu1", ogretmenId: "p4", subeId: "s1", gun: 2, bas: "14:00", bit: "16:00" };
const db: Db = { ...ham, program: [], tatiller: [], iptaller: [], randevular: [], paketler: [], musaitlikler: [mu] };
const s1 = db.ogrenciler.filter((o) => o.durum === "aktif" && aktifKayit(db, o.id)?.subeId === "s1").map((o) => o.id);
const s2 = db.ogrenciler.find((o) => o.durum === "aktif" && aktifKayit(db, o.id)?.subeId === "s2")!.id;
const [A, B] = s1;
const b = { ...AN, ogretmenGruplari: null };

const randevu = (p: Partial<Randevu> = {}): Randevu => ({ id: "r1", ogretmenId: "p4", subeId: "s1", tarih: SALI, bas: "14:00", bit: "14:40", tur: "bireysel", ogrenciIds: [A], dersId: "l2", durum: "planli", link: "", paketId: null, olusturan: "yonetim", ...p });
const paket = (p: Partial<Paket> = {}): Paket => ({ id: "pk", ogrenciId: A, ogretmenId: "p4", dersId: "l2", toplam: 4, kalan: 2, fiyat: 0, tarih: "2026-10-01", ...p });
const ders = (ogretmenId = "p4") => {
  const h = db.dersSaatleri.find((x) => x.subeId === "s1" && x.gunTipi !== "hafta-sonu")!;
  const g = db.gruplar.find((x) => x.subeId === "s1")!;
  return { satir: { id: "ps", grupId: g.id, gun: 2, saatId: h.id, dersId: "l2", ogretmenId, derslikId: "d", baslangic: "2026-09-01", bitis: null }, h };
};
const sezonlu = (d: Db): Db => ({ ...d, sezonlar: d.sezonlar.map((z) => ({ ...z, bitis: "2027-06-30" })) });

describe("boş slotlar", () => {
  const saatler = (d: Db, a = AN) => bosSlotlar(d, SALI, undefined, undefined, a).map((s) => s.bas);
  it("müsaitlik 40 dakikalık slotlara bölünür", () => expect(saatler(db)).toEqual(["14:00", "14:40", "15:20"]));
  it("randevu dolu, iptal edilen boş sayılır", () => {
    expect(saatler({ ...db, randevular: [randevu()] })).toEqual(["14:40", "15:20"]);
    expect(saatler({ ...db, randevular: [randevu({ durum: "iptal" })] })).toHaveLength(3);
  });
  it("başka şubedeki randevu da öğretmeni doldurur", () => expect(saatler({ ...db, randevular: [randevu({ subeId: "s2" })] })).toHaveLength(2));
  it("tatil gününde slot yok; başka şubenin tatili etkilemez", () => {
    expect(saatler({ ...db, tatiller: [{ id: "t", tarih: SALI, ad: "x", subeId: null }] })).toEqual([]);
    expect(saatler({ ...db, tatiller: [{ id: "t", tarih: SALI, ad: "x", subeId: "s2" }] })).toHaveLength(3);
  });
  it("pasif öğretmen ve pasif şube slot vermez", () => {
    expect(saatler({ ...db, personel: db.personel.map((p) => (p.id === "p4" ? { ...p, aktif: false } : p)) })).toEqual([]);
    expect(saatler({ ...db, subeler: db.subeler.map((s) => (s.id === "s1" ? { ...s, aktif: false } : s)) })).toEqual([]);
  });
  it("geçmiş saatler düşer", () => expect(saatler(db, { bugun: SALI, simdi: "14:40" })).toEqual(["15:20"]));
  it("grup dersiyle çakışan slot düşer, iptal edilen ders düşürmez", () => {
    const { satir, h } = ders();
    const d = sezonlu({ ...db, program: [satir], dersSaatleri: db.dersSaatleri.map((x) => (x.id === h.id ? { ...x, baslangic: "14:00", bitis: "14:40" } : x)) });
    expect(saatler(d)).toEqual(["14:40", "15:20"]);
    expect(saatler({ ...d, iptaller: [{ oturumId: `ps_${SALI}`, neden: "x", tarih: AN.bugun }] })).toHaveLength(3);
  });
  it("veliye gelen dolu saatler de slotu düşürür", () => {
    const d = { ...db, doluSaatler: [{ ogretmenId: "p4", gun: 2, bas: "15:00", bit: "16:00", baslangic: "2026-09-01", bitis: null }] };
    expect(saatler(d)).toEqual(["14:00"]);
    expect(ogretmenDersAraliklari(d, "p7", SALI)).toEqual([]);
  });
});

describe("müsaitlik", () => {
  const m = (p: Partial<Musaitlik>): Musaitlik => ({ ...mu, id: "yeni", gun: 3, ...p });
  it("geçerli tanım", () => expect(musaitlikEngeli(m({}), db)).toBeNull());
  it("başlangıç bitişten önce, en az 40 dakika", () => {
    expect(musaitlikEngeli(m({ bas: "16:00", bit: "14:00" }), db)).toMatch(/önce/);
    expect(musaitlikEngeli(m({ bas: "14:00", bit: "14:30" }), db)).toMatch(/en az/);
  });
  it("hatalı alanlar", () => {
    expect(musaitlikEngeli(m({ gun: 8 }), db)).toMatch(/Gün/);
    expect(musaitlikEngeli(m({ bas: "25:00" }), db)).toMatch(/Saat/);
  });
  it("aynı öğretmen aynı gün çakışamaz, şube farklı olsa da", () => expect(musaitlikEngeli(m({ gun: 2, subeId: "s2", bas: "15:00", bit: "17:00" }), db)).toMatch(/çakışan|görevli/));
  it("bitişik aralık çakışma değildir", () => expect(musaitlikEngeli(m({ gun: 2, bas: "16:00", bit: "17:00" }), db)).toBeNull());
  it("pasif öğretmen, başka şube, öğretmen olmayan", () => {
    expect(musaitlikEngeli(m({}), { ...db, personel: db.personel.map((p) => (p.id === "p4" ? { ...p, aktif: false } : p)) })).toMatch(/pasif/);
    expect(musaitlikEngeli(m({ subeId: "yok" }), db)).toMatch(/görevli/);
    expect(musaitlikEngeli(m({ ogretmenId: "yok" }), db)).toMatch(/öğretmen değil/);
  });
});

describe("yeni randevu", () => {
  it("uygun slot kabul edilir", () => expect(randevuYeniEngeli(randevu(), db, b)).toBeNull());
  it("müsaitlik dışı, ızgaraya oturmayan, yanlış süre", () => {
    expect(randevuYeniEngeli(randevu({ bas: "16:00", bit: "16:40" }), db, b)).toMatch(/müsaitlik/);
    expect(randevuYeniEngeli(randevu({ bas: "14:10", bit: "14:50" }), db, b)).toMatch(/müsaitlik/);
    expect(randevuYeniEngeli(randevu({ bit: "15:00" }), db, b)).toMatch(/süresi/);
  });
  it("hatalı tarih ve geçmiş", () => {
    expect(randevuYeniEngeli(randevu({ tarih: "2026-13-40" }), db, b)).toMatch(/hatalı/);
    expect(randevuYeniEngeli(randevu(), db, { ...b, bugun: SALI, simdi: "14:00" })).toMatch(/Geçmiş/);
  });
  it("öğretmen dolu", () => expect(randevuYeniEngeli(randevu({ id: "r2", ogrenciIds: [B] }), { ...db, randevular: [randevu()] }, b)).toBe(SLOT_DOLU));
  it("öğrenci aynı saatte başka öğretmende olamaz", () => {
    const d = { ...db, randevular: [randevu({ ogretmenId: "p7" })] };
    expect(randevuYeniEngeli(randevu({ id: "r2" }), d, b)).toMatch(/başka bir randevu/);
  });
  it("tatil ve grup dersi çakışması", () => {
    expect(randevuYeniEngeli(randevu(), { ...db, tatiller: [{ id: "t", tarih: SALI, ad: "x", subeId: "s1" }] }, b)).toMatch(/tatil/);
    const { satir, h } = ders();
    const d = sezonlu({ ...db, program: [satir], dersSaatleri: db.dersSaatleri.map((x) => (x.id === h.id ? { ...x, baslangic: "14:00", bitis: "14:40" } : x)) });
    expect(randevuYeniEngeli(randevu(), d, b)).toMatch(/grup dersi/);
  });
  it("öğrencinin grup dersiyle çakışma engellenir; tatil ve iptal günü sayılmaz", () => {
    const k = db.kayitlar.find((x) => x.ogrenciId === A && x.durum === "aktif")!;
    const { satir, h } = ders("p7");
    const d = sezonlu({ ...db, program: [{ ...satir, grupId: k.grupId }], dersSaatleri: db.dersSaatleri.map((x) => (x.id === h.id ? { ...x, baslangic: "14:00", bitis: "14:40" } : x)) });
    expect(randevuYeniEngeli(randevu(), d, b)).toMatch(/grup dersi/);
    expect(ogrenciDersiCakisir(d, A, SALI, "14:40", "15:20")).toBe(false);
    expect(randevuYeniEngeli(randevu(), { ...d, iptaller: [{ oturumId: `ps_${SALI}`, neden: "x", tarih: AN.bugun }] }, b)).toBeNull();
    const subeTatili = { ...d, tatiller: [{ id: "t", tarih: SALI, ad: "x", subeId: "s2" }] };
    expect(randevuYeniEngeli(randevu(), subeTatili, b)).toMatch(/grup dersi/);
    expect(ogrenciDersiCakisir({ ...d, tatiller: [{ id: "t", tarih: SALI, ad: "x", subeId: null }] }, A, SALI, "14:00", "14:40")).toBe(false);
  });
  it("grup etüdü kontenjanı: ayar yoksa 6", () => {
    const ayarsiz = { ...db, ayarlar: { ...db.ayarlar, etutGrupKontenjan: undefined } };
    expect(grupKontenjani(ayarsiz.ayarlar)).toBe(6);
    const secilen = s1.slice(0, 7);
    expect(randevuYeniEngeli(randevu({ tur: "grup", ogrenciIds: secilen }), ayarsiz, b)).toMatch(/en fazla 6/);
    expect(randevuYeniEngeli(randevu({ tur: "grup", ogrenciIds: secilen.slice(0, 3) }), { ...db, ayarlar: { ...db.ayarlar, etutGrupKontenjan: 2 } }, b)).toMatch(/en fazla 2/);
  });
  it("grup etüdünde öğrenci bazında paket denetlenir", () => {
    const d = { ...db, paketler: [paket({ id: "pa" })] };
    expect(randevuYeniEngeli(randevu({ tur: "grup", ogrenciIds: [A, B], paketIds: { [A]: "pa" } }), d, b)).toBeNull();
    expect(randevuYeniEngeli(randevu({ tur: "grup", ogrenciIds: [A, B], paketIds: { [B]: "pa" } }), d, b)).toMatch(/ait değil/);
    expect(randevuYeniEngeli(randevu({ paketIds: { [A]: "pa" } }), d, b)).toMatch(/yalnızca grup/);
  });
  it("öğrenci sayısı türe uygun; aynı öğrenci iki kez yok", () => {
    expect(randevuYeniEngeli(randevu({ ogrenciIds: [A, B] }), db, b)).toMatch(/tek öğrenci/);
    expect(randevuYeniEngeli(randevu({ tur: "grup", ogrenciIds: [A, B] }), db, b)).toBeNull();
    expect(randevuYeniEngeli(randevu({ tur: "grup", ogrenciIds: [A, A] }), db, b)).toMatch(/iki kez/);
    expect(randevuYeniEngeli(randevu({ ogrenciIds: [] }), db, b)).toMatch(/seçilmeli/);
  });
  it("öğrenci bu şubede aktif olmalı; öğretmen yalnızca kendi grubu", () => {
    expect(randevuYeniEngeli(randevu({ ogrenciIds: [s2] }), db, b)).toMatch(/şubede/);
    expect(randevuYeniEngeli(randevu(), db, { ...b, ogretmenGruplari: new Set(["baska"]) })).toMatch(/kendi grup/);
  });
  it("online link http(s), diğer türde boş", () => {
    expect(randevuYeniEngeli(randevu({ tur: "online", link: "javascript:alert(1)" }), db, b)).toMatch(/link/);
    expect(randevuYeniEngeli(randevu({ tur: "online", link: "https://meet.example/x" }), db, b)).toBeNull();
    expect(randevuYeniEngeli(randevu({ link: "https://x.y" }), db, b)).toMatch(/link/);
  });
  it("özel ders paket ister; paket sahibi, dersi ve hakkı denetlenir", () => {
    const d = { ...db, paketler: [paket({ kalan: 1 })] };
    expect(randevuYeniEngeli(randevu({ tur: "ozel" }), d, b)).toMatch(/paket/);
    expect(randevuYeniEngeli(randevu({ tur: "ozel", paketId: "pk" }), d, b)).toBeNull();
    expect(randevuYeniEngeli(randevu({ paketId: "pk", dersId: "l1" }), d, b)).toMatch(/dersi/);
    expect(randevuYeniEngeli(randevu({ paketId: "pk", ogrenciIds: [B] }), d, b)).toMatch(/ait değil/);
    const planli = { ...d, randevular: [randevu({ id: "r9", bas: "15:20", bit: "16:00", paketId: "pk" })] };
    expect(randevuYeniEngeli(randevu({ tur: "ozel", paketId: "pk" }), planli, b)).toMatch(/hakkı kalmadı/);
  });
});

describe("paket hakkı", () => {
  it("planlı randevular ayrılmış sayılır, iptal ve sonuçlanan sayılmaz", () => {
    const l = [randevu({ id: "1", paketId: "pk" }), randevu({ id: "2", paketId: "pk", durum: "iptal" }), randevu({ id: "3", paketId: "pk", durum: "yapildi" })];
    expect(kullanilabilirHak(paket(), l)).toBe(1);
    expect(kullanilabilirHak(paket(), l, "1")).toBe(2);
    expect(uygunPaket({ paketler: [paket({ kalan: 1 })], randevular: [l[0]] }, A, "p4")).toBeUndefined();
  });
  it("yapıldı düşer, gelmedi ayara bağlı, iptal düşmez, ikinci kez düşmez", () => {
    const r = randevu({ paketId: "pk" });
    expect(sonucHakFarklari(r, { durum: "yapildi" }, false).get("pk")).toBe(1);
    expect(sonucHakFarklari(r, { durum: "gelmedi" }, false).size).toBe(0);
    expect(sonucHakFarklari(r, { durum: "gelmedi" }, true).get("pk")).toBe(1);
    expect(sonucHakFarklari(r, { durum: "iptal" }, true).size).toBe(0);
    expect(sonucHakFarklari({ ...r, durum: "yapildi" }, { durum: "yapildi" }, true).size).toBe(0);
    expect(sonucHakFarklari(randevu(), { durum: "yapildi" }, true).size).toBe(0);
  });
  it("düzeltmede hak iade edilir veya düşülür; kalan toplamı aşmaz", () => {
    const r = randevu({ paketId: "pk", durum: "yapildi" });
    expect(sonucHakFarklari(r, { durum: "gelmedi" }, false).get("pk")).toBe(-1);
    expect(sonucHakFarklari({ ...r, durum: "gelmedi" }, { durum: "yapildi" }, false).get("pk")).toBe(1);
    expect(kalanHakUygula({ kalan: 4, toplam: 4 }, -1)).toBe(4);
    expect(kalanHakUygula({ kalan: 0, toplam: 4 }, 1)).toBe(0);
  });
  it("grup etüdünde hak öğrenci bazında işlenir", () => {
    const r = randevu({ tur: "grup", ogrenciIds: [A, B], paketIds: { [A]: "pa", [B]: "pb" } });
    const f = sonucHakFarklari(r, { durum: "yapildi", sonuclar: { [A]: "yapildi", [B]: "gelmedi" } }, false);
    expect([...f]).toEqual([["pa", 1]]);
    expect(kullanilabilirHak({ id: "pb", kalan: 1 }, [r])).toBe(0);
  });
  it("paket tanımı değişmez, hak sonuçsuz değişmez", () => {
    expect(paketDegisimEngeli(paket({ toplam: 9 }), paket(), 0)).toMatch(/tanımı/);
    expect(paketDegisimEngeli(paket({ kalan: 9 }), paket(), 0)).toMatch(/Kalan/);
    expect(paketDegisimEngeli(paket({ kalan: 1 }), paket(), 1)).toBeNull();
  });
});

describe("randevu durumu", () => {
  const baslamis = randevu({ tarih: "2026-11-02" });
  const y = { ...AN, rol: "sube-muduru" as const };
  it("başlamamış randevu sonuçlanmaz; iptal edilir", () => {
    expect(randevuDurumEngeli(randevu({ durum: "yapildi" }), randevu(), y)).toMatch(/Başlamamış/);
    expect(randevuDurumEngeli(randevu({ durum: "iptal" }), randevu(), y)).toBeNull();
  });
  it("başlamış randevu sonuçlanır", () => expect(randevuDurumEngeli({ ...baslamis, durum: "gelmedi" }, baslamis, y)).toBeNull());
  it("sonuçlanmış randevu değişmez", () => expect(randevuDurumEngeli({ ...baslamis, durum: "gelmedi" }, { ...baslamis, durum: "yapildi" }, y)).toMatch(/Sonuçlanmış/));
  it("başka alan değişmez", () => expect(randevuDurumEngeli(randevu({ bas: "14:40" }), randevu(), y)).toMatch(/değiştirilemez/));
  it("başlamış randevuyu öğretmen iptal edemez", () => {
    expect(randevuDurumEngeli({ ...baslamis, durum: "iptal" }, baslamis, { ...AN, rol: "ogretmen" })).toMatch(/yönetim/);
    expect(randevuDurumEngeli({ ...baslamis, durum: "iptal" }, baslamis, y)).toBeNull();
  });
  const grup = randevu({ tarih: "2026-11-02", tur: "grup", ogrenciIds: [A, B] });
  it("öğrenci bazında sonuç: tüm öğrenciler, durumla uyumlu", () => {
    expect(randevuDurumEngeli({ ...grup, durum: "yapildi", sonuclar: { [A]: "yapildi", [B]: "gelmedi" } }, grup, y)).toBeNull();
    expect(randevuDurumEngeli({ ...grup, durum: "yapildi", sonuclar: { [A]: "yapildi" } }, grup, y)).toMatch(/Her öğrenci/);
    expect(randevuDurumEngeli({ ...grup, durum: "gelmedi", sonuclar: { [A]: "yapildi", [B]: "gelmedi" } }, grup, y)).toMatch(/uyuşmuyor/);
    expect(randevuDurumEngeli({ ...grup, durum: "iptal", sonuclar: { [A]: "yapildi", [B]: "gelmedi" } }, grup, y)).toMatch(/İptalde/);
  });
  it("eski kayıt: sonuç yoksa durum tüm öğrencilere uygulanır", () => {
    expect(ogrenciSonucu({ ...grup, durum: "gelmedi" }, B)).toBe("gelmedi");
    expect(ogrenciSonucu({ ...grup, durum: "yapildi", sonuclar: { [A]: "yapildi", [B]: "gelmedi" } }, B)).toBe("gelmedi");
  });
  it("düzeltme: yönetici, gerekçe, gerçek değişiklik", () => {
    const y2 = { ...baslamis, durum: "yapildi" as const };
    const duz = (neden: string) => [{ neden, kullanici: "", zaman: "", onceki: { durum: "yapildi" as const, sonuclar: null } }];
    expect(randevuDurumEngeli({ ...y2, durum: "gelmedi", duzeltmeler: duz("yanlış işaret") }, y2, y)).toBeNull();
    expect(randevuDurumEngeli({ ...y2, durum: "gelmedi", duzeltmeler: duz("ab") }, y2, y)).toMatch(/3 karakter/);
    expect(randevuDurumEngeli({ ...y2, durum: "gelmedi", duzeltmeler: duz("yanlış") }, y2, { ...AN, rol: "ogretmen" })).toMatch(/şube müdürü/);
    expect(randevuDurumEngeli({ ...y2, duzeltmeler: duz("yanlış") }, y2, y)).toMatch(/değişmedi/);
    expect(randevuDurumEngeli({ ...y2, durum: "iptal", duzeltmeler: duz("yanlış") }, y2, y)).toMatch(/hatalı/);
  });
  it("iptal edilmiş randevu değişmez", () => expect(randevuDurumEngeli({ ...baslamis, durum: "yapildi" }, { ...baslamis, durum: "iptal" }, y)).toMatch(/İptal edilmiş/));
  it("başlangıç anı dahil", () => expect(baslamisMi({ tarih: AN.bugun, bas: "15:00" }, AN)).toBe(true));
});

describe("veli", () => {
  const g = { ogrenciId: A, ogretmenId: "p4", tarih: SALI, bas: "14:00" };
  it("uygun slotta randevu üretilir; süre ve oluşturan sunucudan", () => {
    const p = veliRandevuPlani(db, g, AN);
    expect(p).toMatchObject({ randevu: { bit: "14:40", olusturan: "veli", tur: "bireysel", paketId: null, subeId: aktifKayit(db, A)!.subeId } });
  });
  it("paket varsa özel ders ve paketin dersi; hak planlıya ayrıldıysa kullanılmaz", () => {
    const d = { ...db, paketler: [paket({ dersId: "l3", kalan: 1 })] };
    expect(veliRandevuPlani(d, g, AN)).toMatchObject({ randevu: { tur: "ozel", paketId: "pk", dersId: "l3" } });
    expect(veliRandevuPlani({ ...d, randevular: [randevu({ id: "r9", bas: "15:20", bit: "16:00", paketId: "pk" })] }, g, AN)).toMatchObject({ randevu: { tur: "bireysel", paketId: null } });
  });
  it("hatalı girdi, geçmiş, dolu", () => {
    expect(veliRandevuPlani(db, { ...g, bas: "aa" }, AN)).toEqual({ hata: "Tarih veya saat hatalı." });
    expect(veliRandevuPlani(db, { ...g, tarih: { x: 1 } }, AN)).toEqual({ hata: "Tarih veya saat hatalı." });
    expect(veliRandevuPlani(db, g, { bugun: SALI, simdi: "14:00" })).toMatchObject({ hata: expect.stringMatching(/Geçmiş/) });
    expect(veliRandevuPlani({ ...db, randevular: [randevu({ ogrenciIds: [B] })] }, g, AN)).toEqual({ hata: SLOT_DOLU });
  });
  it("iptal süresi: X saat öncesine kadar, sınır dahil", () => {
    const r = randevu();
    expect(veliIptalEngeli(r, 12, { bugun: AN.bugun, simdi: "23:00" })).toBeNull(); // 15 saat
    expect(veliIptalEngeli(r, 12, { bugun: SALI, simdi: "02:00" })).toBeNull(); // tam 12 saat
    expect(veliIptalEngeli(r, 12, { bugun: SALI, simdi: "02:01" })).toMatch(/12 saat/);
    expect(veliIptalEngeli(r, 0, { bugun: SALI, simdi: "14:00" })).toMatch(/saat/);
    expect(veliIptalEngeli({ ...r, durum: "yapildi" }, 12, AN)).toMatch(/iptal edilemez/);
  });
  it("grup etüdünde yalnızca kendi çocuğu çıkar; son öğrenciyle randevu iptal olur", () => {
    const r = randevu({ tur: "grup", ogrenciIds: [A, B] });
    expect(ogrencileriCikar(r, new Set([A]))).toMatchObject({ durum: "planli", ogrenciIds: [B] });
    expect(ogrencileriCikar(r, new Set([A, B])).durum).toBe("iptal");
    expect(ogrencileriCikar({ ...r, paketIds: { [A]: "pa", [B]: "pb" } }, new Set([A])).paketIds).toEqual({ [B]: "pb" });
  });
  it("başka öğrencinin randevusu kimliksiz gider; kendi randevusunda diğer öğrenci görünmez", () => {
    const d = { ...db, randevular: [randevu({ tur: "online", link: "https://gizli", ogrenciIds: [B], paketId: "x" }), randevu({ id: "r2", bas: "14:40", bit: "15:20", tur: "grup", ogrenciIds: [A, B] }), randevu({ id: "r3", durum: "iptal", ogrenciIds: [B] })] };
    const v = veliEtutVerisi(d, new Set([A]), new Set(["s1"]));
    expect(v.randevular).toHaveLength(2);
    expect(v.randevular[0]).toMatchObject({ ogrenciIds: [], link: "", paketId: null, dersId: "", tur: "bireysel" });
    expect(v.randevular[1].ogrenciIds).toEqual([A]);
  });
  it("veliye yalnızca kendi çocuğunun sonucu gider, düzeltme gerekçesi gitmez", () => {
    const r = randevu({ tur: "grup", ogrenciIds: [A, B], durum: "yapildi", sonuclar: { [A]: "gelmedi", [B]: "yapildi" }, duzeltmeler: [{ neden: "gizli", kullanici: "k", zaman: "z", onceki: { durum: "gelmedi", sonuclar: null } }] });
    const [benim] = veliEtutVerisi({ ...db, randevular: [r] }, new Set([A]), new Set(["s1"])).randevular;
    expect(benim).toMatchObject({ durum: "gelmedi", sonuclar: { [A]: "gelmedi" } });
    expect(benim.sonuclar).not.toHaveProperty(B);
    expect(benim.duzeltmeler).toBeUndefined();
    const [baskasi] = veliEtutVerisi({ ...db, randevular: [r] }, new Set(["yok"]), new Set(["s1"])).randevular;
    expect(baskasi.sonuclar).toBeUndefined();
    expect(baskasi.durum).toBe("planli");
  });
  it("modül kapalıyken veliye etüt verisi gitmez", () => {
    const v = veliEtutVerisi({ ...db, moduller: { ...db.moduller, etut: false }, randevular: [randevu()] }, new Set([A]), new Set(["s1"]));
    expect(v.randevular).toEqual([]);
    expect(v.musaitlikler).toEqual([]);
  });
  it("başka şubenin müsaitliği ve öğretmeni gitmez; finans kapalıyken paket ücreti gitmez", () => {
    const d = { ...db, musaitlikler: [mu, { ...mu, id: "m2", ogretmenId: "p8", subeId: "s2" }], paketler: [paket({ fiyat: 500 })], moduller: { ...db.moduller, finans: false } };
    const v = veliEtutVerisi(d, new Set([A]), new Set(["s1"]));
    expect(v.ogretmenIds).toEqual(["p4"]);
    expect(v.paketler[0].fiyat).toBe(0);
  });
});

describe("bildirim tekilleştirme", () => {
  const g = { olay: "etutHatirlatma" as const, veliId: "v", ogrenciId: "o" };
  it("aynı randevu ve veli için ikinci onay yok", () => {
    expect(etutBildirimiYineleniyor(g, "r", [{ ...g, randevuId: "r" }])).toBe(true);
    expect(etutBildirimiYineleniyor(g, "r2", [{ ...g, randevuId: "r" }])).toBe(false);
  });
  it("paket bildirimi paket başına bir kez; eski düğme bildirimi de sayılır", () => {
    const p = { id: "pk", ogrenciId: "o", kalan: 1 };
    expect(paketBildirimiGitti([{ olay: "paketBitiyor", ogrenciId: "o", metin: "x", paketId: "pk" }], p, "Matematik")).toBe(true);
    expect(paketBildirimiGitti([{ olay: "paketBitiyor", ogrenciId: "o", metin: "x", paketId: "pk2" }], p, "Matematik")).toBe(false);
    const eski = [{ olay: "duyuru" as const, ogrenciId: "o", metin: "Paket: Matematik paketinizde 1 ders hakkı kaldı." }];
    expect(paketBildirimiGitti(eski, p, "Matematik")).toBe(true);
    expect(paketBildirimiGitti(eski, { ...p, kalan: 0 }, "Matematik")).toBe(false);
  });
});
