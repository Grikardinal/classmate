/**
 * Bölüm 13 · Personel ve öğretmen yönetimi
 * Doküman: docs/bolumler/13-personel.md
 * Personel kartı MVP; hak ediş v2 ve ayrı modül anahtarıyla (varsayılan kapalı).
 */
import * as React from "react";
import { Link } from "react-router-dom";
import { Banknote, Calculator, CheckCircle2, Mail, Phone, Plus, Search, ShieldCheck, Users } from "lucide-react";
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  Checkbox,
  Dialog,
  Field,
  Input,
  PageHeader,
  Select,
  Sheet,
  StatCard,
  Switch,
  Table,
  Tabs,
  Td,
  Th,
  toast,
} from "@/components/ui";
import { useApp, useOturum } from "@/context/AppContext";
import { gunKisa } from "@/data/mock";
import { tanimlar } from "@/data/store";
import {
  BUGUN,
  dersAdi,
  grupEtiket,
  guncelle,
  islemYaz,
  rolAdlari,
  saat,
  sube,
  tamAd,
  useDb,
  yeniId,
  type Db,
  type Personel,
  type Rol,
} from "@/data/store";
import { dakika, hakEdis, telefonNormalize, tl } from "@/lib/kurallar";

function haftalikDersler(d: Db, pid: string) {
  return d.program
    .filter((p) => p.ogretmenId === pid && !p.bitis)
    .sort((a, b) => a.gun - b.gun || dakika(saat(a.saatId)!.baslangic) - dakika(saat(b.saatId)!.baslangic));
}

export default function PersonelBolumu() {
  const { moduller } = useApp();
  const { rol } = useOturum();
  const [sekme, setSekme] = React.useState<"liste" | "hakedis">("liste");
  const hakedisGorunur = moduller.hakedis && (rol === "genel-yonetici" || rol === "sube-muduru");
  return (
    <div className="grid gap-6">
      <PageHeader code="13" title="Personel" description="Öğretmen ve personel kartları, şube ve grup atamaları." />
      {hakedisGorunur && (
        <Tabs
          value={sekme}
          onChange={setSekme}
          items={[
            { value: "liste", label: "Personel", icon: <Users /> },
            { value: "hakedis", label: moduller.finans ? "Hak ediş" : "Ders sayısı raporu", icon: <Calculator /> },
          ]}
        />
      )}
      {sekme === "hakedis" && hakedisGorunur ? <HakEdis /> : <PersonelListesi />}
    </div>
  );
}

