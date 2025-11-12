import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import Dashboard from "./pages/Dashboard";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Cadastro from "./pages/Cadastro";
import Planos from "./pages/Planos";
import TestPayment from "./pages/TestPayment";
import NotFound from "./pages/NotFound";
import ProductsPage from "./pages/ProductsPage";
import WhatsAppPage from "./pages/WhatsAppPage";
import Prospects from "./pages/Prospects";
import Configuracoes from "./pages/Configuracoes";
import AffiliateProfile from "./components/AffiliateProfile";
import SettingsPage from "./components/SettingsPage";
import ShopeeCallback from "./pages/ShopeeCallback";
import ReviewerLogin from "./pages/ReviewerLogin";
import AuthCallbackMetaPage from "./pages/AuthCallbackMetaPage";
import LomadeeFinder from "./pages/LomadeeFinder";
import IAMarketing from "./pages/IAMarketing";
import RedesSociais from "./pages/RedesSociais";
import Biblioteca from "./pages/Biblioteca";
import Campanhas from "./pages/Campanhas";
import MeusProdutos from "./pages/MeusProdutos";
import GoogleAds from "./pages/GoogleAds";
import Analytics from "./pages/Analytics";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import DataDeletion from "./pages/DataDeletion";
import Security from "./pages/Security";
import Admin from "./pages/Admin";
import ConfigurarICP from "./pages/ConfigurarICP";
import CampanhasProspeccao from "./pages/CampanhasProspeccao";
import CampanhaDetalhes from "./pages/CampanhaDetalhes";
import CampanhaLeads from "./pages/CampanhaLeads";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/cadastro" element={<Cadastro />} />
            <Route path="/planos" element={<Planos />} />
            <Route path="/test-payment" element={<TestPayment />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/produtos" element={<ProductsPage />} />
            <Route path="/configuracoes" element={<SettingsPage />} />
            <Route path="/configuracoes-icp" element={<ConfigurarICP />} />
            <Route path="/configurar-icp" element={<ConfigurarICP />} />
            <Route path="/whatsapp" element={<WhatsAppPage />} />
            <Route path="/prospects" element={<Prospects />} />
            <Route path="/campanhas-prospeccao" element={<CampanhasProspeccao />} />
            <Route path="/campanhas/:id" element={<CampanhaDetalhes />} />
            <Route path="/campanhas/:id/leads" element={<CampanhaLeads />} />
            <Route path="/shopee-callback" element={<ShopeeCallback />} />
            <Route path="/auth/callback/meta" element={<AuthCallbackMetaPage />} />
            <Route path="/lomadee" element={<LomadeeFinder />} />
            <Route path="/ia-marketing" element={<IAMarketing />} />
            <Route path="/configuracoes/redes-sociais" element={<RedesSociais />} />
            <Route path="/biblioteca" element={<Biblioteca />} />
          <Route path="/campanhas" element={<Campanhas />} />
          <Route path="/campanhas/google-ads" element={<GoogleAds />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/meus-produtos" element={<MeusProdutos />} />
            <Route path="/reviewer" element={<ReviewerLogin />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/data-deletion" element={<DataDeletion />} />
            <Route path="/security" element={<Security />} />
            <Route path="/admin" element={<Admin />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
