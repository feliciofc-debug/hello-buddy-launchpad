ALTER TABLE public.empresa_config ADD COLUMN IF NOT EXISTS regras_copy TEXT;

UPDATE public.empresa_config
SET regras_copy = 'TOM: consultoria, não venda. O protagonista é o objetivo do cliente, nunca o consultor.
PROIBIDO ABSOLUTO: falar de financiamento, financiar, empréstimo, taxa de juros de banco ou comparar com crédito bancário. Nunca citar a palavra "financiamento".
PROIBIDO: "realizar sonhos", "eu resolvo", "eu tenho a solução", "clica agora", "não perca", urgência artificial, tom egocêntrico ou de vendedor.
FOCO OBRIGATÓRIO em cada copy:
1) Vantagens técnicas do consórcio (sem juros, custo total previsível, poder de compra à vista na contemplação, flexibilidade de lance, possibilidade de usar o crédito para bens ou capital).
2) Preservação do capital do cliente: não descapitalizar, manter reserva e liquidez, disciplina de aporte programado.
3) Estrutura de planejamento: prazo, objetivo, capacidade de aporte, critério de decisão — mostrar método, não promessa.
4) Derrubar objeções clássicas do consórcio de forma direta e honesta: "demora para contemplar", "não sei quando vou receber", "é caro", "não tenho controle", "e se eu desistir", "e se precisar antes" — responder com critério técnico (lance, prazo, planejamento, cessão/transferência, previsibilidade).
CTA: convite consultivo para enviar o cenário no WhatsApp e receber análise, sem pressão.'
WHERE user_id = 'd6159ef4-f0bd-4935-a335-c5e8964e4f17';