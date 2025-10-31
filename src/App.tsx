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
import PlanosNovo from "./pages/PlanosNovo";
import TestPayment from "./pages/TestPayment";
import NotFound from "./pages/NotFound";
import ProductsPage from "./pages/ProductsPage";
import WhatsAppPage from "./pages/WhatsAppPage";
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
import Marketplace from "./pages/Marketplace";
import GoogleAds from "./pages/GoogleAds";
import Analytics from "./pages/Analytics";
import Terms from "./pages/Terms";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/cadastro" element={<Cadastro />} />
            <Route path="/planos-antigo" element={<Planos />} />
            <Route path="/planos" element={<PlanosNovo />} />
            <Route path="/test-payment" element={<TestPayment />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/produtos" element={<ProductsPage />} />
            <Route path="/perfil" element={<AffiliateProfile />} />
            <Route path="/configuracoes" element={<SettingsPage />} />
            <Route path="/whatsapp" element={<WhatsAppPage />} />
            <Route path="/shopee-callback" element={<ShopeeCallback />} />
            <Route path="/auth/callback/meta" element={<AuthCallbackMetaPage />} />
            <Route path="/lomadee" element={<LomadeeFinder />} />
            <Route path="/ia-marketing" element={<IAMarketing />} />
          <Route path="/configuracoes/redes-sociais" element={<RedesSociais />} />
          <Route path="/biblioteca" element={<Biblioteca />} />
          <Route path="/campanhas" element={<Campanhas />} />
          <Route path="/campanhas/google-ads" element={<GoogleAds />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/marketplace" element={<Marketplace />} />
            <Route path="/reviewer" element={<ReviewerLogin />} />
            <Route path="/terms" element={<Terms />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
