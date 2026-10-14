import { type FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Shield, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  type AdminClientValidation,
  validateAdminClientInput,
} from "@/lib/admin-client-validation";
import { clientTypeLabel } from "@/lib/client-menu-routes";

type ClientType = {
  tipo_cliente: string;
  empresa_nome: string | null;
};

export default function AdminCriarCliente() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [clientTypes, setClientTypes] = useState<ClientType[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [errors, setErrors] = useState<AdminClientValidation>({});

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          toast({
            title: "Acesso negado",
            description: "Você precisa estar logado.",
            variant: "destructive",
          });
          navigate("/login");
          return;
        }

        const { data: roleData, error: roleError } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();
        const isAdminByEmail =
          user.email === "expo@atombrasildigital.com";
        if ((roleError || !roleData) && !isAdminByEmail) {
          toast({
            title: "Acesso negado",
            description: "Você não tem permissão para acessar esta página.",
            variant: "destructive",
          });
          navigate("/dashboard");
          return;
        }

        const { data, error } = await supabase
          .from("client_menu_config")
          .select("tipo_cliente, empresa_nome")
          .order("tipo_cliente");
        if (error) throw error;
        setClientTypes(data || []);
      } catch {
        toast({
          title: "Erro",
          description: "Não foi possível carregar os tipos de cliente.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [navigate]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const validation = validateAdminClientInput({
      email,
      password,
      name,
      type,
    }, clientTypes.map((item) => item.tipo_cliente));
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    setSubmitting(true);
    const { data, error } = await supabase.rpc("admin_criar_cliente", {
      p_email: email.trim().toLowerCase(),
      p_senha: password,
      p_nome: name.trim(),
      p_tipo: type,
    });
    setSubmitting(false);

    if (error) {
      toast({
        title: "Não foi possível criar o cliente",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Cliente criado",
      description: `Conta criada com sucesso. ID: ${data}`,
    });
    setEmail("");
    setPassword("");
    setName("");
    setType("");
    setErrors({});
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => navigate("/admin")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Criar cliente
          </h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Nova conta
            </CardTitle>
            <CardDescription>
              Crie o acesso e o perfil inicial do cliente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="client-name">Nome</Label>
                <Input
                  id="client-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  aria-invalid={Boolean(errors.name)}
                  autoComplete="organization"
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="client-email">E-mail</Label>
                <Input
                  id="client-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  aria-invalid={Boolean(errors.email)}
                  autoComplete="email"
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="client-password">Senha</Label>
                <Input
                  id="client-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  aria-invalid={Boolean(errors.password)}
                  autoComplete="new-password"
                  minLength={8}
                />
                {errors.password && (
                  <p className="text-sm text-destructive">
                    {errors.password}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger aria-invalid={Boolean(errors.type)}>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientTypes.map((item) => (
                      <SelectItem
                        key={item.tipo_cliente}
                        value={item.tipo_cliente}
                      >
                        {clientTypeLabel(item.tipo_cliente)}
                        {item.empresa_nome
                          ? ` — ${item.empresa_nome}`
                          : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.type && (
                  <p className="text-sm text-destructive">{errors.type}</p>
                )}
              </div>

              <Button type="submit" disabled={submitting}>
                {submitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Criar
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
