# Cota de vídeos configurável, sem bloquear o administrador

## Resultado

- Remover o número fixo de 5 vídeos do código.
- Deixar contas administradoras sem limite.
- Aplicar aos clientes a cota diária definida pelo plano, com ajuste individual quando necessário.
- Manter somente o controle de fila para proteger o worker que processa um vídeo por vez.
- Não contar vídeos que falharam ou foram cancelados.

## Implementação

### 1. Configuração no painel administrativo

- Adicionar a cota diária de vídeos aos planos.
- Adicionar uma substituição opcional por conta: vazio usa o plano; `-1` significa ilimitado.
- Criar no painel administrativo uma área “Cotas de vídeo” para alterar os valores por plano e por conta, sem precisar mudar código.
- Exibir claramente a origem do limite: administrador, ajuste individual, plano ou acesso ilimitado padrão.

### 2. Regra única no servidor

- Substituir `COTA_DIARIA_POR_TENANT = 5` por uma resolução central da cota efetiva.
- Ordem de prioridade:
  1. conta com papel de administrador: ilimitada;
  2. ajuste individual da conta;
  3. limite do plano ativo;
  4. conta sem plano/configuração: ilimitada, seguindo a regra de acesso padrão da plataforma.
- Continuar isolando toda consulta pelo identificador da conta.

### 3. Falhas não consomem cota

- Contar apenas vídeos concluídos e os que ainda estão efetivamente na fila/processamento.
- Ignorar estados de erro e cancelamento.
- Como a fila já limita trabalhos simultâneos, uma falha libera automaticamente aquela tentativa sem ajuste manual.

### 4. Aviso de saldo

- Ao aceitar cada geração, devolver o uso previsto: “Este é seu 4º de 5 vídeos hoje. Restará 1.”
- Para administrador ou conta ilimitada, informar “Vídeos ilimitados nesta conta”.
- Mostrar o mesmo saldo no gerador da plataforma e na resposta do Jarvis.
- Quando a cota do cliente acabar, informar o total do plano e que o limite pode ser ajustado pelo administrador.

### 5. Validação segura

- Cobrir com testes: administrador ilimitado, plano limitado, ajuste individual, conta sem plano, falha/cancelamento não contado e mensagens de saldo.
- Validar o fluxo sem iniciar renderizações reais nem publicar conteúdo.
- Manter a publicação pelo Jarvis desativada; esta alteração afeta somente geração e fila de vídeos.

## Onde ficará configurado

- No painel administrativo, em **Cotas de vídeo**.
- O valor padrão ficará em cada plano; exceções ficarão na própria conta do cliente.
