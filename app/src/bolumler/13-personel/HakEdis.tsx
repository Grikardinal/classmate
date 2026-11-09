import * as React from "react";
import { Banknote, CheckCircle2 } from "lucide-react";
import { Alert, Badge, Button, Card, CardContent, Dialog, Field, Input, Select, Table, Td, Th, toast } from "@/components/ui";
import { useApp, useOturum } from "@/context/AppContext";
import { BUGUN, guncelle, islemYaz, sube, tamAd, useDb, yeniId, type Personel } from "@/data/store";
import { tl } from "@/lib/kurallar";
import { tutarCoz } from "../05-finans/kurallar";
import { AvansDialog } from "./AvansDialog";
import { MAAS_KATEGORISI, ayBittiMi, etutUcretiEngeli, hakEdisHesabi, hakEdisteGorunur, hakedisAylari, hakedisDuzeltmeEngeli, hakedisKaydi, odemeAciklamasi, type HakEdisHesabi } from "./kurallar";

type Satir = HakEdisHesabi & { p: Personel; durum?: "onaylandi" | "odendi"; tamKapsam: boolean };

/** Karar 2026-11-08: kurum geneli etüt ücreti; yalnızca genel yönetici değiştirir */
function EtutUcreti() {
  const d = useDb();
  const { ad } = useOturum();
  const mevcut = d.kurum?.etutDersUcreti ?? 0;
  const [deger, setDeger] = React.useState(String(mevcut));
  const u = deger.trim() === "" ? 0 : tutarCoz(deger);
  const hata = etutUcretiEngeli(u);
  const kaydet = () => {
    guncelle((x) => {
      x.kurum = { ...x.kurum, etutDersUcreti: u };
      islemYaz(x, ad, "Etüt ücreti", `Etüt ders ücreti: ${tl(u)}`);
    });
    toast("Etüt ders ücreti kaydedildi.");
  };
  return (
    <Card>
      <CardContent className="flex flex-wrap items-end gap-3 p-4">
        <Field label="Etüt ders ücreti (₺, yapılan etüt başına)"><Input inputMode="decimal" className="w-44" value={deger} onChange={(e) => setDeger(e.target.value)} /></Field>
        <Button variant="outline" onClick={kaydet} disabled={!!hata || u === mevcut}>Kaydet</Button>
        <p className="text-xs text-muted-foreground">Tüm öğretmenlere uygulanır. 0 iken etüt hak edişe eklenmez.{hata ? ` ${hata}` : ""}</p>
      </CardContent>
    </Card>
  );
}

/** Karar 2026-11-09: oranlama yok, yönetici ay için işaretli tutar ve gerekçe girer; kim / ne zaman sunucudan */
function DuzeltmeDialog({ r, ay, onClose }: { r: Satir; ay: string; onClose: () => void }) {
  const d = useDb();
  const { moduller } = useApp();
  const { rol } = useOturum();
  const anahtar = `${ay}_${r.p.id}`;
  const kayit = hakedisKaydi(d.hakedisDurum[anahtar]);
  const [tutar, setTutar] = React.useState(kayit.duzeltme ? String(kayit.duzeltme.tutar) : "");
  const [neden, setNeden] = React.useState(kayit.duzeltme?.neden ?? "");
  const eksi = tutar.trim().startsWith("-");
  const n = (eksi ? -1 : 1) * tutarCoz(tutar.trim().replace(/^-/, ""));
  const baglam = { hakedisAcik: !!moduller.hakedis, finansAcik: !!moduller.finans, rol, bugun: BUGUN, tamKapsam: r.tamKapsam, personel: d.personel };
  const hata = hakedisDuzeltmeEngeli(anahtar, { tutar: n, neden }, kayit, baglam);
  const yaz = (duzeltme: typeof kayit.duzeltme) =>
    guncelle((x) => {
      const { duzeltme: _d, ...kalan } = hakedisKaydi(x.hakedisDurum[anahtar]);
      void _d;
      x.hakedisDurum = { ...x.hakedisDurum, [anahtar]: duzeltme ? { ...kalan, duzeltme } : kalan };
    });
  return (
    <Dialog
      open
      onClose={onClose}
      title="Elle düzeltme"
      description={`${tamAd(r.p)} · ${ay}`}
      footer={
        <>
          {kayit.duzeltme && <Button variant="ghost" className="mr-auto" onClick={() => { yaz(undefined); onClose(); }}>Düzeltmeyi kaldır</Button>}
          <Button variant="outline" onClick={onClose}>Vazgeç</Button>
          <Button disabled={!!hata} onClick={() => { yaz({ tutar: n, neden: neden.trim(), kullanici: "", zaman: "" }); toast("Düzeltme kaydedildi."); onClose(); }}>Kaydet</Button>
        </>
      }
    >
      <Field label="Tutar (₺; kesinti için eksi)"><Input inputMode="decimal" value={tutar} onChange={(e) => setTutar(e.target.value)} /></Field>
      <Field label="Gerekçe"><Input maxLength={200} value={neden} onChange={(e) => setNeden(e.target.value)} /></Field>
      {tutar.trim() && hata && <Alert tone="warning">{hata}</Alert>}
    </Dialog>
  );
}

