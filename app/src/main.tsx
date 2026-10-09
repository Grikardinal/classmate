import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./index.css";
import { AppProvider, useApp, useOturum, type ModulKey } from "@/context/AppContext";
import { AppShell } from "@/layout/AppShell";
import { GirisSayfasi, PersonelKapisi } from "@/layout/Giris";

// Her bölüm ayrı parça olarak yüklenir (yavaş bağlantıda ilk açılış hızlı olsun)
const KurumYapisi = React.lazy(() => import("@/bolumler/01-kurum-yapisi"));
const Kullanicilar = React.lazy(() => import("@/bolumler/02-kullanicilar"));
const OnKayit = React.lazy(() => import("@/bolumler/03-on-kayit"));
const Ogrenciler = React.lazy(() => import("@/bolumler/04-ogrenciler"));
const Finans = React.lazy(() => import("@/bolumler/05-finans"));
const DersProgrami = React.lazy(() => import("@/bolumler/06-ders-programi"));
const Yoklama = React.lazy(() => import("@/bolumler/07-yoklama"));
const Odevler = React.lazy(() => import("@/bolumler/08-odevler"));
const Etut = React.lazy(() => import("@/bolumler/09-etut"));
const Iletisim = React.lazy(() => import("@/bolumler/10-iletisim"));
const VeliPortali = React.lazy(() => import("@/bolumler/11-veli-portali"));
const VeliPortaliUygulamasi = React.lazy(() => import("@/bolumler/11-veli-portali").then((m) => ({ default: m.VeliPortaliUygulamasi })));
const YonetimPaneli = React.lazy(() => import("@/bolumler/12-yonetim-paneli"));
const Personel = React.lazy(() => import("@/bolumler/13-personel"));
const Altyapi = React.lazy(() => import("@/bolumler/14-altyapi"));

function Yukleniyor() {
  return <div className="grid min-h-40 place-items-center text-sm text-muted-foreground">Yükleniyor…</div>;
}

/** Rol yetkisi olmayan veya modülü kapalı bölüme doğrudan gidilirse panele yönlendirir. */
function Korumali({ kod, modul, children }: { kod: string; modul?: ModulKey; children: React.ReactNode }) {
  const { moduller } = useApp();
  const { yetki } = useOturum();
  if ((modul && !moduller[modul]) || !yetki(kod)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <React.Suspense fallback={<Yukleniyor />}>
        <Routes>
          {/* Veli portalı: yönetim kabuğu dışında, telefona göre düzen */}
          <Route path="veli/*" element={<VeliPortaliUygulamasi />} />
          <Route path="giris" element={<GirisSayfasi />} />
          <Route element={<PersonelKapisi><AppShell /></PersonelKapisi>}>
            <Route index element={<YonetimPaneli />} />
            <Route path="kurum" element={<Korumali kod="01"><KurumYapisi /></Korumali>} />
            <Route path="kullanicilar" element={<Korumali kod="02"><Kullanicilar /></Korumali>} />
            <Route path="on-kayit" element={<Korumali kod="03" modul="onKayit"><OnKayit /></Korumali>} />
            <Route path="ogrenciler/*" element={<Korumali kod="04"><Ogrenciler /></Korumali>} />
            <Route path="finans" element={<Korumali kod="05" modul="finans"><Finans /></Korumali>} />
            <Route path="ders-programi" element={<Korumali kod="06"><DersProgrami /></Korumali>} />
            <Route path="yoklama" element={<Korumali kod="07"><Yoklama /></Korumali>} />
            <Route path="odevler" element={<Korumali kod="08" modul="odev"><Odevler /></Korumali>} />
            <Route path="etut" element={<Korumali kod="09" modul="etut"><Etut /></Korumali>} />
            <Route path="iletisim" element={<Korumali kod="10"><Iletisim /></Korumali>} />
            <Route path="veli-portali" element={<Korumali kod="11"><VeliPortali /></Korumali>} />
            <Route path="personel" element={<Korumali kod="13"><Personel /></Korumali>} />
            <Route path="altyapi" element={<Korumali kod="14"><Altyapi /></Korumali>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        </React.Suspense>
      </BrowserRouter>
    </AppProvider>
  </React.StrictMode>,
);

// PWA: ana ekrana ekleme ve web push için service worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => undefined));
}
