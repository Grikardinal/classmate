import { describe, expect, it } from "vitest";
import { ornekVeriUret, SURUM, varsayilanAyarlar, varsayilanRolYetkileri, type Db, type IceAktarma } from "@/data/model";
import { ANONIM_TELEFON, anonimMi } from "../03-on-kayit/kurallar";
import { ogrenciAnonimMi, veliAnonimMi } from "../04-ogrenciler/kurallar";
import {
  AKTARIM_EN_FAZLA_SATIR,
  FINANS_SAKLAMA_YIL,
  kvkkOtomatikAcik,
  kvkkOtomatikUygula,
  kvkkOtomatikZamani,
  otomatikAnonimlestirmePlani,
  acikBorc,
  finansSaklamaDoldu,
  KVKK_SILINDI,
  aktarimTablosuEngeli,
  anonimlestirmeEngeli,
  anonimlikleriKoru,
  ayarlarEngeli,
  ayrilmaTarihi,
  degisiklikPaketiEngeli,
  demoModu,
  dogumCoz,
  dosyaBoyutEngeli,
  geriAlmaEngeli,
  iceAktarmaSatirEngeli,
  ilkParolaEngeli,
  jsonIcerikMi,
  kisiDokumu,
  kvkkAnonimlestir,
  ogrenciAktarimGeriAl,
  ogrenciAktarimiUygula,
  ogrenciOnizleme,
  personelOnizleme,
  saklamasiDolanAdaylar,
  saklamasiDolanOgrenciler,
  uretimUyarilari,
  yedekAdiGecerli,
  yedekAdiUret,
  yedekDogrula,
  yedekSuresiDoldu,
  yedekTamamla,
} from "./kurallar";

const BUGUN = "2026-11-09";
const ZAMAN = `${BUGUN}T10:00`;
const yeni = () => structuredClone(ornekVeriUret());
const baglam = { kullanici: "Yönetici", bugun: BUGUN, zaman: ZAMAN };

describe("yedek", () => {
  it("ad kalıbı yol geçişini kabul etmez", () => {
    expect(yedekAdiGecerli("classmate-2026-11-09T03-00.json")).toBe(true);
    for (const a of ["../classmate-2026-11-09T03-00.json", "classmate-2026-11-09T03-00.json/../x", "..%2f.env", "classmate.json", ""]) expect(yedekAdiGecerli(a)).toBe(false);
  });
  it("üretilen ad kalıba uyar", () => expect(yedekAdiGecerli(yedekAdiUret(new Date("2026-11-09T00:05:00Z")))).toBe(true));
  it("saklama süresi 30 gün", () => {
    const simdi = new Date("2026-11-09T00:00:00Z").getTime();
    expect(yedekSuresiDoldu("2026-10-11T00:00:00Z", simdi)).toBe(false);
    expect(yedekSuresiDoldu("2026-10-09T00:00:00Z", simdi)).toBe(true);
  });
  it("örnek veri geçerli bir yedektir", () => expect(yedekDogrula(JSON.parse(JSON.stringify(yeni())), SURUM)).toBeNull());
  it("biçimi bozuk yedek reddedilir", () => {
    const d = () => JSON.parse(JSON.stringify(yeni()));
    expect(yedekDogrula(null, SURUM)).toBeTruthy();
    expect(yedekDogrula([], SURUM)).toBeTruthy();
    expect(yedekDogrula({ ...d(), surum: SURUM + 1 }, SURUM)).toBeTruthy();
    expect(yedekDogrula({ ...d(), kurum: undefined }, SURUM)).toBeTruthy();
    expect(yedekDogrula({ ...d(), ogrenciler: {} }, SURUM)).toBeTruthy();
    expect(yedekDogrula({ ...d(), kayitlar: [1] }, SURUM)).toMatch(/bozuk/);
    expect(yedekDogrula({ ...d(), ogrenciler: [{ ad: "kimliksiz" }] }, SURUM)).toMatch(/kimliksiz/);
    const o = d().ogrenciler[0];
    expect(yedekDogrula({ ...d(), ogrenciler: [o, o] }, SURUM)).toMatch(/aynı kimlikli/);
  });
  it("sonradan eklenen alanlar tamamlanır", () => {
    const y = JSON.parse(JSON.stringify(yeni()));
    delete y.yedekAtamalari;
    delete y.otomasyon;
    expect(yedekDogrula(y, SURUM)).toBeNull();
    const t = yedekTamamla(y);
    expect(t.yedekAtamalari).toEqual([]);
    expect(t.otomasyon).toEqual({});
  });
  it("geri yükleme, anonimleştirilmiş kişiyi geri getirmez; KVKK kaydı korunur", () => {
    const yedek = yeni();
    const mevcut = structuredClone(yedek) as Db;
    const o = yedek.ogrenciler[0];
    kvkkAnonimlestir(mevcut, "ogrenci", [o.id], baglam);
    const { db, sayi } = anonimlikleriKoru(mevcut, yedek, BUGUN);
    expect(sayi).toBe(1);
    expect(ogrenciAnonimMi(db.ogrenciler.find((x) => x.id === o.id)!)).toBe(true);
    expect(db.kvkk.length).toBe(yedek.kvkk.length + 1);
    expect(ogrenciAnonimMi(yedek.ogrenciler[0])).toBe(false); // girdi bozulmaz
  });
});

