import { describe, expect, it } from "vitest";
import { sablonDoldur, smsBoyu } from "../../lib/kurallar";
import {
  ayarEngeli,
  duyuruEngeli,
  duyuruKapsamda,
  gonderimKanali,
  metinEngeli,
  metinSablonaUyar,
  netgsmYanitiCoz,
  olayCalisir,
  olayUretmeYetkisi,
  olayYazmaEngeli,
  pushAbonelikTemizle,
  sablonEngeli,
  sirlariGizle,
  takiliSatirlar,
  tekrarEdilebilir,
  tekrarEngeli,
  yalnizSunucuOlayi,
  MAKS_DENEME,
} from "./kurallar";

describe("smsBoyu", () => {
  it("GSM: 160 tek parça, sonrası 153'lük", () => {
    expect(smsBoyu("a".repeat(160))).toBe(1);
    expect(smsBoyu("a".repeat(161))).toBe(2);
    expect(smsBoyu("a".repeat(307))).toBe(3);
  });
  it("Türkçe karakter: 155 / 150", () => {
    expect(smsBoyu("ş" + "a".repeat(154))).toBe(1);
    expect(smsBoyu("ş" + "a".repeat(155))).toBe(2);
  });
  it("Unicode: 70 / 67; uzantı karakteri iki sayılır", () => {
    expect(smsBoyu("“" + "a".repeat(69))).toBe(1);
    expect(smsBoyu("“" + "a".repeat(70))).toBe(2);
    expect(smsBoyu("{" + "a".repeat(159))).toBe(2);
  });
  it("boş metin bir parça", () => expect(smsBoyu("")).toBe(1));
});

describe("şablon", () => {
  it("değişken değeri yeniden açılmaz, nesne alanı sızmaz", () => {
    expect(sablonDoldur("{a}", { a: "{b}", b: "x" })).toBe("{b}");
    expect(sablonDoldur("{constructor}", {})).toBe("{constructor}");
  });
  it("olayın vermediği değişken reddedilir", () => {
    expect(sablonEngeli("devamsizlik", "{ogrenci} {saat}")).toBeNull();
    expect(sablonEngeli("devamsizlik", "{tutar}")).toMatch(/kullanılamayan/);
    expect(sablonEngeli("onKayitTesekkur", "{ogrenci}")).toMatch(/kullanılamayan/);
  });
  it("boş ve çok uzun şablon reddedilir", () => {
    expect(sablonEngeli("devamsizlik", "  ")).toMatch(/boş/);
    expect(sablonEngeli("devamsizlik", "a".repeat(501))).toMatch(/en fazla/);
  });
  it("olay tanımı değişmez, kanal geçerli olmalı", () => {
    const o = { key: "devamsizlik", ad: "D", kanal: "push", aktif: true, sablon: "{ogrenci}" } as const;
    expect(olayYazmaEngeli({ ...o }, o)).toBeNull();
    expect(olayYazmaEngeli({ ...o }, undefined)).toMatch(/eklenemez/);
    expect(olayYazmaEngeli({ ...o, ad: "X" }, o)).toMatch(/tanımı/);
    expect(olayYazmaEngeli({ ...o, kanal: "whatsapp" as never }, o)).toMatch(/kanal/);
  });
});

describe("metinSablonaUyar", () => {
  const s = "{ogrenci} bugün {saat} {ders} dersine katılmadı. {sube_adi} {sube_telefonu}";
  it("doldurulmuş metin uyar", () => expect(metinSablonaUyar("Ali Can bugün 16:00 Fen Bilimleri dersine katılmadı. Kadıköy Şube 0212 555", s)).toBe(true));
  it("serbest metin uymaz", () => expect(metinSablonaUyar("Ödemenizi şu hesaba yapın", s)).toBe(false));
  it("sabit parçası eksik metin uymaz", () => expect(metinSablonaUyar("Ali bugün 16:00 Fen dersine geldi. A B", s)).toBe(false));
  it("değişkene sığmayacak uzunlukta metin uymaz", () => expect(metinSablonaUyar(`${"x".repeat(301)} bugün 16:00 Fen dersine katılmadı. A B`, s)).toBe(false));
  it("değişkensiz şablon birebir eşleşir", () => {
    expect(metinSablonaUyar("Merhaba", "Merhaba")).toBe(true);
    expect(metinSablonaUyar("Merhaba!", "Merhaba")).toBe(false);
  });
});

