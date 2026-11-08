import * as React from "react";
import { Plus, Trash2, XCircle } from "lucide-react";
import { Alert, Badge, Button, Card, CardDescription, CardHeader, CardTitle, Dialog, Field, Input, Select, Table, Td, Th, toast } from "@/components/ui";
import { useOturum } from "@/context/AppContext";
import { BUGUN, bildirimEkle, dersAdi, grup, grupEtiket, grupOgrencileri, guncelle, islemYaz, oturumlar, personelAdi, saat, sube, tanimlar, useDb, yeniId, type Iptal, type ProgramSatiri, type Tatil } from "@/data/store";
import { tarihEkle } from "@/lib/kurallar";
import { cn } from "@/lib/utils";
import { tarihKisa } from "./ortak";
import { iptalGeriAlmaEngeli, iptalYazmaEngeli, oturumKimligi, tatilSilmeEngeli, tatilYazmaEngeli } from "./kurallar";

/* =========================== Tatil ve iptaller =========================== */
export function TatilIptal() {
  const d = useDb();
  const { subeGorunur, grupGorunur, ad, rol, kapsam, ogretmenMi, yetki } = useOturum();
  const duzenleyebilir = yetki("06") && !ogretmenMi;
  const [tatilAcik, setTatilAcik] = React.useState(false);
  const [iptalAcik, setIptalAcik] = React.useState(false);
  const tatiller = d.tatiller.filter((t) => !t.subeId || subeGorunur(t.subeId)).sort((a, b) => a.tarih.localeCompare(b.tarih));
  const iptaller = d.iptaller.filter((i) => grupGorunur(d.program.find((p) => i.oturumId.startsWith(p.id + "_"))?.grupId ?? "")).sort((a, b) => b.tarih.localeCompare(a.tarih));
  // İşlem kaydı tatilin şubesiyle yazılır: şubesiz kayıt şube müdürü için sunucuda reddedilir
  const tatilSil = (tatil: Tatil) =>
    guncelle((x) => {
      x.tatiller = x.tatiller.filter((t) => t.id !== tatil.id);
      islemYaz(x, ad, "Takvim", `${tatil.tarih} ${tatil.ad} tatili kaldırıldı`, tatil.subeId);
    });
  // Karar 2026-11-08: dersin tarihi geçmediyse iptal geri alınır; iptal bildirimi alan velilere geri alma da bildirilir
  const iptalGeriAl = (i: Iptal, p: ProgramSatiri, tarih: string) => {
    if (iptalGeriAlmaEngeli(i, d, BUGUN)) return;
    let n = 0;
    guncelle((x) => {
      x.iptaller = x.iptaller.filter((y) => y.oturumId !== i.oturumId);
      for (const o of grupOgrencileri(x, p.grupId))
        n += bildirimEkle(x, "dersIptal", o.id, { tarih: tarihKisa(tarih), saat: saat(p.saatId)?.baslangic ?? "", ders: dersAdi(p.dersId), neden: "iptali geri alınmıştır, ders yapılacaktır" });
      islemYaz(x, ad, "Ders iptali", `${grupEtiket(x, p.grupId)} ${tarih} ${dersAdi(p.dersId)} iptali geri alındı`, grup(x, p.grupId)?.subeId);
    });
    toast(`İptal geri alındı; ${n} veliye bildirim gönderildi.`);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Tatil günleri</CardTitle>
            <CardDescription className="mt-1">Resmi tatiller kurum genelinde, şubeye özel kapanışlar şube bazında.</CardDescription>
          </div>
          {duzenleyebilir && <Button size="sm" onClick={() => setTatilAcik(true)}><Plus /> Ekle</Button>}
        </CardHeader>
        <Table>
          <thead><tr><Th>Tarih</Th><Th>Ad</Th><Th>Kapsam</Th><Th>Etkilenen ders</Th><Th /></tr></thead>
          <tbody>
            {tatiller.map((t) => (
              <tr key={t.id} className={cn(t.tarih < BUGUN && "text-muted-foreground")}>
                <Td className="whitespace-nowrap tabular-nums">{tarihKisa(t.tarih)}</Td>
                <Td>{t.ad}</Td>
                <Td>{t.subeId ? <Badge variant="outline">{sube(t.subeId)?.kod}</Badge> : <Badge>Tüm şubeler</Badge>}</Td>
                <Td className="tabular-nums">{oturumlar(d, t.tarih).filter((o) => o.tatil?.id === t.id).length}</Td>
                <Td className="text-right">
                  {(rol === "genel-yonetici" || (t.subeId && kapsam.includes(t.subeId))) && duzenleyebilir && !tatilSilmeEngeli(t, BUGUN) && (
                    <Button variant="ghost" size="icon" aria-label="Kaldır" onClick={() => tatilSil(t)}><Trash2 /></Button>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Ders iptalleri ve telafiler</CardTitle>
            <CardDescription className="mt-1">İptalde grubun velilerine otomatik bildirim gider.</CardDescription>
          </div>
          {duzenleyebilir && <Button size="sm" onClick={() => setIptalAcik(true)}><XCircle /> Ders iptal et</Button>}
        </CardHeader>
        <Table>
          <thead><tr><Th>Ders</Th><Th>Neden</Th><Th>Telafi</Th><Th /></tr></thead>
          <tbody>
            {iptaller.map((i) => {
              const kimlik = oturumKimligi(i.oturumId);
              const tarih = kimlik?.tarih ?? i.tarih;
              const p = d.program.find((x) => x.id === kimlik?.satirId);
              return (
                <tr key={i.oturumId}>
                  <Td>
                    <p className="font-medium">{p ? `${grupEtiket(d, p.grupId)} · ${dersAdi(p.dersId)}` : "—"}</p>
                    <p className="text-xs text-muted-foreground">{tarihKisa(tarih)} {p && saat(p.saatId)?.baslangic}</p>
                  </Td>
                  <Td>{i.neden}</Td>
                  <Td className="tabular-nums">{i.telafi ? tarihKisa(i.telafi) : "—"}</Td>
                  <Td className="text-right">
                    {p && duzenleyebilir && !iptalGeriAlmaEngeli(i, d, BUGUN) && (
                      <Button variant="ghost" size="sm" onClick={() => iptalGeriAl(i, p, tarih)}>Geri al</Button>
                    )}
                  </Td>
                </tr>
              );
            })}
            {iptaller.length === 0 && <tr><Td colSpan={4} className="text-center text-muted-foreground">İptal yok.</Td></tr>}
          </tbody>
        </Table>
      </Card>
      <TatilDialog open={tatilAcik} onClose={() => setTatilAcik(false)} />
      <IptalDialog open={iptalAcik} onClose={() => setIptalAcik(false)} />
    </div>
  );
}

function TatilDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const d = useDb();
  const { ad, rol, kapsam } = useOturum();
  const bosForm = () => ({ tarih: tarihEkle(BUGUN, 7), ad: "", subeId: rol === "genel-yonetici" ? "" : kapsam[0] });
  const [f, setF] = React.useState(bosForm);
  const engel = tatilYazmaEngeli({ id: "", tarih: f.tarih, ad: f.ad, subeId: f.subeId || null }, undefined, d, BUGUN);
  const kaydet = () => {
    if (engel) return;
    guncelle((x) => {
      x.tatiller.push({ id: yeniId("t"), tarih: f.tarih, ad: f.ad.trim(), subeId: f.subeId || null });
      islemYaz(x, ad, "Takvim", `${f.tarih} ${f.ad} tatil olarak eklendi`, f.subeId || null);
    });
    toast("Tatil eklendi. Velilere duyuru göndermeyi unutmayın (Bölüm 10).");
    setF(bosForm());
    onClose();
  };
  return (
    <Dialog open={open} onClose={onClose} title="Tatil / kapanış ekle" footer={<><Button variant="outline" onClick={onClose}>Vazgeç</Button><Button onClick={kaydet} disabled={!!engel}>Ekle</Button></>}>
      <Field label="Tarih"><Input type="date" value={f.tarih} min={BUGUN} onChange={(e) => setF({ ...f, tarih: e.target.value })} /></Field>
      <Field label="Ad"><Input placeholder="Ara tatil, tadilat…" value={f.ad} onChange={(e) => setF({ ...f, ad: e.target.value })} /></Field>
      <Field label="Kapsam">
        <Select value={f.subeId} onChange={(e) => setF({ ...f, subeId: e.target.value })}>
          {rol === "genel-yonetici" && <option value="">Tüm şubeler (resmi tatil)</option>}
          {tanimlar().subeler.filter((s) => kapsam.includes(s.id)).map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
        </Select>
      </Field>
      {engel && f.ad.trim() && <Alert tone="danger" icon={<XCircle />}>{engel}</Alert>}
    </Dialog>
  );
}

function IptalDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const d = useDb();
  const { grupGorunur, ad } = useOturum();
  const [tarih, setTarih] = React.useState(BUGUN);
  const [oturumId, setOturumId] = React.useState("");
  const [neden, setNeden] = React.useState("");
  const [telafi, setTelafi] = React.useState("");
  const liste = oturumlar(d, tarih).filter((o) => grupGorunur(o.satir.grupId) && !o.iptal && !o.tatil && !d.yoklamalar[o.id]);
  const secili = liste.find((o) => o.id === oturumId);
  const engel = secili ? iptalYazmaEngeli({ oturumId: secili.id, neden, tarih: BUGUN, telafi: telafi || undefined }, undefined, d, BUGUN) : null;
  const kaydet = () => {
    if (!secili || engel) return;
    let n = 0;
    guncelle((x) => {
      x.iptaller.push({ oturumId: secili.id, neden: neden.trim(), tarih: BUGUN, telafi: telafi || undefined });
      for (const o of grupOgrencileri(x, secili.satir.grupId))
        n += bildirimEkle(x, "dersIptal", o.id, {
          tarih: tarihKisa(tarih), saat: secili.bas, ders: dersAdi(secili.satir.dersId),
          neden: `iptal edilmiştir (${neden.trim()})` + (telafi ? `, telafi dersi ${tarihKisa(telafi)}` : ""),
        });
      islemYaz(x, ad, "Ders iptali", `${grupEtiket(x, secili.satir.grupId)} ${tarih} ${secili.bas} — ${neden}`, secili.subeId);
    });
    toast(`Ders iptal edildi; ${n} veliye bildirim gönderildi.`);
    setOturumId("");
    setNeden("");
    setTelafi("");
    onClose();
  };
  return (
    <Dialog open={open} onClose={onClose} title="Ders iptali" description="Tek seferlik iptal; haftalık şablon değişmez." footer={<><Button variant="outline" onClick={onClose}>Vazgeç</Button><Button variant="destructive" onClick={kaydet} disabled={!secili || !!engel}>İptal et ve bildir</Button></>}>
      <Field label="Tarih"><Input type="date" value={tarih} min={BUGUN} onChange={(e) => { setTarih(e.target.value || BUGUN); setOturumId(""); }} /></Field>
      <Field label="Ders" hint={liste.length === 0 ? "Bu tarihte iptal edilebilecek ders yok (yoklaması alınmış dersler iptal edilemez)." : undefined}>
        <Select value={oturumId} onChange={(e) => setOturumId(e.target.value)}>
          <option value="">Seçiniz</option>
          {liste.map((o) => <option key={o.id} value={o.id}>{o.bas} · {grupEtiket(d, o.satir.grupId)} · {dersAdi(o.satir.dersId)} ({personelAdi(d, o.satir.ogretmenId)})</option>)}
        </Select>
      </Field>
      <Field label="Neden"><Input placeholder="Öğretmen rahatsız" value={neden} onChange={(e) => setNeden(e.target.value)} /></Field>
      <Field label="Telafi tarihi (isteğe bağlı)"><Input type="date" value={telafi} min={tarih} onChange={(e) => setTelafi(e.target.value)} /></Field>
      {engel && neden.trim() && <Alert tone="danger" icon={<XCircle />}>{engel}</Alert>}
    </Dialog>
  );
}
