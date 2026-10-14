CREATE TABLE IF NOT EXISTS public.veiculos_estoque (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  codigo_origem text,
  marca text NOT NULL,
  modelo text NOT NULL,
  versao text,
  ano_fabricacao integer,
  ano_modelo integer,
  km integer,
  preco numeric(12,2),
  cor text,
  combustivel text,
  cambio text,
  portas integer,
  blindado boolean NOT NULL DEFAULT false,
  nivel_blindagem text,
  opcionais text[] NOT NULL DEFAULT '{}',
  caracteristicas text[] NOT NULL DEFAULT '{}',
  descricao text,
  fotos text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'disponivel'
    CONSTRAINT veiculos_estoque_status_check
    CHECK (status IN ('disponivel', 'reservado', 'vendido')),
  destaque boolean NOT NULL DEFAULT false,
  origem text,
  url_origem text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  vendido_at timestamptz,
  CONSTRAINT veiculos_estoque_user_codigo_origem_key
    UNIQUE (user_id, codigo_origem)
);

CREATE INDEX IF NOT EXISTS idx_veiculos_estoque_user_status
  ON public.veiculos_estoque(user_id, status);

CREATE INDEX IF NOT EXISTS idx_veiculos_estoque_user_marca_modelo
  ON public.veiculos_estoque(user_id, marca, modelo);

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.veiculos_estoque TO authenticated;
GRANT ALL ON public.veiculos_estoque TO service_role;

ALTER TABLE public.veiculos_estoque ENABLE ROW LEVEL SECURITY;

CREATE POLICY "veiculos_estoque_select_own"
  ON public.veiculos_estoque FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "veiculos_estoque_insert_own"
  ON public.veiculos_estoque FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "veiculos_estoque_update_own"
  ON public.veiculos_estoque FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "veiculos_estoque_delete_own"
  ON public.veiculos_estoque FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_veiculos_estoque_updated_at
  ON public.veiculos_estoque;
CREATE TRIGGER update_veiculos_estoque_updated_at
  BEFORE UPDATE ON public.veiculos_estoque
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.client_menu_config (
  tipo_cliente,
  menus_permitidos,
  empresa_nome
)
VALUES (
  'revenda_veiculos',
  COALESCE(
    (
      SELECT CASE
        WHEN 'produtos' = ANY(menus_permitidos)
          THEN array_replace(menus_permitidos, 'produtos', 'veiculos')
        WHEN NOT ('veiculos' = ANY(menus_permitidos))
          THEN array_append(menus_permitidos, 'veiculos')
        ELSE menus_permitidos
      END
      FROM public.client_menu_config
      WHERE tipo_cliente = 'empresa'
    ),
    ARRAY[
      'dashboard',
      'veiculos',
      'ia-marketing',
      'redes-sociais',
      'whatsapp',
      'configuracoes'
    ]
  ),
  'AMZ Ofertas'
)
ON CONFLICT (tipo_cliente) DO UPDATE
SET menus_permitidos = EXCLUDED.menus_permitidos,
    empresa_nome = EXCLUDED.empresa_nome;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_tipo_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_tipo_check
  CHECK (
    tipo IS NULL OR tipo IN (
      'comum',
      'empresa',
      'mcassab',
      'afiliado',
      'afiliado_admin',
      'b2b',
      'parceiro',
      'parceiro_peixotinho',
      'barra_world',
      'fabrica',
      'revenda_veiculos'
    )
  );
