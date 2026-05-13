import { createFileRoute, Outlet, Link, Navigate, useRouter } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { ShieldCheck, ScanLine, Users, ClipboardList, Settings, LogOut, UserCog, LayoutDashboard, DoorOpen, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, loading, isAdmin, signOut } = useAuth();
  const router = useRouter();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (!user) return <Navigate to="/login" />;

  const navItems = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, adminOnly: true },
    { to: "/verify", label: "Gate Scan", icon: ScanLine, adminOnly: false },
    { to: "/students", label: "Students", icon: Users, adminOnly: true },
    { to: "/visitors", label: "Visitor Pass", icon: UserPlus, adminOnly: true },
    { to: "/gates", label: "Gates", icon: DoorOpen, adminOnly: true },
    { to: "/logs", label: "Access Logs", icon: ClipboardList, adminOnly: false },
    { to: "/users", label: "Users", icon: UserCog, adminOnly: true },
    { to: "/settings", label: "Settings", icon: Settings, adminOnly: true },
  ].filter((i) => isAdmin || !i.adminOnly);

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-60 border-r border-sidebar-border bg-sidebar md:block">
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-5">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-primary text-primary-foreground">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">ATC Gate</p>
            <p className="text-xs text-sidebar-foreground/60 leading-tight">Verification</p>
          </div>
        </div>
        <nav className="flex flex-col gap-1 p-3">
          {navItems.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent"
              activeProps={{ className: "flex items-center gap-3 rounded-md px-3 py-2 text-sm bg-sidebar-primary text-sidebar-primary-foreground" }}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="absolute inset-x-0 bottom-0 border-t border-sidebar-border p-3">
          <div className="mb-2 truncate px-2 text-xs text-sidebar-foreground/70">{user.email}</div>
          <Button
            variant="ghost"
            className="w-full justify-start gap-2"
            onClick={async () => { await signOut(); router.navigate({ to: "/login" }); }}
          >
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-card px-4 md:hidden">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold">ATC Gate</span>
        </div>
        <Button size="sm" variant="ghost" onClick={async () => { await signOut(); router.navigate({ to: "/login" }); }}>
          <LogOut className="h-4 w-4" />
        </Button>
      </header>
      <nav className="sticky top-14 z-10 flex gap-1 overflow-x-auto border-b border-border bg-card px-2 py-2 md:hidden">
        {navItems.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary"
            activeProps={{ className: "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs bg-primary text-primary-foreground" }}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </Link>
        ))}
      </nav>

      <main className="md:pl-60">
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
