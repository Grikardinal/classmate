/** Bölüm 03 saf kurallarının birim testleri */
import { describe, expect, it } from "vitest";
import { ornekVeriUret, type Aday } from "@/data/model";
import {
  ANONIM_TELEFON,
  acikMi,
  adayAramaUyar,
  adayDogrula,
  adayDevirEngeli,
  adayYazmaEngeli,
  anonimMi,
  bugunAranacakMi,
  donusumGrupla,
  donusumOrani,
  durumGecisEngeli,
  kesinKayitEngeli,
  notlarEklemeMi,
  sorumluAdaylari,
  varsayilanSorumlu,
  yinelenenAday,
} from "./kurallar";

const db = ornekVeriUret();
const aday = (p: Partial<Aday> = {}): Aday => ({
  id: "a-test", veliAd: "Seda Kaya", veliTelefon: "0532 111 22 33", ogrenciAd: "Ecrin Kaya", seviye: 5, okul: "", subeId: "s1", sorumluId: "p9",
  kaynak: "Tavsiye", durum: "yeni", sonrakiAksiyon: "2026-11-07", denemeTarihi: null, olusturma: "2026-11-07", notlar: [],
  vazgecmeNedeni: null, teklif: null, rizaVar: true, ...p,
});
const ACIK = { modulAcik: true, onKayitYetkisi: true, kvkkYetkisi: true };

describe("durum geçişi", () => {
  it("açık durumlar ve vazgeçti arasında serbest geçiş", () => {
    expect(durumGecisEngeli("yeni", "gorusuldu")).toBeNull();
    expect(durumGecisEngeli("vazgecti", "dusunuyor")).toBeNull();
    expect(durumGecisEngeli("deneme", "vazgecti")).toBeNull();
  });
  it("kayıt yalnızca kesin kayıtla verilir ve geri alınamaz", () => {
    expect(durumGecisEngeli("deneme", "kayit")).toMatch(/Kesin kayda çevir/);
    expect(durumGecisEngeli("deneme", "kayit", true)).toBeNull();
    expect(durumGecisEngeli("kayit", "gorusuldu")).toMatch(/geri alınamaz/);
    expect(durumGecisEngeli("kayit", "vazgecti", true)).toMatch(/geri alınamaz/);
  });
  it("bilinmeyen durum reddedilir", () => {
    expect(durumGecisEngeli("yeni", "bilinmez" as never)).toMatch(/Geçersiz/);
  });
});

describe("alan doğrulama", () => {
  it("geçerli aday", () => expect(adayDogrula(aday())).toBeNull());
  it("veli adı ve telefon zorunlu; telefon normalize edilebilir olmalı", () => {
    expect(adayDogrula(aday({ veliAd: "  " }))).toMatch(/Veli adı/);
    expect(adayDogrula(aday({ veliAd: "A" }))).toMatch(/en az 2/);
    expect(adayDogrula(aday({ veliTelefon: "123" }))).toMatch(/telefon/);
    expect(adayDogrula(aday({ veliTelefon: "+90 532 111 22 33" }))).toBeNull();
    expect(adayDogrula(aday({ veliTelefon: "0212 111 22 33" }))).toMatch(/telefon/); // sabit hat değil cep
  });
  it("sınıf 3–8, tarih biçimi, teklif ≥ 0", () => {
    expect(adayDogrula(aday({ seviye: 9 }))).toMatch(/Sınıf/);
    expect(adayDogrula(aday({ sonrakiAksiyon: "07.11.2026" }))).toMatch(/aksiyon/);
    expect(adayDogrula(aday({ denemeTarihi: "2026-13-40" }))).toMatch(/Deneme/);
    expect(adayDogrula(aday({ teklif: -5 }))).toMatch(/teklif/);
    expect(adayDogrula(aday({ teklif: 0 }))).toBeNull();
  });
  it("vazgeçme nedeni yalnızca vazgeçen adayda ve orada zorunlu", () => {
    expect(adayDogrula(aday({ durum: "vazgecti" }))).toMatch(/nedeni/);
    expect(adayDogrula(aday({ durum: "vazgecti", vazgecmeNedeni: "Fiyat", sonrakiAksiyon: null }))).toBeNull();
    expect(adayDogrula(aday({ vazgecmeNedeni: "Fiyat" }))).toMatch(/yalnızca vazgeçen/);
  });
  it("boş not ve öğrenci bağı olmayan kayıt reddedilir", () => {
    expect(adayDogrula(aday({ notlar: [{ tarih: "x", yazar: "y", metin: " " }] }))).toMatch(/notu/);
    expect(adayDogrula(aday({ durum: "kayit" }))).toMatch(/öğrenci kartına/);
  });
});

