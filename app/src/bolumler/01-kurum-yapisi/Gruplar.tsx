import * as React from "react";
import { Pencil, Plus, Users } from "lucide-react";
import { Alert, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Dialog, EmptyState, Field, Input, Select, Table, Td, Th } from "@/components/ui";
import { subeKodu, useApp, useOturum, useSubeFiltre } from "@/context/AppContext";
import { AKTIF_SEZON, derslikAdi, grupDoluluk, guncelle, islemYaz, personelAdi, useDb, yeniId, type Grup } from "@/data/store";
import { cn } from "@/lib/utils";
import { grupDogrula, kapasiteDuzelt, SEVIYELER } from "./kurallar";
import { HataMetni, useSubeTanimYazar } from "./ortak";

export function Gruplar() {
  const filtre = useSubeFiltre();
  const { subeId } = useApp();
  const { kapsam, ad } = useOturum();
  const yazabilir = useSubeTanimYazar();
  const d = useDb();
  const [seviye, setSeviye] = React.useState<number | "all">("all");
  const [duzenle, setDuzenle] = React.useState<Grup | "yeni" | null>(null);
  const aktifSezon = d.sezonlar.find((s) => s.aktif);
  if (!aktifSezon) return <Alert>Önce Sezonlar sekmesinden bir aktif sezon seçin.</Alert>;
  const gorunen = d.gruplar.filter((g) => g.sezonId === aktifSezon.id && filtre(g.subeId) && (seviye === "all" || g.seviye === seviye));
  const varsayilanSube = subeId !== "all" && kapsam.includes(subeId) ? subeId : kapsam[0] ?? "";

  const kaydet = (g: Grup) => {
    const yeni = duzenle === "yeni";
    const id = yeni ? yeniId("g") : g.id;
    guncelle((x) => {
      if (yeni) x.gruplar.push({ ...g, id, sezonId: aktifSezon.id });
      else x.gruplar = x.gruplar.map((y) => (y.id === g.id ? { ...y, ...g } : y));
      islemYaz(x, ad, "Grup", `${subeKodu(x, g.subeId)} ${g.ad} ${yeni ? "eklendi" : "güncellendi"}`, g.subeId);
    });
    setDuzenle(null);
  };

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle>Gruplar · {aktifSezon.ad}</CardTitle>
          <CardDescription className="mt-1">Doluluk dolunca kayıtta uyarı verilir; yönetici onayıyla aşılabilir.</CardDescription>
        </div>
        <div className="flex gap-2">
          <Select aria-label="Seviye" className="w-40" value={seviye} onChange={(e) => setSeviye(e.target.value === "all" ? "all" : Number(e.target.value))}>
            <option value="all">Tüm seviyeler</option>
            {SEVIYELER.map((s) => <option key={s} value={s}>{s}. sınıf</option>)}
          </Select>
          {yazabilir && varsayilanSube && <Button size="sm" className="h-9" onClick={() => setDuzenle("yeni")}><Plus /> Grup</Button>}
        </div>
      </CardHeader>
      {gorunen.length === 0 ? (
        <CardContent><EmptyState icon={<Users />} title="Grup yok" text="Bu şube ve seviye için henüz grup tanımlanmamış." /></CardContent>
      ) : (
        <Table>
          <thead><tr><Th>Grup</Th><Th>Seviye</Th><Th>Derslik</Th><Th>Rehber öğretmen</Th><Th className="w-48">Doluluk</Th><Th /></tr></thead>
          <tbody>
            {gorunen.map((g) => {
              const kayitli = grupDoluluk(d, g.id);
              const oran = g.kapasite > 0 ? kayitli / g.kapasite : 1;
              return (
                <tr key={g.id}>
                  <Td className="font-medium"><span className="mr-1.5 font-mono text-xs text-muted-foreground">{subeKodu(d, g.subeId)}</span>{g.ad}</Td>
                  <Td>{g.seviye}. sınıf</Td>
                  <Td>{g.derslikId ? derslikAdi(g.derslikId) : "—"}</Td>
                  <Td>{g.rehberId ? personelAdi(d, g.rehberId) : "—"}</Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className={cn("h-full rounded-full", oran >= 1 ? "bg-danger" : oran >= 0.8 ? "bg-warning" : "bg-primary")} style={{ width: `${Math.min(oran, 1) * 100}%` }} />
                      </div>
                      <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">{kayitli}/{g.kapasite}</span>
                    </div>
                  </Td>
                  <Td className="text-right">{yazabilir && <Button variant="ghost" size="icon" aria-label="Düzenle" onClick={() => setDuzenle(g)}><Pencil /></Button>}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
      {duzenle && (
        <GrupDialog
          grup={duzenle === "yeni" ? undefined : duzenle}
          varsayilanSube={varsayilanSube}
          sezonId={aktifSezon.id}
          onClose={() => setDuzenle(null)}
          onKaydet={kaydet}
        />
      )}
    </Card>
  );
}

function GrupDialog({ grup, varsayilanSube, sezonId, onClose, onKaydet }: { grup?: Grup; varsayilanSube: string; sezonId: string; onClose: () => void; onKaydet: (g: Grup) => void }) {
  const d = useDb();
  const { kapsam } = useOturum();
  const [f, setF] = React.useState<Grup>(grup ?? { id: "", subeId: varsayilanSube, sezonId: sezonId || AKTIF_SEZON, seviye: 5, ad: "", kapasite: 14, derslikId: "", rehberId: "" });
  const [kapasiteMetni, setKapasiteMetni] = React.useState(String(f.kapasite));
  const ogretmenler = d.personel.filter((p) => p.gorev === "ogretmen" && p.aktif && p.subeIds.includes(f.subeId));
  const derslikler = d.derslikler.filter((x) => x.subeId === f.subeId);
  const kayitli = grup ? grupDoluluk(d, grup.id) : 0;
  const temiz: Grup = { ...f, ad: f.ad.trim() };
  const hata = grupDogrula(temiz, d);
  const mevcutRehberListede = !f.rehberId || ogretmenler.some((p) => p.id === f.rehberId);
  return (
    <Dialog
      open
      onClose={onClose}
      title={grup ? `${grup.ad} — düzenle` : "Yeni grup"}
      footer={<><Button variant="outline" onClick={onClose}>Vazgeç</Button><Button onClick={() => onKaydet(temiz)} disabled={!!hata}>Kaydet</Button></>}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Şube">
          <Select value={f.subeId} disabled={!!grup} onChange={(e) => setF({ ...f, subeId: e.target.value, derslikId: "", rehberId: "" })}>
            {d.subeler.filter((s) => (s.aktif && kapsam.includes(s.id)) || s.id === f.subeId).map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
          </Select>
        </Field>
        <Field label="Seviye" hint={grup && kayitli > 0 ? "Kayıtlı öğrencisi olan grubun seviyesi değişmez." : undefined}>
          <Select value={f.seviye} disabled={!!grup && kayitli > 0} onChange={(e) => setF({ ...f, seviye: Number(e.target.value) })}>
            {SEVIYELER.map((s) => <option key={s} value={s}>{s}. sınıf</option>)}
          </Select>
        </Field>
        <Field label="Grup adı">
          <Input value={f.ad} onChange={(e) => setF({ ...f, ad: e.target.value })} placeholder={`${f.seviye}-B`} />
        </Field>
        <Field label="Kapasite" hint={kayitli > f.kapasite ? `Kayıtlı ${kayitli} öğrenci var; kapasite altında kalıyor.` : undefined}>
          <Input
            type="number"
            min={1}
            step={1}
            value={kapasiteMetni}
            onChange={(e) => {
              setKapasiteMetni(e.target.value);
              setF({ ...f, kapasite: e.target.value === "" ? 0 : Number(e.target.value) });
            }}
            onBlur={() => {
              const k = kapasiteDuzelt(kapasiteMetni);
              setKapasiteMetni(String(k));
              setF({ ...f, kapasite: k });
            }}
          />
        </Field>
      </div>
      <Field label="Varsayılan derslik">
        <Select value={f.derslikId} onChange={(e) => setF({ ...f, derslikId: e.target.value })}>
          <option value="">Seçilmedi</option>
          {derslikler.map((x) => <option key={x.id} value={x.id}>{x.ad} ({x.kapasite})</option>)}
        </Select>
      </Field>
      <Field label="Rehber öğretmen" hint={mevcutRehberListede ? undefined : `Mevcut rehber (${personelAdi(d, f.rehberId)}) artık bu şubede aktif değil.`}>
        <Select value={mevcutRehberListede ? f.rehberId : ""} onChange={(e) => setF({ ...f, rehberId: e.target.value })}>
          <option value="">Seçilmedi</option>
          {ogretmenler.map((p) => <option key={p.id} value={p.id}>{p.ad} {p.soyad}</option>)}
        </Select>
      </Field>
      <HataMetni hata={f.ad || grup ? hata : null} />
    </Dialog>
  );
}
