/** Öğrenci listesi: aktif sezonun kayıtları (şube kapsamına göre), arama ve filtre */
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { FileSpreadsheet, GraduationCap, HeartPulse, PauseCircle, Search, UserPlus, Users } from "lucide-react";
import { Avatar, Button, Card, CardContent, EmptyState, Input, PageHeader, Select, StatCard, Table, Td, Th } from "@/components/ui";
import { useOturum } from "@/context/AppContext";
import { AKTIF_SEZON, BUGUN, grupEtiket, ogrenciVelileri, ogrenciYoklamalari, tamAd, useDb } from "@/data/store";
import { devamsizlikOzeti, normalAd } from "@/lib/kurallar";
import { cn } from "@/lib/utils";
import { KayitDurumRozeti } from "./ortak";

export function OgrenciListesi() {
  const d = useDb();
  const { subeGorunur, yetki } = useOturum();
  const navigate = useNavigate();
  const [ara, setAra] = React.useState("");
  const [grupId, setGrupId] = React.useState("all");
  const [durum, setDurum] = React.useState<"aktif" | "dondurulmus" | "iptal" | "all">("aktif");

  const gruplar = d.gruplar.filter((g) => g.sezonId === AKTIF_SEZON && subeGorunur(g.subeId));
  const q = normalAd(ara).replace(/\s(?=\d)/g, "");
  const satirlar = d.kayitlar
    .filter((k) => k.sezonId === AKTIF_SEZON && subeGorunur(k.subeId))
    .filter((k) => (durum === "all" || k.durum === durum) && (grupId === "all" || k.grupId === grupId))
    .map((k) => ({ k, o: d.ogrenciler.find((o) => o.id === k.ogrenciId) }))
    .filter((x): x is { k: (typeof d.kayitlar)[number]; o: NonNullable<typeof x.o> } => {
      if (!x.o) return false;
      if (!q) return true;
      const veliler = ogrenciVelileri(d, x.o);
      return normalAd(`${x.o.ad} ${x.o.soyad} ${veliler.map((v) => `${v.ad} ${v.soyad} ${v.telefon.replace(/\s/g, "")}`).join(" ")}`).includes(q);
    })
    .sort((a, b) => a.o.ad.localeCompare(b.o.ad, "tr"));

  const sezonKayitlari = d.kayitlar.filter((k) => k.sezonId === AKTIF_SEZON && subeGorunur(k.subeId));
  const aktifSayi = sezonKayitlari.filter((k) => k.durum === "aktif").length;
  const kapasite = gruplar.reduce((t, g) => t + g.kapasite, 0);

  return (
    <div className="grid gap-6">
      <PageHeader
        code="04"
        title="Öğrenciler"
        description="Öğrenci ve veli kurum genelinde tektir; kayıt şubeye bağlıdır."
        actions={
          <>
            {yetki("14") && (
              <Button variant="outline" onClick={() => navigate("/altyapi?sekme=ice")}>
                <FileSpreadsheet /> Excel'den aktar
              </Button>
            )}
            <Button onClick={() => navigate("/ogrenciler/yeni")}>
              <UserPlus /> Yeni kayıt
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Aktif öğrenci" value={aktifSayi} icon={<GraduationCap />} />
        <StatCard label="Doluluk" value={`%${kapasite ? Math.round((aktifSayi / kapasite) * 100) : 0}`} hint={`${aktifSayi} / ${kapasite} kontenjan`} icon={<Users />} />
        <StatCard label="Bu ay yeni kayıt" value={sezonKayitlari.filter((k) => k.tarih.startsWith(BUGUN.slice(0, 7))).length} icon={<UserPlus />} tone="success" />
        <StatCard label="Dondurulmuş" value={sezonKayitlari.filter((k) => k.durum === "dondurulmus").length} icon={<PauseCircle />} tone="warning" />
      </div>
      <Card>
        <CardContent className="flex flex-wrap gap-2 p-4">
          <div className="relative min-w-52 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Öğrenci, veli adı veya telefon" className="pl-8" value={ara} onChange={(e) => setAra(e.target.value)} />
          </div>
          <Select aria-label="Grup" className="w-40" value={grupId} onChange={(e) => setGrupId(e.target.value)}>
            <option value="all">Tüm gruplar</option>
            {gruplar.map((g) => (
              <option key={g.id} value={g.id}>{grupEtiket(d, g.id)}</option>
            ))}
          </Select>
          <Select aria-label="Durum" className="w-40" value={durum} onChange={(e) => setDurum(e.target.value as typeof durum)}>
            <option value="aktif">Aktif</option>
            <option value="dondurulmus">Dondurulmuş</option>
            <option value="iptal">İptal</option>
            <option value="all">Tümü</option>
          </Select>
        </CardContent>
        {satirlar.length === 0 ? (
          <CardContent>
            <EmptyState icon={<GraduationCap />} title="Öğrenci bulunamadı" text="Aramayı veya filtreleri değiştirin." />
          </CardContent>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Öğrenci</Th>
                <Th>Grup</Th>
                <Th>Veli</Th>
                <Th>Devamsızlık</Th>
                <Th>Durum</Th>
              </tr>
            </thead>
            <tbody>
              {satirlar.map(({ k, o }) => {
                const v = d.veliler.find((x) => x.id === o.birincilVeliId);
                const oz = devamsizlikOzeti(ogrenciYoklamalari(d, o.id).map((x) => x.durum));
                return (
                  <tr key={k.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/ogrenciler/${o.id}`)}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar ad={tamAd(o)} className="size-8" />
                        <div>
                          <p className="font-medium">
                            {tamAd(o)} {o.saglikNotu && <HeartPulse className="inline size-3.5 text-danger" aria-label="Sağlık notu var" />}
                          </p>
                          <p className="text-xs text-muted-foreground">{o.okul}</p>
                        </div>
                      </div>
                    </Td>
                    <Td className="whitespace-nowrap">{grupEtiket(d, k.grupId)}</Td>
                    <Td>
                      <p>{tamAd(v)}</p>
                      <p className="font-mono text-xs text-muted-foreground">{v?.telefon}</p>
                    </Td>
                    <Td>
                      <span className={cn("tabular-nums", oz.oran >= 0.15 ? "font-medium text-danger" : oz.oran >= 0.08 ? "text-warning" : "")}>
                        %{Math.round(oz.oran * 100)}
                      </span>
                      <span className="ml-1 text-xs text-muted-foreground">({oz.gelmedi}/{oz.toplam})</span>
                    </Td>
                    <Td><KayitDurumRozeti durum={k.durum} /></Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