export function HakEdis() {
  const d = useDb();
  const { moduller } = useApp();
  const { subeGorunur, ad, rol, kapsam } = useOturum();
  const aylar = hakedisAylari(d, BUGUN);
  const [ay, setAy] = React.useState(BUGUN.slice(0, 7));
  const [avansAcik, setAvansAcik] = React.useState(false);
  const [duzeltilen, setDuzeltilen] = React.useState<Satir | null>(null);
  const genel = rol === "genel-yonetici";
  const ayBitti = ayBittiMi(ay, BUGUN);
  const ogretmenler = d.personel.filter((p) => p.gorev === "ogretmen" && p.subeIds.some((s) => subeGorunur(s)));
  const satirlar: Satir[] = ogretmenler
    .map((p) => ({ p, ...hakEdisHesabi(d, p, ay), durum: hakedisKaydi(d.hakedisDurum[`${ay}_${p.id}`]).durum, tamKapsam: genel || p.subeIds.every((s) => kapsam.includes(s)) }))
    .filter((r) => hakEdisteGorunur(r.p, ay, r, r.durum));
  const etutVar = (d.kurum?.etutDersUcreti ?? 0) > 0 || satirlar.some((r) => r.etutSayisi > 0);

  const onayla = (r: Satir) =>
    guncelle((x) => {
      x.hakedisDurum = { ...x.hakedisDurum, [`${ay}_${r.p.id}`]: { ...hakedisKaydi(x.hakedisDurum[`${ay}_${r.p.id}`]), durum: "onaylandi" } };
      islemYaz(x, ad, "Hak ediş onayı", `${tamAd(r.p)} — ${ay}`, r.p.anaSubeId);
    });

  const ode = (r: Satir) => {
    guncelle((x) => {
      x.hakedisDurum = { ...x.hakedisDurum, [`${ay}_${r.p.id}`]: { ...hakedisKaydi(x.hakedisDurum[`${ay}_${r.p.id}`]), durum: "odendi" } };
      // Ödeme finansa gider olarak düşer; birden çok şubede çalışanın gideri şubelere göre ayrıştırılır
      for (const g of r.dagilim)
        x.giderler.push({ id: yeniId("gd"), tarih: BUGUN, subeId: g.subeId, kategori: MAAS_KATEGORISI, aciklama: odemeAciklamasi(r.p, ay), tutar: g.tutar, kasa: "banka" });
      islemYaz(x, ad, "Hak ediş ödemesi", `${tamAd(r.p)} — ${ay}: ${tl(r.odenecek)}`, r.p.anaSubeId);
    });
    toast("Ödendi olarak işaretlendi; gider şubelere göre ayrıştırılarak kaydedildi.");
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select aria-label="Ay" className="w-44" value={ay} onChange={(e) => setAy(e.target.value)}>
          {aylar.map((a) => (
            <option key={a} value={a}>{new Date(a + "-01T00:00:00").toLocaleDateString("tr-TR", { month: "long", year: "numeric" })}</option>
          ))}
        </Select>
        {moduller.finans && <Button variant="outline" className="ml-auto" onClick={() => setAvansAcik(true)}><Banknote /> Avans gir</Button>}
      </div>
      {!moduller.finans && (
        <Alert>
          Finans modülü kapalı: hak ediş yalnızca <b>ders sayısı raporu</b> olarak çalışır (öğretmen başına işlenen ders, şube bazında). Tutar hesabı için Finans modülünü açın.
        </Alert>
      )}
      {genel && moduller.finans && <EtutUcreti />}
      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Öğretmen</Th>
              <Th>Şube bazında işlenen ders</Th>
              <Th className="text-right">Toplam</Th>
              {etutVar && <Th className="text-right">Etüt</Th>}
              {moduller.finans && (
                <>
                  <Th>Ücret</Th>
                  <Th className="text-right">Hak ediş</Th>
                  <Th className="text-right">Avans</Th>
                  <Th className="text-right">Ödenecek</Th>
                  <Th />
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {satirlar.map((r) => (
              <tr key={r.p.id}>
                <Td className="font-medium">{tamAd(r.p)}</Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    {r.subeBazinda.map((s) => <Badge key={s.s} variant="outline">{sube(s.s)?.kod}: {s.n}{s.e ? ` + ${s.e} etüt` : ""}</Badge>)}
                  </div>
                </Td>
                <Td className="text-right font-medium tabular-nums">{r.dersSayisi}</Td>
                {etutVar && <Td className="text-right tabular-nums">{r.etutSayisi}</Td>}
                {moduller.finans && (r.tamKapsam ? (
                  <>
                    <Td className="text-xs text-muted-foreground">
                      {r.p.ucretTipi === "sabit" ? `Sabit ${tl(r.p.sabitUcret)}` : r.p.ucretTipi === "ders" ? `${tl(r.p.dersUcreti)}/ders` : `${tl(r.p.sabitUcret)} + ${tl(r.p.dersUcreti)}/ders`}
                    </Td>
                    <Td className="text-right tabular-nums">
                      {tl(r.tutar)}
                      {r.duzeltme !== 0 && <p className="text-xs text-muted-foreground">Düzeltme: {tl(r.duzeltme)}</p>}
                      {r.oncekiFark !== 0 && <p className="text-xs text-muted-foreground">Önceki ay farkı: {tl(r.oncekiFark)}</p>}
                      {r.donduruldu && <p className="text-xs text-muted-foreground">Ödeme anındaki tutar</p>}
                    </Td>
                    <Td className="text-right tabular-nums">
                      {r.avans ? tl(r.avans) : "—"}
                      {r.devredenAvans > 0 && <p className="text-xs text-muted-foreground">Devreden: {tl(r.devredenAvans)}</p>}
                      {r.fazlaAvans > 0 && <p className="text-xs text-warning">Sonraki aya: {tl(r.fazlaAvans)}</p>}
                    </Td>
                    <Td className="text-right font-medium tabular-nums">{tl(r.odenecek)}</Td>
                    <Td className="text-right">
                      {r.durum !== "odendi" && <Button size="sm" variant="ghost" onClick={() => setDuzeltilen(r)}>Düzelt</Button>}
                      {r.durum === "odendi" ? (
                        <Badge variant="success"><CheckCircle2 className="size-3" /> Ödendi</Badge>
                      ) : r.durum === "onaylandi" ? (
                        <Button size="sm" onClick={() => ode(r)} disabled={!genel}>Ödendi</Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => onayla(r)} disabled={!ayBitti}>Onayla</Button>
                      )}
                    </Td>
                  </>
                ) : (
                  <Td colSpan={5} className="text-xs text-muted-foreground">Başka şubede de çalışıyor; tutar ve onay genel yöneticide.</Td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      <p className="text-xs text-muted-foreground">
        “İşlenen ders” = yoklaması alınmış ders oturumu; iptal ve tatil sayılmaz. Etütte yalnızca “yapıldı” sonucu sayılır. Onay ay bitince verilir. Bordro, SGK ve vergi hesapları kapsam dışıdır; muhasebeciye bu özet aktarılır.
      </p>
      {duzeltilen && <DuzeltmeDialog r={duzeltilen} ay={ay} onClose={() => setDuzeltilen(null)} />}
      <AvansDialog open={avansAcik} onClose={() => setAvansAcik(false)} ogretmenler={ogretmenler.filter((p) => p.aktif && (genel || p.subeIds.every((s) => kapsam.includes(s))))} />
    </div>
  );
}
