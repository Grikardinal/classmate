/**
 * Bölüm 02 saf kurallarının birim testleri (kurallar.ts).
 */
import { describe, expect, it } from "vitest";
import { ornekVeriUret, varsayilanRolYetkileri, type Kullanici } from "@/data/model";
import {
  atanabilirRoller,
  ayniEposta,
  bolumYetkisi,
  epostaDogrula,
  epostaNormalize,
  kapsamDuzelt,
  kendiHesabiEngeli,
  kullaniciDogrula,
  parolaDegisimDogrula,
  parolaKurali,
  parolaSifirlamaEngeli,
  rolAtamaEngeli,
  rolYetkileriDogrula,
  sonGenelYoneticiEngeli,
  yonetimEngeli,
} from "./kurallar";

const db = ornekVeriUret();
const k = (id: string) => db.kullanicilar.find((x) => x.id === id)!;

describe("örnek veri", () => {
  it("tüm kullanıcılar kurallara uyar", () => {
    for (const u of db.kullanicilar) expect(kullaniciDogrula(u, db), u.id).toBeNull();
  });
  it("varsayılan rol yetki tablosu geçerli; en az bir aktif genel yönetici var", () => {
    expect(rolYetkileriDogrula(varsayilanRolYetkileri)).toBeNull();
    expect(sonGenelYoneticiEngeli(db.kullanicilar)).toBeNull();
  });
});

describe("e-posta", () => {
  it("büyük/küçük harf ve Türkçe İ/I/ı farkı yok sayılır", () => {
    expect(epostaNormalize("  Ismail@Kurum.COM ")).toBe("ismail@kurum.com");
    expect(epostaNormalize("İSMAİL@kurum.com")).toBe("ismail@kurum.com");
    expect(epostaNormalize("ısmail@kurum.com")).toBe("ismail@kurum.com");
    expect(ayniEposta("YONETIM@ornekkurum.com", "yonetim@ornekkurum.com")).toBe(true);
    // toLocaleLowerCase("tr") "I" harfini "ı" yapıyordu; eski giriş kodu bu yüzden eşleşmiyordu
    expect("YONETIM@ornekkurum.com".toLocaleLowerCase("tr-TR")).not.toBe("yonetim@ornekkurum.com");
  });
  it("yinelenen e-posta reddedilir, kendi e-postası serbest", () => {
    expect(epostaDogrula("ELIF@ornekkurum.com", db.kullanicilar)).toMatch(/başka bir kullanıcı/);
    expect(epostaDogrula("elif@ornekkurum.com", db.kullanicilar, "u1")).toBeNull();
    expect(epostaDogrula("yeni@ornekkurum.com", db.kullanicilar)).toBeNull();
  });
  it("geçersiz veya boş e-posta reddedilir", () => {
    expect(epostaDogrula("", db.kullanicilar)).toMatch(/gerekli/);
    expect(epostaDogrula("elif@", db.kullanicilar)).toMatch(/Geçerli/);
    expect(epostaDogrula("a b@x.com", db.kullanicilar)).toMatch(/Geçerli/);
  });
});

describe("parola", () => {
  it("en az 8 karakter, harf ve rakam", () => {
    expect(parolaKurali("kisa1")).toMatch(/en az 8/);
    expect(parolaKurali("12345678!")).toMatch(/harf/);
    expect(parolaKurali("sadeceharf")).toMatch(/rakam/);
    expect(parolaKurali("Çiğdem2026")).toBeNull();
    expect(parolaKurali("x1".repeat(70))).toMatch(/en fazla/);
    expect(parolaKurali(undefined)).not.toBeNull();
  });
  it("değişimde tekrar eşleşmeli ve eskisinden farklı olmalı", () => {
    expect(parolaDegisimDogrula("Eski2026", "Yeni2026", "Yeni2027")).toMatch(/eşleşmiyor/);
    expect(parolaDegisimDogrula("Ayni2026", "Ayni2026", "Ayni2026")).toMatch(/farklı/);
    expect(parolaDegisimDogrula("Eski2026", "Yeni2026", "Yeni2026")).toBeNull();
  });
});

