import * as React from "react";
import { Alert, Button, Checkbox, Dialog, toast } from "@/components/ui";
import { useOturum } from "@/context/AppContext";
import { BUGUN, guncelle, islemYaz, rolAdlari, useDb, yeniId, type Personel } from "@/data/store";
import { epostaDogrula } from "../02-kullanicilar/kurallar";
import { personelTemizle, personelYazmaEngeli } from "./kurallar";
import { PersonelForm } from "./PersonelForm";

export function PersonelEkle({ open, onClose }: { open: boolean; onClose: () => void }) {
  const d = useDb();
  const { ad, kapsam, rol, personel: ben } = useOturum();
  const bos = (): Personel => ({
    id: "", ad: "", soyad: "", gorev: "ogretmen", telefon: "", eposta: "", subeIds: kapsam.slice(0, 1), anaSubeId: kapsam[0] ?? "", dersIds: [],
    baslangic: BUGUN, aktif: true, ucretTipi: "ders", dersUcreti: 0, sabitUcret: 0,
  });
  const [f, setF] = React.useState(bos);
  const [hesap, setHesap] = React.useState(true);
  const temiz = personelTemizle(f);
  const baslandi = !!(f.ad.trim() || f.soyad.trim() || f.telefon.trim() || f.eposta.trim());
  const hata = personelYazmaEngeli(temiz, undefined, d, { rol, personelId: ben.id }, BUGUN) ?? (hesap ? epostaDogrula(temiz.eposta, d.kullanicilar) : null);
  const kaydet = () => {
    if (hata) return;
    const pid = yeniId("p");
    guncelle((x) => {
      x.personel.push({ ...temiz, id: pid });
      if (hesap)
        x.kullanicilar.push({
          id: yeniId("u"), personelId: pid, rol: temiz.gorev, subeIds: temiz.gorev === "genel-yonetici" ? "all" : temiz.subeIds, eposta: temiz.eposta,
          aktif: true, sonGiris: null, ikiAdim: false,
        });
      islemYaz(x, ad, "Personel", `${temiz.ad} ${temiz.soyad} (${rolAdlari[temiz.gorev]}) eklendi`, temiz.anaSubeId);
    });
    toast(hesap ? "Personel eklendi. Parolayı Bölüm 02 üzerinden “Parola sıfırla” ile oluşturun." : "Personel eklendi.");
    setF(bos());
    onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      wide
      title="Personel ekle"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Vazgeç</Button>
          <Button onClick={kaydet} disabled={!!hata}>Ekle</Button>
        </>
      }
    >
      <PersonelForm f={f} setF={setF} ucretGorunur />
      <Checkbox checked={hesap} onChange={setHesap} label="Kullanıcı hesabı da oluştur (Bölüm 02)" description="Rol = görev, şube kapsamı = bağlı şubeler" />
      {baslandi && hata && <Alert tone="warning">{hata}</Alert>}
    </Dialog>
  );
}
