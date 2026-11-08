/**
 * Bölüm 05'in sunucu tarafı: server/politika.ts · yazmaDenetle → finansDenetle (+ kayıt ücret maskesi) ve okumaSuz.
 * Veritabanı açılmaz: örnek veri + değişiklik paketi (store.guncelle ile aynı fark hesabı).
 */
import { describe, expect, it } from "vitest";
import { aktifKayit, ornekVeriUret, type Db, type Gider, type Kayit, type Tahsilat, type Taksit, type Virman } from "@/data/model";
import { farkHesapla, farkUygula, type Degisiklik } from "@/data/fark";
import { tahsilatDagit, taksitPlani } from "@/lib/kurallar";
import { YetkiHatasi, okumaSuz, yazmaDenetle, type Aktor } from "../../../server/politika";
import { sezonGecisiPlani } from "../01-kurum-yapisi/kurallar";
import { kalan, kayitUcreti, kurus, yeniMakbuzNo } from "./kurallar";

const KAPALI = ornekVeriUret(); // varsayılan: finans modülü kapalı
const F: Db = { ...structuredClone(KAPALI), moduller: { ...KAPALI.moduller, finans: true } };
const aktor = (kullaniciId: string, kaynak: Db = F): Aktor => {
  const kullanici = kaynak.kullanicilar.find((k) => k.id === kullaniciId)!;
  return { kullanici, personel: kaynak.personel.find((p) => p.id === kullanici.personelId)! };
};
const YONETICI = aktor("u0");
const GUL = aktor("u9"); // sekreter · s1
const MUDUR_S1 = aktor("u1"); // şube müdürü · s1
const OGRETMEN = aktor("u4");
const ZAMAN = "2026-11-07T10:00";
const BUGUN = ZAMAN.slice(0, 10);

function dene(fn: (x: Db) => void, a: Aktor = GUL, kaynak: Db = F) {
  const taslak = { ...kaynak } as Db;
  for (const k of Object.keys(taslak) as (keyof Db)[]) {
    const v = taslak[k];
    if (Array.isArray(v)) (taslak as Record<string, unknown>)[k] = [...v];
    else if (v && typeof v === "object") (taslak as Record<string, unknown>)[k] = { ...(v as object) };
  }
  fn(taslak);
  const fark: Degisiklik = farkHesapla(kaynak, taslak);
  return () => yazmaDenetle(kaynak, farkUygula(kaynak, fark), fark, a, ZAMAN);
}
const reddedilir = (f: () => unknown, mesaj?: RegExp) => {
  expect(f).toThrow(YetkiHatasi);
  if (mesaj) expect(f).toThrow(mesaj);
};
const yaz = <T>(t: Degisiklik, k: keyof Degisiklik["koleksiyonlar"]) => (t.koleksiyonlar[k]?.yaz ?? []) as unknown as T[];

/** Tüm çocukları s1'de olan, açık borcu bulunan veli */
const cocuklari = (d: Db, veliId: string) => d.ogrenciler.filter((o) => o.veliIds.includes(veliId));
const s1Veli = F.veliler.find((v) => {
  const c = cocuklari(F, v.id);
  return c.length > 0 && c.every((o) => aktifKayit(F, o.id)?.subeId === "s1") && F.taksitler.some((t) => c.some((o) => o.id === t.ogrenciId) && kalan(t) > 0);
})!;

/** Hızlı tahsilat ekranının paketi: en eski taksitten dağıtım, taksitlerin ödenen tutarı güncellenir */
const tahsil = (veliId: string, tutar: number, p: Partial<Tahsilat> = {}, ek?: (x: Db, t: Tahsilat) => void) => (x: Db) => {
  const ids = new Set(cocuklari(x, veliId).map((o) => o.id));
  const acik = x.taksitler.filter((t) => ids.has(t.ogrenciId) && kalan(t) > 0).sort((a, b) => a.vade.localeCompare(b.vade) || a.no - b.no);
  const { dagilim } = tahsilatDagit(tutar, acik.map((t) => ({ id: t.id, kalan: kalan(t) })));
  const subeId = x.taksitler.find((t) => t.id === dagilim[0].taksitId)!.subeId;
  const kod = x.subeler.find((s) => s.id === subeId)!.kod;
  const t: Tahsilat = {
    id: "th-test", makbuzNo: yeniMakbuzNo(kod, x.tahsilatlar.map((y) => y.makbuzNo)), zaman: "2000-01-01T00:00", veliId, subeId, alinanSubeId: subeId,
    yontem: "nakit", tutar, dagilim, iptal: null, kullanici: "sahte", ...p,
  };
  x.tahsilatlar.push(t);
  x.taksitler = x.taksitler.map((tk) => {
    const dg = t.dagilim.find((z) => z.taksitId === tk.id);
    return dg ? { ...tk, odenen: kurus(tk.odenen + dg.tutar) } : tk;
  });
  ek?.(x, t);
};

