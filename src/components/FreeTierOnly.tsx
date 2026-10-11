import { Navigate } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";

/**
 * Guards the free "Create" page. Pro Creators (and admins, who get every Pro
 * feature) are sent to the Creator studio instead, so the trial Create page is
 * never shown to them even if they hit /create directly.
 */
export function FreeTierOnly({ children }: { children: ReactNode }) {
  const { isPro } = useAuth();
  if (isPro) return <Navigate to="/creator" replace />;
  return <>{children}</>;
}
