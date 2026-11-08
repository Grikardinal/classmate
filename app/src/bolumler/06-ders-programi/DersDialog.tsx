import * as React from "react";
import { AlertTriangle, Trash2, XCircle } from "lucide-react";
import { Alert, Button, Checkbox, Dialog, Field, Input, Select, toast } from "@/components/ui";
import { useOturum } from "@/context/AppContext";
import { gunAdlari, gunKisa } from "@/data/mock";
import { BUGUN, dersAdi, derslikAdi, grup, grupEtiket, guncelle, islemYaz, personelAdi, saat, sube, tanimlar, useDb, yeniId, type ProgramSatiri } from "@/data/store";
import { haftaGunu, tarihEkle } from "@/lib/kurallar";
import { pasifEki, secilebilirTanimlar, tanimAktif } from "@/bolumler/01-kurum-yapisi/kurallar";
import { bildirimGrubaDersDegisikligi, tarihKisa } from "./ortak";
import { OGRETMEN_SECILMELI, bransDisiAtayabilir, bransDisiOgretmenler, degisiklikDenetle, enErkenGecerlilik, programDegistir, uygunOgretmenler } from "./kurallar";

export function DersDialog({ satir, gun, saatId, grupId, onClose }: { satir?: ProgramSatiri; gun: number; saatId: string; grupId: string; onClose: () => void }) {
  const d = useDb();
  const { ad, rol } = useOturum();
  const yonetici = bransDisiAtayabilir(rol);
  const g = grup(d, grupId)!;
  const h = saat(saatId)!;
  // Pasif derslik seçeneklerde yok; satırın/grubun mevcut dersliği pasifse "(pasif)" ekiyle görünür kalır
  const subeDerslikleri = tanimlar().derslikler.filter((x) => x.subeId === g.subeId);
  const grupDersligi = subeDerslikleri.find((x) => x.id === g.derslikId);
  const ilkDerslik = satir?.derslikId ?? (!grupDersligi || tanimAktif(grupDersligi) ? g.derslikId : subeDerslikleri.find((x) => tanimAktif(x))?.id ?? g.derslikId);
  const derslikSecenekleri = secilebilirTanimlar(subeDerslikleri, ilkDerslik);
  // Yoklaması / iptali olan oturumlar satıra bağlı kalır; değişiklik en erken onlardan sonra başlar
  const enErken = satir ? enErkenGecerlilik(satir, d, BUGUN) : BUGUN;
  const sezonBasi = tanimlar().sezonlar.find((z) => z.id === g.sezonId)?.baslangic ?? enErken;
  const ilkGecerlilik = satir ? (satir.baslangic > enErken ? satir.baslangic : enErken) : sezonBasi > enErken ? sezonBasi : enErken;
  const [form, setForm] = React.useState({
    dersId: satir?.dersId ?? tanimlar().dersler.find((x) => x.aktif)?.id ?? "",
    ogretmenId: satir?.ogretmenId ?? "",
    derslikId: ilkDerslik,
    gecerlilik: ilkGecerlilik,
    gecisOnay: false,
    bildir: true,
  });
  const uygun = uygunOgretmenler(d.personel, form.dersId, g.subeId);
  // Satırın mevcut öğretmeni artık uygun değilse listede görünür; kayıtta engel gösterilir
  const listelenen = yonetici ? [...uygun, ...bransDisiOgretmenler(d.personel, form.dersId, g.subeId)] : uygun;
  const mevcutOgretmen = form.ogretmenId && !listelenen.some((p) => p.id === form.ogretmenId) ? d.personel.find((p) => p.id === form.ogretmenId) : undefined;
  const ogretmenSecenekleri = mevcutOgretmen ? [...listelenen, mevcutOgretmen] : listelenen;
  const bransDisi = (p: { dersIds: string[] }) => !p.dersIds.includes(form.dersId);
  const seciliBransDisi = yonetici && !!form.ogretmenId && ogretmenSecenekleri.some((p) => p.id === form.ogretmenId && bransDisi(p));
  const yeni: ProgramSatiri = { id: satir?.id ?? "yeni", grupId, gun, saatId, dersId: form.dersId, ogretmenId: form.ogretmenId, derslikId: form.derslikId, baslangic: form.gecerlilik, bitis: null };
  const sonuc = degisiklikDenetle(d, satir, yeni, form.gecerlilik, BUGUN, { bransDisi: yonetici });
  const cakismalar = form.ogretmenId ? sonuc.cakismalar : [];
  const gecisler = form.ogretmenId ? sonuc.gecisler : [];
  const { tarihEngeli } = sonuc;
  const atamaEngeli = sonuc.atamaEngeli === OGRETMEN_SECILMELI ? null : sonuc.atamaEngeli;
  const engel = !form.ogretmenId || !!tarihEngeli || !!atamaEngeli || cakismalar.length > 0 || (gecisler.length > 0 && !form.gecisOnay);

  const kaydet = () => {
    if (engel) return;
    guncelle((x) => {
      if (satir) x.program = programDegistir(x.program, satir, yeni, form.gecerlilik, () => yeniId("ps"));
      else x.program.push({ ...yeni, id: yeniId("ps") });
      islemYaz(x, ad, "Program", `${grupEtiket(x, grupId)}: ${gunKisa[gun]} ${h.baslangic} ${dersAdi(form.dersId)} (${personelAdi(x, form.ogretmenId)})`, g.subeId);
      if (satir && form.bildir) bildirimGrubaDersDegisikligi(x, grupId, `${gunAdlari[gun]} ${h.baslangic}`, dersAdi(form.dersId), "Ders programı güncellendi", form.gecerlilik);
    });
    // İlk geçerli oturum tarihi: geçerlilik başlangıcından sonraki ilk aynı gün
    let ilk = form.gecerlilik;
    while (haftaGunu(ilk) !== gun) ilk = tarihEkle(ilk, 1);
    toast(`${satir ? "Program güncellendi" : "Ders eklendi"}; ${tarihKisa(ilk)} ${gunAdlari[gun]} gününden itibaren geçerli.`);
    onClose();
  };
  const sil = () => {
    if (!satir || tarihEngeli) return;
    const eskiZaman = `${gunAdlari[satir.gun]} ${saat(satir.saatId)?.baslangic}`;
    guncelle((x) => {
      x.program = programDegistir(x.program, satir, null, form.gecerlilik, () => yeniId("ps"));
      islemYaz(x, ad, "Program", `${grupEtiket(x, grupId)}: ${gunKisa[satir.gun]} ${saat(satir.saatId)?.baslangic} ${dersAdi(satir.dersId)} kaldırıldı`, g.subeId);
      if (form.bildir) bildirimGrubaDersDegisikligi(x, grupId, eskiZaman, dersAdi(satir.dersId), "Ders programdan kaldırıldı", form.gecerlilik, "mevcut saat");
    });
    toast("Ders programdan kaldırıldı.");
    onClose();
  };

  const turAd = { ogretmen: "Öğretmen", derslik: "Derslik", grup: "Grup" };
  return (
    <Dialog
      open
      onClose={onClose}
      title={satir ? "Dersi düzenle" : "Ders ekle"}
      description={`${grupEtiket(d, grupId)} · ${gunAdlari[gun]} ${h.baslangic}–${h.bitis}`}
      footer={
        <>
          {satir && <Button variant="ghost" className="mr-auto text-danger" onClick={sil} disabled={!!tarihEngeli}><Trash2 /> Kaldır</Button>}
          <Button variant="outline" onClick={onClose}>Vazgeç</Button>
          <Button onClick={kaydet} disabled={engel}>Kaydet</Button>
        </>
      }
    >
      <Field label="Ders">
        <Select value={form.dersId} onChange={(e) => setForm({ ...form, dersId: e.target.value, ogretmenId: "" })}>
          {secilebilirTanimlar(tanimlar().dersler, satir?.dersId).map((x) => <option key={x.id} value={x.id}>{x.ad}{pasifEki(x)}</option>)}
        </Select>
      </Field>
      <Field label="Öğretmen" hint={uygun.length === 0 && !yonetici ? "Bu şubede bu dersi veren aktif öğretmen yok; personel kartından ders eklenebilir." : undefined}>
        <Select value={form.ogretmenId} onChange={(e) => setForm({ ...form, ogretmenId: e.target.value, gecisOnay: false })}>
          <option value="">Seçiniz</option>
          {ogretmenSecenekleri.map((p) => <option key={p.id} value={p.id}>{p.ad} {p.soyad}{bransDisi(p) ? " (branş dışı)" : ""}</option>)}
        </Select>
      </Field>
      <Field label="Derslik">
        <Select value={form.derslikId} onChange={(e) => setForm({ ...form, derslikId: e.target.value })}>
          {derslikSecenekleri.map((x) => <option key={x.id} value={x.id}>{x.ad} ({x.kapasite}){pasifEki(x)}</option>)}
        </Select>
      </Field>
      <Field label="Geçerlilik başlangıcı" hint="Değişiklik bu tarihten itibaren uygulanır; geçmiş oturumlar ve yoklamalar korunur.">
        <Input type="date" value={form.gecerlilik} min={enErken} onChange={(e) => setForm({ ...form, gecerlilik: e.target.value || enErken })} />
      </Field>
      {seciliBransDisi && (
        <Alert tone="warning" icon={<AlertTriangle />}>
          Seçilen öğretmen bu dersin branşında değil; yedek atama olarak kaydedilecek.
        </Alert>
      )}
      {tarihEngeli && (
        <Alert tone="danger" icon={<XCircle />}>
          {tarihEngeli}
        </Alert>
      )}
      {atamaEngeli && (
        <Alert tone="danger" icon={<XCircle />}>
          {atamaEngeli}
        </Alert>
      )}
      {cakismalar.map((c, i) => {
        const p = d.program.find((x) => x.id === c.slot.id)!;
        return (
          <Alert key={i} tone="danger" icon={<XCircle />}>
            <b>{turAd[c.tur]} çakışması:</b> {grupEtiket(d, p.grupId)} · {dersAdi(p.dersId)} · {personelAdi(d, p.ogretmenId)} · {derslikAdi(p.derslikId)}
          </Alert>
        );
      })}
      {gecisler.map((s) => {
        const p = d.program.find((x) => x.id === s.id)!;
        return (
          <Alert key={s.id} tone="warning" icon={<AlertTriangle />}>
            <p>
              <b>Şubeler arası geçiş:</b> öğretmenin {sube(s.subeId)?.ad} şubesinde {saat(p.saatId)?.baslangic}–{saat(p.saatId)?.bitis} dersi var; arada {d.ayarlar.subeGecisDk} dakikadan az süre kalıyor.
            </p>
            <div className="mt-2"><Checkbox checked={form.gecisOnay} onChange={(v) => setForm({ ...form, gecisOnay: v })} label="Yine de kaydet" /></div>
          </Alert>
        );
      })}
      {satir && <Checkbox checked={form.bildir} onChange={(v) => setForm({ ...form, bildir: v })} label="Grup velilerine değişiklik bildirimi gönder" />}
    </Dialog>
  );
}
