import * as React from "react";
import { ArrowLeftRight, Banknote, CreditCard, Landmark, Plus, Printer } from "lucide-react";
import { Alert, Button, Card, CardHeader, CardTitle, Dialog, Field, Input, Select, StatCard, Table, Td, Th, toast } from "@/components/ui";
import { useOturum } from "@/context/AppContext";
import { BUGUN, guncelle, islemYaz, sube, tamAd, useDb, yeniId, type Db, type Gider } from "@/data/store";
import { tl } from "@/lib/kurallar";
import { esc, yazdir } from "@/lib/yazdir";
import {
  GIDER_KATEGORILERI,
  KASA_TURLERI,
  MERKEZ,
  giderEngeli,
  gunSonuOzeti,
  kasaBakiyesi,
  kasaErisimi,
  kasaHareketleri,
  kasaKimligi,
  kasaSubesi,
  kasaTurAdlari,
  tutarCoz,
  virmanEngeli,
  type KasaHareketi,
} from "./kurallar";
import { kasaEtiket, tarihTR } from "./ortak";

/** Hareketin ekrandaki açıklaması */
function aciklama(d: Db, h: KasaHareketi): string {
  if (h.tur === "tahsilat" || h.tur === "tahsilatIptali") {
    const t = d.tahsilatlar.find((x) => x.id === h.ref);
    const kim = tamAd(d.veliler.find((v) => v.id === t?.veliId));
    return h.tur === "tahsilat" ? `Tahsilat ${t?.makbuzNo} · ${kim}` : `Tahsilat iptali (ters kayıt) ${t?.makbuzNo} · ${t?.iptal?.neden ?? ""}`;
  }
  if (h.tur === "gider") {
    const g = d.giderler.find((x) => x.id === h.ref);
    return `${g?.kategori} · ${g?.aciklama}`;
  }
  const v = d.virmanlar.find((x) => x.id === h.ref);
  return h.tur === "virmanCikis" ? `Virman → ${kasaEtiket(v?.hedef ?? "")} · ${v?.aciklama}` : `Virman ← ${kasaEtiket(v?.kaynak ?? "")} · ${v?.aciklama}`;
}

