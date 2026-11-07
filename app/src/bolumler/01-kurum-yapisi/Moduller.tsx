import { Lock } from "lucide-react";
import { Alert, Badge, Card, CardContent, Switch } from "@/components/ui";
import { modulTanimlari, useApp } from "@/context/AppContext";
import { cn } from "@/lib/utils";
import { useGenel } from "./ortak";

export function Moduller() {
  const { moduller, setModul } = useApp();
  const genel = useGenel();
  return (
    <div className="grid gap-4">
      <Alert icon={<Lock />}>
        Kapalı modülün menüleri, ekranları, bildirimleri ve panel kartları <b>görünmez</b>. Veri silinmez; modül tekrar açıldığında kaldığı yerden çalışır.
        Ayar kurum geneli olarak sunucuda saklanır{genel ? "" : "; yalnızca genel yönetici değiştirebilir"}.
      </Alert>
      <div className="grid gap-3 sm:grid-cols-2">
        {modulTanimlari.map((m) => (
          <Card key={m.key} className={cn("transition", moduller[m.key] && "border-primary/40")}>
            <CardContent className="flex items-start gap-4 p-5">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{m.ad}</p>
                  <Badge variant="secondary">{m.surum}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{m.aciklama}</p>
              </div>
              <Switch label={m.ad} disabled={!genel} checked={moduller[m.key]} onCheckedChange={(v) => setModul(m.key, v)} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
