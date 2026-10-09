/**
 * Bölüm 02 · Kullanıcılar, roller ve yetkiler
 * Doküman: docs/bolumler/02-kullanicilar-ve-yetkiler.md
 */
import * as React from "react";
import { KeyRound, Lock, Plus, Search, ShieldCheck, Smartphone, UserCog, Users, History, Send } from "lucide-react";
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
  PageHeader,
  Select,
  Sheet,
  Switch,
  Table,
  Tabs,
  Td,
  Th,
  toast,
} from "@/components/ui";
import { useOturum } from "@/context/AppContext";
import { tanimlar } from "@/data/store";
import {
  BUGUN,
  bildirimEkle,
  senkron,
  veriYukle,
  guncelle,
  islemYaz,
  rolAdlari,
  tamAd,
  useDb,
  yeniId,
  type Kullanici,
  type Rol,
} from "@/data/store";
import { bolumler } from "./registry";
import { telefonNormalize } from "@/lib/kurallar";
import { api } from "@/lib/api";

type Sekme = "personel" | "veli" | "roller" | "giris";

const zamanBicim = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

export default function Kullanicilar() {
  const [sekme, setSekme] = React.useState<Sekme>("personel");
  return (
    <div className="grid gap-6">
      <PageHeader
        code="02"
        title="Kullanıcılar ve yetkiler"
        description="Yetki = rol + şube kapsamı. Her kullanıcı yalnızca kendi şube(ler)inin verisini görür."
      />
      <Tabs
        value={sekme}
        onChange={setSekme}
        items={[
          { value: "personel", label: "Personel hesapları", icon: <UserCog /> },
          { value: "veli", label: "Veli hesapları", icon: <Users /> },
          { value: "roller", label: "Rol yetkileri", icon: <ShieldCheck /> },
          { value: "giris", label: "Giriş geçmişi", icon: <History /> },
        ]}
      />
      {sekme === "personel" && <PersonelHesaplari />}
      {sekme === "veli" && <VeliHesaplari />}
      {sekme === "roller" && <RolYetkileri />}
      {sekme === "giris" && <GirisGecmisi />}
    </div>
  );
}

function kapsamMetni(k: Kullanici) {
  return k.subeIds === "all" ? "Tüm şubeler" : k.subeIds.map((s) => tanimlar().subeler.find((x) => x.id === s)?.kod).join(", ");
}

/* ---------- Personel hesapları ---------- */
function PersonelHesaplari() {
  const d = useDb();
  const [rolFiltre, setRolFiltre] = React.useState<Rol | "all">("all");
  const [durumFiltre, setDurumFiltre] = React.useState<"aktif" | "pasif" | "all">("aktif");
  const [ara, setAra] = React.useState("");
  const [duzenlenen, setDuzenlenen] = React.useState<Kullanici | null>(null);
  const [yeniAcik, setYeniAcik] = React.useState(false);

  const liste = d.kullanicilar.filter((k) => {
    const p = d.personel.find((x) => x.id === k.personelId);
    if (rolFiltre !== "all" && k.rol !== rolFiltre) return false;
    if (durumFiltre !== "all" && (durumFiltre === "aktif") !== k.aktif) return false;
    return !ara || tamAd(p).toLocaleLowerCase("tr").includes(ara.toLocaleLowerCase("tr"));
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
          <Input placeholder="İsim ara" className="pl-8" value={ara} onChange={(e) => setAra(e.target.value)} />
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
                    <Button variant="ghost" size="sm" onClick={() => parolaSifirla(k)} title="Parola sıfırla">
                      <KeyRound />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setDuzenlenen(k)}>
                      Düzenle
                    </Button>
                  </div>
                </Td>
              </tr>
            );
          })}
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

function SubeKapsamSecimi({ rol, deger, onChange }: { rol: Rol; deger: string[] | "all"; onChange: (v: string[] | "all") => void }) {
  if (rol === "genel-yonetici")
    return <Alert icon={<ShieldCheck />}>Genel yönetici tüm şubeleri kapsar.</Alert>;
  const secili = deger === "all" ? tanimlar().subeler.map((s) => s.id) : deger;
  return (
    <div className="grid gap-2 rounded-md border p-3">
      {tanimlar().subeler.map((s) => (
        <Checkbox
          key={s.id}
          checked={secili.includes(s.id)}
          onChange={(v) => onChange(v ? [...secili, s.id] : secili.filter((x) => x !== s.id))}
          label={`${s.ad} (${s.kod})`}
          description={s.aktif ? undefined : "Pasif şube"}
        />
      ))}
    </div>
  );
}