describe("üretim yapılandırması", () => {
  it("DEMO tanımsızsa üretimde kapalı, geliştirmede açık; açık değer önceliklidir", () => {
    expect(demoModu(undefined, true)).toBe(false);
    expect(demoModu("", true)).toBe(false);
    expect(demoModu(undefined, false)).toBe(true);
    expect(demoModu("1", true)).toBe(true);
    expect(demoModu("0", false)).toBe(false);
  });
  it("ilk yönetici parolası zorunlu ve kurala uygun", () => {
    expect(ilkParolaEngeli(undefined)).toMatch(/gerekli/);
    expect(ilkParolaEngeli("123")).toMatch(/uygun değil/);
    expect(ilkParolaEngeli("IlkParola2026")).toBeNull();
  });
  it("üretim uyarıları", () => {
    expect(uretimUyarilari({ uretim: false, demo: true, sms: "konsol", postgres: false })).toEqual([]);
    expect(uretimUyarilari({ uretim: true, demo: true, sms: "konsol", postgres: false })[0]).toMatch(/DEMO/);
    expect(uretimUyarilari({ uretim: true, demo: false, sms: "konsol", postgres: false })).toHaveLength(2);
    expect(uretimUyarilari({ uretim: true, demo: false, sms: "netgsm", postgres: true })).toEqual([]);
  });
  it("içerik türü tam eşleşir", () => {
    expect(jsonIcerikMi("application/json; charset=utf-8")).toBe(true);
    expect(jsonIcerikMi("APPLICATION/JSON")).toBe(true);
    expect(jsonIcerikMi("text/plain; application/json")).toBe(false);
    expect(jsonIcerikMi(undefined)).toBe(false);
  });
  it("değişiklik paketi biçimi", () => {
    expect(degisiklikPaketiEngeli({ koleksiyonlar: {}, tekil: {} })).toBeNull();
    expect(degisiklikPaketiEngeli({ koleksiyonlar: { ogrenciler: { yaz: [{ id: "a" }], sil: ["b"] } }, tekil: {} })).toBeNull();
    for (const k of [null, [], { koleksiyonlar: null, tekil: {} }, { koleksiyonlar: { x: 1 }, tekil: {} }, { koleksiyonlar: { x: { yaz: [1] } }, tekil: {} }, { koleksiyonlar: { x: { sil: [1] } }, tekil: {} }])
      expect(degisiklikPaketiEngeli(k)).toBeTruthy();
  });
});

