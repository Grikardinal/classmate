/** Bölüm 12 · Öğretmenin paneli: bugünkü dersler, alınmamış yoklamalar, ödev kontrolleri. */
import { Link } from "react-router-dom";
import { BookOpenCheck, CalendarCheck2, ClipboardCheck, Clock } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle, StatCard } from "@/components/ui";
import { useApp, useOturum } from "@/context/AppContext";
import { BUGUN, SIMDI, dersAdi, grupEtiket, oturumlar, sube, useDb } from "@/data/store";
import { odevKontrolEdebilir } from "@/bolumler/08-odevler/kurallar";
import { tarihEkle } from "@/lib/kurallar";
import { selamla, yoklamaBekliyor } from "./kurallar";

export function OgretmenPaneli() {
  const d = useDb();
  const { moduller } = useApp();
  const { personel, yetki } = useOturum();
  const benim = (t: string) => oturumlar(d, t).filter((o) => o.satir.ogretmenId === personel.id);
  const bugun = benim(BUGUN);
  const yapilacak = bugun.filter((o) => !o.iptal && !o.tatil);
  const alinmayan = Array.from({ length: 8 }, (_, i) => tarihEkle(BUGUN, -i)).flatMap((t) => benim(t).filter((o) => !o.iptal && !o.tatil && yoklamaBekliyor(o, d.yoklamalar, BUGUN, SIMDI, d.ayarlar.yoklamaHatirlatmaDk)));
  const odevler = d.odevler.filter((o) => odevKontrolEdebilir(o, d, personel.id, BUGUN) && o.teslim <= BUGUN && !o.kontrolEdildi);
  const etutler = d.randevular.filter((r) => r.ogretmenId === personel.id && r.tarih >= BUGUN && r.durum === "planli");
  const yoklamaYetkisi = yetki("07");
  const satirSinifi = "flex items-center justify-between rounded-md border p-3 text-sm";
  return (
    <div className="grid gap-6">
      <section className="relative overflow-hidden rounded-3xl bg-marka p-6 text-white shadow-glow sm:p-8">
        <span className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-white/15 blur-2xl" />
        <p className="relative text-sm font-semibold capitalize text-white/80">{new Date(BUGUN + "T00:00:00").toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" })}</p>
        <h1 className="relative mt-1 text-3xl font-extrabold tracking-tight">{selamla(SIMDI)}, {personel.ad} 👋</h1>
        <p className="relative mt-2 text-[15px] text-white/85">Bugünkü dersleriniz, alınmamış yoklamalar ve ödev kontrolleri.</p>
      </section>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Bugünkü ders" value={yapilacak.length} icon={<CalendarCheck2 />} />
        <StatCard label="Alınmamış yoklama" value={alinmayan.length} icon={<ClipboardCheck />} tone={alinmayan.length ? "danger" : "default"} />
        {moduller.odev && <StatCard label="Kontrol bekleyen ödev" value={odevler.length} icon={<BookOpenCheck />} tone={odevler.length ? "warning" : "default"} />}
        {moduller.etut && <StatCard label="Yaklaşan etüt" value={etutler.length} icon={<Clock />} />}
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Bugünkü derslerim</CardTitle></CardHeader>
        <CardContent className="grid gap-2">
          {bugun.length === 0 && <p className="text-sm text-muted-foreground">Bugün dersiniz yok.</p>}
          {bugun.map((o) => {
            const icerik = (
              <>
                <span><b className="tabular-nums">{o.bas}</b> · {grupEtiket(d, o.satir.grupId)} · {dersAdi(o.satir.dersId)} <span className="text-muted-foreground">({sube(o.subeId)?.ad})</span></span>
                {o.iptal ? <Badge variant="outline">İptal</Badge> : o.tatil ? <Badge variant="outline">Tatil</Badge> : d.yoklamalar[o.id] ? <Badge variant="success">Yoklama alındı</Badge> : <Badge variant="warning">Yoklama al</Badge>}
              </>
            );
            return yoklamaYetkisi && !o.iptal && !o.tatil
              ? <Link key={o.id} to="/yoklama" className={`${satirSinifi} hover:border-primary/40`}>{icerik}</Link>
              : <div key={o.id} className={satirSinifi}>{icerik}</div>;
          })}
        </CardContent>
      </Card>
      {alinmayan.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Alınmamış yoklamalar</CardTitle></CardHeader>
          <CardContent className="grid gap-1 text-sm">
            {alinmayan.map((o) => <p key={o.id}>{new Date(o.tarih + "T00:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short" })} {o.bas} · {grupEtiket(d, o.satir.grupId)}</p>)}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
