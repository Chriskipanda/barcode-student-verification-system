import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, ScanLine, Users, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { t } = useTranslation();
  const { signIn, signUp, user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [mode,       setMode]       = useState<"signin" | "signup">("signin");
  const [email,      setEmail]      = useState("");
  const [password,   setPassword]   = useState("");
  const [fullName,   setFullName]   = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [didSubmit,  setDidSubmit]  = useState(false);

  // Bug fix: navigate only AFTER auth state settles (user + roles both ready).
  // Avoids the race where navigate fires while user is still null → brief /login flash.
  // Also handles the "already logged in → visiting /login" redirect.
  useEffect(() => {
    if (!loading && user) {
      navigate({ to: isAdmin ? "/dashboard" : "/verify", replace: true });
    }
  }, [loading, user, isAdmin, navigate, didSubmit]);

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
    if (mode === "signup") toast.success(t("login.account_created"));
    // Trigger the useEffect to fire once auth state settles
    setDidSubmit(true);
  };

  const features = [
    { icon: ScanLine,  text: t("login.feat_instant") },
    { icon: Users,     text: t("login.feat_mgmt")    },
    { icon: BarChart3, text: t("login.feat_audit")   },
  ];

  return (
    <div className="flex min-h-screen bg-background">

      {/* ── Left branding panel (hidden on small screens) ── */}
      <div
        className="relative hidden w-[45%] flex-col justify-between overflow-hidden p-10 text-primary-foreground lg:flex"
        style={{ background: "var(--gradient-hero)" }}
      >
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
              {t("login.barcode_ver")}
            </p>
          </div>
        </div>

        {/* Headline */}
        <div className="relative space-y-5">
          <p className="text-xs font-semibold uppercase tracking-widest opacity-70">
            {t("login.brand_subtitle")}
          </p>
          <h1 className="text-4xl font-bold leading-tight tracking-tight whitespace-pre-line">
            {t("login.secure_campus")}
          </h1>
          <p className="max-w-xs text-sm leading-relaxed opacity-80">
            {t("login.scan_desc")}
          </p>

          <ul className="space-y-3 pt-2">
            {features.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm">
                <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/15">
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <span className="opacity-90">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs opacity-50">{t("login.dept_footer")}</p>
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
            <p className="text-xs text-muted-foreground">{t("login.barcode_ver")}</p>
          </div>
        </div>

        <div className="w-full max-w-[380px]">
          {/* Language switcher */}
          <div className="mb-6 flex justify-center">
            <LanguageSwitcher />
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold tracking-tight">
              {mode === "signin" ? t("login.welcome") : t("login.create_account")}
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {mode === "signin" ? t("login.sign_in_desc") : t("login.signup_desc")}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handle} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">{t("login.full_name")}</Label>
                <Input
                  id="name"
                  required
                  autoComplete="name"
                  placeholder={t("login.full_name_ph")}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">{t("login.email")}</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder={t("login.email_ph")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">{t("login.password")}</Label>
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
                ? t("login.please_wait")
                : mode === "signin"
                ? t("login.sign_in")
                : t("login.create_account")}
            </Button>
          </form>

          {/* Toggle mode */}
          <p className="mt-5 text-center text-sm text-muted-foreground">
            {mode === "signin" ? (
              <>
                {t("login.no_account")}{" "}
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className="font-semibold text-primary hover:underline"
                >
                  {t("login.create_one")}
                </button>
              </>
            ) : (
              <>
                {t("login.have_account")}{" "}
                <button
                  type="button"
                  onClick={() => setMode("signin")}
                  className="font-semibold text-primary hover:underline"
                >
                  {t("login.sign_in")}
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
