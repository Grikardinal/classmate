import * as React from "react";
import { Link } from "react-router-dom";
import { Mail, Phone, ShieldCheck } from "lucide-react";
import { Alert, Button, Sheet, Switch, toast } from "@/components/ui";
import { useOturum } from "@/context/AppContext";
import { gunKisa } from "@/data/mock";
import { BUGUN, dersAdi, grupEtiket, guncelle, islemYaz, rolAdlari, saat, tamAd, useDb } from "@/data/store";
import { dakika } from "@/lib/kurallar";
import { bolumYetkisi } from "../02-kullanicilar/kurallar";
import { personelTemizle, personelYazmaEngeli, ucretGorur } from "./kurallar";
import { gorenBilgisi, haftalikDersler, kartDuzenlenebilir } from "./ortak";
import { PersonelForm } from "./PersonelForm";

export function PersonelKarti({ id, onClose }: { id: string; onClose: () => void }) {
  const d = useDb();
  const { ad, rol, kapsam, personel: ben } = useOturum();
  const p = d.personel.find((x) => x.id === id)!;
  const [f, setF] = React.useState(p);
  const goren = gorenBilgisi(d, rol, ben.id);
  // Hesap listesi yalnızca 02 yetkisiyle gelir; görmeyene "hesap yok" denmez
  const hesapGorunur = rol === "genel-yonetici" || bolumYetkisi(d.rolYetkileri, rol, "02");
  const kullanici = d.kullanicilar.find((k) => k.personelId === id);
  const dersListesi = haftalikDersler(d, id);
  const gruplar = [...new Set(dersListesi.map((x) => x.grupId))];
  const sure = (saatId: string) => {
    const h = saat(saatId);
    return h ? dakika(h.bitis) - dakika(h.baslangic) : 0;
  };
  const dk = dersListesi.reduce((s, x) => s + sure(x.saatId), 0);
  const duzenlenebilir = kartDuzenlenebilir(p, rol, goren.yetki13, kapsam);
  const temiz = personelTemizle(f);
  const hata = duzenlenebilir ? personelYazmaEngeli(temiz, p, d, { rol, personelId: ben.id }, BUGUN) : null;

  const kaydet = () => {
    if (hata || !duzenlenebilir) return;
    guncelle((x) => {
      x.personel = x.personel.map((y) => (y.id === id ? temiz : y));
      // Ayrılan personelin hesabı silinmez, pasife alınır
      if (!temiz.aktif && kullanici?.aktif) x.kullanicilar = x.kullanicilar.map((k) => (k.id === kullanici.id ? { ...k, aktif: false } : k));
      islemYaz(x, ad, "Personel", `${tamAd(temiz)} kartı güncellendi${!temiz.aktif && p.aktif ? " (pasife alındı)" : ""}`, temiz.anaSubeId);
    });
    toast("Personel kartı kaydedildi.");
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      wide
      title={tamAd(p)}
      description={rolAdlari[p.gorev]}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>{duzenlenebilir ? "Vazgeç" : "Kapat"}</Button>
          {duzenlenebilir && <Button onClick={kaydet} disabled={!!hata}>Kaydet</Button>}
        </>
      }
    >
      <div className="grid gap-6">
        <div className="flex flex-wrap gap-3 text-sm">
          {p.telefon && <a href={`tel:${p.telefon.replace(/\s/g, "")}`} className="flex items-center gap-1.5 text-primary"><Phone className="size-4" /> {p.telefon}</a>}
          {p.eposta && <a href={`mailto:${p.eposta}`} className="flex items-center gap-1.5 text-primary"><Mail className="size-4" /> {p.eposta}</a>}
        </div>
        {hesapGorunur && (
          <Alert icon={<ShieldCheck />}>
            Kullanıcı hesabı:{" "}
            {kullanici ? (
              <>
                <b>{kullanici.eposta}</b> · {rolAdlari[kullanici.rol]} · {kullanici.aktif ? "aktif" : "pasif"}
              </>
            ) : (
              "yok"
            )}
            {rol === "genel-yonetici" && (
              <>
                {" "}— <Link to="/kullanicilar" className="underline">yetkileri düzenle</Link>
              </>
            )}
          </Alert>
        )}
        {p.gorev === "ogretmen" && (
          <div>
            <p className="mb-2 text-sm font-medium">
              Haftalık program · {dersListesi.length} ders ({Math.round((dk / 60) * 10) / 10} saat) · {gruplar.length} grup
            </p>
            <div className="grid gap-1.5">
              {dersListesi.map((x) => (
                <div key={x.id} className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm">
                  <span className="w-20 tabular-nums text-muted-foreground">{gunKisa[x.gun]} {saat(x.saatId)?.baslangic}</span>
                  <span className="flex-1">{grupEtiket(d, x.grupId)} · {dersAdi(x.dersId)}</span>
                </div>
              ))}
              {dersListesi.length === 0 && <p className="text-sm text-muted-foreground">Programda dersi yok.</p>}
            </div>
          </div>
        )}
        {duzenlenebilir ? (
          <>
            <PersonelForm f={f} setF={setF} ucretGorunur={ucretGorur(goren, p)} />
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Aktif</p>
                <p className="text-xs text-muted-foreground">Ayrılan personel pasife alınır; geçmiş kayıtlar korunur.</p>
              </div>
              <Switch label="Aktif" checked={f.aktif} onCheckedChange={(v) => setF({ ...f, aktif: v })} />
            </div>
            {hata && <Alert tone="warning">{hata}</Alert>}
          </>
        ) : (
          <Alert>Bu kartı yalnızca görüntüleyebilirsiniz; başka şubede de görevli personeli genel yönetici düzenler.</Alert>
        )}
      </div>
    </Sheet>
  );
}
