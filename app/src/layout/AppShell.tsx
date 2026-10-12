import * as React from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Menu, Moon, Sun, X, Building, ChevronDown, CalendarClock, KeyRound, LogOut } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button, Select, Toaster } from "@/components/ui";
import { useApp, useOturum } from "@/context/AppContext";
import { bolumler } from "@/bolumler/registry";
import { BUGUN, SIMDI, rolAdlari, useDb } from "@/data/store";
import { cn } from "@/lib/utils";
import { ParolaDegistir, cikisYap } from "./Giris";
import { HataSiniri } from "./HataSiniri";

const gruplar = ["Genel", "Eğitim", "İletişim", "Yönetim"] as const;
/** Menü gruplarının simge renkleri */
const grupRenk: Record<(typeof gruplar)[number], string> = {
  Genel: "bg-indigo-500/12 text-indigo-600 dark:text-indigo-300",
  Eğitim: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300",
  İletişim: "bg-amber-500/14 text-amber-600 dark:text-amber-300",
  Yönetim: "bg-rose-500/12 text-rose-600 dark:text-rose-300",
};

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { moduller } = useApp();
  const { yetki } = useOturum();
  const gorunen = bolumler.filter((b) => (!b.modul || moduller[b.modul]) && yetki(b.kod));

  return (
    <nav className="no-scrollbar flex h-full flex-col gap-5 overflow-y-auto px-3 py-5">
      <div className="px-2 pb-1">
        <Logo />
      </div>
      {gruplar.map((g) => {
        const liste = gorunen.filter((b) => b.grup === g);
        if (!liste.length) return null;
        return (
          <div key={g} className="grid gap-0.5">
            <p className="px-3 pb-1.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted-foreground/80">{g}</p>
            {liste.map((b) => (
              <NavLink
                key={b.yol}
                to={b.yol}
                end={b.yol === "/"}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    "group flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-semibold transition-all duration-200",
                    isActive ? "bg-marka text-white shadow-glow" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={cn(
                        "grid size-7 shrink-0 place-items-center rounded-lg transition-colors [&_svg]:size-4",
                        isActive ? "bg-white/20 text-white" : grupRenk[g],
                      )}
                    >
                      <b.ikon />
                    </span>
                    <span className="truncate">{b.ad}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        );
      })}
      <KurumKarti />
    </nav>
  );
}

function KurumKarti() {
  const d = useDb();
  const sezon = d.sezonlar.find((s) => s.aktif);
  const aktif = d.kayitlar.filter((k) => k.durum === "aktif" && k.sezonId === sezon?.id).length;
  return (
    <div className="relative mt-auto overflow-hidden rounded-2xl bg-marka p-4 text-white shadow-glow">
      <span className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full bg-white/15 blur-md" />
      <span className="pointer-events-none absolute -bottom-10 -left-4 size-24 rounded-full bg-white/10 blur-md" />
      <p className="relative truncate text-[13px] font-bold">{d.kurum.ad}</p>
      <p className="relative mt-0.5 text-xs text-white/75">{sezon?.ad ?? "—"} sezonu</p>
      <p className="relative mt-3 font-display text-2xl font-extrabold">{aktif}</p>
      <p className="relative text-xs text-white/75">aktif öğrenci</p>
    </div>
  );
}

function SubeSecici() {
  const d = useDb();
  const { subeId, setSubeId } = useApp();
  const { kapsam } = useOturum();
  const tekSube = kapsam.length === 1;
  if (tekSube)
    return (
      <span className="inline-flex h-10 items-center gap-2 rounded-xl border border-border/70 bg-card/70 px-3 text-sm font-semibold shadow-xs">
        <Building className="size-4 text-primary" />
        {d.subeler.find((s) => s.id === kapsam[0])?.ad}
      </span>
    );
  return (
    <div className="relative">
      <Building className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Select
        aria-label="Şube seçimi"
        value={tekSube ? kapsam[0] : subeId}
        disabled={tekSube}
        onChange={(e) => setSubeId(e.target.value)}
        className="w-40 pl-8 text-[13px] sm:w-52 sm:text-sm"
      >
        {!tekSube && <option value="all">Tüm şubeler</option>}
        {d.subeler
          .filter((s) => kapsam.includes(s.id))
          .map((s) => (
            <option key={s.id} value={s.id}>
              {s.ad}
            </option>
          ))}
      </Select>
    </div>
  );
}

function KullaniciMenusu() {
  const { setBen } = useApp();
  const { ad, rol, kullanici } = useOturum();
  const [acik, setAcik] = React.useState(false);
  const [parola, setParola] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const kapat = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setAcik(false);
    document.addEventListener("mousedown", kapat);
    return () => document.removeEventListener("mousedown", kapat);
  }, []);
  const bas = ad
    .split(" ")
    .map((x) => x[0])
    .join("")
    .slice(0, 2);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setAcik(!acik)} className="flex items-center gap-2 rounded-full border border-transparent py-1 pl-1 pr-2 transition hover:border-border hover:bg-card" aria-label="Kullanıcı menüsü" aria-expanded={acik}>
        <span className="grid size-9 place-items-center rounded-full bg-marka text-xs font-bold text-white shadow-glow ring-2 ring-card">{bas}</span>
        <span className="hidden text-left leading-tight md:block">
          <span className="block text-sm font-bold">{ad}</span>
          <span className="block text-xs text-muted-foreground">{rolAdlari[rol]}</span>
        </span>
        <ChevronDown className="size-4 text-muted-foreground" />
      </button>
      {acik && (
        <div className="absolute right-0 top-12 z-50 w-64 animate-buyu rounded-2xl border bg-card p-1.5 shadow-lift">
          <div className="border-b px-2.5 pb-2 pt-1.5">
            <p className="text-sm font-medium">{ad}</p>
            <p className="truncate text-xs text-muted-foreground">{kullanici.eposta}</p>
          </div>
          <button onClick={() => { setParola(true); setAcik(false); }} className="mt-1 flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm font-medium hover:bg-muted">
            <KeyRound className="size-4 text-muted-foreground" /> Parola değiştir
          </button>
          <button onClick={() => void cikisYap(setBen)} className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm font-medium text-danger hover:bg-muted">
            <LogOut className="size-4" /> Çıkış yap
          </button>
        </div>
      )}
      {parola && <ParolaDegistir onClose={() => setParola(false)} />}
    </div>
  );
}

