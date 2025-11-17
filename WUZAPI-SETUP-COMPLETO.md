# 📱 Guia Completo de Integração Wuzapi + Supabase

**Data:** 17 de Novembro de 2025  
**Status:** Documentação Definitiva  
**Versão:** 2.0

---

## 📋 Índice

1. [Visão Geral da Arquitetura](#visão-geral)
2. [Componentes do Sistema](#componentes)
3. [O Problema que Foi Resolvido](#problema)
4. [Instalação Passo a Passo](#instalação)
5. [Configuração do Supabase](#supabase)
6. [Fluxo de Mensagens](#fluxo)
7. [Testes e Verificação](#testes)
8. [Troubleshooting](#troubleshooting)

---

## 🏗️ Visão Geral da Arquitetura {#visão-geral}

### Sistema Completo

```
┌─────────────────────────────────────────────────────────────┐
│                    FLUXO DE MENSAGENS                        │
└─────────────────────────────────────────────────────────────┘

WhatsApp → Wuzapi API → Webhook Supabase → IA → Resposta
            (8080)        (Edge Function)        ↓
                                                Wuzapi
                                                  ↓
                                              WhatsApp
```

### Componentes Principais

```
┌──────────────────────────────────────────────────────────────┐
│ SERVIDOR VPS (Locaweb)                                       │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Docker                                                   ││
│  │  └─ PostgreSQL (wuzapi-postgres)                        ││
│  │     • Porta: 5432                                        ││
│  │     • Dados: /var/lib/postgresql/data                   ││
│  └─────────────────────────────────────────────────────────┘│
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Host (fora do Docker)                                    ││
│  │  └─ Wuzapi Server (Go)                                   ││
│  │     • Porta: 8080                                        ││
│  │     • Conecta em: localhost:5432 ← IMPORTANTE!          ││
│  └─────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ SUPABASE (Cloud)                                              │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Edge Functions                                           ││
│  │  • wuzapi-webhook (recebe mensagens)                    ││
│  │  • send-wuzapi-message (envia mensagens)                ││
│  └─────────────────────────────────────────────────────────┘│
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Database Tables                                          ││
│  │  • whatsapp_messages_received                           ││
│  │  • whatsapp_messages_sent                               ││
│  └─────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

---

## 🧩 Componentes do Sistema {#componentes}

### 1. PostgreSQL (Docker)

**Função:** Armazena sessões do WhatsApp e dados do Wuzapi

**Configuração:**
```yaml
Container: wuzapi-postgres
Image: postgres:14-alpine
Port: 5432
User: wuzapi_user
Password: wuzapi_pass_2024
Database: wuzapi_db
Volume: postgres_data (persistente)
```

### 2. Wuzapi Server (Backend Go)

**Função:** API RESTful para gerenciar WhatsApp

**Localização:** `/opt/amz-ofertas/wuzapi/backend/`

**Configuração (.env):**
```bash
# CRÍTICO: localhost porque backend roda FORA do Docker!
DB_HOST=localhost
DB_PORT=5432
DB_USER=wuzapi_user
DB_PASSWORD=wuzapi_pass_2024
DB_NAME=wuzapi_db

API_PORT=8080

WUZAPI_ADMIN_TOKEN=admin_wuzapi_2024_secure
WUZAPI_GLOBAL_ENCRYPTION_KEY=encryption_key_32_chars_wuzapi_2024
WUZAPI_GLOBAL_HMAC_KEY=hmac_key_32_chars_wuzapi_secure_2024

LOG_LEVEL=info
```

**Endpoints Principais:**
- `GET /` - Health check
- `POST /session/start` - Iniciar sessão WhatsApp
- `POST /chat/send/text` - Enviar mensagem
- `GET /session/qr` - Obter QR Code

### 3. Supabase Edge Functions

#### wuzapi-webhook

**Função:** Recebe mensagens do WhatsApp via Wuzapi

**Localização:** `supabase/functions/wuzapi-webhook/index.ts`

**Fluxo:**
1. Recebe webhook do Wuzapi
2. Salva mensagem em `whatsapp_messages_received`
3. Busca histórico de conversas
4. Chama IA para gerar resposta
5. Envia resposta via Wuzapi
6. Salva em `whatsapp_messages_sent`

#### send-wuzapi-message

**Função:** Envia mensagens via Wuzapi

**Localização:** `supabase/functions/send-wuzapi-message/index.ts`

**Uso:**
```javascript
const { data, error } = await supabase.functions.invoke('send-wuzapi-message', {
  body: {
    phoneNumber: '5511999999999',
    message: 'Olá! Como posso ajudar?'
  }
})
```

### 4. Tabelas Supabase

#### whatsapp_messages_received
```sql
CREATE TABLE whatsapp_messages_received (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  message TEXT NOT NULL,
  message_id TEXT,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### whatsapp_messages_sent
```sql
CREATE TABLE whatsapp_messages_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  message TEXT NOT NULL,
  in_response_to TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## ⚠️ O Problema que Foi Resolvido {#problema}

### Erro Original

```
FATAL Failed to initialize database 
error="failed to ping postgres database: 
pq: password authentication failed for user \"wuzapi_user\""
```

### Causa Raiz

**O problema estava no `.env` do backend:**

```bash
# ❌ ERRADO (tentava conectar ao container Docker internamente)
DB_HOST=db

# ✅ CORRETO (backend roda no host, conecta via localhost)
DB_HOST=localhost
```

### Explicação

| Cenário | DB_HOST | Quando Usar |
|---------|---------|-------------|
| Backend dentro do Docker | `db` | Backend também é container |
| Backend fora do Docker | `localhost` | **Nosso caso!** |

**Por que `localhost`?**
- Backend está rodando diretamente no host (VPS)
- PostgreSQL está no Docker expondo porta 5432
- Do ponto de vista do host, Docker é acessível via `localhost:5432`

---

## 🚀 Instalação Passo a Passo {#instalação}

### Pré-requisitos

✅ Servidor VPS (Ubuntu/Debian)  
✅ Docker e Docker Compose instalados  
✅ Go 1.18+ instalado  
✅ Git instalado  

### Comando de Instalação

```bash
# Copiar script para o servidor
cd /opt/amz-ofertas
chmod +x ../scripts/install-wuzapi-final.sh

# Executar instalação
bash ../scripts/install-wuzapi-final.sh
```

### O que o Script Faz

1. **Limpeza:** Remove instalações anteriores
2. **Clone:** Baixa Wuzapi do GitHub
3. **Docker:** Configura e inicia PostgreSQL
4. **Backend:** Cria `.env` com configurações corretas
5. **Compilação:** Compila servidor Go
6. **Inicialização:** Inicia Wuzapi em background
7. **Verificação:** Testa se está funcionando

### Resultado Esperado

```
✅ INSTALAÇÃO CONCLUÍDA COM SUCESSO!

📊 INFORMAÇÕES DO SISTEMA:
  📁 Diretório: /opt/amz-ofertas/wuzapi
  🌐 API URL: http://localhost:8080
  🔑 Admin Token: admin_wuzapi_2024_secure
  🗄️  Database: PostgreSQL (Docker)
```

---

## ⚙️ Configuração do Supabase {#supabase}

### Secrets Necessários

Configure no Supabase (já configurados):

```
WUZAPI_URL=http://seu-servidor-ip:8080
WUZAPI_TOKEN=admin_wuzapi_2024_secure
WUZAPI_INSTANCE_ID=seu-instance-id
```

### Configuração do Webhook

1. Obtenha a URL do webhook:
```
https://jibpvpqgplmahjhswiza.supabase.co/functions/v1/wuzapi-webhook
```

2. Configure no Wuzapi (via API):
```bash
curl -X POST http://localhost:8080/webhook/set \
  -H "Authorization: Bearer admin_wuzapi_2024_secure" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://jibpvpqgplmahjhswiza.supabase.co/functions/v1/wuzapi-webhook",
    "events": ["message"]
  }'
```

---

## 🔄 Fluxo de Mensagens {#fluxo}

### Recebimento de Mensagem

```
1. Usuário envia mensagem no WhatsApp
   ↓
2. Wuzapi recebe mensagem
   ↓
3. Wuzapi chama webhook Supabase
   POST /functions/v1/wuzapi-webhook
   ↓
4. Edge Function processa:
   • Salva em whatsapp_messages_received
   • Busca histórico de conversas
   • Chama IA para gerar resposta
   ↓
5. Edge Function envia resposta via Wuzapi
   POST http://wuzapi:8080/chat/send/text
   ↓
6. Wuzapi envia mensagem ao WhatsApp
   ↓
7. Usuário recebe resposta
```

### Envio Programático

```javascript
// Do seu código React/Frontend
const { data, error } = await supabase.functions.invoke(
  'send-wuzapi-message',
  {
    body: {
      phoneNumber: '5511999999999',
      message: 'Sua mensagem aqui'
    }
  }
)
```

---

## 🧪 Testes e Verificação {#testes}

### 1. Verificar PostgreSQL

```bash
docker ps | grep wuzapi-postgres
```

**Esperado:** Container rodando

### 2. Verificar Wuzapi

```bash
ps aux | grep wuzapi_server
```

**Esperado:** Processo ativo

### 3. Testar API

```bash
curl http://localhost:8080/
```

**Esperado:** Resposta JSON

### 4. Verificar Logs

```bash
tail -f /opt/amz-ofertas/wuzapi/backend/wuzapi.log
```

**Esperado:** Sem erros, logs normais

### 5. Testar Conexão DB

```bash
docker exec -it wuzapi-postgres psql -U wuzapi_user -d wuzapi_db -c "SELECT 1;"
```

**Esperado:** Resultado `1`

---

## 🔧 Troubleshooting {#troubleshooting}

### Problema: API não responde

**Verificar:**
```bash
# Ver logs
tail -n 50 /opt/amz-ofertas/wuzapi/backend/wuzapi.log

# Verificar processo
ps aux | grep wuzapi
```

**Solução:**
```bash
cd /opt/amz-ofertas/wuzapi/backend
pkill wuzapi_server
nohup ./wuzapi_server > wuzapi.log 2>&1 &
```

### Problema: Erro de conexão ao banco

**Verificar:**
```bash
# PostgreSQL está rodando?
docker ps | grep wuzapi-postgres

# Pode conectar?
docker exec -it wuzapi-postgres psql -U wuzapi_user -d wuzapi_db -c "SELECT 1;"
```

**Solução:**
```bash
# Reiniciar PostgreSQL
cd /opt/amz-ofertas/wuzapi
docker-compose restart db
```

### Problema: Webhook não funciona

**Verificar:**
```bash
# Supabase pode alcançar seu servidor?
curl -X POST http://seu-servidor-ip:8080/webhook

# Firewall liberado?
sudo ufw status
```

**Solução:**
```bash
# Liberar porta 8080
sudo ufw allow 8080/tcp
```

---

## 📊 Comandos Úteis

### Gerenciamento

```bash
# Ver logs em tempo real
tail -f /opt/amz-ofertas/wuzapi/backend/wuzapi.log

# Status completo
docker ps && ps aux | grep wuzapi

# Reiniciar tudo
cd /opt/amz-ofertas/wuzapi
docker-compose restart db
pkill wuzapi_server
cd backend && nohup ./wuzapi_server > wuzapi.log 2>&1 &
```

### Monitoramento

```bash
# Logs Docker
docker logs wuzapi-postgres

# Logs Wuzapi
tail -n 100 /opt/amz-ofertas/wuzapi/backend/wuzapi.log

# Espaço em disco
df -h | grep postgres
```

---

## 📝 Variáveis de Ambiente

### Backend Wuzapi (.env)

```bash
# Database (CRÍTICO: localhost!)
DB_HOST=localhost
DB_PORT=5432
DB_USER=wuzapi_user
DB_PASSWORD=wuzapi_pass_2024
DB_NAME=wuzapi_db

# API
API_PORT=8080

# Security
WUZAPI_ADMIN_TOKEN=admin_wuzapi_2024_secure
WUZAPI_GLOBAL_ENCRYPTION_KEY=encryption_key_32_chars_wuzapi_2024
WUZAPI_GLOBAL_HMAC_KEY=hmac_key_32_chars_wuzapi_secure_2024

# Logging
LOG_LEVEL=info
```

### Supabase Secrets

```bash
# Wuzapi Connection
WUZAPI_URL=http://seu-servidor:8080
WUZAPI_TOKEN=admin_wuzapi_2024_secure
WUZAPI_INSTANCE_ID=seu-instance-id

# Supabase
SUPABASE_URL=https://jibpvpqgplmahjhswiza.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key

# IA (Lovable)
LOVABLE_API_KEY=sua-lovable-key
```

---

## ✅ Checklist de Instalação

- [ ] PostgreSQL rodando no Docker
- [ ] Wuzapi compilado e rodando
- [ ] API respondendo em `localhost:8080`
- [ ] Tabelas criadas no Supabase
- [ ] Edge functions deployadas
- [ ] Secrets configurados
- [ ] Webhook configurado
- [ ] Teste de envio/recebimento OK

---

## 🎯 Próximos Passos

1. **Conectar WhatsApp:**
   - Obter QR Code via API
   - Escanear com WhatsApp
   - Validar conexão

2. **Testar Webhook:**
   - Enviar mensagem de teste
   - Verificar logs Supabase
   - Confirmar resposta da IA

3. **Integrar com Frontend:**
   - Criar interface de envio
   - Mostrar histórico de mensagens
   - Dashboard de métricas

---

**Documentação Criada por:** Lovable AI  
**Data:** 17/11/2025  
**Versão:** 2.0 (Definitiva)