/** Kayıt sihirbazının paketi: yeni veli + öğrenci + kayıt (g1 = s1 · 3. sınıf, aktif sezon fiyatı 13.500 TL) + isteğe bağlı plan */
const sihirbaz = (p: Partial<Kayit> = {}, plan?: { pesinat: number; taksit: number }) => (x: Db) => {
  x.veliler.push({ id: "v-yeni", ad: "Seda", soyad: "Kaya", telefon: "0532 111 22 33", eposta: "", yakinlik: "Anne", pushAcik: false, portalDavet: "gonderildi", izinSms: true, izinTanitim: false });
  x.ogrenciler.push({ id: "o-yeni", ad: "Ecrin", soyad: "Kaya", dogum: "2015-05-05", cinsiyet: "K", okul: "", okulSinifi: "", saglikNotu: "", veliIds: ["v-yeni"], birincilVeliId: "v-yeni", durum: "aktif", notlar: [] });
  const k: Kayit = {
    id: "k-yeni", ogrenciId: "o-yeni", sezonId: "z2", subeId: "s1", grupId: "g1", sozlesmeNo: "MRK-2026-0900", durum: "aktif", tarih: BUGUN,
    grupGecmisi: [{ grupId: "g1", tarih: BUGUN }], ekHizmetler: ["Kitap seti"], kvkkOnay: { tarih: BUGUN, surum: "v1.2" },
    listeFiyati: 13500, indirimler: [{ ad: "Erken kayıt", oran: 5 }], net: kayitUcreti(13500, [{ ad: "Erken kayıt", oran: 5 }], ["Kitap seti"]).net, ...p,
  };
  x.kayitlar.push(k);
  if (plan)
    for (const t of taksitPlani(k.net, plan.pesinat, plan.taksit, "2026-12-05"))
      x.taksitler.push({ id: `tk-y${t.no}`, kayitId: k.id, ogrenciId: "o-yeni", veliId: "v-yeni", subeId: "s1", no: t.no, vade: t.vade, tutar: t.tutar, odenen: 0 });
};

