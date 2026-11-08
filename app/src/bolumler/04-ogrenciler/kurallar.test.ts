/** Bölüm 04 saf kuralları (ekran ve sunucu ortak): kurallar.ts */
import { describe, expect, it } from "vitest";
import { ornekVeriUret, type Aday, type Db, type Kayit, type Ogrenci, type Veli } from "@/data/model";
import {
  adAnahtari,
  adayYenidenAc,
  adayYenidenAcmaEngeli,
  bagliAday,
  grupAtamaEngeli,
  grupDoluMu,
  iptalPaketiMi,
  kapsamDisiNakilEngeli,
  nakilHedefGrubu,
  ogrenciDurumu,
  yenidenKayitEngeli,
  iptalSonrasiOgrenciDurumu,
  kayitDurumGecisEngeli,
  kayitYazmaEngeli,
  mukerrerOgrenci,
  notlarBasaEklemeMi,
  odemePlaniEngeli,
  ogrenciAnonimMi,
  ogrenciDogrula,
  ogrenciYazmaEngeli,
  seviyeUyumsuz,
  sozlesmeNoEngeli,
  sozlesmeYili,
  telefonSahibiVeli,
  veliBirlestirmeleri,
  veliDogrula,
  veliYazmaEngeli,
  yeniSozlesmeNo,
  YENIDEN_ACILAN_DURUM,
} from "./kurallar";

const db = ornekVeriUret();
const BUGUN = "2026-11-07";
const o3 = db.ogrenciler.find((o) => o.id === "o3")!; // Ecrin Yıldız · s1 · g1 · veliler v1, v2
const v1 = db.veliler.find((v) => v.id === "v1")!;
const k4 = db.kayitlar.find((k) => k.id === "k4")!;
const kopya = (): Db => structuredClone(db);
const yeniKayit = (p: Partial<Kayit> = {}): Kayit => ({
  ...k4, id: "k-yeni", ogrenciId: "o-yeni", grupId: "g1", subeId: "s1", sezonId: "z2", sozlesmeNo: "MRK-2026-0999", tarih: BUGUN,
  grupGecmisi: [{ grupId: "g1", tarih: BUGUN }], ...p,
});
const yeniOgrenci = (p: Partial<Ogrenci> = {}): Ogrenci => ({ ...o3, id: "o-yeni", ad: "Deniz", soyad: "Ak", veliIds: ["v1"], birincilVeliId: "v1", notlar: [], ...p });

describe("Türkçe harf duyarsız ad ve mükerrer öğrenci", () => {
  it("büyük/küçük harf, İ/I/ı, fazla boşluk ve Latin harfle yazım farkı yok", () => {
    expect(adAnahtari("IŞIL  Öztürk")).toBe(adAnahtari("ışıl öztürk"));
    expect(adAnahtari("Işıl Öztürk")).toBe(adAnahtari("isil ozturk"));
    expect(adAnahtari("İREM")).toBe("irem");
    expect(adAnahtari("Çağrı Gül")).toBe("cagri gul");
  });
  it("aynı ad + velilerden birinin telefonu (farklı biçimde yazılsa da) mükerrerdir", () => {
    const tel = v1.telefon.replace(/\s/g, "");
    expect(mukerrerOgrenci({ ad: "ECRİN", soyad: "yıldız" }, [tel], db)?.id).toBe("o3");
    expect(mukerrerOgrenci({ ad: "Ecrin", soyad: "Yildiz" }, ["+90 " + tel.slice(1)], db)?.id).toBe("o3");
    expect(mukerrerOgrenci({ ad: "Ecrin", soyad: "Yıldız" }, ["0599 999 99 99"], db)).toBeNull();
    expect(mukerrerOgrenci({ ad: "Ecrin", soyad: "Kaya" }, [tel], db)).toBeNull();
    expect(mukerrerOgrenci({ id: "o3", ad: "Ecrin", soyad: "Yıldız" }, [tel], db)).toBeNull(); // kendisi
  });
  it("anonimleştirilmiş öğrenci ve veli eşleşmeye girmez", () => {
    const x = kopya();
    x.ogrenciler = x.ogrenciler.map((o) => (o.id === "o3" ? { ...o, ad: "E***", soyad: "Y***" } : o));
    expect(ogrenciAnonimMi(x.ogrenciler.find((o) => o.id === "o3")!)).toBe(true);
    expect(mukerrerOgrenci({ ad: "E***", soyad: "Y***" }, [v1.telefon], x)).toBeNull();
    x.veliler = x.veliler.map((v) => (v.id === "v1" ? { ...v, telefon: "*** *** ** **" } : v));
    expect(telefonSahibiVeli("*** *** ** **", x.veliler)).toBeNull();
  });
});

