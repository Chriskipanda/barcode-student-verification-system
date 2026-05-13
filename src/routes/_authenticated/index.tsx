import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/")({
  component: Index,
});

function Index() {
  const { isAdmin, loading } = useAuth();
  if (loading) return null;
  return <Navigate to={isAdmin ? "/dashboard" : "/verify"} />;
}