describe("olay ve kanal", () => {
  const hepsi = () => true;
  it("sunucu olayları istemciden gelmez", () => {
    for (const o of ["otp", "devamsizlikDuzeltme", "odevDuzeltme", "etutIptal", "duyuru"]) expect(yalnizSunucuOlayi(o)).toBe(true);
    expect(yalnizSunucuOlayi("devamsizlik")).toBe(false);
  });
  it("öğretmen finans ve ders iptali bildirimi üretemez", () => {
    expect(olayUretmeYetkisi("gecikmisOdeme", "ogretmen", hepsi)).toBe(false);
    expect(olayUretmeYetkisi("dersIptal", "ogretmen", hepsi)).toBe(false);
    expect(olayUretmeYetkisi("devamsizlik", "ogretmen", hepsi)).toBe(true);
  });
  it("bölüm yetkisi gerekir, genel yönetici muaf", () => {
    expect(olayUretmeYetkisi("odemeAlindi", "sekreter", (b) => b === "07")).toBe(false);
    expect(olayUretmeYetkisi("odemeAlindi", "sekreter", (b) => b === "05")).toBe(true);
    expect(olayUretmeYetkisi("odemeAlindi", "genel-yonetici", () => false)).toBe(true);
  });
  it("kapalı olay ve kapalı modül çalışmaz", () => {
    expect(olayCalisir({ aktif: false }, {})).toBe(false);
    expect(olayCalisir({ aktif: true, finans: true }, { finans: false })).toBe(false);
    expect(olayCalisir({ aktif: true, modul: "etut" }, { etut: false })).toBe(false);
    expect(olayCalisir({ aktif: true, modul: "etut" }, { etut: true })).toBe(true);
  });
  it("kanalı olay, push durumu ve SMS izni belirler", () => {
    const y = { kanal: "push+sms" } as const;
    expect(gonderimKanali(y, { pushAcik: false })).toBe("sms");
    expect(gonderimKanali(y, { pushAcik: true })).toBe("push");
    expect(gonderimKanali(y, { pushAcik: false, izinSms: false })).toBe("push");
    expect(gonderimKanali({ kanal: "push" }, { pushAcik: false })).toBe("push");
  });
  it("metin boş veya aşırı uzun olamaz", () => {
    expect(metinEngeli("")).toMatch(/boş/);
    expect(metinEngeli("a".repeat(1001))).toMatch(/uzun/);
    expect(metinEngeli("a")).toBeNull();
  });
});

describe("tekrar ve takılı satır", () => {
  it("yalnızca başarısız, yetkili, sınır içinde", () => {
    expect(tekrarEngeli({ durum: "iletildi", olay: "duyuru" }, true)).toMatch(/değiştirilemez/);
    expect(tekrarEngeli({ durum: "basarisiz", olay: "duyuru" }, false)).toMatch(/değiştirilemez/);
    expect(tekrarEngeli({ durum: "basarisiz", olay: "duyuru", deneme: MAKS_DENEME - 1 }, true)).toBeNull();
    expect(tekrarEngeli({ durum: "basarisiz", olay: "duyuru", deneme: MAKS_DENEME }, true)).toMatch(/en fazla/);
  });
  it("giriş kodu tekrar edilemez", () => {
    expect(tekrarEngeli({ durum: "basarisiz", olay: "otp" }, true)).toMatch(/yeni kod/);
    expect(tekrarEdilebilir({ durum: "basarisiz", olay: "otp" })).toBe(false);
  });
  it("işaretli bekleyen satır takılıdır", () => {
    const l = [{ id: "a", durum: "bekliyor", gonderimBasladi: "t" }, { id: "b", durum: "bekliyor" }, { id: "c", durum: "iletildi", gonderimBasladi: "t" }] as const;
    expect(takiliSatirlar([...l]).map((g) => g.id)).toEqual(["a"]);
  });
});

describe("Netgsm", () => {
  it("başarı kodları", () => {
    expect(netgsmYanitiCoz(200, "00 123")).toEqual({ tamam: true, ref: "123" });
    expect(netgsmYanitiCoz(200, "01 9").tamam).toBe(true);
    expect(netgsmYanitiCoz(200, "02 9").tamam).toBe(true);
  });
  it("hata kodları anlamıyla, bilinmeyen yanıtın gövdesi yazılmaz", () => {
    expect(netgsmYanitiCoz(200, "30")).toEqual({ tamam: false, hata: expect.stringMatching(/Netgsm 30: .*şifre/) });
    expect(netgsmYanitiCoz(200, "85")).toEqual({ tamam: false, hata: expect.stringMatching(/mükerrer/) });
    expect(netgsmYanitiCoz(200, "<html>gizli</html>")).toEqual({ tamam: false, hata: expect.not.stringContaining("gizli") });
    expect(netgsmYanitiCoz(200, "")).toEqual({ tamam: false, hata: expect.stringMatching(/boş yanıt/) });
  });
  it("HTTP hatası başarı sayılmaz", () => expect(netgsmYanitiCoz(500, "00 1").tamam).toBe(false));
  it("kimlik bilgileri (URL kodlusu dahil) gizlenir", () => {
    const m = sirlariGizle("https://x?usercode=ali&password=p%40ss p@ss", ["p@ss", "ali"]);
    expect(m).not.toMatch(/p@ss|p%40ss|ali/);
  });
});

