import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertTriangle, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/logs")({
  component: LogsPage,
});

function LogsPage() {
  const [search, setSearch] = useState("");
  const [decision, setDecision] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["logs", search, decision],
    queryFn: async () => {
      let q = supabase
        .from("access_logs")
        .select("id, scanned_code, decision, reason, scanned_at, student:students(full_name, admission_number)")
        .order("scanned_at", { ascending: false })
        .limit(500);
      if (decision !== "all") q = q.eq("decision", decision as any);
      if (search.trim()) q = q.ilike("scanned_code", `%${search.trim()}%`);
      const { data } = await q;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Access logs</h1>
        <p className="text-sm text-muted-foreground">Audit trail of every scan attempt.</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by scanned code…" className="pl-9" />
        </div>
        <Select value={decision} onValueChange={setDecision}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All decisions</SelectItem>
            <SelectItem value="allowed">Allowed</SelectItem>
            <SelectItem value="denied">Denied</SelectItem>
            <SelectItem value="unknown">Unknown</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {isLoading ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">Loading…</div>
        ) : (data ?? []).length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">No logs match your filter.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-secondary text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">When</th>
                <th className="px-4 py-3 text-left">Decision</th>
                <th className="px-4 py-3 text-left">Student</th>
                <th className="px-4 py-3 text-left">Code</th>
                <th className="px-4 py-3 text-left">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data!.map((log: any) => (
                <tr key={log.id}>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(log.scanned_at).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <DecisionBadge d={log.decision} />
                  </td>
                  <td className="px-4 py-3">
                    {log.student ? (
                      <div>
                        <div className="font-medium">{log.student.full_name}</div>
                        <div className="text-xs text-muted-foreground">{log.student.admission_number}</div>
                      </div>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{log.scanned_code}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{log.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function DecisionBadge({ d }: { d: string }) {
  if (d === "allowed") return <Badge className="gap-1 bg-success text-success-foreground"><CheckCircle2 className="h-3 w-3" /> Allowed</Badge>;
  if (d === "denied") return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Denied</Badge>;
  return <Badge variant="secondary" className="gap-1"><AlertTriangle className="h-3 w-3" /> Unknown</Badge>;
}
