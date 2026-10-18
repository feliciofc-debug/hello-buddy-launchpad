import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { signInWithEmailPassword } from "@/lib/auth-sign-in";
import {
  businessTenantHomePath,
  VEHICLE_DEALER_TENANT_TYPE,
} from "@/lib/business-tenant";
import { fetchIsAppAdmin } from "@/lib/app-admin";
import { writeAmzAutoModePreference } from "@/lib/amz-auto-mode";
import { AmzAutoLogo } from "./AmzAutoLogo";
import { AmzAutoPageShell } from "./AmzAutoLayout";

export default function AmzAutoEntrarPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [wrongTenant, setWrongTenant] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [sendingReset, setSendingReset] = useState(false);

  useEffect(() => {
    document.title = "Entrar — AMZ Auto";
    let robots = document.querySelector('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement("meta");
      robots.setAttribute("name", "robots");
      document.head.appendChild(robots);
    }
    robots.setAttribute("content", "noindex, nofollow");
    return () => {
      robots?.setAttribute("content", "index, follow");
    };
  }, []);

  const routeAfterAmzAutoLogin = async (userId: string, userEmail: string) => {
    const { data: profile } = await supabase
      .from("profiles")
      .select("tipo, validade_acesso")
      .eq("id", userId)
      .maybeSingle();

    if (!profile) {
      toast.error("Não foi possível validar seu perfil.");
      return;
    }

    if (profile.validade_acesso && new Date(profile.validade_acesso) < new Date()) {
      await supabase.auth.signOut();
      toast.error("Seu acesso expirou. Fale com o suporte.");
      return;
    }

    const isRevenda = profile.tipo === VEHICLE_DEALER_TENANT_TYPE;
    const isAdmin = await fetchIsAppAdmin(userId, userEmail);

    if (!isRevenda && !isAdmin) {
      await supabase.auth.signOut();
      setWrongTenant(true);
      return;
    }

    writeAmzAutoModePreference(true);
    navigate(businessTenantHomePath(VEHICLE_DEALER_TENANT_TYPE));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setWrongTenant(false);
    setLoading(true);
    try {
      const { data, error } = await signInWithEmailPassword(
        supabase,
        email,
        password,
      );
      if (error) throw error;
      toast.success("Login realizado com sucesso");
      await routeAfterAmzAutoLogin(data.user.id, email);
    } catch (err: unknown) {
      const msg = String((err as Error)?.message || "Erro ao fazer login");
      if (msg.toLowerCase().includes("invalid login credentials")) {
        toast.error("E-mail ou senha incorretos");
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (event: FormEvent) => {
    event.preventDefault();
    setSendingReset(true);
    try {
      const redirectTo = `${window.location.origin}/alterar-senha`;
      const { error } = await supabase.auth.resetPasswordForEmail(
        forgotEmail.trim().toLowerCase(),
        { redirectTo },
      );
      if (error) throw error;
      toast.success("Enviamos um link para redefinir sua senha.");
      setForgotOpen(false);
    } catch (err: unknown) {
      toast.error(String((err as Error)?.message || "Erro ao enviar e-mail"));
    } finally {
      setSendingReset(false);
    }
  };

  return (
    <AmzAutoPageShell>
      <div className="flex min-h-screen flex-wrap">
        <div className="flex min-w-0 flex-1 basis-[480px] flex-col justify-between gap-12 bg-[#0C0E11] p-10 text-[#F5F3EE] md:p-12">
          <AmzAutoLogo />
          <div className="flex max-w-md flex-col gap-4">
            <div className="text-sm font-bold uppercase tracking-[0.12em] text-[#FF6B1A]">
              Área exclusiva para lojas de veículos
            </div>
            <h1 className="font-display m-0 text-[clamp(2rem,4vw,2.75rem)] leading-tight">
              Sua loja inteira num lugar só.
            </h1>
            <p className="m-0 text-[17px] leading-relaxed text-[#C9C5BC]">
              Atendimento, estoque, publicação e gestão. Entre com o acesso que você recebeu por e-mail.
            </p>
          </div>
          <div className="text-sm text-[#A8A49B]">AMZ Auto é uma divisão da AMZ Ofertas</div>
        </div>

        <main className="flex min-w-0 flex-1 basis-[480px] items-center justify-center p-6 md:p-10">
          <div className="flex w-full max-w-[420px] flex-col gap-5">
            <h2 className="font-display m-0 text-[34px]">Entrar</h2>

            {wrongTenant ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-[15px] text-[#45413B]">
                Esta área é exclusiva para lojas AMZ Auto.{" "}
                <Link to="/login" className="amz-auto-link font-bold">
                  Acesse o login geral
                </Link>
                .
              </div>
            ) : null}

            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-sm font-semibold">E-mail</label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@sualoja.com.br"
                  className="min-h-[50px] rounded-[10px] border border-[#C9C3B8] px-3.5 text-base"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="senha" className="text-sm font-semibold">Senha</label>
                <input
                  id="senha"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Sua senha"
                  className="min-h-[50px] rounded-[10px] border border-[#C9C3B8] px-3.5 text-base"
                />
              </div>
              <div className="flex flex-wrap justify-between gap-2 text-[15px]">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-5 w-5"
                  />
                  Manter conectado
                </label>
                <button
                  type="button"
                  className="amz-auto-link border-0 bg-transparent p-0 font-semibold"
                  onClick={() => {
                    setForgotEmail(email);
                    setForgotOpen(true);
                  }}
                >
                  Esqueci minha senha
                </button>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="min-h-14 rounded-xl border-0 bg-[#0C0E11] text-[17px] font-bold text-[#F5F3EE] disabled:opacity-60"
              >
                {loading ? "Entrando…" : "Entrar"}
              </button>
            </form>

            {forgotOpen ? (
              <form onSubmit={handleForgot} className="flex flex-col gap-3 rounded-xl border border-[#DDD8CE] p-4">
                <p className="m-0 text-sm text-[#45413B]">Informe seu e-mail para receber o link de redefinição.</p>
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="min-h-11 rounded-[10px] border border-[#C9C3B8] px-3"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={sendingReset}
                    className="flex-1 rounded-lg bg-[#FF6B1A] py-2 font-semibold text-[#0C0E11]"
                  >
                    {sendingReset ? "Enviando…" : "Enviar link"}
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border px-3"
                    onClick={() => setForgotOpen(false)}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : null}

            <div className="border-t border-[#DDD8CE] pt-4 text-[15px] text-[#45413B]">
              Ainda não é cliente?{" "}
              <Link to="/amz_auto/cadastro" className="amz-auto-link font-bold">
                Cadastrar minha loja
              </Link>
            </div>
          </div>
        </main>
      </div>
    </AmzAutoPageShell>
  );
}
