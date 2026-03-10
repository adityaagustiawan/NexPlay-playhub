import { ReactNode } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen flex w-full">
      <AppSidebar />
      <TopBar />
      <main className="flex-1 ml-[220px] mt-14 p-6">
        {children}
      </main>
    </div>
  );
}
