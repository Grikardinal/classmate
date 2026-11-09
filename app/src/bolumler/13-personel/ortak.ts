import { dakika } from "@/lib/kurallar";
import { BUGUN, saat, type Db, type Personel } from "@/data/store";
import { bolumYetkisi } from "../02-kullanicilar/kurallar";
import { acikProgram, type Goren } from "./kurallar";

const basDakika = (saatId: string) => dakika(saat(saatId)?.baslangic ?? "00:00");

/** Öğretmenin yürürlükteki haftalık dersleri (gün ve saate göre) */
export function haftalikDersler(d: Db, personelId: string) {
  return acikProgram(d.program, personelId, BUGUN).sort((a, b) => a.gun - b.gun || basDakika(a.saatId) - basDakika(b.saatId));
}

/** Sunucunun maskeleme kuralıyla aynı girdi */
export const gorenBilgisi = (d: Db, rol: Goren["rol"], personelId: string): Goren => ({ rol, personelId, yetki13: bolumYetkisi(d.rolYetkileri, rol, "13") });

/** Aktör kartı değiştirebilir mi: 13 yetkisi ve personelin bütün şubeleri kapsamda (sunucu da böyle denetler) */
export function kartDuzenlenebilir(p: Pick<Personel, "subeIds">, rol: Goren["rol"], yetki13: boolean, kapsam: string[]): boolean {
  if (rol === "genel-yonetici") return true;
  return yetki13 && p.subeIds.length > 0 && p.subeIds.every((s) => kapsam.includes(s));
}
