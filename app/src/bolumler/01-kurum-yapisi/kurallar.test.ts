import { describe, expect, it } from "vitest";
import { ornekVeriUret, type DersSaati, type Grup, type Kayit } from "@/data/model";
import {
  aktifSezonDenetle,
  dersDogrula,
  dersKisaAdi,
  dersSaatiDogrula,
  dersSaatiSilmeEngeli,
  dersSaatleriniSirala,
  derslikDogrula,
  derslikSilmeEngeli,
  fiyatListesiDogrula,
  grupAdiGecisi,
  grupDogrula,
  kapasiteDuzelt,
  kapasiteGecerli,
  kurumDogrula,
  pasifEki,
  programAtamaEngeli,
  secilebilirTanimlar,
  sezonDogrula,
  sezonGecisEngeli,
  sezonGecisHedefleri,
  sezonGecisiPlani,
  subeDogrula,
  subeKopyasi,
  subePasifeAlmaEngeli,
  tanimAktif,
} from "./kurallar";

let sayac = 0;
const sahteId = (p: string) => `${p}T${++sayac}`;
const d = ornekVeriUret();

describe("örnek veri bölüm 01 kurallarına uyuyor", () => {
  it("şube, sezon, ders, derslik, ders saati ve gruplar geçerli", () => {
    for (const s of d.subeler) expect(subeDogrula(s, d.subeler), s.ad).toBeNull();
    for (const s of d.sezonlar) expect(sezonDogrula(s, d.sezonlar), s.ad).toBeNull();
    expect(aktifSezonDenetle(d.sezonlar)).toBeNull();
    for (const x of d.dersler) expect(dersDogrula(x, d.dersler), x.ad).toBeNull();
    for (const x of d.derslikler) expect(derslikDogrula(x, d.derslikler), x.ad).toBeNull();
    for (const h of d.dersSaatleri) expect(dersSaatiDogrula(h, d.dersSaatleri), h.id).toBeNull();
    for (const g of d.gruplar) expect(grupDogrula(g, d), g.ad).toBeNull();
    expect(kurumDogrula(d.kurum)).toBeNull();
    expect(fiyatListesiDogrula(d.fiyatListesi)).toBeNull();
  });
});

describe("kapasite ve fiyat", () => {
  it("kapasite 1–500 arası tam sayı", () => {
    expect(kapasiteGecerli(14)).toBe(true);
    for (const k of [0, -3, 1.5, NaN, 501, "14"]) expect(kapasiteGecerli(k), String(k)).toBe(false);
  });
  it("ekrandan gelen kapasite geçerli değere çevrilir", () => {
    expect(kapasiteDuzelt("")).toBe(1);
    expect(kapasiteDuzelt("-5")).toBe(1);
    expect(kapasiteDuzelt("12.7")).toBe(12);
    expect(kapasiteDuzelt("9999")).toBe(500);
    expect(kapasiteDuzelt("abc")).toBe(1);
  });
  it("fiyat listesi negatif veya sayı olmayan değer içeremez", () => {
    expect(fiyatListesiDogrula({ s1: 0, s2: 12000.5 })).toBeNull();
    expect(fiyatListesiDogrula({ s1: -1 })).not.toBeNull();
    expect(fiyatListesiDogrula({ s1: NaN })).not.toBeNull();
    expect(fiyatListesiDogrula({ s1: "100" })).not.toBeNull();
    expect(fiyatListesiDogrula(null)).not.toBeNull();
  });
});

describe("kurum bilgileri", () => {
  const k = { ad: "Kurum", eposta: "", vergiNo: "", makbuzBasligi: "" };
  it("ad boş olamaz, e-posta ve vergi no biçimi denetlenir", () => {
    expect(kurumDogrula(k)).toBeNull();
    expect(kurumDogrula({ ...k, ad: "  " })).toMatch(/ad/);
    expect(kurumDogrula({ ...k, eposta: "yanlis@" })).toMatch(/E-posta/);
    expect(kurumDogrula({ ...k, vergiNo: "12AB" })).toMatch(/Vergi/);
    expect(kurumDogrula({ ...k, vergiNo: "123 456 7890" })).toBeNull();
  });
  it("logo yalnızca PNG/JPEG/SVG veri adresi ve en fazla 200 KB", () => {
    expect(kurumDogrula({ ...k, logo: "data:image/png;base64,AAAA" })).toBeNull();
    expect(kurumDogrula({ ...k, logo: "javascript:alert(1)" })).toMatch(/Logo/);
    expect(kurumDogrula({ ...k, logo: "data:image/png;base64," + "A".repeat(300 * 1024) })).toMatch(/200 KB/);
  });
});

