import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { isAdmin, loading } = useAuth();
  const { data, refetch } = useQuery({
    queryKey: ["settings"],
    enabled: isAdmin,
    queryFn: async () => (await supabase.from("settings").select("*")).data ?? [],
  });

  const [collegeName, setCollegeName] = useState("");
  const [timeout_, setTimeout_] = useState("30");
  const [showPhoto, setShowPhoto] = useState(true);
  const [antiPassback, setAntiPassback] = useState("15");
  const [denialThreshold, setDenialThreshold] = useState("5");
  const [notifyParents, setNotifyParents] = useState(false);
  const [defaultDir, setDefaultDir] = useState<"in" | "out">("in");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    const get = (k: string) => data.find((s) => s.key === k)?.value;
    setCollegeName(String(get("college_name") ?? "").replace(/^"|"$/g, ""));
    setTimeout_(String(get("session_timeout_minutes") ?? "30"));
    setShowPhoto(get("show_photo_on_scan") !== false);
    setAntiPassback(String(get("anti_passback_seconds") ?? "15"));
    setDenialThreshold(String(get("denial_alert_threshold") ?? "5"));
    setNotifyParents(get("notify_parents_enabled") === true);
    setDefaultDir((String(get("default_direction") ?? "in").replace(/"/g, "") as "in" | "out") || "in");
  }, [data]);

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/verify" />;

  const save = async () => {
    setSaving(true);
    const t = Number(timeout_);
    if (t < 5 || t > 480) { toast.error("Session timeout must be 5–480"); setSaving(false); return; }
    const updates = [
      { key: "college_name", value: JSON.stringify(collegeName) },
      { key: "session_timeout_minutes", value: t },
      { key: "show_photo_on_scan", value: showPhoto },
      { key: "anti_passback_seconds", value: Number(antiPassback) },
      { key: "denial_alert_threshold", value: Number(denialThreshold) },
      { key: "notify_parents_enabled", value: notifyParents },
      { key: "default_direction", value: JSON.stringify(defaultDir) },
    ];
    for (const u of updates) {
      await supabase.from("settings").upsert({ key: u.key, value: u.value as any });
    }
    toast.success("Settings saved");
    setSaving(false);
    refetch();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">System-wide configuration.</p>
      </div>

      <div className="grid max-w-2xl gap-5 rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="space-y-1.5"><Label>College name</Label><Input value={collegeName} onChange={(e) => setCollegeName(e.target.value)} /></div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Session timeout (minutes)</Label>
            <Input type="number" min={5} max={480} value={timeout_} onChange={(e) => setTimeout_(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Default scan direction</Label>
            <Select value={defaultDir} onValueChange={(v) => setDefaultDir(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="in">Entry</SelectItem>
                <SelectItem value="out">Exit</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Anti-passback window (seconds)</Label>
            <Input type="number" min={0} max={300} value={antiPassback} onChange={(e) => setAntiPassback(e.target.value)} />
            <p className="text-xs text-muted-foreground">Block re-scan of the same code within this window.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Denial alert threshold</Label>
            <Input type="number" min={1} value={denialThreshold} onChange={(e) => setDenialThreshold(e.target.value)} />
            <p className="text-xs text-muted-foreground">Alert admin after N denials in 10 min.</p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div><Label>Show student photo on scan</Label><p className="text-xs text-muted-foreground">Disable for portrait-free operation.</p></div>
          <Switch checked={showPhoto} onCheckedChange={setShowPhoto} />
        </div>
        <div className="flex items-center justify-between">
          <div><Label>Email parents on entry/exit</Label><p className="text-xs text-muted-foreground">Requires email service connection.</p></div>
          <Switch checked={notifyParents} onCheckedChange={setNotifyParents} />
        </div>
        <div className="flex justify-end pt-2">
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save settings"}</Button>
        </div>
      </div>
    </div>
  );
}