describe("modül kapalıyken (varsayılan)", () => {
  it("tahsilat, yeni taksit, gider ve virman yazılamaz", () => {
    reddedilir(dene(tahsil(s1Veli.id, 100), GUL, KAPALI), /kapalı/);
    const k = KAPALI.kayitlar.find((x) => x.subeId === "s1" && x.durum === "aktif")!;
    const o = KAPALI.ogrenciler.find((x) => x.id === k.ogrenciId)!;
    reddedilir(dene((x) => x.taksitler.push({ id: "tk-yeni", kayitId: k.id, ogrenciId: o.id, veliId: o.birincilVeliId, subeId: "s1", no: 99, vade: BUGUN, tutar: 100, odenen: 0 }), GUL, KAPALI), /kapalı/);
    reddedilir(dene((x) => x.giderler.push({ id: "gd-t", tarih: BUGUN, subeId: "s1", kategori: "Kira", aciklama: "Kasım", tutar: 10, kasa: "nakit" }), GUL, KAPALI), /kapalı/);
    reddedilir(dene((x) => x.virmanlar.push({ id: "vr-t", tarih: BUGUN, kaynak: "s1:nakit", hedef: "s1:banka", tutar: 1, aciklama: "" }), GUL, KAPALI), /kapalı/);
  });
  it("yeni kayda ücret yazılmaz (sunucu sıfırlar), ödeme planı oluşturulamaz; taksitin ödenen tutarı değiştirilemez", () => {
    expect(yaz<Kayit>(dene(sihirbaz(), GUL, KAPALI)(), "kayitlar")[0]).toMatchObject({ listeFiyati: 0, net: 0, indirimler: [], ekHizmetler: ["Kitap seti"] });
    reddedilir(dene(sihirbaz({}, { pesinat: 0, taksit: 2 }), GUL, KAPALI), /kapalı/);
    const tk = KAPALI.taksitler.find((t) => t.subeId === "s1" && t.odenen === 0)!;
    reddedilir(dene((x) => (x.taksitler = x.taksitler.map((t) => (t.id === tk.id ? { ...t, odenen: t.tutar } : t))), YONETICI, KAPALI), /tahsilat/);
  });
  it("finans verisi kimseye gitmez; kayıtların ücret alanları sıfırlanır", () => {
    for (const a of [aktor("u0", KAPALI), aktor("u9", KAPALI)]) {
      const v = okumaSuz(KAPALI, a);
      expect(v.taksitler).toHaveLength(0);
      expect(v.tahsilatlar).toHaveLength(0);
      expect(v.giderler).toHaveLength(0);
      expect(v.kayitlar.every((k) => k.net === 0 && k.listeFiyati === 0 && k.indirimler.length === 0)).toBe(true);
    }
  });
  it("maskeli kaydı düzenleyen kullanıcı ücret bilgisini silemez (sunucu eski değeri korur)", () => {
    const k = KAPALI.kayitlar.find((x) => x.subeId === "s1" && x.durum === "aktif" && x.net > 0)!;
    const t = dene((x) => (x.kayitlar = x.kayitlar.map((y) => (y.id === k.id ? { ...y, durum: "dondurulmus", net: 0, listeFiyati: 0, indirimler: [] } : y))), aktor("u9", KAPALI), KAPALI)();
    expect(yaz<Kayit>(t, "kayitlar")[0]).toMatchObject({ durum: "dondurulmus", net: k.net, listeFiyati: k.listeFiyati });
  });
  it("şube naklinde kalan taksitler ekran göndermese de sunucuda yeni şubeye devredilir", () => {
    // Emre (u10) s1 + s2 sekreteri: kapsam içi nakil; finans kapalı, taksitleri görmüyor
    const k = KAPALI.kayitlar.find((x) => x.subeId === "s1" && x.durum === "aktif" && x.grupId === "g2")!; // 5. sınıf
    const v = structuredClone(KAPALI);
    v.gruplar.push({ ...v.gruplar.find((g) => g.id === "g5")!, id: "g-s2-5", seviye: 5, ad: "5-X", kapasite: 40 });
    const t = dene(
      (x) => (x.kayitlar = x.kayitlar.map((y) => (y.id === k.id ? { ...y, subeId: "s2", grupId: "g-s2-5", grupGecmisi: [...y.grupGecmisi, { grupId: "g-s2-5", tarih: BUGUN }] } : y))),
      aktor("u10", v),
      v,
    )();
    const devir = yaz<Taksit>(t, "taksitler");
    const acik = KAPALI.taksitler.filter((x) => x.kayitId === k.id && kalan(x) > 0);
    expect(devir.map((x) => x.id).sort()).toEqual(acik.map((x) => x.id).sort());
    expect(devir.every((x) => x.subeId === "s2")).toBe(true);
  });
});

describe("okuma (modül açık)", () => {
  it("sekreter yalnızca kendi şubesinin finans verisini görür; Genel Merkez gideri yalnızca genel yönetici", () => {
    const v = okumaSuz(F, GUL);
    expect(v.taksitler.length).toBeGreaterThan(0);
    expect(v.taksitler.every((t) => t.subeId === "s1")).toBe(true);
    expect(v.tahsilatlar.every((t) => t.subeId === "s1")).toBe(true);
    expect(v.giderler.some((g) => g.subeId === "merkez")).toBe(false);
    expect(okumaSuz(F, YONETICI).giderler.some((g) => g.subeId === "merkez")).toBe(true);
    expect(v.kayitlar.some((k) => k.net > 0)).toBe(true);
  });
  it("öğretmen ve 05 yetkisi kaldırılan rol finans verisi ve kayıt ücreti görmez", () => {
    const o = okumaSuz(F, OGRETMEN);
    expect(o.taksitler).toHaveLength(0);
    expect(o.kayitlar.every((k) => k.net === 0 && k.indirimler.length === 0)).toBe(true);
    const yetkisiz = structuredClone(F);
    yetkisiz.rolYetkileri.sekreter["05"] = false;
    const s = okumaSuz(yetkisiz, aktor("u9", yetkisiz));
    expect(s.taksitler).toHaveLength(0);
    expect(s.tahsilatlar).toHaveLength(0);
    expect(s.kayitlar.every((k) => k.net === 0)).toBe(true);
  });
});

