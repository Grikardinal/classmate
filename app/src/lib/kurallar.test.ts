import { describe, expect, it } from "vitest";
import {
  adSoyadBol,
  cakismaBul,
  csvCoz,
  csvOlustur,
  devamsizlikOzeti,
  gecikmeGunu,
  hakEdis,
  haftaBasi,
  haftaGunu,
  hatirlatmaGunuMu,
  iyelik,
  gorevCoz,
  basliklariEslestir,
  personelAlanlari,
  kanalSec,
  mukerrerMi,
  sablonDoldur,
  satirCoz,
  sonrakiDurum,
  sozlesmeNo,
  subeGecisUyarisi,
  sutunEslestir,
  tahsilatDagit,
  taksitPlani,
  telefonNormalize,
  yoklamaGecikti,
  type Slot,
} from "./kurallar";

describe("telefon ve isim (04, 14)", () => {
  it("telefonu tek formata çevirir", () => {
    expect(telefonNormalize("05321234567")).toBe("0532 123 45 67");
    expect(telefonNormalize("532 123 45 67")).toBe("0532 123 45 67");
    expect(telefonNormalize("+90 (532) 123-45-67")).toBe("0532 123 45 67");
    expect(telefonNormalize("0212 555 10 10")).toBeNull(); // sabit hat
    expect(telefonNormalize("0532 123 45 6")).toBeNull();
    expect(telefonNormalize("")).toBeNull();
  });
  it("Türkçe tamlayan ekini ünlü uyumuyla üretir", () => {
    expect(["Ayşe", "Ecrin", "Duru", "Ömer", "Alp", "Ali", "Kuzey", "Öykü", "Aras"].map(iyelik)).toEqual([
      "Ayşe'nin", "Ecrin'in", "Duru'nun", "Ömer'in", "Alp'ın", "Ali'nin", "Kuzey'in", "Öykü'nün", "Aras'ın",
    ]);
  });
  it("ad-soyadı böler", () => {
    expect(adSoyadBol("Ayşe Nur Yılmaz")).toEqual({ ad: "Ayşe Nur", soyad: "Yılmaz" });
    expect(adSoyadBol("  Ali  ")).toEqual({ ad: "Ali", soyad: "" });
  });
  it("mükerrer öğrenciyi ad + veli telefonundan yakalar (büyük/küçük harf duyarsız)", () => {
    const mevcut = [{ ad: "Elif", soyad: "Kaya", veliTelefonlari: ["0532 123 45 67"] }];
    expect(mukerrerMi({ ad: "ELİF", soyad: "kaya", veliTelefon: "05321234567" }, mevcut)).toBe(true);
    expect(mukerrerMi({ ad: "Elif", soyad: "Kaya", veliTelefon: "05329999999" }, mevcut)).toBe(false);
  });
  it("sözleşme numarası şube içinde sıralı", () => {
    expect(sozlesmeNo("MRK", 2026, [])).toBe("MRK-2026-0001");
    expect(sozlesmeNo("MRK", 2026, ["MRK-2026-0041", "KZY-2026-0099", "MRK-2026-0007"])).toBe("MRK-2026-0042");
  });
});

