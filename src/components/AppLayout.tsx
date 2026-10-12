import { ReactNode, useEffect, useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";

interface AppLayoutProps {
  children: ReactNode;
}

// Desktop sidebar "follows the cursor":
//  - cursor inside the left ~220px column  → sidebar expands (full nav)
//  - cursor beyond it                       → sidebar collapses to the logo rail
// The two thresholds add hysteresis so it never flickers at the seam.
const EXPAND_X = 224;
const COLLAPSE_X = 264;

export function AppLayout({ children }: AppLayoutProps) {
  // Mobile drawers are opened/closed explicitly; on desktop the sidebar
  // auto-expands only while the cursor stays over the left sidebar region.
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia("(min-width: 768px)").matches) {
      return;
    }
    const onMove = (e: MouseEvent) => {
      setSidebarExpanded((prev) => {
        const next = prev ? e.clientX <= COLLAPSE_X : e.clientX <= EXPAND_X;
        return prev === next ? prev : next;
      });
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <div className="min-h-screen flex w-full">
      <AppSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        expanded={sidebarExpanded}
      />
      <TopBar onMenuToggle={() => setSidebarOpen(true)} sidebarExpanded={sidebarExpanded} />
      <main
        className={`flex-1 mt-14 p-4 md:p-6 transition-[margin-left] duration-200 ${
          sidebarExpanded ? "md:ml-[220px]" : "md:ml-[72px]"
        }`}
      >
        {children}
      </main>
    </div>
  );
}