export function Kasa() {
  const d = useDb();
  const { seciliSubeler, ad, rol, kapsam } = useOturum();
  const [giderAcik, setGiderAcik] = React.useState(false);
  const [virmanAcik, setVirmanAcik] = React.useState(false);
  const genel = rol === "genel-yonetici";
  const tum = kasaHareketleri(d);
  const erisim = { genel, kapsam };
  // Seçili şubelerin kasaları + (genel yönetici) Genel Merkez banka hesabı
  const kasalar = [...seciliSubeler.flatMap((s) => KASA_TURLERI.map((k) => kasaKimligi(s, k))), ...(genel ? [kasaKimligi(MERKEZ, "banka")] : [])].filter((k) => kasaErisimi(k, erisim));
  const hareketler = tum.filter((h) => kasalar.includes(h.kasa));
  const bakiye = (k: string) => kasaBakiyesi(tum, k);
  const bugun = hareketler.filter((h) => h.tarih.startsWith(BUGUN));

  const gunSonu = () =>
    yazdir(
      `Gün sonu ${BUGUN}`,
      `<h1>Gün sonu kasa raporu — ${tarihTR(BUGUN)}</h1>
       <table><tr><th>Kasa</th><th class="sag">Açılış</th><th class="sag">Giriş</th><th class="sag">Çıkış</th><th class="sag">Kapanış</th></tr>${kasalar
         .map((k) => {
           const o = gunSonuOzeti(tum, k, BUGUN);
           return `<tr><td>${esc(kasaEtiket(k))}</td><td class="sag">${tl(o.acilis)}</td><td class="sag">${tl(o.giris)}</td><td class="sag">${tl(o.cikis)}</td><td class="sag">${tl(o.kapanis)}</td></tr>`;
         })
         .join("")}</table>
       <h2>Bugünkü hareketler</h2><table><tr><th>Kasa</th><th>Açıklama</th><th class="sag">Giriş</th><th class="sag">Çıkış</th></tr>
       ${bugun.map((h) => `<tr><td>${esc(kasaEtiket(h.kasa))}</td><td>${esc(aciklama(d, h))}</td><td class="sag">${h.giris ? tl(h.giris) : ""}</td><td class="sag">${h.cikis ? tl(h.cikis) : ""}</td></tr>`).join("") || `<tr><td colspan="4">Hareket yok</td></tr>`}</table>
       <div class="imza"><div>Hazırlayan: ${esc(ad)}</div><div>Kontrol eden</div></div>`,
    );

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={gunSonu}><Printer /> Gün sonu raporu</Button>
        <Button variant="outline" onClick={() => setVirmanAcik(true)} disabled={kasalar.length < 2}><ArrowLeftRight /> Virman</Button>
        <Button onClick={() => setGiderAcik(true)} disabled={!seciliSubeler.length && !genel}><Plus /> Gider gir</Button>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {kasalar.map((k) => (
          <StatCard key={k} label={kasaEtiket(k)} value={tl(bakiye(k))} icon={k.endsWith("nakit") ? <Banknote /> : k.endsWith("pos") ? <CreditCard /> : <Landmark />} tone={bakiye(k) < 0 ? "danger" : "default"} />
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Kasa hareketleri</CardTitle></CardHeader>
        <Table>
          <thead><tr><Th>Tarih</Th><Th>Kasa</Th><Th>Açıklama</Th><Th className="text-right">Giriş</Th><Th className="text-right">Çıkış</Th></tr></thead>
          <tbody>
            {hareketler.slice(0, 60).map((h) => (
              <tr key={h.id}>
                <Td className="whitespace-nowrap tabular-nums">{tarihTR(h.tarih)}</Td>
                <Td className="whitespace-nowrap text-xs">{kasaEtiket(h.kasa)}</Td>
                <Td>{aciklama(d, h)}</Td>
                <Td className="text-right tabular-nums text-success">{h.giris ? tl(h.giris) : ""}</Td>
                <Td className="text-right tabular-nums text-danger">{h.cikis ? tl(h.cikis) : ""}</Td>
              </tr>
            ))}
            {hareketler.length === 0 && <tr><Td colSpan={5} className="text-center text-muted-foreground">Hareket yok.</Td></tr>}
          </tbody>
        </Table>
      </Card>
      {giderAcik && <GiderDialog onClose={() => setGiderAcik(false)} merkez={genel} bakiye={bakiye} />}
      {virmanAcik && <VirmanDialog onClose={() => setVirmanAcik(false)} kasalar={kasalar} bakiye={bakiye} />}
    </div>
  );
}

function GiderDialog({ onClose, merkez, bakiye }: { onClose: () => void; merkez: boolean; bakiye: (k: string) => number }) {
  const d = useDb();
  const { seciliSubeler, ad } = useOturum();
  const [f, setF] = React.useState({ tarih: BUGUN, subeId: (seciliSubeler[0] ?? MERKEZ) as string, kategori: "Kırtasiye", aciklama: "", tutar: "", kasa: "nakit" as Gider["kasa"] });
  const tutar = tutarCoz(f.tutar);
  const gider: Gider = { id: "", tarih: f.tarih, subeId: f.subeId, kategori: f.kategori, aciklama: f.aciklama.trim(), tutar, kasa: f.kasa };
  const hata = giderEngeli(gider, undefined, d, { finans: true, genel: merkez, bugun: BUGUN });
  const kasa = kasaKimligi(f.subeId, f.subeId === MERKEZ ? "banka" : f.kasa);
  const eksiye = !hata && bakiye(kasa) - tutar < 0;
  const kaydet = () => {
    if (hata) return;
    guncelle((x) => {
      x.giderler.push({ ...gider, id: yeniId("gd") });
      islemYaz(x, ad, "Gider", `${f.kategori}: ${gider.aciklama} — ${tl(tutar)}`, f.subeId === MERKEZ ? null : f.subeId);
    });
    toast("Gider kaydedildi.");
    onClose();
  };
  return (
    <Dialog open onClose={onClose} title="Gider girişi" description="Girilen gider değiştirilemez; kontrol edip kaydedin." footer={<><Button variant="outline" onClick={onClose}>Vazgeç</Button><Button onClick={kaydet} disabled={!!hata}>Kaydet</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tarih"><Input type="date" max={BUGUN} value={f.tarih} onChange={(e) => setF({ ...f, tarih: e.target.value })} /></Field>
        <Field label="Şube">
          <Select value={f.subeId} onChange={(e) => setF({ ...f, subeId: e.target.value, kasa: e.target.value === MERKEZ ? "banka" : f.kasa })}>
            {seciliSubeler.map((s) => <option key={s} value={s}>{sube(s)?.ad}</option>)}
            {merkez && <option value={MERKEZ}>Genel Merkez (ortak gider)</option>}
          </Select>
        </Field>
        <Field label="Kategori">
          <Select value={f.kategori} onChange={(e) => setF({ ...f, kategori: e.target.value })}>
            {GIDER_KATEGORILERI.map((k) => <option key={k}>{k}</option>)}
          </Select>
        </Field>
        <Field label="Kasa">
          <Select value={f.subeId === MERKEZ ? "banka" : f.kasa} disabled={f.subeId === MERKEZ} onChange={(e) => setF({ ...f, kasa: e.target.value as Gider["kasa"] })}>
            {KASA_TURLERI.map((k) => <option key={k} value={k}>{kasaTurAdlari[k]}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Açıklama"><Input value={f.aciklama} onChange={(e) => setF({ ...f, aciklama: e.target.value })} /></Field>
      <Field label="Tutar (₺)"><Input inputMode="decimal" value={f.tutar} onChange={(e) => setF({ ...f, tutar: e.target.value })} /></Field>
      <Field label="Belge fotoğrafı" hint="Fatura / fiş görseli (isteğe bağlı; henüz sunucuya yüklenmez)"><Input type="file" accept="image/*,application/pdf" className="pt-1.5" /></Field>
      {(f.aciklama || f.tutar) && hata && <p className="text-sm text-danger">{hata}</p>}
      {eksiye && <Alert tone="warning">Bu gider {kasaEtiket(kasa)} bakiyesini eksiye düşürür ({tl(bakiye(kasa) - tutar)}).</Alert>}
    </Dialog>
  );
}

function VirmanDialog({ onClose, kasalar, bakiye }: { onClose: () => void; kasalar: string[]; bakiye: (k: string) => number }) {
  const d = useDb();
  const { ad, rol } = useOturum();
  // Genel Merkez kasası kaynak olarak yalnızca genel yöneticiye açılır (kasalar listesi zaten buna göre)
  const [f, setF] = React.useState({ kaynak: kasalar[0] ?? "", hedef: kasalar[kasalar.length - 1] ?? "", tutar: "", aciklama: "" });
  const tutar = tutarCoz(f.tutar);
  const hata = virmanEngeli(
    { id: "", tarih: BUGUN, kaynak: f.kaynak, hedef: f.hedef, tutar, aciklama: f.aciklama },
    undefined,
    d,
    { finans: true, genel: rol === "genel-yonetici", bugun: BUGUN, bakiye },
  );
  const kaydet = () => {
    if (hata) return;
    guncelle((x) => {
      x.virmanlar.push({ id: yeniId("vr"), tarih: BUGUN, kaynak: f.kaynak, hedef: f.hedef, tutar, aciklama: f.aciklama.trim() || "Virman" });
      islemYaz(x, ad, "Virman", `${kasaEtiket(f.kaynak)} → ${kasaEtiket(f.hedef)}: ${tl(tutar)}`, kasaSubesi(f.kaynak) === MERKEZ ? null : kasaSubesi(f.kaynak));
    });
    toast("Virman kaydedildi.");
    onClose();
  };
  return (
    <Dialog open onClose={onClose} title="Kasalar arası virman" description="Girilen virman değiştirilemez." footer={<><Button variant="outline" onClick={onClose}>Vazgeç</Button><Button onClick={kaydet} disabled={!!hata}>Kaydet</Button></>}>
      <Field label="Kaynak kasa" hint={f.kaynak ? `Bakiye: ${tl(bakiye(f.kaynak))}` : undefined}>
        <Select value={f.kaynak} onChange={(e) => setF({ ...f, kaynak: e.target.value })}>{kasalar.map((k) => <option key={k} value={k}>{kasaEtiket(k)}</option>)}</Select>
      </Field>
      <Field label="Hedef kasa"><Select value={f.hedef} onChange={(e) => setF({ ...f, hedef: e.target.value })}>{kasalar.map((k) => <option key={k} value={k}>{kasaEtiket(k)}</option>)}</Select></Field>
      <Field label="Tutar (₺)"><Input inputMode="decimal" value={f.tutar} onChange={(e) => setF({ ...f, tutar: e.target.value })} /></Field>
      <Field label="Açıklama"><Input value={f.aciklama} onChange={(e) => setF({ ...f, aciklama: e.target.value })} /></Field>
      {(f.tutar || f.kaynak === f.hedef) && hata && <Alert tone="warning">{hata}</Alert>}
    </Dialog>
  );
}
