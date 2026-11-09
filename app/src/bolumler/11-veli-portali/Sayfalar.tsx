/** Portalın liste ekranları: program, yoklama, ödevler, duyurular, ödemeler, öğretmenler, bildirimler */
import * as React from "react";
import { Navigate } from "react-router-dom";
import { CalendarDays, Bell, Phone, Wallet } from "lucide-react";
import { Alert, Avatar, Badge, Button, Card, CardContent, StatCard } from "@/components/ui";
import { useApp } from "@/context/AppContext";
import { BUGUN, aktifKayit, ders, dersAdi, derslikAdi, grup, grupEtiket, oturumlar, ogrenciYoklamalari, personelAdi, taksitAdi, taksitKalan, tamAd, useDb } from "@/data/store";
import { tarihEkle, tl } from "@/lib/kurallar";
import { cn } from "@/lib/utils";
import { devamMetni, grupOgretmenleri, ogrenciOdevleri, taksitOzeti, veliDuyurulari } from "./kurallar";
import { tarihKisa, usePortal, yoklamaAd, yoklamaRenk } from "./ortak";

export function PortalProgram() {
  const d = useDb();
  const { cocuk } = usePortal();
  const k = aktifKayit(d, cocuk.id)!;
  const gunler = Array.from({ length: 14 }, (_, i) => tarihEkle(BUGUN, i));
  return (
    <div className="grid gap-4">
      <h1 className="text-xl font-semibold">Ders programı</h1>
      <p className="-mt-2 text-sm text-muted-foreground">{grupEtiket(d, k.grupId)} · önümüzdeki 2 hafta</p>
      {!gunler.some((t) => oturumlar(d, t).some((o) => o.satir.grupId === k.grupId)) && <p className="text-sm text-muted-foreground">Önümüzdeki 2 haftada ders görünmüyor.</p>}
      {gunler.map((t) => {
        const l = oturumlar(d, t).filter((o) => o.satir.grupId === k.grupId);
        if (!l.length) return null;
        return (
          <div key={t}>
            <p className={cn("mb-1.5 text-xs font-medium", t === BUGUN ? "text-primary" : "text-muted-foreground")}>{t === BUGUN ? "Bugün · " : ""}{tarihKisa(t)}</p>
            <Card className="divide-y">
              {l.map((o) => (
                <div key={o.id} className={cn("flex items-center gap-3 p-3 text-sm", (o.iptal || o.tatil) && "opacity-60")}>
                  <span className="w-12 text-xs tabular-nums text-muted-foreground">{o.bas}</span>
                  <span className="h-8 w-1 rounded-full" style={{ background: ders(o.satir.dersId)?.renk }} />
                  <div className="flex-1"><p className={cn("font-medium", (o.iptal || o.tatil) && "line-through")}>{dersAdi(o.satir.dersId)}</p><p className="text-xs text-muted-foreground">{personelAdi(d, o.satir.ogretmenId)} · {derslikAdi(o.satir.derslikId)}</p></div>
                  {o.tatil ? <Badge variant="secondary">{o.tatil.ad}</Badge> : o.iptal ? <Badge variant="danger">İptal</Badge> : null}
                </div>
              ))}
            </Card>
          </div>
        );
      })}
    </div>
  );
}

export function PortalYoklama() {
  const d = useDb();
  const { cocuk } = usePortal();
  const l = ogrenciYoklamalari(d, cocuk.id);
  const gelmedi = l.filter((x) => x.durum === "gelmedi").length;
  const izinler = d.izinler.filter((i) => i.ogrenciId === cocuk.id && i.tarih >= BUGUN);
  return (
    <div className="grid gap-4">
      <h1 className="text-xl font-semibold">Yoklama ve işlenen konular</h1>
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Ders" value={l.length} />
        <StatCard label="Gelmedi" value={gelmedi} tone={gelmedi ? "danger" : "default"} />
        <StatCard label="Devam" value={devamMetni(l.map((x) => x.durum))} tone="success" />
      </div>
      {izinler.map((i) => <Alert key={i.id} icon={<CalendarDays />}>{tarihKisa(i.tarih)} için izin bildirildi: {i.not}</Alert>)}
      {l.length === 0 && <p className="text-sm text-muted-foreground">Henüz yoklama kaydı yok.</p>}
      <Card className="divide-y">
        {l.slice(0, 40).map(({ y, durum }) => (
          <div key={y.oturumId} className="flex items-center gap-3 p-3 text-sm">
            <div className="flex-1">
              <p className="font-medium">{dersAdi(d.program.find((p) => p.id === y.satirId)?.dersId ?? "")} <span className="text-xs font-normal text-muted-foreground">· {tarihKisa(y.tarih)}</span></p>
              <p className="text-xs text-muted-foreground">{y.konu || "—"}</p>
            </div>
            <Badge variant={yoklamaRenk[durum]}>{yoklamaAd[durum]}</Badge>
          </div>
        ))}
      </Card>
    </div>
  );
}

