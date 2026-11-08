/** Ödev listesi, özet kartları, yarın teslim hatırlatması ve silme */
import * as React from "react";
import { BellRing, BookOpenCheck, CheckCheck, Paperclip, Trash2 } from "lucide-react";
import { Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle, Dialog, EmptyState, Select, StatCard, toast } from "@/components/ui";
import { useOturum } from "@/context/AppContext";
import { BUGUN, bildirimEkle, ders, dersAdi, grupEtiket, guncelle, islemYaz, personelAdi, useDb, type Odev } from "@/data/store";
import { tarihEkle } from "@/lib/kurallar";
import { cn } from "@/lib/utils";
import { kontrolDuzeltmeEngeli, kontrolZamanEngeli, odevHedefleri, odevKontrolEdebilir, odevSilmeEngeli, ogretmenOdevGorur } from "./kurallar";
import { tarihKisa, teslimSecenek } from "./ortak";
import TeslimKontrol from "./TeslimKontrol";

export default function OdevListesi() {
  const d = useDb();
  const { grupGorunur, ogretmenMi, personel, ad, rol } = useOturum();
  const [filtre, setFiltre] = React.useState<"aktif" | "kontrol" | "bitti" | "all">("all");
  const [kontrolId, setKontrolId] = React.useState<string | null>(null);
  const [silinecek, setSilinecek] = React.useState<Odev | null>(null);

  const gorunen = d.odevler.filter((o) => grupGorunur(o.grupId) && (!ogretmenMi || ogretmenOdevGorur(o, d, personel.id, BUGUN)));
  // Rehber öğretmen başka öğretmenin ödevini yalnızca görür; dersi devralan yalnızca teslim kontrolü yapar
  const benim = (o: Odev) => !ogretmenMi || o.ogretmenId === personel.id;
  const kontrolEder = (o: Odev) => !ogretmenMi || odevKontrolEdebilir(o, d, personel.id, BUGUN);
  const islenen = gorunen.filter(benim);
  const bekliyorMu = (o: Odev) => o.teslim <= BUGUN && !o.kontrolEdildi;
  const odevler = gorunen
    .filter((o) => {
      if (filtre === "aktif") return o.teslim >= BUGUN && !o.kontrolEdildi;
      if (filtre === "kontrol") return bekliyorMu(o);
      if (filtre === "bitti") return o.kontrolEdildi;
      return true;
    })
    .sort((a, b) => b.teslim.localeCompare(a.teslim));
  const kontrolBekleyen = gorunen.filter((o) => kontrolEder(o) && bekliyorMu(o)).length;
  const yarin = islenen.filter((o) => o.teslim === tarihEkle(BUGUN, 1) && !o.kontrolEdildi);
  const kontrolOdev = d.odevler.find((o) => o.id === kontrolId);
  const baglam = { rol, personelId: personel.id, bugun: BUGUN, modulAcik: true, ogretmenGruplari: ogretmenMi ? new Set(d.gruplar.map((g) => g.id)) : null };

  const hatirlat = () => {
    let n = 0;
    guncelle((x) => {
      for (const o of yarin) for (const ogr of odevHedefleri(x, o)) n += bildirimEkle(x, "odevHatirlatma", ogr.id, { ders: dersAdi(o.dersId), baslik: o.baslik }, undefined, true);
      islemYaz(x, ad, "Ödev hatırlatma", `${yarin.length} ödev için hatırlatma gönderildi`);
    });
    toast(`${n} veliye “yarın teslim” hatırlatması gönderildi.`);
  };
  const sil = (o: Odev) => {
    guncelle((x) => {
      x.odevler = x.odevler.filter((y) => y.id !== o.id);
      islemYaz(x, ad, "Ödev silindi", `${grupEtiket(x, o.grupId)} — ${o.baslik}`);
    });
    setSilinecek(null);
  };

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Aktif ödev" value={islenen.filter((o) => o.teslim >= BUGUN && !o.kontrolEdildi).length} icon={<BookOpenCheck />} />
        <StatCard label="Kontrol bekleyen" value={kontrolBekleyen} icon={<CheckCheck />} tone={kontrolBekleyen ? "warning" : "default"} onClick={() => setFiltre("kontrol")} />
        <StatCard label="Yarın teslim" value={yarin.length} icon={<BellRing />} />
        <StatCard label="Bu ay verilen" value={islenen.filter((o) => o.verilis.startsWith(BUGUN.slice(0, 7))).length} />
      </div>
      {yarin.length > 0 && (
        <Alert icon={<BellRing />}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>Teslimden 1 gün önce velilere otomatik hatırlatma gider (her akşam 19:00). Yarın teslim: {yarin.map((o) => o.baslik).join(", ")}</span>
            <Button size="sm" variant="outline" onClick={hatirlat}>Şimdi gönder</Button>
          </div>
        </Alert>
      )}
      <div className="flex gap-2">
        <Select aria-label="Filtre" className="w-52" value={filtre} onChange={(e) => setFiltre(e.target.value as typeof filtre)}>
          <option value="all">Tüm ödevler</option>
          <option value="aktif">Teslimi gelmemiş</option>
          <option value="kontrol">Kontrol bekleyen</option>
          <option value="bitti">Kontrol edilmiş</option>
        </Select>
      </div>
      {odevler.length === 0 ? (
        <EmptyState icon={<BookOpenCheck />} title="Ödev yok" text="Bu filtreye uyan ödev bulunamadı." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {odevler.map((o) => {
            const t = Object.values(o.teslimler);
            const ds = ders(o.dersId);
            const bekliyor = bekliyorMu(o);
            const zamanEngeli = kontrolZamanEngeli(o.teslim, BUGUN) ?? kontrolDuzeltmeEngeli(o, rol, BUGUN);
            const silEngeli = odevSilmeEngeli(o, baglam);
            return (
              <Card key={o.id} className={cn(bekliyor && "border-warning/40")}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium" style={{ color: ds?.renk }}>{ds?.ad} · {grupEtiket(d, o.grupId)}{o.ogrenciIds && ` · ${o.ogrenciIds.length} öğrenci`}</p>
                      <CardTitle className="mt-1 text-base">{o.baslik}</CardTitle>
                    </div>
                    {o.kontrolEdildi ? <Badge variant="success">Kontrol edildi</Badge> : bekliyor ? <Badge variant="warning">Kontrol bekliyor</Badge> : <Badge>Teslim {tarihKisa(o.teslim)}</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="grid gap-3 text-sm">
                  <p className="text-muted-foreground">{o.aciklama}</p>
                  {o.kaynak && <p className="flex items-center gap-1.5"><Paperclip className="size-3.5" /> {o.kaynak}</p>}
                  {o.kontrolEdildi && (
                    <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                      {teslimSecenek.map((s) => (
                        <div key={s.key} className={s.sinif.split(" ")[0]} style={{ width: `${(t.filter((x) => x === s.key).length / Math.max(1, t.length)) * 100}%` }} title={s.ad} />
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t pt-3">
                    <span className="text-xs text-muted-foreground">{personelAdi(d, o.ogretmenId)} · verildi {tarihKisa(o.verilis)}</span>
                    {kontrolEder(o) && (
                      <div className="flex gap-1">
                        {benim(o) && <Button variant="ghost" size="icon" aria-label="Sil" title={silEngeli ?? undefined} disabled={!!silEngeli} onClick={() => setSilinecek(o)}><Trash2 /></Button>}
                        <Button size="sm" variant={bekliyor ? "default" : "outline"} title={zamanEngeli ?? undefined} disabled={!!zamanEngeli} onClick={() => setKontrolId(o.id)}>Teslim kontrol</Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      {kontrolOdev && <TeslimKontrol key={kontrolOdev.id} o={kontrolOdev} onClose={() => setKontrolId(null)} />}
      <Dialog
        open={!!silinecek}
        onClose={() => setSilinecek(null)}
        title="Ödev silinsin mi?"
        footer={<><Button variant="outline" onClick={() => setSilinecek(null)}>Vazgeç</Button><Button variant="destructive" onClick={() => silinecek && sil(silinecek)}>Sil</Button></>}
      >
        <p className="text-sm text-muted-foreground">“{silinecek?.baslik}” ve teslim kayıtları silinecek. Veliye gitmiş bildirimler geri alınamaz.</p>
      </Dialog>
    </div>
  );
}