describe("veli eşleştirme", () => {
  it("telefon farklı yazılsa da kayıtlı veli bulunur; kendisi hariç tutulabilir", () => {
    expect(telefonSahibiVeli("+90 " + v1.telefon.slice(1), db.veliler)?.id).toBe("v1");
    expect(telefonSahibiVeli(v1.telefon, db.veliler, "v1")).toBeNull();
    expect(telefonSahibiVeli("12345", db.veliler)).toBeNull();
  });
  it("yeni veli kayıtlı telefona aitse mevcut veliye, pakette aynı telefonlu ikinci yeni veli ilkine birleşir", () => {
    const yeni = (id: string, telefon: string): Veli => ({ ...v1, id, telefon });
    const m = veliBirlestirmeleri([yeni("vA", v1.telefon), yeni("vB", "0532 000 00 01"), yeni("vC", "05320000001")], db.veliler);
    expect(m.get("vA")).toBe("v1");
    expect(m.has("vB")).toBe(false);
    expect(m.get("vC")).toBe("vB");
  });
  it("var olan velinin telefonu başka veliye ait olamaz; alan kuralları", () => {
    const v2 = db.veliler.find((v) => v.id === "v2")!;
    expect(veliYazmaEngeli({ ...v2, telefon: v1.telefon }, v2, db, { kvkkYetkisi: false })).toMatch(/başka bir veliye/);
    expect(veliYazmaEngeli({ ...v2, izinSms: !v2.izinSms }, v2, db, { kvkkYetkisi: false })).toBeNull();
    expect(veliDogrula({ ...v1, telefon: "0212 111 11 11" })).toMatch(/telefon/);
    expect(veliDogrula({ ...v1, eposta: "yanlis@" })).toMatch(/e-posta/);
    expect(veliDogrula({ ...v1, ad: "  " })).toMatch(/Veli adı/);
    expect(veliDogrula({ ...v1, yakinlik: "Komşu" as Veli["yakinlik"] })).toMatch(/Yakınlık/);
  });
  it("veli anonimleştirme yalnızca KVKK yetkisiyle; anonim veli değiştirilemez", () => {
    const anonim = { ...v1, telefon: "*** *** ** **", ad: "D***" };
    expect(veliYazmaEngeli(anonim, v1, db, { kvkkYetkisi: false })).toMatch(/KVKK/);
    expect(veliYazmaEngeli(anonim, v1, db, { kvkkYetkisi: true })).toBeNull();
    expect(veliYazmaEngeli({ ...anonim, ad: "X" }, anonim, db, { kvkkYetkisi: true })).toMatch(/değiştirilemez/);
  });
});