export function AppShell() {
  const { dark, setDark } = useApp();
  const [mobilAcik, setMobilAcik] = React.useState(false);
  const { pathname } = useLocation();
  React.useEffect(() => setMobilAcik(false), [pathname]);
  const tarih = new Date(BUGUN + "T00:00:00").toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="flex min-h-dvh">
      <div className="aurora" aria-hidden />
      <aside className="sticky top-0 z-20 hidden h-dvh w-64 shrink-0 border-r border-border/70 bg-sidebar/80 backdrop-blur-xl lg:block">
        <Sidebar />
      </aside>

      {mobilAcik && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 animate-belir bg-[#14142b]/40 backdrop-blur-sm" onClick={() => setMobilAcik(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 animate-giris rounded-r-3xl border-r bg-sidebar shadow-lift">
            <Button variant="ghost" size="icon" className="absolute right-2 top-4" onClick={() => setMobilAcik(false)} aria-label="Menüyü kapat">
              <X />
            </Button>
            <Sidebar onNavigate={() => setMobilAcik(false)} />
          </aside>
        </div>
      )}

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border/60 bg-background/70 px-4 backdrop-blur-xl sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobilAcik(true)} aria-label="Menüyü aç">
            <Menu />
          </Button>
          <span className="hidden items-center gap-1.5 rounded-full border border-border/70 bg-card/70 px-3 py-1.5 text-xs font-semibold text-muted-foreground shadow-xs sm:flex">
            <CalendarClock className="size-4" />
            {tarih} · {SIMDI}
          </span>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <SubeSecici />
            <Button variant="ghost" size="icon" onClick={() => setDark(!dark)} aria-label="Tema değiştir">
              {dark ? <Sun /> : <Moon />}
            </Button>
            <KullaniciMenusu />
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
          <React.Suspense fallback={<div className="grid min-h-40 place-items-center text-sm text-muted-foreground">Yükleniyor…</div>}>
            <HataSiniri anahtar={pathname}>
              <div key={pathname} className="animate-giris">
              <Outlet />
            </div>
            </HataSiniri>
          </React.Suspense>
        </main>
        <Toaster />
      </div>
    </div>
  );
}
