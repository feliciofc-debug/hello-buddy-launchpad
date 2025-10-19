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
import AffiliateProfile from "./components/AffiliateProfile";
import SettingsPage from "./components/SettingsPage";

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
            <Route path="/planos" element={<Planos />} />
            <Route path="/test-payment" element={<TestPayment />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/produtos" element={<ProductsPage />} />
            <Route path="/perfil" element={<AffiliateProfile />} />
            <Route path="/configuracoes" element={<SettingsPage />} />
            <Route path="/whatsapp" element={<WhatsAppPage />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