describe("notlar, arama, sayımlar", () => {
  const n = (metin: string) => ({ tarih: "2026-11-07T10:00", yazar: "Gül Koç", metin });
  it("notlar yalnızca sona eklenir", () => {
    expect(notlarEklemeMi([n("a")], [n("a"), n("b")])).toBe(true);
    expect(notlarEklemeMi([n("a"), n("b")], [n("a")])).toBe(false);
    expect(notlarEklemeMi([n("a")], [n("değişti")])).toBe(false);
  });
  it("arama boşluk ve büyük/küçük harf farkı gözetmez", () => {
    const a = aday();
    expect(adayAramaUyar(a, "seda kaya")).toBe(true);
    expect(adayAramaUyar(a, "İECRİN".toLocaleLowerCase("tr-TR").slice(1))).toBe(true);
    expect(adayAramaUyar(a, "05321112233")).toBe(true);
    expect(adayAramaUyar(a, "0532 111")).toBe(true);
    expect(adayAramaUyar(a, "Ayşe")).toBe(false);
  });
  it("bugün aranacaklar, dönüşüm oranı ve gruplama", () => {
    expect(bugunAranacakMi(aday({ sonrakiAksiyon: "2026-11-06" }), "2026-11-07")).toBe(true);
    expect(bugunAranacakMi(aday({ sonrakiAksiyon: "2026-11-08" }), "2026-11-07")).toBe(false);
    expect(bugunAranacakMi(aday({ durum: "vazgecti", sonrakiAksiyon: "2026-11-01" }), "2026-11-07")).toBe(false);
    const l = [aday({ durum: "kayit" }), aday({ durum: "vazgecti" }), aday({ durum: "vazgecti" }), aday()];
    expect(donusumOrani(l)).toBe(33);
    expect(donusumOrani([aday()])).toBe(0);
    expect(donusumGrupla(l, (a) => a.kaynak)).toEqual([["Tavsiye", { toplam: 4, kayit: 1 }]]);
    expect(acikMi(aday({ durum: "dusunuyor" }))).toBe(true);
  });
});

describe("yinelenen aday ve sorumlu", () => {
  it("aynı telefon (farklı yazımla) ve aynı öğrenci → yinelenen; sonuçlanmış aday engel değil", () => {
    const mevcut = [aday({ id: "a1" })];
    expect(yinelenenAday(aday({ id: "a2", veliTelefon: "05321112233", ogrenciAd: "ecrin  KAYA" }), mevcut)?.id).toBe("a1");
    expect(yinelenenAday(aday({ id: "a2", ogrenciAd: "—" }), mevcut)?.id).toBe("a1"); // adı bilinmeyen kardeş/aynı kişi
    expect(yinelenenAday(aday({ id: "a2", ogrenciAd: "Kuzey Kaya" }), mevcut)).toBeNull(); // kardeş
    expect(yinelenenAday(aday({ id: "a2" }), [aday({ id: "a1", durum: "vazgecti", vazgecmeNedeni: "Fiyat" })])).toBeNull();
  });
  it("sorumlu şubede görevli aktif ve öğretmen olmayan personel", () => {
    const s1 = sorumluAdaylari(db.personel, "s1").map((p) => p.id);
    expect(s1).toContain("p9");
    expect(s1).not.toContain("p4"); // öğretmen
    expect(sorumluAdaylari(db.personel, "s3").map((p) => p.id)).not.toContain("p3"); // pasif
    expect(varsayilanSorumlu(db.personel, "s2")).toBe("p10"); // sekreter tercih edilir
    expect(varsayilanSorumlu(db.personel, "s1", "p1")).toBe("p1");
    expect(varsayilanSorumlu(db.personel, "s1", "p4")).toBe("p9");
  });
});