describe("ders programı (06)", () => {
  const s = (p: Partial<Slot>): Slot => ({ id: "x", gun: 1, bas: 960, bit: 1000, ogretmenId: "p1", derslikId: "d1", grupId: "g1", subeId: "s1", ...p });
  it("öğretmen, derslik ve grup çakışmasını bulur", () => {
    const mevcut = [s({ id: "a", ogretmenId: "p1", derslikId: "d9", grupId: "g9" })];
    expect(cakismaBul(s({ id: "b", derslikId: "d2", grupId: "g2" }), mevcut).map((c) => c.tur)).toEqual(["ogretmen"]);
    expect(cakismaBul(s({ id: "b", ogretmenId: "p2", grupId: "g2", derslikId: "d9" }), mevcut).map((c) => c.tur)).toEqual(["derslik"]);
  });
  it("bitiş = başlangıç ise çakışma yok; farklı gün çakışmaz; kendisiyle çakışmaz", () => {
    const mevcut = [s({ id: "a" })];
    expect(cakismaBul(s({ id: "b", bas: 1000, bit: 1040 }), mevcut)).toHaveLength(0);
    expect(cakismaBul(s({ id: "b", gun: 2 }), mevcut)).toHaveLength(0);
    expect(cakismaBul(s({ id: "a" }), mevcut)).toHaveLength(0);
  });
  it("şubeler arası kısa geçişi uyarır", () => {
    const mevcut = [s({ id: "a", subeId: "s1", bas: 960, bit: 1000 })];
    expect(subeGecisUyarisi(s({ id: "b", subeId: "s2", bas: 1010, bit: 1050, derslikId: "d4", grupId: "g5" }), mevcut, 30)).toHaveLength(1);
    expect(subeGecisUyarisi(s({ id: "b", subeId: "s2", bas: 1030, bit: 1070, derslikId: "d4", grupId: "g5" }), mevcut, 30)).toHaveLength(0);
    expect(subeGecisUyarisi(s({ id: "b", subeId: "s1", bas: 1010, bit: 1050 }), mevcut, 30)).toHaveLength(0);
  });
  it("hafta günü ve hafta başı", () => {
    expect(haftaGunu("2026-10-09")).toBe(5); // Cuma
    expect(haftaGunu("2026-10-11")).toBe(7); // Pazar
    expect(haftaBasi("2026-10-11")).toBe("2026-10-05");
  });
});

describe("yoklama (07)", () => {
  it("izinli devamsızlık orana katılmaz", () => {
    const o = devamsizlikOzeti(["geldi", "gelmedi", "izinli", "gec"]);
    expect(o.oran).toBe(0.25);
    expect(o.izinliOran).toBe(0.25);
    expect(devamsizlikOzeti([]).oran).toBe(0);
  });
  it("15 dakika sonra yoklama gecikmiş sayılır", () => {
    expect(yoklamaGecikti("16:00", "16:14")).toBe(false);
    expect(yoklamaGecikti("16:00", "16:15")).toBe(true);
  });
  it("dokununca durum döner", () => {
    expect(sonrakiDurum("geldi")).toBe("gelmedi");
    expect(sonrakiDurum("izinli")).toBe("geldi");
  });
});

describe("bildirimler (10)", () => {
  it("uygulama + SMS: push kapalıysa SMS'e düşer", () => {
    expect(kanalSec("push+sms", true)).toBe("push");
    expect(kanalSec("push+sms", false)).toBe("sms");
    expect(kanalSec("push", false)).toBe("push");
    expect(kanalSec("sms", true)).toBe("sms");
  });
  it("şablon değişkenlerini doldurur, bilinmeyeni olduğu gibi bırakır", () => {
    expect(sablonDoldur("{ogrenci} bugün {saat} {ders} dersine katılmadı. {x}", { ogrenci: "Ayşe", saat: "16:00", ders: "Matematik" })).toBe(
      "Ayşe bugün 16:00 Matematik dersine katılmadı. {x}",
    );
  });
});

describe("finans (05)", () => {
  it("taksit planı kuruşu kaybetmez, küsurat son taksite gider", () => {
    const p = taksitPlani(1000, 0, 3, "2026-09-05");
    expect(p.map((x) => x.tutar)).toEqual([333.33, 333.33, 333.34]);
    expect(p.map((x) => x.vade)).toEqual(["2026-09-05", "2026-10-05", "2026-11-05"]);
  });
  it("peşinatlı planda taksitler bir sonraki aydan başlar; ay sonu taşmaz", () => {
    const p = taksitPlani(12000, 3000, 3, "2027-01-31");
    expect(p[0]).toEqual({ no: 0, vade: "2027-01-31", tutar: 3000 });
    expect(p[1].vade).toBe("2027-02-28");
    expect(p.reduce((s, x) => s + x.tutar, 0)).toBe(12000);
  });
  it("tahsilat en eski taksitten dağıtılır, kısmi ödeme ve artan hesaplanır", () => {
    const acik = [{ id: "a", kalan: 100 }, { id: "b", kalan: 100 }];
    expect(tahsilatDagit(150, acik)).toEqual({ dagilim: [{ taksitId: "a", tutar: 100 }, { taksitId: "b", tutar: 50 }], artan: 0 });
    expect(tahsilatDagit(250, acik).artan).toBe(50);
    expect(tahsilatDagit(0.1 + 0.2, [{ id: "a", kalan: 0.3 }]).dagilim[0].tutar).toBe(0.3);
  });
  it("gecikme günü ve hatırlatma günleri", () => {
    expect(gecikmeGunu("2026-10-05", "2026-10-09")).toBe(4);
    expect(gecikmeGunu("2026-10-15", "2026-10-09")).toBe(0);
    expect(hatirlatmaGunuMu("2026-10-12", "2026-10-09")).toBe(true); // 3 gün önce
    expect(hatirlatmaGunuMu("2026-09-29", "2026-10-09")).toBe(true); // 10. gün
    expect(hatirlatmaGunuMu("2026-10-08", "2026-10-09")).toBe(false);
  });
});

