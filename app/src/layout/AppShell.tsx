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

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { moduller } = useApp();
  const { yetki } = useOturum();
  const gorunen = bolumler.filter((b) => (!b.modul || moduller[b.modul]) && yetki(b.kod));

  return (
    <nav className="no-scrollbar flex h-full flex-col gap-6 overflow-y-auto px-3 py-5">
      <div className="px-2">
        <Logo />
      </div>
      {gruplar.map((g) => {
        const liste = gorunen.filter((b) => b.grup === g);
        if (!liste.length) return null;
        return (
          <div key={g} className="grid gap-0.5">
            <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{g}</p>
            {liste.map((b) => (
              <NavLink
                key={b.yol}
                to={b.yol}
                end={b.yol === "/"}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                    isActive ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )
                }
              >
                <b.ikon className="size-4 shrink-0" />
                <span className="truncate">{b.ad}</span>
              </NavLink>
            ))}
          </div>
        );
      })}
    </nav>
  );
}

function SubeSecici() {
  const d = useDb();
  const { subeId, setSubeId } = useApp();
  const { kapsam } = useOturum();
  const tekSube = kapsam.length === 1;
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
      <button onClick={() => setAcik(!acik)} className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition hover:bg-muted" aria-label="Kullanıcı menüsü" aria-expanded={acik}>
        <span className="grid size-8 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">{bas}</span>
        <span className="hidden text-left leading-tight md:block">
          <span className="block text-sm font-medium">{ad}</span>
          <span className="block text-xs text-muted-foreground">{rolAdlari[rol]}</span>
        </span>
        <ChevronDown className="size-4 text-muted-foreground" />
      </button>
      {acik && (
        <div className="absolute right-0 top-11 z-50 w-64 rounded-lg border bg-card p-1.5 shadow-xl">
          <div className="border-b px-2.5 pb-2 pt-1.5">
            <p className="text-sm font-medium">{ad}</p>
            <p className="truncate text-xs text-muted-foreground">{kullanici.eposta}</p>
          </div>
          <button onClick={() => { setParola(true); setAcik(false); }} className="mt-1 flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-muted">
            <KeyRound className="size-4 text-muted-foreground" /> Parola değiştir
          </button>
          <button onClick={() => void cikisYap(setBen)} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-danger hover:bg-muted">
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
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 border-r bg-sidebar lg:block">
        <Sidebar />
      </aside>

      {mobilAcik && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobilAcik(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 border-r bg-sidebar shadow-xl">
            <Button variant="ghost" size="icon" className="absolute right-2 top-4" onClick={() => setMobilAcik(false)} aria-label="Menüyü kapat">
              <X />
            </Button>
            <Sidebar onNavigate={() => setMobilAcik(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobilAcik(true)} aria-label="Menüyü aç">
            <Menu />
          </Button>
          <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
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
              <Outlet />
            </HataSiniri>
          </React.Suspense>
        </main>
        <Toaster />
      </div>
    </div>
  );
}