describe("yazma engeli (sunucu ile ortak)", () => {
  const veri = { ...db, adaylar: [] as Aday[] };
  it("yeni geçerli aday kabul; modül kapalı veya 03 yetkisi yoksa ret", () => {
    expect(adayYazmaEngeli(aday(), undefined, veri, ACIK)).toBeNull();
    expect(adayYazmaEngeli(aday(), undefined, veri, { ...ACIK, modulAcik: false })).toMatch(/modülü kapalı/);
    expect(adayYazmaEngeli(aday(), undefined, veri, { ...ACIK, onKayitYetkisi: false })).toMatch(/yetkiniz yok/);
  });
  it("pasif şubeye ekleme ve şubede görevli olmayan sorumlu reddedilir", () => {
    expect(adayYazmaEngeli(aday({ subeId: "s3", sorumluId: "p0" }), undefined, veri, ACIK)).toMatch(/Pasif şube/);
    expect(adayYazmaEngeli(aday({ sorumluId: "p10" }), undefined, veri, ACIK)).toBeNull(); // Emre s1'de de görevli
    expect(adayYazmaEngeli(aday({ subeId: "s2", sorumluId: "p9" }), undefined, veri, ACIK)).toMatch(/Sorumlu/);
  });
  it("kesin kayıt: 04 yetkisiyle yapılabilir, öğrenci kartı gerekir; sonra bilgiler kilitlenir", () => {
    const eski = aday();
    const ogrId = db.ogrenciler[0].id;
    const kayit = aday({ durum: "kayit", ogrenciId: ogrId, sonrakiAksiyon: null });
    const v = { ...veri, adaylar: [kayit] };
    expect(adayYazmaEngeli(kayit, eski, v, { ...ACIK, onKayitYetkisi: false })).toBeNull();
    expect(adayYazmaEngeli({ ...kayit, ogrenciId: "yok" }, eski, v, ACIK)).toMatch(/öğrenci kartı bulunamadı/);
    expect(adayYazmaEngeli(kayit, undefined, v, ACIK)).toMatch(/doğrudan kayıt/);
    expect(adayYazmaEngeli({ ...kayit, veliAd: "Başka Ad" }, kayit, v, ACIK)).toMatch(/değiştirilemez/);
    expect(adayYazmaEngeli({ ...kayit, durum: "yeni", ogrenciId: undefined }, kayit, v, ACIK)).toMatch(/geri alınamaz/);
    expect(adayYazmaEngeli(aday({ ogrenciId: ogrId }), eski, v, ACIK)).toMatch(/öğrenci bağlantısı/);
  });
  it("notlar silinemez; yinelenen açık aday eklenemez", () => {
    const n = { tarih: "2026-11-01T10:00", yazar: "Gül Koç", metin: "Arandı" };
    const eski = aday({ notlar: [n] });
    expect(adayYazmaEngeli(aday({ notlar: [] }), eski, veri, ACIK)).toMatch(/notları silinemez/);
    const v = { ...veri, adaylar: [aday({ id: "a1" })] };
    expect(adayYazmaEngeli(aday({ id: "a2", veliTelefon: "+905321112233" }), undefined, v, ACIK)).toMatch(/açık bir aday zaten var/);
  });
  it("KVKK anonimleştirme: yalnızca vazgeçen aday, 14 yetkisiyle, modül kapalıyken de", () => {
    const eski = aday({ durum: "vazgecti", vazgecmeNedeni: "Fiyat", sonrakiAksiyon: null, notlar: [{ tarih: "x", yazar: "y", metin: "z" }] });
    const anonim = { ...eski, veliAd: "S*** K*** ***", veliTelefon: ANONIM_TELEFON, ogrenciAd: "E***", notlar: [] };
    expect(anonimMi(anonim)).toBe(true);
    expect(adayYazmaEngeli(anonim, eski, veri, { ...ACIK, modulAcik: false, onKayitYetkisi: false })).toBeNull();
    expect(adayYazmaEngeli(anonim, eski, veri, { ...ACIK, kvkkYetkisi: false })).toMatch(/KVKK/);
    expect(adayYazmaEngeli({ ...anonim, durum: "yeni", vazgecmeNedeni: null }, aday(), veri, ACIK)).toMatch(/vazgeçen/);
    expect(adayYazmaEngeli({ ...anonim, subeId: "s2" }, eski, veri, ACIK)).toMatch(/kişisel alanlar/);
    expect(adayYazmaEngeli({ ...anonim, kaynak: "Google" }, anonim, veri, ACIK)).toMatch(/Anonimleştirilmiş/);
    expect(kesinKayitEngeli(anonim)).toMatch(/Anonim/);
    expect(kesinKayitEngeli(aday({ durum: "kayit", ogrenciId: "o1" }))).toMatch(/zaten/);
    expect(kesinKayitEngeli(aday())).toBeNull();
  });
});