describe("ayarlar", () => {
  const a = varsayilanAyarlar;
  it("varsayılanlar geçerli", () => expect(ayarlarEngeli({ ...a }, a)).toBeNull());
  it("sınır dışı değer reddedilir", () => {
    expect(ayarlarEngeli({ ...a, saklamaAyAday: 0 }, a)).toMatch(/Aday saklama/);
    expect(ayarlarEngeli({ ...a, oturumGun: 9999 }, a)).toMatch(/Veli oturum/);
    expect(ayarlarEngeli({ ...a, devamsizlikEsigi: 1.5 }, a)).toBeTruthy();
    expect(ayarlarEngeli({ ...a, hatirlatmaGunleri: "3" }, a)).toMatch(/hatırlatma/);
    expect(ayarlarEngeli({ ...a, hatirlatmaGunleri: [] }, a)).toMatch(/hatırlatma/);
    expect(ayarlarEngeli({ ...a, gelmeyenHakDussun: "evet" }, a)).toBeTruthy();
    expect(ayarlarEngeli(null, a)).toBeTruthy();
  });
  it("değişmeyen eski geçersiz değer kilitlemez", () => {
    const eski = { ...a, oturumGun: 999 };
    expect(ayarlarEngeli({ ...eski }, eski)).toBeNull();
  });
});

