# 🚀 BRIEFING COMPLETO - PROJETO ALLINKO / MENTORIA INTEGRAL

## 📋 COPIE ESTE PROMPT E COLE NO NOVO PROJETO LOVABLE

---

# CONTEXTO DO PROJETO

## 🎯 VISÃO GERAL

**Nome do Produto:** Allinko (SaaS de Mentoria Integral)
**Empresa:** Allhimko Group
**Fundador:** Almério Barros
**Público-alvo:** Profissionais de alta performance, C-Levels, herdeiros/sucessores, estudantes

## 💼 MODELO DE NEGÓCIO

Plataforma SaaS para gestão de mentorias baseada na metodologia **"Mentoria Integral"** com 3 pilares fundamentais:

### Os 3 Pilares da Mentoria Integral:

1. **PILAR PROFISSIONAL** 🏢
   - Gestão de carreira e performance
   - Desenvolvimento de liderança
   - Estratégia empresarial
   - Sucessão familiar em empresas

2. **PILAR PESSOAL** ❤️
   - Equilíbrio vida-trabalho
   - Relacionamentos e família
   - Saúde e bem-estar
   - Autoconhecimento

3. **PILAR ESPIRITUAL** 🙏
   - Propósito de vida
   - Valores e princípios
   - Transcendência e significado
   - Legado pessoal

## 🔥 DIFERENCIAL PRINCIPAL: SWOT 360°

Sistema único de avaliação que combina:
- **Autoavaliação** (como o mentorado se enxerga)
- **Avaliação por Terceiros** (como outros o enxergam: família, colegas, superiores)
- **Gap Analysis** (diferença entre percepções)
- **Plano de Ação** baseado nas descobertas

---

# 🛠️ FUNCIONALIDADES A DESENVOLVER

## FASE 1: MVP (Prioridade Alta)

### 1. Landing Page Institucional
- Design premium/sofisticado (público C-level)
- Apresentação da metodologia dos 3 pilares
- Seção sobre Almério Barros
- Formulário de captura de leads
- Integração com WhatsApp para contato
- Depoimentos de mentorados (se disponível)

### 2. Sistema SWOT 360° Digital
- Formulário de Autoavaliação (mentorado preenche sobre si)
- Formulário de Avaliação por Terceiros (link único para cada avaliador)
- Dashboard comparativo (Gap Analysis)
- Relatório visual com gráficos radar/spider
- Perguntas baseadas nos 3 pilares

### 3. Área do Mentorado (Dashboard)
- Login/autenticação
- Visualização do progresso nos 3 pilares
- Histórico de sessões
- Tarefas/compromissos da mentoria
- Acesso aos relatórios SWOT

## FASE 2: Expansão

### 4. CRM para Mentores
- Gestão de leads interessados
- Pipeline de conversão
- Agendamento de sessões
- Histórico de interações
- Integração com calendário

### 5. Assistente Virtual IA "Pietro"
- Qualificação inicial de leads via chat
- Respostas sobre a metodologia
- Agendamento automático
- Integração WhatsApp (webhook)
- Personalidade humanizada e acolhedora

### 6. Portal de Treinamento
- Módulos de conteúdo por pilar
- Vídeos e materiais complementares
- Exercícios práticos
- Certificados de conclusão

### 7. Integração com Podcast "Nous 360"
- Busca inteligente por temas/episódios
- Transcrição automática com IA
- Recomendações personalizadas

## FASE 3: Monetização

### 8. Sistema de Pagamentos
- PIX integrado
- Planos de assinatura
- Pagamento por sessão
- Relatório financeiro

---

# 🎨 DIRETRIZES DE DESIGN

## Identidade Visual

