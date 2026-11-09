import { Checkbox, Field, Input, Select } from "@/components/ui";
import { useApp, useOturum } from "@/context/AppContext";
import { rolAdlari, tanimlar, type Personel, type Rol } from "@/data/store";
import { atanabilirRoller } from "../02-kullanicilar/kurallar";

/** Ücret alanları yalnızca görebilene çizilir; şube ve görev seçenekleri aktörün atayabildikleriyle sınırlıdır */
export function PersonelForm({ f, setF, ucretGorunur }: { f: Personel; setF: (p: Personel) => void; ucretGorunur: boolean }) {
  const { moduller } = useApp();
  const { rol, kapsam } = useOturum();
  const roller = [...new Set([...atanabilirRoller(rol), f.gorev])];
  const subeler = tanimlar().subeler.filter((s) => kapsam.includes(s.id) || f.subeIds.includes(s.id));
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Ad"><Input value={f.ad} onChange={(e) => setF({ ...f, ad: e.target.value })} /></Field>
        <Field label="Soyad"><Input value={f.soyad} onChange={(e) => setF({ ...f, soyad: e.target.value })} /></Field>
        <Field label="Telefon"><Input value={f.telefon} onChange={(e) => setF({ ...f, telefon: e.target.value })} /></Field>
        <Field label="E-posta"><Input type="email" value={f.eposta} onChange={(e) => setF({ ...f, eposta: e.target.value })} /></Field>
        <Field label="Görev">
          <Select value={f.gorev} onChange={(e) => setF({ ...f, gorev: e.target.value as Rol })}>
            {roller.map((k) => <option key={k} value={k}>{rolAdlari[k]}</option>)}
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
        {subeler.map((s) => (
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
      {moduller.hakedis && ucretGorunur && f.gorev === "ogretmen" && (
        <div className="grid grid-cols-3 gap-3 rounded-md border p-3">
          <Field label="Ücret tipi">
            <Select value={f.ucretTipi} onChange={(e) => setF({ ...f, ucretTipi: e.target.value as Personel["ucretTipi"] })}>
              <option value="sabit">Sabit maaş</option>
              <option value="ders">Ders başı</option>
              <option value="karma">Karma</option>
            </Select>
          </Field>
          {f.ucretTipi !== "ders" && (
            <Field label="Sabit (₺/ay)"><Input type="number" min={0} step="0.01" value={f.sabitUcret} onChange={(e) => setF({ ...f, sabitUcret: Number(e.target.value) })} /></Field>
          )}
          {f.ucretTipi !== "sabit" && (
            <Field label="Ders ücreti (₺)"><Input type="number" min={0} step="0.01" value={f.dersUcreti} onChange={(e) => setF({ ...f, dersUcreti: Number(e.target.value) })} /></Field>
          )}
        </div>
      )}
    </div>
  );
}
