import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { ScanLine, ShieldCheck, Users, BarChart3 } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { user, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }
  if (user) {
    return <Navigate to={isAdmin ? "/dashboard" : "/verify"} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-primary text-primary-foreground">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight">ATC Gate</p>
              <p className="text-xs text-muted-foreground leading-tight">Barcode Verification</p>
            </div>
          </div>
          <Link to="/login" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
            Sign in
          </Link>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 -z-10" style={{ background: "var(--gradient-hero)" }} />
          <div className="mx-auto max-w-6xl px-6 py-24 text-primary-foreground">
            <p className="text-sm uppercase tracking-widest opacity-80">Arusha Technical College</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-bold leading-tight md:text-6xl">
              Barcode-enabled student verification at the main gate.
            </h1>
            <p className="mt-5 max-w-2xl text-lg opacity-90">
              Scan an ID. Get an instant ALLOW or DENY decision with the student's photo,
              programme and admission number — and a complete audit log for every entry.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/login" className="rounded-md bg-card px-5 py-3 text-sm font-semibold text-foreground shadow-lg hover:opacity-90">
                Sign in to scan
              </Link>
              <a href="#features" className="rounded-md border border-primary-foreground/30 px-5 py-3 text-sm font-semibold hover:bg-primary-foreground/10">
                Learn more
              </a>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto grid max-w-6xl gap-6 px-6 py-20 md:grid-cols-3">
          {[
            { icon: ScanLine, title: "Instant scan decision", body: "USB barcode scanner emulates a keyboard. Decision and student details appear in under a second." },
            { icon: Users, title: "Student records", body: "Manage students with photos, programmes and admission numbers. Suspend or reactivate at any time." },
            { icon: BarChart3, title: "Audit logs", body: "Every scan attempt is recorded — allowed, denied, or unknown — with the operator and timestamp." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        <p>SRS v1.0 · Dionysius John Kassongo (24050512144) · Department of Computer Science</p>
      </footer>
    </div>
  );
}
