import { ReactNode, useEffect, useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";

interface AppLayoutProps {
  children: ReactNode;
}

const SIDEBAR_COLLAPSED_KEY = "nexconsole:sidebar-collapsed";
const SIDEBAR_WIDTH = 220;
const SIDEBAR_WIDTH_COLLAPSED = 72;

export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
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

  const railWidth = collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH;

  return (
    <div className="min-h-screen flex w-full">
      <AppSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
      />
      <TopBar onMenuToggle={() => setSidebarOpen(true)} collapsed={collapsed} />
      <main
        className="flex-1 mt-14 p-4 md:p-6 transition-[margin-left] duration-200"
        style={{ ["--rail" as string]: `${railWidth}px` }}
      >
        {children}
      </main>
      {/* Sets the desktop left offset via CSS var so it animates with the rail. */}
      <style>{`@media (min-width: 768px){ .md\\:ml-rail{margin-left:${railWidth}px} }`}</style>
    </div>
  );
}
