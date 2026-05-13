import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, ScanLine, Users, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

const FEATURES = [
  { icon: ScanLine, text: "Instant barcode scan decisions" },
  { icon: Users,    text: "Student & visitor record management" },
  { icon: BarChart3, text: "Full audit log with PDF export" },
];

function LoginPage() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handle = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const res =
      mode === "signin"
        ? await signIn(email, password)
        : await signUp(email, password, fullName);
    setSubmitting(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    if (mode === "signup") toast.success("Account created — signing you in…");
    navigate({ to: "/" });
  };

  return (
    <div className="flex min-h-screen bg-background">

      {/* ── Left branding panel (hidden on small screens) ── */}
      <div
        className="relative hidden w-[45%] flex-col justify-between overflow-hidden p-10 text-primary-foreground lg:flex"
        style={{ background: "var(--gradient-hero)" }}
      >
        {/* Decorative circles */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-black/10" />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/20 backdrop-blur">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <p className="text-base font-bold tracking-tight">ATC Gate</p>
            <p className="text-xs font-medium opacity-70 uppercase tracking-widest">
              Barcode Verification
            </p>
          </div>
        </div>

        {/* Headline */}
        <div className="relative space-y-5">
          <p className="text-xs font-semibold uppercase tracking-widest opacity-70">
            Arusha Technical College
          </p>
          <h1 className="text-4xl font-bold leading-tight tracking-tight">
            Secure campus<br />access control
          </h1>
          <p className="max-w-xs text-sm leading-relaxed opacity-80">
            Scan student barcodes at the main gate for instant verification —
            complete with photo, programme, and a full audit trail.
          </p>

          {/* Feature bullets */}
          <ul className="space-y-3 pt-2">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm">
                <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/15">
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <span className="opacity-90">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer note */}
        <p className="relative text-xs opacity-50">
          Dept. of Computer Science · v1.0
        </p>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">

        {/* Mobile-only logo */}
        <div className="mb-8 flex items-center gap-3 lg:hidden">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-base font-bold">ATC Gate</p>
            <p className="text-xs text-muted-foreground">Barcode Verification</p>
          </div>
        </div>

        <div className="w-full max-w-[380px]">
          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold tracking-tight">
              {mode === "signin" ? "Welcome back" : "Create account"}
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {mode === "signin"
                ? "Sign in to access the verification system."
                : "First account registered becomes system administrator."}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handle} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  required
                  autoComplete="name"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <Button
              type="submit"
              className="mt-2 w-full"
              size="lg"
              disabled={submitting}
            >
              {submitting
                ? "Please wait…"
                : mode === "signin"
                ? "Sign in"
                : "Create account"}
            </Button>
          </form>

          {/* Toggle mode */}
          <p className="mt-5 text-center text-sm text-muted-foreground">
            {mode === "signin" ? (
              <>
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className="font-semibold text-primary hover:underline"
                >
                  Create one
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => setMode("signin")}
                  className="font-semibold text-primary hover:underline"
                >
                  Sign in
                </button>
              </>
            )}
          </p>

          {/* Mode indicator dots */}
          <div className="mt-8 flex justify-center gap-1.5">
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  mode === m ? "w-6 bg-primary" : "w-1.5 bg-border"
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
