# 🚀 BRIEFING COMPLETO - AMZ OFERTAS

## 📋 VISÃO GERAL DO PROJETO

**Nome:** AMZ Ofertas (também referenciado como AMZ ou Atom Brasil Digital)
**Tipo:** Plataforma SaaS de Marketing Digital com WhatsApp + IA
**Stack:** React + Vite + TypeScript + Tailwind CSS + Supabase (Lovable Cloud)
**URL Supabase:** https://jibpvpqgplmahjhswiza.supabase.co

---

## 🎯 DOIS MÓDULOS PRINCIPAIS

### 1. MÓDULO B2C (Varejo/Afiliados)
- **Público:** Pequenos comerciantes, afiliados, influenciadores
- **Função:** Disparo de ofertas via WhatsApp para base de clientes
- **Casos de uso:**
  - Padarias, mercadinhos, salões, açougues
  - Afiliados Amazon, Shopee, Lomadee
  - Influenciadores divulgando produtos

### 2. MÓDULO B2B (Prospecção Empresarial)
- **Público:** Empresas que vendem para outras empresas
- **Função:** Geração e qualificação de leads B2B
- **Casos de uso:**
  - Concessionárias de veículos
  - Empresas de software
  - Consultorias

---

## 🏗️ ARQUITETURA TÉCNICA

### Frontend (React/Vite)
```
src/
├── pages/           # Páginas principais
├── components/      # Componentes reutilizáveis
├── hooks/           # Custom hooks
├── lib/             # Utilitários e helpers
├── integrations/    # Supabase client
└── types/           # TypeScript types
```

### Backend (Supabase Edge Functions)
```
supabase/functions/
├── send-wuzapi-message/     # Envio WhatsApp via Wuzapi
├── wuzapi-webhook/          # Recebe mensagens WhatsApp
├── wuzapi-qrcode/           # Gera QR Code conexão
├── atendimento-suporte/     # Chatbot IA "Pietro Eugenio"
├── gerar-mensagem-ia/       # Gera mensagens com IA
├── executar-campanhas-agendadas/  # Cron de campanhas
├── buscar-produtos-shopee/  # API Shopee
├── buscar-produtos-lomadee/ # API Lomadee
└── ... (80+ edge functions)
```

---

## 📱 INTEGRAÇÃO WHATSAPP (WUZAPI)

### Como Funciona
1. **Wuzapi** roda em servidor VPS (Locaweb)
2. **Conexão:** Via QR Code escaneado pelo celular
3. **Envio:** Edge function `send-wuzapi-message`
4. **Recebimento:** Webhook `wuzapi-webhook`

### Configuração Atual
- URL Wuzapi: Configurada via secrets no Supabase
- Autenticação: Token Bearer
- Webhook: POST para `/functions/v1/wuzapi-webhook`

### Fluxo de Mensagens
```
ENVIO:
App → send-wuzapi-message → Wuzapi → WhatsApp

RECEBIMENTO:
WhatsApp → Wuzapi → wuzapi-webhook → Supabase → App
```

---

## 🤖 INTELIGÊNCIA ARTIFICIAL

### Chatbot "Pietro Eugenio"
- **Função:** Atendimento automático e suporte
- **Edge Function:** `atendimento-suporte/index.ts`
- **Base de Conhecimento:** Embutida no código (~1000 linhas)
- **API:** Lovable AI Gateway (google/gemini-2.5-flash)

### Geração de Conteúdo
- **Edge Function:** `gerar-mensagem-ia`
- **Usos:** Mensagens de vendas, posts, abordagens

### IA para Leads B2B
- **Scoring:** `calculate-lead-score`
- **Qualificação:** `qualify-prospect`
- **Estratégia:** `create-approach-strategy`

---

## 📊 TABELAS PRINCIPAIS DO BANCO

### Clientes/Contatos
- `cadastros` - Base de contatos WhatsApp
- `grupos_transmissao` - Listas de transmissão
- `grupo_membros` - Membros das listas
- `opt_ins` - Consentimentos LGPD

