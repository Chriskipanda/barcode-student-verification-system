import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Users, ScanLine, CheckCircle2, XCircle, Clock } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { isAdmin } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const [students, todayLogs, allowed, denied] = await Promise.all([
        supabase.from("students").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("access_logs").select("id", { count: "exact", head: true }).gte("scanned_at", today.toISOString()),
        supabase.from("access_logs").select("id", { count: "exact", head: true }).eq("decision", "allowed").gte("scanned_at", today.toISOString()),
        supabase.from("access_logs").select("id", { count: "exact", head: true }).eq("decision", "denied").gte("scanned_at", today.toISOString()),
      ]);
      return { students: students.count ?? 0, scans: todayLogs.count ?? 0, allowed: allowed.count ?? 0, denied: denied.count ?? 0 };
    },
  });

  const { data: hourly } = useQuery({
    queryKey: ["dashboard-hourly"],
    queryFn: async () => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const { data } = await supabase.from("access_logs").select("scanned_at, decision").gte("scanned_at", today.toISOString());
      const buckets = Array.from({ length: 24 }, (_, h) => ({ hour: `${h}:00`, allowed: 0, denied: 0, unknown: 0 }));
      (data ?? []).forEach((l: any) => {
        const h = new Date(l.scanned_at).getHours();
        const k = l.decision as "allowed" | "denied" | "unknown";
        if (k in buckets[h]) (buckets[h] as any)[k]++;
      });
      return buckets;
    },
  });

  const { data: weekly } = useQuery({
    queryKey: ["dashboard-weekly"],
    queryFn: async () => {
      const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - 6);
      const { data } = await supabase.from("access_logs").select("scanned_at, decision").gte("scanned_at", start.toISOString());
      const days: Record<string, { day: string; allowed: number; denied: number; unknown: number }> = {};
      for (let i = 0; i < 7; i++) {
        const d = new Date(start); d.setDate(start.getDate() + i);
        const key = d.toISOString().slice(0, 10);
        days[key] = { day: d.toLocaleDateString(undefined, { weekday: "short" }), allowed: 0, denied: 0, unknown: 0 };
      }
      (data ?? []).forEach((l: any) => {
        const k = new Date(l.scanned_at).toISOString().slice(0, 10);
        if (days[k]) (days[k] as any)[l.decision]++;
      });
      return Object.values(days);
    },
  });

  const [recent, setRecent] = useState<any[]>([]);
  useEffect(() => {
    let active = true;
    supabase.from("access_logs").select("id, scanned_code, decision, reason, scanned_at, direction, student:students(full_name, admission_number)")
      .order("scanned_at", { ascending: false }).limit(10)
      .then(({ data }) => { if (active && data) setRecent(data); });
    const ch = supabase.channel("dashboard-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "access_logs" }, async (payload) => {
        const newLog: any = payload.new;
        let student = null;
        if (newLog.student_id) {
          const { data } = await supabase.from("students").select("full_name, admission_number").eq("id", newLog.student_id).maybeSingle();
          student = data;
        }
        setRecent((prev) => [{ ...newLog, student }, ...prev].slice(0, 10));
      })
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, []);

  const cards = [
    { label: "Active students", value: stats?.students ?? "—", icon: Users, color: "text-primary" },
    { label: "Scans today", value: stats?.scans ?? "—", icon: ScanLine, color: "text-foreground" },
    { label: "Allowed today", value: stats?.allowed ?? "—", icon: CheckCircle2, color: "text-success" },
    { label: "Denied today", value: stats?.denied ?? "—", icon: XCircle, color: "text-destructive" },
  ];

  const pieData = stats ? [
    { name: "Allowed", value: stats.allowed, color: "hsl(var(--success))" },
    { name: "Denied", value: stats.denied, color: "hsl(var(--destructive))" },
    { name: "Unknown", value: Math.max(0, stats.scans - stats.allowed - stats.denied), color: "hsl(var(--warning))" },
  ] : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview of gate activity{isAdmin ? "" : " — gate operator view"}.</p>
        </div>
        <Link to="/verify" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">Open gate scanner</Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
              <Icon className={`h-4 w-4 ${color}`} />
            </div>
            <p className={`mt-2 text-3xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold">Scans by hour (today)</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={hourly ?? []}>
              <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="allowed" stackId="a" fill="hsl(var(--success))" />
              <Bar dataKey="denied" stackId="a" fill="hsl(var(--destructive))" />
              <Bar dataKey="unknown" stackId="a" fill="hsl(var(--warning))" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">Decision split (today)</h2>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75}>
                {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold">Last 7 days</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={weekly ?? []}>
            <XAxis dataKey="day" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="allowed" stackId="a" fill="hsl(var(--success))" />
            <Bar dataKey="denied" stackId="a" fill="hsl(var(--destructive))" />
            <Bar dataKey="unknown" stackId="a" fill="hsl(var(--warning))" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-semibold">Live activity</h2>
          <Link to="/logs" className="text-xs text-primary hover:underline">View all</Link>
        </div>
        <div className="divide-y divide-border">
          {recent.length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">No scans yet. Open the gate scanner to begin.</div>
          )}
          {recent.map((log) => (
            <div key={log.id} className="flex items-center gap-3 px-5 py-3 text-sm">
              {log.decision === "allowed" ? <CheckCircle2 className="h-4 w-4 text-success" /> :
               log.decision === "denied" ? <XCircle className="h-4 w-4 text-destructive" /> :
               <Clock className="h-4 w-4 text-muted-foreground" />}
              {log.direction && <span className="rounded bg-secondary px-1.5 text-[10px] uppercase text-muted-foreground">{log.direction}</span>}
              <div className="flex-1 truncate">
                <span className="font-medium">{log.student?.full_name ?? log.scanned_code}</span>
                {log.student?.admission_number && <span className="ml-2 text-xs text-muted-foreground">{log.student.admission_number}</span>}
                {log.reason && <span className="ml-2 text-xs text-muted-foreground">· {log.reason}</span>}
              </div>
              <span className="text-xs text-muted-foreground">{new Date(log.scanned_at).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
