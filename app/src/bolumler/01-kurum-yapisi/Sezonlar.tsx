import * as React from "react";
import { AlertTriangle, ArrowRight, Plus } from "lucide-react";
import { Alert, Badge, Button, Card, CardDescription, CardHeader, CardTitle, Checkbox, Dialog, Field, Input, Select, Table, Td, Th, toast } from "@/components/ui";
import { useOturum } from "@/context/AppContext";
import { grupDoluluk, grupEtiket, guncelle, islemYaz, useDb, yeniId } from "@/data/store";
import { EN_YUKSEK_SEVIYE, grupAdiGecisi, sezonDogrula, sezonGecisEngeli, sezonGecisFiyatEngeli, sezonGecisHedefleri, sezonGecisiPlani } from "./kurallar";
import { HataMetni, tarihGoster, useGenel } from "./ortak";
import { ogrenciDurumu } from "../04-ogrenciler/kurallar";

const BOS_FORM = { ad: "", baslangic: "", bitis: "" };

export function Sezonlar() {
  const d = useDb();
  const genel = useGenel();
  const { ad } = useOturum();
  const [acik, setAcik] = React.useState(false);
  const [gecis, setGecis] = React.useState(false);
  const [form, setForm] = React.useState(BOS_FORM);
  const hata = sezonDogrula({ ad: form.ad.trim(), baslangic: form.baslangic, bitis: form.bitis }, d.sezonlar);
  const aktifVar = d.sezonlar.some((s) => s.aktif);

  const aktifYap = (id: string) =>
    guncelle((x) => {
      x.sezonlar = x.sezonlar.map((s) => ({ ...s, aktif: s.id === id }));
      islemYaz(x, ad, "Sezon", `Aktif sezon: ${x.sezonlar.find((s) => s.id === id)?.ad}`);
    });
  const ekle = () => {
    if (hata) return;
    const sezonAdi = form.ad.trim();
    guncelle((x) => {
      // İlk sezon tanımlanıyorsa aktif sezon olur (her zaman tam bir aktif sezon bulunur)
      x.sezonlar.push({ id: yeniId("z"), ad: sezonAdi, baslangic: form.baslangic, bitis: form.bitis, aktif: !x.sezonlar.some((s) => s.aktif) });
      islemYaz(x, ad, "Sezon", `${sezonAdi} sezonu eklendi`);
    });
    setForm(BOS_FORM);
    setAcik(false);
  };

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle>Sezonlar</CardTitle>
          <CardDescription className="mt-1">Kurum geneli: tüm şubeler aynı takvimi kullanır. Aynı anda tek aktif sezon olur.</CardDescription>
        </div>
        {genel && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={!aktifVar} onClick={() => setGecis(true)}><ArrowRight /> Yeni sezona geçiş</Button>
            <Button size="sm" onClick={() => setAcik(true)}><Plus /> Sezon ekle</Button>
          </div>
        )}
      </CardHeader>
      <Table>
        <thead><tr><Th>Sezon</Th><Th>Başlangıç</Th><Th>Bitiş</Th><Th className="text-right">Grup</Th><Th>Durum</Th><Th className="text-right">İşlem</Th></tr></thead>
        <tbody>
          {d.sezonlar.map((s) => (
            <tr key={s.id}>
              <Td className="font-medium">{s.ad}</Td>
              <Td>{tarihGoster(s.baslangic)}</Td>
              <Td>{tarihGoster(s.bitis)}</Td>
              <Td className="text-right tabular-nums">{d.gruplar.filter((g) => g.sezonId === s.id).length}</Td>
              <Td>{s.aktif ? <Badge variant="success">Aktif sezon</Badge> : <Badge variant="secondary">—</Badge>}</Td>
              <Td className="text-right">{!s.aktif && genel && <Button variant="outline" size="sm" onClick={() => aktifYap(s.id)}>Aktif yap</Button>}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <div className="flex items-start gap-2 p-4 text-xs text-muted-foreground">
        <AlertTriangle className="size-4 shrink-0 text-warning" />
        İçinde kayıt olan sezon silinemez. Yeni sezona geçişte gruplar kopyalanır ve seviye bir artırılır (8. sınıflar mezun olur).
      </div>

      <Dialog
        open={acik}
        onClose={() => setAcik(false)}
        title="Yeni sezon"
        description="Örn. 2027-2028 veya Yaz Okulu 2027"
        footer={<><Button variant="outline" onClick={() => setAcik(false)}>Vazgeç</Button><Button onClick={ekle} disabled={!!hata}>Ekle</Button></>}
      >
        <Field label="Sezon adı"><Input value={form.ad} onChange={(e) => setForm({ ...form, ad: e.target.value })} placeholder="2027-2028" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Başlangıç"><Input type="date" value={form.baslangic} onChange={(e) => setForm({ ...form, baslangic: e.target.value })} /></Field>
          <Field label="Bitiş"><Input type="date" value={form.bitis} onChange={(e) => setForm({ ...form, bitis: e.target.value })} /></Field>
        </div>
        <HataMetni hata={form.ad || form.baslangic || form.bitis ? hata : null} />
      </Dialog>
      {gecis && <SezonGecisi onClose={() => setGecis(false)} />}
    </Card>
  );
}

/** Önceki sezonun gruplarını kopyala + seviyeyi bir artır (öğrenciler 5'ten 6'ya geçer) */
function SezonGecisi({ onClose }: { onClose: () => void }) {
  const d = useDb();
  const { ad } = useOturum();
  const kaynak = d.sezonlar.find((s) => s.aktif);
  const hedefler = kaynak ? sezonGecisHedefleri(d.sezonlar, kaynak) : [];
  const [hedef, setHedef] = React.useState(hedefler[0]?.id ?? "");
  const [ogrenciTasi, setOgrenciTasi] = React.useState(true);
  const [aktifYap, setAktifYap] = React.useState(true);
  const kaynakGruplar = kaynak ? d.gruplar.filter((g) => g.sezonId === kaynak.id) : [];
  // Karar 2026-11-07: taşınan kayda hedef sezonun liste fiyatı uygulanır; fiyat tanımsızsa geçiş durur
  const engel = sezonGecisEngeli(d, kaynak?.id, hedef) ?? sezonGecisFiyatEngeli(d, kaynak?.id, hedef, ogrenciTasi);

  const uygula = () => {
    if (engel || !kaynak) return;
    const hedefAd = d.sezonlar.find((s) => s.id === hedef)?.ad ?? "";
    let sonuc = { grup: 0, ogrenci: 0 };
    guncelle((x) => {
      const plan = sezonGecisiPlani(x, kaynak.id, hedef, ogrenciTasi, yeniId);
      x.gruplar.push(...plan.gruplar);
      x.kayitlar.push(...plan.kayitlar);
      // En üst seviye mezun olur; başka sürmekte olan kaydı yoksa öğrenci de "mezun" (Bölüm 04 · ogrenciDurumu)
      const mezun = new Map(plan.mezunlar.map((k) => [k.id, k]));
      x.kayitlar = x.kayitlar.map((k) => mezun.get(k.id) ?? k);
      const mezunOgr = new Set(plan.mezunlar.map((k) => k.ogrenciId));
      x.ogrenciler = x.ogrenciler.map((o) => (mezunOgr.has(o.id) ? { ...o, durum: ogrenciDurumu(o.id, x.kayitlar) } : o));
      if (aktifYap) x.sezonlar = x.sezonlar.map((s) => ({ ...s, aktif: s.id === hedef }));
      sonuc = { grup: plan.gruplar.length, ogrenci: plan.kayitlar.length };
      islemYaz(x, ad, "Sezon geçişi", `${kaynak.ad} → ${hedefAd}: ${sonuc.grup} grup, ${sonuc.ogrenci} öğrenci, ${plan.mezunlar.length} mezun`);
    });
    toast(`Sezon geçişi tamamlandı: ${sonuc.grup} grup${ogrenciTasi ? `, ${sonuc.ogrenci} öğrenci` : ""}.`);
    onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      wide
      title="Yeni sezona geçiş"
      description={kaynak ? `Kaynak: ${kaynak.ad} (aktif sezon)` : "Aktif sezon yok"}
      footer={<><Button variant="outline" onClick={onClose}>Vazgeç</Button><Button onClick={uygula} disabled={!!engel}>Geçişi başlat</Button></>}
    >
      {!kaynak ? (
        <Alert tone="warning" icon={<AlertTriangle />}>Önce bir sezonu aktif yapın.</Alert>
      ) : hedefler.length === 0 ? (
        <Alert tone="warning" icon={<AlertTriangle />}>Önce “Sezon ekle” ile yeni sezonu tanımlayın.</Alert>
      ) : (
        <>
          <Field label="Hedef sezon">
            <Select value={hedef} onChange={(e) => setHedef(e.target.value)}>
              {hedefler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
            </Select>
          </Field>
          {engel && <Alert tone="warning" icon={<AlertTriangle />}>{engel}</Alert>}
          <div className="grid gap-1 rounded-md border p-3 text-sm">
            {kaynakGruplar.length === 0 && <p className="text-muted-foreground">Aktif sezonda grup yok.</p>}
            {kaynakGruplar.map((g) => (
              <p key={g.id} className="flex items-center gap-2">
                <span className="w-24">{grupEtiket(d, g.id)}</span>
                {g.seviye < EN_YUKSEK_SEVIYE ? <><ArrowRight className="size-3.5 text-muted-foreground" /> {grupAdiGecisi(g.ad, g.seviye + 1)} <span className="text-xs text-muted-foreground">({grupDoluluk(d, g.id)} öğrenci)</span></> : <Badge variant="secondary">Mezun</Badge>}
              </p>
            ))}
          </div>
          <Checkbox checked={ogrenciTasi} onChange={setOgrenciTasi} label="Aktif öğrencilerin kayıtlarını yeni gruplara taşı" description={`Yeni sözleşme numarası verilir. ${d.moduller.finans ? "Eski fiyat, indirim ve ek hizmet kopyalanmaz; hedef sezonun liste fiyatı uygulanır. " : ""}Ödeme planı ve KVKK onayı yeni sezonda yeniden alınmalıdır.`} />
          <Checkbox checked={aktifYap} onChange={setAktifYap} label="Hedef sezonu aktif sezon yap" />
          <p className="text-xs text-muted-foreground">{EN_YUKSEK_SEVIYE}. sınıf gruplarındaki kayıtlar “mezun” olarak işaretlenir; mezun kayıt geri alınamaz.</p>
        </>
      )}
    </Dialog>
  );
}
