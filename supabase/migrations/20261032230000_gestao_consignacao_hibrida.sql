-- CONSIG-1: consignação híbrida, despesas descontáveis e custo da vaga

CREATE TABLE IF NOT EXISTS public.veiculo_consignacao (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  veiculo_id uuid NOT NULL REFERENCES public.veiculos_estoque(id) ON DELETE CASCADE,
  consignante_nome text NULL,
  valor_garantido_dono numeric(14, 2) NOT NULL DEFAULT 0 CHECK (valor_garantido_dono >= 0),
  pct_loja_excedente numeric(8, 4) NOT NULL CHECK (
    pct_loja_excedente >= 0 AND pct_loja_excedente <= 100
  ),
  piso_loja numeric(14, 2) NULL CHECK (piso_loja >= 0),
  preco_minimo_autorizado numeric(14, 2) NULL CHECK (preco_minimo_autorizado >= 0),
  data_inicio date NOT NULL,
  prazo_dias integer NOT NULL DEFAULT 90 CHECK (prazo_dias > 0),
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'vendido', 'devolvido')),
  observacao text NULL,
  repasse_calculado numeric(14, 2) NULL,
  repasse_aviso text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, veiculo_id)
);

ALTER TABLE public.veiculo_despesas
  ADD COLUMN IF NOT EXISTS descontar_do_consignante boolean NOT NULL DEFAULT false;

ALTER TABLE public.gestao_giro_config
  ADD COLUMN IF NOT EXISTS custo_vaga_dia numeric(14, 2) NULL CHECK (custo_vaga_dia >= 0);

ALTER TABLE public.veiculo_consignacao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS veiculo_consignacao_own ON public.veiculo_consignacao;
CREATE POLICY veiculo_consignacao_own ON public.veiculo_consignacao
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.veiculo_consignacao TO authenticated;
GRANT ALL ON public.veiculo_consignacao TO service_role;

DROP TRIGGER IF EXISTS update_veiculo_consignacao_updated_at ON public.veiculo_consignacao;
CREATE TRIGGER update_veiculo_consignacao_updated_at
  BEFORE UPDATE ON public.veiculo_consignacao
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.veiculo_consignacao IS
  'Regras comerciais da consignação; não armazena telefone nem CPF do consignante.';
COMMENT ON COLUMN public.veiculo_despesas.descontar_do_consignante IS
  'Na consignação, reduz o repasse ao dono e não vira custo da loja.';
COMMENT ON COLUMN public.gestao_giro_config.custo_vaga_dia IS
  'Custo operacional diário da vaga; NULL não entra nas projeções.';

-- Modelo revisável; preserva qualquer modelo homônimo já editado pela loja.
INSERT INTO public.gestao_contrato_modelo (
  user_id, tipo, titulo, corpo, is_exemplo
)
SELECT DISTINCT
  v.user_id,
  'consignacao',
  'Contrato de consignação',
  'CONTRATO DE CONSIGNAÇÃO — {loja_nome}, CNPJ {loja_cnpj}, {cidade}, {data}.

Consignante: {cliente_nome}, CPF {cliente_cpf}, endereço {cliente_endereco}.
Veículo: {veiculo}, ano {ano}, placa {placa}, chassi {chassi}, cor {cor}, km {km}.

Valor garantido ao dono: {valor_garantido_dono}.
Participação da loja no excedente: {pct_loja_excedente}.
Piso da loja: {piso_loja}.
Preço mínimo autorizado: {preco_minimo_autorizado}.
Prazo: {prazo_dias} dias.

Texto revisável. Este modelo não possui validade jurídica automática e deve ser revisado por advogado.

Assinaturas:',
  true
FROM public.veiculos_estoque v
ON CONFLICT (user_id, tipo, titulo) DO NOTHING;

