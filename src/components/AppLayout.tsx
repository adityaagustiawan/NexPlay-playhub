import { ReactNode, useEffect, useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";
import { AccountStatusBanner } from "@/components/AccountStatusBanner";

interface AppLayoutProps {
  children: ReactNode;
}

<<<<<<< HEAD
// Desktop sidebar "follows the cursor":
//  - cursor inside the left ~220px column  → sidebar expands (full nav)
//  - cursor beyond it                       → sidebar collapses to the logo rail
// The two thresholds add hysteresis so it never flickers at the seam.
const EXPAND_X = 224;
const COLLAPSE_X = 264;
=======
const SIDEBAR_COLLAPSED_KEY = "nexconsole:sidebar-collapsed";
>>>>>>> origin/main

export function AppLayout({ children }: AppLayoutProps) {
  // Mobile drawers are opened/closed explicitly; on desktop the sidebar
  // auto-expands only while the cursor stays over the left sidebar region.
  const [sidebarOpen, setSidebarOpen] = useState(false);
<<<<<<< HEAD
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
=======
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
    } catch {
      /* storage unavailable — ignore */
    }
  }, [collapsed]);

  const mainClass = collapsed
    ? "flex-1 md:ml-[72px] mt-14 p-4 md:p-6 transition-[margin-left] duration-200"
    : "flex-1 md:ml-[220px] mt-14 p-4 md:p-6 transition-[margin-left] duration-200";
>>>>>>> origin/main

  return (
    <div className="min-h-screen flex w-full">
      <AppSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
<<<<<<< HEAD
        expanded={sidebarExpanded}
      />
      <TopBar onMenuToggle={() => setSidebarOpen(true)} sidebarExpanded={sidebarExpanded} />
      <main
        className={`flex-1 mt-14 p-4 md:p-6 transition-[margin-left] duration-200 ${
          sidebarExpanded ? "md:ml-[220px]" : "md:ml-[72px]"
        }`}
      >
=======
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
      />
      <TopBar onMenuToggle={() => setSidebarOpen(true)} collapsed={collapsed} />
      <main className={mainClass}>
        <div className="-mx-4 -mt-4 md:-mx-6 md:-mt-6 mb-4 md:mb-6 empty:hidden">
          <AccountStatusBanner />
        </div>
>>>>>>> origin/main
        {children}
      </main>
    </div>
  );
}