function PersonelListesi() {
  const d = useDb();
  const { subeGorunur } = useOturum();
  const [ara, setAra] = React.useState("");
  const [gorev, setGorev] = React.useState<Rol | "all">("all");
  const [pasif, setPasif] = React.useState(false);
  const [secili, setSecili] = React.useState<string | null>(null);
  const [yeni, setYeni] = React.useState(false);
  const liste = d.personel
    .filter((p) => p.subeIds.some((s) => subeGorunur(s)) || p.gorev === "genel-yonetici")
    .filter((p) => (pasif || p.aktif) && (gorev === "all" || p.gorev === gorev) && tamAd(p).toLocaleLowerCase("tr").includes(ara.toLocaleLowerCase("tr")));
  const ogretmenler = liste.filter((p) => p.gorev === "ogretmen" && p.aktif);

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Aktif personel" value={liste.filter((p) => p.aktif).length} icon={<Users />} />
        <StatCard label="Öğretmen" value={ogretmenler.length} />
        <StatCard label="Birden çok şubede" value={ogretmenler.filter((p) => p.subeIds.length > 1).length} />
        <StatCard label="Haftalık toplam ders" value={ogretmenler.reduce((s, p) => s + haftalikDersler(d, p.id).length, 0)} />
      </div>
      <Card>
        <CardContent className="flex flex-wrap gap-2 p-4">
          <div className="relative min-w-48 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="İsim ara" className="pl-8" value={ara} onChange={(e) => setAra(e.target.value)} />
          </div>
          <Select aria-label="Görev" className="w-44" value={gorev} onChange={(e) => setGorev(e.target.value as Rol | "all")}>
            <option value="all">Tüm görevler</option>
            {Object.entries(rolAdlari).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <div className="flex items-center gap-2">
            <Switch label="Pasifleri göster" checked={pasif} onCheckedChange={setPasif} />
            <span className="text-sm">Pasifler</span>
          </div>
          <Button onClick={() => setYeni(true)}><Plus /> Personel ekle</Button>
        </CardContent>
        <Table>
          <thead>
            <tr><Th>Personel</Th><Th>Görev</Th><Th>Branş</Th><Th>Şubeler</Th><Th className="text-right">Haftalık ders</Th><Th>Durum</Th></tr>
          </thead>
          <tbody>
            {liste.map((p) => {
              const n = haftalikDersler(d, p.id).length;
              return (
                <tr key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSecili(p.id)}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar ad={tamAd(p)} className="size-8" />
                      <div>
                        <p className="font-medium">{tamAd(p)}</p>
                        <p className="text-xs text-muted-foreground">{p.telefon}</p>
                      </div>
                    </div>
                  </Td>
                  <Td>{rolAdlari[p.gorev]}</Td>
                  <Td>{p.dersIds.map(dersAdi).join(", ") || "—"}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {p.subeIds.map((s) => <Badge key={s} variant={s === p.anaSubeId ? "default" : "outline"}>{sube(s)?.kod}</Badge>)}
                    </div>
                  </Td>
                  <Td className="text-right tabular-nums">{p.gorev === "ogretmen" ? n : "—"}</Td>
                  <Td><Badge variant={p.aktif ? "success" : "secondary"}>{p.aktif ? "Aktif" : "Pasif"}</Badge></Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
      {secili && <PersonelKarti id={secili} onClose={() => setSecili(null)} />}
      <PersonelEkle open={yeni} onClose={() => setYeni(false)} />
    </div>
  );
}

function PersonelForm({ f, setF }: { f: Personel; setF: (p: Personel) => void }) {
  const { moduller } = useApp();
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Ad"><Input value={f.ad} onChange={(e) => setF({ ...f, ad: e.target.value })} /></Field>
        <Field label="Soyad"><Input value={f.soyad} onChange={(e) => setF({ ...f, soyad: e.target.value })} /></Field>
        <Field label="Telefon"><Input value={f.telefon} onChange={(e) => setF({ ...f, telefon: e.target.value })} /></Field>
        <Field label="E-posta"><Input type="email" value={f.eposta} onChange={(e) => setF({ ...f, eposta: e.target.value })} /></Field>
        <Field label="Görev">
          <Select value={f.gorev} onChange={(e) => setF({ ...f, gorev: e.target.value as Rol })}>
            {Object.entries(rolAdlari).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
        <Field label="İşe başlama"><Input type="date" value={f.baslangic} onChange={(e) => setF({ ...f, baslangic: e.target.value })} /></Field>
      </div>
      {f.gorev === "ogretmen" && (
        <div className="grid gap-2">
          <span className="text-sm font-medium">Branş(lar)</span>
          <div className="grid grid-cols-2 gap-1.5">
            {tanimlar().dersler.map((x) => (
              <Checkbox
                key={x.id}
                checked={f.dersIds.includes(x.id)}
                onChange={(v) => setF({ ...f, dersIds: v ? [...f.dersIds, x.id] : f.dersIds.filter((y) => y !== x.id) })}
                label={x.ad}
              />
            ))}
          </div>
        </div>
      )}
      <div className="grid gap-2">
        <span className="text-sm font-medium">Bağlı şube(ler) · ana şube</span>
        {tanimlar().subeler.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-md border px-3 py-2">
            <Checkbox
              checked={f.subeIds.includes(s.id)}
              onChange={(v) => {
                const ids = v ? [...f.subeIds, s.id] : f.subeIds.filter((x) => x !== s.id);
                setF({ ...f, subeIds: ids, anaSubeId: ids.includes(f.anaSubeId) ? f.anaSubeId : ids[0] ?? "" });
              }}
              label={s.ad}
            />
            {f.subeIds.includes(s.id) && (
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <input type="radio" name="ana" checked={f.anaSubeId === s.id} onChange={() => setF({ ...f, anaSubeId: s.id })} className="accent-[var(--color-primary)]" /> Ana şube
              </label>
            )}
          </div>
        ))}
      </div>
      {moduller.hakedis && f.gorev === "ogretmen" && (
        <div className="grid grid-cols-3 gap-3 rounded-md border p-3">
          <Field label="Ücret tipi">
            <Select value={f.ucretTipi} onChange={(e) => setF({ ...f, ucretTipi: e.target.value as Personel["ucretTipi"] })}>
              <option value="sabit">Sabit maaş</option>
              <option value="ders">Ders başı</option>
              <option value="karma">Karma</option>
            </Select>
          </Field>
          {f.ucretTipi !== "ders" && (
            <Field label="Sabit (₺/ay)"><Input type="number" min={0} value={f.sabitUcret} onChange={(e) => setF({ ...f, sabitUcret: Number(e.target.value) })} /></Field>
          )}
          {f.ucretTipi !== "sabit" && (
            <Field label="Ders ücreti (₺)"><Input type="number" min={0} value={f.dersUcreti} onChange={(e) => setF({ ...f, dersUcreti: Number(e.target.value) })} /></Field>
          )}
        </div>
      )}
    </div>
  );
}

function PersonelKarti({ id, onClose }: { id: string; onClose: () => void }) {
  const d = useDb();
  const { ad, rol } = useOturum();
  const p = d.personel.find((x) => x.id === id)!;
  const [f, setF] = React.useState(p);
  const kullanici = d.kullanicilar.find((k) => k.personelId === id);
  const dersListesi = haftalikDersler(d, id);
  const gruplar = [...new Set(dersListesi.map((x) => x.grupId))];
  const dk = dersListesi.reduce((s, x) => s + dakika(saat(x.saatId)!.bitis) - dakika(saat(x.saatId)!.baslangic), 0);
  const gecerli = f.ad.trim() && f.soyad.trim() && f.subeIds.length > 0 && !!telefonNormalize(f.telefon);

  const kaydet = () => {
    guncelle((x) => {
      x.personel = x.personel.map((y) => (y.id === id ? { ...f, telefon: telefonNormalize(f.telefon)! } : y));
      // Ayrılan personelin hesabı silinmez, pasife alınır
      if (!f.aktif && kullanici?.aktif) x.kullanicilar = x.kullanicilar.map((k) => (k.id === kullanici.id ? { ...k, aktif: false } : k));
      islemYaz(x, ad, "Personel", `${tamAd(f)} kartı güncellendi${!f.aktif && p.aktif ? " (pasife alındı)" : ""}`);
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
          <Button variant="outline" onClick={onClose}>Vazgeç</Button>
          <Button onClick={kaydet} disabled={!gecerli}>Kaydet</Button>
        </>
      }
    >
      <div className="grid gap-6">
        <div className="flex flex-wrap gap-3 text-sm">
          <a href={`tel:${p.telefon.replace(/\s/g, "")}`} className="flex items-center gap-1.5 text-primary"><Phone className="size-4" /> {p.telefon}</a>
          <a href={`mailto:${p.eposta}`} className="flex items-center gap-1.5 text-primary"><Mail className="size-4" /> {p.eposta}</a>
        </div>
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
        <PersonelForm f={f} setF={setF} />
        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <p className="text-sm font-medium">Aktif</p>
            <p className="text-xs text-muted-foreground">Ayrılan personel pasife alınır; geçmiş kayıtlar korunur.</p>
          </div>
          <Switch label="Aktif" checked={f.aktif} onCheckedChange={(v) => setF({ ...f, aktif: v })} />
        </div>
        {!f.aktif && dersListesi.length > 0 && (
          <Alert tone="warning">Bu öğretmenin programda {dersListesi.length} dersi var; pasife almadan önce dersleri başka öğretmene aktarın (Bölüm 06).</Alert>
        )}
      </div>
    </Sheet>
  );
}

function PersonelEkle({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { ad, kapsam } = useOturum();
  const bos = (): Personel => ({
    id: "", ad: "", soyad: "", gorev: "ogretmen", telefon: "", eposta: "", subeIds: [kapsam[0]], anaSubeId: kapsam[0], dersIds: [],
    baslangic: BUGUN, aktif: true, ucretTipi: "ders", dersUcreti: 450, sabitUcret: 0,
  });
  const [f, setF] = React.useState(bos);
  const [hesap, setHesap] = React.useState(true);
  const gecerli = f.ad.trim() && f.soyad.trim() && f.subeIds.length > 0 && !!telefonNormalize(f.telefon) && (!hesap || /\S+@\S+\.\S+/.test(f.eposta));
  const kaydet = () => {
    if (!gecerli) return;
    const pid = yeniId("p");
    guncelle((x) => {
      x.personel.push({ ...f, id: pid, ad: f.ad.trim(), soyad: f.soyad.trim(), telefon: telefonNormalize(f.telefon)! });
      if (hesap)
        x.kullanicilar.push({
          id: yeniId("u"), personelId: pid, rol: f.gorev, subeIds: f.gorev === "genel-yonetici" ? "all" : f.subeIds, eposta: f.eposta,
          aktif: true, sonGiris: null, ikiAdim: false,
        });
      islemYaz(x, ad, "Personel", `${f.ad} ${f.soyad} (${rolAdlari[f.gorev]}) eklendi`, f.anaSubeId);
    });
    toast(hesap ? "Personel eklendi; giriş bilgileri e-postayla gönderildi." : "Personel eklendi.");
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
          <Button onClick={kaydet} disabled={!gecerli}>Ekle</Button>
        </>
      }
    >
      <PersonelForm f={f} setF={setF} />
      <Checkbox checked={hesap} onChange={setHesap} label="Kullanıcı hesabı da oluştur (Bölüm 02)" description="Rol = görev, şube kapsamı = bağlı şubeler" />
    </Dialog>
  );
}

/* ---------- Hak ediş ---------- */
function HakEdis() {
  const d = useDb();
  const { moduller } = useApp();
  const { subeGorunur, ad, rol } = useOturum();
  const aylar = ["2026-09", "2026-10"];
  const [ay, setAy] = React.useState(BUGUN.slice(0, 7));
  const [avansAcik, setAvansAcik] = React.useState(false);
  const ogretmenler = d.personel.filter((p) => p.gorev === "ogretmen" && p.subeIds.some((s) => subeGorunur(s)));
  // "İşlenen ders" = yoklaması alınmış oturum
  const yoklamalar = Object.values(d.yoklamalar).filter((y) => y.tarih.startsWith(ay));
  const satirlar = ogretmenler.map((p) => {
    const kendi = yoklamalar.filter((y) => y.ogretmenId === p.id);
    const subeBazinda = p.subeIds
      .map((s) => ({ s, n: kendi.filter((y) => d.gruplar.find((g) => g.id === y.grupId)?.subeId === s).length }))
      .filter((x) => x.n > 0 || x.s === p.anaSubeId);
    const toplam = kendi.length;
    const tutar = hakEdis(p.ucretTipi, toplam, p.dersUcreti, p.sabitUcret);
    const avans = d.avanslar.filter((a) => a.personelId === p.id && a.tarih.startsWith(ay)).reduce((s, a) => s + a.tutar, 0);
    return { p, subeBazinda, toplam, tutar, avans, durum: d.hakedisDurum[`${ay}_${p.id}`] };
  });

  const onayla = (pid: string) =>
    guncelle((x) => {
      x.hakedisDurum = { ...x.hakedisDurum, [`${ay}_${pid}`]: "onaylandi" };
      islemYaz(x, ad, "Hak ediş onayı", `${tamAd(x.personel.find((p) => p.id === pid))} — ${ay}`);
    });

  const ode = (r: (typeof satirlar)[number]) => {
    guncelle((x) => {
      x.hakedisDurum = { ...x.hakedisDurum, [`${ay}_${r.p.id}`]: "odendi" };
      // Ödeme finansa gider olarak düşer; birden çok şubede çalışanın gideri şubelere göre ayrıştırılır
      const kalan = r.tutar - r.avans;
      for (const sb of r.subeBazinda) {
        const ana = sb.s === r.p.anaSubeId;
        let pay = 0;
        if (r.p.ucretTipi === "sabit" || !r.toplam) pay = ana ? kalan : 0;
        else if (r.p.ucretTipi === "ders") pay = (sb.n / r.toplam) * kalan;
        else pay = sb.n * r.p.dersUcreti + (ana ? r.p.sabitUcret - r.avans : 0);
        if (pay > 0)
          x.giderler.push({ id: yeniId("gd"), tarih: BUGUN, subeId: sb.s, kategori: "Maaş", aciklama: `${tamAd(r.p)} ${ay} hak edişi`, tutar: Math.round(pay * 100) / 100, kasa: "banka" });
      }
      islemYaz(x, ad, "Hak ediş ödemesi", `${tamAd(r.p)} — ${ay}: ${tl(kalan)}`);
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
          Finans modülü kapalı: hak ediş yalnızca <b>ders sayısı raporu</b> olarak çalışır (öğretmen başına işlenen ders, şube bazında). Tutar hesabı için Finans'ı açın.
        </Alert>
      )}
      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Öğretmen</Th>
              <Th>Şube bazında işlenen ders</Th>
              <Th className="text-right">Toplam</Th>
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
                    {r.subeBazinda.map((s) => <Badge key={s.s} variant="outline">{sube(s.s)?.kod}: {s.n}</Badge>)}
                  </div>
                </Td>
                <Td className="text-right font-medium tabular-nums">{r.toplam}</Td>
                {moduller.finans && (
                  <>
                    <Td className="text-xs text-muted-foreground">
                      {r.p.ucretTipi === "sabit" ? `Sabit ${tl(r.p.sabitUcret)}` : r.p.ucretTipi === "ders" ? `${tl(r.p.dersUcreti)}/ders` : `${tl(r.p.sabitUcret)} + ${tl(r.p.dersUcreti)}/ders`}
                    </Td>
                    <Td className="text-right tabular-nums">{tl(r.tutar)}</Td>
                    <Td className="text-right tabular-nums">{r.avans ? tl(r.avans) : "—"}</Td>
                    <Td className="text-right font-medium tabular-nums">{tl(r.tutar - r.avans)}</Td>
                    <Td className="text-right">
                      {r.durum === "odendi" ? (
                        <Badge variant="success"><CheckCircle2 className="size-3" /> Ödendi</Badge>
                      ) : r.durum === "onaylandi" ? (
                        <Button size="sm" onClick={() => ode(r)} disabled={rol !== "genel-yonetici"}>Ödendi</Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => onayla(r.p.id)}>Onayla</Button>
                      )}
                    </Td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      <p className="text-xs text-muted-foreground">
        “İşlenen ders” = yoklaması alınmış ders oturumu. Bordro, SGK ve vergi hesapları kapsam dışıdır; muhasebeciye bu özet aktarılır.
      </p>
      <AvansDialog open={avansAcik} onClose={() => setAvansAcik(false)} ogretmenler={ogretmenler} />
    </div>
  );
}

function AvansDialog({ open, onClose, ogretmenler }: { open: boolean; onClose: () => void; ogretmenler: Personel[] }) {
  const { ad } = useOturum();
  const [f, setF] = React.useState({ personelId: ogretmenler[0]?.id ?? "", tutar: "", aciklama: "" });
  const tutar = Number(f.tutar.replace(",", "."));
  const kaydet = () => {
    if (!(tutar > 0) || !f.personelId) return;
    guncelle((x) => {
      const p = x.personel.find((y) => y.id === f.personelId)!;
      x.avanslar.push({ id: yeniId("av"), personelId: p.id, tarih: BUGUN, tutar, aciklama: f.aciklama || "Avans", subeId: p.anaSubeId });
      x.giderler.push({ id: yeniId("gd"), tarih: BUGUN, subeId: p.anaSubeId, kategori: "Maaş", aciklama: `${tamAd(p)} avans`, tutar, kasa: "nakit" });
      islemYaz(x, ad, "Avans", `${tamAd(p)} — ${tl(tutar)}`, p.anaSubeId);
    });
    toast("Avans kaydedildi.");
    onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Avans girişi"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Vazgeç</Button>
          <Button onClick={kaydet} disabled={!(tutar > 0)}>Kaydet</Button>
        </>
      }
    >
      <Field label="Öğretmen">
        <Select value={f.personelId} onChange={(e) => setF({ ...f, personelId: e.target.value })}>
          {ogretmenler.map((p) => <option key={p.id} value={p.id}>{tamAd(p)}</option>)}
        </Select>
      </Field>
      <Field label="Tutar (₺)"><Input inputMode="decimal" value={f.tutar} onChange={(e) => setF({ ...f, tutar: e.target.value })} /></Field>
      <Field label="Açıklama"><Input value={f.aciklama} onChange={(e) => setF({ ...f, aciklama: e.target.value })} /></Field>
    </Dialog>
  );
}
