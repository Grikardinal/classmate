/** Yazdırılabilir belge (kayıt formu, makbuz, program). Tarayıcının "PDF olarak kaydet" seçeneğiyle PDF'e dönüşür. */
import { tanimlar } from "@/data/model";

export function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

const stil = `
  *{box-sizing:border-box} body{font-family:Inter,Segoe UI,Arial,sans-serif;color:#18181b;margin:32px;font-size:13px;line-height:1.5}
  header{display:flex;align-items:center;gap:12px;border-bottom:2px solid #4f46e5;padding-bottom:12px;margin-bottom:20px}
  header .ad{font-size:18px;font-weight:600} header .alt{color:#71717a;font-size:12px}
  h1{font-size:16px;margin:0 0 12px} h2{font-size:14px;margin:20px 0 8px;color:#3730a3}
  table{width:100%;border-collapse:collapse;margin:8px 0} th,td{border:1px solid #e4e4e7;padding:6px 8px;text-align:left;vertical-align:top}
  th{background:#f4f4f5;font-weight:600;font-size:12px} .imza{display:flex;gap:48px;margin-top:48px} .imza div{flex:1;border-top:1px solid #a1a1aa;padding-top:6px;text-align:center;color:#71717a}
  .kucuk{font-size:11px;color:#71717a} .sag{text-align:right}
  @media print{body{margin:12mm}}
`;

const logo = `<svg width="36" height="36" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#4F46E5"/><path d="M21.14 9.87A8 8 0 1 0 21.14 22.13" stroke="#fff" stroke-width="3.5" stroke-linecap="round" fill="none"/><circle cx="24.6" cy="16" r="2.6" fill="#fff"/></svg>`;

export function belgeHtml(baslik: string, govde: string, altBaslik = ""): string {
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${esc(baslik)}</title><style>${stil}</style></head><body>
<header>${tanimlar().kurum.logo ? `<img src="${esc(tanimlar().kurum.logo)}" alt="" style="height:36px;max-width:120px;object-fit:contain">` : logo}<div><div class="ad">${esc(tanimlar().kurum.ad)}</div><div class="alt">${esc(altBaslik)}</div></div></header>
${govde}
</body></html>`;
}

/** Yeni pencerede açıp yazdırma iletişim kutusunu gösterir. Açılır pencere engellenirse false döner. */
export function yazdir(baslik: string, govde: string, altBaslik = ""): boolean {
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) return false;
  w.document.open();
  w.document.write(belgeHtml(baslik, govde, altBaslik));
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
  return true;
}

/** CSV olarak indir (Excel'de açılır) */
export function dosyaIndir(ad: string, icerik: string, tur = "text/csv;charset=utf-8") {
  const blob = new Blob([icerik], { type: tur });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = ad;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
