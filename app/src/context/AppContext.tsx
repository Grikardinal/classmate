import * as React from "react";
import { guncelle, useDb, type Db, type Kullanici, type ModulKey, type Personel, type Rol } from "@/data/store";

export type { ModulKey };

export const modulTanimlari: { key: ModulKey; ad: string; aciklama: string; surum: string }[] = [
  { key: "finans", ad: "Finans", aciklama: "Ücret, taksit, tahsilat ve kasa. Kurum ücret almıyorsa kapalı kalır.", surum: "MVP sonrası" },
  { key: "hakedis", ad: "Personel hak ediş", aciklama: "İşlenen derslerden otomatik hak ediş hesabı.", surum: "v2" },
  { key: "onKayit", ad: "Ön kayıt", aciklama: "Aday veli ve öğrenci takibi, kesin kayda çevirme.", surum: "MVP" },
  { key: "odev", ad: "Ödev takibi", aciklama: "Öğretmenin verdiği ödevler ve teslim durumu.", surum: "v2" },
  { key: "etut", ad: "Etüt ve birebir ders", aciklama: "Müsaitlik, randevu ve özel ders paketleri.", surum: "v2" },
  { key: "mesajlasma", ad: "Mesajlaşma ve anket", aciklama: "Veli–öğretmen mesajları ve memnuniyet anketi.", surum: "v2" },
];

/** Sunucunun /api/ben yanıtı */
export type BenBilgisi = { tur: "personel"; kullanici: Kullanici; personel: Personel; kapsam: string[]; parolaDegistirmeli: boolean };

type AppState = {
  /** "all" = kullanıcının kapsamındaki tüm şubeler (konsolide görünüm) */
  subeId: string;
  setSubeId: (id: string) => void;
  moduller: Record<ModulKey, boolean>;
  setModul: (key: ModulKey, acik: boolean) => void;
  dark: boolean;
  setDark: (v: boolean) => void;
  ben: BenBilgisi | null;
  setBen: (b: BenBilgisi | null) => void;
};

const AppContext = React.createContext<AppState | null>(null);

function oku<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function yaz(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* depolama kapalı olabilir */
  }
}

/** Veri yüklüyse modülleri veriden, değilse varsayılandan okur */
function ModulOkuyucu({ children, onDegis }: { children: React.ReactNode; onDegis: (m: Record<ModulKey, boolean> | null) => void }) {
  const d = useDb() as Db | null;
  React.useEffect(() => {
    onDegis(d?.moduller ?? null);
  }, [d?.moduller, onDegis]);
  return <>{children}</>;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [subeId, setSubeId] = React.useState(() => oku("cm.sube", "all"));
  const [moduller, setModuller] = React.useState<Record<ModulKey, boolean>>({
    finans: false, hakedis: false, onKayit: true, odev: true, etut: true, mesajlasma: false,
  });
  const [dark, setDark] = React.useState(() =>
    oku("cm.dark", window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false),
  );
  const [ben, setBen] = React.useState<BenBilgisi | null>(null);

  React.useEffect(() => yaz("cm.sube", subeId), [subeId]);
  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    yaz("cm.dark", dark);
  }, [dark]);
  // Kapsam dışı bir şube seçili kalmasın
  React.useEffect(() => {
    if (ben && subeId !== "all" && !ben.kapsam.includes(subeId)) setSubeId("all");
  }, [ben, subeId]);

  const modulDegis = React.useCallback((m: Record<ModulKey, boolean> | null) => {
    if (m) setModuller(m);
  }, []);

  const value: AppState = {
    subeId,
    setSubeId,
    moduller,
    // Modül anahtarları kurum geneli ayardır: sunucuda saklanır, tüm kullanıcılara yansır
    setModul: (key, acik) => guncelle((d) => (d.moduller = { ...d.moduller, [key]: acik })),
    dark,
    setDark,
    ben,
    setBen,
  };
  return (
    <AppContext.Provider value={value}>
      <ModulOkuyucu onDegis={modulDegis}>{children}</ModulOkuyucu>
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = React.useContext(AppContext);
  if (!ctx) throw new Error("useApp, AppProvider içinde kullanılmalı");
  return ctx;
}

/** Öğretmen yalnızca kendi gruplarını görür (programda dersi olan veya rehberi olduğu gruplar). */
export function ogretmenGruplari(d: Db, personelId: string): Set<string> {
  return new Set([
    ...d.program.filter((p) => p.ogretmenId === personelId).map((p) => p.grupId),
    ...d.gruplar.filter((g) => g.rehberId === personelId).map((g) => g.id),
  ]);
}

/** Oturum açan kullanıcı, rolü ve kapsamı (sunucu ayrıca her istekte uygular) */
export function useOturum() {
  const d = useDb();
  const { ben, subeId } = useApp();
  if (!ben) throw new Error("useOturum: oturum yok");
  const { kullanici, personel } = ben;
  const rol: Rol = kullanici.rol;
  const aktifler = new Set(d.subeler.filter((s) => s.aktif).map((s) => s.id));
  // Tüm şubeleri kapsayan kullanıcı sonradan açılan şubeyi de hemen görür
  const kapsam = (kullanici.subeIds === "all" ? d.subeler.map((s) => s.id) : ben.kapsam).filter((s) => aktifler.has(s));
  const seciliSubeler = subeId === "all" ? kapsam : kapsam.filter((s) => s === subeId);
  const ogretmenMi = rol === "ogretmen";
  const grupIds = ogretmenMi ? ogretmenGruplari(d, personel.id) : null;
  return {
    kullanici,
    personel,
    ad: `${personel.ad} ${personel.soyad}`,
    rol,
    ogretmenMi,
    kapsam,
    seciliSubeler,
    subeGorunur: (id: string | null | undefined) => !!id && seciliSubeler.includes(id),
    grupGorunur: (grupId: string) => {
      const g = d.gruplar.find((x) => x.id === grupId);
      if (!g || !seciliSubeler.includes(g.subeId)) return false;
      return grupIds ? grupIds.has(grupId) : true;
    },
    yetki: (bolumKod: string) => d.rolYetkileri[rol]?.[bolumKod] ?? false,
  };
}

/** Seçili şubeye göre filtre: "Tüm şubeler" seçiliyse kapsamdaki her şey görünür. */
export function useSubeFiltre() {
  const { subeGorunur } = useOturum();
  return subeGorunur;
}

export function subeKodu(d: Db, id: string) {
  return d.subeler.find((s) => s.id === id)?.kod ?? "—";
}
