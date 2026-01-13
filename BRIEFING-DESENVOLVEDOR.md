# 👨‍💻 Briefing do Desenvolvedor - AMZ Ofertas

## Sobre o Criador

**Desenvolvedor Full-Stack** especializado em **automação de marketing digital** e **sistemas de afiliados**, com foco em criar soluções que conectam tecnologia de ponta com estratégias de vendas automatizadas.

---

## 🛠️ Stack Tecnológico do Projeto AMZ Ofertas

### Frontend

| Tecnologia | Versão | Uso no Projeto |
|------------|--------|----------------|
| **React** | 18.3.1 | Framework principal de UI |
| **TypeScript** | 5.x | Tipagem estática e segurança de código |
| **Tailwind CSS** | 3.x | Estilização utilitária e design system |
| **Vite** | 5.x | Build tool e dev server ultrarrápido |
| **shadcn/ui** | Latest | Componentes acessíveis e customizáveis |
| **Radix UI** | Latest | Primitivos de UI headless |
| **TanStack Query** | 5.x | Gerenciamento de estado e cache de dados |
| **React Router DOM** | 6.x | Roteamento SPA |
| **Recharts** | 2.x | Visualização de dados e gráficos |
| **Lucide React** | Latest | Sistema de ícones |

### Backend

| Tecnologia | Uso no Projeto |
|------------|----------------|
| **Supabase** | BaaS (Backend as a Service) |
| **PostgreSQL** | Banco de dados relacional |
| **Deno** | Runtime para Edge Functions |
| **TypeScript** | Linguagem das Edge Functions |
| **Row Level Security (RLS)** | Segurança em nível de linha |

### Integrações de Mensageria

| Plataforma | Tecnologia | Funcionalidade |
|------------|------------|----------------|
| **WhatsApp** | Wuzapi API | Automação de mensagens, grupos, QR Code |
| **TikTok** | TikTok API v2 | Postagem de conteúdo, OAuth 2.0 |

### Integrações de Marketplaces

| Marketplace | Tipo de Integração |
|-------------|-------------------|
| **Amazon** | Links de afiliado, scraping de produtos |
| **Shopee** | API oficial de afiliados |
| **Magazine Luiza** | Extensão Chrome + conversão de links |
| **Mercado Livre** | Conversão de links de afiliado |
| **O Boticário** | Extensão Chrome dedicada |

### Inteligência Artificial

| Modelo | Provider | Uso |
|--------|----------|-----|
| **Gemini 2.5 Flash** | Google | Geração de conteúdo, análise de imagens |
| **Gemini Vision** | Google | Validação de comprovantes Shopee |
| **GPT-5** | OpenAI | Assistente de produtos, chatbot |

### Pagamentos

| Gateway | Funcionalidades |
|---------|-----------------|
| **Mercado Pago** | PIX, Cartão, Boleto |
| **Stripe** | Pagamentos internacionais |

### Infraestrutura

| Serviço | Uso |
|---------|-----|
| **Lovable Cloud** | Hospedagem frontend + Edge Functions |
| **Contabo VPS** | Servidor Wuzapi (35 instâncias) |
| **Supabase Storage** | Armazenamento de arquivos e mídia |
| **Resend** | Envio de emails transacionais |

---

## 📊 Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React + TypeScript)            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Dashboard  │  │  WhatsApp   │  │  Produtos/Campanhas │  │
│  │   Afiliado  │  │  Automação  │  │     Management      │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 SUPABASE (Backend as a Service)             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  PostgreSQL │  │    Auth     │  │   Edge Functions    │  │
│  │   Database  │  │   System    │  │   (Deno Runtime)    │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
           ┌──────────────────┼──────────────────┐
           ▼                  ▼                  ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│     WUZAPI      │  │   GOOGLE AI     │  │   MARKETPLACES  │
│  (WhatsApp Bot) │  │  (Gemini API)   │  │   (APIs/Scrape) │
│   35 instâncias │  │                 │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

---

## 🚀 Funcionalidades Desenvolvidas

### Sistema de Afiliados
- ✅ Cadastro e gestão de produtos multi-marketplace
- ✅ Conversão automática de links de afiliado
- ✅ Sistema de cashback 2% automatizado
- ✅ Validação de comprovantes via IA (Gemini Vision)
- ✅ Entrega automática de eBooks como incentivo

### Automação WhatsApp
- ✅ Chatbot inteligente (Pietro Eugenio)
- ✅ Envio programado para grupos
- ✅ Rotação de categorias e marketplaces
- ✅ Sistema anti-bloqueio com delays humanizados
- ✅ Fila de atendimento assíncrona

### Integração TikTok
- ✅ OAuth 2.0 completo
- ✅ Postagem direta e rascunho
- ✅ Integração com gerador de vídeos IA

### Geração de Conteúdo
- ✅ Posts automáticos com IA
- ✅ Geração de vídeos (MiniMax/Hailuo)
- ✅ Personalização por categoria

---

## 📈 Métricas do Projeto

| Métrica | Valor |
|---------|-------|
| **Edge Functions** | 80+ funções |
| **Tabelas no Banco** | 50+ tabelas |
| **Componentes React** | 100+ componentes |
| **Linhas de Código** | 50.000+ linhas |
| **Instâncias WhatsApp** | 35 configuradas |

---

## 🎯 Diferenciais Técnicos

1. **Arquitetura Serverless** - Zero manutenção de servidores
2. **Tipagem Completa** - TypeScript em 100% do código
3. **Real-time** - Atualizações em tempo real via Supabase
4. **Segurança** - RLS policies em todas as tabelas
5. **Escalabilidade** - Infraestrutura preparada para multi-tenant
6. **IA Integrada** - Múltiplos modelos de IA para diferentes tarefas

---

## 📞 Contato

**Email:** amzofertas@amzofertas.com.br  
**Plataforma:** [amzofertas.com.br](https://amzofertas.com.br)

---

*Documento gerado em Janeiro/2026*
