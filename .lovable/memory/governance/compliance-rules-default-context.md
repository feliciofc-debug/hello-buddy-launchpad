# Compliance Rules - Default Context

Updated: 2026-04-07

## Regras Ativas

1. **Contexto Padrão PJ**: Toda implementação é sempre no contexto da conta PJ (login `expo@atombrasildigital.com`), salvo indicação explícita do usuário.

2. **Isolamento de Afiliados**: Não modificar funcionalidades ou arquivos relacionados a afiliados (ex: `src/components/afiliado/`) a menos que o termo "afiliado" seja mencionado explicitamente pelo usuário.

3. **Produtos Afiliados DESATIVADOS**: O sistema de produtos afiliados NÃO está em operação. Não implementar, corrigir ou modificar nada relacionado a produtos de afiliados. A área de afiliados de produtos está suspensa por tempo indeterminado. Qualquer referência a "produtos" deve ser tratada no contexto PJ (tabela `produtos`), NUNCA na tabela `afiliado_produtos`.
