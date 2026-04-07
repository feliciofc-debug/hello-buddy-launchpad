# Compliance Rules - Default Context

Updated: 2026-04-07

## Regras Ativas

1. **Contexto Padrão PJ para TODOS os clientes**: Toda implementação é feita no contexto PJ e deve funcionar para TODOS os clientes PJ da plataforma, não apenas para o login admin `expo@atombrasildigital.com`. Só restringir ao login admin quando o usuário disser explicitamente "só no meu login" ou "testar primeiro no meu".

2. **Isolamento de Afiliados**: Não modificar funcionalidades ou arquivos relacionados a afiliados (ex: `src/components/afiliado/`) a menos que o termo "afiliado" seja mencionado explicitamente pelo usuário.

3. **Produtos Afiliados DESATIVADOS**: O sistema de produtos afiliados NÃO está em operação. Não implementar, corrigir ou modificar nada relacionado a produtos de afiliados. Qualquer referência a "produtos" deve ser tratada no contexto PJ (tabela `produtos`), NUNCA na tabela `afiliado_produtos`.
