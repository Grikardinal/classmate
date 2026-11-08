import * as React from "react";
import { Badge, Button, Dialog, Field, Table, Td, Textarea, Th } from "@/components/ui";
import { sube, taksitAdi, tamAd, useDb, type Taksit } from "@/data/store";
import { tl } from "@/lib/kurallar";
import { MERKEZ, kalan, kasaTurAdlari, type KasaTuru } from "./kurallar";

export type Sekme = "ozet" | "tahsilat" | "geciken" | "kasa";

/** Finans kaydı iptali (tahsilat, iade, gider, virman): gerekçe zorunlu, geri alınamaz, kasaya ters kayıt düşer */
export function IptalDialog({ baslik, aciklama, onIptal, onClose }: { baslik: string; aciklama: string; onIptal: (neden: string) => void; onClose: () => void }) {
  const [neden, setNeden] = React.useState("");
  return (
    <Dialog
      open
      onClose={onClose}
      title={baslik}
      description={`${aciklama} Kayıt silinmez, iptal olarak işaretlenir; kasada bugünün tarihiyle ters kayıt görünür. İptal geri alınamaz.`}
      footer={<><Button variant="outline" onClick={onClose}>Vazgeç</Button><Button variant="destructive" onClick={() => { onIptal(neden.trim()); onClose(); }} disabled={neden.trim().length < 3}>İptal et</Button></>}
    >
      <Field label="Gerekçe (en az 3 karakter)"><Textarea value={neden} onChange={(e) => setNeden(e.target.value)} /></Field>
    </Dialog>
  );
}

export const tarihTR = (iso: string) =>
  new Date(iso.slice(0, 10) + "T00:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });

/** "s1:nakit" → "MRK Nakit kasa", "merkez:banka" → "Genel Merkez Banka" */
export function kasaEtiket(k: string) {
  const [s, tur] = k.split(":");
  return `${s === MERKEZ ? "Genel Merkez" : (sube(s)?.kod ?? s)} ${kasaTurAdlari[tur as KasaTuru] ?? tur}`;
}

/** Kaydı iptal edilmiş / dondurulmuş taksit için küçük etiket */
export function KayitDurumEtiketi({ kayitId }: { kayitId: string }) {
  const d = useDb();
  const durum = d.kayitlar.find((k) => k.id === kayitId)?.durum;
  if (durum === "iptal") return <Badge variant="secondary">kayıt iptal</Badge>;
  if (durum === "dondurulmus") return <Badge variant="secondary">donduruldu</Badge>;
  return null;
}

export function TaksitTablosu({ taksitler }: { taksitler: Taksit[] }) {
  const d = useDb();
  return (
    <Table>
      <thead><tr><Th>Öğrenci</Th><Th>Veli</Th><Th>Taksit</Th><Th>Vade</Th><Th className="text-right">Kalan</Th></tr></thead>
      <tbody>
        {taksitler.slice(0, 50).map((t) => {
          const o = d.ogrenciler.find((x) => x.id === t.ogrenciId);
          const v = d.veliler.find((x) => x.id === t.veliId);
          return (
            <tr key={t.id}>
              <Td className="font-medium">{tamAd(o)} <KayitDurumEtiketi kayitId={t.kayitId} /></Td>
              <Td>{tamAd(v)} <span className="font-mono text-xs text-muted-foreground">{v?.telefon}</span></Td>
              <Td>{taksitAdi(t.no)}</Td>
              <Td className="tabular-nums">{tarihTR(t.vade)}</Td>
              <Td className="text-right tabular-nums">{tl(kalan(t))}</Td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}
