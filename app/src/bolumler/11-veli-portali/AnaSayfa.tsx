/** Veli ana sayfası ve "gelemeyecek" bildirimi */
import * as React from "react";
import { BellRing, CalendarDays, ChevronRight, MapPin, Phone } from "lucide-react";
import { Alert, Avatar, Badge, Button, Card, CardContent, Dialog, Field, Input, Textarea } from "@/components/ui";
import { useApp } from "@/context/AppContext";
import { BUGUN, aktifKayit, ders, dersAdi, grupEtiket, oturumlar, ogrenciYoklamalari, personelAdi, sube, taksitKalan, tamAd, useDb } from "@/data/store";
import { gunFarki, iyelik, tarihEkle, tl } from "@/lib/kurallar";
import { acikTaksitler, bekleyenOdevler, veliDuyurulari } from "./kurallar";
import { Bolum, tarihKisa, useBildirimAc, usePortal, yoklamaAd, yoklamaRenk } from "./ortak";

export function PortalAnaSayfa() {
  const d = useDb();
  const { moduller } = useApp();
  const { veli, cocuk, ogrenciModu } = usePortal();
  const bildirimAc = useBildirimAc();
  const k = aktifKayit(d, cocuk.id)!;
  const s = sube(k.subeId)!;
  const bugun = oturumlar(d, BUGUN).filter((o) => o.satir.grupId === k.grupId);
  const sonYoklama = ogrenciYoklamalari(d, cocuk.id)[0];
  const odevler = bekleyenOdevler(d.odevler, k.grupId, cocuk.id, BUGUN);
  const duyurular = veliDuyurulari(d.duyurular, veli.id).slice(0, 2);
  const taksitler = acikTaksitler(d.taksitler, cocuk.id);
  const [izinAcik, setIzinAcik] = React.useState(false);


  return (
    <div className="grid gap-5">
      <section className="relative overflow-hidden rounded-3xl bg-marka p-5 text-white shadow-glow">
        <span className="pointer-events-none absolute -right-10 -top-12 size-40 rounded-full bg-white/15 blur-xl" />
        <span className="pointer-events-none absolute -bottom-16 left-6 size-36 rounded-full bg-fuchsia-300/30 blur-2xl" />
        <div className="relative flex items-center gap-3">
          <Avatar ad={tamAd(cocuk)} className="size-14 text-base ring-4 ring-white/25" />
          <div className="min-w-0">
            <p className="text-sm text-white/80">Merhaba {veli.ad} 👋</p>
            <h1 className="truncate text-2xl font-extrabold tracking-tight">{iyelik(cocuk.ad)} günü</h1>
          </div>
        </div>
        <div className="relative mt-4 flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-full bg-white/20 px-2.5 py-1 backdrop-blur">{grupEtiket(d, k.grupId)}</span>
          <span className="rounded-full bg-white/20 px-2.5 py-1 backdrop-blur">{s.ad}</span>
          <span className="rounded-full bg-white px-2.5 py-1 text-primary">Bugün {bugun.filter((o) => !o.iptal && !o.tatil).length} ders</span>
        </div>
      </section>

      {!veli.pushAcik && !ogrenciModu && (
        <div className="relative overflow-hidden rounded-2xl border border-amber-300/50 bg-gradient-to-br from-amber-50 to-orange-50 p-4 text-[#5a3a00] dark:from-amber-500/10 dark:to-orange-500/10 dark:text-amber-200">
          <p className="font-bold">🔔 Bildirimleri açın</p>
          <p className="mt-1 text-sm opacity-90">Devamsızlık ve ders iptallerinden anında haberdar olun. iPhone'da önce “Ana Ekrana Ekle” deyin.</p>
          <Button className="mt-3" onClick={bildirimAc}><BellRing /> Bildirimleri aç</Button>
        </div>
      )}

      <Bolum baslik="Bugünün dersleri" link={{ to: "/veli/program", ad: "Program" }}>
        {bugun.length === 0 ? (
          <Card><CardContent className="p-4 text-sm text-muted-foreground">Bugün ders yok.</CardContent></Card>
        ) : (
          <Card className="divide-y">
            {bugun.map((o) => {
              const y = d.yoklamalar[o.id]?.durumlar[cocuk.id];
              return (
                <div key={o.id} className="flex items-center gap-3 p-3">
                  <span className="h-10 w-1 rounded-full" style={{ background: ders(o.satir.dersId)?.renk }} />
                  <div className="flex-1">
                    <p className="font-medium">{dersAdi(o.satir.dersId)}</p>
                    <p className="text-xs text-muted-foreground">{o.bas}–{o.bit} · {personelAdi(d, o.satir.ogretmenId)}</p>
                  </div>
                  {o.iptal || o.tatil ? <Badge variant="secondary">İptal</Badge> : y ? <Badge variant={yoklamaRenk[y]}>{yoklamaAd[y]}</Badge> : null}
                </div>
              );
            })}
          </Card>
        )}
      </Bolum>

      {sonYoklama && (
        <Bolum baslik="Son yoklama" link={{ to: "/veli/yoklama", ad: "Tümü" }}>
          <Card><CardContent className="flex items-center justify-between p-4 text-sm">
            <div><p className="font-medium">{tarihKisa(sonYoklama.y.tarih)} · {dersAdi(d.program.find((p) => p.id === sonYoklama.y.satirId)?.dersId ?? "")}</p><p className="text-xs text-muted-foreground">Konu: {sonYoklama.y.konu || "—"}</p></div>
            <Badge variant={yoklamaRenk[sonYoklama.durum]}>{yoklamaAd[sonYoklama.durum]}</Badge>
          </CardContent></Card>
        </Bolum>
      )}

      {!ogrenciModu && (
        <Button variant="outline" className="h-12 justify-between" onClick={() => setIzinAcik(true)}>
          <span className="flex items-center gap-2"><CalendarDays className="size-4" /> “Yarın gelemeyecek” bildir</span>
          <ChevronRight className="size-4" />
        </Button>
      )}

      {moduller.odev && (
        <Bolum baslik={`Bekleyen ödevler (${odevler.length})`} link={{ to: "/veli/odevler", ad: "Tümü" }}>
          {odevler.slice(0, 3).map((o) => (
            <Card key={o.id}><CardContent className="p-3 text-sm">
              <p className="font-medium">{o.baslik}</p>
              <p className="text-xs text-muted-foreground">{dersAdi(o.dersId)} · teslim {tarihKisa(o.teslim)} ({gunFarki(BUGUN, o.teslim) === 0 ? "bugün" : `${gunFarki(BUGUN, o.teslim)} gün`})</p>
            </CardContent></Card>
          ))}
          {odevler.length === 0 && <p className="text-sm text-muted-foreground">Bekleyen ödev yok.</p>}
        </Bolum>
      )}

      {moduller.finans && !ogrenciModu && taksitler.length > 0 && (
        <Bolum baslik="Ödemeler" link={{ to: "/veli/odemeler", ad: "Detay" }}>
          <Card><CardContent className="flex items-center justify-between p-4 text-sm">
            <div><p className="text-xs text-muted-foreground">Yaklaşan taksit</p><p className="font-medium">{tl(taksitKalan(taksitler[0]))} · {tarihKisa(taksitler[0].vade)}</p></div>
            <div className="text-right"><p className="text-xs text-muted-foreground">Toplam kalan</p><p className="font-medium">{tl(taksitler.reduce((t, x) => t + taksitKalan(x), 0))}</p></div>
          </CardContent></Card>
        </Bolum>
      )}

      <Bolum baslik="Duyurular" link={{ to: "/veli/duyurular", ad: "Tümü" }}>
        {duyurular.map((du) => (
          <Card key={du.id}><CardContent className="p-3 text-sm"><p className="font-medium">{du.baslik}</p><p className="line-clamp-2 text-muted-foreground">{du.metin}</p></CardContent></Card>
        ))}
        {duyurular.length === 0 && <p className="text-sm text-muted-foreground">Duyuru yok.</p>}
      </Bolum>

      <Bolum baslik="Şubeniz">
        <Card><CardContent className="grid gap-2 p-4 text-sm">
          <p className="font-medium">{s.ad} · {grupEtiket(d, k.grupId)}</p>
          <a className="flex items-center gap-2 text-muted-foreground" href={`https://www.google.com/maps/search/${encodeURIComponent(s.adres)}`} target="_blank" rel="noreferrer"><MapPin className="size-4" /> {s.adres}</a>
          <a className="flex items-center gap-2 text-primary" href={`tel:${s.telefon.replace(/\s/g, "")}`}><Phone className="size-4" /> {s.telefon}</a>
        </CardContent></Card>
      </Bolum>
      {izinAcik && <IzinDialog onClose={() => setIzinAcik(false)} />}
    </div>
  );
}