describe("şubeler", () => {
  it("ad dolu, kod 2–5 harf, ikisi de benzersiz (büyük/küçük harf ve boşluk farkı sayılmaz)", () => {
    expect(subeDogrula({ ad: "Batı", kod: "bti" }, d.subeler)).toBeNull();
    expect(subeDogrula({ ad: "", kod: "BTI" }, d.subeler)).toMatch(/adı/);
    expect(subeDogrula({ ad: "Batı", kod: "B" }, d.subeler)).toMatch(/2–5/);
    expect(subeDogrula({ ad: "Batı", kod: "B2" }, d.subeler)).toMatch(/2–5/);
    expect(subeDogrula({ ad: "Batı", kod: "mrk" }, d.subeler)).toMatch(/kod/);
    expect(subeDogrula({ ad: "  merkez ", kod: "MRZ" }, d.subeler)).toMatch(/şube zaten/);
  });
  it("düzenlenen şube kendi koduyla çakışmaz", () => {
    expect(subeDogrula({ id: "s1", ad: "Merkez", kod: "MRK" }, d.subeler)).toBeNull();
  });
  it("aktif sezonda kaydı olan şube pasife alınamaz; geçmiş sezon ve iptal engel değil", () => {
    const k = (subeId: string, sezonId: string, durum: Kayit["durum"]) => ({ subeId, sezonId, durum });
    expect(subePasifeAlmaEngeli("s1", [k("s1", "z2", "aktif")], "z2")).toMatch(/1 aktif/);
    expect(subePasifeAlmaEngeli("s1", [k("s1", "z2", "dondurulmus")], "z2")).not.toBeNull();
    expect(subePasifeAlmaEngeli("s1", [k("s1", "z2", "iptal"), k("s1", "z1", "aktif"), k("s2", "z2", "aktif")], "z2")).toBeNull();
  });
  it("yeni şube sihirbazı derslik ve ders saatlerini yeni kimlikle kopyalar", () => {
    const k = subeKopyasi("s1", "sYeni", d, { derslik: true, saat: false }, sahteId);
    expect(k.derslikler).toHaveLength(d.derslikler.filter((x) => x.subeId === "s1").length);
    expect(k.derslikler.every((x) => x.subeId === "sYeni" && !d.derslikler.some((y) => y.id === x.id))).toBe(true);
    expect(k.dersSaatleri).toHaveLength(0);
    expect(d.derslikler.every((x) => x.subeId !== "sYeni")).toBe(true); // kaynak değişmez
  });
});

describe("sezonlar", () => {
  it("ad dolu ve benzersiz, bitiş başlangıçtan sonra", () => {
    const f = { ad: "2027-2028", baslangic: "2027-09-06", bitis: "2028-06-16" };
    expect(sezonDogrula(f, d.sezonlar)).toBeNull();
    expect(sezonDogrula({ ...f, ad: " 2026-2027 " }, d.sezonlar)).toMatch(/zaten/);
    expect(sezonDogrula({ ...f, bitis: "2027-09-06" }, d.sezonlar)).toMatch(/Bitiş/);
    expect(sezonDogrula({ ...f, baslangic: "" }, d.sezonlar)).toMatch(/tarih/);
    expect(sezonDogrula({ ...f, ad: "" }, d.sezonlar)).toMatch(/adı/);
  });
  it("tam olarak bir aktif sezon olur", () => {
    expect(aktifSezonDenetle([{ aktif: true }, { aktif: false }])).toBeNull();
    expect(aktifSezonDenetle([{ aktif: false }])).toMatch(/aktif sezon seçili/);
    expect(aktifSezonDenetle([{ aktif: true }, { aktif: true }])).toMatch(/yalnızca bir/);
  });
});

