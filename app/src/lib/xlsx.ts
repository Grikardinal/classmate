/**
 * Bağımlılıksız, küçük .xlsx okuyucu: ilk çalışma sayfasını string[][] olarak döndürür.
 * .xlsx bir ZIP arşividir; dosyalar tarayıcının DecompressionStream("deflate-raw") özelliğiyle açılır.
 */

async function inflate(veri: Uint8Array): Promise<Uint8Array> {
  const akis = new Blob([veri]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(akis).arrayBuffer());
}

async function zipOku(buf: ArrayBuffer): Promise<Map<string, () => Promise<string>>> {
  const v = new DataView(buf);
  const b = new Uint8Array(buf);
  // Merkezi dizinin sonu (EOCD) kaydını sondan ara
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) {
    if (v.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Geçerli bir .xlsx dosyası değil");
  const adet = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const cozucu = new TextDecoder();
  const dosyalar = new Map<string, () => Promise<string>>();
  for (let i = 0; i < adet; i++) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const yontem = v.getUint16(p + 10, true);
    const sikisik = v.getUint32(p + 20, true);
    const adUz = v.getUint16(p + 28, true);
    const ekUz = v.getUint16(p + 30, true);
    const yorumUz = v.getUint16(p + 32, true);
    const yerel = v.getUint32(p + 42, true);
    const ad = cozucu.decode(b.subarray(p + 46, p + 46 + adUz));
    dosyalar.set(ad, async () => {
      const lAd = v.getUint16(yerel + 26, true);
      const lEk = v.getUint16(yerel + 28, true);
      const bas = yerel + 30 + lAd + lEk;
      const ham = b.subarray(bas, bas + sikisik);
      const acik = yontem === 0 ? ham : await inflate(ham);
      return cozucu.decode(acik);
    });
    p += 46 + adUz + ekUz + yorumUz;
  }
  return dosyalar;
}

function sutunIndeksi(ref: string): number {
  const harf = ref.replace(/\d+/g, "");
  let n = 0;
  for (const c of harf) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

/** Excel tarih seri numarasını YYYY-MM-DD'ye çevirir */
function excelTarih(seri: number): string {
  const d = new Date(Date.UTC(1899, 11, 30) + seri * 86400000);
  return d.toISOString().slice(0, 10);
}

export async function xlsxOku(dosya: File): Promise<string[][]> {
  const z = await zipOku(await dosya.arrayBuffer());
  const xml = (s: string) => new DOMParser().parseFromString(s, "application/xml");

  const paylasilan: string[] = [];
  const ss = z.get("xl/sharedStrings.xml");
  if (ss) {
    const doc = xml(await ss());
    for (const si of Array.from(doc.getElementsByTagName("si"))) {
      paylasilan.push(Array.from(si.getElementsByTagName("t")).map((t) => t.textContent ?? "").join(""));
    }
  }
  // Tarih biçimli hücre stillerini bul (basit sezgisel: numFmtId 14–22 veya özel tarih biçimleri)
  const tarihStilleri = new Set<number>();
  const stil = z.get("xl/styles.xml");
  if (stil) {
    const doc = xml(await stil());
    const ozel = new Set(
      Array.from(doc.getElementsByTagName("numFmt"))
        .filter((n) => /[dmy]/i.test(n.getAttribute("formatCode") ?? "") && !/[h]/i.test(n.getAttribute("formatCode") ?? ""))
        .map((n) => Number(n.getAttribute("numFmtId"))),
    );
    const xfs = doc.getElementsByTagName("cellXfs")[0];
    Array.from(xfs?.getElementsByTagName("xf") ?? []).forEach((xf, i) => {
      const id = Number(xf.getAttribute("numFmtId"));
      if ((id >= 14 && id <= 22) || ozel.has(id)) tarihStilleri.add(i);
    });
  }

  const sayfaAdi = [...z.keys()].filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort()[0];
  if (!sayfaAdi) throw new Error("Çalışma sayfası bulunamadı");
  const sayfa = xml(await z.get(sayfaAdi)!());
  const satirlar: string[][] = [];
  for (const row of Array.from(sayfa.getElementsByTagName("row"))) {
    const satir: string[] = [];
    for (const c of Array.from(row.getElementsByTagName("c"))) {
      const ref = c.getAttribute("r") ?? "";
      const i = ref ? sutunIndeksi(ref) : satir.length;
      const tur = c.getAttribute("t");
      const vEl = c.getElementsByTagName("v")[0];
      let deger = "";
      if (tur === "s") deger = paylasilan[Number(vEl?.textContent ?? -1)] ?? "";
      else if (tur === "inlineStr") deger = Array.from(c.getElementsByTagName("t")).map((t) => t.textContent ?? "").join("");
      else if (vEl) {
        deger = vEl.textContent ?? "";
        const s = Number(c.getAttribute("s") ?? -1);
        if (tarihStilleri.has(s) && /^\d+(\.\d+)?$/.test(deger)) deger = excelTarih(Number(deger));
      }
      satir[i] = deger;
    }
    satirlar.push(Array.from(satir, (x) => x ?? ""));
  }
  return satirlar.filter((s) => s.some((h) => String(h).trim() !== ""));
}