function IzinDialog({ onClose }: { onClose: () => void }) {
  const d = useDb();
  const { cocuk, islem } = usePortal();
  const [tarih, setTarih] = React.useState(tarihEkle(BUGUN, 1));
  const [not, setNot] = React.useState("");
  const dersVar = oturumlar(d, tarih).some((o) => o.satir.grupId === aktifKayit(d, cocuk.id)?.grupId && !o.iptal && !o.tatil);
  const gonder = async () => {
    if (await islem("/api/veli/izin", { ogrenciId: cocuk.id, tarih, not: not.trim() }, "Bildiriminiz öğretmene iletildi; yoklamada “izinli” görünecek.")) onClose();
  };
  return (
    <Dialog open onClose={onClose} title="Gelemeyecek bildirimi" description={`${cocuk.ad} için öğretmene önceden bilgi verin.`} footer={<><Button variant="outline" onClick={onClose}>Vazgeç</Button><Button onClick={gonder} disabled={tarih < BUGUN || !dersVar}>Gönder</Button></>}>
      <Field label="Tarih"><Input type="date" min={BUGUN} value={tarih} onChange={(e) => setTarih(e.target.value)} /></Field>
      {!dersVar && <Alert tone="warning">Bu tarihte {iyelik(cocuk.ad)} dersi yok (tatil veya iptal olabilir); bildirim gönderilemez.</Alert>}
      <Field label="Açıklama (isteğe bağlı)"><Textarea value={not} onChange={(e) => setNot(e.target.value)} placeholder="Doktor randevusu" /></Field>
    </Dialog>
  );
}