describe("yeni sezona geçiş", () => {
  const kaynak = d.sezonlar.find((s) => s.aktif)!;
  it("hedef yalnızca daha sonra başlayan sezonlardır", () => {
    expect(sezonGecisHedefleri(d.sezonlar, kaynak).map((s) => s.id)).toEqual(["z3"]);
  });
  it("grup adı seviyeyle birlikte artar", () => {
    expect(grupAdiGecisi("5-A", 6)).toBe("6-A");
    expect(grupAdiGecisi("Hızlı Grup", 6)).toBe("Hızlı Grup");
  });
  it("8. sınıflar mezun olur, diğer gruplar seviye +1 ile kopyalanır", () => {
    const p = sezonGecisiPlani(d, "z2", "z3", false, sahteId);
    const kaynakGruplar = d.gruplar.filter((g) => g.sezonId === "z2");
    expect(p.mezunGrupSayisi).toBe(kaynakGruplar.filter((g) => g.seviye === 8).length);
    expect(p.gruplar).toHaveLength(kaynakGruplar.length - p.mezunGrupSayisi);
    expect(p.gruplar.every((g) => g.sezonId === "z3" && g.seviye >= 4 && g.seviye <= 8)).toBe(true);
    expect(p.gruplar.find((g) => g.ad === "6-A" && g.subeId === "s1")).toBeTruthy();
    expect(p.kayitlar).toHaveLength(0);
    for (const g of p.gruplar) expect(grupDogrula(g, { ...d, gruplar: [...d.gruplar, ...p.gruplar] }), g.ad).toBeNull();
  });
  it("taşınan kayıtlar yeni sözleşme no alır, KVKK onayı sıfırlanır, içe aktarma bağı kopyalanmaz", () => {
    const x = ornekVeriUret();
    const ilk = x.kayitlar.find((k) => k.sezonId === "z2" && k.durum === "aktif" && x.gruplar.find((g) => g.id === k.grupId)!.seviye < 8)!;
    ilk.iceAktarmaId = "ia1";
    const p = sezonGecisiPlani(x, "z2", "z3", true, sahteId);
    const tasinacak = x.kayitlar.filter((k) => k.sezonId === "z2" && k.durum === "aktif" && x.gruplar.find((g) => g.id === k.grupId)!.seviye < 8);
    expect(p.kayitlar).toHaveLength(tasinacak.length);
    const nolar = [...x.kayitlar.map((k) => k.sozlesmeNo), ...p.kayitlar.map((k) => k.sozlesmeNo)];
    expect(new Set(nolar).size).toBe(nolar.length);
    for (const k of p.kayitlar) {
      expect(k.sezonId).toBe("z3");
      expect(k.kvkkOnay).toBeNull();
      expect(k.iceAktarmaId).toBeUndefined();
      expect(k.tarih).toBe("2027-07-01");
      expect(k.sozlesmeNo).toMatch(/^(MRK|KZY)-2027-\d{4}$/);
      expect(p.gruplar.some((g) => g.id === k.grupId)).toBe(true);
    }
  });
  it("pasif veya şubeden çıkmış rehber öğretmen yeni gruba taşınmaz", () => {
    const x = ornekVeriUret();
    x.personel = x.personel.map((p) => (p.id === "p4" ? { ...p, aktif: false } : p));
    const p = sezonGecisiPlani(x, "z2", "z3", false, sahteId);
    expect(p.gruplar.find((g) => g.ad === "4-A" && g.subeId === "s1")!.rehberId).toBe("");
    expect(p.gruplar.find((g) => g.ad === "6-A")!.rehberId).toBe("p5");
  });
  it("hedefte grup varsa geçiş iki kez yapılamaz", () => {
    expect(sezonGecisEngeli(d, "z2", "z3")).toBeNull();
    expect(sezonGecisEngeli(d, "z2", "z2")).not.toBeNull();
    expect(sezonGecisEngeli(d, undefined, "z3")).toMatch(/Aktif sezon/);
    const g: Grup = { ...d.gruplar[0], id: "gx", sezonId: "z3" };
    expect(sezonGecisEngeli({ gruplar: [...d.gruplar, g] }, "z2", "z3")).toMatch(/iki kez/);
  });
});

