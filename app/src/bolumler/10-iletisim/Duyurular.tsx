import * as React from "react";
import { Megaphone, Plus, Send } from "lucide-react";
import { Alert, Badge, Button, Card, CardContent, Checkbox, Dialog, EmptyState, Field, Input, Select, Textarea, toast } from "@/components/ui";
import { useOturum } from "@/context/AppContext";
import { BUGUN, SIMDI, duyuruGonderimleri, grupEtiket, guncelle, hedefVeliler, islemYaz, simdiZaman, sube, tanimlar, useDb, yeniId, type Duyuru } from "@/data/store";
import { gonderimSaatindeMi, smsBoyu, tl } from "@/lib/kurallar";
import { BASLIK_SINIR, METIN_SINIR, duyuruKapsamda } from "./kurallar";
import { zamanTR } from "./ortak";

function hedefMetni(d: ReturnType<typeof useDb>, h: Duyuru["hedef"]) {
  if (h.tur === "tum") return "Tüm veliler";
  if (h.tur === "sube") return `Şube: ${sube(h.deger)?.ad}`;
  if (h.tur === "seviye") return `${h.deger}. sınıflar`;
  return `Grup: ${grupEtiket(d, h.deger ?? "")}`;
}

export function Duyurular() {
  const d = useDb();
  const { kapsam, rol, ad } = useOturum();
  const [yeni, setYeni] = React.useState(false);
  const genel = rol === "genel-yonetici";
  const grupSube = (id: string) => d.gruplar.find((g) => g.id === id)?.subeId;
  const gorunur = (du: Duyuru) => genel || du.hedef.tur === "tum" || duyuruKapsamda(du, kapsam, grupSube, false) || (du.hedef.tur === "seviye" && !du.subeIds?.length);
  const liste = d.duyurular.filter(gorunur).sort((a, b) => b.zaman.localeCompare(a.zaman));
  const simdiGonder = (du: Duyuru) => {
    guncelle((x) => {
      const g = { ...du, zaman: simdiZaman(), zamanlanmis: false, aliciVeliIds: hedefVeliler(x, du.hedef, du.subeIds) };
      x.duyurular = x.duyurular.map((y) => (y.id === du.id ? g : y));
      duyuruGonderimleri(x, g);
      islemYaz(x, ad, "Duyuru", `“${du.baslik}” gönderildi`);
    });
    toast("Duyuru gönderildi.");
  };
  return (
    <div className="grid gap-4">
      <div className="flex justify-end"><Button onClick={() => setYeni(true)}><Plus /> Yeni duyuru</Button></div>
      {liste.length === 0 && <EmptyState icon={<Megaphone />} title="Duyuru yok" text="Örn. “Cumartesi resmi tatil nedeniyle ders yapılmayacaktır.”" />}
      <div className="grid gap-3">
        {liste.map((du) => {
          const oran = du.aliciVeliIds.length ? du.okuyanVeliIds.length / du.aliciVeliIds.length : 0;
          return (
            <Card key={du.id}>
              <CardContent className="grid gap-3 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{du.baslik}</p>
                    <Badge variant="outline">{hedefMetni(d, du.hedef)}</Badge>
                    <Badge variant={du.kanal === "push" ? "default" : "warning"}>{du.kanal === "push" ? "Uygulama" : "Uygulama + SMS"}</Badge>
                    {du.zamanlanmis && <Badge variant="secondary">Zamanlanmış · {zamanTR(du.zaman)}</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{du.metin}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{du.gonderen} · {zamanTR(du.zaman)}</p>
                </div>
                {du.zamanlanmis ? (
                  duyuruKapsamda(du, kapsam, grupSube, genel) && <Button size="sm" variant="outline" onClick={() => simdiGonder(du)}><Send /> Şimdi gönder</Button>
                ) : (
                  <div className="w-44">
                    <div className="flex justify-between text-xs"><span className="text-muted-foreground">Okundu</span><span className="tabular-nums">{du.okuyanVeliIds.length}/{du.aliciVeliIds.length}</span></div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-success" style={{ width: `${oran * 100}%` }} /></div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      <YeniDuyuru open={yeni} onClose={() => setYeni(false)} />
    </div>
  );
}

function YeniDuyuru({ open, onClose }: { open: boolean; onClose: () => void }) {
  const d = useDb();
  const { kapsam, rol, ad } = useOturum();
  const genel = rol === "genel-yonetici";
  const bos = () => ({ baslik: "", metin: "", tur: (genel ? "tum" : "sube") as Duyuru["hedef"]["tur"], deger: genel ? "" : kapsam[0], kanal: "push" as Duyuru["kanal"], zamanla: false, zaman: `${BUGUN}T19:00` });
  const [f, setF] = React.useState(bos);
  const hedef: Duyuru["hedef"] = { tur: f.tur, deger: f.tur === "tum" ? null : f.deger };
  // Şube personeli yalnızca kendi şubesine duyuru gönderebilir; seviye duyurusu da kendi şubeleriyle sınırlıdır
  const subeIds = !genel && f.tur === "seviye" ? kapsam : null;
  const alicilar = f.tur === "tum" || f.deger ? hedefVeliler(d, hedef, genel ? null : kapsam) : [];
  const smsSayisi = f.kanal === "push+sms" ? alicilar.filter((v) => { const x = d.veliler.find((y) => y.id === v); return !x?.pushAcik && x?.izinSms !== false; }).length : 0;
  const maliyet = smsSayisi * smsBoyu(`${f.baslik}: ${f.metin}`) * d.ayarlar.smsBirimFiyat;
  const saatDisi = !f.zamanla && !gonderimSaatindeMi(SIMDI, d.ayarlar.gonderimBas, d.ayarlar.gonderimBit);
  const gecerli = f.baslik.trim() && f.metin.trim() && alicilar.length > 0 && (!f.zamanla || f.zaman > `${BUGUN}T${SIMDI}`);

  const gonder = () => {
    if (!gecerli) return;
    guncelle((x) => {
      const du: Duyuru = {
        id: yeniId("du"), baslik: f.baslik.trim(), metin: f.metin.trim(), hedef, subeIds, kanal: f.kanal, zaman: f.zamanla ? f.zaman : simdiZaman(),
        zamanlanmis: f.zamanla, gonderen: ad, aliciVeliIds: alicilar, okuyanVeliIds: [],
      };
      x.duyurular.push(du);
      if (!f.zamanla) duyuruGonderimleri(x, du);
      islemYaz(x, ad, "Duyuru", `“${du.baslik}” → ${hedefMetni(x, hedef)} (${alicilar.length} veli)`, f.tur === "sube" ? f.deger : null);
    });
    toast(f.zamanla ? "Duyuru zamanlandı." : `Duyuru ${alicilar.length} veliye gönderildi.`);
    setF(bos());
    onClose();
  };

  const gruplar = d.gruplar.filter((g) => kapsam.includes(g.subeId));
  return (
    <Dialog open={open} onClose={onClose} wide title="Yeni duyuru" footer={<><Button variant="outline" onClick={onClose}>Vazgeç</Button><Button onClick={gonder} disabled={!gecerli}><Send /> {f.zamanla ? "Zamanla" : "Gönder"}</Button></>}>
      <Field label="Başlık"><Input maxLength={BASLIK_SINIR} value={f.baslik} onChange={(e) => setF({ ...f, baslik: e.target.value })} placeholder="Cumartesi dersleri" /></Field>
      <Field label="Metin" hint="{sube_adi} ve {sube_telefonu} kullanılabilir; veli doğru şubeyi arar.">
        <Textarea maxLength={METIN_SINIR} value={f.metin} onChange={(e) => setF({ ...f, metin: e.target.value })} placeholder="Cumartesi resmi tatil nedeniyle ders yapılmayacaktır." />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Hedef">
          <Select value={f.tur} onChange={(e) => { const t = e.target.value as Duyuru["hedef"]["tur"]; setF({ ...f, tur: t, deger: t === "sube" ? kapsam[0] : t === "grup" ? gruplar[0]?.id ?? "" : t === "seviye" ? "5" : "" }); }}>
            {genel && <option value="tum">Tüm veliler</option>}
            <option value="sube">Şube</option>
            <option value="seviye">Seviye</option>
            <option value="grup">Grup</option>
          </Select>
        </Field>
        {f.tur !== "tum" && (
          <Field label="Seçim">
            <Select value={f.deger} onChange={(e) => setF({ ...f, deger: e.target.value })}>
              {f.tur === "sube" && tanimlar().subeler.filter((s) => kapsam.includes(s.id)).map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
              {f.tur === "seviye" && [3, 4, 5, 6, 7, 8].map((s) => <option key={s} value={String(s)}>{s}. sınıf</option>)}
              {f.tur === "grup" && gruplar.map((g) => <option key={g.id} value={g.id}>{grupEtiket(d, g.id)}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Kanal">
          <Select value={f.kanal} onChange={(e) => setF({ ...f, kanal: e.target.value as Duyuru["kanal"] })}>
            <option value="push">Yalnız uygulama (ücretsiz)</option>
            <option value="push+sms">Uygulama + bildirimi kapalılara SMS</option>
          </Select>
        </Field>
      </div>
      <Checkbox checked={f.zamanla} onChange={(v) => setF({ ...f, zamanla: v })} label="İleri bir zamana zamanla" />
      {f.zamanla && <Input type="datetime-local" value={f.zaman} onChange={(e) => setF({ ...f, zaman: e.target.value })} />}
      <Alert tone={alicilar.length ? "info" : "warning"} icon={<Megaphone />}>
        <b>{alicilar.length}</b> veliye gidecek{f.kanal === "push+sms" && <> · <b>{smsSayisi}</b> SMS (tahmini {tl(maliyet)})</>}.
      </Alert>
      {saatDisi && <Alert tone="warning">Şu an gönderim saat aralığı dışında ({d.ayarlar.gonderimBas}–{d.ayarlar.gonderimBit}); SMS'ler sabah gönderilir.</Alert>}
    </Dialog>
  );
}
