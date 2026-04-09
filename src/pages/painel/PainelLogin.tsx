import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

const PAINEL_PASSWORD = "atom2024suporte";

export default function PainelLogin() {
  const [senha, setSenha] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    setTimeout(() => {
      if (senha === PAINEL_PASSWORD) {
        sessionStorage.setItem("painel_auth", "true");
        sessionStorage.setItem("painel_auth_time", Date.now().toString());
        navigate("/painel/dashboard");
        toast.success("Acesso autorizado");
      } else {
        toast.error("Senha incorreta");
      }
      setLoading(false);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-slate-800/80 backdrop-blur border-slate-700">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center">
            <Shield className="w-8 h-8 text-emerald-400" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-white">
              ATOM BRASIL
            </CardTitle>
            <p className="text-emerald-400 font-semibold text-sm tracking-widest">
              PAINEL DE SUPORTE
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Senha de acesso"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400 pr-10"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <Button
              type="submit"
              disabled={loading || !senha}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {loading ? "Verificando..." : "Acessar Painel"}
            </Button>
          </form>
          <p className="text-center text-xs text-slate-500 mt-6">
            Acesso restrito a operadores autorizados
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