describe("öğrenci alan kuralları", () => {
  it("ad/soyad zorunlu, doğum tarihi geçerli ve gelecekte değil, birincil veli velilerden biri", () => {
    expect(ogrenciDogrula(o3, BUGUN)).toBeNull();
    expect(ogrenciDogrula({ ...o3, soyad: " " }, BUGUN)).toMatch(/soyadı/);
    expect(ogrenciDogrula({ ...o3, dogum: "2027-01-01" }, BUGUN)).toMatch(/bugünden sonra/);
    expect(ogrenciDogrula({ ...o3, dogum: "31.12.2015" }, BUGUN)).toMatch(/geçersiz/);
    expect(ogrenciDogrula({ ...o3, birincilVeliId: "v9" }, BUGUN)).toMatch(/Birincil/);
    expect(ogrenciDogrula({ ...o3, veliIds: [] , birincilVeliId: "" }, BUGUN)).toMatch(/en az bir veli/);
    expect(ogrenciDogrula({ ...o3, veliIds: ["v1", "v1"] }, BUGUN)).toMatch(/iki kez/);
    expect(ogrenciDogrula({ ...o3, saglikNotu: "x".repeat(501) }, BUGUN)).toMatch(/Sağlık notu/);
  });
  it("notlar yalnızca başa eklenir", () => {
    const n = (m: string) => ({ tarih: "2026-11-01T10:00", yazar: "A", metin: m });
    expect(notlarBasaEklemeMi([n("1")], [n("2"), n("1")])).toBe(true);
    expect(notlarBasaEklemeMi([n("1")], [n("1"), n("2")])).toBe(false);
    expect(notlarBasaEklemeMi([n("1")], [])).toBe(false);
    expect(notlarBasaEklemeMi([n("1")], [{ ...n("1"), metin: "değişti" }])).toBe(false);
  });
  it("yeni kart kayıtla birlikte gelir; ayrılan öğrenci aktifleşmez; iptal olmayan kaydı varken ayrılamaz", () => {
    const sec = { kvkkYetkisi: false, bugun: BUGUN };
    expect(ogrenciYazmaEngeli(yeniOgrenci(), undefined, db, sec)).toMatch(/kayıtla birlikte/);
    const x = kopya();
    x.ogrenciler.push(yeniOgrenci());
    x.kayitlar.push(yeniKayit());
    expect(ogrenciYazmaEngeli(yeniOgrenci(), undefined, x, sec)).toBeNull();
    expect(ogrenciYazmaEngeli({ ...o3, durum: "ayrildi" }, o3, db, sec)).toMatch(/Süren kaydı/);
    const iptalli = { ...db, kayitlar: db.kayitlar.map((k) => (k.id === "k4" ? { ...k, durum: "iptal" as const } : k)) };
    expect(ogrenciYazmaEngeli({ ...o3, durum: "aktif" }, { ...o3, durum: "ayrildi" }, iptalli, sec)).toMatch(/yalnızca yeni bir kayıtla/);
    expect(ogrenciYazmaEngeli({ ...o3, veliIds: ["v1", "yok"] }, o3, db, sec)).toMatch(/velisi bulunamadı/);
  });
  it("mükerrer ad değişikliği reddedilir; anonimleştirme yalnızca KVKK yetkisiyle", () => {
    const sec = { kvkkYetkisi: false, bugun: BUGUN };
    const kardes = db.ogrenciler.find((o) => o.id !== "o3" && o.veliIds.includes("v1"));
    if (kardes) expect(ogrenciYazmaEngeli({ ...kardes, ad: "ecrin", soyad: "YILDIZ" }, kardes, db, sec)).toMatch(/kayıtlı bir öğrenci var/);
    const x = kopya();
    x.kayitlar = x.kayitlar.map((k) => (k.ogrenciId === "o3" ? { ...k, durum: "iptal" } : k));
    const anonim: Ogrenci = { ...o3, ad: "E***", soyad: "Y***", notlar: [], saglikNotu: "", durum: "ayrildi" };
    expect(ogrenciYazmaEngeli(anonim, o3, x, sec)).toMatch(/KVKK/);
    expect(ogrenciYazmaEngeli(anonim, o3, x, { ...sec, kvkkYetkisi: true })).toBeNull();
    expect(ogrenciYazmaEngeli({ ...anonim, ad: "Geri" }, anonim, x, { ...sec, kvkkYetkisi: true })).toMatch(/Anonimleştirilmiş/);
  });
});