export function PortalOdevler() {
  const d = useDb();
  const { moduller } = useApp();
  const { cocuk } = usePortal();
  if (!moduller.odev) return <Navigate to="/veli" replace />;
  const k = aktifKayit(d, cocuk.id)!;
  const l = ogrenciOdevleri(d.odevler, k.grupId, cocuk.id);
  const rozet = { yapti: ["Yaptı", "success"], eksik: ["Eksik", "warning"], yapmadi: ["Yapmadı", "danger"] } as const;
  return (
    <div className="grid gap-3">
      <h1 className="text-xl font-semibold">Ödevler</h1>
      {l.map((o) => {
        const t = o.teslimler[cocuk.id];
        return (
          <Card key={o.id}><CardContent className="grid gap-1 p-4 text-sm">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium">{o.baslik}</p>
              {t ? <Badge variant={rozet[t][1]}>{rozet[t][0]}</Badge> : o.teslim >= BUGUN ? <Badge>Teslim {tarihKisa(o.teslim)}</Badge> : <Badge variant="secondary">Kontrol bekliyor</Badge>}
            </div>
            <p className="text-xs" style={{ color: ders(o.dersId)?.renk }}>{dersAdi(o.dersId)} · {personelAdi(d, o.ogretmenId)}</p>
            <p className="text-muted-foreground">{o.aciklama}</p>
            {o.kaynak && <p className="text-xs">📎 {o.kaynak}</p>}
            {o.notlar[cocuk.id] && <p className="mt-1 rounded-md bg-muted p-2 text-xs">Öğretmen notu: {o.notlar[cocuk.id]}</p>}
          </CardContent></Card>
        );
      })}
      {l.length === 0 && <p className="text-sm text-muted-foreground">Ödev yok.</p>}
    </div>
  );
}

