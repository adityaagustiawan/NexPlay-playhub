import { ReactNode, useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  // Mobile drawers are opened/closed explicitly; on desktop the sidebar
  // auto-expands to full navigation only while the cursor is hovering it.
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  return (
    <div className="min-h-screen flex w-full">
      <AppSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        expanded={sidebarExpanded}
        onExpandedChange={setSidebarExpanded}
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