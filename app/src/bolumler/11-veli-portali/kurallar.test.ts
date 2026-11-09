import { describe, expect, it } from "vitest";
import type { Db, Taksit } from "@/data/model";
import { acikTaksitler, bekleyenOdevler, devamMetni, grupOgretmenleri, kodHataMesaji, ogrenciOdevleri, okunmamisDuyuruSayisi, randevuIptalDurumu, randevuRozeti, taksitOzeti, veliDuyurulari, veliGonderimGorunur } from "./kurallar";

const AN = { bugun: "2030-03-10", simdi: "10:00" };
const moduller = (p: Partial<Db["moduller"]> = {}) => ({ finans: true, odev: true, etut: true, onKayit: true, ...p }) as Db["moduller"];
const olaylar = [{ key: "taksitHatirlatma", finans: true }, { key: "yeniOdev", modul: "odev" }, { key: "devamsizlik" }] as Parameters<typeof veliGonderimGorunur>[1];

describe("giriş kodu hataları", () => {
  it("kalan deneme gösterilir", () => expect(kodHataMesaji("hatali", 3)).toBe("Kod hatalı. Kalan deneme: 3"));
  it("kalan bilinmiyorsa sade mesaj", () => expect(kodHataMesaji("hatali")).toBe("Kod hatalı."));
  it("deneme / süre / kod yok ayrı mesaj", () => {
    expect(kodHataMesaji("deneme")).toMatch(/Yeni kod/);
    expect(kodHataMesaji("sure")).toMatch(/süresi/);
    expect(kodHataMesaji("yok")).toMatch(/Önce/);
  });
});

describe("gönderim görünürlüğü", () => {
  it("giriş kodu hiç görünmez", () => expect(veliGonderimGorunur({ olay: "otp" }, olaylar, moduller())).toBe(false));
  it("finans kapalıyken ödeme bildirimi görünmez", () => {
    expect(veliGonderimGorunur({ olay: "taksitHatirlatma" }, olaylar, moduller({ finans: false }))).toBe(false);
    expect(veliGonderimGorunur({ olay: "taksitHatirlatma" }, olaylar, moduller())).toBe(true);
  });
  it("kapalı modülün bildirimi görünmez, modülsüz olay görünür", () => {
    expect(veliGonderimGorunur({ olay: "yeniOdev" }, olaylar, moduller({ odev: false }))).toBe(false);
    expect(veliGonderimGorunur({ olay: "devamsizlik" }, olaylar, moduller({ finans: false, odev: false }))).toBe(true);
  });
});

describe("ödevler", () => {
  const o = (id: string, p: object = {}) => ({ id, grupId: "g1", ogrenciIds: null as string[] | null, teslim: "2030-03-12", teslimler: {} as Record<string, "yapti">, ...p });
  it("yalnızca çocuğun grubu ve hedefi", () => {
    const l = ogrenciOdevleri([o("a"), o("b", { grupId: "g2" }), o("c", { ogrenciIds: ["x"] }), o("d", { ogrenciIds: ["o1"] })], "g1", "o1");
    expect(l.map((x) => x.id).sort()).toEqual(["a", "d"]);
  });
  it("bekleyen: geçmiş ve işaretlenmiş olan çıkar, en yakın önce", () => {
    const l = bekleyenOdevler([o("gec", { teslim: "2030-03-09" }), o("bitti", { teslimler: { o1: "yapti" } }), o("uzak", { teslim: "2030-03-20" }), o("yakin", { teslim: "2030-03-10" })], "g1", "o1", AN.bugun);
    expect(l.map((x) => x.id)).toEqual(["yakin", "uzak"]);
  });
  it("kardeşin teslimi diğer çocuğu etkilemez", () => {
    expect(bekleyenOdevler([o("a", { teslimler: { o2: "yapti" } })], "g1", "o1", AN.bugun)).toHaveLength(1);
  });
});

