import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const navItems = [
  { label: "Início", href: "/" },
  { label: "Plataforma", href: "/plataforma" },
  { label: "Integrações", href: "/integracoes" },
  { label: "Planos", href: "/planos" },
  { label: "Sobre", href: "/sobre" },
  { label: "Contato", href: "/contato" },
];

interface SiteLayoutProps {
  children: React.ReactNode;
}

export default function SiteLayout({ children }: SiteLayoutProps) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "/") return location.pathname === "/";
    return location.pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img
              src="/logo-amz-reel.png"
              alt="AMZ Ofertas"
              className="h-9 w-auto"
            />
            <span className="text-lg font-semibold text-foreground">
              AMZ Ofertas
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            {navItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  isActive(item.href)
                    ? "text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {item.label}
              </Link>
            ))}
            <Button asChild size="sm">
              <Link to="/login">Entrar</Link>
            </Button>
          </nav>

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" aria-label="Abrir menu">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <img
                    src="/logo-amz-reel.png"
                    alt="AMZ Ofertas"
                    className="h-8 w-auto"
                  />
                  <span>Menu</span>
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-4 mt-8">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`text-base font-medium py-2 border-b transition-colors hover:text-primary ${
                      isActive(item.href)
                        ? "text-foreground border-primary"
                        : "text-muted-foreground border-border"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
                <Button asChild className="mt-4 w-full">
                  <Link to="/login" onClick={() => setMobileOpen(false)}>
                    Entrar
                  </Link>
                </Button>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t bg-muted">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div>
              <h4 className="font-semibold mb-4 text-foreground">Plataforma</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link to="/" className="hover:text-foreground transition">
                    Início
                  </Link>
                </li>
                <li>
                  <Link to="/plataforma" className="hover:text-foreground transition">
                    Plataforma
                  </Link>
                </li>
                <li>
                  <Link to="/integracoes" className="hover:text-foreground transition">
                    Integrações
                  </Link>
                </li>
                <li>
                  <Link to="/planos" className="hover:text-foreground transition">
                    Planos
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4 text-foreground">Integrações</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link to="/integracoes" className="hover:text-foreground transition">
                    WhatsApp Business
                  </Link>
                </li>
                <li>
                  <Link to="/integracoes" className="hover:text-foreground transition">
                    Instagram
                  </Link>
                </li>
                <li>
                  <Link to="/integracoes" className="hover:text-foreground transition">
                    Facebook
                  </Link>
                </li>
                <li>
                  <Link to="/integracoes" className="hover:text-foreground transition">
                    TikTok
                  </Link>
                </li>
                <li>
                  <Link to="/integracoes" className="hover:text-foreground transition">
                    LinkedIn
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4 text-foreground">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link to="/termos" className="hover:text-foreground transition">
                    Termos de Uso
                  </Link>
                </li>
                <li>
                  <Link to="/politica-privacidade" className="hover:text-foreground transition">
                    Política de Privacidade
                  </Link>
                </li>
                <li>
                  <Link to="/data-deletion" className="hover:text-foreground transition">
                    Exclusão de Dados
                  </Link>
                </li>
                <li>
                  <Link to="/security" className="hover:text-foreground transition">
                    Segurança
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4 text-foreground">Empresa</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link to="/sobre" className="hover:text-foreground transition">
                    Sobre
                  </Link>
                </li>
                <li>
                  <Link to="/contato" className="hover:text-foreground transition">
                    Contato
                  </Link>
                </li>
                <li>AMZ Ofertas</li>
                <li>Plataforma desenvolvida pela Atom Brasil</li>
                <li>CNPJ 22.003.550/0001-05</li>
                <li>
                  <a
                    href="https://atombrasildigital.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-foreground transition"
                  >
                    atombrasildigital.com
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Barra legal sempre visível (requisito TikTok App Review) */}
          <div className="mt-10 pt-8 border-t flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6">
            <Link
              to="/termos"
              className="text-sm sm:text-base font-semibold text-foreground underline underline-offset-4 hover:text-primary transition"
            >
              Termos de Uso
            </Link>
            <span className="hidden sm:inline text-muted-foreground">·</span>
            <Link
              to="/politica-privacidade"
              className="text-sm sm:text-base font-semibold text-foreground underline underline-offset-4 hover:text-primary transition"
            >
              Política de Privacidade
            </Link>
            <span className="hidden sm:inline text-muted-foreground">·</span>
            <Link
              to="/data-deletion"
              className="text-sm sm:text-base font-semibold text-foreground underline underline-offset-4 hover:text-primary transition"
            >
              Exclusão de Dados
            </Link>
          </div>

          <div className="mt-8 pt-6 border-t text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} ATOM BRASIL DIGITAL LTDA — CNPJ 22.003.550/0001-05
          </div>
        </div>
      </footer>
    </div>
  );
}
