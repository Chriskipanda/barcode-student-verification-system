import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/students/new")({
  component: () => <Navigate to="/students/$id" params={{ id: "new" }} />,
});