describe("tahsilat", () => {
  it("geçerli tahsilat kabul edilir; tahsil eden ve zaman sunucudan", () => {
    const t = dene(tahsil(s1Veli.id, 250.5))();
    const [th] = yaz<Tahsilat>(t, "tahsilatlar");
    expect(th).toMatchObject({ kullanici: "Gül Koç", zaman: ZAMAN, tutar: 250.5 });
    expect(yaz<Taksit>(t, "taksitler").length).toBeGreaterThan(0);
  });
  it("makbuz no çakışırsa sunucu şubenin sıradaki numarasını verir", () => {
    const eski = F.tahsilatlar.find((x) => x.subeId === "s1")!.makbuzNo;
    const t = dene(tahsil(s1Veli.id, 100, { makbuzNo: eski }))();
    const no = yaz<Tahsilat>(t, "tahsilatlar")[0].makbuzNo;
    expect(no).not.toBe(eski);
    expect(no).toBe(yeniMakbuzNo("MRK", F.tahsilatlar.map((x) => x.makbuzNo)));
  });
  it("tutar dağılım toplamından farklı, kuruştan küçük veya sıfır olamaz", () => {
    reddedilir(dene(tahsil(s1Veli.id, 100, { tutar: 150 })), /dağıtılan toplam/);
    reddedilir(dene(tahsil(s1Veli.id, 100.005)), /kuruş/);
    reddedilir(dene(tahsil(s1Veli.id, 100, { tutar: 0, dagilim: [] })), /sıfırdan büyük|en az bir/);
  });
  it("fazla tahsilat (taksitin ödeneni tutarını aşar) reddedilir", () => {
    const tk = F.taksitler.find((t) => cocuklari(F, s1Veli.id).some((o) => o.id === t.ogrenciId) && kalan(t) > 0)!;
    const fazla = kurus(kalan(tk) + 50);
    reddedilir(
      dene((x) => {
        x.tahsilatlar.push({ id: "th-f", makbuzNo: "MRK-M-90000", zaman: "", veliId: s1Veli.id, subeId: "s1", alinanSubeId: "s1", yontem: "nakit", tutar: fazla, dagilim: [{ taksitId: tk.id, tutar: fazla }], iptal: null, kullanici: "" });
        x.taksitler = x.taksitler.map((t) => (t.id === tk.id ? { ...t, odenen: kurus(t.odenen + fazla) } : t));
      }),
      /Fazla tahsilat/,
    );
  });
  it("taksitin ödeneni tahsilatsız artırılamaz; tahsilat taksiti güncellemeden yazılamaz", () => {
    const tk = F.taksitler.find((t) => t.subeId === "s1" && kalan(t) > 0)!;
    reddedilir(dene((x) => (x.taksitler = x.taksitler.map((t) => (t.id === tk.id ? { ...t, odenen: t.tutar } : t)))), /tahsilat/);
    reddedilir(dene(tahsil(s1Veli.id, 100, {}, (x, t) => {
      x.taksitler = x.taksitler.map((y) => (t.dagilim.some((z) => z.taksitId === y.id) ? F.taksitler.find((e) => e.id === y.id)! : y));
    })), /aynı işlemde/);
  });
  it("başka velinin çocuğuna, yanlış şube kasasına veya kapsam dışı 'alındığı şube'ye yazılamaz", () => {
    const baskaVeli = F.veliler.find((v) => v.id !== s1Veli.id && !cocuklari(F, v.id).some((o) => cocuklari(F, s1Veli.id).includes(o)))!;
    reddedilir(dene(tahsil(s1Veli.id, 100, { veliId: baskaVeli.id })), /ödeyen velinin/);
    reddedilir(dene(tahsil(s1Veli.id, 100, { alinanSubeId: "s2" })), /alındığı şube/);
    // Kasa (subeId) taksitin şubesi değilse: genel yönetici bile yazamaz
    reddedilir(dene(tahsil(s1Veli.id, 100, { subeId: "s2" }), YONETICI), /kayıtlı olduğu şube/);
    reddedilir(dene(tahsil(s1Veli.id, 100, { yontem: "kripto" as Tahsilat["yontem"] })), /yöntem/);
  });
  it("öğretmen tahsilat ve taksit yazamaz", () => {
    reddedilir(dene(tahsil(s1Veli.id, 100), OGRETMEN), /yetkiniz yok|Öğretmen/);
    const tk = F.taksitler.find((t) => t.subeId === "s1")!;
    reddedilir(dene((x) => (x.taksitler = x.taksitler.map((t) => (t.id === tk.id ? { ...t, vade: "2027-01-01" } : t))), OGRETMEN), /Öğretmen/);
  });
});

