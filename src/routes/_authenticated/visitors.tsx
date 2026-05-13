import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { downloadIdCard } from "@/lib/idcard";

export const Route = createFileRoute("/_authenticated/visitors")({
  component: VisitorsPage,
});

function VisitorsPage() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: "", reason: "", parent_phone: "", expires_at: new Date(Date.now() + 86400000).toISOString().slice(0, 10) });
  const [busy, setBusy] = useState(false);

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/verify" />;

  const create = async () => {
    if (!form.full_name.trim()) return toast.error("Name required");
    setBusy(true);
    const code = `V-${Date.now().toString(36).toUpperCase()}`;
    const { data, error } = await supabase.from("students").insert({
      admission_number: code,
      barcode: code,
      full_name: form.full_name.trim(),
      programme: form.reason || "Visitor",
      nta_level: "—",
      year_of_study: 1,
      status: "active",
      is_visitor: true,
      expires_at: form.expires_at,
      parent_phone: form.parent_phone || null,
      notes: form.reason || null,
    }).select().single();
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Visitor pass created");
    downloadIdCard({
      full_name: data.full_name, admission_number: data.admission_number, barcode: data.barcode,
      programme: data.programme, nta_level: data.nta_level, year_of_study: data.year_of_study,
      is_visitor: true, expires_at: form.expires_at,
    });
    setTimeout(() => navigate({ to: "/students/$id", params: { id: data.id } }), 500);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Visitor pass</h1>
        <p className="text-sm text-muted-foreground">Issue a temporary barcode that expires automatically.</p>
      </div>
      <div className="max-w-xl space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="space-y-1.5"><Label>Visitor name</Label><Input value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} /></div>
        <div className="space-y-1.5"><Label>Reason / Host</Label><Input value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder="e.g. Meeting Dean of Students" /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>Phone (optional)</Label><Input value={form.parent_phone} onChange={(e) => setForm((f) => ({ ...f, parent_phone: e.target.value }))} /></div>
          <div className="space-y-1.5"><Label>Valid until</Label><Input type="date" value={form.expires_at} onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))} /></div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={create} disabled={busy}>
            {busy ? "Creating…" : <><UserPlus className="mr-2 h-4 w-4" /> Create & Download Pass <Download className="ml-2 h-4 w-4" /></>}
          </Button>
        </div>
      </div>
    </div>
  );
}
