/** Bölüm 12 · Selamlama, günün özeti ve hızlı işlemler */
import { useNavigate } from "react-router-dom";
import { ClipboardCheck, Megaphone, UserPlus } from "lucide-react";
import { useApp, useOturum } from "@/context/AppContext";
import { BUGUN, SIMDI, oturumlar, useDb } from "@/data/store";
import { selamla } from "./kurallar";

export function KarsilamaBandi() {
  const d = useDb();
  const { moduller } = useApp();
  const { personel, grupGorunur, subeGorunur, yetki } = useOturum();
  const navigate = useNavigate();
  const bugun = oturumlar(d, BUGUN).filter((o) => grupGorunur(o.satir.grupId) && !o.iptal && !o.tatil);
  const bekleyen = bugun.filter((o) => !d.yoklamalar[o.id] && o.bas <= SIMDI).length;
  const aranacak = moduller.onKayit && yetki("03") ? d.adaylar.filter((a) => subeGorunur(a.subeId) && a.durum !== "kayit" && a.durum !== "vazgecti" && a.sonrakiAksiyon && a.sonrakiAksiyon <= BUGUN).length : 0;
  const tarih = new Date(BUGUN + "T00:00:00").toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" });
  const ozet = [
    `bugün ${bugun.length} ders var`,
    bekleyen ? `${bekleyen} dersin yoklaması bekliyor` : "yoklamalar güncel",
    ...(aranacak ? [`${aranacak} aday aranacak`] : []),
  ].join(", ");
  const islemler = [
    { ad: "Yeni kayıt", ikon: <UserPlus />, yol: "/ogrenciler/yeni", kod: "04" },
    { ad: "Yoklama", ikon: <ClipboardCheck />, yol: "/yoklama", kod: "07" },
    { ad: "Duyuru", ikon: <Megaphone />, yol: "/iletisim", kod: "10" },
  ].filter((x) => yetki(x.kod));
  return (
    <section className="relative overflow-hidden rounded-3xl bg-marka p-6 text-white shadow-glow sm:p-8">
      <span className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-white/15 blur-2xl" />
      <span className="pointer-events-none absolute -bottom-24 left-1/3 size-56 rounded-full bg-fuchsia-300/25 blur-3xl" />
      <svg className="pointer-events-none absolute right-6 top-6 hidden size-28 text-white/15 sm:block" viewBox="0 0 100 100" fill="none" aria-hidden>
        <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="2" strokeDasharray="4 8" />
        <circle cx="50" cy="50" r="24" stroke="currentColor" strokeWidth="2" />
        <circle cx="86" cy="32" r="6" fill="currentColor" />
      </svg>
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold capitalize text-white/80">{tarih}</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">
            {selamla(SIMDI)}, {personel.ad} 👋
          </h1>
          <p className="mt-2 max-w-xl text-[15px] text-white/85">Kurumun özeti: {ozet}.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {islemler.map((x) => (
            <button
              key={x.yol}
              onClick={() => navigate(x.yol)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/15 px-3.5 py-2 text-sm font-semibold text-white backdrop-blur transition hover:-translate-y-px hover:bg-white/25 [&_svg]:size-4"
            >
              {x.ikon}
              {x.ad}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
