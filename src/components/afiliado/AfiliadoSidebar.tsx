import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  Package,
  Send,
  Users,
  Megaphone,
  Contact,
  Sparkles,
  DollarSign,
  Smartphone,
  LogOut,
  Menu,
  X,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

interface SidebarItem {
  title: string;
  icon: React.ElementType;
  path: string;
  action?: () => void;
}

interface SidebarSection {
  label: string;
  items: SidebarItem[];
}

export function AfiliadoSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const sections: SidebarSection[] = [
    {
      label: t('nav.section_main'),
      items: [
        { title: t('nav.dashboard'), icon: LayoutDashboard, path: "/afiliado/dashboard" },
        { title: t('nav.products'), icon: Package, path: "/afiliado/produtos" },
      ],
    },
    {
      label: t('nav.section_whatsapp'),
      items: [
        { title: t('nav.send_messages'), icon: Send, path: "/afiliado/whatsapp" },
        { title: t('nav.groups'), icon: Users, path: "/afiliado/grupos" },
        { title: t('nav.campaigns'), icon: Megaphone, path: "/afiliado/campanhas" },
        { title: t('nav.contacts'), icon: Contact, path: "/afiliado/contatos" },
      ],
    },
    {
      label: t('nav.section_marketing'),
      items: [
        { title: t('nav.ia_marketing'), icon: Sparkles, path: "/afiliado/ia-marketing" },
        { title: t('nav.sales'), icon: DollarSign, path: "/afiliado/vendas" },
      ],
    },
  ];

  const footerItems: SidebarItem[] = [
    { title: t('nav.connect_whatsapp'), icon: Smartphone, path: "/afiliado/conectar-celular" },
    { title: t('nav.logout'), icon: LogOut, path: "", action: handleLogout },
  ];

  const isActive = (path: string) => location.pathname === path;

  const handleNav = (item: SidebarItem) => {
    if (item.action) {
      item.action();
    } else {
      navigate(item.path);
    }
    if (isMobile) setMobileOpen(false);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
        {!collapsed && (
          <h1 className="text-lg font-bold text-white tracking-tight">
            AMZ Ofertas
          </h1>
        )}
        {!isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="text-sidebar-foreground hover:bg-sidebar-accent h-8 w-8"
          >
            <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
          </Button>
        )}
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(false)}
            className="text-sidebar-foreground hover:bg-sidebar-accent h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Sections */}
      <nav className="flex-1 overflow-y-auto py-4 space-y-6">
        {sections.map((section) => (
          <div key={section.label} className="px-3">
            {!collapsed && (
              <p className="text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50 mb-2 px-3">
                {section.label}
              </p>
            )}
            <div className="space-y-1">
              {section.items.map((item) => (
                <button
                  key={item.path}
                  onClick={() => handleNav(item)}
                  className={cn(
                    "flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive(item.path)
                      ? "bg-sidebar-primary text-white"
                      : "text-slate-300 hover:bg-white/10 hover:text-white"
                  )}
                  title={collapsed ? item.title : undefined}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {!collapsed && <span>{item.title}</span>}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-3 space-y-1">
        {footerItems.map((item) => (
          <button
            key={item.title}
            onClick={() => handleNav(item)}
            className={cn(
              "flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              isActive(item.path)
                ? "bg-sidebar-primary text-white"
                : "text-slate-300 hover:bg-white/10 hover:text-white"
            )}
            title={collapsed ? item.title : undefined}
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {!collapsed && <span>{item.title}</span>}
          </button>
        ))}
      </div>
    </div>
  );

  // Mobile: overlay sidebar
  if (isMobile) {
    return (
      <>
        {/* Mobile trigger */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileOpen(true)}
          className="fixed top-4 left-4 z-40 bg-background shadow-md rounded-full h-10 w-10"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Overlay */}
        {mobileOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="fixed left-0 top-0 bottom-0 w-[250px] z-50 shadow-xl">
              {sidebarContent}
            </aside>
          </>
        )}
      </>
    );
  }

  // Desktop: fixed sidebar
  return (
    <aside
      className={cn(
        "sticky top-0 h-screen shrink-0 border-r border-sidebar-border transition-all duration-200",
        collapsed ? "w-16" : "w-[250px]"
      )}
    >
      {sidebarContent}
    </aside>
  );
}