describe("sözleşme numarası", () => {
  it("yıl sezonun başlangıç yılıdır; şube içinde sıradaki numara", () => {
    expect(sozlesmeYili(db.sezonlar, "z2", "2027-01-15")).toBe(2026);
    expect(sozlesmeYili(db.sezonlar, "yok", "2027-01-15")).toBe(2027);
    const no = yeniSozlesmeNo(db, db.kayitlar.map((k) => k.sozlesmeNo), "s1", "z2", "2027-01-15");
    expect(no).toMatch(/^MRK-2026-\d{4}$/);
    expect(db.kayitlar.some((k) => k.sozlesmeNo === no)).toBe(false);
  });
  it("boş, şube koduyla başlamayan veya kullanılan numara reddedilir", () => {
    expect(sozlesmeNoEngeli({ id: "x", subeId: "s1", sozlesmeNo: "" }, db)).toMatch(/boş/);
    expect(sozlesmeNoEngeli({ id: "x", subeId: "s1", sozlesmeNo: "KZY-2026-0001" }, db)).toMatch(/MRK-/);
    expect(sozlesmeNoEngeli({ id: "x", subeId: "s1", sozlesmeNo: k4.sozlesmeNo }, db)).toMatch(/kullanılıyor/);
    expect(sozlesmeNoEngeli({ id: k4.id, subeId: "s1", sozlesmeNo: k4.sozlesmeNo }, db)).toBeNull();
  });
});

describe("grup, şube, sezon ve kapasite", () => {
  it("pasif şube, başka şubenin veya sezonun grubu reddedilir", () => {
    expect(grupAtamaEngeli({ subeId: "s1", sezonId: "z2", grupId: "g1" }, db)).toBeNull();
    expect(grupAtamaEngeli({ subeId: "s3", sezonId: "z2", grupId: "g1" }, db)).toMatch(/Pasif/);
    expect(grupAtamaEngeli({ subeId: "s1", sezonId: "z2", grupId: "g5" }, db)).toMatch(/şubesine/);
    expect(grupAtamaEngeli({ subeId: "s1", sezonId: "z1", grupId: "g1" }, db)).toMatch(/sezonuna/);
    expect(grupAtamaEngeli({ subeId: "s1", sezonId: "z2", grupId: "yok" }, db)).toMatch(/bulunamadı/);
  });
  it("doluluk yalnızca aktif kayıtları sayar; seviye uyumsuzluğu uyarıdır", () => {
    expect(grupDoluMu(db, "g2")).toBe(true); // 16/16
    expect(grupDoluMu(db, "g1")).toBe(false);
    const x = kopya();
    const birisi = x.kayitlar.find((k) => k.grupId === "g2")!;
    birisi.durum = "dondurulmus";
    expect(grupDoluMu(x, "g2")).toBe(false);
    expect(seviyeUyumsuz(5, db.gruplar.find((g) => g.id === "g1"))).toBe(true);
    expect(seviyeUyumsuz(3, db.gruplar.find((g) => g.id === "g1"))).toBe(false);
  });
});

