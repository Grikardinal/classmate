import * as React from "react";
import { BellRing, Package, Plus } from "lucide-react";
import { Alert, Button, Card, CardHeader, CardTitle, Dialog, Field, Input, Select, StatCard, Table, Td, Th, toast } from "@/components/ui";
import { useApp, useOturum } from "@/context/AppContext";
import { BUGUN, aktifKayit, bildirimEkle, dersAdi, guncelle, islemYaz, personelAdi, tamAd, tanimlar, useDb, yeniId, type Db } from "@/data/store";
import { tl } from "@/lib/kurallar";
import { cn } from "@/lib/utils";
import { paketBilgiMetni, paketBildirimiGitti, paketYeniEngeli } from "./kurallar";
import { tarihKisa } from "./ortak";

export function Paketler() {
  const d = useDb();
  const { moduller } = useApp();
  const { subeGorunur, ad, ogretmenMi } = useOturum();
  const [acik, setAcik] = React.useState(false);
  const liste = d.paketler.filter((p) => subeGorunur(aktifKayit(d, p.ogrenciId)?.subeId));
  const bitiyor = liste.filter((p) => p.kalan <= 1);
  const gidecek = (x: Db) => bitiyor.filter((p) => !paketBildirimiGitti(x.gonderimler, p, dersAdi(p.dersId)));
  const bilgiVer = () => {
    const sayi = gidecek(d).length;
    if (!sayi) return toast("Bu paketler için bilgi daha önce gönderildi.");
    guncelle((x) => {
      for (const p of gidecek(x)) {
        const n = x.gonderimler.length;
        bildirimEkle(x, "paketBitiyor", p.ogrenciId, { metin: paketBilgiMetni(dersAdi(p.dersId), p.kalan) }, undefined, true);
        for (const g of x.gonderimler.slice(n)) g.paketId = p.id;
      }
      islemYaz(x, ad, "Paket bildirimi", `${sayi} veliye paket bitiyor bilgisi`);
    });
    toast(`${sayi} veliye “paket bitmek üzere” bilgisi gönderildi.`);
  };
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Aktif paket" value={liste.filter((p) => p.kalan > 0).length} icon={<Package />} />
        <StatCard label="Kalan toplam hak" value={liste.reduce((s, p) => s + p.kalan, 0)} />
        <StatCard label="Bitmek üzere" value={bitiyor.length} tone={bitiyor.length ? "warning" : "default"} />
      </div>
      {bitiyor.length > 0 && (
        <Alert tone="warning" icon={<BellRing />}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{bitiyor.map((p) => tamAd(d.ogrenciler.find((o) => o.id === p.ogrenciId))).join(", ")} — paket bitmek üzere.</span>
            {!ogretmenMi && <Button size="sm" variant="outline" onClick={bilgiVer}>Veliye bilgi ver</Button>}
          </div>
        </Alert>
      )}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Özel ders paketleri</CardTitle>
          {!ogretmenMi && <Button size="sm" onClick={() => setAcik(true)}><Plus /> Paket tanımla</Button>}
        </CardHeader>
        <Table>
          <thead><tr><Th>Öğrenci</Th><Th>Ders / öğretmen</Th><Th>Başlangıç</Th>{moduller.finans && <Th className="text-right">Ücret</Th>}<Th className="w-48">Kalan hak</Th></tr></thead>
          <tbody>
            {liste.map((p) => (
              <tr key={p.id}>
                <Td className="font-medium">{tamAd(d.ogrenciler.find((o) => o.id === p.ogrenciId))}</Td>
                <Td>{dersAdi(p.dersId)} · {personelAdi(d, p.ogretmenId)}</Td>
                <Td className="tabular-nums">{tarihKisa(p.tarih)}</Td>
                {moduller.finans && <Td className="text-right tabular-nums">{tl(p.fiyat)}</Td>}
                <Td>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", p.kalan <= 1 ? "bg-warning" : "bg-primary")} style={{ width: `${(p.kalan / p.toplam) * 100}%` }} /></div>
                    <span className="w-10 text-right text-xs tabular-nums">{p.kalan}/{p.toplam}</span>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      <PaketDialog open={acik} onClose={() => setAcik(false)} />
    </div>
  );
}

function PaketDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const d = useDb();
  const { moduller } = useApp();
  const { subeGorunur, ad } = useOturum();
  const ogrenciler = d.ogrenciler.filter((o) => o.durum === "aktif" && subeGorunur(aktifKayit(d, o.id)?.subeId)).sort((a, b) => a.ad.localeCompare(b.ad, "tr"));
  const ogretmenler = d.personel.filter((p) => p.gorev === "ogretmen" && p.aktif);
  const [f, setF] = React.useState({ ogrenciId: "", ogretmenId: ogretmenler[0]?.id ?? "", dersId: ogretmenler[0]?.dersIds[0] ?? "l2", toplam: 8, fiyat: 3600 });
  const gecerli = !paketYeniEngeli({ id: "__yeni", ...f, kalan: f.toplam, fiyat: moduller.finans ? f.fiyat : 0, tarih: BUGUN }, d);
  const kaydet = () => {
    if (!gecerli) return;
    guncelle((x) => {
      x.paketler.push({ id: yeniId("pk"), ogrenciId: f.ogrenciId, ogretmenId: f.ogretmenId, dersId: f.dersId, toplam: f.toplam, kalan: f.toplam, fiyat: moduller.finans ? f.fiyat : 0, tarih: BUGUN });
      // Finans açıksa paket satışı öğrencinin ödeme planına ek kalem olarak düşer
      if (moduller.finans && f.fiyat > 0) {
        const k = aktifKayit(x, f.ogrenciId)!;
        const o = x.ogrenciler.find((y) => y.id === f.ogrenciId)!;
        x.taksitler.push({ id: yeniId("tk"), kayitId: k.id, ogrenciId: o.id, veliId: o.birincilVeliId, subeId: k.subeId, no: 99, vade: BUGUN, tutar: f.fiyat, odenen: 0 });
      }
      islemYaz(x, ad, "Özel ders paketi", `${tamAd(x.ogrenciler.find((o) => o.id === f.ogrenciId))} — ${f.toplam} ders`);
    });
    toast(moduller.finans ? "Paket tanımlandı; ücret ödeme planına eklendi." : "Paket tanımlandı.");
    onClose();
  };
  return (
    <Dialog open={open} onClose={onClose} title="Özel ders paketi" description={moduller.finans ? "Paket ücreti öğrencinin ödeme planına ek kalem olarak düşer." : "Finans kapalı: paket yalnızca ders hakkı sayısıdır."} footer={<><Button variant="outline" onClick={onClose}>Vazgeç</Button><Button onClick={kaydet} disabled={!gecerli}>Kaydet</Button></>}>
      <Field label="Öğrenci">
        <Select value={f.ogrenciId} onChange={(e) => setF({ ...f, ogrenciId: e.target.value })}>
          <option value="">Seçiniz</option>
          {ogrenciler.map((o) => <option key={o.id} value={o.id}>{tamAd(o)}</option>)}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Öğretmen">
          <Select value={f.ogretmenId} onChange={(e) => { const p = ogretmenler.find((x) => x.id === e.target.value); setF({ ...f, ogretmenId: e.target.value, dersId: p?.dersIds[0] ?? f.dersId }); }}>
            {ogretmenler.map((p) => <option key={p.id} value={p.id}>{p.ad} {p.soyad}</option>)}
          </Select>
        </Field>
        <Field label="Ders">
          <Select value={f.dersId} onChange={(e) => setF({ ...f, dersId: e.target.value })}>
            {tanimlar().dersler.filter((x) => x.aktif).map((x) => <option key={x.id} value={x.id}>{x.ad}</option>)}
          </Select>
        </Field>
        <Field label="Ders hakkı"><Input type="number" min={1} value={f.toplam} onChange={(e) => setF({ ...f, toplam: Number(e.target.value) })} /></Field>
        {moduller.finans && <Field label="Ücret (₺)"><Input type="number" min={0} value={f.fiyat} onChange={(e) => setF({ ...f, fiyat: Number(e.target.value) })} /></Field>}
      </div>
    </Dialog>
  );
}