describe("gruplar", () => {
  const taban = { id: "", subeId: "s1", sezonId: "z2", seviye: 5, ad: "5-B", kapasite: 14, derslikId: "d1" };
  it("geçerli grup", () => expect(grupDogrula(taban, d)).toBeNull());
  it("ad şube + sezon içinde benzersiz (Türkçe büyük/küçük harf duyarsız)", () => {
    expect(grupDogrula({ ...taban, ad: " 5-a " }, d)).toMatch(/aynı adlı/);
    expect(grupDogrula({ ...taban, ad: "5-A", subeId: "s2", derslikId: "" }, d)).toBeNull();
    expect(grupDogrula({ ...taban, ad: "5-A", sezonId: "z3" }, d)).toBeNull();
    expect(grupDogrula({ ...taban, id: "g2", ad: "5-A" }, d)).toBeNull(); // kendisi
  });
  it("boş ad, geçersiz seviye ve kapasite reddedilir", () => {
    expect(grupDogrula({ ...taban, ad: "" }, d)).toMatch(/adı/);
    expect(grupDogrula({ ...taban, seviye: 9 }, d)).toMatch(/Seviye/);
    expect(grupDogrula({ ...taban, seviye: 2 }, d)).toMatch(/Seviye/);
    expect(grupDogrula({ ...taban, kapasite: 0 }, d)).toMatch(/Kapasite/);
    expect(grupDogrula({ ...taban, kapasite: 2.5 }, d)).toMatch(/Kapasite/);
  });
  it("derslik grubun şubesine ait olmalı", () => {
    expect(grupDogrula({ ...taban, derslikId: "d4" }, d)).toMatch(/şubesine/);
    expect(grupDogrula({ ...taban, derslikId: "yok" }, d)).toMatch(/bulunamadı/);
    expect(grupDogrula({ ...taban, derslikId: "" }, d)).toBeNull();
  });
});

describe("dersler", () => {
  it("kısa ad girilmezse adın ilk 3 harfi büyük harfle", () => {
    expect(dersKisaAdi("İngilizce", "")).toBe("İNG");
    expect(dersKisaAdi("Okuma", " oku ")).toBe("OKU");
  });
  it("ad dolu ve benzersiz, kısa ad 1–4, renk #RRGGBB", () => {
    const f = { ad: "Okuma", kisaAd: "OKU", renk: "#0d9488" };
    expect(dersDogrula(f, d.dersler)).toBeNull();
    expect(dersDogrula({ ...f, ad: "matematik" }, d.dersler)).toMatch(/zaten/);
    expect(dersDogrula({ ...f, ad: "" }, d.dersler)).toMatch(/adı/);
    expect(dersDogrula({ ...f, kisaAd: "OKUMA" }, d.dersler)).toMatch(/Kısa/);
    expect(dersDogrula({ ...f, renk: "red" }, d.dersler)).toMatch(/Renk/);
  });
});

describe("derslikler", () => {
  it("ad dolu ve şube içinde benzersiz, kapasite geçerli", () => {
    const f = { subeId: "s1", ad: "Derslik 3", kapasite: 12 };
    expect(derslikDogrula(f, d.derslikler)).toBeNull();
    expect(derslikDogrula({ ...f, ad: "derslik 1" }, d.derslikler)).toMatch(/aynı adlı/);
    expect(derslikDogrula({ ...f, ad: "Derslik 1", subeId: "s2" }, d.derslikler)).toBeNull();
    expect(derslikDogrula({ ...f, ad: " " }, d.derslikler)).toMatch(/adı/);
    expect(derslikDogrula({ ...f, kapasite: -1 }, d.derslikler)).toMatch(/Kapasite/);
  });
  it("grupta veya ders programında (geçmiş dahil) kullanılan derslik silinemez", () => {
    expect(derslikSilmeEngeli("d1", d)).toMatch(/grubun/);
    expect(derslikSilmeEngeli("d3", { gruplar: [], program: [{ derslikId: "d3" }] })).toMatch(/programında/);
    expect(derslikSilmeEngeli("d3", { gruplar: [], program: [] })).toBeNull();
  });
});

