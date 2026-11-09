import { describe, expect, it } from "vitest";
import { EK_SUBE_AYLIK, aylikFiyat, paketler, yillikFiyat, yillikKazanc } from "./fiyat";

describe("tanıtım fiyatları", () => {
  it("onaylı yıllık fiyatları verir", () => {
    expect([1, 2, 3].map(yillikFiyat)).toEqual([24_000, 42_000, 57_000]);
  });
  it("onaylı aylık fiyatları verir", () => {
    expect([1, 2, 3].map(aylikFiyat)).toEqual([2_400, 4_200, 5_700]);
    expect(EK_SUBE_AYLIK).toBe(1_500);
  });
  it("3 şubeden sonra her şubeye ek ücret ekler", () => {
    expect(yillikFiyat(4)).toBe(72_000);
    expect(yillikFiyat(6)).toBe(102_000);
    expect(aylikFiyat(4)).toBe(7_200);
  });
  it("yıllık alım her pakette 2 ay kazandırır", () => {
    expect([1, 2, 3].map(yillikKazanc)).toEqual([4_800, 8_400, 11_400]);
    for (const s of [1, 2, 3, 4, 9]) expect(yillikKazanc(s)).toBe(aylikFiyat(s) * 2);
  });
  it("her kartın şube sayısı geçerlidir", () => {
    expect(paketler.map((p) => p.sube)).toEqual([1, 2, 3]);
  });
  it("geçersiz şube sayısını reddeder", () => {
    expect(() => yillikFiyat(0)).toThrow();
    expect(() => yillikFiyat(1.5)).toThrow();
    expect(() => aylikFiyat(0)).toThrow();
  });
});
