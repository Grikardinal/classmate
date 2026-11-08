import { describe, expect, it } from "vitest";
import { ornekVeriUret, type Gider, type Kayit, type Rol, type Tahsilat, type Taksit, type Virman } from "@/data/model";
import { taksitPlani } from "@/lib/kurallar";
import {
  beklenenTahsil,
  ekHizmetlerEngeli,
  giderEngeli,
  gunSonuOzeti,
  indirimlerEngeli,
  kalan,
  kasaBakiyesi,
  kasaErisimi,
  kasaGecerli,
  kasaHareketleri,
  kayitUcretEngeli,
  kayitUcreti,
  odemeFarklari,
  otomatikHatirlatmaUygun,
  planToplamEngeli,
  sezonAylari,
  tahsilatEngeli,
  tahsilatIptalEngeli,
  taksitYazmaEngeli,
  tutarCoz,
  tutarGecerli,
  vadesiGecenler,
  virmanEngeli,
  yeniMakbuzNo,
  yontemKasa,
  yuzde,
} from "./kurallar";

const d = ornekVeriUret();
const BUGUN = "2026-11-07";
const finansli = { ...d, moduller: { ...d.moduller, finans: true } };

describe("örnek veri finans kurallarına uyuyor", () => {
  it("taksitler geçerli, ödenen tutarı aşmaz, toplam tahsilat dağılımı tutarlı", () => {
    for (const t of d.taksitler) {
      expect(tutarGecerli(t.tutar), t.id).toBe(true);
      expect(t.odenen <= t.tutar).toBe(true);
    }
    for (const t of d.tahsilatlar) expect(tahsilatEngeli(t, d, { finans: true }), t.id).toBeNull();
    const nolar = d.tahsilatlar.map((t) => t.makbuzNo);
    expect(new Set(nolar).size).toBe(nolar.length);
  });
});

describe("tutar ve kuruş", () => {
  it("geçerli tutar: sonlu, pozitif (veya izinliyse sıfır), en fazla iki ondalık, üst sınır altında", () => {
    for (const n of [0.01, 1, 12500.5, 99_999_999.99]) expect(tutarGecerli(n), String(n)).toBe(true);
    for (const n of [0, -1, 0.001, NaN, Infinity, 100_000_001, "5"]) expect(tutarGecerli(n), String(n)).toBe(false);
    expect(tutarGecerli(0, { sifirOlur: true })).toBe(true);
    expect(tutarGecerli(0.1 + 0.2)).toBe(true); // 0.30000000000000004 kuruş hassasiyetinde
  });
  it("ekrandaki tutar Türkçe biçimle çözülür", () => {
    expect(tutarCoz("1.250,50")).toBe(1250.5);
    expect(tutarCoz("1250,5")).toBe(1250.5);
    expect(tutarCoz("1250.50")).toBe(1250.5);
    expect(tutarCoz("1.250")).toBe(1250);
    expect(tutarCoz("₺ 12 500")).toBe(12500);
    expect(tutarCoz("12,345")).toBeNaN();
    expect(tutarCoz("-5")).toBeNaN();
    expect(tutarCoz("abc")).toBeNaN();
    expect(tutarCoz("")).toBeNaN();
  });
});

