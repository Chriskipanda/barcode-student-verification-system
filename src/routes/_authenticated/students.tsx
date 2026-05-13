import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Users, Download, Upload, IdCard, Image as ImgIcon } from "lucide-react";
import { downloadCSV, parseCSV } from "@/lib/csv";
import { downloadBulkIdCards, type IdCardStudent } from "@/lib/idcard";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/students")({
  component: StudentsPage,
});

function StudentsPage() {
  const { isAdmin, loading } = useAuth();
  const [search, setSearch] = useState("");
  const csvInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const { data: students, isLoading, refetch } = useQuery({
    queryKey: ["students", search],
    queryFn: async () => {
      let q = supabase.from("students").select("*").order("created_at", { ascending: false }).limit(500);
      if (search.trim()) {
        const s = `%${search.trim()}%`;
        q = q.or(`full_name.ilike.${s},admission_number.ilike.${s},barcode.ilike.${s}`);
      }
      const { data } = await q;
      return data ?? [];
    },
  });

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/verify" />;

  const exportCSV = () => {
    if (!students?.length) return;
    downloadCSV(`students-${new Date().toISOString().slice(0, 10)}.csv`,
      students.map(({ id, photo_url, created_at, updated_at, ...rest }) => rest));
  };

  const importCSV = async (file: File) => {
    setBusy(true);
    try {
      const rows = await parseCSV<any>(file);
      const payload = rows.filter((r) => r.admission_number && r.barcode && r.full_name).map((r) => ({
        admission_number: r.admission_number,
        barcode: r.barcode,
        full_name: r.full_name,
        programme: r.programme || "",
        nta_level: r.nta_level || "",
        year_of_study: Number(r.year_of_study) || 1,
        status: r.status || "active",
        is_visitor: r.is_visitor === "true" || r.is_visitor === true,
        expires_at: r.expires_at || null,
        parent_email: r.parent_email || null,
        parent_phone: r.parent_phone || null,
        notes: r.notes || null,
      }));
      const { error, count } = await supabase.from("students").upsert(payload, { onConflict: "admission_number", count: "exact" } as any);
      if (error) throw error;
      toast.success(`Imported ${count ?? payload.length} students`);
      refetch();
    } catch (e: any) {
      toast.error(e.message || "Import failed");
    } finally {
      setBusy(false);
      if (csvInputRef.current) csvInputRef.current.value = "";
    }
  };

  const bulkPhotos = async (files: FileList) => {
    setBusy(true);
    let ok = 0, miss = 0;
    for (const f of Array.from(files)) {
      const adm = f.name.replace(/\.[^.]+$/, "");
      const stu = students?.find((s) => s.admission_number === adm);
      if (!stu) { miss++; continue; }
      const ext = f.name.split(".").pop();
      const path = `${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from("student-photos").upload(path, f);
      if (!up.error) {
        await supabase.from("students").update({ photo_url: path }).eq("id", stu.id);
        ok++;
      }
    }
    setBusy(false);
    toast.success(`Uploaded ${ok} photos${miss ? ` · ${miss} unmatched` : ""}`);
    refetch();
    if (photoInputRef.current) photoInputRef.current.value = "";
  };

  const printAll = async () => {
    if (!students?.length) return;
    toast.info("Generating ID cards…");
    const cards: IdCardStudent[] = [];
    for (const s of students) {
      let photoDataUrl: string | null = null;
      if (s.photo_url) {
        const { data } = await supabase.storage.from("student-photos").createSignedUrl(s.photo_url, 60);
        if (data?.signedUrl) {
          try {
            const blob = await (await fetch(data.signedUrl)).blob();
            photoDataUrl = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(blob); });
          } catch {}
        }
      }
      cards.push({ ...s, photoDataUrl } as any);
    }
    downloadBulkIdCards(cards);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Students</h1>
          <p className="text-sm text-muted-foreground">Manage student records used for gate verification.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => csvInputRef.current?.click()} disabled={busy}><Upload className="mr-2 h-4 w-4" /> Import CSV</Button>
          <input ref={csvInputRef} type="file" accept=".csv" hidden onChange={(e) => e.target.files?.[0] && importCSV(e.target.files[0])} />
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="mr-2 h-4 w-4" /> Export CSV</Button>
          <Button variant="outline" size="sm" onClick={() => photoInputRef.current?.click()} disabled={busy}><ImgIcon className="mr-2 h-4 w-4" /> Bulk photos</Button>
          <input ref={photoInputRef} type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && bulkPhotos(e.target.files)} />
          <Button variant="outline" size="sm" onClick={printAll}><IdCard className="mr-2 h-4 w-4" /> Print all IDs</Button>
          <Link to="/students/new" className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90">
            <Plus className="h-4 w-4" /> New
          </Link>
        </div>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, admission # or barcode" className="pl-9" />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {isLoading ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">Loading…</div>
        ) : (students ?? []).length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            <Users className="mx-auto mb-2 h-8 w-8 opacity-40" />
            No students yet. <Link to="/students/new" className="text-primary hover:underline">Add the first one</Link>.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-secondary text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Admission #</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Programme</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {students!.map((s) => (
                <tr key={s.id} className="hover:bg-secondary/40">
                  <td className="px-4 py-3 font-mono text-xs">{s.admission_number}</td>
                  <td className="px-4 py-3 font-medium">
                    {s.full_name}
                    {s.is_visitor && <Badge variant="outline" className="ml-2 text-[10px]">visitor</Badge>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{s.programme || "—"}</td>
                  <td className="px-4 py-3">
                    <Badge variant={s.status === "active" ? "default" : s.status === "suspended" ? "destructive" : "secondary"}>
                      {s.status}
                    </Badge>
                    {s.expires_at && new Date(s.expires_at) < new Date() && (
                      <Badge variant="destructive" className="ml-1 text-[10px]">expired</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link to="/students/$id" params={{ id: s.id }} className="text-xs text-primary hover:underline">Edit</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-muted-foreground">CSV columns: <code>admission_number, barcode, full_name, programme, nta_level, year_of_study, status, expires_at, is_visitor, parent_email, parent_phone, notes</code></p>
    </div>
  );
}