describe("Excel içe aktarma", () => {
  const eslesme = { adSoyad: 0, veliTelefon: 1, seviye: 2, sube: 3, grup: 4, dogum: 5 };
  const secenek = (d: Db) => ({ eslesme, subeModu: "sutun" as const, sabitSube: "s1", grupModu: "sutun" as const, kapsam: ["s1", "s2"], sezonId: d.sezonlar.find((z) => z.aktif)!.id, bugun: BUGUN });
  const grupVe = (d: Db) => {
    const sezonId = d.sezonlar.find((z) => z.aktif)!.id;
    const g = d.gruplar.find((x) => x.subeId === "s1" && x.sezonId === sezonId)!;
    return { g, sube: d.subeler.find((s) => s.id === "s1")!, sezonId };
  };
  it("boyut ve satır sınırı", () => {
    expect(dosyaBoyutEngeli(11 * 1024 * 1024)).toBeTruthy();
    expect(aktarimTablosuEngeli(1)).toMatch(/başlık/);
    expect(aktarimTablosuEngeli(AKTARIM_EN_FAZLA_SATIR + 2)).toMatch(/en çok/);
    expect(aktarimTablosuEngeli(AKTARIM_EN_FAZLA_SATIR + 1)).toBeNull();
  });
  it("doğum tarihi", () => {
    expect(dogumCoz("15.03.2015", BUGUN)).toBe("2015-03-15");
    expect(dogumCoz("2015-03-15", BUGUN)).toBe("2015-03-15");
    expect(dogumCoz("31.02.2015", BUGUN)).toBeNull();
    expect(dogumCoz("2030-01-01", BUGUN)).toBeNull();
    expect(dogumCoz("bilinmiyor", BUGUN)).toBeNull();
  });
  it("aktif sezonun yılı sözleşme numarasına yazılır", () => {
    const d = yeni();
    const { g, sube, sezonId } = grupVe(d);
    d.sezonlar = d.sezonlar.map((z) => (z.id === sezonId ? { ...z, baslangic: "2031-09-01" } : z));
    const o = ogrenciOnizleme(d, [["Ece Yıldız", "0532 111 22 33", String(g.seviye), sube.ad, g.ad, ""]], secenek(d));
    expect(o[0].hatalar).toEqual([]);
    const ids = ogrenciAktarimiUygula(d, o, sezonId, { partiId: "ia-t", dosya: "a.csv", kullanici: "Y", atlanan: 0, bugun: BUGUN, zaman: ZAMAN });
    expect(ids).toHaveLength(1);
    expect(d.kayitlar.find((k) => k.ogrenciId === ids[0])!.sozlesmeNo).toMatch(new RegExp(`^${sube.kod}-2031-`));
  });
  it("kapasite aşımı satır uyarısıdır, hata değildir", () => {
    const d = yeni();
    const { g, sube } = grupVe(d);
    d.gruplar = d.gruplar.map((x) => (x.id === g.id ? { ...x, kapasite: d.kayitlar.filter((k) => k.grupId === g.id && k.durum === "aktif").length + 1 } : x));
    const satir = (ad: string, tel: string) => [ad, tel, String(g.seviye), sube.ad, g.ad, ""];
    const o = ogrenciOnizleme(d, [satir("Ece Yıldız", "0532 111 22 33"), satir("Can Yıldız", "0532 111 22 34")], secenek(d));
    expect(o[0].uyarilar.join()).not.toMatch(/kapasite/);
    expect(o[1].uyarilar.join()).toMatch(/kapasitesi aşılıyor/);
    expect(o[1].hatalar).toEqual([]);
  });
  it("kapsam dışı şube, mükerrer ve uzun ad satırda hatadır", () => {
    const d = yeni();
    const { g, sube } = grupVe(d);
    expect(ogrenciOnizleme(d, [["Ece Yıldız", "0532 111 22 33", String(g.seviye), sube.ad, g.ad, ""]], { ...secenek(d), kapsam: ["s2"] })[0].hatalar.join()).toMatch(/kapsam/);
    const satir = ["Ece Yıldız", "0532 111 22 33", String(g.seviye), sube.ad, g.ad, ""];
    expect(ogrenciOnizleme(d, [satir, satir], secenek(d))[1].mukerrer).toBe(true);
    expect(ogrenciOnizleme(d, [["A".repeat(100) + " Y", "0532 111 22 33", String(g.seviye), sube.ad, g.ad, ""]], secenek(d))[0].hatalar.join()).toMatch(/uzun/);
  });
  it("geri alma veli eşleşmesini korur", () => {
    const d = yeni();
    const { g, sube, sezonId } = grupVe(d);
    const onceki = { o: d.ogrenciler.length, v: d.veliler.length, k: d.kayitlar.length };
    const o = ogrenciOnizleme(d, [["Ece Yıldız", "0532 111 22 33", String(g.seviye), sube.ad, g.ad, ""]], secenek(d));
    ogrenciAktarimiUygula(d, o, sezonId, { partiId: "ia-g", dosya: "a.csv", kullanici: "Y", atlanan: 0, bugun: BUGUN, zaman: ZAMAN });
    const p = d.iceAktarmalar[0];
    expect(geriAlmaEngeli(d, p)).toBeNull();
    ogrenciAktarimGeriAl(d, p, "Y");
    expect({ o: d.ogrenciler.length, v: d.veliler.length, k: d.kayitlar.length }).toEqual(onceki);
    expect(d.iceAktarmalar[0].geriAlindi).toBe(true);
    expect(geriAlmaEngeli(d, d.iceAktarmalar[0])).toMatch(/zaten/);
  });
  it("yoklaması veya ödemesi olan parti geri alınamaz", () => {
    const d = yeni();
    const o = d.ogrenciler[0];
    const parti = { ogrenciIds: [o.id], geriAlindi: false };
    d.taksitler = [];
    d.yoklamalar = {};
    d.izinler = [];
    d.randevular = [];
    d.paketler = [];
    expect(geriAlmaEngeli(d, parti)).toBeNull();
    d.yoklamalar = { x: { oturumId: "x", tarih: BUGUN, satirId: "s", grupId: "g", ogretmenId: "p", durumlar: { [o.id]: "geldi" as never }, konu: "", kayitZamani: ZAMAN } };
    expect(geriAlmaEngeli(d, parti)).toMatch(/geri alınamaz/);
  });
  it("personel e-postası Türkçe harf farkıyla da mükerrerdir", () => {
    const d = yeni();
    const k = d.kullanicilar[0];
    const yuksek = k.eposta.toUpperCase().replace(/I/g, "İ");
    const r = personelOnizleme(d, [["Yeni Kişi", "Öğretmen", "0532 777 88 99", yuksek, "", ""]], { adSoyad: 0, gorev: 1, telefon: 2, eposta: 3, sube: 4, brans: 5 }, ["s1"], true);
    expect(r[0].hatalar.join()).toMatch(/e-postayla/);
  });
  it("parti kaydında yalnızca geri alma işareti değişir", () => {
    const p: IceAktarma = { id: "i", zaman: ZAMAN, dosya: "a", ogrenciIds: [], veliIds: [], kayitIds: [], atlanan: 0, geriAlindi: false };
    expect(iceAktarmaSatirEngeli(p, undefined)).toBeNull();
    expect(iceAktarmaSatirEngeli({ ...p, geriAlindi: true }, undefined)).toBeTruthy();
    expect(iceAktarmaSatirEngeli({ ...p, geriAlindi: true }, p)).toBeNull();
    expect(iceAktarmaSatirEngeli(p, { ...p, geriAlindi: true })).toMatch(/yeniden/);
    expect(iceAktarmaSatirEngeli({ ...p, ogrenciIds: ["x"] }, p)).toMatch(/değiştirilemez/);
  });
});