describe("tahsilat iptali (geri alınamaz, silinmez)", () => {
  const th = F.tahsilatlar.find((t) => t.subeId === "s1" && !t.iptal)!;
  const iptal = (neden = "Yanlış öğrenciye girildi", taksitDuzelt = true, ek: Partial<Tahsilat> = {}) => (x: Db) => {
    x.tahsilatlar = x.tahsilatlar.map((t) => (t.id === th.id ? { ...t, ...ek, iptal: { neden, kullanici: "", zaman: "" } } : t));
    if (taksitDuzelt)
      x.taksitler = x.taksitler.map((tk) => {
        const dg = th.dagilim.find((z) => z.taksitId === tk.id);
        return dg ? { ...tk, odenen: kurus(tk.odenen - dg.tutar) } : tk;
      });
  };
  it("şube müdürü gerekçeyle iptal eder; taksit yeniden açılır, iptal eden sunucudan", () => {
    const t = dene(iptal(), MUDUR_S1)();
    expect(yaz<Tahsilat>(t, "tahsilatlar")[0].iptal).toMatchObject({ kullanici: "Elif Yılmaz", zaman: ZAMAN });
  });
  it("sekreter iptal edemez; gerekçesiz, taksit düzeltilmeden veya tutar değiştirilerek iptal edilemez", () => {
    reddedilir(dene(iptal(), GUL), /şube müdürü/);
    reddedilir(dene(iptal(" a "), MUDUR_S1), /gerekçe/);
    reddedilir(dene(iptal(undefined, false), MUDUR_S1), /aynı işlemde/);
    reddedilir(dene(iptal(undefined, true, { tutar: 1 }), MUDUR_S1), /değiştirilemez/);
  });
  it("iptal geri alınamaz; tahsilat silinemez veya düzenlenemez", () => {
    const v = structuredClone(F);
    iptal()(v);
    reddedilir(dene((x) => (x.tahsilatlar = x.tahsilatlar.map((t) => (t.id === th.id ? { ...t, iptal: null } : t))), aktor("u1", v), v), /İptal edilmiş/);
    reddedilir(dene((x) => (x.tahsilatlar = x.tahsilatlar.filter((t) => t.id !== th.id)), YONETICI), /silinemez/);
    reddedilir(dene((x) => (x.tahsilatlar = x.tahsilatlar.map((t) => (t.id === th.id ? { ...t, yontem: "pos" } : t))), YONETICI), /değiştirilemez/);
  });
});

