import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Instagram, Facebook, MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface SocialNetwork {
  id: string;
  name: string;
  icon: any;
  color: string;
  connected: boolean;
  username?: string;
  connectedDays?: number;
  status?: string;
  phoneNumber?: string;
}

const RedesSociais = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string>("");
  const [networks, setNetworks] = useState<SocialNetwork[]>([
    {
      id: "instagram",
      name: "Instagram",
      icon: Instagram,
      color: "bg-gradient-to-br from-purple-600 via-pink-600 to-orange-400",
      connected: false,
    },
    {
      id: "facebook",
      name: "Facebook",
      icon: Facebook,
      color: "bg-blue-600",
      connected: false,
    },
  ]);

  useEffect(() => {
    loadUserData();
    loadNetworkStatus();
  }, []);

  const loadUserData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
    }
  };

  const loadNetworkStatus = async () => {
    const savedNetworks = localStorage.getItem('social-networks');
    if (savedNetworks) {
      setNetworks(JSON.parse(savedNetworks));
    }
  };

  const handleConnect = (networkId: string) => {
    if (networkId === "instagram") {
      const META_APP_ID = import.meta.env.VITE_META_APP_ID;
      const redirectUri = `${window.location.origin}/auth/callback/meta`;
      const scope = 'email,public_profile';
      const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${userId}`;
      window.location.href = authUrl;
    } else if (networkId === "facebook") {
      const META_APP_ID = import.meta.env.VITE_META_APP_ID;
      const redirectUri = `${window.location.origin}/auth/callback/meta`;
      const scope = 'email,public_profile';
      const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${userId}`;
      window.location.href = authUrl;
    }
  };

  const handleReconnect = (networkId: string) => {
    handleConnect(networkId);
  };

  const handleRemove = (networkId: string) => {
    setNetworks(prev => 
      prev.map(net => 
        net.id === networkId 
          ? { ...net, connected: false, username: undefined, connectedDays: undefined }
          : net
      )
    );
    localStorage.setItem('social-networks', JSON.stringify(networks));
    toast.success("Conexão removida com sucesso!");
  };

  const renderNetworkCard = (network: SocialNetwork) => {
    const Icon = network.icon;
    
    return (
      <Card key={network.id} className="overflow-hidden">
        <CardHeader className={`${network.color} text-white`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {typeof Icon === 'string' ? (
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center font-bold text-black">
                  {Icon}
                </div>
              ) : (
                <Icon className="w-10 h-10" />
              )}
              <CardTitle className="text-white">{network.name}</CardTitle>
            </div>
            <Badge variant={network.connected ? "secondary" : "outline"} className={network.connected ? "bg-green-500 text-white" : "bg-gray-500 text-white"}>
              {network.connected ? "Conectada" : "Desconectada"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {network.connected ? (
            <div className="space-y-4">
              <div className="space-y-2">
                {network.username && (
                  <p className="text-lg font-semibold">@{network.username}</p>
                )}
                {network.phoneNumber && (
                  <p className="text-lg font-semibold">{network.phoneNumber}</p>
                )}
                {network.connectedDays && (
                  <p className="text-sm text-muted-foreground">
                    Conectado há {network.connectedDays} dias
                  </p>
                )}
                {network.status && (
                  <p className="text-sm font-medium">{network.status}</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={() => handleReconnect(network.id)}
                  variant="outline"
                  className="flex-1"
                >
                  🔄 Reconectar
                </Button>
                <Button 
                  onClick={() => handleRemove(network.id)}
                  variant="destructive"
                  className="flex-1"
                >
                  🗑️ Remover
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <CardDescription className="mb-4">
                Conecte sua conta {network.name} para automatizar suas postagens
              </CardDescription>
              <Button 
                onClick={() => handleConnect(network.id)}
                className={`w-full ${network.color}`}
              >
                ➕ Conectar {network.name}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4 md:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <Button
          onClick={() => navigate('/dashboard')}
          variant="ghost"
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para o Dashboard
        </Button>

        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Redes Sociais</h1>
          <p className="text-muted-foreground">Conecte suas redes sociais para automatizar suas postagens</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {networks.map(network => renderNetworkCard(network))}
        </div>

        <div className="text-center p-4 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground">
            🔒 Seus dados são seguros. Usamos apenas permissões necessárias.
          </p>
        </div>
      </div>
    </div>
  );
};

export default RedesSociais;