/** Portal kabuğu: üst bar, çocuk seçici, alt menü, yan menü */
import * as React from "react";
import { Link, NavLink } from "react-router-dom";
import { Bell, BookOpenCheck, CalendarDays, ClipboardCheck, Clock, Home, Megaphone, Menu, UserRound, Users, Wallet, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Avatar, Toaster } from "@/components/ui";
import { useApp } from "@/context/AppContext";
import { aktifKayit, grupEtiket, tamAd, useDb } from "@/data/store";
import { cn } from "@/lib/utils";
import { okunmamisDuyuruSayisi } from "./kurallar";
import { usePortal } from "./ortak";

export function PortalKabuk({ children }: { children: React.ReactNode }) {
  const d = useDb();
  const { moduller } = useApp();
  const { veli, cocuklar, cocuk, setCocukId, ogrenciModu } = usePortal();
  const [menu, setMenu] = React.useState(false);
  const okunmamis = okunmamisDuyuruSayisi(d.duyurular, veli.id);
  React.useEffect(() => {
    if (!menu) return;
    const kapat = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    window.addEventListener("keydown", kapat);
    return () => window.removeEventListener("keydown", kapat);
  }, [menu]);
  const alt = [
    { to: "/veli", ad: "Ana Sayfa", ikon: Home, end: true },
    { to: "/veli/program", ad: "Program", ikon: CalendarDays },
    moduller.finans && !ogrenciModu ? { to: "/veli/odemeler", ad: "Ödemeler", ikon: Wallet } : { to: "/veli/yoklama", ad: "Yoklama", ikon: ClipboardCheck },
    ...(moduller.odev ? [{ to: "/veli/odevler", ad: "Ödevler", ikon: BookOpenCheck }] : []),
    { to: "/veli/duyurular", ad: "Duyurular", ikon: Megaphone, rozet: okunmamis },
  ];
  const diger = [
    { to: "/veli/yoklama", ad: "Yoklama ve konular", ikon: ClipboardCheck },
    ...(moduller.etut ? [{ to: "/veli/etut", ad: "Etüt randevuları", ikon: Clock }] : []),
    ...(moduller.finans && !ogrenciModu ? [{ to: "/veli/odemeler", ad: "Ödemeler", ikon: Wallet }] : []),
    { to: "/veli/ogretmenler", ad: "Öğretmenler", ikon: Users },
    { to: "/veli/bildirimler", ad: "Bildirimler", ikon: Bell },
    { to: "/veli/profil", ad: "Profil ve izinler", ikon: UserRound },
  ];
  return (
    <div className="relative mx-auto flex min-h-dvh max-w-md flex-col">
      <div className="aurora" aria-hidden />
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 px-4 pb-3 pt-3 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <Link to="/veli"><Logo /></Link>
          <div className="flex items-center gap-1">
            <Link to="/veli/bildirimler" className="grid size-10 place-items-center rounded-xl border border-border/70 bg-card/70 shadow-xs transition hover:border-primary/40" aria-label="Bildirimler"><Bell className="size-5" /></Link>
            <button onClick={() => setMenu(true)} className="grid size-10 place-items-center rounded-xl border border-border/70 bg-card/70 shadow-xs transition hover:border-primary/40" aria-label="Menü"><Menu className="size-5" /></button>
          </div>
        </div>
        {cocuklar.length > 1 && (
          <div className="no-scrollbar -mx-1 mt-2 flex gap-2 overflow-x-auto px-1 py-1.5">
            {cocuklar.map((o) => (
              <button type="button" key={o.id} aria-pressed={o.id === cocuk.id} onClick={() => setCocukId(o.id)} className={cn("flex shrink-0 items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm font-semibold transition-all", o.id === cocuk.id ? "border-transparent bg-marka text-white shadow-glow" : "border-border/70 bg-card/70 text-muted-foreground")}>
                <Avatar ad={tamAd(o)} className="size-7 text-[10px]" />
                {o.ad} <span className="text-xs opacity-70">{grupEtiket(d, aktifKayit(d, o.id)!.grupId)}</span>
              </button>
            ))}
          </div>
        )}
      </header>
      <main className="relative z-10 flex-1 px-4 pb-28 pt-5">{children}</main>
      <nav aria-label="Ana menü" className="fixed inset-x-3 z-30 mx-auto grid max-w-[26rem] gap-1 rounded-2xl border border-border/70 bg-card/90 p-1.5 shadow-lift backdrop-blur-xl" style={{ gridTemplateColumns: `repeat(${alt.length}, 1fr)`, bottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
        {alt.map((a) => (
          <NavLink key={a.to} to={a.to} end={"end" in a && a.end} className={({ isActive }) => cn("relative flex flex-col items-center gap-0.5 rounded-xl py-2 text-[11px] font-semibold transition-all", isActive ? "bg-accent text-primary" : "text-muted-foreground hover:text-foreground")}>
            <a.ikon className="size-5" />
            {a.ad}
            {"rozet" in a && !!a.rozet && <span className="absolute right-[22%] top-1.5 grid size-4 place-items-center rounded-full bg-danger text-[9px] font-semibold text-white">{a.rozet > 9 ? "9+" : a.rozet}</span>}
          </NavLink>
        ))}
      </nav>
      {menu && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 animate-belir bg-[#14142b]/40 backdrop-blur-sm" onClick={() => setMenu(false)} />
          <div role="dialog" aria-modal="true" aria-label="Menü" className="absolute inset-y-0 right-0 w-72 animate-kay rounded-l-3xl border-l bg-card p-4 shadow-lift">
            <div className="mb-4 flex items-center justify-between">
              <div><p className="font-medium">{tamAd(veli)}</p><p className="text-xs text-muted-foreground">{veli.telefon}</p></div>
              <button onClick={() => setMenu(false)} className="grid size-9 place-items-center rounded-full hover:bg-muted" aria-label="Kapat"><X className="size-5" /></button>
            </div>
            <div className="grid gap-1">
              {diger.map((a) => (
                <Link key={a.to} to={a.to} onClick={() => setMenu(false)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-muted">
                  <span className="grid size-9 place-items-center rounded-xl bg-accent text-primary"><a.ikon className="size-[18px]" /></span> {a.ad}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
      <Toaster />
    </div>
  );
}
