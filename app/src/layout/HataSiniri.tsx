import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui";

/** Bir ekranda beklenmedik hata olursa tüm uygulama boş kalmasın; yalnızca o bölüm uyarı gösterir. */
export class HataSiniri extends React.Component<{ children: React.ReactNode; anahtar?: string }, { hata: Error | null }> {
  state = { hata: null as Error | null };
  static getDerivedStateFromError(hata: Error) {
    return { hata };
  }
  componentDidUpdate(onceki: { anahtar?: string }) {
    if (onceki.anahtar !== this.props.anahtar && this.state.hata) this.setState({ hata: null });
  }
  componentDidCatch(hata: Error) {
    console.error("Ekran hatası:", hata);
  }
  render() {
    if (!this.state.hata) return this.props.children;
    return (
      <div className="grid place-items-center py-16">
        <div className="max-w-md rounded-lg border bg-card p-6 text-center">
          <AlertTriangle className="mx-auto size-8 text-warning" />
          <p className="mt-3 font-medium">Bu ekran açılırken bir sorun oluştu.</p>
          <p className="mt-1 text-sm text-muted-foreground">Sayfayı yenileyin; sorun sürerse yöneticinize bildirin.</p>
          <p className="mt-3 break-words font-mono text-xs text-muted-foreground">{this.state.hata.message}</p>
          <Button className="mt-4" onClick={() => window.location.reload()}>Yenile</Button>
        </div>
      </div>
    );
  }
}