describe("pushAbonelikTemizle", () => {
  const keys = { p256dh: "k", auth: "a" };
  it("bilinen servis kabul edilir, gereksiz alanlar atılır", () => {
    expect(pushAbonelikTemizle({ endpoint: "https://fcm.googleapis.com/fcm/send/x", keys, fazla: 1 })).toEqual({ endpoint: "https://fcm.googleapis.com/fcm/send/x", keys });
    expect(pushAbonelikTemizle({ endpoint: "https://web.push.apple.com/x", keys })).not.toBeNull();
    expect(pushAbonelikTemizle({ endpoint: "https://wns2-db5p.notify.windows.com/x", keys })).not.toBeNull();
    expect(pushAbonelikTemizle({ endpoint: "https://updates.push.services.mozilla.com/x", keys })).not.toBeNull();
  });
  it("iç ağ, http, benzer alan adı, eksik anahtar reddedilir", () => {
    for (const endpoint of ["https://169.254.169.254/x", "http://fcm.googleapis.com/x", "https://fcm.googleapis.com.kotu.com/x", "https://fcm.googleapis.com:8443/x", "bozuk"]) expect(pushAbonelikTemizle({ endpoint, keys })).toBeNull();
    expect(pushAbonelikTemizle({ endpoint: "https://fcm.googleapis.com/x", keys: { p256dh: "k" } })).toBeNull();
    expect(pushAbonelikTemizle(null)).toBeNull();
  });
});

describe("ayarlar", () => {
  const eski = { gonderimBas: "08:00", gonderimBit: "21:00", smsBirimFiyat: 0.5 };
  it("değişmeyen ayar denetlenmez", () => expect(ayarEngeli({ ...eski }, eski)).toBeNull());
  it("aralık geçerli ve sıralı olmalı", () => {
    expect(ayarEngeli({ ...eski, gonderimBas: "25:00" }, eski)).toMatch(/geçersiz/);
    expect(ayarEngeli({ ...eski, gonderimBas: "22:00" }, eski)).toMatch(/önce/);
  });
  it("birim fiyat negatif, NaN olamaz", () => {
    expect(ayarEngeli({ ...eski, smsBirimFiyat: -1 }, eski)).toMatch(/fiyat/);
    expect(ayarEngeli({ ...eski, smsBirimFiyat: NaN }, eski)).toMatch(/fiyat/);
    expect(ayarEngeli({ ...eski, smsBirimFiyat: 1 }, eski)).toBeNull();
  });
});

describe("duyuru", () => {
  const d = { subeler: [{ id: "s1" }], gruplar: [{ id: "g1" }] };
  const du = { baslik: "B", metin: "M", hedef: { tur: "sube" as const, deger: "s1" }, kanal: "push" as const, zamanlanmis: false, zaman: "2030-01-01T10:00" };
  const simdi = "2030-01-01T10:00";
  it("geçerli", () => expect(duyuruEngeli(du, d, simdi)).toBeNull());
  it("zorunlu alan, uzunluk, kanal", () => {
    expect(duyuruEngeli({ ...du, baslik: " " }, d, simdi)).toMatch(/zorunlu/);
    expect(duyuruEngeli({ ...du, baslik: "a".repeat(121) }, d, simdi)).toMatch(/Başlık/);
    expect(duyuruEngeli({ ...du, metin: "a".repeat(1001) }, d, simdi)).toMatch(/Metin/);
    expect(duyuruEngeli({ ...du, kanal: "sms" as never }, d, simdi)).toMatch(/kanal/);
  });
  it("hedef gerçek olmalı", () => {
    expect(duyuruEngeli({ ...du, hedef: { tur: "sube", deger: "yok" } }, d, simdi)).toMatch(/hedef/);
    expect(duyuruEngeli({ ...du, hedef: { tur: "grup", deger: "yok" } }, d, simdi)).toMatch(/hedef/);
    expect(duyuruEngeli({ ...du, hedef: { tur: "seviye", deger: "x" } }, d, simdi)).toMatch(/hedef/);
    expect(duyuruEngeli({ ...du, hedef: { tur: "tum", deger: null } }, d, simdi)).toBeNull();
  });
  it("zamanlama ileri olmalı", () => {
    expect(duyuruEngeli({ ...du, zamanlanmis: true }, d, simdi)).toMatch(/ileri/);
    expect(duyuruEngeli({ ...du, zamanlanmis: true, zaman: "2030-01-02T10:00" }, d, simdi)).toBeNull();
  });
  it("kapsam: şube, grup, sınırlı seviye", () => {
    const gs = () => "s1";
    expect(duyuruKapsamda({ hedef: { tur: "sube", deger: "s1" } }, ["s1"], gs, false)).toBe(true);
    expect(duyuruKapsamda({ hedef: { tur: "sube", deger: "s2" } }, ["s1"], gs, false)).toBe(false);
    expect(duyuruKapsamda({ hedef: { tur: "grup", deger: "g" } }, ["s1"], gs, false)).toBe(true);
    expect(duyuruKapsamda({ hedef: { tur: "seviye", deger: "5" }, subeIds: ["s1"] }, ["s1"], gs, false)).toBe(true);
    expect(duyuruKapsamda({ hedef: { tur: "seviye", deger: "5" } }, ["s1"], gs, false)).toBe(false);
    expect(duyuruKapsamda({ hedef: { tur: "tum", deger: null } }, ["s1"], gs, false)).toBe(false);
    expect(duyuruKapsamda({ hedef: { tur: "tum", deger: null } }, [], gs, true)).toBe(true);
  });
});
