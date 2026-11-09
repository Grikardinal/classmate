import type { Db } from "@/data/store";
import type { VarsayilanKanal } from "@/lib/kurallar";

export const kanalAd: Record<VarsayilanKanal, string> = { push: "Uygulama", sms: "SMS", "push+sms": "Uygulama + SMS (yedek)" };
export const olayAdi = (d: Db, k: string) => (k === "otp" ? "Giriş kodu" : d.olaylar.find((o) => o.key === k)?.ad ?? k);
export const zamanTR = (iso: string) => new Date(iso).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export const ornekDegiskenler: Record<string, string> = {
  ogrenci: "Ayşe", saat: "16:00", ders: "Matematik", sube_adi: "Merkez", sube_telefonu: "0212 555 10 10", grup: "MRK 5-A",
  tarih: "12 Eki", neden: "iptal edilmiştir (öğretmen rahatsız)", baslik: "Kesirler alıştırması", teslim: "14 Eki", metin: "…",
  tutar: "1.500,00 ₺", vade: "05.11.2026", makbuz: "MRK-M-00042", ogretmen: "Can Öztürk",
};
