import { ReactNode, useEffect, useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";

interface AppLayoutProps {
  children: ReactNode;
}

const SIDEBAR_COLLAPSED_KEY = "nexconsole:sidebar-collapsed";

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

  const mainClass = collapsed
    ? "flex-1 md:ml-[72px] mt-14 p-4 md:p-6 transition-[margin-left] duration-200"
    : "flex-1 md:ml-[220px] mt-14 p-4 md:p-6 transition-[margin-left] duration-200";

  return (
    <div className="min-h-screen flex w-full">
      <AppSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
      />
      <TopBar onMenuToggle={() => setSidebarOpen(true)} collapsed={collapsed} />
      <main className={mainClass}>{children}</main>
    </div>
  );
}
