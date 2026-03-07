import { ReactNode } from "react";
import { AfiliadoSidebar } from "./AfiliadoSidebar";

interface AfiliadoLayoutProps {
  children: ReactNode;
}

export function AfiliadoLayout({ children }: AfiliadoLayoutProps) {
  return (
    <div className="min-h-screen flex w-full bg-background">
      <AfiliadoSidebar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