describe("kayıt ücreti", () => {
  it("indirim kuruşa yuvarlanır, ek hizmet indirimsiz eklenir, net hiçbir zaman negatif olmaz", () => {
    expect(kayitUcreti(13500, [{ ad: "Kardeş indirimi", oran: 10 }], [])).toMatchObject({ oran: 10, net: 12150, indirimTutari: 1350 });
    expect(kayitUcreti(12345.67, [{ ad: "Erken kayıt", oran: 5 }], ["Kitap seti"]).net).toBe(12928.39); // 11728.39 + 1200
    expect(kayitUcreti(1000, [{ ad: "x", oran: 80 }, { ad: "y", oran: 80 }], []).net).toBe(0); // %100 üst sınır
    expect(kayitUcreti(1000, [{ ad: "x", oran: -50 }], []).net).toBe(1000); // negatif oran indirim sayılmaz
    expect(kayitUcreti(0, [], ["Yaz okulu"]).hizmetTutari).toBe(4500);
  });
  it("indirimler yalnızca tanımlı türler, her biri bir kez; ek hizmetler tanımlı ve tekil", () => {
    expect(indirimlerEngeli([{ ad: "Kardeş indirimi", oran: 10 }, { ad: "Erken kayıt", oran: 5 }])).toBeNull();
    expect(indirimlerEngeli([{ ad: "Kardeş indirimi", oran: 15 }])).toMatch(/tanımlı/);
    expect(indirimlerEngeli([{ ad: "Burs", oran: 100 }])).toMatch(/tanımlı/);
    expect(indirimlerEngeli([{ ad: "Erken kayıt", oran: 5 }, { ad: "Erken kayıt", oran: 5 }])).toMatch(/iki kez/);
    expect(indirimlerEngeli("x")).not.toBeNull();
    expect(ekHizmetlerEngeli(["Kitap seti"])).toBeNull();
    expect(ekHizmetlerEngeli(["Uçuş dersi"])).toMatch(/tanımlı/);
    expect(ekHizmetlerEngeli(["Kitap seti", "Kitap seti"])).toMatch(/iki kez/);
  });
  const g1Kayit = (p: Partial<Kayit> = {}): Kayit => ({
    id: "k-t", ogrenciId: "o-t", sezonId: "z2", subeId: "s1", grupId: "g1", sozlesmeNo: "", durum: "aktif", tarih: BUGUN, grupGecmisi: [],
    ekHizmetler: [], kvkkOnay: null, listeFiyati: 13500, indirimler: [], net: 13500, ...p,
  });
  it("yeni kayıt: fiyat listesindeki fiyat, tutarlı net; fiyat tanımsızsa kayıt açılmaz", () => {
    expect(kayitUcretEngeli(g1Kayit(), undefined, finansli, { rol: "sekreter" })).toBeNull();
    expect(kayitUcretEngeli(g1Kayit({ listeFiyati: 13000, net: 13000 }), undefined, finansli, { rol: "genel-yonetici" })).toMatch(/fiyat listesi/);
    expect(kayitUcretEngeli(g1Kayit({ net: 13499.99 }), undefined, finansli, { rol: "sekreter" })).toMatch(/Net/);
    expect(kayitUcretEngeli(g1Kayit({ sezonId: "z1" }), undefined, finansli, { rol: "sekreter" })).toMatch(/tanımlı değil/);
    expect(kayitUcretEngeli(g1Kayit({ listeFiyati: -1, net: -1 }), undefined, finansli, { rol: "genel-yonetici" })).toMatch(/negatif/);
  });
  it("ücretsiz kayıt yalnızca yönetici veya içe aktarma; finans kapalıyken ücret yazılmaz", () => {
    const bedava = g1Kayit({ listeFiyati: 0, net: 0 });
    expect(kayitUcretEngeli(bedava, undefined, finansli, { rol: "sekreter" })).toMatch(/Ücretsiz/);
    expect(kayitUcretEngeli(bedava, undefined, finansli, { rol: "sube-muduru" })).toBeNull();
    expect(kayitUcretEngeli({ ...bedava, iceAktarmaId: "ia1" }, undefined, finansli, { rol: "sekreter" })).toBeNull();
    expect(kayitUcretEngeli(g1Kayit(), undefined, d, { rol: "genel-yonetici" })).toMatch(/kapalı/);
    expect(kayitUcretEngeli(bedava, undefined, d, { rol: "sekreter" })).toBeNull();
    expect(kayitUcretEngeli(g1Kayit({ net: 1 }), g1Kayit(), d, { rol: "genel-yonetici" })).toMatch(/kapalı/);
  });
  it("var olan kayıtta ücret alanı değişmiyorsa denetlenmez; değişirse yalnızca yönetici", () => {
    const eski = g1Kayit({ listeFiyati: 9999, net: 1 }); // eski / tutarsız veri kilitlenmez
    expect(kayitUcretEngeli({ ...eski, grupId: "g2" }, eski, finansli, { rol: "sekreter" })).toBeNull();
    const ind = [{ ad: "Kardeş indirimi", oran: 10 }];
    const yeni = g1Kayit({ indirimler: ind, net: 12150 });
    expect(kayitUcretEngeli(yeni, g1Kayit(), finansli, { rol: "sekreter" })).toMatch(/yalnızca yönetici/);
    expect(kayitUcretEngeli(yeni, g1Kayit(), finansli, { rol: "sube-muduru" })).toBeNull();
  });
  it("kayıtla gelen ödeme planı toplamı kuruşu kuruşuna net tutar; ek kalemler hariç", () => {
    const plan = taksitPlani(10000.01, 1000, 3, "2026-12-05").map((p) => ({ ...p }));
    expect(planToplamEngeli(10000.01, plan)).toBeNull();
    expect(planToplamEngeli(10000, plan)).toMatch(/toplamı/);
    expect(planToplamEngeli(10000.01, [...plan, { no: 99, tutar: 3600 }])).toBeNull();
    expect(planToplamEngeli(10000, [])).toBeNull(); // plan sonradan (sezon geçişi)
  });
});

