import { Check, X } from "lucide-react";
import { Badge, Button, Card, CardDescription, CardHeader, CardTitle, Table, Td, Th, toast } from "@/components/ui";
import { useOturum } from "@/context/AppContext";
import { guncelle, islemYaz, simdiZaman, tamAd, useDb, type Kayit } from "@/data/store";
import { tl } from "@/lib/kurallar";
import { kayitPlani, kayitUcreti, planiYenidenDagit } from "./kurallar";
import { tarihTR } from "./ortak";

/**
 * Yönetici onayı bekleyen indirimler (karar 2026-11-08). Sekreterin seçtiği indirim onaylanana kadar net indirimsizdir;
 * onayda ödenmemiş taksitler yeni nete göre yeniden dağıtılır, retle talep kalkar. Onay / ret yalnızca yönetici.
 */
export function IndirimOnaylari() {
  const d = useDb();
  const { subeGorunur, rol, ad } = useOturum();
  const yonetici = rol === "genel-yonetici" || rol === "sube-muduru";
  const bekleyen = d.kayitlar.filter((k) => k.bekleyenIndirim && k.durum !== "iptal" && subeGorunur(k.subeId));
  if (!bekleyen.length) return null;

  const karar = (k: Kayit, onay: boolean) => {
    const talep = k.bekleyenIndirim!;
    const indirimler = onay ? [...k.indirimler, ...talep.indirimler.filter((i) => !k.indirimler.some((x) => x.ad === i.ad))] : k.indirimler;
    const net = kayitUcreti(k.listeFiyati, indirimler, k.ekHizmetler).net;
    const dagitim = onay ? planiYenidenDagit(kayitPlani(d.taksitler, k.id), net) : null;
    if (dagitim?.hata) return toast(dagitim.hata, "uyari");
    const o = d.ogrenciler.find((x) => x.id === k.ogrenciId);
    guncelle((x) => {
      x.kayitlar = x.kayitlar.map((y) =>
        y.id === k.id ? { ...y, indirimler, net, bekleyenIndirim: null, indirimOnay: { karar: onay ? "onaylandi" : "reddedildi", indirimler: talep.indirimler, kullanici: ad, zaman: simdiZaman() } } : y,
      );
      if (dagitim) x.taksitler = x.taksitler.map((t) => (dagitim.tutarlar.has(t.id) && dagitim.tutarlar.get(t.id) !== t.tutar ? { ...t, tutar: dagitim.tutarlar.get(t.id)! } : t));
      islemYaz(x, ad, onay ? "İndirim onayı" : "İndirim reddi", `${tamAd(o)} — ${talep.indirimler.map((i) => `${i.ad} %${i.oran}`).join(", ")}${onay ? ` · yeni net ${tl(net)}` : ""}`, k.subeId);
    });
    toast(onay ? `İndirim onaylandı; net ${tl(net)}, ödenmemiş taksitler yeniden dağıtıldı.` : "İndirim talebi reddedildi.");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">İndirim onayı bekleyenler <Badge variant="secondary">{bekleyen.length}</Badge></CardTitle>
        <CardDescription>Onaylanana kadar net tutar ve ödeme planı indirimsizdir. Onayı şube müdürü veya genel yönetici verir.</CardDescription>
      </CardHeader>
      <Table>
        <thead><tr><Th>Öğrenci</Th><Th>İndirim</Th><Th>İsteyen</Th><Th className="text-right">Net (şimdi → onayda)</Th><Th /></tr></thead>
        <tbody>
          {bekleyen.map((k) => {
            const t = k.bekleyenIndirim!;
            const yeni = kayitUcreti(k.listeFiyati, [...k.indirimler, ...t.indirimler], k.ekHizmetler).net;
            return (
              <tr key={k.id}>
                <Td className="font-medium">{tamAd(d.ogrenciler.find((o) => o.id === k.ogrenciId))} <span className="font-mono text-xs text-muted-foreground">{k.sozlesmeNo}</span></Td>
                <Td>{t.indirimler.map((i) => `${i.ad} %${i.oran}`).join(", ")}</Td>
                <Td className="text-muted-foreground">{t.isteyen} · {tarihTR(t.zaman)}</Td>
                <Td className="text-right tabular-nums">{tl(k.net)} → {tl(yeni)}</Td>
                <Td className="text-right">
                  {yonetici && (
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" onClick={() => karar(k, true)}><Check /> Onayla</Button>
                      <Button size="sm" variant="ghost" onClick={() => karar(k, false)}><X /> Reddet</Button>
                    </div>
                  )}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </Card>
  );
}
