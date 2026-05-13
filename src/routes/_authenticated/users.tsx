import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/users")({
  component: UsersPage,
});

function UsersPage() {
  const { isAdmin, loading, user: me } = useAuth();
  const qc = useQueryClient();

  const { data: users } = useQuery({
    queryKey: ["users-with-roles"],
    enabled: isAdmin,
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, created_at"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      const roleMap = new Map<string, string[]>();
      (roles ?? []).forEach((r) => {
        const arr = roleMap.get(r.user_id) ?? [];
        arr.push(r.role);
        roleMap.set(r.user_id, arr);
      });
      return (profiles ?? []).map((p) => ({ ...p, roles: roleMap.get(p.id) ?? [] }));
    },
  });

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/verify" />;

  const setRole = async (userId: string, role: "admin" | "gate") => {
    await supabase.from("user_roles").delete().eq("user_id", userId);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
    if (error) return toast.error(error.message);
    toast.success("Role updated");
    qc.invalidateQueries({ queryKey: ["users-with-roles"] });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-sm text-muted-foreground">Manage system users and their roles.</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-right">Change role</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(users ?? []).map((u: any) => (
              <tr key={u.id}>
                <td className="px-4 py-3 font-medium">{u.full_name || "—"}{u.id === me?.id && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}</td>
                <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-3">
                  {u.roles.length === 0 ? (
                    <Badge variant="secondary">none</Badge>
                  ) : u.roles.map((r: string) => (
                    <Badge key={r} className={r === "admin" ? "bg-primary text-primary-foreground" : ""}>{r}</Badge>
                  ))}
                </td>
                <td className="px-4 py-3 text-right">
                  <Select onValueChange={(v) => setRole(u.id, v as any)} disabled={u.id === me?.id}>
                    <SelectTrigger className="ml-auto w-[140px]"><SelectValue placeholder="Set role" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="gate">Gate operator</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">You cannot change your own role to prevent locking yourself out.</p>
    </div>
  );
}