describe("taksit", () => {
  const k = d.kayitlar.find((x) => x.durum === "aktif")!;
  const o = d.ogrenciler.find((x) => x.id === k.ogrenciId)!;
  const tk = (p: Partial<Taksit> = {}): Taksit => ({ id: "tk-t", kayitId: k.id, ogrenciId: o.id, veliId: o.birincilVeliId, subeId: k.subeId, no: 1, vade: "2026-12-05", tutar: 1000, odenen: 0, ...p });
  const sec = (p: Partial<{ finans: boolean; rol: Rol; odenenFarki: number }> = {}) => ({ finans: true, rol: "sekreter" as Rol, odenenFarki: 0, ...p });
  it("yeni taksit kuralları", () => {
    expect(taksitYazmaEngeli(tk(), undefined, d, sec())).toBeNull();
    expect(taksitYazmaEngeli(tk(), undefined, d, sec({ finans: false }))).toMatch(/kapalı/);
    expect(taksitYazmaEngeli(tk({ subeId: "sX" }), undefined, d, sec())).toMatch(/şubesiyle/);
    expect(taksitYazmaEngeli(tk({ odenen: 1 }), undefined, d, sec())).toMatch(/sıfır/);
    expect(taksitYazmaEngeli(tk({ tutar: 10.001 }), undefined, d, sec())).toMatch(/kuruş/);
    expect(taksitYazmaEngeli(tk({ vade: "5 Aralık" }), undefined, d, sec())).toMatch(/vade/);
    expect(taksitYazmaEngeli(tk({ no: -1 }), undefined, d, sec())).toMatch(/sıra/);
    expect(taksitYazmaEngeli(tk({ kayitId: "yok" }), undefined, d, sec())).toMatch(/bulunamadı/);
  });
  it("ödenen yalnızca tahsilat farkı kadar değişir; fazla tahsilat yok", () => {
    const eski = tk({ odenen: 200 });
    expect(taksitYazmaEngeli(tk({ odenen: 700 }), eski, d, sec({ odenenFarki: 50000 }))).toBeNull();
    expect(taksitYazmaEngeli(tk({ odenen: 700 }), eski, d, sec())).toMatch(/tahsilat/);
    expect(taksitYazmaEngeli(tk({ odenen: 1200 }), eski, d, sec({ odenenFarki: 100000 }))).toMatch(/Fazla tahsilat/);
    expect(taksitYazmaEngeli(tk({ odenen: -100 }), eski, d, sec({ odenenFarki: -30000 }))).toMatch(/negatif/);
  });
  it("tutar / vade yalnızca yönetici; ödenenin altına inemez; şube yalnızca kayıtla", () => {
    const eski = tk({ odenen: 400 });
    expect(taksitYazmaEngeli(tk({ odenen: 400, tutar: 500 }), eski, d, sec())).toMatch(/yönetici/);
    expect(taksitYazmaEngeli(tk({ odenen: 400, tutar: 500 }), eski, d, sec({ rol: "sube-muduru" }))).toBeNull();
    expect(taksitYazmaEngeli(tk({ odenen: 400, tutar: 300 }), eski, d, sec({ rol: "sube-muduru" }))).toMatch(/altına/);
    expect(taksitYazmaEngeli(tk({ odenen: 400, subeId: "s9" }), eski, d, sec())).toMatch(/kaydıyla/);
    expect(taksitYazmaEngeli(tk({ odenen: 400, no: 2 }), eski, d, sec())).toMatch(/değiştirilemez/);
  });
  it("iptal / dondurulmuş kaydın taksitine otomatik hatırlatma gitmez; borç silinmez", () => {
    const t = tk();
    expect(otomatikHatirlatmaUygun(t, [{ id: k.id, durum: "aktif" }])).toBe(true);
    expect(otomatikHatirlatmaUygun(t, [{ id: k.id, durum: "mezun" }])).toBe(true);
    expect(otomatikHatirlatmaUygun(t, [{ id: k.id, durum: "iptal" }])).toBe(false);
    expect(otomatikHatirlatmaUygun(t, [{ id: k.id, durum: "dondurulmus" }])).toBe(false);
    expect(otomatikHatirlatmaUygun(tk({ odenen: 1000 }), [{ id: k.id, durum: "aktif" }])).toBe(false);
    expect(kalan(t)).toBe(1000);
  });
  it("vadesi geçenler ve beklenen / tahsil özeti kuruş hassasiyetinde", () => {
    const l = [tk({ vade: "2026-10-05", tutar: 0.1, odenen: 0 }), tk({ id: "b", vade: "2026-10-05", tutar: 0.2, odenen: 0.2 }), tk({ id: "c", vade: "2026-12-05" })];
    expect(vadesiGecenler(l, BUGUN).map((t) => t.id)).toEqual(["tk-t"]);
    expect(beklenenTahsil(l)).toEqual({ beklenen: 1000.3, tahsil: 0.2 });
    expect(yuzde(1, 3)).toBe(33);
    expect(yuzde(5, 0)).toBe(0);
  });
});