export function PortalDuyurular() {
  const d = useDb();
  const { veli, islem } = usePortal();
  const l = veliDuyurulari(d.duyurular, veli.id);
  // Ekran açıldığında okundu bilgisi yazılır
  React.useEffect(() => {
    const okunmamis = l.filter((du) => !du.okuyanVeliIds.includes(veli.id)).map((du) => du.id);
    if (okunmamis.length) void islem("/api/veli/okundu", { duyuruIds: okunmamis });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="grid gap-3">
      <h1 className="text-xl font-semibold">Duyurular</h1>
      {l.map((du) => (
        <Card key={du.id}><CardContent className="grid gap-1 p-4 text-sm">
          <div className="flex items-center justify-between gap-2"><p className="font-medium">{du.baslik}</p>{!du.okuyanVeliIds.includes(veli.id) && <span className="size-2 rounded-full bg-primary" />}</div>
          <p className="text-muted-foreground">{du.metin}</p>
          <p className="text-xs text-muted-foreground">{new Date(du.zaman).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" })}</p>
        </CardContent></Card>
      ))}
      {l.length === 0 && <p className="text-sm text-muted-foreground">Duyuru yok.</p>}
    </div>
  );
}

export function PortalOdemeler() {
  const d = useDb();
  const { moduller } = useApp();
  const { cocuklar, ogrenciModu } = usePortal();
  if (!moduller.finans || ogrenciModu) return <Navigate to="/veli" replace />;
  // Kardeşlerin borçları veli bazında birlikte görünür
  const taksitler = d.taksitler.filter((t) => cocuklar.some((o) => o.id === t.ogrenciId)).sort((a, b) => a.vade.localeCompare(b.vade));
  const { kalan, geciken } = taksitOzeti(taksitler, BUGUN);
  return (
    <div className="grid gap-4">
      <h1 className="text-xl font-semibold">Ödemeler</h1>
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Toplam kalan" value={tl(kalan)} />
        <StatCard label="Vadesi geçen" value={tl(geciken)} tone={geciken ? "danger" : "default"} />
      </div>
      <Button disabled title="v2: sanal POS (iyzico / PayTR)"><Wallet /> Online öde (yakında)</Button>
      {taksitler.length === 0 && <p className="text-sm text-muted-foreground">Ödeme planı bulunmuyor.</p>}
      <Card className="divide-y">
        {taksitler.map((t) => {
          const k = taksitKalan(t);
          return (
            <div key={t.id} className="flex items-center gap-3 p-3 text-sm">
              <div className="flex-1"><p className="font-medium">{cocuklar.length > 1 && `${cocuklar.find((o) => o.id === t.ogrenciId)?.ad} · `}{taksitAdi(t.no)}</p><p className="text-xs text-muted-foreground">Vade {tarihKisa(t.vade)}</p></div>
              <div className="text-right"><p className="tabular-nums">{tl(t.tutar)}</p>{k <= 0 ? <Badge variant="success">Ödendi</Badge> : t.vade < BUGUN ? <Badge variant="danger">Gecikti</Badge> : <Badge variant="secondary">Bekliyor</Badge>}</div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

export function PortalOgretmenler() {
  const d = useDb();
  const { cocuk } = usePortal();
  const k = aktifKayit(d, cocuk.id)!;
  const g = grup(d, k.grupId)!;
  const ogretmenler = grupOgretmenleri(d.program, k.grupId);
  return (
    <div className="grid gap-3">
      <h1 className="text-xl font-semibold">Öğretmenler</h1>
      {ogretmenler.length === 0 && <p className="text-sm text-muted-foreground">Öğretmen bilgisi yok.</p>}
      {ogretmenler.map(({ ogretmenId: id, dersIds }) => {
        const p = d.personel.find((x) => x.id === id);
        if (!p) return null;
        const dersAdlari = dersIds.map((x) => dersAdi(x));
        return (
          <Card key={id}><CardContent className="flex items-center gap-3 p-3">
            <Avatar ad={tamAd(p)} />
            <div className="flex-1 text-sm"><p className="font-medium">{tamAd(p)} {g.rehberId === id && <Badge variant="outline" className="ml-1">Rehber</Badge>}</p><p className="text-xs text-muted-foreground">{dersAdlari.join(", ")}</p></div>
          </CardContent></Card>
        );
      })}
      <p className="text-xs text-muted-foreground">Öğretmenlerin kişisel numaraları paylaşılmaz. Mesajlaşma v2'de eklenecek; şimdilik şubeyi arayabilirsiniz.</p>
    </div>
  );
}

export function PortalBildirimler() {
  const d = useDb();
  const { veli } = usePortal();
  const l = d.gonderimler.filter((g) => g.veliId === veli.id).sort((a, b) => b.zaman.localeCompare(a.zaman)).slice(0, 50);
  return (
    <div className="grid gap-3">
      <h1 className="text-xl font-semibold">Bildirimler</h1>
      {l.length === 0 && <p className="text-sm text-muted-foreground">Bildirim yok.</p>}
      <Card className="divide-y">
        {l.map((g) => (
          <div key={g.id} className="flex gap-3 p-3 text-sm">
            <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-full", g.kanal === "sms" ? "bg-warning/10 text-warning" : "bg-accent text-accent-foreground")}>{g.kanal === "sms" ? <Phone className="size-4" /> : <Bell className="size-4" />}</span>
            <div><p>{g.metin}</p><p className="text-xs text-muted-foreground">{new Date(g.zaman).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" })} · {g.kanal === "sms" ? "SMS" : "Uygulama"}</p></div>
          </div>
        ))}
      </Card>
    </div>
  );
}