-- Garante o repasse em qualquer canal que registre/desfaça veiculo_venda
-- (painel, atalho ou WhatsApp), sem depender da tela que iniciou a venda.
CREATE OR REPLACE FUNCTION public.sync_consignacao_venda()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.veiculo_consignacao%ROWTYPE;
  parte_loja numeric(14, 2);
  parte_dono numeric(14, 2);
  despesas_dono numeric(14, 2);
  repasse numeric(14, 2);
  marker text;
  conta public.gestao_conta_lancamento%ROWTYPE;
  aviso text;
  abaixo_garantido boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.veiculo_consignacao
       SET status = 'ativo',
           repasse_aviso = NULL
     WHERE user_id = OLD.user_id
       AND veiculo_id = OLD.veiculo_id
       AND status = 'vendido';
    marker := 'Repasse consignante · veículo ' || OLD.veiculo_id::text;
    UPDATE public.gestao_conta_lancamento
       SET deleted_at = now()
     WHERE user_id = OLD.user_id
       AND veiculo_id = OLD.veiculo_id
       AND observacao LIKE marker || '%'
       AND deleted_at IS NULL
       AND pago_em IS NULL
       AND recebido_em IS NULL;
    RETURN OLD;
  END IF;

  -- Alterações fora de valor/data (ex.: comissão) nunca tocam no repasse.
  IF TG_OP = 'UPDATE'
     AND NEW.valor_venda IS NOT DISTINCT FROM OLD.valor_venda
     AND NEW.data_venda IS NOT DISTINCT FROM OLD.data_venda THEN
    RETURN NEW;
  END IF;

  SELECT *
    INTO c
    FROM public.veiculo_consignacao
   WHERE user_id = NEW.user_id
     AND veiculo_id = NEW.veiculo_id
     AND status <> 'devolvido';

  IF NOT FOUND THEN RETURN NEW; END IF;

  parte_loja := round(greatest(
    (NEW.valor_venda - c.valor_garantido_dono) * c.pct_loja_excedente / 100,
    coalesce(c.piso_loja, 0)
  ), 2);
  parte_dono := round(NEW.valor_venda - parte_loja, 2);
  abaixo_garantido := parte_dono < c.valor_garantido_dono;
  IF abaixo_garantido THEN
    aviso := 'Venda abaixo do garantido — confirme com o dono e ajuste a conta a pagar se ele aceitou menos';
  END IF;

  SELECT coalesce(sum(valor), 0)
    INTO despesas_dono
    FROM public.veiculo_despesas
   WHERE user_id = NEW.user_id
     AND veiculo_id = NEW.veiculo_id
     AND descontar_do_consignante = true
     AND deleted_at IS NULL;

  -- Protege o dono sem bloquear a venda. A loja pode ajustar a conta depois.
  repasse := round(greatest(parte_dono, c.valor_garantido_dono) - despesas_dono, 2);
  marker := 'Repasse consignante · veículo ' || NEW.veiculo_id::text;

  SELECT *
    INTO conta
    FROM public.gestao_conta_lancamento
   WHERE user_id = NEW.user_id
     AND veiculo_id = NEW.veiculo_id
     AND tipo = 'pagar'
     AND observacao LIKE marker || '%'
   ORDER BY created_at DESC
   LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.gestao_conta_lancamento (
      user_id, tipo, categoria_operacional, valor, vencimento,
      observacao, veiculo_id, origem
    ) VALUES (
      NEW.user_id, 'pagar', 'outros', repasse, NEW.data_venda + 2,
      marker || CASE WHEN aviso IS NULL THEN '' ELSE ' · ' || aviso END,
      NEW.veiculo_id, 'manual'
    );
  ELSIF conta.deleted_at IS NOT NULL THEN
    aviso := concat_ws(
      ' · ',
      aviso,
      'repasse recalculado: R$ ' || to_char(repasse, 'FM999999990D00') ||
        ' — conta a pagar foi apagada manualmente, revise'
    );
  ELSIF conta.pago_em IS NOT NULL OR conta.recebido_em IS NOT NULL THEN
    aviso := concat_ws(
      ' · ',
      aviso,
      'repasse recalculado: R$ ' || to_char(repasse, 'FM999999990D00') ||
        ' — conta a pagar já foi paga/baixada, revise'
    );
  ELSIF c.repasse_calculado IS NOT NULL
        AND conta.valor IS DISTINCT FROM c.repasse_calculado THEN
    aviso := concat_ws(
      ' · ',
      aviso,
      'repasse recalculado: R$ ' || to_char(repasse, 'FM999999990D00') ||
        ' — conta a pagar foi editada manualmente, revise'
    );
  ELSE
    UPDATE public.gestao_conta_lancamento
       SET valor = repasse,
           vencimento = NEW.data_venda + 2,
           observacao = marker ||
             CASE WHEN aviso IS NULL THEN '' ELSE ' · ' || aviso END
     WHERE id = conta.id;
  END IF;

  UPDATE public.veiculo_consignacao
     SET status = 'vendido',
         repasse_calculado = repasse,
         repasse_aviso = aviso
   WHERE user_id = NEW.user_id
     AND veiculo_id = NEW.veiculo_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_consignacao_venda_trigger ON public.veiculo_venda;
CREATE TRIGGER sync_consignacao_venda_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.veiculo_venda
  FOR EACH ROW EXECUTE FUNCTION public.sync_consignacao_venda();
