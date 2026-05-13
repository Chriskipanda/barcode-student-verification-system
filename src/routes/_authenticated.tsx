import {
  createFileRoute,
  Outlet,
  Link,
  Navigate,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import {
  ShieldCheck,
  ScanLine,
  Users,
  ClipboardList,
  Settings,
  LogOut,
  UserCog,
  LayoutDashboard,
  DoorOpen,
  UserPlus,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

// ─── Nav definition ────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard",   icon: LayoutDashboard, adminOnly: true  },
  { to: "/verify",    label: "Gate Scan",    icon: ScanLine,        adminOnly: false },
  { to: "/students",  label: "Students",     icon: Users,           adminOnly: true  },
  { to: "/visitors",  label: "Visitors",     icon: UserPlus,        adminOnly: true  },
  { to: "/gates",     label: "Gates",        icon: DoorOpen,        adminOnly: true  },
  { to: "/logs",      label: "Access Logs",  icon: ClipboardList,   adminOnly: false },
  { to: "/users",     label: "Users",        icon: UserCog,         adminOnly: true  },
  { to: "/settings",  label: "Settings",     icon: Settings,        adminOnly: true  },
] as const;

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/verify":    "Gate Scan",
  "/students":  "Students",
  "/visitors":  "Visitor Pass",
  "/gates":     "Gates",
  "/logs":      "Access Logs",
  "/users":     "Users",
  "/settings":  "Settings",
};

// ─── Route ─────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

// ─── Layout ────────────────────────────────────────────────────────────────

function AuthenticatedLayout() {
  const { user, loading, isAdmin, signOut } = useAuth();
  const router = useRouter();
  const { location } = useRouterState();

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem("sidebar-collapsed") === "true"; }
    catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem("sidebar-collapsed", String(collapsed)); }
    catch { /* ignore */ }
  }, [collapsed]);

  // ── Loading ───
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
  if (!user) return <Navigate to="/login" />;

  // ── Derived values ───
  const navItems = NAV_ITEMS.filter((i) => isAdmin || !i.adminOnly);
  const mobileNavItems = navItems.slice(0, 5);

  const pathname = location.pathname;
  const pageTitle =
    Object.entries(PAGE_TITLES).find(
      ([path]) => pathname === path || pathname.startsWith(path + "/")
    )?.[1] ?? "ATC Gate";

  const initials = (user.email ?? "U").slice(0, 2).toUpperCase();
  const roleLabel = isAdmin ? "Admin" : "Gate Operator";

  const handleSignOut = async () => {
    await signOut();
    router.navigate({ to: "/login" });
  };

  return (
    <div className="flex min-h-screen bg-background">

      {/* ═══════════════════════════════════════════
          DESKTOP SIDEBAR
      ═══════════════════════════════════════════ */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden flex-col",
          "border-r border-sidebar-border bg-sidebar",
          "transition-[width] duration-200 ease-in-out",
          "md:flex",
          collapsed ? "w-[64px]" : "w-[240px]"
        )}
      >
        {/* Logo ── */}
        <div
          className={cn(
            "flex h-16 shrink-0 items-center border-b border-sidebar-border",
            collapsed ? "justify-center px-0" : "gap-3 px-5"
          )}
        >
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary shadow-sm text-primary-foreground">
            <ShieldCheck className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-bold tracking-tight text-sidebar-foreground">
                ATC Gate
              </p>
              <p className="truncate text-[10px] text-sidebar-foreground/50 font-medium uppercase tracking-widest">
                Verification
              </p>
            </div>
          )}
        </div>

        {/* Nav links ── */}
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-3">
          {navItems.map(({ to, label, icon: Icon }) => {
            const active = pathname === to || pathname.startsWith(to + "/");
            return (
              <Link
                key={to}
                to={to}
                title={collapsed ? label : undefined}
                className={cn(
                  "group flex items-center gap-3 rounded-lg text-sm font-medium",
                  "transition-all duration-150",
                  collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                    : "text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {!collapsed && <span className="truncate">{label}</span>}
                {!collapsed && active && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-current opacity-60 animate-pulse" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Collapse toggle ── */}
        <div className="px-2 py-1">
          <button
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-3 py-2",
              "text-xs text-sidebar-foreground/40 transition-colors",
              "hover:bg-sidebar-accent hover:text-sidebar-foreground",
              collapsed && "justify-center px-2"
            )}
          >
            {collapsed
              ? <ChevronRight className="h-4 w-4" />
              : (<><ChevronLeft className="h-4 w-4" /><span>Collapse</span></>)
            }
          </button>
        </div>

        {/* User section ── */}
        <div
          className={cn(
            "flex items-center gap-3 border-t border-sidebar-border p-3",
            collapsed && "justify-center"
          )}
        >
          {/* Avatar */}
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">
            {initials}
          </div>

          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-sidebar-foreground">
                  {user.email}
                </p>
                <p className="text-[10px] font-medium text-sidebar-foreground/50">
                  {roleLabel}
                </p>
              </div>
              <button
                onClick={handleSignOut}
                title="Sign out"
                className="rounded-lg p-1.5 text-sidebar-foreground/40 transition-colors hover:bg-sidebar-accent hover:text-destructive"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </aside>

      {/* ═══════════════════════════════════════════
          MAIN AREA  (offset by sidebar width)
      ═══════════════════════════════════════════ */}
      <div
        className={cn(
          "flex min-h-screen flex-1 flex-col",
          "transition-[margin-left] duration-200 ease-in-out",
          "md:ml-[240px]",
          collapsed && "md:ml-[64px]"
        )}
      >

        {/* ── Desktop top header ─────────────────── */}
        <header className="sticky top-0 z-20 hidden h-14 items-center justify-between border-b border-border bg-card/80 px-6 backdrop-blur-md md:flex">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-foreground">{pageTitle}</span>
            {/* Live system status indicator */}
            <span className="flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
              Live
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground hidden lg:block">{user.email}</span>
            <div className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary ring-2 ring-primary/20 transition-transform hover:scale-110">
              {initials}
            </div>
          </div>
        </header>

        {/* ── Mobile top header ──────────────────── */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-card/90 px-4 backdrop-blur-md md:hidden">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight tracking-tight">ATC Gate</p>
              <p className="text-[10px] font-medium leading-tight text-muted-foreground">{pageTitle}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary"
            title="Sign out"
          >
            {initials}
          </button>
        </header>

        {/* ── Page content ───────────────────────── */}
        <main className="flex-1 pb-24 md:pb-0">
          <div
            key={pathname}
            className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8 animate-in fade-in slide-in-from-bottom-3 duration-300 ease-out"
          >
            <Outlet />
          </div>
        </main>
      </div>

      {/* ═══════════════════════════════════════════
          MOBILE BOTTOM NAV BAR
      ═══════════════════════════════════════════ */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-card/95 backdrop-blur-md md:hidden">
        {mobileNavItems.map(({ to, label, icon: Icon }) => {
          const active = pathname === to || pathname.startsWith(to + "/");
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-semibold uppercase tracking-wide transition-all duration-200",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground active:scale-95"
              )}
            >
              <div className={cn(
                "flex h-7 w-7 items-center justify-center rounded-xl transition-all duration-200",
                active && "bg-primary/10 scale-110"
              )}>
                <Icon className="h-5 w-5" />
              </div>
              <span className={cn(active && "font-bold")}>{label}</span>
            </Link>
          );
        })}
      </nav>

    </div>
  );
}
