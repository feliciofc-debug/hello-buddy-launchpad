import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { CampaignScheduler } from "@/components/CampaignScheduler";
import Dashboard from "./pages/Dashboard";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Cadastro from "./pages/Cadastro";
import Planos from "./pages/Planos";
import TestPayment from "./pages/TestPayment";
import NotFound from "./pages/NotFound";
import ProductsPage from "./pages/ProductsPage";
import WhatsAppPage from "./pages/WhatsAppPage";
import WhatsAppConversations from "./pages/WhatsAppConversations";
import Prospects from "./pages/Prospects";
import Configuracoes from "./pages/Configuracoes";

import SettingsPage from "./components/SettingsPage";
import ReviewerLogin from "./pages/ReviewerLogin";
import AuthCallbackMetaPage from "./pages/AuthCallbackMetaPage";
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
import LeadsDescobertos from "./pages/LeadsDescobertos";
import Marketplace from "./pages/Marketplace";
import MarketplaceProduto from "./pages/MarketplaceProduto";
import MarketplacePublico from "./pages/MarketplacePublico";
import AdminProdutos from "./pages/AdminProdutos";
import OnboardingWhatsApp from "./pages/OnboardingWhatsApp";
import ConfiguracaoEmpresa from "./pages/ConfiguracaoEmpresa";
import IAConversas from "./pages/IAConversas";
import DashboardMetricas from "./pages/DashboardMetricas";
import LeadsFunil from "./pages/LeadsFunil";
import Vendedores from "./pages/Vendedores";
import VendedorLogin from "./pages/VendedorLogin";
import VendedorPainel from "./pages/VendedorPainel";
import PoliticaPrivacidade from "./pages/PoliticaPrivacidade";
import ConfiguracoesWhatsApp from "./pages/ConfiguracoesWhatsApp";
import AdminImportar from "./pages/AdminImportar";

import SeusCadastros from "./pages/SeusCadastros";
import GruposTransmissao from "./pages/GruposTransmissao";
import GrupoDetalhes from "./pages/GrupoDetalhes";
import CookieBanner from "./components/CookieBanner";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <CampaignScheduler />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/cadastro" element={<Cadastro />} />
            <Route path="/planos" element={<Planos />} />
            <Route path="/test-payment" element={<TestPayment />} />
            <Route path="/dashboard" element={<DashboardMetricas />} />
            <Route path="/dashboard-antigo" element={<Dashboard />} />
            <Route path="/produtos" element={<ProductsPage />} />
            <Route path="/configuracoes" element={<SettingsPage />} />
            <Route path="/configuracoes-icp" element={<ConfigurarICP />} />
            <Route path="/configurar-icp" element={<ConfigurarICP />} />
            <Route path="/whatsapp" element={<WhatsAppPage />} />
            <Route path="/whatsapp-conversations" element={<WhatsAppConversations />} />
            <Route path="/onboarding/whatsapp" element={<OnboardingWhatsApp />} />
            <Route path="/prospects" element={<Prospects />} />
            <Route path="/campanhas-prospeccao" element={<CampanhasProspeccao />} />
            <Route path="/campanhas/:id" element={<CampanhaDetalhes />} />
            <Route path="/campanhas/:id/leads" element={<CampanhaLeads />} />
            <Route path="/campanhas/:campanhaId/leads-descobertos" element={<LeadsDescobertos />} />
            <Route path="/auth/callback/meta" element={<AuthCallbackMetaPage />} />
            <Route path="/ia-marketing" element={<IAMarketing />} />
            <Route path="/configuracoes/redes-sociais" element={<RedesSociais />} />
            <Route path="/biblioteca" element={<Biblioteca />} />
          <Route path="/campanhas" element={<Campanhas />} />
          <Route path="/campanhas/google-ads" element={<GoogleAds />} />
          <Route path="/google-ads" element={<GoogleAds />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/meus-produtos" element={<MeusProdutos />} />
            <Route path="/reviewer" element={<ReviewerLogin />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/data-deletion" element={<DataDeletion />} />
            <Route path="/security" element={<Security />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/importar" element={<AdminImportar />} />
            
            <Route path="/admin/produtos" element={<AdminProdutos />} />
            <Route path="/configuracao-empresa" element={<ConfiguracaoEmpresa />} />
            <Route path="/ia-conversas" element={<IAConversas />} />
            <Route path="/leads-funil" element={<LeadsFunil />} />
            <Route path="/vendedores" element={<Vendedores />} />
            <Route path="/vendedor-login" element={<VendedorLogin />} />
            <Route path="/vendedor-painel" element={<VendedorPainel />} />
            <Route path="/marketplace" element={<Marketplace />} />
            <Route path="/marketplace/:slug" element={<MarketplaceProduto />} />
            <Route path="/marketplace-publico" element={<MarketplacePublico />} />
            <Route path="/politica-privacidade" element={<PoliticaPrivacidade />} />
            <Route path="/configuracoes-whatsapp" element={<ConfiguracoesWhatsApp />} />
            <Route path="/seus-cadastros" element={<SeusCadastros />} />
            <Route path="/grupos-transmissao" element={<GruposTransmissao />} />
            <Route path="/grupos-transmissao/:id" element={<GrupoDetalhes />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          <CookieBanner />
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
