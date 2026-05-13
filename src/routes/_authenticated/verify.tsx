import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, XCircle, ScanLine, AlertTriangle, User as UserIcon, Camera, CameraOff, WifiOff, Wifi, RefreshCw, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { cacheStudents, findCachedStudent, cachedStudentCount, enqueueScan, pendingQueue, clearQueueItem, type CachedStudent } from "@/lib/offline";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/verify")({
  component: VerifyPage,
});

type Decision = "allowed" | "denied" | "unknown";
type Direction = "in" | "out";
interface Result {
  decision: Decision;
  reason?: string;
  student?: CachedStudent;
  photoUrl?: string | null;
  scannedCode: string;
  scannedAt: Date;
  direction: Direction;
}

function VerifyPage() {
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState<Result[]>([]);
  const [direction, setDirection] = useState<Direction>("in");
  const [gateId, setGateId] = useState<string>("");
  const [cameraOn, setCameraOn] = useState(false);
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [queueCount, setQueueCount] = useState(0);
  const [cachedCount, setCachedCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const cameraControlsRef = useRef<{ stop: () => void } | null>(null);
  const lastScanRef = useRef<{ code: string; at: number } | null>(null);
  // Stable ref for verify so camera effect doesn't restart when settings change
  const verifyRef = useRef<(raw: string) => Promise<void>>(async () => {});

  const { data: gates } = useQuery({
    queryKey: ["active-gates"],
    queryFn: async () => (await supabase.from("gates").select("id,name").eq("is_active", true).order("name")).data ?? [],
  });
  const { data: settings } = useQuery({
    queryKey: ["scan-settings"],
    queryFn: async () => (await supabase.from("settings").select("key,value")).data ?? [],
  });
  const antiPassbackSec = Number(settings?.find((s) => s.key === "anti_passback_seconds")?.value ?? 15);
  const defaultDirection = (settings?.find((s) => s.key === "default_direction")?.value as Direction) ?? "in";
  useEffect(() => { setDirection(defaultDirection); }, [defaultDirection]);

  useEffect(() => { inputRef.current?.focus(); refreshOfflineCounts(); }, []);
  useEffect(() => {
    const onOnline = () => { setOnline(true); flushQueue(); };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => { window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); };
  }, []);

  const refreshOfflineCounts = async () => {
    setQueueCount((await pendingQueue()).length);
    setCachedCount(await cachedStudentCount());
  };

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

  const syncStudents = async () => {
    toast.info("Caching students for offline use…");
    const { data } = await supabase.from("students").select("id,full_name,admission_number,barcode,programme,nta_level,year_of_study,status,photo_url,expires_at,is_visitor,parent_email,parent_phone");
    if (data) {
      await cacheStudents(data as CachedStudent[]);
      toast.success(`Cached ${data.length} students offline`);
      refreshOfflineCounts();
    }
  };

  const flushQueue = async () => {
    const items = await pendingQueue();
    if (!items.length) return;
    toast.info(`Syncing ${items.length} queued scans…`);
    for (const item of items) {
      const { id, ...payload } = item;
      const { error } = await supabase.from("access_logs").insert(payload as any);
      if (!error && id) await clearQueueItem(id);
    }
    refreshOfflineCounts();
    toast.success("Queue synced");
  };

  const verify = useCallback(async (raw: string) => {
    const scanned = raw.trim();
    if (!scanned) return;

    // Anti-passback
    if (lastScanRef.current && lastScanRef.current.code === scanned &&
        Date.now() - lastScanRef.current.at < antiPassbackSec * 1000) {
      toast.warning(`Anti-passback: wait ${antiPassbackSec}s before re-scanning`);
      setCode("");
      return;
    }

    setBusy(true);
    try {
      let student: CachedStudent | null = null;
      if (online) {
        const { data } = await supabase.from("students").select("*")
          .or(`barcode.eq.${scanned},admission_number.eq.${scanned}`).maybeSingle();
        student = (data as CachedStudent | null) ?? null;
      } else {
        student = await findCachedStudent(scanned);
      }

      let decision: Decision = "unknown";
      let reason: string | undefined;
      let photoUrl: string | null = null;

      if (!student) {
        decision = "unknown";
        reason = online ? "No student matches this code" : "Offline · not in cache";
      } else if (student.status !== "active") {
        decision = "denied"; reason = `Student is ${student.status}`;
      } else if (student.expires_at && new Date(student.expires_at) < new Date()) {
        decision = "denied"; reason = `Pass expired ${student.expires_at}`;
      } else {
        decision = "allowed";
      }

      if (online && student?.photo_url) {
        const { data: signed } = await supabase.storage.from("student-photos").createSignedUrl(student.photo_url, 60);
        photoUrl = signed?.signedUrl ?? null;
      }

      const logPayload = {
        scanned_code: scanned,
        student_id: student?.id ?? null,
        decision,
        reason: reason ?? null,
        scanned_by: user?.id ?? null,
        scanned_at: new Date().toISOString(),
        direction,
        gate_id: gateId || null,
      };

      if (online) {
        await supabase.from("access_logs").insert(logPayload as any);
      } else {
        await enqueueScan(logPayload as any);
        refreshOfflineCounts();
      }

      lastScanRef.current = { code: scanned, at: Date.now() };
      const r: Result = { decision, reason, student: student ?? undefined, photoUrl, scannedCode: scanned, scannedAt: new Date(), direction };
      setResult(r);
      setRecent((prev) => [r, ...prev].slice(0, 6));
      beep(decision === "allowed");
    } finally {
      setBusy(false);
      setCode("");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [online, user?.id, direction, gateId, antiPassbackSec]);

  // Keep ref in sync with latest verify — no deps change required on camera effect
  useEffect(() => { verifyRef.current = verify; }, [verify]);

  // Camera scanning — depends ONLY on cameraOn, uses verifyRef to avoid restarts
  useEffect(() => {
    if (!cameraOn) {
      cameraControlsRef.current?.stop();
      cameraControlsRef.current = null;
      return;
    }
    let cancelled = false;
    (async () => {
      readerRef.current ||= new BrowserMultiFormatReader();
      try {
        const controls = await readerRef.current.decodeFromVideoDevice(undefined, videoRef.current!, (res) => {
          if (cancelled) return;
          if (res) verifyRef.current(res.getText());
        });
        cameraControlsRef.current = controls;
      } catch (e: any) {
        toast.error(e.message || "Camera unavailable");
        setCameraOn(false);
      }
    })();
    return () => { cancelled = true; cameraControlsRef.current?.stop(); cameraControlsRef.current = null; };
  }, [cameraOn]); // ← no longer depends on verify

  const onSubmit = (e: React.FormEvent) => { e.preventDefault(); verify(code); };

  useEffect(() => {
    if (!result) return;
    const t = setTimeout(() => setResult(null), 8000);
    return () => clearTimeout(t);
  }, [result]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Gate verification</h1>
          <p className="text-sm text-muted-foreground">Scan a student barcode or type the admission number.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs ${online ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>
            {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />} {online ? "Online" : "Offline"}
          </span>
          {queueCount > 0 && <span className="rounded-full bg-warning/15 px-2 py-1 text-xs text-warning">{queueCount} queued</span>}
          <span className="rounded-full bg-secondary px-2 py-1 text-xs text-muted-foreground">{cachedCount} cached</span>
          <Button size="sm" variant="outline" onClick={syncStudents} disabled={!online}><RefreshCw className="mr-1 h-3 w-3" /> Sync</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex gap-1 rounded-md bg-secondary p-1">
          <button onClick={() => setDirection("in")} className={`flex items-center gap-1 rounded px-3 py-1.5 text-sm font-medium ${direction === "in" ? "bg-success text-success-foreground" : "text-muted-foreground"}`}>
            <ArrowDownToLine className="h-4 w-4" /> Entry
          </button>
          <button onClick={() => setDirection("out")} className={`flex items-center gap-1 rounded px-3 py-1.5 text-sm font-medium ${direction === "out" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
            <ArrowUpFromLine className="h-4 w-4" /> Exit
          </button>
        </div>
        <div className="min-w-[180px] flex-1">
          <Select value={gateId || "none"} onValueChange={(v) => setGateId(v === "none" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Select gate" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No gate</SelectItem>
              {(gates ?? []).map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button variant={cameraOn ? "default" : "outline"} onClick={() => setCameraOn((c) => !c)}>
          {cameraOn ? <><CameraOff className="mr-2 h-4 w-4" /> Stop camera</> : <><Camera className="mr-2 h-4 w-4" /> Use camera</>}
        </Button>
      </div>

      {cameraOn && (
        <div className="overflow-hidden rounded-xl border border-border bg-black">
          <video ref={videoRef} className="aspect-video w-full object-cover" />
        </div>
      )}

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
                <span className="rounded bg-secondary px-1.5 text-[10px] uppercase text-muted-foreground">{r.direction}</span>
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
            <span className="ml-auto rounded-md bg-card/20 px-2 py-1 text-xs uppercase tracking-wider">{result.direction}</span>
          </div>
          {s ? (
            <div className="mt-4 space-y-1">
              <p className="text-2xl font-semibold">{s.full_name} {s.is_visitor && <span className="ml-2 rounded bg-card/30 px-1.5 text-xs">VISITOR</span>}</p>
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