describe("kayıt ücreti ve ödeme planı", () => {
  it("fiyat listesinden ücret + kuruşu kuruşuna plan kabul edilir", () => {
    expect(kayitUcreti(13500, [{ ad: "Erken kayıt", oran: 5 }], ["Kitap seti"]).net).toBe(14025);
    const t = dene(sihirbaz({}, { pesinat: 1000.33, taksit: 7 }))();
    const plan = yaz<Taksit>(t, "taksitler");
    expect(plan.reduce((s, x) => s + Math.round(x.tutar * 100), 0)).toBe(1402500);
  });
  it("liste fiyatı listeden farklı, fiyat tanımsız veya net uyuşmazsa reddedilir", () => {
    reddedilir(dene(sihirbaz({ listeFiyati: 10000, net: kayitUcreti(10000, [{ ad: "Erken kayıt", oran: 5 }], ["Kitap seti"]).net })), /fiyat listesi/);
    reddedilir(dene(sihirbaz({ net: 100 })), /Net tutar/);
    const fiyatsiz = { ...F, fiyatListesi: F.fiyatListesi.filter((f) => !(f.sezonId === "z2" && f.subeId === "s1" && f.seviye === 3)) };
    reddedilir(dene(sihirbaz(), GUL, fiyatsiz), /fiyat tanımlı değil/);
  });
  it("plan toplamı net tutara eşit değilse reddedilir", () => {
    reddedilir(dene((x) => {
      sihirbaz({}, { pesinat: 0, taksit: 3 })(x);
      x.taksitler = x.taksitler.map((t) => (t.id === "tk-y1" ? { ...t, tutar: kurus(t.tutar + 0.01) } : t));
    }), /toplamı/);
  });
  it("tanımsız / yinelenen indirim ve sekreterin ücretsiz kaydı reddedilir; yönetici ücretsiz kayıt yapabilir", () => {
    reddedilir(dene(sihirbaz({ indirimler: [{ ad: "Burs", oran: 100 }], net: 1200 })), /tanımlı indirim/);
    reddedilir(dene(sihirbaz({ indirimler: [{ ad: "Erken kayıt", oran: 50 }] })), /tanımlı indirim/);
    reddedilir(dene(sihirbaz({ indirimler: [{ ad: "Erken kayıt", oran: 5 }, { ad: "Erken kayıt", oran: 5 }] })), /iki kez/);
    reddedilir(dene(sihirbaz({ listeFiyati: 0, net: 0, indirimler: [], ekHizmetler: [] })), /Ücretsiz/);
    expect(dene(sihirbaz({ listeFiyati: 0, net: 0, indirimler: [], ekHizmetler: [] }), MUDUR_S1)).not.toThrow();
  });
  it("var olan kaydın indirimini yalnızca yönetici değiştirir; net tutar tutarlı olmalı", () => {
    const k = F.kayitlar.find((x) => x.subeId === "s1" && x.durum === "aktif" && x.indirimler.length === 0)!;
    const ind = [{ ad: "Personel yakını", oran: 20 }];
    const degistir = (net: number) => (x: Db) => void (x.kayitlar = x.kayitlar.map((y) => (y.id === k.id ? { ...y, indirimler: ind, net } : y)));
    const dogru = kayitUcreti(k.listeFiyati, ind, k.ekHizmetler).net;
    reddedilir(dene(degistir(dogru), GUL), /yalnızca yönetici/);
    expect(dene(degistir(dogru), MUDUR_S1)).not.toThrow();
    reddedilir(dene(degistir(dogru + 1), MUDUR_S1), /Net tutar/);
  });
  it("Bölüm 01 sezon geçişi paketi (finans açık) hedef sezon fiyatıyla kabul edilir; fiyat değiştirilirse reddedilir", () => {
    const gecis = (bozuk: boolean) => (x: Db) => {
      const plan = sezonGecisiPlani(x, "z2", "z3", true, (p) => `${p}-g-${Math.random().toString(36).slice(2, 8)}`);
      x.gruplar.push(...plan.gruplar);
      x.kayitlar.push(...plan.kayitlar.map((k, i) => (bozuk && i === 0 ? { ...k, listeFiyati: k.listeFiyati - 1000, net: k.net - 1000 } : k)));
    };
    const t = dene(gecis(false), YONETICI)();
    expect(yaz<Kayit>(t, "kayitlar").every((k) => k.listeFiyati === (k.subeId === "s1" ? 13500 : 12000) && k.indirimler.length === 0)).toBe(true);
    reddedilir(dene(gecis(true), YONETICI), /fiyat listesi/);
  });
});

