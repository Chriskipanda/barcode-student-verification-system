import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CheckCircle2, XCircle, AlertTriangle, Search, Download, Activity } from "lucide-react";
import { downloadCSV } from "@/lib/csv";
import jsPDF from "jspdf";

export const Route = createFileRoute("/_authenticated/logs")({
  component: LogsPage,
});

function LogsPage() {
  const [search, setSearch] = useState("");
  const [decision, setDecision] = useState<string>("all");
  const [direction, setDirection] = useState<string>("all");
  const [live, setLive] = useState(false);

  const { data: gates } = useQuery({
    queryKey: ["gates-min"],
    queryFn: async () => (await supabase.from("gates").select("id,name")).data ?? [],
  });
  const [gateId, setGateId] = useState("all");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["logs", search, decision, direction, gateId],
    queryFn: async () => {
      let q = supabase.from("access_logs")
        .select("id, scanned_code, decision, reason, scanned_at, direction, gate_id, student:students(full_name, admission_number, programme)")
        .order("scanned_at", { ascending: false }).limit(1000);
      if (decision !== "all") q = q.eq("decision", decision as any);
      if (direction !== "all") q = q.eq("direction", direction as any);
      if (gateId !== "all") q = q.eq("gate_id", gateId);
      if (search.trim()) q = q.ilike("scanned_code", `%${search.trim()}%`);
      const { data } = await q;
      return data ?? [];
    },
  });

  // Live realtime
  useEffect(() => {
    if (!live) return;
    const ch = supabase.channel("logs-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "access_logs" }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [live, refetch]);

  const gateName = (id: string | null) => gates?.find((g) => g.id === id)?.name ?? "—";

  const exportCSV = () => {
    if (!data?.length) return;
    downloadCSV(`logs-${new Date().toISOString().slice(0, 10)}.csv`,
      data.map((l: any) => ({
        when: l.scanned_at, decision: l.decision, direction: l.direction ?? "", gate: gateName(l.gate_id),
        student: l.student?.full_name ?? "", admission: l.student?.admission_number ?? "",
        scanned_code: l.scanned_code, reason: l.reason ?? "",
      })));
  };

  const exportPDF = () => {
    if (!data?.length) return;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    doc.setFontSize(14); doc.text("Access Logs", 40, 40);
    doc.setFontSize(9);
    let y = 70;
    doc.text("When", 40, y); doc.text("Decision", 160, y); doc.text("Dir", 220, y); doc.text("Student", 250, y); doc.text("Code", 420, y); doc.text("Reason", 500, y);
    y += 12; doc.line(40, y, 555, y); y += 12;
    for (const l of data as any[]) {
      if (y > 800) { doc.addPage(); y = 40; }
      doc.text(new Date(l.scanned_at).toLocaleString().slice(0, 18), 40, y);
      doc.text(l.decision, 160, y);
      doc.text(l.direction ?? "—", 220, y);
      doc.text((l.student?.full_name ?? "—").slice(0, 28), 250, y);
      doc.text(String(l.scanned_code).slice(0, 14), 420, y);
      doc.text((l.reason ?? "").slice(0, 18), 500, y);
      y += 14;
    }
    doc.save(`logs-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const attendance = useMemo(() => {
    if (!data) return [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const map = new Map<string, { name: string; programme: string; firstIn: string | null; lastOut: string | null }>();
    for (const l of [...data].reverse() as any[]) {
      if (new Date(l.scanned_at) < today) continue;
      if (!l.student?.admission_number) continue;
      const key = l.student.admission_number;
      const cur = map.get(key) ?? { name: l.student.full_name, programme: l.student.programme ?? "", firstIn: null, lastOut: null };
      if (l.direction === "in" && !cur.firstIn) cur.firstIn = l.scanned_at;
      if (l.direction === "out") cur.lastOut = l.scanned_at;
      map.set(key, cur);
    }
    return Array.from(map.entries()).map(([k, v]) => ({ admission: k, ...v }));
  }, [data]);

  const exportAttendance = () => {
    downloadCSV(`attendance-${new Date().toISOString().slice(0, 10)}.csv`,
      attendance.map((a) => ({ admission: a.admission, name: a.name, programme: a.programme, first_entry: a.firstIn ?? "", last_exit: a.lastOut ?? "" })));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Access logs</h1>
          <p className="text-sm text-muted-foreground">Audit trail of every scan attempt.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant={live ? "default" : "outline"} onClick={() => setLive((l) => !l)}>
            <Activity className="mr-2 h-4 w-4" /> {live ? "Live on" : "Live"}
          </Button>
          <Button size="sm" variant="outline" onClick={exportCSV}><Download className="mr-2 h-4 w-4" /> CSV</Button>
          <Button size="sm" variant="outline" onClick={exportPDF}><Download className="mr-2 h-4 w-4" /> PDF</Button>
        </div>
      </div>

      <Tabs defaultValue="logs">
        <TabsList>
          <TabsTrigger value="logs">All logs</TabsTrigger>
          <TabsTrigger value="attendance">Today's attendance</TabsTrigger>
        </TabsList>

        <TabsContent value="logs" className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by scanned code…" className="pl-9" />
            </div>
            <Select value={decision} onValueChange={setDecision}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All decisions</SelectItem>
                <SelectItem value="allowed">Allowed</SelectItem>
                <SelectItem value="denied">Denied</SelectItem>
                <SelectItem value="unknown">Unknown</SelectItem>
              </SelectContent>
            </Select>
            <Select value={direction} onValueChange={setDirection}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">In + Out</SelectItem>
                <SelectItem value="in">Entry</SelectItem>
                <SelectItem value="out">Exit</SelectItem>
              </SelectContent>
            </Select>
            <Select value={gateId} onValueChange={setGateId}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All gates</SelectItem>
                {(gates ?? []).map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
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
                    <th className="px-4 py-3 text-left">Dir</th>
                    <th className="px-4 py-3 text-left">Gate</th>
                    <th className="px-4 py-3 text-left">Student</th>
                    <th className="px-4 py-3 text-left">Code</th>
                    <th className="px-4 py-3 text-left">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(data as any[]).map((log) => (
                    <tr key={log.id}>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(log.scanned_at).toLocaleString()}</td>
                      <td className="px-4 py-3"><DecisionBadge d={log.decision} /></td>
                      <td className="px-4 py-3 text-xs uppercase text-muted-foreground">{log.direction ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{gateName(log.gate_id)}</td>
                      <td className="px-4 py-3">
                        {log.student ? (
                          <div><div className="font-medium">{log.student.full_name}</div><div className="text-xs text-muted-foreground">{log.student.admission_number}</div></div>
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
        </TabsContent>

        <TabsContent value="attendance" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={exportAttendance}><Download className="mr-2 h-4 w-4" /> Export CSV</Button>
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            {attendance.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-muted-foreground">No entries today.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-secondary text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Admission</th>
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Programme</th>
                    <th className="px-4 py-3 text-left">First entry</th>
                    <th className="px-4 py-3 text-left">Last exit</th>
                    <th className="px-4 py-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {attendance.map((a) => (
                    <tr key={a.admission}>
                      <td className="px-4 py-3 font-mono text-xs">{a.admission}</td>
                      <td className="px-4 py-3 font-medium">{a.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{a.programme || "—"}</td>
                      <td className="px-4 py-3 text-xs">{a.firstIn ? new Date(a.firstIn).toLocaleTimeString() : "—"}</td>
                      <td className="px-4 py-3 text-xs">{a.lastOut ? new Date(a.lastOut).toLocaleTimeString() : "—"}</td>
                      <td className="px-4 py-3">
                        {a.firstIn && !a.lastOut ? <Badge className="bg-success text-success-foreground">on campus</Badge>
                          : a.lastOut ? <Badge variant="secondary">left</Badge>
                          : <Badge variant="outline">—</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DecisionBadge({ d }: { d: string }) {
  if (d === "allowed") return <Badge className="gap-1 bg-success text-success-foreground"><CheckCircle2 className="h-3 w-3" /> Allowed</Badge>;
  if (d === "denied") return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Denied</Badge>;
  return <Badge variant="secondary" className="gap-1"><AlertTriangle className="h-3 w-3" /> Unknown</Badge>;
}