function KullaniciDuzenle({ k, onClose }: { k: Kullanici; onClose: () => void }) {
  const d = useDb();
  const { ad: oturumAd, kullanici: oturum } = useOturum();
  const p = d.personel.find((x) => x.id === k.personelId)!;
  const [form, setForm] = React.useState({ rol: k.rol, subeIds: k.subeIds, aktif: k.aktif, ikiAdim: k.ikiAdim, eposta: k.eposta });
  const kendisi = oturum.id === k.id;
  const gecerli = form.rol === "genel-yonetici" || (Array.isArray(form.subeIds) && form.subeIds.length > 0);

  const kaydet = () => {
    guncelle((x) => {
      x.kullanicilar = x.kullanicilar.map((u) =>
        u.id === k.id ? { ...u, ...form, subeIds: form.rol === "genel-yonetici" ? "all" : form.subeIds } : u,
      );
      x.personel = x.personel.map((pp) => (pp.id === p.id ? { ...pp, aktif: form.aktif, gorev: form.rol } : pp));
      const degisen: string[] = [];
      if (form.rol !== k.rol) degisen.push(`rol: ${rolAdlari[k.rol]} → ${rolAdlari[form.rol]}`);
      if (JSON.stringify(form.subeIds) !== JSON.stringify(k.subeIds)) degisen.push("şube kapsamı değişti");
      if (form.aktif !== k.aktif) degisen.push(form.aktif ? "aktifleştirildi" : "pasife alındı");
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
          <Button onClick={kaydet} disabled={!gecerli}>Kaydet</Button>
        </>
      }
    >
      <div className="grid gap-5">
        <Field label="E-posta (giriş)">
          <Input value={form.eposta} onChange={(e) => setForm({ ...form, eposta: e.target.value })} />
        </Field>
        <Field label="Rol">
          <Select value={form.rol} disabled={kendisi} onChange={(e) => setForm({ ...form, rol: e.target.value as Rol })}>
            {Object.entries(rolAdlari).map(([kk, v]) => (
              <option key={kk} value={kk}>{v}</option>
            ))}
          </Select>
        </Field>
        <div className="grid gap-1.5">
          <span className="text-sm font-medium">Şube kapsamı</span>
          <SubeKapsamSecimi rol={form.rol} deger={form.subeIds} onChange={(v) => setForm({ ...form, subeIds: v })} />
          {!gecerli && <span className="text-xs text-danger">En az bir şube seçilmeli.</span>}
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
            <p className="text-xs text-muted-foreground">Pasif hesap giriş yapamaz; geçmiş kayıtlar korunur.</p>
          </div>
          <Switch label="Hesap aktif" checked={form.aktif} disabled={kendisi} onCheckedChange={(v) => setForm({ ...form, aktif: v })} />
        </div>
        {kendisi && <p className="text-xs text-muted-foreground">Kendi rolünüzü değiştiremez veya hesabınızı pasife alamazsınız.</p>}
      </div>
    </Sheet>
  );
}

function YeniKullanici({ open, onClose, onOlustu }: { open: boolean; onClose: () => void; onOlustu: (k: Kullanici) => void }) {
  const { ad: oturumAd } = useOturum();
  const bos = { ad: "", soyad: "", eposta: "", telefon: "", rol: "sekreter" as Rol, subeIds: ["s1"] as string[] | "all" };
  const [form, setForm] = React.useState(bos);
  const tel = telefonNormalize(form.telefon);
  const gecerli = form.ad.trim() && form.soyad.trim() && /\S+@\S+\.\S+/.test(form.eposta) && tel && (form.rol === "genel-yonetici" || (form.subeIds as string[]).length);

  const ekle = () => {
    if (!gecerli) return;
    const pid = yeniId("p");
    const uid = yeniId("u");
    const subeIds = form.subeIds === "all" ? tanimlar().subeler.map((s) => s.id) : form.subeIds;
    guncelle((x) => {
      x.personel.push({
        id: pid, ad: form.ad.trim(), soyad: form.soyad.trim(), gorev: form.rol, telefon: tel!, eposta: form.eposta, subeIds, anaSubeId: subeIds[0],
        dersIds: [], baslangic: BUGUN, aktif: true, ucretTipi: "sabit", dersUcreti: 0, sabitUcret: 0,
      });
      x.kullanicilar.push({
        id: uid, personelId: pid, rol: form.rol, subeIds: form.rol === "genel-yonetici" ? "all" : subeIds, eposta: form.eposta,
        aktif: true, sonGiris: null, ikiAdim: form.rol === "genel-yonetici",
      });
      islemYaz(x, oturumAd, "Kullanıcı", `${form.ad} ${form.soyad} (${rolAdlari[form.rol]}) eklendi`);
    });
    toast(`${form.ad} ${form.soyad} eklendi; geçici parola oluşturuluyor…`);
    onOlustu({ id: uid, personelId: pid, rol: form.rol, subeIds, eposta: form.eposta, aktif: true, sonGiris: null, ikiAdim: false });
    setForm(bos);
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
      <Field label="E-posta"><Input type="email" value={form.eposta} onChange={(e) => setForm({ ...form, eposta: e.target.value })} /></Field>
      <Field label="Telefon" hint={form.telefon && !tel ? "Geçerli bir cep telefonu girin (05xx…)" : undefined}>
        <Input value={form.telefon} onChange={(e) => setForm({ ...form, telefon: e.target.value })} placeholder="05xx xxx xx xx" />
      </Field>
      <Field label="Rol">
        <Select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value as Rol })}>
          {Object.entries(rolAdlari).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </Select>
      </Field>
      <SubeKapsamSecimi rol={form.rol} deger={form.subeIds} onChange={(v) => setForm({ ...form, subeIds: v })} />
    </Dialog>
  );
}

