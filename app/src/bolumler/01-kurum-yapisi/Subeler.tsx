import * as React from "react";
import { Copy, MapPin, Pencil, Phone, Plus } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Checkbox, Dialog, Field, Input, Select, toast } from "@/components/ui";
import { useOturum } from "@/context/AppContext";
import { AKTIF_SEZON, grupDoluluk, guncelle, islemYaz, useDb, yeniId, type Sube } from "@/data/store";
import { cn } from "@/lib/utils";
import { subeDogrula, subeKopyasi, subeKoduNormalize, subePasifeAlmaEngeli } from "./kurallar";
import { HataMetni, useGenel } from "./ortak";

export function Subeler() {
  const d = useDb();
  const genel = useGenel();
  const { ad } = useOturum();
  const [duzenle, setDuzenle] = React.useState<Sube | null>(null);
  const [yeni, setYeni] = React.useState(false);
  const aktifDegistir = (s: Sube) => {
    if (s.aktif) {
      const engel = subePasifeAlmaEngeli(s.id, d.kayitlar, AKTIF_SEZON);
      if (engel) return toast(engel, "uyari");
    }
    guncelle((x) => {
      x.subeler = x.subeler.map((y) => (y.id === s.id ? { ...y, aktif: !y.aktif } : y));
      islemYaz(x, ad, "Şube", `${s.ad} ${s.aktif ? "pasife alındı" : "aktifleştirildi"}`, s.id);
    });
  };
  return (
    <div className="grid gap-4">
      {genel && (
        <div className="flex justify-end">
          <Button onClick={() => setYeni(true)}><Plus /> Yeni şube aç</Button>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {d.subeler.map((s) => {
          const subeGruplari = d.gruplar.filter((g) => g.subeId === s.id && g.sezonId === AKTIF_SEZON);
          const ogrenci = subeGruplari.reduce((t, g) => t + grupDoluluk(d, g.id), 0);
          return (
            <Card key={s.id} className={cn(!s.aktif && "opacity-70")}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle>{s.ad}</CardTitle>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">{s.kod}</p>
                  </div>
                  <Badge variant={s.aktif ? "success" : "secondary"}>{s.aktif ? "Aktif" : "Pasif"}</Badge>
                </div>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm">
                <p className="flex gap-2 text-muted-foreground"><MapPin className="mt-0.5 size-4 shrink-0" />{s.adres || "—"}</p>
                <p className="flex gap-2 text-muted-foreground"><Phone className="mt-0.5 size-4 shrink-0" />{s.telefon || "—"}</p>
                <p className="text-muted-foreground">Müdür: <span className="text-foreground">{s.mudur || "—"}</span></p>
                <div className="mt-2 grid grid-cols-2 gap-2 border-t pt-3">
                  <div><p className="text-lg font-semibold">{subeGruplari.length}</p><p className="text-xs text-muted-foreground">grup</p></div>
                  <div><p className="text-lg font-semibold">{ogrenci}</p><p className="text-xs text-muted-foreground">öğrenci</p></div>
                </div>
                {genel && (
                  <div className="flex justify-end gap-1 border-t pt-3">
                    <Button variant="ghost" size="sm" onClick={() => aktifDegistir(s)}>{s.aktif ? "Pasife al" : "Aktifleştir"}</Button>
                    <Button variant="outline" size="sm" onClick={() => setDuzenle(s)}><Pencil /> Düzenle</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      {duzenle && <SubeDialog sube={duzenle} onClose={() => setDuzenle(null)} />}
      {yeni && <SubeDialog onClose={() => setYeni(false)} />}
    </div>
  );
}

function SubeDialog({ sube, onClose }: { sube?: Sube; onClose: () => void }) {
  const d = useDb();
  const { ad } = useOturum();
  const [f, setF] = React.useState({ ad: sube?.ad ?? "", kod: sube?.kod ?? "", adres: sube?.adres ?? "", telefon: sube?.telefon ?? "", mudur: sube?.mudur ?? "" });
  const [kopyaKaynak, setKopyaKaynak] = React.useState(d.subeler.find((s) => s.aktif)?.id ?? d.subeler[0]?.id ?? "");
  const [kopya, setKopya] = React.useState({ derslik: true, saat: true });
  const kod = subeKoduNormalize(f.kod);
  const temiz = { ad: f.ad.trim(), kod, adres: f.adres.trim(), telefon: f.telefon.trim(), mudur: f.mudur.trim() };
  const hata = subeDogrula({ id: sube?.id, ad: temiz.ad, kod }, d.subeler);
  // Kullanıcı yazmaya başlamadan boş form için kırmızı uyarı gösterme
  const hataGoster = f.ad !== "" || f.kod !== "" ? hata : null;

  const kaydet = () => {
    if (hata) return;
    guncelle((x) => {
      if (sube) {
        x.subeler = x.subeler.map((s) => (s.id === sube.id ? { ...s, ...temiz } : s));
        islemYaz(x, ad, "Şube", `${temiz.ad} bilgileri güncellendi`, sube.id);
        return;
      }
      const id = yeniId("s");
      x.subeler.push({ id, ...temiz, aktif: true });
      // Yeni şube açma sihirbazı: derslik ve ders saatleri başka şubeden kopyalanabilir
      if (kopyaKaynak) {
        const k = subeKopyasi(kopyaKaynak, id, x, kopya, yeniId);
        x.derslikler.push(...k.derslikler);
        x.dersSaatleri.push(...k.dersSaatleri);
        // Fiyatlar (her sezon ve seviye) kaynak şubeden kopyalanır
        x.fiyatListesi = [...x.fiyatListesi, ...x.fiyatListesi.filter((f) => f.subeId === kopyaKaynak).map((f) => ({ ...f, subeId: id }))];
      }
      // Genel yöneticinin kapsamına otomatik girer; diğer personel Bölüm 02'den atanır
      islemYaz(x, ad, "Şube", `${temiz.ad} (${kod}) şubesi açıldı`, id);
    });
    toast(sube ? "Şube güncellendi." : `${temiz.ad} şubesi açıldı. Personeli Bölüm 02'den bu şubeye atayın.`);
    onClose();
  };
  return (
    <Dialog
      open
      onClose={onClose}
      wide
      title={sube ? `${sube.ad} — düzenle` : "Yeni şube aç"}
      footer={<><Button variant="outline" onClick={onClose}>Vazgeç</Button><Button onClick={kaydet} disabled={!!hata}>{sube ? "Kaydet" : "Şubeyi aç"}</Button></>}
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <Field label="Şube adı"><Input value={f.ad} onChange={(e) => setF({ ...f, ad: e.target.value })} placeholder="Batı Şubesi" /></Field>
        <Field label="Kısa kod" hint="2–5 harf; sözleşme no başı">
          <Input value={f.kod} maxLength={5} onChange={(e) => setF({ ...f, kod: e.target.value })} placeholder="BTI" />
        </Field>
      </div>
      <HataMetni hata={hataGoster} />
      <Field label="Adres"><Input value={f.adres} onChange={(e) => setF({ ...f, adres: e.target.value })} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Telefon" hint="Velilere giden mesajlarda {sube_telefonu}"><Input type="tel" value={f.telefon} onChange={(e) => setF({ ...f, telefon: e.target.value })} /></Field>
        <Field label="Şube müdürü"><Input value={f.mudur} onChange={(e) => setF({ ...f, mudur: e.target.value })} /></Field>
      </div>
      {!sube && d.subeler.length > 0 && (
        <div className="grid gap-2 rounded-lg border p-3">
          <p className="flex items-center gap-2 text-sm font-medium"><Copy className="size-4" /> Başka şubeden kopyala</p>
          <Select value={kopyaKaynak} onChange={(e) => setKopyaKaynak(e.target.value)}>
            {d.subeler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
          </Select>
          <Checkbox checked={kopya.derslik} onChange={(v) => setKopya({ ...kopya, derslik: v })} label={`Derslikler (${d.derslikler.filter((x) => x.subeId === kopyaKaynak).length})`} />
          <Checkbox checked={kopya.saat} onChange={(v) => setKopya({ ...kopya, saat: v })} label={`Ders saatleri (${d.dersSaatleri.filter((x) => x.subeId === kopyaKaynak).length})`} />
        </div>
      )}
    </Dialog>
  );
}