describe("rol ve şube kapsamı", () => {
  it("genel yönetici her zaman tüm şubeler; diğerleri liste", () => {
    expect(kapsamDuzelt("genel-yonetici", ["s1"], ["s1", "s2"])).toBe("all");
    expect(kapsamDuzelt("sekreter", "all", ["s1", "s2"])).toEqual(["s1", "s2"]);
    expect(kapsamDuzelt("sekreter", ["s1", "s1"], ["s1", "s2"])).toEqual(["s1"]);
  });
  it("genel yönetici olmayan kendinden yetkili rol atayamaz", () => {
    expect(atanabilirRoller("genel-yonetici")).toContain("genel-yonetici");
    expect(atanabilirRoller("sube-muduru")).toEqual(["sube-muduru", "sekreter", "ogretmen"]);
    expect(atanabilirRoller("sekreter")).toEqual(["sekreter", "ogretmen"]);
    expect(rolAtamaEngeli("sube-muduru", "genel-yonetici")).toMatch(/Genel yönetici/);
    expect(rolAtamaEngeli("sekreter", "sube-muduru")).toMatch(/yetkili/);
    expect(rolAtamaEngeli("sube-muduru", "sekreter")).toBeNull();
    expect(rolAtamaEngeli("genel-yonetici", "genel-yonetici")).toBeNull();
  });
  it("yönetim: üst rol, genel yönetici ve kapsam dışı hesap yönetilemez", () => {
    expect(yonetimEngeli(k("u1"), k("u0"), ["s1"])).toMatch(/genel yönetici/);
    expect(yonetimEngeli(k("u9"), k("u1"), ["s1"])).toMatch(/yetkili/);
    expect(yonetimEngeli(k("u1"), k("u10"), ["s1"])).toMatch(/kapsam/); // Emre: s2 + s1
    expect(yonetimEngeli(k("u1"), k("u9"), ["s1"])).toBeNull();
    expect(yonetimEngeli(k("u0"), k("u1"), [])).toBeNull();
  });
  it("kendi parolası sıfırlanamaz", () => {
    expect(parolaSifirlamaEngeli(k("u0"), k("u0"), [])).toMatch(/Parola değiştir/);
    expect(parolaSifirlamaEngeli(k("u0"), k("u9"), [])).toBeNull();
  });
  it("kendi rolü, şube kapsamı ve aktifliği değişmez; e-posta ve iki adım serbest", () => {
    const u: Kullanici = k("u1");
    expect(kendiHesabiEngeli(u, { ...u, rol: "sekreter" })).toMatch(/rol/);
    expect(kendiHesabiEngeli(u, { ...u, aktif: false })).toMatch(/pasif/);
    expect(kendiHesabiEngeli(u, { ...u, subeIds: ["s1", "s2"] })).toMatch(/şube/);
    expect(kendiHesabiEngeli(u, { ...u, eposta: "e@x.com", ikiAdim: true })).toBeNull();
  });
  it("bölüm yetkisi yalnızca true ile verilir", () => {
    expect(bolumYetkisi(db.rolYetkileri, "sube-muduru", "05")).toBe(true);
    expect(bolumYetkisi(db.rolYetkileri, "sube-muduru", "02")).toBe(false);
    expect(bolumYetkisi({ sekreter: { "02": "evet" as unknown as boolean } }, "sekreter", "02")).toBe(false);
    expect(bolumYetkisi(undefined, "sekreter", "02")).toBe(false);
  });
});

describe("kullanıcı satırı", () => {
  const yeni = (x: Partial<Kullanici>): Kullanici => ({ ...k("u9"), id: "uX", personelId: "pX", eposta: "x@ornekkurum.com", ...x });
  const baglam = { ...db, personel: [...db.personel, { ...db.personel[9], id: "pX" }] };
  it("geçerli satır", () => expect(kullaniciDogrula(yeni({}), baglam)).toBeNull());
  it("genel yönetici 'tüm şubeler' olmalı; diğer roller en az bir tanımlı şube", () => {
    expect(kullaniciDogrula(yeni({ rol: "genel-yonetici", subeIds: ["s1"] }), baglam)).toMatch(/tüm şubeleri/);
    expect(kullaniciDogrula(yeni({ subeIds: "all" }), baglam)).toMatch(/En az bir/);
    expect(kullaniciDogrula(yeni({ subeIds: [] }), baglam)).toMatch(/En az bir/);
    expect(kullaniciDogrula(yeni({ subeIds: ["s9"] }), baglam)).toMatch(/tanımsız/);
    expect(kullaniciDogrula(yeni({ subeIds: ["s1", "s1"] }), baglam)).toMatch(/yinelenen/);
  });
  it("geçersiz rol, eksik personel, ikinci hesap reddedilir", () => {
    expect(kullaniciDogrula(yeni({ rol: "admin" as never }), baglam)).toMatch(/rol/);
    expect(kullaniciDogrula(yeni({ personelId: "yok" }), baglam)).toMatch(/personel kartı/);
    expect(kullaniciDogrula(yeni({ personelId: "p9" }), { ...baglam, kullanicilar: [...db.kullanicilar, yeni({ personelId: "p9" })] })).toMatch(/zaten/);
  });
  it("son aktif genel yönetici kaldırılamaz", () => {
    expect(sonGenelYoneticiEngeli(db.kullanicilar.map((u) => (u.id === "u0" ? { ...u, aktif: false } : u)))).toMatch(/en az bir/);
    expect(sonGenelYoneticiEngeli(db.kullanicilar.map((u) => (u.id === "u0" ? { ...u, rol: "sekreter" as const } : u)))).toMatch(/en az bir/);
  });
});

describe("rol yetki tablosu", () => {
  const kopya = () => structuredClone(varsayilanRolYetkileri);
  it("genel yöneticinin bölümü kapatılamaz", () => {
    const t = kopya();
    t["genel-yonetici"]["02"] = false;
    expect(rolYetkileriDogrula(t)).toMatch(/kapatılamaz/);
  });
  it("eksik rol, tanımsız bölüm, boolean olmayan değer reddedilir", () => {
    const eksik: Record<string, unknown> = kopya();
    delete eksik.ogretmen;
    expect(rolYetkileriDogrula(eksik)).toMatch(/eksik/);
    expect(rolYetkileriDogrula({ ...kopya(), sekreter: { ...kopya().sekreter, "99": true } })).toMatch(/tanımsız bölüm/);
    expect(rolYetkileriDogrula({ ...kopya(), sekreter: { ...kopya().sekreter, "02": "evet" } })).toMatch(/geçersiz/);
    expect(rolYetkileriDogrula({ ...kopya(), admin: {} })).toMatch(/tanımsız rol/);
    expect(rolYetkileriDogrula(null)).not.toBeNull();
  });
});