describe("taksit", () => {
  const tk = F.taksitler.find((t) => t.subeId === "s1" && t.odenen === 0 && F.kayitlar.find((k) => k.id === t.kayitId)?.durum === "aktif")!;
  const odenmis = F.taksitler.find((t) => t.subeId === "s1" && t.odenen > 0 && t.odenen === t.tutar)!;
  const degistir = (id: string, p: Partial<Taksit>) => (x: Db) => void (x.taksitler = x.taksitler.map((t) => (t.id === id ? { ...t, ...p } : t)));
  it("tutar ve vadeyi yalnızca yönetici değiştirir; tutar ödenenin altına inemez", () => {
    reddedilir(dene(degistir(tk.id, { tutar: 1 }), GUL), /yalnızca yönetici/);
    expect(dene(degistir(tk.id, { tutar: 1, vade: "2027-01-10" }), MUDUR_S1)).not.toThrow();
    reddedilir(dene(degistir(odenmis.id, { tutar: kurus(odenmis.tutar - 1) }), MUDUR_S1), /altına/);
    reddedilir(dene(degistir(tk.id, { tutar: 0 }), MUDUR_S1), /sıfırdan büyük/);
  });
  it("kayıt, öğrenci, veli değiştirilemez; şube yalnızca kaydıyla birlikte değişir; taksit silinemez", () => {
    reddedilir(dene(degistir(tk.id, { veliId: "v-baska" }), MUDUR_S1), /değiştirilemez/);
    reddedilir(dene(degistir(tk.id, { subeId: "s2" }), YONETICI), /kaydıyla birlikte/);
    reddedilir(dene((x) => (x.taksitler = x.taksitler.filter((t) => t.id !== tk.id)), YONETICI), /silinemez/);
  });
  it("yeni taksit: süren kayda, kaydın şubesi ve öğrencisiyle, ödenen 0 (etüt paketi ek kalemi)", () => {
    const k = F.kayitlar.find((x) => x.id === tk.kayitId)!;
    const o = F.ogrenciler.find((x) => x.id === k.ogrenciId)!;
    const ek = (p: Partial<Taksit> = {}) => (x: Db) =>
      void x.taksitler.push({ id: "tk-ek", kayitId: k.id, ogrenciId: o.id, veliId: o.birincilVeliId, subeId: k.subeId, no: 99, vade: BUGUN, tutar: 3600, odenen: 0, ...p });
    expect(dene(ek())).not.toThrow();
    reddedilir(dene(ek({ odenen: 3600 })), /ödenen tutar sıfır/);
    reddedilir(dene(ek({ tutar: -5 })), /sıfırdan büyük/);
    reddedilir(dene(ek({ veliId: "v-yok" })), /velisi/);
    const iptalli = structuredClone(F);
    iptalli.kayitlar = iptalli.kayitlar.map((x) => (x.id === k.id ? { ...x, durum: "iptal" } : x));
    reddedilir(dene(ek(), aktor("u9", iptalli), iptalli), /Süren olmayan/);
  });
});

describe("gider ve virman", () => {
  const gider = (p: Partial<Gider> = {}) => (x: Db) =>
    void x.giderler.push({ id: "gd-t", tarih: BUGUN, subeId: "s1", kategori: "Kırtasiye", aciklama: "Toner", tutar: 1250.5, kasa: "nakit", ...p });
  const virman = (p: Partial<Virman> = {}) => (x: Db) => void x.virmanlar.push({ id: "vr-t", tarih: BUGUN, kaynak: "s1:nakit", hedef: "s1:banka", tutar: 100, aciklama: "", ...p });
  it("gider: geçerli kabul; gelecek tarih, boş açıklama, kapsam dışı ve Genel Merkez (yönetici dışı) reddedilir", () => {
    expect(dene(gider())).not.toThrow();
    reddedilir(dene(gider({ tarih: "2026-12-01" })), /bugünden sonra/);
    reddedilir(dene(gider({ aciklama: " " })), /açıklama/);
    reddedilir(dene(gider({ subeId: "s2" })), /kapsam/);
    reddedilir(dene(gider({ subeId: "merkez", kasa: "banka" }), MUDUR_S1), /kapsam|Genel Merkez/);
    expect(dene(gider({ subeId: "merkez", kasa: "banka" }), YONETICI)).not.toThrow();
  });
  it("girilen gider değiştirilemez ve silinemez", () => {
    const g = F.giderler.find((x) => x.subeId === "s1")!;
    reddedilir(dene((x) => (x.giderler = x.giderler.map((y) => (y.id === g.id ? { ...y, tutar: 1 } : y))), MUDUR_S1), /değiştirilemez/);
    reddedilir(dene((x) => (x.giderler = x.giderler.filter((y) => y.id !== g.id)), YONETICI), /silinemez/);
  });
  it("virman: geçerli kabul; yetersiz bakiye, aynı kasa, geçersiz kasa, başka şube ve Genel Merkez kaynağı (yönetici dışı) reddedilir", () => {
    expect(dene(virman())).not.toThrow();
    reddedilir(dene(virman({ tutar: 99_999_999 })), /bakiye/);
    reddedilir(dene(virman({ hedef: "s1:nakit" })), /aynı/);
    reddedilir(dene(virman({ hedef: "s1:kasa2" })), /geçersiz/);
    reddedilir(dene(virman({ hedef: "s2:banka" })), /kapsam/);
    reddedilir(dene(virman({ kaynak: "merkez:banka", hedef: "s1:banka", tutar: 1 }), MUDUR_S1), /Genel Merkez/);
    expect(dene(virman({ hedef: "merkez:banka" }), MUDUR_S1)).not.toThrow(); // şubeden merkeze aktarım
  });
});