describe("kayıt durumu ve kayıt satırı", () => {
  it("iptal geri alınamaz; yeni kayıt aktif açılır; aktif ⇄ dondurulmuş serbest", () => {
    expect(kayitDurumGecisEngeli("iptal", "aktif")).toMatch(/geri alınamaz/);
    expect(kayitDurumGecisEngeli("iptal", "dondurulmus")).toMatch(/geri alınamaz/);
    expect(kayitDurumGecisEngeli(null, "dondurulmus")).toMatch(/aktif/);
    expect(kayitDurumGecisEngeli("aktif", "dondurulmus")).toBeNull();
    expect(kayitDurumGecisEngeli("dondurulmus", "aktif")).toBeNull();
    expect(kayitDurumGecisEngeli("dondurulmus", "iptal")).toBeNull();
    expect(kayitDurumGecisEngeli("aktif", "nakil" as Kayit["durum"])).toMatch(/Geçersiz/);
  });
  const sonrakiYeni = (k: Kayit) => {
    const x = kopya();
    x.ogrenciler.push(yeniOgrenci());
    x.kayitlar.push(k);
    return x;
  };
  it("yeni kayıt: dolu grupta sekreter, şube müdürü ve genel yönetici kapasite aşımını onaylayabilir", () => {
    const k = yeniKayit({ grupId: "g2", grupGecmisi: [{ grupId: "g2", tarih: BUGUN }] });
    expect(kayitYazmaEngeli(k, undefined, sonrakiYeni(k), { rol: "ogretmen" })).toMatch(/kontenjanı dolu/);
    expect(kayitYazmaEngeli(k, undefined, sonrakiYeni(k), { rol: "sekreter" })).toBeNull(); // karar 2026-11-07
    expect(kayitYazmaEngeli(k, undefined, sonrakiYeni(k), { rol: "sube-muduru" })).toBeNull();
    expect(kayitYazmaEngeli(yeniKayit(), undefined, sonrakiYeni(yeniKayit()), { rol: "sekreter" })).toBeNull();
  });
  it("yeni kayıt: sezonda tek ana kayıt, aktif olmayan sezona yalnızca genel yönetici, öğrenci var olmalı", () => {
    const ikinci = yeniKayit({ id: "k-iki", ogrenciId: "o3", sozlesmeNo: "MRK-2026-0998" });
    const x = kopya();
    x.kayitlar.push(ikinci);
    expect(kayitYazmaEngeli(ikinci, undefined, x, { rol: "sekreter" })).toMatch(/zaten bir kaydı/);
    const y = kopya();
    y.gruplar.push({ ...y.gruplar[0], id: "g-z3", sezonId: "z3" });
    const yaz = yeniKayit({ sezonId: "z3", grupId: "g-z3", grupGecmisi: [{ grupId: "g-z3", tarih: BUGUN }] });
    y.ogrenciler.push(yeniOgrenci());
    y.kayitlar.push(yaz);
    expect(kayitYazmaEngeli(yaz, undefined, y, { rol: "sekreter" })).toMatch(/aktif sezona/);
    expect(kayitYazmaEngeli(yaz, undefined, y, { rol: "genel-yonetici" })).toBeNull();
    expect(kayitYazmaEngeli(yeniKayit(), undefined, db, { rol: "sekreter" })).toMatch(/öğrencisi bulunamadı/);
  });
  it("grup değişikliği grup geçmişine eklenmeli; sözleşme no / sezon / öğrenci değişmez; iptal kayıt kilitli", () => {
    const tasi = (p: Partial<Kayit>) => ({ ...k4, grupId: "g3", ...p });
    const x = (k: Kayit) => ({ ...db, kayitlar: db.kayitlar.map((y) => (y.id === k.id ? k : y)) });
    const dogru = tasi({ grupGecmisi: [...k4.grupGecmisi, { grupId: "g3", tarih: BUGUN }] });
    expect(kayitYazmaEngeli(dogru, k4, x(dogru), { rol: "sekreter" })).toBeNull();
    expect(kayitYazmaEngeli(tasi({}), k4, x(tasi({})), { rol: "sekreter" })).toMatch(/grup geçmişine/);
    expect(kayitYazmaEngeli({ ...k4, grupGecmisi: [] }, k4, db, { rol: "sekreter" })).toMatch(/Grup geçmişi/);
    expect(kayitYazmaEngeli({ ...k4, sozlesmeNo: "MRK-2026-7777" }, k4, db, { rol: "sekreter" })).toMatch(/sözleşme numarası/);
    const iptal = { ...k4, durum: "iptal" as const };
    expect(kayitYazmaEngeli({ ...iptal, ekHizmetler: ["Kitap seti"] }, iptal, db, { rol: "genel-yonetici" })).toMatch(/İptal edilen kayıt/);
    expect(kayitYazmaEngeli({ ...dogru, durum: "iptal" }, k4, x(dogru), { rol: "sekreter" })).toMatch(/İptal edilirken/);
  });
  it("nakil: grup yeni şubeye ait olmalı; dondurmadan dönüşte kontenjan denetlenir", () => {
    const nakil = { ...k4, subeId: "s2", grupId: "g1" };
    expect(kayitYazmaEngeli(nakil, k4, db, { rol: "genel-yonetici" })).toMatch(/şubesine/);
    const g2de = db.kayitlar.find((k) => k.grupId === "g2")!;
    const donmus = { ...g2de, durum: "dondurulmus" as const };
    const x = { ...db, kayitlar: db.kayitlar.map((k) => (k.id === g2de.id ? g2de : k)).concat([{ ...yeniKayit({ id: "k-fazla", grupId: "g2" }) }]) };
    expect(kayitYazmaEngeli(g2de, donmus, x, { rol: "ogretmen" })).toMatch(/kontenjanı dolu/);
  });
});

