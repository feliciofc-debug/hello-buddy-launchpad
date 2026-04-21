import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Upload, Trash2, ImageIcon } from 'lucide-react';

const DEFAULT_LOGO = '/logo-amz-reel.png';
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ACCEPTED = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

export const MarcaPersonalizacao = () => {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchLogo = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await supabase
        .from('profiles')
        .select('logo_reel_url')
        .eq('id', user.id)
        .maybeSingle();
      setLogoUrl((data as any)?.logo_reel_url ?? null);
      setLoading(false);
    };
    fetchLogo();
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED.includes(file.type)) {
      toast.error('Formato inválido. Use PNG, JPEG ou WEBP.');
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      toast.error('Arquivo muito grande. Máximo 5MB.');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Você precisa estar logado.');
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const path = `${user.id}/logo.${ext}`;

      // Limpar variantes anteriores (outras extensões) — best effort
      const variants = ['png', 'jpg', 'jpeg', 'webp'].filter(e => e !== ext).map(e => `${user.id}/logo.${e}`);
      await supabase.storage.from('user-logos').remove(variants).catch(() => {});

      const { error: upErr } = await supabase.storage
        .from('user-logos')
        .upload(path, file, { upsert: true, contentType: file.type, cacheControl: '3600' });
      if (upErr) throw upErr;

      const { data: { publicUrl } } = supabase.storage.from('user-logos').getPublicUrl(path);
      // Cache buster — força reload no navegador quando atualizar
      const finalUrl = `${publicUrl}?v=${Date.now()}`;

      const { error: updErr } = await supabase
        .from('profiles')
        .update({ logo_reel_url: finalUrl } as any)
        .eq('id', user.id);
      if (updErr) throw updErr;

      setLogoUrl(finalUrl);
      toast.success('Logo atualizada com sucesso!');
    } catch (err: any) {
      console.error('[MarcaPersonalizacao] Erro upload:', err);
      toast.error(`Erro ao enviar logo: ${err.message || 'tente novamente'}`);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    if (!window.confirm('Remover sua logo personalizada? Os Reels voltarão a usar a logo padrão.')) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setRemoving(true);
    try {
      const variants = ['png', 'jpg', 'jpeg', 'webp'].map(e => `${user.id}/logo.${e}`);
      await supabase.storage.from('user-logos').remove(variants).catch(() => {});
      await supabase.from('profiles').update({ logo_reel_url: null } as any).eq('id', user.id);
      setLogoUrl(null);
      toast.success('Logo removida.');
    } catch (err: any) {
      toast.error('Erro ao remover logo.');
      console.error(err);
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-1 text-gray-900 dark:text-white">🎨 Personalização da Marca</h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">Logo para seus Reels</p>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Carregando...</span>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Preview */}
          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 flex items-center justify-center bg-gray-50 dark:bg-gray-900/40 min-h-[160px]">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Logo personalizada"
                className="max-h-32 max-w-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = DEFAULT_LOGO;
                }}
              />
            ) : (
              <div className="flex flex-col items-center text-gray-400 dark:text-gray-500 text-center">
                <ImageIcon className="w-10 h-10 mb-2" />
                <span className="text-sm">Sem logo personalizada</span>
                <span className="text-xs">Usando padrão AMZ Ofertas</span>
              </div>
            )}
          </div>

          {/* Botões */}
          <div className="flex gap-3 flex-wrap">
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2 px-4 rounded transition-colors flex items-center gap-2"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? 'Enviando...' : '📤 Fazer upload'}
            </button>
            {logoUrl && (
              <button
                onClick={handleRemove}
                disabled={removing}
                className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-2 px-4 rounded transition-colors flex items-center gap-2"
              >
                {removing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Remover
              </button>
            )}
          </div>

          {/* Dicas */}
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-700">
            <p>💡 <strong>Formato recomendado:</strong> PNG com fundo transparente, 450x150px. Outros formatos são aceitos e ajustados automaticamente.</p>
            <p>💡 <strong>Tamanho máximo:</strong> 5MB. Aceitos: PNG, JPEG, WEBP.</p>
            <p>💡 Se nenhuma logo for enviada, será usada a logo padrão AMZ Ofertas.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarcaPersonalizacao;
