import { describe, expect, it } from "vitest";
import { paketler, yillikFiyat } from "./fiyat";

describe("tanıtım fiyatları", () => {
  it("onaylı paket fiyatlarını verir", () => {
    expect([1, 2, 3].map(yillikFiyat)).toEqual([24_000, 42_000, 57_000]);
  });
  it("3 şubeden sonra her şubeye ek ücret ekler", () => {
    expect(yillikFiyat(4)).toBe(72_000);
    expect(yillikFiyat(6)).toBe(102_000);
  });
  it("kart fiyatları hesapla aynıdır", () => {
    for (const p of paketler) expect(p.fiyat).toBe(yillikFiyat(p.sube));
  });
  it("geçersiz şube sayısını reddeder", () => {
    expect(() => yillikFiyat(0)).toThrow();
    expect(() => yillikFiyat(1.5)).toThrow();
  });
});