describe("duyurular", () => {
  const d = (id: string, p: object = {}) => ({ id, zamanlanmis: false, aliciVeliIds: ["v1"], okuyanVeliIds: [] as string[], zaman: "2030-01-01T10:00", ...p });
  it("zamanlanmış ve başkasına giden çıkar, yeni önce", () => {
    expect(veliDuyurulari([d("a"), d("b", { zaman: "2030-02-01T10:00" }), d("c", { zamanlanmis: true }), d("e", { aliciVeliIds: ["v2"] })], "v1").map((x) => x.id)).toEqual(["b", "a"]);
  });
  it("okunmamış sayısı yalnızca bu veli için", () => {
    expect(okunmamisDuyuruSayisi([d("a"), d("b", { okuyanVeliIds: ["v1"] }), d("c", { okuyanVeliIds: ["v2"] })], "v1")).toBe(2);
  });
});

describe("ödemeler", () => {
  const t = (id: string, vade: string, tutar: number, odenen: number, ogrenciId = "o1") => ({ id, kayitId: "k", ogrenciId, veliId: "v1", subeId: "s1", no: 1, vade, tutar, odenen }) as Taksit;
  it("açık taksitler vadeye göre, ödenen ve kardeş çıkar", () => {
    expect(acikTaksitler([t("b", "2030-05-01", 100, 0), t("a", "2030-04-01", 100, 50), t("c", "2030-03-01", 100, 100), t("d", "2030-01-01", 100, 0, "o2")], "o1").map((x) => x.id)).toEqual(["a", "b"]);
  });
  it("kalan ve geciken toplamı; vadesi bugün olan gecikmiş sayılmaz", () => {
    expect(taksitOzeti([t("a", "2030-03-09", 100, 40), t("b", AN.bugun, 200, 0), t("c", "2030-01-01", 50, 50)], AN.bugun)).toEqual({ kalan: 260, geciken: 60 });
  });
});

describe("devam oranı (devamsizlikOzeti)", () => {
  it("izinli dersler pay ve paydadan çıkar", () => expect(devamMetni(["geldi", "gelmedi", "izinli", "izinli"])).toBe("%50"));
  it("geç gelen devam etmiş sayılır", () => expect(devamMetni(["gec", "geldi"])).toBe("%100"));
  it("ders yoksa veya hepsi izinliyse %100 denmez", () => {
    expect(devamMetni([])).toBe("—");
    expect(devamMetni(["izinli"])).toBe("—");
  });
});

describe("öğretmen listesi", () => {
  it("kapanmış satır sayılmaz, dersler tekilleşir", () => {
    const l = grupOgretmenleri([
      { grupId: "g1", ogretmenId: "p1", dersId: "d1", bitis: null },
      { grupId: "g1", ogretmenId: "p1", dersId: "d1", bitis: null },
      { grupId: "g1", ogretmenId: "p1", dersId: "d2", bitis: "2030-01-01" },
      { grupId: "g1", ogretmenId: "p2", dersId: "d3", bitis: "2030-01-01" },
      { grupId: "g2", ogretmenId: "p3", dersId: "d4", bitis: null },
    ], "g1");
    expect(l).toEqual([{ ogretmenId: "p1", dersIds: ["d1"] }]);
  });
});

describe("randevu", () => {
  const r = (p: object = {}) => ({ tarih: "2030-03-12", bas: "14:00", durum: "planli" as const, ...p });
  it("süresi varsa açık, geçtiyse kapalı", () => {
    expect(randevuIptalDurumu(r(), 2, AN)).toBe("acik");
    expect(randevuIptalDurumu(r({ tarih: AN.bugun, bas: "11:00" }), 2, AN)).toBe("sure-gecti");
  });
  it("sonuçlanmış veya geçmiş randevu", () => {
    expect(randevuIptalDurumu(r({ durum: "yapildi" }), 2, AN)).toBe("sonuc");
    expect(randevuIptalDurumu(r({ tarih: "2030-03-01" }), 2, AN)).toBe("sonuc");
  });
  it("grup etüdünde kendi çocuğunun sonucu, Türkçe etiket", () => {
    const g = { durum: "yapildi" as const, sonuclar: { o1: "gelmedi" as const, o2: "yapildi" as const } };
    expect(randevuRozeti(g, "o1")).toEqual({ ad: "Gelmedi", ton: "danger" });
    expect(randevuRozeti({ durum: "planli" }, "o1").ad).toBe("Planlı");
  });
});
