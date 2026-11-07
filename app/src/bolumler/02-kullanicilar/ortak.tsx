/**
 * Bölüm 02 ekranlarının ortak yardımcıları.
 */
import { useApp, useOturum } from "@/context/AppContext";
import { tanimlar, type Kullanici } from "@/data/store";
import { parolaSifirlamaEngeli, yonetimEngeli, type Hata } from "./kurallar";

export const zamanBicim = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

export function kapsamMetni(k: Kullanici) {
  return k.subeIds === "all" ? "Tüm şubeler" : k.subeIds.map((s) => tanimlar().subeler.find((x) => x.id === s)?.kod ?? s).join(", ");
}

/**
 * Oturumdaki kullanıcının hesap yönetimi kuralları (sunucudaki kurallarla aynı fonksiyonlar).
 * Kapsam sunucunun /api/ben yanıtındaki kapsamdır (pasif şubeler dahil), böylece ekran ile sunucu aynı kararı verir.
 */
export function useHesapYonetimi() {
  const { ben } = useApp();
  const oturum = useOturum();
  const genel = oturum.rol === "genel-yonetici";
  const aktorKapsam = genel ? tanimlar().subeler.map((s) => s.id) : (ben?.kapsam ?? oturum.kapsam);
  return {
    genel,
    aktor: oturum.kullanici,
    aktorKapsam,
    /** Şube seçiminde gösterilecek şubeler */
    secilebilirSubeler: tanimlar().subeler.filter((s) => genel || aktorKapsam.includes(s.id)),
    yonetimEngeli: (k: Kullanici): Hata => yonetimEngeli(oturum.kullanici, k, aktorKapsam),
    sifirlamaEngeli: (k: Kullanici): Hata => parolaSifirlamaEngeli(oturum.kullanici, k, aktorKapsam),
  };
}
