import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { User, Building2, Factory } from 'lucide-react';

type UserType = 'afiliado' | 'empresa' | 'fabrica';

export default function UserTypeSelector() {
  const [currentType, setCurrentType] = useState<UserType>('afiliado');
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    checkAdminAndLoadType();
  }, []);

  const checkAdminAndLoadType = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setUserId(user.id);

      // Verificar se é admin
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single();

      setIsAdmin(!!roleData);

      // Carregar tipo atual do perfil
      const { data: profileData } = await supabase
        .from('profiles')
        .select('tipo')
        .eq('id', user.id)
        .single();

      if (profileData?.tipo) {
        setCurrentType(profileData.tipo as UserType);
      }
    } catch (error) {
      console.error('Erro ao verificar permissões:', error);
    }
  };

  const handleTypeChange = async (newType: UserType) => {
    if (!userId) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ tipo: newType })
        .eq('id', userId);

      if (error) throw error;

      setCurrentType(newType);
      toast.success(`Tipo alterado para ${newType.toUpperCase()}`);
      
      // Recarregar a página para atualizar todas as funcionalidades
      setTimeout(() => window.location.reload(), 1000);
    } catch (error: any) {
      console.error('Erro ao alterar tipo:', error);
      toast.error('Erro ao alterar tipo de usuário');
    } finally {
      setLoading(false);
    }
  };

  // Só mostrar para admin
  if (!isAdmin) return null;

  const types = [
    { 
      value: 'afiliado' as UserType, 
      label: 'Afiliado', 
      icon: User,
      description: 'Buscar e promover produtos'
    },
    { 
      value: 'empresa' as UserType, 
      label: 'Empresa', 
      icon: Building2,
      description: 'Vender produtos próprios'
    },
    { 
      value: 'fabrica' as UserType, 
      label: 'Fábrica', 
      icon: Factory,
      description: 'Produção e distribuição'
    }
  ];

  return (
    <Card className="p-6 mb-6 bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
      <div className="space-y-4">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-foreground mb-1">
            Modo de Acesso - Admin
          </h3>
          <p className="text-sm text-muted-foreground">
            Selecione o tipo de funcionalidades que deseja acessar
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {types.map((type) => {
            const Icon = type.icon;
            const isActive = currentType === type.value;
            
            return (
              <Button
                key={type.value}
                onClick={() => handleTypeChange(type.value)}
                disabled={loading || isActive}
                variant={isActive ? "default" : "outline"}
                className={`h-auto py-4 flex flex-col items-center gap-2 transition-all ${
                  isActive 
                    ? 'bg-primary text-primary-foreground shadow-lg scale-105' 
                    : 'hover:bg-primary/10 hover:border-primary/40'
                }`}
              >
                <Icon className="w-8 h-8" />
                <div className="text-center">
                  <div className="font-bold text-base">{type.label}</div>
                  <div className={`text-xs mt-1 ${isActive ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                    {type.description}
                  </div>
                  {isActive && (
                    <div className="text-xs font-semibold mt-1 text-primary-foreground">
                      ● ATIVO
                    </div>
                  )}
                </div>
              </Button>
            );
          })}
        </div>

        <div className="text-center text-xs text-muted-foreground pt-2 border-t border-border/50">
          Modo atual: <span className="font-semibold text-foreground">{currentType.toUpperCase()}</span>
        </div>
      </div>
    </Card>
  );
}
