import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Users } from "lucide-react";
import { Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/students")({
  component: StudentsPage,
});

function StudentsPage() {
  const { isAdmin, loading } = useAuth();
  const [search, setSearch] = useState("");

  const { data: students, isLoading } = useQuery({
    queryKey: ["students", search],
    queryFn: async () => {
      let q = supabase.from("students").select("*").order("created_at", { ascending: false }).limit(200);
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Students</h1>
          <p className="text-sm text-muted-foreground">Manage student records used for gate verification.</p>
        </div>
        <Link to="/students/new" className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
          <Plus className="h-4 w-4" /> New student
        </Link>
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
                  <td className="px-4 py-3 font-medium">{s.full_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.programme || "—"}</td>
                  <td className="px-4 py-3">
                    <Badge variant={s.status === "active" ? "default" : s.status === "suspended" ? "destructive" : "secondary"}>
                      {s.status}
                    </Badge>
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
    </div>
  );
}