describe("tahsilat", () => {
  const tk = d.taksitler.find((t) => t.subeId === "s1" && kalan(t) > 0)!;
  const th = (p: Partial<Tahsilat> = {}): Tahsilat => ({
    id: "th-t", makbuzNo: "MRK-M-99999", zaman: "", veliId: tk.veliId, subeId: tk.subeId, alinanSubeId: "s1", tutar: 100, yontem: "nakit",
    dagilim: [{ taksitId: tk.id, tutar: 100 }], iptal: null, kullanici: "", ...p,
  });
  it("geçerli tahsilat; dağılım toplamı = tutar; kasa = taksitin şubesi; ödeyen velinin çocuğu", () => {
    expect(tahsilatEngeli(th(), d, { finans: true, kapsam: ["s1"] })).toBeNull();
    expect(tahsilatEngeli(th(), d, { finans: false })).toMatch(/kapalı/);
    expect(tahsilatEngeli(th({ tutar: 100.01 }), d, { finans: true })).toMatch(/dağıtılan toplam/);
    expect(tahsilatEngeli(th({ subeId: "s2" }), d, { finans: true })).toMatch(/kayıtlı olduğu şube/);
    expect(tahsilatEngeli(th({ veliId: "v-yok" }), d, { finans: true })).toMatch(/ödeyen velinin/);
    expect(tahsilatEngeli(th({ alinanSubeId: "s2" }), d, { finans: true, kapsam: ["s1"] })).toMatch(/kapsam/);
    expect(tahsilatEngeli(th({ alinanSubeId: "yok" }), d, { finans: true })).toMatch(/bulunamadı/);
    expect(tahsilatEngeli(th({ dagilim: [{ taksitId: tk.id, tutar: 50 }, { taksitId: tk.id, tutar: 50 }] }), d, { finans: true })).toMatch(/iki kez/);
    expect(tahsilatEngeli(th({ iptal: { neden: "x", kullanici: "", zaman: "" } }), d, { finans: true })).toMatch(/iptal/);
    expect(tahsilatEngeli(th({ makbuzNo: " " }), d, { finans: true })).toMatch(/Makbuz/);
  });
  it("iptal: yalnızca yönetici, gerekçeli, başka alan değişmeden; iptal geri alınamaz", () => {
    const eski = th();
    const iptal = { neden: "Mükerrer giriş", kullanici: "", zaman: "" };
    expect(tahsilatIptalEngeli(eski, { ...eski, iptal }, "sube-muduru")).toBeNull();
    expect(tahsilatIptalEngeli(eski, { ...eski, iptal }, "sekreter")).toMatch(/şube müdürü/);
    expect(tahsilatIptalEngeli(eski, { ...eski, iptal: { ...iptal, neden: "ab" } }, "genel-yonetici")).toMatch(/gerekçe/);
    expect(tahsilatIptalEngeli(eski, { ...eski, tutar: 1 }, "genel-yonetici")).toMatch(/değiştirilemez/);
    expect(tahsilatIptalEngeli(eski, { ...eski, tutar: 1, iptal }, "genel-yonetici")).toMatch(/değiştirilemez/);
    expect(tahsilatIptalEngeli({ ...eski, iptal }, eski, "genel-yonetici")).toMatch(/İptal edilmiş/);
  });
  it("ödeme farkları: yeni tahsilat artırır, iptal azaltır (kuruş)", () => {
    const m = odemeFarklari([th({ dagilim: [{ taksitId: "a", tutar: 0.1 }, { taksitId: "b", tutar: 0.2 }] })], [th({ dagilim: [{ taksitId: "a", tutar: 0.1 }] })]);
    expect(m.get("a")).toBe(0);
    expect(m.get("b")).toBe(20);
  });
  it("makbuz no şube kodu başına sıradaki numara", () => {
    expect(yeniMakbuzNo("MRK", ["MRK-M-00007", "KZY-M-00010", "MRK-M-00002", "bozuk"])).toBe("MRK-M-00008");
    expect(yeniMakbuzNo("BTI", ["MRK-M-00007"])).toBe("BTI-M-00001");
  });
});

