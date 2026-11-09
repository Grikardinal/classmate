/** Etüt randevuları (veli): boş slottan randevu, iptal */
import * as React from "react";
import { Navigate } from "react-router-dom";
import { Badge, Button, Card, CardContent, Dialog } from "@/components/ui";
import { useApp } from "@/context/AppContext";
import { gunAdlari, gunKisa } from "@/data/mock";
import { BUGUN, SIMDI, aktifKayit, personelAdi, sube, useDb } from "@/data/store";
import { haftaGunu, tarihEkle } from "@/lib/kurallar";
import { bosSlotlar, etutTurAd, ogrenciDersiCakisir } from "../09-etut/kurallar";
import { randevuIptalDurumu, randevuRozeti } from "./kurallar";
import { Bolum, tarihKisa, usePortal } from "./ortak";

export function PortalEtut() {
  const d = useDb();
  const { moduller } = useApp();
  const { cocuk, islem } = usePortal();
  const [secim, setSecim] = React.useState<{ tarih: string; bas: string; bit: string; ogretmenId: string; subeId: string } | null>(null);
  const [iptalId, setIptalId] = React.useState<string | null>(null);
  const [iptalEdiliyor, setIptalEdiliyor] = React.useState(false);
  if (!moduller.etut) return <Navigate to="/veli" replace />;
  const k = aktifKayit(d, cocuk.id)!;
  const randevular = d.randevular.filter((r) => r.ogrenciIds.includes(cocuk.id)).sort((a, b) => b.tarih.localeCompare(a.tarih));
  // Veli varsayılan olarak çocuğunun kayıtlı olduğu şubedeki slotları görür
  const gunler = Array.from({ length: 10 }, (_, i) => tarihEkle(BUGUN, i));
  const slotlar = gunler.flatMap((t) => bosSlotlar(d, t, undefined, k.subeId).filter((s) => !ogrenciDersiCakisir(d, cocuk.id, t, s.bas, s.bit)).map((s) => ({ ...s, tarih: t })));

  const al = async () => {
    if (!secim) return;
    if (await islem("/api/veli/randevu", { ogrenciId: cocuk.id, ogretmenId: secim.ogretmenId, tarih: secim.tarih, bas: secim.bas }, "Randevunuz alındı. 1 saat önce hatırlatma gelecek.")) setSecim(null);
  };
  const iptalRandevu = randevular.find((r) => r.id === iptalId);
  const iptal = async () => {
    if (!iptalRandevu || iptalEdiliyor) return;
    setIptalEdiliyor(true);
    await islem(`/api/veli/randevu/${iptalRandevu.id}/iptal`, {}, "Randevu iptal edildi.");
    setIptalEdiliyor(false);
    setIptalId(null);
  };

  return (
    <div className="grid gap-4">
      <h1 className="text-xl font-semibold">Etüt randevuları</h1>
      <Bolum baslik="Randevularım">
        {randevular.length === 0 && <p className="text-sm text-muted-foreground">Randevu yok.</p>}
        {randevular.map((r) => (
          <Card key={r.id}><CardContent className="flex items-center gap-3 p-3 text-sm">
            <div className="flex-1"><p className="font-medium">{tarihKisa(r.tarih)} · {r.bas}</p><p className="text-xs text-muted-foreground">{personelAdi(d, r.ogretmenId)} · {etutTurAd[r.tur]} · {sube(r.subeId)?.ad}</p></div>
            {randevuIptalDurumu(r, d.ayarlar.etutIptalSaat, { bugun: BUGUN, simdi: SIMDI }) !== "sonuc" ? (
              randevuIptalDurumu(r, d.ayarlar.etutIptalSaat, { bugun: BUGUN, simdi: SIMDI }) === "acik" ? <Button size="sm" variant="ghost" className="text-danger" onClick={() => setIptalId(r.id)}>İptal</Button> : <span className="text-xs text-muted-foreground">İptal süresi geçti</span>
            ) : (
              <Badge variant={randevuRozeti(r, cocuk.id).ton}>{randevuRozeti(r, cocuk.id).ad}</Badge>
            )}
          </CardContent></Card>
        ))}
      </Bolum>
      <Bolum baslik={`Boş saatler · ${sube(k.subeId)?.ad}`}>
        <div className="grid grid-cols-2 gap-2">
          {slotlar.slice(0, 16).map((s) => (
            <button type="button" key={`${s.tarih}${s.bas}${s.m.id}`} onClick={() => setSecim({ tarih: s.tarih, bas: s.bas, bit: s.bit, ogretmenId: s.m.ogretmenId, subeId: s.m.subeId })} className="rounded-lg border p-2.5 text-left text-sm hover:border-primary">
              <p className="font-medium">{gunKisa[haftaGunu(s.tarih)]} {s.bas}</p>
              <p className="text-xs text-muted-foreground">{personelAdi(d, s.m.ogretmenId)}</p>
            </button>
          ))}
        </div>
        {slotlar.length === 0 && <p className="text-sm text-muted-foreground">Önümüzdeki günlerde boş slot yok.</p>}
      </Bolum>
      {iptalRandevu && (
        <Dialog open onClose={() => setIptalId(null)} title="Randevu iptal edilsin mi?" description={`${tarihKisa(iptalRandevu.tarih)} ${iptalRandevu.bas} · ${personelAdi(d, iptalRandevu.ogretmenId)}`} footer={<><Button variant="outline" onClick={() => setIptalId(null)}>Vazgeç</Button><Button variant="destructive" onClick={() => void iptal()} disabled={iptalEdiliyor}>Randevuyu iptal et</Button></>}>
          <p className="text-sm text-muted-foreground">{iptalRandevu.tur === "grup" ? `Yalnızca ${cocuk.ad} bu grup etüdünden çıkarılır.` : "Bu işlem geri alınamaz; aynı saat başkası tarafından alınabilir."}</p>
        </Dialog>
      )}
      {secim && (
        <Dialog open onClose={() => setSecim(null)} title="Randevuyu onayla" description={`${gunAdlari[haftaGunu(secim.tarih)]} ${tarihKisa(secim.tarih)} ${secim.bas}–${secim.bit} · ${personelAdi(d, secim.ogretmenId)}`} footer={<><Button variant="outline" onClick={() => setSecim(null)}>Vazgeç</Button><Button onClick={al}>Randevu al</Button></>}>
          <p className="text-sm text-muted-foreground">En geç {d.ayarlar.etutIptalSaat} saat öncesine kadar iptal edebilirsiniz.</p>
        </Dialog>
      )}
    </div>
  );
}
