-- COFRE-AUD-1 / VEIC-WPP-1: ações de auditoria usadas pelo código além do check original.
ALTER TABLE public.gestao_documento_acesso
  DROP CONSTRAINT IF EXISTS gestao_documento_acesso_acao_check;

ALTER TABLE public.gestao_documento_acesso
  ADD CONSTRAINT gestao_documento_acesso_acao_check CHECK (
    acao IN (
      'upload',
      'ver',
      'abrir',
      'baixar',
      'ler',
      'confirmar',
      'excluir',
      'ler_falha',
      'vincular_automatico',
      'desvincular'
    )
  );
