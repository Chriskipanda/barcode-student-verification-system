import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, ScanLine, AlertTriangle, User as UserIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/verify")({
  component: VerifyPage,
});

type Decision = "allowed" | "denied" | "unknown";
interface Result {
  decision: Decision;
  reason?: string;
  student?: {
    id: string;
    full_name: string;
    admission_number: string;
    programme: string;
    nta_level: string;
    year_of_study: number;
    status: string;
    photo_url: string | null;
  };
  photoUrl?: string | null;
  scannedCode: string;
  scannedAt: Date;
}

export default function VerifyPage() { return <Page />; }

function Page() {
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState<Result[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const beep = (ok: boolean) => {
    try {
      audioCtxRef.current ||= new (window.AudioContext || (window as any).webkitAudioContext)();
      const ctx = audioCtxRef.current!;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = ok ? 880 : 220;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (ok ? 0.18 : 0.4));
      osc.start();
      osc.stop(ctx.currentTime + (ok ? 0.2 : 0.45));
    } catch {/* ignore */}
  };

  const verify = async (raw: string) => {
    const scanned = raw.trim();
    if (!scanned) return;
    setBusy(true);
    try {
      const { data: student } = await supabase
        .from("students")
        .select("*")
        .or(`barcode.eq.${scanned},admission_number.eq.${scanned}`)
        .maybeSingle();

      let decision: Decision = "unknown";
      let reason: string | undefined;
      let photoUrl: string | null = null;

      if (!student) {
        decision = "unknown";
        reason = "No student matches this code";
      } else if (student.status !== "active") {
        decision = "denied";
        reason = `Student is ${student.status}`;
      } else {
        decision = "allowed";
      }

      if (student?.photo_url) {
        const { data: signed } = await supabase.storage
          .from("student-photos")
          .createSignedUrl(student.photo_url, 60);
        photoUrl = signed?.signedUrl ?? null;
      }

      await supabase.from("access_logs").insert({
        scanned_code: scanned,
        student_id: student?.id ?? null,
        decision,
        reason: reason ?? null,
        scanned_by: user?.id ?? null,
      });

      const r: Result = { decision, reason, student: student ?? undefined, photoUrl, scannedCode: scanned, scannedAt: new Date() };
      setResult(r);
      setRecent((prev) => [r, ...prev].slice(0, 6));
      beep(decision === "allowed");
    } finally {
      setBusy(false);
      setCode("");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    verify(code);
  };

  // Auto-clear visual after 8s
  useEffect(() => {
    if (!result) return;
    const t = setTimeout(() => setResult(null), 8000);
    return () => clearTimeout(t);
  }, [result]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gate verification</h1>
          <p className="text-sm text-muted-foreground">Scan a student barcode or type the admission number.</p>
        </div>
        <ScanLine className="h-6 w-6 text-primary" />
      </div>

      <form onSubmit={onSubmit} className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <Input
          ref={inputRef}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Scan barcode or type admission number…"
          autoFocus
          autoComplete="off"
          disabled={busy}
          className="h-14 text-lg"
        />
        <div className="mt-2 flex justify-end">
          <Button type="submit" disabled={busy || !code.trim()}>{busy ? "Verifying…" : "Verify"}</Button>
        </div>
      </form>

      {result && <DecisionPanel result={result} />}

      {recent.length > 0 && (
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-5 py-3 text-sm font-semibold">Recent scans (this session)</div>
          <div className="divide-y divide-border">
            {recent.map((r, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-2 text-sm">
                {r.decision === "allowed" ? <CheckCircle2 className="h-4 w-4 text-success" /> :
                 r.decision === "denied" ? <XCircle className="h-4 w-4 text-destructive" /> :
                 <AlertTriangle className="h-4 w-4 text-warning" />}
                <span className="flex-1 truncate">
                  {r.student?.full_name ?? r.scannedCode}
                  {r.reason && <span className="ml-2 text-xs text-muted-foreground">· {r.reason}</span>}
                </span>
                <span className="text-xs text-muted-foreground">{r.scannedAt.toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DecisionPanel({ result }: { result: Result }) {
  const cfg = result.decision === "allowed"
    ? { icon: CheckCircle2, label: "ACCESS GRANTED", bg: "bg-success", fg: "text-success-foreground" }
    : result.decision === "denied"
    ? { icon: XCircle, label: "ACCESS DENIED", bg: "bg-destructive", fg: "text-destructive-foreground" }
    : { icon: AlertTriangle, label: "UNKNOWN CODE", bg: "bg-warning", fg: "text-warning-foreground" };
  const Icon = cfg.icon;
  const s = result.student;

  return (
    <div className={`rounded-xl shadow-lg ${cfg.bg} ${cfg.fg} animate-in fade-in zoom-in-95 duration-200`}>
      <div className="grid gap-6 p-6 md:grid-cols-[auto_1fr] md:p-8">
        <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-card/20 ring-2 ring-current/20 md:h-40 md:w-40">
          {result.photoUrl ? (
            <img src={result.photoUrl} alt={s?.full_name ?? "Student"} className="h-full w-full object-cover" />
          ) : (
            <UserIcon className="h-16 w-16 opacity-60" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <Icon className="h-8 w-8" />
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{cfg.label}</h2>
          </div>
          {s ? (
            <div className="mt-4 space-y-1">
              <p className="text-2xl font-semibold">{s.full_name}</p>
              <p className="text-sm opacity-90">{s.admission_number}</p>
              <p className="text-sm opacity-90">
                {[s.programme, s.nta_level && `NTA ${s.nta_level}`, s.year_of_study && `Year ${s.year_of_study}`]
                  .filter(Boolean).join(" · ")}
              </p>
              {result.reason && <p className="mt-3 text-sm font-medium opacity-95">{result.reason}</p>}
            </div>
          ) : (
            <p className="mt-3 text-sm opacity-95">Scanned code: <span className="font-mono">{result.scannedCode}</span></p>
          )}
        </div>
      </div>
    </div>
  );
}