### Campanhas B2C
- `campanhas_recorrentes` - Campanhas agendadas
- `biblioteca_campanhas` - Histórico de campanhas
- `campanha_execucoes` - Logs de execução
- `historico_envios` - Registro de envios

### Leads B2B
- `leads_b2b` - Leads empresariais (CNPJ)
- `leads_b2c` - Leads pessoa física
- `campanhas_prospeccao` - Campanhas de prospecção
- `icp_configs` - Configuração ICP (Ideal Customer Profile)

### Conversas WhatsApp
- `whatsapp_conversations` - Conversas
- `whatsapp_conversation_messages` - Mensagens
- `lead_notifications` - Notificações de leads quentes

### Produtos
- `produtos` - Catálogo de produtos
- `clientes` - Clientes/empresas do usuário

### Configurações
- `whatsapp_config` - Config WhatsApp por usuário
- `empresa_config` - Config da empresa
- `integrations` - Integrações (Meta, Lomadee, etc)
- `vendedores` - Equipe de vendas

---

## 🔐 AUTENTICAÇÃO

### Sistema Atual
- Supabase Auth (email/senha)
- Auto-confirm habilitado
- Perfis em `profiles` table (se existir)

### Tipos de Usuário
1. **Admin:** Acesso total
2. **Vendedor:** Acesso limitado às suas conversas
3. **Reviewer:** Acesso para revisão (sistema legado)

---

## 📍 PÁGINAS PRINCIPAIS

### Dashboard/Home
- `/` - Landing page pública
- `/dashboard` - Dashboard principal
- `/pietro-dashboard` - Dashboard Pietro (métricas IA)

### WhatsApp
- `/whatsapp` - Gerenciamento WhatsApp
- `/whatsapp-conversas` - Central de conversas
- `/ia-conversas` - Conversas com IA
- `/configuracoes-whatsapp` - Configurações

### Campanhas
- `/campanhas` - Campanhas B2C
- `/campanhas-prospeccao` - Campanhas B2B
- `/campanha/:id` - Detalhes campanha
- `/biblioteca` - Biblioteca de campanhas

### Leads
- `/leads-funil` - Funil de leads
- `/leads-descobertos` - Leads descobertos
- `/prospects` - Prospects B2B

### Produtos
- `/meus-produtos` - Gestão de produtos
- `/marketplace` - Marketplace público
- `/lomadee-finder` - Buscador Lomadee

### Admin
- `/admin` - Painel admin
- `/vendedores` - Gestão de vendedores
- `/configuracoes` - Configurações gerais

---

## 🔧 INTEGRAÇÕES EXTERNAS

### Marketplaces/Afiliados
- **Shopee:** API Affiliate (busca produtos)
- **Lomadee:** API de produtos afiliados
- **Amazon:** Scraper (legado)

### Pagamentos
- **Mercado Pago:** PIX, boleto
- **Stripe:** Cartões internacionais
- **Hotmart:** Webhooks de vendas

### Redes Sociais
- **Meta (Facebook/Instagram):** OAuth para posts
- **Google Ads:** Integração campanhas

### Dados Empresariais
- **CNPJ.ws:** Consulta CNPJ
- **Apify:** Scraping LinkedIn/Instagram

---

## 📁 ARQUIVOS IMPORTANTES

### Configuração
- `supabase/config.toml` - Config Supabase
- `tailwind.config.ts` - Design system
- `src/index.css` - Tokens CSS
- `vite.config.ts` - Config Vite

### Edge Functions Críticas
- `supabase/functions/send-wuzapi-message/` - Envio WhatsApp
- `supabase/functions/wuzapi-webhook/` - Recebimento
- `supabase/functions/atendimento-suporte/` - IA Pietro
- `supabase/functions/executar-campanhas-agendadas/` - Cron