describe("KVKK anonimleştirme", () => {
  it("öğrenci: kimlik, not, izin metni, gönderim ve işlem kaydı silinir; yoklama ve finans satırı kalır", () => {
    const d = yeni();
    const o = d.ogrenciler.find((x) => d.kayitlar.some((k) => k.ogrenciId === x.id && k.durum === "aktif"))!;
    const ad = `${o.ad} ${o.soyad}`;
    d.islemler.push({ id: "t1", zaman: ZAMAN, kullanici: "Y", islem: "İzin bildirimi", detay: `${ad} — 2026-11-01`, subeId: "s1" });
    d.izinler.push({ id: "iz-t", ogrenciId: o.id, tarih: BUGUN, not: "ateşi var", veliId: o.veliIds[0], olusturma: ZAMAN });
    d.gonderimler.push({ id: "g-t", zaman: ZAMAN, olay: "devamsizlik" as never, veliId: o.veliIds[0], alici: "Veli", ogrenciId: o.id, subeId: "s1", kanal: "sms", metin: `${ad} gelmedi`, durum: "bekliyor", maliyet: 0 });
    d.adaylar.push({ ...d.adaylar[0], id: "a-t", ogrenciId: o.id, veliTelefon: "0532 000 00 11" });
    const taksit = d.taksitler.length;
    expect(kvkkAnonimlestir(d, "ogrenci", [o.id], baglam).engel).toBeNull();
    const yeniO = d.ogrenciler.find((x) => x.id === o.id)!;
    expect(ogrenciAnonimMi(yeniO)).toBe(true);
    expect(yeniO).toMatchObject({ dogum: "", okul: "", okulSinifi: "", saglikNotu: "", notlar: [], durum: "ayrildi" });
    expect(d.kayitlar.filter((k) => k.ogrenciId === o.id).every((k) => k.durum === "iptal")).toBe(true);
    expect(d.izinler.find((i) => i.id === "iz-t")!.not).toBe("");
    const g = d.gonderimler.find((x) => x.id === "g-t")!;
    expect(g).toMatchObject({ metin: KVKK_SILINDI, alici: "***", durum: "basarisiz" });
    expect(d.islemler.find((i) => i.id === "t1")!.detay).not.toContain(ad);
    expect(anonimMi(d.adaylar.find((a) => a.id === "a-t")!)).toBe(true);
    expect(d.taksitler.length).toBe(taksit);
    expect(d.kvkk[0].kisi).not.toContain(o.soyad);
  });
  it("veli: aktif çocuğu varken engellenir, çocuk anonimleşince yapılır", () => {
    const d = yeni();
    const o = d.ogrenciler.find((x) => x.durum === "aktif" && x.veliIds.length === 1 && !d.ogrenciler.some((y) => y.id !== x.id && y.veliIds.includes(x.veliIds[0])))!;
    const v = o.veliIds[0];
    expect(anonimlestirmeEngeli(d, "veli", v)).toMatch(/aktif öğrencisi/);
    expect(kvkkAnonimlestir(d, "veli", [v], baglam).sayi).toBe(0);
    kvkkAnonimlestir(d, "ogrenci", [o.id], baglam);
    expect(kvkkAnonimlestir(d, "veli", [v], baglam).engel).toBeNull();
    const yeniV = d.veliler.find((x) => x.id === v)!;
    expect(veliAnonimMi(yeniV)).toBe(true);
    expect(yeniV).toMatchObject({ telefon: ANONIM_TELEFON, eposta: "", pushAcik: false, izinSms: false, izinTanitim: false });
    expect(anonimlestirmeEngeli(d, "veli", v)).toMatch(/zaten/);
  });
  it("aday: 03'ün anonim tanımıyla uyumlu; toplu işlem hepsi-ya-da-hiçbiri", () => {
    const d = yeni();
    const a = d.adaylar[0];
    expect(kvkkAnonimlestir(d, "aday", [a.id, "yok"], baglam).engel).toMatch(/bulunamadı/);
    expect(anonimMi(d.adaylar[0])).toBe(false);
    expect(kvkkAnonimlestir(d, "aday", [a.id], baglam).sayi).toBe(1);
    const y = d.adaylar[0];
    expect(anonimMi(y)).toBe(true);
    expect(y).toMatchObject({ okul: "", notlar: [], sonrakiAksiyon: null });
  });
  it("saklama süreleri: aday ve ayrılan öğrenci", () => {
    const d = yeni();
    d.ayarlar = { ...d.ayarlar, saklamaAyAday: 1, saklamaAyOgrenci: 1 };
    d.adaylar = [{ ...d.adaylar[0], id: "e", durum: "vazgecti", olusturma: "2026-09-01" }, { ...d.adaylar[0], id: "g", durum: "vazgecti", olusturma: "2026-11-01" }];
    expect(saklamasiDolanAdaylar(d, BUGUN).map((a) => a.id)).toEqual(["e"]);
    const k = d.kayitlar[0];
    const o = d.ogrenciler.find((x) => x.id === k.ogrenciId)!;
    d.ogrenciler = [{ ...o, durum: "ayrildi" }];
    d.kayitlar = [{ ...k, tarih: "2026-01-01", grupGecmisi: [{ grupId: k.grupId, tarih: "2026-02-01" }], iptalHesabi: undefined }];
    expect(ayrilmaTarihi(d, o.id)).toBe("2026-02-01");
    expect(saklamasiDolanOgrenciler(d, BUGUN)).toHaveLength(1);
    expect(saklamasiDolanOgrenciler(d, "2026-02-15")).toHaveLength(0);
  });
  it("kişi dökümü ilgili kayıtları içerir", () => {
    const d = yeni();
    const o = d.ogrenciler[0];
    expect(kisiDokumu(d, "ogrenci", o.id)).toMatchObject({ ogrenci: { id: o.id } });
    expect(kisiDokumu(d, "veli", o.veliIds[0])).toMatchObject({ veli: { id: o.veliIds[0] } });
  });
});

