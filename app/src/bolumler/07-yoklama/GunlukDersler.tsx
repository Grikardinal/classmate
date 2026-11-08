import * as React from "react";
import { AlertTriangle, BellRing, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, Clock } from "lucide-react";
import { Alert, Badge, Button, EmptyState, Input, StatCard, toast } from "@/components/ui";
import { useOturum } from "@/context/AppContext";
import { BUGUN, SIMDI, ders, derslikAdi, grupEtiket, guncelle, islemYaz, oturumlar, personelAdi, sube, useDb, type Oturum } from "@/data/store";
import { tarihEkle } from "@/lib/kurallar";
import { cn } from "@/lib/utils";
import { oturumDurumu, yoklamaOgrencileri, type OturumDurumu } from "./kurallar";
import { tarihUzun } from "./ortak";

/* ---------- Günün dersleri ---------- */
export function GunlukDersler({ onAc }: { onAc: (id: string, tarih: string) => void }) {
  const d = useDb();
  const { grupGorunur, ogretmenMi, personel, ad } = useOturum();
  const [tarih, setTarih] = React.useState(BUGUN);
  const liste = oturumlar(d, tarih).filter((o) => grupGorunur(o.satir.grupId) && (!ogretmenMi || o.satir.ogretmenId === personel.id));
  const durumu = React.useCallback((o: Oturum) => oturumDurumu(o, !!d.yoklamalar[o.id], BUGUN, SIMDI, d.ayarlar.yoklamaHatirlatmaDk), [d]);
  const sayac = (s: OturumDurumu) => liste.filter((o) => durumu(o) === s).length;
  const gecikenler = liste.filter((o) => durumu(o) === "gecikti");

  // Geçmiş günlerde alınmamış yoklamalar (son 7 gün)
  const eskiEksik = React.useMemo(() => {
    const l: Oturum[] = [];
    for (let i = 1; i <= 7; i++) {
      const t = tarihEkle(BUGUN, -i);
      l.push(...oturumlar(d, t).filter((o) => grupGorunur(o.satir.grupId) && (!ogretmenMi || o.satir.ogretmenId === personel.id) && durumu(o) === "gecikti"));
    }
    return l;
  }, [d, durumu, grupGorunur, ogretmenMi, personel.id]);

  const hatirlat = () => {
    const ogretmenler = [...new Set(gecikenler.map((o) => o.satir.ogretmenId))];
    guncelle((x) => islemYaz(x, ad, "Yoklama hatırlatma", `${ogretmenler.map((p) => personelAdi(x, p)).join(", ")} için hatırlatma istendi`));
    // Personele bildirim kanalı yok: yalnızca işlem kaydına düşer (README · bilinen sınırlar)
    toast(`${ogretmenler.length} öğretmen için hatırlatma işlem kaydına yazıldı.`);
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="Önceki gün" onClick={() => setTarih(tarihEkle(tarih, -1))}><ChevronLeft /></Button>
        <Input type="date" className="w-44" value={tarih} onChange={(e) => setTarih(e.target.value || BUGUN)} />
        <Button variant="ghost" size="icon" aria-label="Sonraki gün" onClick={() => setTarih(tarihEkle(tarih, 1))}><ChevronRight /></Button>
        <span className="text-sm font-medium capitalize">{tarihUzun(tarih)}</span>
        {tarih !== BUGUN && <Button variant="ghost" size="sm" onClick={() => setTarih(BUGUN)}>Bugün</Button>}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Toplam ders" value={liste.length} icon={<ClipboardCheck />} />
        <StatCard label="Yoklama alındı" value={sayac("alindi")} icon={<CheckCircle2 />} tone="success" />
        <StatCard label="Alınmadı (gecikti)" value={sayac("gecikti")} icon={<AlertTriangle />} tone={sayac("gecikti") ? "danger" : "default"} hint={`Dersin başlamasından ${d.ayarlar.yoklamaHatirlatmaDk} dk sonra`} />
        <StatCard label="Devam eden / planlı" value={sayac("devam") + sayac("planli")} icon={<Clock />} />
      </div>

      {gecikenler.length > 0 && !ogretmenMi && (
        <Alert tone="danger" icon={<AlertTriangle />}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{gecikenler.length} dersin yoklaması alınmadı: {gecikenler.map((o) => `${grupEtiket(d, o.satir.grupId)} ${o.bas}`).join(", ")}</span>
            <Button size="sm" variant="outline" onClick={hatirlat}><BellRing /> Öğretmenlere hatırlat</Button>
          </div>
        </Alert>
      )}
      {tarih === BUGUN && eskiEksik.length > 0 && (
        <Alert tone="warning" icon={<AlertTriangle />}>
          Son 7 günde {eskiEksik.length} dersin yoklaması eksik:{" "}
          {eskiEksik.slice(0, 5).map((o, i) => (
            <React.Fragment key={o.id}>
              {i > 0 && ", "}
              <button className="underline" onClick={() => onAc(o.id, o.tarih)}>{grupEtiket(d, o.satir.grupId)} ({new Date(o.tarih + "T00:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short" })})</button>
            </React.Fragment>
          ))}
        </Alert>
      )}

      {liste.length === 0 ? (
        <EmptyState icon={<ClipboardCheck />} title="Bu gün ders yok" text="Ders programında bu güne ait ders bulunmuyor." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {liste.map((o) => {
            const s = durumu(o);
            const y = d.yoklamalar[o.id];
            const ds = ders(o.satir.dersId)!;
            const ogrSayi = y ? Object.keys(y.durumlar).length : yoklamaOgrencileri(d, o.satir.grupId, o.tarih).length;
            const gelmeyen = y ? Object.values(y.durumlar).filter((x) => x === "gelmedi").length : 0;
            return (
              <button
                key={o.id}
                onClick={() => s !== "iptal" && s !== "planli" && onAc(o.id, o.tarih)}
                disabled={s === "iptal" || s === "planli"}
                className={cn(
                  "rounded-lg border bg-card p-4 text-left shadow-xs transition hover:border-primary/40 disabled:cursor-default disabled:hover:border-border",
                  s === "gecikti" && "border-danger/40",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs tabular-nums text-muted-foreground">{o.bas}–{o.bit} · {sube(o.subeId)?.kod} · {derslikAdi(o.satir.derslikId)}</p>
                    <p className="mt-1 font-semibold">{grupEtiket(d, o.satir.grupId)}</p>
                    <p className="text-sm" style={{ color: ds.renk }}>{ds.ad}</p>
                  </div>
                  {s === "alindi" && <Badge variant="success">Alındı</Badge>}
                  {s === "gecikti" && <Badge variant="danger">Alınmadı</Badge>}
                  {s === "devam" && <Badge variant="warning">Derste</Badge>}
                  {s === "planli" && <Badge variant="secondary">Planlı</Badge>}
                  {s === "iptal" && <Badge variant="secondary">{o.tatil ? o.tatil.ad : "İptal"}</Badge>}
                </div>
                <div className="mt-3 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                  <span>{personelAdi(d, o.satir.ogretmenId)}</span>
                  <span>{y ? <><b className={gelmeyen ? "text-danger" : "text-success"}>{gelmeyen} yok</b> / {ogrSayi}</> : `${ogrSayi} öğrenci`}</span>
                </div>
                {y?.konu && <p className="mt-2 truncate text-xs">Konu: {y.konu}</p>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