describe("hak ediş (13)", () => {
  it("ücret tiplerine göre hesaplar", () => {
    expect(hakEdis("sabit", 10, 400, 20000)).toBe(20000);
    expect(hakEdis("ders", 10, 400, 20000)).toBe(4000);
    expect(hakEdis("karma", 10, 400, 20000)).toBe(24000);
  });
});

describe("Excel içe aktarma (14)", () => {
  it("CSV'yi ; veya , ayraçla, tırnaklarla çözer ve geri üretir", () => {
    expect(csvCoz('Ad;Not\n"Kaya; Elif";"dedi ""merhaba"""')).toEqual([["Ad", "Not"], ["Kaya; Elif", 'dedi "merhaba"']]);
    expect(csvCoz("a,b\n1,2")).toEqual([["a", "b"], ["1", "2"]]);
    const geri = csvCoz(csvOlustur([["x;y", 'a"b'], [1, 2]]));
    expect(geri).toEqual([["x;y", 'a"b'], ["1", "2"]]);
  });
  it("başlıklardan sütunları otomatik eşleştirir", () => {
    const e = sutunEslestir(["Öğrenci Adı Soyadı", "Sınıf", "Okul", "Veli Adı Soyadı", "Veli Tel", "Grup", "Şube"]);
    expect(e.adSoyad).toBe(0);
    expect(e.seviye).toBe(1);
    expect(e.veliAdSoyad).toBe(3);
    expect(e.veliTelefon).toBe(4);
    expect(e.grup).toBe(5);
    expect(e.sube).toBe(6);
  });
  it("satırı doğrular: boş ad, hatalı telefon, seviye dışı", () => {
    const e = { adSoyad: 0, seviye: 1, veliTelefon: 2 } as const;
    const iyi = satirCoz(["Deniz Yalçın", "5. sınıf", "+90 532 410 11 22"], e, 2);
    expect(iyi.hatalar).toEqual([]);
    expect(iyi.veliTelefon).toBe("0532 410 11 22");
    expect(iyi.seviye).toBe(5);
    const kotu = satirCoz(["", "9", "0532 1"], e, 3);
    expect(kotu.hatalar).toEqual(["Öğrenci adı boş", "Seviye 3–8 arası olmalı (9)", "Hatalı telefon: 0532 1"]);
  });
});

describe("personel içe aktarma (14)", () => {
  it("görev metnini role çevirir", () => {
    expect(["Öğretmen", "matematik öğretmeni", "Şube Müdürü", "Sekreter", "Kayıt görevlisi", "Aşçı", ""].map(gorevCoz)).toEqual([
      "ogretmen", "ogretmen", "sube-muduru", "sekreter", "sekreter", null, null,
    ]);
  });
  it("personel sütunlarını eşleştirir", () => {
    const e = basliklariEslestir(["Ad Soyad", "Görev", "Cep Telefonu", "E-posta", "Şube", "Branş"], personelAlanlari);
    expect(e).toEqual({ adSoyad: 0, gorev: 1, telefon: 2, eposta: 3, sube: 4, brans: 5 });
  });
});