describe("kayıt iptali → aday yeniden açılır (karar 2026-11-07)", () => {
  const aday = (): Aday => ({ ...db.adaylar.find((a) => a.durum === "kayit")!, ogrenciId: "o3" });
  it("öğrencinin iptal olmayan kaydı kalmazsa ayrılır ve iptal paketi sayılır", () => {
    const iptal = { ...k4, durum: "iptal" as const };
    const sonra = db.kayitlar.map((k) => (k.id === k4.id ? iptal : k));
    expect(iptalSonrasiOgrenciDurumu("o3", sonra)).toBe("ayrildi");
    expect(iptalSonrasiOgrenciDurumu("o3", db.kayitlar)).toBe("aktif");
    expect(iptalPaketiMi("o3", db.kayitlar, [iptal], sonra)).toBe(true);
    expect(iptalPaketiMi("o3", db.kayitlar, [], db.kayitlar)).toBe(false); // iptal yok
    const ikiKayit = [...sonra, { ...k4, id: "k-z3", sezonId: "z3", durum: "aktif" as const }];
    expect(iptalPaketiMi("o3", db.kayitlar, [iptal], ikiKayit)).toBe(false); // başka kaydı sürüyor
  });
  it("aday “Görüşüldü” durumuna döner, öğrenci bağı kalkar, sonraki aksiyon bugün, not eklenir", () => {
    const a = aday();
    expect(bagliAday("o3", [a])?.id).toBe(a.id);
    const not = { tarih: "2026-11-07T10:00", yazar: "Gül Koç", metin: "Kayıt iptal edildi" };
    const y = adayYenidenAc(a, not, BUGUN);
    expect(y.durum).toBe(YENIDEN_ACILAN_DURUM);
    expect("ogrenciId" in y).toBe(false);
    expect(y.sonrakiAksiyon).toBe(BUGUN);
    expect(y.notlar.at(-1)).toEqual(not);
    expect(adayYenidenAcmaEngeli(y, a)).toBeNull();
  });
  it("yeniden açarken başka alan, başka durum veya not silme reddedilir", () => {
    const a = aday();
    const y = adayYenidenAc(a, { tarih: "t", yazar: "y", metin: "m" }, BUGUN);
    expect(adayYenidenAcmaEngeli({ ...y, veliAd: "Başka" }, a)).toMatch(/diğer bilgileri/);
    expect(adayYenidenAcmaEngeli({ ...y, durum: "yeni" }, a)).toMatch(/Görüşüldü/);
    expect(adayYenidenAcmaEngeli({ ...y, ogrenciId: "o3" }, a)).toMatch(/bağlantısı/);
    expect(adayYenidenAcmaEngeli({ ...y, notlar: [] }, { ...a, notlar: [{ tarih: "t", yazar: "y", metin: "eski" }] })).toMatch(/notları/);
    expect(adayYenidenAcmaEngeli(y, { ...a, durum: "gorusuldu" })).toMatch(/kayda dönüşmüş/);
  });
});