describe("kapsam dışına devir (karar 2026-11-07)", () => {
  const veri = { ...db, adaylar: [] as Aday[] };
  const KAPSAM = { ...ACIK, kapsam: ["s1"] };
  const eski = aday();
  const devir = (p: Partial<Aday> = {}) => aday({ subeId: "s2", sorumluId: "p10", ...p });
  it("yalnızca şube, sorumlu ve eklenen not değişebilir; sorumlu hedefin varsayılanı olmalı", () => {
    expect(adayDevirEngeli(devir(), eski, veri)).toBeNull();
    expect(adayDevirEngeli(devir({ notlar: [{ tarih: "t", yazar: "y", metin: "Devredildi" }] }), eski, veri)).toBeNull();
    expect(adayDevirEngeli(devir({ seviye: 6 }), eski, veri)).toMatch(/diğer bilgileri/);
    expect(adayDevirEngeli(devir({ sorumluId: "p2" }), eski, veri)).toMatch(/varsayılan sorumlu/);
    expect(adayDevirEngeli(devir({ sorumluId: "p2" }), eski, veri, false)).toBeNull(); // ekranda sorumluyu sunucu atar
  });
  it("pasif şubeye, kayda dönmüş veya anonim aday devredilemez", () => {
    expect(adayDevirEngeli(devir({ subeId: "s3", sorumluId: "p3" }), eski, veri)).toMatch(/Pasif/);
    expect(adayDevirEngeli(devir(), aday({ durum: "kayit", ogrenciId: "o1" }), veri)).toMatch(/Kayda/);
    expect(adayDevirEngeli(devir(), aday({ veliTelefon: ANONIM_TELEFON }), veri)).toMatch(/Anonim/);
  });
  it("adayYazmaEngeli: kapsam dışına devirde devir kuralı uygulanır, kapsam içinde ve genel yöneticide uygulanmaz", () => {
    expect(adayYazmaEngeli(devir(), eski, veri, KAPSAM)).toBeNull();
    expect(adayYazmaEngeli(devir({ kaynak: "Google" }), eski, veri, KAPSAM)).toMatch(/diğer bilgileri/);
    expect(adayYazmaEngeli(devir({ kaynak: "Google" }), eski, veri, ACIK)).toBeNull(); // genel yönetici (kapsam yok)
    expect(adayYazmaEngeli(devir({ kaynak: "Google" }), eski, veri, { ...ACIK, kapsam: ["s1", "s2"] })).toBeNull();
    expect(adayYazmaEngeli(devir({ sorumluId: "p9" }), eski, veri, { ...KAPSAM, istemci: true })).toBeNull();
    expect(adayYazmaEngeli(devir({ sorumluId: "p9" }), eski, veri, KAPSAM)).toMatch(/varsayılan sorumlu/);
    const kayitli = aday({ durum: "kayit", ogrenciId: db.ogrenciler[0].id });
    expect(adayYazmaEngeli({ ...kayitli, subeId: "s2", sorumluId: "p10" }, kayitli, veri, ACIK)).toMatch(/devredilemez/);
  });
});