/* ---------- Veli hesapları ---------- */
function VeliHesaplari() {
  const d = useDb();
  const { subeGorunur, ad: oturumAd } = useOturum();
  const [ara, setAra] = React.useState("");
  const [filtre, setFiltre] = React.useState<"all" | "bekliyor" | "pushKapali">("all");

  const satirlar = d.veliler
    .map((v) => {
      const cocuklar = d.ogrenciler.filter((o) => o.veliIds.includes(v.id) && o.durum === "aktif");
      const subeIds = cocuklar.map((o) => d.kayitlar.find((k) => k.ogrenciId === o.id && k.durum !== "iptal")?.subeId);
      return { v, cocuklar, gorunur: subeIds.some((s) => subeGorunur(s)) };
    })
    .filter(({ v, cocuklar, gorunur }) => {
      if (!gorunur || !cocuklar.length) return false;
      if (filtre === "bekliyor" && v.portalDavet === "giris-yapti") return false;
      if (filtre === "pushKapali" && v.pushAcik) return false;
      const q = ara.toLocaleLowerCase("tr");
      return !q || tamAd(v).toLocaleLowerCase("tr").includes(q) || v.telefon.replace(/\s/g, "").includes(q.replace(/\s/g, ""));
    });

  const pushOrani = satirlar.length ? Math.round((satirlar.filter((s) => s.v.pushAcik).length / satirlar.length) * 100) : 0;

  const davetGonder = (veliId: string, ogrenciId: string) => {
    guncelle((x) => {
      bildirimEkle(x, "hosgeldin", ogrenciId, {}, undefined);
      x.veliler = x.veliler.map((v) => (v.id === veliId && v.portalDavet === "bekliyor" ? { ...v, portalDavet: "gonderildi" } : v));
      islemYaz(x, oturumAd, "Veli daveti", "Portal daveti yeniden gönderildi");
    });
    toast("Portal daveti SMS ile gönderildi.");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Veli hesapları</CardTitle>
        <CardDescription>
          Veliler telefon + SMS koduyla girer (parola yok). Öğrenci kaydında hesap otomatik açılır ve davet SMS'i gider.
          Bildirim izni açık olan veli oranı: <b className="text-foreground">%{pushOrani}</b>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2 pb-4">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Veli adı veya telefon" className="pl-8" value={ara} onChange={(e) => setAra(e.target.value)} />
        </div>
        <Select aria-label="Filtre" className="w-56" value={filtre} onChange={(e) => setFiltre(e.target.value as typeof filtre)}>
          <option value="all">Tüm veliler</option>
          <option value="bekliyor">Portala hiç girmeyenler</option>
          <option value="pushKapali">Bildirimi kapalı (SMS'e düşer)</option>
        </Select>
      </CardContent>
      <Table>
        <thead>
          <tr>
            <Th>Veli</Th>
            <Th>Çocuk(lar)</Th>
            <Th>Portal</Th>
            <Th>Bildirim</Th>
            <Th className="text-right">İşlem</Th>
          </tr>
        </thead>
        <tbody>
          {satirlar.slice(0, 60).map(({ v, cocuklar }) => (
            <tr key={v.id}>
              <Td>
                <p className="font-medium">{tamAd(v)} <span className="text-xs font-normal text-muted-foreground">· {v.yakinlik}</span></p>
                <p className="font-mono text-xs text-muted-foreground">{v.telefon}</p>
              </Td>
              <Td>{cocuklar.map((o) => o.ad).join(", ")}</Td>
              <Td>
                <Badge variant={v.portalDavet === "giris-yapti" ? "success" : v.portalDavet === "gonderildi" ? "warning" : "secondary"}>
                  {v.portalDavet === "giris-yapti" ? "Giriş yaptı" : v.portalDavet === "gonderildi" ? "Davet gönderildi" : "Bekliyor"}
                </Badge>
              </Td>
              <Td>
                {v.pushAcik ? (
                  <Badge variant="default"><Smartphone className="size-3" /> Uygulama</Badge>
                ) : (
                  <Badge variant="outline">Yalnız SMS</Badge>
                )}
              </Td>
              <Td className="text-right">
                {v.portalDavet !== "giris-yapti" && (
                  <Button variant="outline" size="sm" onClick={() => davetGonder(v.id, cocuklar[0].id)}>
                    <Send /> Davet
                  </Button>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {satirlar.length > 60 && <p className="p-4 text-center text-xs text-muted-foreground">İlk 60 veli gösteriliyor ({satirlar.length} toplam). Aramayı daraltın.</p>}
    </Card>
  );
}

/* ---------- Rol yetkileri ---------- */
function RolYetkileri() {
  const d = useDb();
  const { ad: oturumAd } = useOturum();
  const roller = Object.keys(rolAdlari) as Rol[];
  const degistir = (rol: Rol, kod: string, v: boolean) => {
    guncelle((x) => {
      x.rolYetkileri = { ...x.rolYetkileri, [rol]: { ...x.rolYetkileri[rol], [kod]: v } };
      islemYaz(x, oturumAd, "Yetki", `${rolAdlari[rol]}: ${bolumler.find((b) => b.kod === kod)?.ad} ${v ? "açıldı" : "kapatıldı"}`);
    });
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Rol → bölüm yetkileri</CardTitle>
        <CardDescription>
          Roller sabittir; yönetici rol bazında bölümleri açıp kapatabilir. Şube kapsamı ayrıca uygulanır.
          Veli ve öğrenci yalnızca portalı görür.
        </CardDescription>
      </CardHeader>
      <Table>
        <thead>
          <tr>
            <Th>Bölüm</Th>
            {roller.map((r) => (
              <Th key={r} className="text-center">{rolAdlari[r]}</Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...bolumler].sort((a, b) => a.kod.localeCompare(b.kod)).map((b) => (
            <tr key={b.kod}>
              <Td>
                <span className="mr-2 font-mono text-xs text-muted-foreground">{b.kod}</span>
                {b.ad}
              </Td>
              {roller.map((r) => (
                <Td key={r} className="text-center">
                  <div className="flex justify-center">
                    <Switch
                      label={`${rolAdlari[r]} – ${b.ad}`}
                      checked={!!d.rolYetkileri[r][b.kod]}
                      disabled={r === "genel-yonetici"}
                      onCheckedChange={(v) => degistir(r, b.kod, v)}
                    />
                  </div>
                </Td>
              ))}
            </tr>
          ))}
        </tbody>
      </Table>
      <CardContent className="pt-4">
        <Alert icon={<Lock />}>
          Öğretmen hangi şubede olursa olsun yalnızca kendi gruplarını görür ve finans verisine erişemez. Önemli işlemler
          (tahsilat iptali, indirim, kayıt iptali, yetki değişikliği) işlem kaydına yazılır.
        </Alert>
      </CardContent>
    </Card>
  );
}

/* ---------- Giriş geçmişi ---------- */
function GirisGecmisi() {
  const d = useDb();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Giriş geçmişi</CardTitle>
        <CardDescription>Kim, ne zaman, hangi cihazdan giriş yaptı.</CardDescription>
      </CardHeader>
      <Table>
        <thead>
          <tr>
            <Th>Zaman</Th>
            <Th>Kullanıcı</Th>
            <Th>Cihaz</Th>
            <Th>Sonuç</Th>
          </tr>
        </thead>
        <tbody>
          {d.girisler.slice(0, 40).map((g) => {
            const k = d.kullanicilar.find((x) => x.id === g.kullaniciId);
            const p = d.personel.find((x) => x.id === k?.personelId);
            return (
              <tr key={g.id}>
                <Td className="tabular-nums text-muted-foreground">{zamanBicim(g.tarih)}</Td>
                <Td className="font-medium">{tamAd(p)}</Td>
                <Td>{g.cihaz}</Td>
                <Td>{g.basarili ? <Badge variant="success">Başarılı</Badge> : <Badge variant="danger">Hatalı parola</Badge>}</Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </Card>
  );
}
