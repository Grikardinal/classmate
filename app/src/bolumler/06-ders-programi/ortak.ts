import { bildirimEkle, grupOgrencileri, type Db } from "@/data/store";

export type Gorunum = "grup" | "ogretmen" | "derslik";

export const tarihKisa = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short" });

/** Program değişikliği grubun velilerine (birincil veli) bildirilir; yeni saat ve geçerlilik tarihi mesajda yer alır */
export function bildirimGrubaDersDegisikligi(x: Db, grupId: string, zaman: string, dersAd: string, neden: string, gecerlilik: string, tarihEtiketi = "yeni saat") {
  const metin = `${neden.toLocaleLowerCase("tr-TR")}, ${tarihKisa(gecerlilik)} tarihinden itibaren geçerli`;
  for (const o of grupOgrencileri(x, grupId)) bildirimEkle(x, "dersIptal", o.id, { tarih: tarihEtiketi, saat: zaman, ders: dersAd, neden: metin }, undefined, true);
}
