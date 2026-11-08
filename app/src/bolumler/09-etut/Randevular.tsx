import * as React from "react";
import { CalendarClock } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, Select, Table, Td, Th, toast } from "@/components/ui";
import { useOturum } from "@/context/AppContext";
import { BUGUN, SIMDI, dersAdi, guncelle, islemYaz, personelAdi, tamAd, useDb, type Randevu } from "@/data/store";
import { baslamisMi, etutTurAd, hakDuser } from "./kurallar";
import { durumRozet, tarihKisa } from "./ortak";

export function Randevular() {
  const d = useDb();
  const { subeGorunur, ogretmenMi, personel, ad } = useOturum();
  const [filtre, setFiltre] = React.useState<"gelecek" | "gecmis" | "all">("gelecek");
  const an = { bugun: BUGUN, simdi: SIMDI };
  const liste = d.randevular
    .filter((r) => subeGorunur(r.subeId) && (!ogretmenMi || r.ogretmenId === personel.id))
    .filter((r) => (filtre === "gelecek" ? r.tarih >= BUGUN : filtre === "gecmis" ? r.tarih < BUGUN : true))
    .sort((a, b) => (filtre === "gecmis" ? b.tarih.localeCompare(a.tarih) : a.tarih.localeCompare(b.tarih)) || a.bas.localeCompare(b.bas));

  const durumDegistir = (r: Randevu, durum: Randevu["durum"]) => {
    guncelle((x) => {
      x.randevular = x.randevular.map((y) => (y.id === r.id ? { ...y, durum } : y));
      // Paket hakkı: yapıldıysa düşer; gelmediyse kurum ayarına göre düşer (kesin değeri sunucu yazar)
      if (hakDuser(r, durum, x.ayarlar.gelmeyenHakDussun)) x.paketler = x.paketler.map((p) => (p.id === r.paketId ? { ...p, kalan: Math.max(0, p.kalan - 1) } : p));
      islemYaz(x, ad, "Etüt", `${r.tarih} ${r.bas} randevu: ${durumRozet[durum].ad}`, r.subeId);
    });
    toast(`Randevu “${durumRozet[durum].ad}” olarak işaretlendi.`);
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">Randevular</CardTitle>
        <Select aria-label="Filtre" className="w-40" value={filtre} onChange={(e) => setFiltre(e.target.value as typeof filtre)}>
          <option value="gelecek">Yaklaşan</option>
          <option value="gecmis">Geçmiş</option>
          <option value="all">Tümü</option>
        </Select>
      </CardHeader>
      {liste.length === 0 ? (
        <CardContent><EmptyState icon={<CalendarClock />} title="Randevu yok" text="Takvimden boş slota tıklayarak randevu oluşturun." /></CardContent>
      ) : (
        <Table>
          <thead><tr><Th>Tarih</Th><Th>Öğrenci</Th><Th>Öğretmen</Th><Th>Tür</Th><Th>Durum</Th><Th className="text-right">İşlem</Th></tr></thead>
          <tbody>
            {liste.map((r) => (
              <tr key={r.id}>
                <Td className="whitespace-nowrap tabular-nums">{tarihKisa(r.tarih)} {r.bas}</Td>
                <Td>
                  {r.ogrenciIds.map((id) => tamAd(d.ogrenciler.find((o) => o.id === id))).join(", ")}
                  {r.olusturan === "veli" && <Badge variant="outline" className="ml-2">Veli aldı</Badge>}
                </Td>
                <Td>{personelAdi(d, r.ogretmenId)} <span className="text-xs text-muted-foreground">· {dersAdi(r.dersId)}</span></Td>
                <Td>{etutTurAd[r.tur]} {r.link && <a className="ml-1 text-primary underline" href={r.link} target="_blank" rel="noreferrer">link</a>}</Td>
                <Td><Badge variant={durumRozet[r.durum].v}>{durumRozet[r.durum].ad}</Badge></Td>
                <Td className="text-right">
                  {r.durum === "planli" && (
                    <div className="flex justify-end gap-1">
                      {baslamisMi(r, an) && <Button size="sm" variant="outline" onClick={() => durumDegistir(r, "yapildi")}>Yapıldı</Button>}
                      {baslamisMi(r, an) && <Button size="sm" variant="ghost" onClick={() => durumDegistir(r, "gelmedi")}>Gelmedi</Button>}
                      {!(ogretmenMi && baslamisMi(r, an)) && <Button size="sm" variant="ghost" className="text-danger" onClick={() => durumDegistir(r, "iptal")}>İptal</Button>}
                    </div>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <CardContent className="pt-4 text-xs text-muted-foreground">
        Veli, randevuyu en geç {d.ayarlar.etutIptalSaat} saat öncesine kadar portaldan iptal edebilir. Gelmeyen öğrencinin özel ders hakkı {d.ayarlar.gelmeyenHakDussun ? "düşer" : "düşmez"} (kurum ayarı, Bölüm 14).
      </CardContent>
    </Card>
  );
}