describe("ödeme planı girdisi (bariz hatalar)", () => {
  it("negatif peşinat, kesirli taksit, taksitsiz eksik ödeme ve boş vade reddedilir", () => {
    expect(odemePlaniEngeli(10000, { pesinat: 2000, taksit: 8, ilkVade: BUGUN })).toBeNull();
    expect(odemePlaniEngeli(10000, { pesinat: -1, taksit: 8, ilkVade: BUGUN })).toMatch(/Peşinat/);
    expect(odemePlaniEngeli(10000, { pesinat: 12000, taksit: 8, ilkVade: BUGUN })).toMatch(/büyük olamaz/);
    expect(odemePlaniEngeli(10000, { pesinat: 0, taksit: 2.5, ilkVade: BUGUN })).toMatch(/tam sayı/);
    expect(odemePlaniEngeli(10000, { pesinat: 3000, taksit: 0, ilkVade: BUGUN })).toMatch(/eşit/);
    expect(odemePlaniEngeli(10000, { pesinat: 10000, taksit: 0, ilkVade: BUGUN })).toBeNull();
    expect(odemePlaniEngeli(10000, { pesinat: 0, taksit: 4, ilkVade: "" })).toMatch(/vade/);
  });
});

describe("ek kararlar (2026-11-07): yeniden kayıt, mezuniyet, kapsam dışına nakil", () => {
  const iptalli = (): Db => ({ ...db, kayitlar: db.kayitlar.map((k) => (k.id === "k4" ? { ...k, durum: "iptal" as const } : k)) });
  it("öğrenci durumu kayıtlardan çıkar: süren → aktif, yalnız mezun → mezun, hiçbiri → ayrıldı", () => {
    expect(ogrenciDurumu("o3", db.kayitlar)).toBe("aktif");
    expect(ogrenciDurumu("o3", iptalli().kayitlar)).toBe("ayrildi");
    expect(ogrenciDurumu("o3", [{ ogrenciId: "o3", durum: "mezun" }, { ogrenciId: "o3", durum: "iptal" }])).toBe("mezun");
    expect(ogrenciDurumu("o3", [{ ogrenciId: "o3", durum: "mezun" }, { ogrenciId: "o3", durum: "dondurulmus" }])).toBe("aktif");
  });
  it("yeniden kayıt yalnızca süren kaydı olmayan, anonim olmayan mevcut karttan", () => {
    expect(yenidenKayitEngeli(o3, db.kayitlar)).toMatch(/süren bir kaydı/);
    expect(yenidenKayitEngeli(o3, iptalli().kayitlar)).toBeNull();
    expect(yenidenKayitEngeli({ ...o3, ad: "E***", soyad: "Y***" }, iptalli().kayitlar)).toMatch(/Anonim/);
    // Ayrılan öğrenci aynı sezonda yeni kayıtla yeniden aktif olur
    const x = iptalli();
    const yeni = yeniKayit({ ogrenciId: "o3" });
    x.kayitlar = [...x.kayitlar, yeni];
    expect(kayitYazmaEngeli(yeni, undefined, x, { rol: "sekreter" })).toBeNull();
    expect(ogrenciYazmaEngeli({ ...o3, durum: "aktif" }, { ...o3, durum: "ayrildi" }, x, { kvkkYetkisi: false, bugun: BUGUN })).toBeNull();
    // Sezonda ikinci süren kayıt kuralı aynen
    expect(kayitYazmaEngeli(yeni, undefined, { ...db, kayitlar: [...db.kayitlar, yeni] }, { rol: "sekreter" })).toMatch(/zaten bir kaydı/);
  });
  it("mezun: yalnızca genel yönetici, yalnızca en üst seviye; geri alınamaz", () => {
    const g4 = db.kayitlar.find((k) => k.grupId === "g4")!; // 8. sınıf
    expect(kayitYazmaEngeli({ ...g4, durum: "mezun" }, g4, db, { rol: "genel-yonetici" })).toBeNull();
    expect(kayitYazmaEngeli({ ...g4, durum: "mezun" }, g4, db, { rol: "sube-muduru" })).toMatch(/genel yönetici/);
    expect(kayitYazmaEngeli({ ...k4, durum: "mezun" }, k4, db, { rol: "genel-yonetici" })).toMatch(/8\. sınıf/);
    const mezun = { ...g4, durum: "mezun" as const };
    expect(kayitDurumGecisEngeli("mezun", "aktif")).toMatch(/geri alınamaz/);
    expect(kayitYazmaEngeli({ ...mezun, ekHizmetler: ["Kitap seti"] }, mezun, db, { rol: "genel-yonetici" })).toMatch(/Mezun kayıt/);
    expect(kayitYazmaEngeli({ ...mezun, durum: "iptal" }, mezun, db, { rol: "genel-yonetici" })).toMatch(/Mezun kayıt/); // anonimleştirme dışında
  });
  it("nakil hedef grubu: hedef şube, aynı sezon ve seviye, boş kontenjan; en boşu", () => {
    const x = kopya();
    x.gruplar.push({ ...x.gruplar.find((g) => g.id === "g6")!, id: "g6b", kapasite: 30 });
    const k = { ...k4, grupId: "g6" }; // 7. sınıf kaydı gibi
    expect(nakilHedefGrubu(x, k, "s2")?.id).toBe("g6b");
    expect(nakilHedefGrubu(db, k4, "s2")).toBeNull(); // s2de 3. sınıf yok
    const dolu = { ...db, gruplar: db.gruplar.map((g) => (g.id === "g6" ? { ...g, kapasite: 7 } : g)) };
    expect(nakilHedefGrubu(dolu, k, "s2")).toBeNull();
    expect(nakilHedefGrubu(dolu, { ...k, durum: "dondurulmus" }, "s2")?.id).toBe("g6"); // dondurulmuş doluluğa sayılmaz
  });
  it("kapsam dışına nakil: yalnızca şube/grup/geçmiş değişir; aktif sezon, aktif şube", () => {
    const eski = { ...k4, grupId: "g6", grupGecmisi: [{ grupId: "g6", tarih: "2026-09-05" }] };
    const nakil = { ...eski, subeId: "s2", grupId: "g6", grupGecmisi: [...eski.grupGecmisi, { grupId: "g6", tarih: BUGUN }] };
    expect(kapsamDisiNakilEngeli(nakil, eski, db)).toBeNull();
    expect(kapsamDisiNakilEngeli({ ...nakil, ekHizmetler: ["Yaz okulu"] }, eski, db)).toMatch(/diğer bilgileri/);
    expect(kapsamDisiNakilEngeli({ ...nakil, subeId: "s3" }, eski, db)).toMatch(/Pasif/);
    expect(kapsamDisiNakilEngeli({ ...nakil, grupId: "g5" }, eski, db)).toMatch(/uygun grubu/);
    expect(kapsamDisiNakilEngeli(nakil, { ...eski, durum: "iptal" }, db)).toMatch(/süren/);
    expect(kapsamDisiNakilEngeli({ ...nakil, sezonId: "z1" }, { ...eski, sezonId: "z1" }, { ...db, gruplar: db.gruplar.map((g) => ({ ...g, sezonId: "z1" })) })).toMatch(/aktif sezon/);
  });
});