describe("açık borç ve finans saklama (karar 2026-11-09)", () => {
  const borclu = () => {
    const d = yeni();
    const o = d.ogrenciler.find((x) => x.durum === "aktif")!;
    d.moduller = { ...d.moduller, finans: true };
    d.taksitler = [
      { id: "t1", kayitId: "k", ogrenciId: o.id, veliId: o.veliIds[0], subeId: "s1", no: 1, vade: "2026-10-01", tutar: 1000.5, odenen: 250 },
      { id: "t2", kayitId: "k", ogrenciId: o.id, veliId: o.veliIds[0], subeId: "s1", no: 2, vade: "2026-11-01", tutar: 500, odenen: 500 },
    ];
    return { d, o };
  };
  it("kalan taksitler toplanır; finans kapalıysa borç sayılmaz", () => {
    const { d, o } = borclu();
    expect(acikBorc(d, [o.id])).toBe(750.5);
    expect(acikBorc({ ...d, moduller: { ...d.moduller, finans: false } }, [o.id])).toBe(0);
    expect(acikBorc(d, ["yok"])).toBe(0);
  });
  it("onaysız reddedilir, taslağa dokunulmaz", () => {
    const { d, o } = borclu();
    const r = kvkkAnonimlestir(d, "ogrenci", [o.id], baglam);
    expect(r.sayi).toBe(0);
    expect(r.engel).toMatch(/Açık borç.*750,5/);
    expect(ogrenciAnonimMi(d.ogrenciler.find((x) => x.id === o.id)!)).toBe(false);
  });
  it("onayla sürer; tutar korunur, işlem kaydına yazılır", () => {
    const { d, o } = borclu();
    const once = JSON.stringify(d.taksitler);
    expect(kvkkAnonimlestir(d, "ogrenci", [o.id], { ...baglam, borcOnay: true }).engel).toBeNull();
    expect(ogrenciAnonimMi(d.ogrenciler.find((x) => x.id === o.id)!)).toBe(true);
    expect(JSON.stringify(d.taksitler)).toBe(once);
    expect(d.islemler[0].detay).toMatch(/açık borç yönetici onayıyla/);
  });
  it("saklama süresi 10 yıl; tarihi okunamayan kayıt dolmuş sayılmaz", () => {
    expect(FINANS_SAKLAMA_YIL).toBe(10);
    expect(finansSaklamaDoldu({ vade: "2016-11-10" }, BUGUN)).toBe(false);
    expect(finansSaklamaDoldu({ zaman: "2016-11-09T10:00" }, BUGUN)).toBe(true);
    expect(finansSaklamaDoldu({ tarih: "2010-01-01" }, BUGUN)).toBe(true);
    expect(finansSaklamaDoldu({}, BUGUN)).toBe(false);
  });
});