### Componentes Chave
- `src/pages/WhatsAppPage.tsx` - Gestão WhatsApp
- `src/pages/IAConversas.tsx` - Central conversas IA
- `src/pages/Campanhas.tsx` - Campanhas B2C
- `src/pages/CampanhasProspeccao.tsx` - Campanhas B2B
- `src/components/CriarCampanhaWhatsAppModal.tsx` - Modal campanha

---

## 🚀 DEPLOY

### Frontend
- Deploy automático via Lovable
- URL: Lovable staging ou domínio custom

### Backend (VPS Locaweb)
- **Wuzapi:** Docker container
- **Scrapers:** PM2 (Node.js)
- **NGINX:** Proxy reverso + SSL

### Scripts de Deploy
- `scripts/install-wuzapi.sh` - Instalação Wuzapi
- `scripts/nginx-config.sh` - Config NGINX
- `DEPLOY.md` - Guia completo

---

## 📝 SECRETS/ENV VARS NECESSÁRIAS

### Supabase (automático)
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### WhatsApp (Wuzapi)
- `WUZAPI_URL` - URL do servidor Wuzapi
- `WUZAPI_TOKEN` - Token de autenticação

### IA
- `LOVABLE_API_KEY` - API Lovable AI (automático)
- `OPENAI_API_KEY` - OpenAI (opcional)

### Integrações
- `SHOPEE_APP_ID`
- `SHOPEE_APP_SECRET`
- `LOMADEE_APP_TOKEN`
- `APIFY_TOKEN`

---

## 🎯 FUNCIONALIDADES EM DESTAQUE

### 1. Disparo em Massa WhatsApp
- Envio para listas de transmissão
- Intervalo entre mensagens (anti-ban)
- Imagens + texto
- Agendamento

### 2. IA de Atendimento
- Responde clientes automaticamente
- Upselling inteligente
- Transferência para humano
- Base de conhecimento customizável

### 3. Campanhas Recorrentes
- Agendamento diário/semanal
- Horários específicos
- Seleção de listas
- Templates com variáveis

### 4. Geração de Leads B2B
- Busca por CNAE/cidade/porte
- Enriquecimento (telefone, email, redes)
- Scoring automático
- Qualificação por IA

### 5. Funil de Vendas
- Pipeline visual
- Status por etapa
- Histórico de interações
- Atribuição a vendedores

---

## 🐛 PONTOS DE ATENÇÃO

### Wuzapi
- Conexão pode cair (precisa reconectar)
- Rate limiting do WhatsApp
- Banimento se envio muito rápido

### IA
- Custo por request (Lovable AI)
- Rate limits em uso intenso
- Context window do modelo

### Banco de Dados
- RLS policies em todas as tabelas
- Limite 1000 rows por query
- Índices para queries frequentes

---

## 📞 CONTATO/SUPORTE

- **Email:** contato@atombrasildigital.com
- **WhatsApp:** Configurado no sistema

---

## 🔄 ESTADO ATUAL DO PROJETO

O projeto está funcional com:
- ✅ Envio/recebimento WhatsApp via Wuzapi
- ✅ Chatbot IA "Pietro Eugenio"
- ✅ Campanhas B2C (disparo em massa)
- ✅ Gestão de contatos e listas
- ✅ Integração Shopee/Lomadee
- ✅ Sistema de leads B2B (parcial)
- ⚠️ Sistema de vendedores (em desenvolvimento)
- ⚠️ Analytics avançado (básico implementado)

---

## 💡 DICAS PARA CONTINUAR

1. **Sempre verificar** as edge functions existentes antes de criar novas
2. **RLS policies** são críticas - todas as tabelas precisam
3. **Wuzapi** é o coração do WhatsApp - manter estável
4. **Pietro** é o chatbot IA - base de conhecimento em `atendimento-suporte`
5. **Testar** envios em ambiente controlado antes de produção

---

*Briefing atualizado em: Dezembro 2024*
*Versão: 1.0*