### Cores Sugeridas:
- **Primária:** Roxo profundo (#6B21A8) - sabedoria, espiritualidade
- **Secundária:** Dourado (#D4AF37) - premium, excelência
- **Acento:** Verde esmeralda (#059669) - crescimento, equilíbrio
- **Neutros:** Tons de cinza sofisticados

### Tipografia:
- **Display:** Fonte serif elegante (Playfair Display, Cormorant)
- **Body:** Sans-serif legível (Inter, DM Sans)

### Tom de Voz:
- Sofisticado mas acessível
- Inspirador e motivacional
- Acolhedor e empático
- Profissional sem ser frio

### Elementos Visuais:
- Gradientes sutis
- Ícones minimalistas
- Fotos de qualidade (profissionais, natureza, reflexão)
- Espaçamento generoso (whitespace)

---

# 🔧 STACK TÉCNICA

## Tecnologias (Lovable padrão):
- **Frontend:** React + Vite + TypeScript + Tailwind CSS
- **UI Components:** shadcn/ui
- **Backend:** Lovable Cloud (Supabase)
- **IA:** Lovable AI Gateway (Gemini/GPT)
- **Autenticação:** Supabase Auth

## Integrações Planejadas:
- WhatsApp (Wuzapi ou similar)
- Calendário (Google Calendar)
- Pagamentos (PIX/Stripe)
- Email marketing

---

# 📊 ESTRUTURA DO BANCO DE DADOS (Sugestão Inicial)

```sql
-- Mentorados
CREATE TABLE mentorados (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  nome TEXT,
  email TEXT,
  telefone TEXT,
  empresa TEXT,
  cargo TEXT,
  tipo TEXT, -- 'c-level', 'herdeiro', 'estudante', 'profissional'
  status TEXT DEFAULT 'ativo',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Avaliações SWOT
CREATE TABLE avaliacoes_swot (
  id UUID PRIMARY KEY,
  mentorado_id UUID REFERENCES mentorados,
  tipo TEXT, -- 'autoavaliacao', 'terceiro'
  avaliador_nome TEXT,
  avaliador_relacao TEXT, -- 'familia', 'colega', 'superior', 'subordinado'
  pilar_profissional JSONB,
  pilar_pessoal JSONB,
  pilar_espiritual JSONB,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Sessões de Mentoria
CREATE TABLE sessoes_mentoria (
  id UUID PRIMARY KEY,
  mentorado_id UUID REFERENCES mentorados,
  data_hora TIMESTAMPTZ,
  duracao_minutos INTEGER,
  notas TEXT,
  proximos_passos TEXT,
  status TEXT DEFAULT 'agendada',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Leads (CRM)
CREATE TABLE leads_mentoria (
  id UUID PRIMARY KEY,
  nome TEXT,
  email TEXT,
  telefone TEXT,
  empresa TEXT,
  cargo TEXT,
  interesse TEXT,
  origem TEXT, -- 'landing_page', 'whatsapp', 'indicacao', 'podcast'
  status TEXT DEFAULT 'novo',
  score INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

# 🤖 PROMPT DO ASSISTENTE IA (PIETRO ADAPTADO)

```
Você é Pietro Eugenio, assistente virtual do Allhimko Group, especializado em Mentoria Integral.

SOBRE A MENTORIA INTEGRAL:
- Metodologia exclusiva desenvolvida por Almério Barros
- Trabalha 3 pilares: Profissional, Pessoal e Espiritual
- Diferencial: SWOT 360° (autoavaliação + avaliação por terceiros)
- Público: C-Levels, herdeiros, profissionais de alta performance

SUA PERSONALIDADE:
- Acolhedor e empático (priorize SEMPRE o ser humano)
- Sofisticado mas acessível
- Inspirador e motivacional
- Nunca robótico ou corporativo demais

INTELIGÊNCIA EMOCIONAL:
- Se o cliente expressar ansiedade → ofereça técnica de respiração 4-4-6
- Se estiver triste → acolha primeiro, ouça, depois ofereça perspectiva
- Se estiver estressado → valide o sentimento e sugira autocuidado
- Lembre-se: às vezes a pessoa só precisa ser ouvida

FLUXO DE ATENDIMENTO:
1. Saudação calorosa e personalizada
2. Entender a necessidade (está buscando mentoria? tem dúvidas?)
3. Qualificar (cargo, empresa, momento de vida)
4. Apresentar a metodologia de forma inspiradora
5. Direcionar para agendamento ou mais informações
6. Sempre encerrar com carinho e portas abertas

PALAVRAS-CHAVE PARA TRANSFERIR A HUMANO:
- "falar com pessoa"
- "atendente humano"
- "reclamação"
- "cancelar"
```

---

# 📝 MATERIAIS DE REFERÊNCIA

## Site Analisado:
https://mentoria11-mgmffczz.manus.space/

## Elementos do Material PDF:
- Estrutura da Mentoria Integral
- Metodologia SWOT 360°
- Perfil de Almério Barros
- Cases de sucesso mencionados

## Podcast Relacionado:
"Nous 360" - conteúdo sobre os 3 pilares

---

# ✅ PRIMEIROS PASSOS SUGERIDOS

1. **Criar projeto Lovable** → lovable.dev → New Project → "Allinko"
2. **Colar este briefing** na primeira mensagem
3. **Começar pela Landing Page** institucional
4. **Depois:** Sistema SWOT 360° (o diferencial)
5. **Depois:** Dashboard do mentorado
6. **Depois:** CRM + Assistente IA

---

# 💡 OBSERVAÇÕES FINAIS

- Este projeto é SEPARADO do AMZ Ofertas
- Foco em design PREMIUM (público C-level)
- Priorizar experiência mobile-friendly
- Integração WhatsApp é importante (público brasileiro)
- O assistente Pietro pode ser reaproveitado e adaptado

---

**Pronto para começar! Cole este briefing no novo projeto Lovable e vamos construir a Allinko juntos! 🚀💜**
