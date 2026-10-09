/** Sunucu API istemcisi: çerezle oturum, JSON gövde, Türkçe hata mesajı */
export class ApiHatasi extends Error {
  constructor(message: string, public durum: number) {
    super(message);
  }
}

export async function api<T = unknown>(yol: string, govde?: unknown, yontem?: string): Promise<T> {
  let r: Response;
  try {
    r = await fetch(yol, {
      method: yontem ?? (govde === undefined ? "GET" : "POST"),
      credentials: "same-origin",
      headers: govde === undefined ? undefined : { "content-type": "application/json" },
      body: govde === undefined ? undefined : JSON.stringify(govde),
    });
  } catch {
    throw new ApiHatasi("Sunucuya ulaşılamıyor. İnternet bağlantınızı kontrol edin.", 0);
  }
  const metin = await r.text();
  let veri: unknown = null;
  try {
    veri = metin ? JSON.parse(metin) : null;
  } catch {
    /* JSON değil */
  }
  if (!r.ok) throw new ApiHatasi((veri as { hata?: string })?.hata ?? `İstek başarısız (${r.status})`, r.status);
  return veri as T;
}

export type SunucuDurumu = {
  surum: number;
  demo: boolean;
  vt: string;
  sms: string;
  push: boolean;
  kurum: string;
  demoHesaplar?: { eposta: string; ad: string; rol: string }[];
  demoParola?: string;
  demoVeliler?: { ad: string; telefon: string; cocuklar: string }[];
};
