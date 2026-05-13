import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { isAdmin, loading } = useAuth();
  const { data, refetch } = useQuery({
    queryKey: ["settings"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("settings").select("*");
      return data ?? [];
    },
  });

  const [collegeName, setCollegeName] = useState("");
  const [timeout_, setTimeout_] = useState("30");
  const [showPhoto, setShowPhoto] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    const get = (k: string) => data.find((s) => s.key === k)?.value;
    setCollegeName(String(get("college_name") ?? "").replace(/^"|"$/g, ""));
    setTimeout_(String(get("session_timeout_minutes") ?? "30"));
    setShowPhoto(get("show_photo_on_scan") !== false);
  }, [data]);

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/verify" />;

  const save = async () => {
    setSaving(true);
    const t = Number(timeout_);
    if (t < 5 || t > 480) {
      toast.error("Session timeout must be between 5 and 480 minutes");
      setSaving(false);
      return;
    }
    const updates = [
      { key: "college_name", value: JSON.stringify(collegeName) },
      { key: "session_timeout_minutes", value: t },
      { key: "show_photo_on_scan", value: showPhoto },
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

      <div className="max-w-xl space-y-5 rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="space-y-1.5">
          <Label>College name</Label>
          <Input value={collegeName} onChange={(e) => setCollegeName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Session timeout (minutes)</Label>
          <Input type="number" min={5} max={480} value={timeout_} onChange={(e) => setTimeout_(e.target.value)} />
          <p className="text-xs text-muted-foreground">Inactive operators are logged out after this period. Range: 5–480.</p>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <Label>Show student photo on scan</Label>
            <p className="text-xs text-muted-foreground">Disable to operate without portraits.</p>
          </div>
          <Switch checked={showPhoto} onCheckedChange={setShowPhoto} />
        </div>
        <div className="flex justify-end pt-2">
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save settings"}</Button>
        </div>
      </div>
    </div>
  );
}
