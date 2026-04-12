import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { RefreshCw, Plus, X, Flag } from 'lucide-react';

interface FeatureFlag {
  id: string;
  flag_key: string;
  description: string | null;
  is_enabled: boolean;
  allowed_emails: string[];
  created_at: string;
  updated_at: string;
}

export function FeatureFlagsTab() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmailInputs, setNewEmailInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    loadFlags();
  }, []);

  const loadFlags = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('feature_flags')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      toast({ title: 'Erro', description: 'Não foi possível carregar as flags.', variant: 'destructive' });
    } else {
      setFlags((data as any) || []);
    }
    setLoading(false);
  };

  const toggleFlag = async (flag: FeatureFlag) => {
    const { error } = await supabase
      .from('feature_flags')
      .update({ is_enabled: !flag.is_enabled } as any)
      .eq('id', flag.id);

    if (error) {
      toast({ title: 'Erro', description: 'Não foi possível atualizar a flag.', variant: 'destructive' });
      return;
    }

    setFlags(prev => prev.map(f => f.id === flag.id ? { ...f, is_enabled: !f.is_enabled } : f));
    toast({ title: 'Sucesso', description: `Flag "${flag.flag_key}" ${!flag.is_enabled ? 'ativada' : 'desativada'} para todos.` });
  };

  const addEmail = async (flag: FeatureFlag) => {
    const email = (newEmailInputs[flag.id] || '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      toast({ title: 'Email inválido', variant: 'destructive' });
      return;
    }
    if (flag.allowed_emails.includes(email)) {
      toast({ title: 'Email já existe na lista', variant: 'destructive' });
      return;
    }

    const updatedEmails = [...flag.allowed_emails, email];
    const { error } = await supabase
      .from('feature_flags')
      .update({ allowed_emails: updatedEmails } as any)
      .eq('id', flag.id);

    if (error) {
      toast({ title: 'Erro', description: 'Não foi possível adicionar email.', variant: 'destructive' });
      return;
    }

    setFlags(prev => prev.map(f => f.id === flag.id ? { ...f, allowed_emails: updatedEmails } : f));
    setNewEmailInputs(prev => ({ ...prev, [flag.id]: '' }));
    toast({ title: 'Email adicionado' });
  };

  const removeEmail = async (flag: FeatureFlag, emailToRemove: string) => {
    const updatedEmails = flag.allowed_emails.filter(e => e !== emailToRemove);
    const { error } = await supabase
      .from('feature_flags')
      .update({ allowed_emails: updatedEmails } as any)
      .eq('id', flag.id);

    if (error) {
      toast({ title: 'Erro', description: 'Não foi possível remover email.', variant: 'destructive' });
      return;
    }

    setFlags(prev => prev.map(f => f.id === flag.id ? { ...f, allowed_emails: updatedEmails } : f));
    toast({ title: 'Email removido' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Controle quais funcionalidades estão visíveis na plataforma. Flags desligadas ficam invisíveis para clientes.
        </p>
        <Button onClick={loadFlags} variant="outline" size="sm" className="gap-2">
          <RefreshCw className="h-4 w-4" /> Atualizar
        </Button>
      </div>

      {flags.map((flag) => (
        <Card key={flag.id}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Flag className="h-5 w-5 text-muted-foreground" />
                <div>
                  <CardTitle className="text-base font-mono">{flag.flag_key}</CardTitle>
                  {flag.description && (
                    <p className="text-sm text-muted-foreground mt-0.5">{flag.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {flag.is_enabled ? (
                  <Badge className="bg-green-500 text-white">🟢 Ativo para todos</Badge>
                ) : (
                  <Badge variant="secondary">🔴 Somente testadores</Badge>
                )}
                <Switch
                  checked={flag.is_enabled}
                  onCheckedChange={() => toggleFlag(flag)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Emails com acesso de teste:</p>
              <div className="flex flex-wrap gap-2">
                {flag.allowed_emails.map((email) => (
                  <Badge key={email} variant="outline" className="gap-1 pr-1">
                    {email}
                    <button
                      onClick={() => removeEmail(flag, email)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <Input
                  placeholder="email@exemplo.com"
                  value={newEmailInputs[flag.id] || ''}
                  onChange={(e) => setNewEmailInputs(prev => ({ ...prev, [flag.id]: e.target.value }))}
                  className="max-w-xs h-8 text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && addEmail(flag)}
                />
                <Button size="sm" variant="outline" onClick={() => addEmail(flag)} className="h-8 gap-1">
                  <Plus className="h-3 w-3" /> Adicionar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {flags.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">Nenhuma feature flag encontrada.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