describe("ders saatleri", () => {
  const saatler: DersSaati[] = d.dersSaatleri;
  const yeni = { id: "", subeId: "s1", gunTipi: "hafta-ici" as const, baslangic: "18:30", bitis: "19:10" };
  it("çakışmayan dilim eklenebilir; uç uca değmek çakışma değildir", () => {
    expect(dersSaatiDogrula(yeni, saatler)).toBeNull();
    expect(dersSaatiDogrula({ ...yeni, baslangic: "18:20", bitis: "19:00" }, saatler)).toBeNull();
  });
  it("aynı şube ve gün tipinde örtüşen dilim reddedilir", () => {
    expect(dersSaatiDogrula({ ...yeni, baslangic: "18:00", bitis: "18:45" }, saatler)).toMatch(/17:40–18:20/);
    expect(dersSaatiDogrula({ ...yeni, baslangic: "15:00", bitis: "19:00" }, saatler)).toMatch(/çakışıyor/);
  });
  it("başka şube veya başka gün tipi çakışma sayılmaz", () => {
    expect(dersSaatiDogrula({ ...yeni, subeId: "s3", baslangic: "16:00", bitis: "16:40" }, saatler)).toBeNull();
    expect(dersSaatiDogrula({ ...yeni, gunTipi: "hafta-sonu", baslangic: "16:00", bitis: "16:40" }, saatler)).toBeNull();
  });
  it("dilim kendisiyle çakışmaz (düzenleme)", () => {
    expect(dersSaatiDogrula(saatler[0], saatler)).toBeNull();
  });
  it("geçersiz saat ve ters aralık reddedilir", () => {
    expect(dersSaatiDogrula({ ...yeni, bitis: "18:30" }, saatler)).toMatch(/sonra/);
    expect(dersSaatiDogrula({ ...yeni, bitis: "18:00" }, saatler)).toMatch(/sonra/);
    expect(dersSaatiDogrula({ ...yeni, baslangic: "" }, saatler)).toMatch(/SS:DD/);
    expect(dersSaatiDogrula({ ...yeni, baslangic: "25:00" }, saatler)).toMatch(/SS:DD/);
    expect(dersSaatiDogrula({ ...yeni, gunTipi: "pazar" as never }, saatler)).toMatch(/Gün tipi/);
  });
  it("programda kullanılan ders saati silinemez", () => {
    expect(dersSaatiSilmeEngeli("h1", d.program)).not.toBeNull();
    expect(dersSaatiSilmeEngeli("hYok", d.program)).toBeNull();
  });
  it("sıra numaraları başlangıç saatine göre yeniden verilir, başka şubeye dokunulmaz", () => {
    const eklenmis = [...saatler, { id: "hx", subeId: "s1", gunTipi: "hafta-ici" as const, sira: 0, baslangic: "15:00", bitis: "15:40" }];
    const s = dersSaatleriniSirala(eklenmis, "s1");
    const ici = s.filter((h) => h.subeId === "s1" && h.gunTipi === "hafta-ici").sort((a, b) => a.sira - b.sira);
    expect(ici.map((h) => h.id)).toEqual(["hx", "h1", "h2", "h3"]);
    expect(ici.map((h) => h.sira)).toEqual([1, 2, 3, 4]);
    // Değişmeyen satırlar aynı nesne kalır (sunucuya yalnızca değişenler gider)
    const s2 = dersSaatleriniSirala(saatler, "s1");
    expect(s2.every((h, i) => h === saatler[i])).toBe(true);
  });
});