describe("kasa", () => {
  const tahsilat = (p: Partial<Tahsilat>): Tahsilat => ({
    id: "t1", makbuzNo: "MRK-M-1", zaman: "2026-11-05T10:00", veliId: "v", subeId: "s1", alinanSubeId: "s2", tutar: 1000, yontem: "nakit", dagilim: [], iptal: null, kullanici: "", ...p,
  });
  const hareket = {
    tahsilatlar: [
      tahsilat({}),
      tahsilat({ id: "t2", tutar: 500, yontem: "havale", iptal: { neden: "Hatalı", kullanici: "", zaman: "2026-11-07T09:00" } }),
    ],
    giderler: [{ id: "g1", tarih: "2026-11-06", subeId: "s1", kategori: "Kırtasiye", aciklama: "", tutar: 200.5, kasa: "nakit" } as Gider],
    virmanlar: [{ id: "v1", tarih: "2026-11-07", kaynak: "s1:nakit", hedef: "merkez:banka", tutar: 300, aciklama: "" } as Virman],
  };
  const h = kasaHareketleri(hareket);
  it("tahsilat öğrencinin şubesinin kasasına yazılır (alındığı şube değil); yöntem kasası", () => {
    expect(yontemKasa("havale")).toBe("banka");
    expect(kasaBakiyesi(h, "s2:nakit")).toBe(0);
    expect(kasaBakiyesi(h, "s1:nakit")).toBe(499.5);
    expect(kasaBakiyesi(h, "merkez:banka")).toBe(300);
  });
  it("iptal edilen tahsilat geçmişi değiştirmez: girişi kendi gününde, ters kaydı iptal gününde", () => {
    expect(h.filter((x) => x.ref === "t2").map((x) => [x.tur, x.tarih.slice(0, 10)])).toEqual([["tahsilatIptali", "2026-11-07"], ["tahsilat", "2026-11-05"]]);
    expect(kasaBakiyesi(h, "s1:banka", "2026-11-06")).toBe(500); // dünün gün sonu bakiyesi korunur
    expect(kasaBakiyesi(h, "s1:banka")).toBe(0);
  });
  it("gün sonu: açılış + giriş − çıkış = kapanış", () => {
    expect(gunSonuOzeti(h, "s1:nakit", "2026-11-07")).toEqual({ acilis: 799.5, giris: 0, cikis: 300, kapanis: 499.5 });
    expect(gunSonuOzeti(h, "s1:banka", "2026-11-07")).toEqual({ acilis: 500, giris: 0, cikis: 500, kapanis: 0 });
  });
  it("kasa kimliği ve erişim: Genel Merkez yalnızca banka ve yalnızca genel yönetici", () => {
    expect(kasaGecerli("s1:pos", d.subeler)).toBe(true);
    expect(kasaGecerli("merkez:banka", d.subeler)).toBe(true);
    for (const k of ["merkez:nakit", "s9:nakit", "s1:kasa", "s1:nakit:x", 5]) expect(kasaGecerli(k, d.subeler), String(k)).toBe(false);
    expect(kasaErisimi("merkez:banka", { genel: false, kapsam: ["s1"] })).toBe(false);
    expect(kasaErisimi("s2:nakit", { genel: false, kapsam: ["s1"] })).toBe(false);
    expect(kasaErisimi("s1:nakit", { genel: false, kapsam: ["s1"] })).toBe(true);
    expect(kasaErisimi("merkez:banka", { genel: true, kapsam: [] })).toBe(true);
  });
  const sec = { finans: true, genel: false, bugun: BUGUN };
  it("gider kuralları; girilen gider değiştirilemez", () => {
    const g: Gider = { id: "gd", tarih: BUGUN, subeId: "s1", kategori: "Kira", aciklama: "Kasım", tutar: 45000, kasa: "banka" };
    expect(giderEngeli(g, undefined, d, sec)).toBeNull();
    expect(giderEngeli(g, g, d, sec)).toMatch(/değiştirilemez/);
    expect(giderEngeli({ ...g, tarih: "2026-11-08" }, undefined, d, sec)).toMatch(/bugünden sonra/);
    expect(giderEngeli({ ...g, tutar: 0 }, undefined, d, sec)).toMatch(/tutar/);
    expect(giderEngeli({ ...g, kasa: "kasa" as Gider["kasa"] }, undefined, d, sec)).toMatch(/Kasa/);
    expect(giderEngeli({ ...g, subeId: "merkez" }, undefined, d, sec)).toMatch(/Genel Merkez/);
    expect(giderEngeli({ ...g, subeId: "merkez" }, undefined, d, { ...sec, genel: true })).toBeNull();
    expect(giderEngeli(g, undefined, d, { ...sec, finans: false })).toMatch(/kapalı/);
  });
  it("virman kuralları: bakiye, farklı ve geçerli kasa, merkez kaynağı", () => {
    const v: Virman = { id: "vr", tarih: BUGUN, kaynak: "s1:nakit", hedef: "merkez:banka", tutar: 499.5, aciklama: "" };
    const bakiye = (k: string) => kasaBakiyesi(h, k);
    expect(virmanEngeli(v, undefined, d, { ...sec, bakiye })).toBeNull();
    expect(virmanEngeli({ ...v, tutar: 499.51 }, undefined, d, { ...sec, bakiye })).toMatch(/bakiye/);
    expect(virmanEngeli({ ...v, hedef: v.kaynak }, undefined, d, { ...sec, bakiye })).toMatch(/aynı/);
    expect(virmanEngeli({ ...v, kaynak: "merkez:banka", hedef: "s1:banka", tutar: 1 }, undefined, d, { ...sec, bakiye })).toMatch(/Genel Merkez/);
    expect(virmanEngeli({ ...v, tarih: "2026-12-01" }, undefined, d, { ...sec, bakiye })).toMatch(/tarih/);
    expect(virmanEngeli(v, v, d, { ...sec, bakiye })).toMatch(/değiştirilemez/);
  });
});

describe("özet", () => {
  it("sezon ayları başlangıçtan bitişe (en fazla 12)", () => {
    expect(sezonAylari({ baslangic: "2026-09-07", bitis: "2027-06-18" })).toEqual([
      "2026-09", "2026-10", "2026-11", "2026-12", "2027-01", "2027-02", "2027-03", "2027-04", "2027-05", "2027-06",
    ]);
    expect(sezonAylari({ baslangic: "2027-07-01", bitis: "2027-08-15" })).toEqual(["2027-07", "2027-08"]);
    expect(sezonAylari(undefined)).toEqual([]);
  });
});
