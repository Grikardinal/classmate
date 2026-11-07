/**
 * Personel hesapları: liste, kullanıcı ekle/düzenle, geçici parola.
 * Kurallar sunucuyla ortaktır (kurallar.ts); sunucu son sözü söyler (server/politika.ts · kullaniciDenetle).
 */
import * as React from "react";
import { KeyRound, Lock, Plus, Search, ShieldCheck } from "lucide-react";
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Dialog,
  Field,
  Input,
  Select,
  Sheet,
  Switch,
  Table,
  Td,
  Th,
  toast,
} from "@/components/ui";
import { useOturum } from "@/context/AppContext";
import { BUGUN, guncelle, islemYaz, rolAdlari, senkron, tamAd, useDb, veriYukle, yeniId, type Kullanici, type Rol } from "@/data/store";
import { telefonNormalize } from "@/lib/kurallar";
import { api } from "@/lib/api";
import {
  atanabilirRoller,
  epostaDogrula,
  epostaNormalize,
  kapsamDuzelt,
  kendiHesabiEngeli,
  kullaniciDogrula,
  rolAtamaEngeli,
  type Hata,
} from "./kurallar";
import { kapsamMetni, useHesapYonetimi, zamanBicim } from "./ortak";

export function PersonelHesaplari() {
  const d = useDb();
  const yonetim = useHesapYonetimi();
  const [rolFiltre, setRolFiltre] = React.useState<Rol | "all">("all");
  const [durumFiltre, setDurumFiltre] = React.useState<"aktif" | "pasif" | "all">("aktif");
  const [ara, setAra] = React.useState("");
  const [duzenlenen, setDuzenlenen] = React.useState<Kullanici | null>(null);
  const [yeniAcik, setYeniAcik] = React.useState(false);

  const q = ara.trim().toLocaleLowerCase("tr");
  const liste = d.kullanicilar.filter((k) => {
    const p = d.personel.find((x) => x.id === k.personelId);
    if (rolFiltre !== "all" && k.rol !== rolFiltre) return false;
    if (durumFiltre !== "all" && (durumFiltre === "aktif") !== k.aktif) return false;
    return !q || tamAd(p).toLocaleLowerCase("tr").includes(q) || epostaNormalize(k.eposta).includes(epostaNormalize(q));
  });

  const [gecici, setGecici] = React.useState<{ ad: string; eposta: string; parola: string } | null>(null);
  const parolaSifirla = async (k: Kullanici) => {
    const p = d.personel.find((x) => x.id === k.personelId);
    try {
      await senkron();
      const r = await api<{ parola: string }>(`/api/kullanicilar/${k.id}/parola-sifirla`, {});
      setGecici({ ad: tamAd(p), eposta: k.eposta, parola: r.parola });
      void veriYukle();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Parola sıfırlanamadı.", "hata");
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle>Personel hesapları</CardTitle>
          <CardDescription className="mt-1">Ayrılan personelin hesabı silinmez, pasife alınır; geçmiş kayıtlar bozulmaz.</CardDescription>
        </div>
        <Button size="sm" onClick={() => setYeniAcik(true)}>
          <Plus /> Kullanıcı ekle
        </Button>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2 pb-4">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="İsim veya e-posta ara" className="pl-8" value={ara} onChange={(e) => setAra(e.target.value)} />
        </div>
        <Select aria-label="Rol" className="w-44" value={rolFiltre} onChange={(e) => setRolFiltre(e.target.value as Rol | "all")}>
          <option value="all">Tüm roller</option>
          {Object.entries(rolAdlari).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </Select>
        <Select aria-label="Durum" className="w-32" value={durumFiltre} onChange={(e) => setDurumFiltre(e.target.value as typeof durumFiltre)}>
          <option value="aktif">Aktif</option>
          <option value="pasif">Pasif</option>
          <option value="all">Tümü</option>
        </Select>
      </CardContent>
      <Table>
        <thead>
          <tr>
            <Th>Kullanıcı</Th>
            <Th>Rol</Th>
            <Th>Şube kapsamı</Th>
            <Th>Son giriş</Th>
            <Th>Durum</Th>
            <Th className="text-right">İşlem</Th>
          </tr>
        </thead>
        <tbody>
          {liste.map((k) => {
            const p = d.personel.find((x) => x.id === k.personelId);
            const engel = yonetim.yonetimEngeli(k);
            const sifirlamaEngeli = yonetim.sifirlamaEngeli(k);
            return (
              <tr key={k.id}>
                <Td>
                  <div className="flex items-center gap-3">
                    <Avatar ad={tamAd(p)} className="size-8" />
                    <div>
                      <p className="font-medium">{tamAd(p)}</p>
                      <p className="text-xs text-muted-foreground">{k.eposta}</p>
                    </div>
                  </div>
                </Td>
                <Td>{rolAdlari[k.rol]}</Td>
                <Td className="font-mono text-xs">{kapsamMetni(k)}</Td>
                <Td className="text-muted-foreground">{zamanBicim(k.sonGiris)}</Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant={k.aktif ? "success" : "secondary"}>{k.aktif ? "Aktif" : "Pasif"}</Badge>
                    {k.ikiAdim && <Badge variant="outline"><Lock className="size-3" /> 2FA</Badge>}
                  </div>
                </Td>
                <Td className="text-right">
                  <div className="flex justify-end gap-1">
                    {!sifirlamaEngeli && (
                      <Button variant="ghost" size="sm" onClick={() => parolaSifirla(k)} title="Parola sıfırla" aria-label={`${tamAd(p)} parolasını sıfırla`}>
                        <KeyRound />
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setDuzenlenen(k)} disabled={!!engel || !p} title={engel ?? undefined}>
                      Düzenle
                    </Button>
                  </div>
                </Td>
              </tr>
            );
          })}
          {liste.length === 0 && (
            <tr>
              <Td colSpan={6} className="text-center text-muted-foreground">Bu filtreye uyan kullanıcı yok.</Td>
            </tr>
          )}
        </tbody>
      </Table>
      {duzenlenen && <KullaniciDuzenle k={duzenlenen} onClose={() => setDuzenlenen(null)} />}
      <YeniKullanici open={yeniAcik} onClose={() => setYeniAcik(false)} onOlustu={(k) => void parolaSifirla(k)} />
      <Dialog
        open={!!gecici}
        onClose={() => setGecici(null)}
        title="Geçici parola"
        description="Bu parola yalnızca şimdi gösterilir. Kullanıcıya güvenli bir yoldan iletin; ilk girişte kendi parolasını belirlemesi istenir."
        footer={<Button onClick={() => setGecici(null)}>Tamam</Button>}
      >
        {gecici && (
          <div className="grid gap-2 text-sm">
            <p><span className="text-muted-foreground">Kullanıcı:</span> {gecici.ad} · {gecici.eposta}</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md bg-muted px-3 py-2 text-center font-mono text-lg tracking-wider">{gecici.parola}</code>
              <Button variant="outline" size="sm" onClick={() => navigator.clipboard?.writeText(gecici.parola).then(() => toast("Kopyalandı."))}>Kopyala</Button>
            </div>
            <p className="text-xs text-muted-foreground">Kullanıcının açık oturumları kapatıldı.</p>
          </div>
        )}
      </Dialog>
    </Card>
  );
}

function SubeKapsamSecimi({ rol, deger, onChange, disabled }: { rol: Rol; deger: string[] | "all"; onChange: (v: string[]) => void; disabled?: boolean }) {
  const { secilebilirSubeler } = useHesapYonetimi();
  if (rol === "genel-yonetici") return <Alert icon={<ShieldCheck />}>Genel yönetici tüm şubeleri kapsar.</Alert>;
  const secili = deger === "all" ? secilebilirSubeler.map((s) => s.id) : deger;
  return (
    <fieldset disabled={disabled} className="grid gap-2 rounded-md border p-3 disabled:opacity-60">
      {secilebilirSubeler.map((s) => (
        <Checkbox
          key={s.id}
          checked={secili.includes(s.id)}
          onChange={(v) => onChange(v ? [...secili.filter((x) => x !== s.id), s.id] : secili.filter((x) => x !== s.id))}
          label={`${s.ad} (${s.kod})`}
          description={s.aktif ? undefined : "Pasif şube"}
        />
      ))}
    </fieldset>
  );
}

type Form = { rol: Rol; subeIds: string[] | "all"; aktif: boolean; ikiAdim: boolean; eposta: string };

function KullaniciDuzenle({ k, onClose }: { k: Kullanici; onClose: () => void }) {
  const d = useDb();
  const { ad: oturumAd, kullanici: oturum } = useOturum();
  const yonetim = useHesapYonetimi();
  const p = d.personel.find((x) => x.id === k.personelId);
  const [form, setForm] = React.useState<Form>({ rol: k.rol, subeIds: k.subeIds, aktif: k.aktif, ikiAdim: k.ikiAdim, eposta: k.eposta });
  const kendisi = oturum.id === k.id;
  const tumSubeler = d.subeler.map((s) => s.id);
  const roller = [...new Set([...atanabilirRoller(oturum.rol), k.rol])];

  const yeni: Kullanici = { ...k, ...form, eposta: epostaNormalize(form.eposta), subeIds: kapsamDuzelt(form.rol, form.subeIds, tumSubeler) };
  const hata: Hata =
    kullaniciDogrula(yeni, d) ??
    rolAtamaEngeli(oturum.rol, yeni.rol) ??
    (kendisi ? kendiHesabiEngeli(k, yeni) : null) ??
    yonetim.yonetimEngeli(yeni);

  const rolDegis = (rol: Rol) =>
    // Genel yöneticiden başka role geçince "tüm şubeler" seçili şube listesine çevrilir (aksi halde form geçersiz kalıyordu)
    setForm({ ...form, rol, subeIds: kapsamDuzelt(rol, form.subeIds, yonetim.secilebilirSubeler.map((s) => s.id)) });

  const kaydet = () => {
    if (hata || !p) return;
    guncelle((x) => {
      x.kullanicilar = x.kullanicilar.map((u) => (u.id === k.id ? yeni : u));
      x.personel = x.personel.map((pp) => (pp.id === p.id ? { ...pp, aktif: yeni.aktif, gorev: yeni.rol } : pp));
      const degisen: string[] = [];
      if (yeni.rol !== k.rol) degisen.push(`rol: ${rolAdlari[k.rol]} → ${rolAdlari[yeni.rol]}`);
      if (JSON.stringify(yeni.subeIds) !== JSON.stringify(k.subeIds)) degisen.push(`şube kapsamı: ${kapsamMetni(k)} → ${kapsamMetni(yeni)}`);
      if (yeni.aktif !== k.aktif) degisen.push(yeni.aktif ? "aktifleştirildi" : "pasife alındı");
      if (yeni.ikiAdim !== k.ikiAdim) degisen.push(`iki adımlı doğrulama ${yeni.ikiAdim ? "açıldı" : "kapatıldı"}`);
      if (yeni.eposta !== epostaNormalize(k.eposta)) degisen.push(`e-posta: ${k.eposta} → ${yeni.eposta}`);
      if (degisen.length) islemYaz(x, oturumAd, "Yetki", `${tamAd(p)}: ${degisen.join(", ")}`);
    });
    toast("Kullanıcı güncellendi.");
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={tamAd(p)}
      description={k.eposta}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Vazgeç</Button>
          <Button onClick={kaydet} disabled={!!hata || !p}>Kaydet</Button>
        </>
      }
    >
      <div className="grid gap-5">
        <Field label="E-posta (giriş)">
          <Input type="email" value={form.eposta} onChange={(e) => setForm({ ...form, eposta: e.target.value })} />
        </Field>
        <Field label="Rol">
          <Select value={form.rol} disabled={kendisi} onChange={(e) => rolDegis(e.target.value as Rol)}>
            {roller.map((r) => (
              <option key={r} value={r}>{rolAdlari[r]}</option>
            ))}
          </Select>
        </Field>
        <div className="grid gap-1.5">
          <span className="text-sm font-medium">Şube kapsamı</span>
          <SubeKapsamSecimi rol={form.rol} deger={form.subeIds} disabled={kendisi} onChange={(v) => setForm({ ...form, subeIds: v })} />
        </div>
        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <p className="text-sm font-medium">İki adımlı doğrulama</p>
            <p className="text-xs text-muted-foreground">Girişte SMS kodu da istenir.</p>
          </div>
          <Switch label="İki adımlı doğrulama" checked={form.ikiAdim} onCheckedChange={(v) => setForm({ ...form, ikiAdim: v })} />
        </div>
        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <p className="text-sm font-medium">Hesap aktif</p>
            <p className="text-xs text-muted-foreground">Pasif hesap giriş yapamaz, açık oturumları kapanır; geçmiş kayıtlar korunur.</p>
          </div>
          <Switch label="Hesap aktif" checked={form.aktif} disabled={kendisi} onCheckedChange={(v) => setForm({ ...form, aktif: v })} />
        </div>
        {kendisi && <p className="text-xs text-muted-foreground">Kendi rolünüzü ve şube kapsamınızı değiştiremez, hesabınızı pasife alamazsınız.</p>}
        {hata && <p className="text-xs text-danger" role="alert">{hata}</p>}
      </div>
    </Sheet>
  );
}

function YeniKullanici({ open, onClose, onOlustu }: { open: boolean; onClose: () => void; onOlustu: (k: Kullanici) => void }) {
  const d = useDb();
  const { ad: oturumAd, rol: oturumRol } = useOturum();
  const yonetim = useHesapYonetimi();
  const roller = atanabilirRoller(oturumRol);
  const bos = () => ({
    ad: "", soyad: "", eposta: "", telefon: "",
    rol: (roller.includes("sekreter") ? "sekreter" : roller[roller.length - 1]) as Rol,
    subeIds: yonetim.secilebilirSubeler.slice(0, 1).map((s) => s.id) as string[] | "all",
  });
  const [form, setForm] = React.useState(bos);
  const tel = telefonNormalize(form.telefon);
  const eposta = epostaNormalize(form.eposta);
  const subeIds = kapsamDuzelt(form.rol, form.subeIds, d.subeler.map((s) => s.id));
  const epostaHatasi = form.eposta ? epostaDogrula(eposta, d.kullanicilar) : null;
  const kuralHatasi: Hata =
    rolAtamaEngeli(oturumRol, form.rol) ??
    (form.rol !== "genel-yonetici" && !(subeIds as string[]).length ? "En az bir şube seçilmeli." : null) ??
    (form.rol !== "genel-yonetici" ? yonetim.yonetimEngeli({ id: "", personelId: "", rol: form.rol, subeIds, eposta, aktif: true, sonGiris: null, ikiAdim: false }) : null);
  const gecerli = !!form.ad.trim() && !!form.soyad.trim() && !!form.eposta && !epostaHatasi && !!tel && !kuralHatasi;

  const ekle = () => {
    if (!gecerli) return;
    const pid = yeniId("p");
    const uid = yeniId("u");
    const personelSubeleri = subeIds === "all" ? d.subeler.map((s) => s.id) : subeIds;
    const yeni: Kullanici = { id: uid, personelId: pid, rol: form.rol, subeIds, eposta, aktif: true, sonGiris: null, ikiAdim: form.rol === "genel-yonetici" };
    guncelle((x) => {
      x.personel.push({
        id: pid, ad: form.ad.trim(), soyad: form.soyad.trim(), gorev: form.rol, telefon: tel!, eposta, subeIds: personelSubeleri, anaSubeId: personelSubeleri[0],
        dersIds: [], baslangic: BUGUN, aktif: true, ucretTipi: "sabit", dersUcreti: 0, sabitUcret: 0,
      });
      x.kullanicilar.push(yeni);
      islemYaz(x, oturumAd, "Kullanıcı", `${form.ad.trim()} ${form.soyad.trim()} (${rolAdlari[form.rol]}) eklendi`);
    });
    toast(`${form.ad.trim()} ${form.soyad.trim()} eklendi; geçici parola oluşturuluyor…`);
    onOlustu(yeni);
    setForm(bos());
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Yeni kullanıcı"
      description="Personel kartı da otomatik oluşturulur (bkz. Bölüm 13)."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Vazgeç</Button>
          <Button onClick={ekle} disabled={!gecerli}>Ekle</Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Ad"><Input value={form.ad} onChange={(e) => setForm({ ...form, ad: e.target.value })} /></Field>
        <Field label="Soyad"><Input value={form.soyad} onChange={(e) => setForm({ ...form, soyad: e.target.value })} /></Field>
      </div>
      <Field label="E-posta" hint={epostaHatasi ?? undefined}>
        <Input type="email" value={form.eposta} onChange={(e) => setForm({ ...form, eposta: e.target.value })} />
      </Field>
      <Field label="Telefon" hint={form.telefon && !tel ? "Geçerli bir cep telefonu girin (05xx…)" : undefined}>
        <Input value={form.telefon} onChange={(e) => setForm({ ...form, telefon: e.target.value })} placeholder="05xx xxx xx xx" />
      </Field>
      <Field label="Rol">
        <Select value={form.rol} onChange={(e) => { const rol = e.target.value as Rol; setForm({ ...form, rol, subeIds: kapsamDuzelt(rol, form.subeIds, yonetim.secilebilirSubeler.map((s) => s.id)) }); }}>
          {roller.map((r) => (
            <option key={r} value={r}>{rolAdlari[r]}</option>
          ))}
        </Select>
      </Field>
      <SubeKapsamSecimi rol={form.rol} deger={form.subeIds} onChange={(v) => setForm({ ...form, subeIds: v })} />
      {kuralHatasi && <p className="text-xs text-danger" role="alert">{kuralHatasi}</p>}
    </Dialog>
  );
}
