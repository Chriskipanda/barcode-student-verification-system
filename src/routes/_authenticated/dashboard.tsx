import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Users, ScanLine, CheckCircle2, XCircle, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { isAdmin } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const [students, todayLogs, allowed, denied] = await Promise.all([
        supabase.from("students").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("access_logs").select("id", { count: "exact", head: true }).gte("scanned_at", today.toISOString()),
        supabase.from("access_logs").select("id", { count: "exact", head: true }).eq("decision", "allowed").gte("scanned_at", today.toISOString()),
        supabase.from("access_logs").select("id", { count: "exact", head: true }).eq("decision", "denied").gte("scanned_at", today.toISOString()),
      ]);
      return {
        students: students.count ?? 0,
        scans: todayLogs.count ?? 0,
        allowed: allowed.count ?? 0,
        denied: denied.count ?? 0,
      };
    },
  });

  const { data: recent } = useQuery({
    queryKey: ["recent-logs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("access_logs")
        .select("id, scanned_code, decision, reason, scanned_at, student:students(full_name, admission_number)")
        .order("scanned_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  const cards = [
    { label: "Active students", value: stats?.students ?? "—", icon: Users, color: "text-primary" },
    { label: "Scans today", value: stats?.scans ?? "—", icon: ScanLine, color: "text-foreground" },
    { label: "Allowed today", value: stats?.allowed ?? "—", icon: CheckCircle2, color: "text-success" },
    { label: "Denied today", value: stats?.denied ?? "—", icon: XCircle, color: "text-destructive" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview of gate activity{isAdmin ? "" : " — gate operator view"}.</p>
        </div>
        <Link to="/verify" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
          Open gate scanner
        </Link>
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

      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-semibold">Recent activity</h2>
          <Link to="/logs" className="text-xs text-primary hover:underline">View all</Link>
        </div>
        <div className="divide-y divide-border">
          {(recent ?? []).length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              No scans yet. Open the gate scanner to begin.
            </div>
          )}
          {(recent ?? []).map((log: any) => (
            <div key={log.id} className="flex items-center gap-3 px-5 py-3 text-sm">
              {log.decision === "allowed" ? (
                <CheckCircle2 className="h-4 w-4 text-success" />
              ) : log.decision === "denied" ? (
                <XCircle className="h-4 w-4 text-destructive" />
              ) : (
                <Clock className="h-4 w-4 text-muted-foreground" />
              )}
              <div className="flex-1 truncate">
                <span className="font-medium">{log.student?.full_name ?? log.scanned_code}</span>
                {log.student?.admission_number && (
                  <span className="ml-2 text-xs text-muted-foreground">{log.student.admission_number}</span>
                )}
                {log.reason && <span className="ml-2 text-xs text-muted-foreground">· {log.reason}</span>}
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(log.scanned_at).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