describe("derslik ve ders saati: aktif / pasif", () => {
  const pasifli = {
    ...d,
    derslikler: d.derslikler.map((x) => (x.id === "d3" ? { ...x, aktif: false } : x)),
    dersSaatleri: d.dersSaatleri.map((h) => (h.id === "h3" ? { ...h, aktif: false } : h)),
  };
  it("aktif alanı olmayan eski kayıt aktif sayılır; yalnızca aktif:false pasiftir", () => {
    expect(tanimAktif({})).toBe(true);
    expect(tanimAktif({ aktif: true })).toBe(true);
    expect(tanimAktif({ aktif: false })).toBe(false);
    expect(tanimAktif(undefined)).toBe(false);
    const { aktif: _a, ...eski } = d.derslikler[0];
    void _a;
    expect(derslikDogrula(eski, d.derslikler)).toBeNull();
    expect(pasifEki(eski as { aktif?: boolean })).toBe(""); // alanı olmayan eski kayıt
    expect(pasifEki({ aktif: false })).toBe(" (pasif)");
  });
  it("örnek veride tüm derslik ve ders saatleri aktif", () => {
    expect(d.derslikler.every((x) => x.aktif === true)).toBe(true);
    expect(d.dersSaatleri.every((h) => h.aktif === true)).toBe(true);
  });
  it("aktiflik değeri boolean olmalı", () => {
    expect(derslikDogrula({ subeId: "s1", ad: "Derslik 3", kapasite: 12, aktif: "hayır" }, d.derslikler)).toMatch(/geçersiz/);
    expect(dersSaatiDogrula({ id: "", subeId: "s1", gunTipi: "hafta-ici", baslangic: "18:30", bitis: "19:10", aktif: 0 }, d.dersSaatleri)).toMatch(/geçersiz/);
    expect(dersSaatiDogrula({ ...d.dersSaatleri[0], aktif: false }, d.dersSaatleri)).toBeNull();
  });
  it("seçim listesi pasifleri çıkarır, mevcut seçili pasif kaydı tutar", () => {
    const s1 = pasifli.derslikler.filter((x) => x.subeId === "s1");
    expect(secilebilirTanimlar(s1).map((x) => x.id)).toEqual(["d1", "d2"]);
    expect(secilebilirTanimlar(s1, "d3").map((x) => x.id)).toEqual(["d1", "d2", "d3"]);
  });
  it("gruba pasif derslik atanamaz", () => {
    const taban = { id: "", subeId: "s1", sezonId: "z2", seviye: 5, ad: "5-B", kapasite: 14, derslikId: "d3" };
    expect(grupDogrula(taban, pasifli)).toMatch(/pasif/);
    expect(grupDogrula(taban, d)).toBeNull();
  });
  it("yeni program satırı pasif derslik veya ders saatine konamaz", () => {
    expect(programAtamaEngeli({ derslikId: "d3", saatId: "h1" }, undefined, pasifli)).toMatch(/derslik pasif/);
    expect(programAtamaEngeli({ derslikId: "d1", saatId: "h3" }, undefined, pasifli)).toMatch(/saati pasif/);
    expect(programAtamaEngeli({ derslikId: "d1", saatId: "h1" }, undefined, pasifli)).toBeNull();
  });
  it("değişmemiş eski atama kilitlenmez; yalnızca değişen alan denetlenir", () => {
    const eski = { derslikId: "d3", saatId: "h3" };
    expect(programAtamaEngeli(eski, eski, pasifli)).toBeNull();
    expect(programAtamaEngeli({ derslikId: "d1", saatId: "h3" }, eski, pasifli)).toBeNull();
    expect(programAtamaEngeli({ derslikId: "d3", saatId: "h3" }, { derslikId: "d1", saatId: "h3" }, pasifli)).toMatch(/derslik pasif/);
  });
  it("pasif olsa da kullanılmış kayıt silinemez; kullanılmamış pasif kayıt silinebilir", () => {
    expect(derslikSilmeEngeli("d3", { gruplar: [], program: [{ derslikId: "d3" }] })).toMatch(/pasife alınabilir/);
    expect(dersSaatiSilmeEngeli("h3", [{ saatId: "h3" }])).toMatch(/pasife alınabilir/);
    expect(dersSaatiSilmeEngeli("h3", [])).toBeNull();
  });
});
