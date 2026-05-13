import { createFileRoute, useNavigate, useParams, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Trash2, Upload, IdCard } from "lucide-react";
import { toast } from "sonner";
import { downloadIdCard } from "@/lib/idcard";

export const Route = createFileRoute("/_authenticated/students/$id")({
  component: StudentEditor,
});

function StudentEditor() {
  const { id } = useParams({ from: "/_authenticated/students/$id" });
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const isNew = id === "new";

  const { data: student, refetch } = useQuery({
    queryKey: ["student", id],
    enabled: !isNew,
    queryFn: async () => {
      const { data } = await supabase.from("students").select("*").eq("id", id).maybeSingle();
      return data;
    },
  });

  const [form, setForm] = useState({
    admission_number: "",
    barcode: "",
    full_name: "",
    programme: "",
    nta_level: "",
    year_of_study: 1,
    status: "active" as "active" | "suspended" | "graduated",
    notes: "",
    expires_at: "",
    is_visitor: false,
    parent_email: "",
    parent_phone: "",
  });
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (student) {
      setForm({
        admission_number: student.admission_number,
        barcode: student.barcode,
        full_name: student.full_name,
        programme: student.programme ?? "",
        nta_level: student.nta_level ?? "",
        year_of_study: student.year_of_study ?? 1,
        status: student.status,
        notes: student.notes ?? "",
        expires_at: student.expires_at ?? "",
        is_visitor: student.is_visitor ?? false,
        parent_email: student.parent_email ?? "",
        parent_phone: student.parent_phone ?? "",
      });
      setPhotoUrl(student.photo_url ?? null);
      if (student.photo_url) {
        supabase.storage.from("student-photos").createSignedUrl(student.photo_url, 600)
          .then(({ data }) => setPhotoPreview(data?.signedUrl ?? null));
      }
    }
  }, [student]);

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/verify" />;

  const handlePhoto = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("student-photos").upload(path, file, { upsert: false });
      if (error) throw error;
      setPhotoUrl(path);
      const { data } = await supabase.storage.from("student-photos").createSignedUrl(path, 600);
      setPhotoPreview(data?.signedUrl ?? null);
      toast.success("Photo uploaded");
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        photo_url: photoUrl,
        year_of_study: Number(form.year_of_study),
        expires_at: form.expires_at || null,
        parent_email: form.parent_email || null,
        parent_phone: form.parent_phone || null,
      };
      if (isNew) {
        const { data, error } = await supabase.from("students").insert(payload).select().single();
        if (error) throw error;
        toast.success("Student created");
        navigate({ to: "/students/$id", params: { id: data.id } });
      } else {
        const { error } = await supabase.from("students").update(payload).eq("id", id);
        if (error) throw error;
        toast.success("Saved");
        refetch();
      }
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm("Delete this student? This cannot be undone.")) return;
    const { error } = await supabase.from("students").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    navigate({ to: "/students" });
  };

  const printIdCard = async () => {
    let photoDataUrl: string | null = null;
    if (photoPreview) {
      try {
        const blob = await (await fetch(photoPreview)).blob();
        photoDataUrl = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(blob); });
      } catch {}
    }
    downloadIdCard({
      full_name: form.full_name, admission_number: form.admission_number, barcode: form.barcode,
      programme: form.programme, nta_level: form.nta_level, year_of_study: form.year_of_study,
      photoDataUrl, is_visitor: form.is_visitor, expires_at: form.expires_at || null,
    });
  };

  return (
    <div className="space-y-6">
      <Link to="/students" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to students
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{isNew ? "New student" : form.full_name || "Edit student"}</h1>
          <p className="text-sm text-muted-foreground">All fields except notes are required.</p>
        </div>
        {!isNew && <Button variant="outline" onClick={printIdCard}><IdCard className="mr-2 h-4 w-4" /> Download ID card</Button>}
      </div>

      <div className="grid gap-6 md:grid-cols-[280px_1fr]">
        <div className="space-y-3">
          <div className="aspect-square overflow-hidden rounded-xl border border-border bg-secondary">
            {photoPreview ? (
              <img src={photoPreview} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full place-items-center text-xs text-muted-foreground">No photo</div>
            )}
          </div>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border bg-card px-3 py-2 text-sm hover:bg-secondary">
            <Upload className="h-4 w-4" />
            {uploading ? "Uploading…" : "Upload photo"}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handlePhoto(e.target.files[0])} disabled={uploading} />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Admission number" value={form.admission_number} onChange={(v) => setForm((f) => ({ ...f, admission_number: v }))} />
          <Field label="Barcode" value={form.barcode} onChange={(v) => setForm((f) => ({ ...f, barcode: v }))} />
          <div className="sm:col-span-2"><Field label="Full name" value={form.full_name} onChange={(v) => setForm((f) => ({ ...f, full_name: v }))} /></div>
          <Field label="Programme" value={form.programme} onChange={(v) => setForm((f) => ({ ...f, programme: v }))} />
          <Field label="NTA level" value={form.nta_level} onChange={(v) => setForm((f) => ({ ...f, nta_level: v }))} />
          <div className="space-y-1.5">
            <Label>Year of study</Label>
            <Input type="number" min={1} max={6} value={form.year_of_study} onChange={(e) => setForm((f) => ({ ...f, year_of_study: Number(e.target.value) }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as any }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="graduated">Graduated</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Expires at (optional)</Label>
            <Input type="date" value={form.expires_at} onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))} />
          </div>
          <div className="flex items-end justify-between space-y-1.5">
            <div><Label>Visitor pass</Label><p className="text-xs text-muted-foreground">Mark as temporary</p></div>
            <Switch checked={form.is_visitor} onCheckedChange={(v) => setForm((f) => ({ ...f, is_visitor: v }))} />
          </div>
          <Field label="Parent email" value={form.parent_email} onChange={(v) => setForm((f) => ({ ...f, parent_email: v }))} />
          <Field label="Parent phone" value={form.parent_phone} onChange={(v) => setForm((f) => ({ ...f, parent_phone: v }))} />
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        {!isNew && (
          <Button variant="outline" onClick={remove} className="text-destructive hover:text-destructive">
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </Button>
        )}
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={() => navigate({ to: "/students" })}>Cancel</Button>
          <Button onClick={save} disabled={saving || !form.admission_number || !form.barcode || !form.full_name}>
            {saving ? "Saving…" : "Save student"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