describe("otomatik anonimleştirme planı", () => {
  /** Tek veli + iki çocuk: biri süresi dolmuş ayrılan */
  const kur = () => {
    const d = yeni();
    d.adaylar = [];
    d.taksitler = [];
    d.ayarlar = { ...d.ayarlar, saklamaAyOgrenci: 24, saklamaAyAday: 12 };
    const k = d.kayitlar[0];
    const taban = d.ogrenciler.find((o) => o.id === k.ogrenciId)!;
    const veli = d.veliler.find((v) => v.id === taban.veliIds[0])!;
    const ogr = (id: string, durum: "ayrildi" | "aktif") => ({ ...taban, id, ad: "Ali", soyad: id, durum, veliIds: [veli.id], birincilVeliId: veli.id });
    const kay = (id: string, ogrenciId: string, durum: "iptal" | "aktif" | "dondurulmus", tarih: string) => ({ ...k, id, ogrenciId, durum, tarih, grupGecmisi: [{ grupId: k.grupId, tarih }], iptalHesabi: undefined });
    d.ogrenciler = [ogr("eski", "ayrildi")];
    d.kayitlar = [kay("k1", "eski", "iptal", "2023-01-01")];
    return { d, veli, ogr, kay };
  };
  it("süresi dolan öğrenci ve çocuğu kalmayan veli işlenir", () => {
    const { d, veli } = kur();
    const p = otomatikAnonimlestirmePlani(d, BUGUN);
    expect(p.ogrenciIds).toEqual(["eski"]);
    expect(p.veliIds).toEqual([veli.id]);
    const r = kvkkOtomatikUygula(d, p, { bugun: BUGUN, zaman: ZAMAN });
    expect(r).toEqual({ ogrenci: 1, aday: 0, veli: 1 });
    expect(d.kvkk.slice(0, 2).every((k) => /^\d+ /.test(k.kisi))).toBe(true);
    expect(d.islemler[0].detay).not.toMatch(/eski/);
    expect(d.islemler[0].kullanici).toBe("Sistem");
    expect(otomatikAnonimlestirmePlani(d, BUGUN)).toMatchObject({ ogrenciIds: [], veliIds: [] });
  });
  it("süresi dolmamış öğrenci işlenmez", () => {
    const { d, kay } = kur();
    d.kayitlar = [kay("k1", "eski", "iptal", "2026-01-01")];
    expect(otomatikAnonimlestirmePlani(d, BUGUN).ogrenciIds).toEqual([]);
  });
  it("süren kaydı olan öğrenci işlenmez", () => {
    const { d, kay } = kur();
    d.kayitlar.push(kay("k2", "eski", "dondurulmus", "2023-02-01"));
    expect(otomatikAnonimlestirmePlani(d, BUGUN).ogrenciIds).toEqual([]);
  });
  it("borçlu öğrenci elle karar listesine düşer (finans kapalı olsa da), velisi de kalır", () => {
    const { d, veli } = kur();
    d.moduller = { ...d.moduller, finans: false };
    d.taksitler = [{ id: "t", kayitId: "k1", ogrenciId: "eski", veliId: veli.id, subeId: "s1", no: 1, vade: "2023-02-01", tutar: 200, odenen: 50 }];
    const p = otomatikAnonimlestirmePlani(d, BUGUN);
    expect(p.ogrenciIds).toEqual([]);
    expect(p.veliIds).toEqual([]);
    expect(p.elleBekleyen).toEqual([{ id: "eski", ad: "Ali eski", borc: 150 }]);
  });
  it("kardeşi süren veli anonimleşmez, süresi dolan kardeş işlenir", () => {
    const { d, ogr, kay } = kur();
    d.ogrenciler.push(ogr("kardes", "aktif"));
    d.kayitlar.push(kay("k2", "kardes", "aktif", "2026-09-01"));
    const p = otomatikAnonimlestirmePlani(d, BUGUN);
    expect(p.ogrenciIds).toEqual(["eski"]);
    expect(p.veliIds).toEqual([]);
  });
  it("yalnızca vazgeçen ve süresi dolan aday; üst sınır uygulanır", () => {
    const { d } = kur();
    const a = yeni().adaylar[0];
    d.adaylar = [{ ...a, id: "a1", durum: "vazgecti", olusturma: "2025-01-01" }, { ...a, id: "a2", durum: "vazgecti", olusturma: "2026-10-01" }, { ...a, id: "a3", durum: "yeni", olusturma: "2020-01-01" }];
    expect(otomatikAnonimlestirmePlani(d, BUGUN).adayIds).toEqual(["a1"]);
    expect(otomatikAnonimlestirmePlani(d, BUGUN, 1)).toMatchObject({ ogrenciIds: ["eski"], adayIds: [], veliIds: [] });
  });
  it("ayar ve hafta denetimi", () => {
    const { d } = kur();
    delete d.ayarlar.kvkkOtomatik;
    expect(kvkkOtomatikAcik(d)).toBe(true);
    expect(kvkkOtomatikAcik({ ayarlar: { ...d.ayarlar, kvkkOtomatik: false } })).toBe(false);
    expect(kvkkOtomatikZamani({ otomasyon: {} }, BUGUN)).toBe(true);
    expect(kvkkOtomatikZamani({ otomasyon: { kvkkOtomatik: "2026-11-03" } }, BUGUN)).toBe(false);
    expect(kvkkOtomatikZamani({ otomasyon: { kvkkOtomatik: "2026-11-02" } }, BUGUN)).toBe(true);
    expect(ayarlarEngeli({ ...varsayilanAyarlar, kvkkOtomatik: "evet" }, varsayilanAyarlar)).toBeTruthy();
  });
});

describe("rol varsayılanı (Bölüm 12'den devir)", () => {
  it("doküman 02: sekreter tahsilat yapar; 05 yetkisi açık kalır", () => expect(varsayilanRolYetkileri.sekreter["05"]).toBe(true));
});
