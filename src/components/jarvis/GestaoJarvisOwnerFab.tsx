import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { usesVehicleInventoryMenu } from "@/lib/client-menu-routes.ts";
import { VEHICLE_DEALER_TENANT_TYPE } from "@/lib/business-tenant.ts";
import { GestaoJarvisPanel } from "@/components/jarvis/GestaoJarvisPanel.tsx";

const HIDDEN_PREFIXES = [
  "/amz_auto",
  "/login",
  "/cadastro",
  "/vendedor-login",
  "/vendedor-painel",
  "/contador/",
  "/pay/",
  "/painel/",
  "/",
];

function isOwnerAppRoute(pathname: string): boolean {
  if (pathname === "/") return false;
  return !HIDDEN_PREFIXES.some((p) => p !== "/" && pathname.startsWith(p));
}

export function GestaoJarvisOwnerFab() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [eligible, setEligible] = useState(false);
  const [checked, setChecked] = useState(false);

  const routeOk = useMemo(() => isOwnerAppRoute(location.pathname), [location.pathname]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        if (!cancelled) {
          setEligible(false);
          setChecked(true);
        }
        return;
      }
      const [{ data: profile }, { data: config }] = await Promise.all([
        supabase.from("profiles").select("tipo").eq("id", session.user.id).maybeSingle(),
        supabase.from("empresa_config").select("segmento, sobre_negocio, vitrine_veiculos_demo")
          .eq("user_id", session.user.id).maybeSingle(),
      ]);
      const tipo = profile?.tipo ?? null;
      const vehicle = usesVehicleInventoryMenu(
        tipo,
        config?.segmento ?? null,
        config?.sobre_negocio ?? null,
      ) || tipo === VEHICLE_DEALER_TENANT_TYPE || config?.vitrine_veiculos_demo === true;
      if (!cancelled) {
        setEligible(vehicle);
        setChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  if (!checked || !eligible || !routeOk) return null;

  return (
    <>
      <Button
        type="button"
        size="lg"
        className="fixed bottom-6 right-6 z-50 h-12 rounded-full shadow-lg gap-2 px-5"
        onClick={() => setOpen(true)}
      >
        <Bot className="h-5 w-5" />
        Pergunte ao Jarvis
      </Button>
      <GestaoJarvisPanel open={open} onOpenChange={setOpen} />
    </>
  );
}
