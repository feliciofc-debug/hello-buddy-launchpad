#!/bin/bash

# ============================================
# Script de Instalação DEFINITIVA do Wuzapi
# Autor: Lovable AI
# Data: 2025-11-17
# ============================================

set -e  # Para em caso de erro

echo "============================================"
echo "🚀 Instalação DEFINITIVA do Wuzapi"
echo "============================================"
echo ""

# Cores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Variáveis FIXAS (não aleatórias para evitar problemas)
INSTALL_DIR="/opt/amz-ofertas/wuzapi"
REPO_URL="https://github.com/asternic/wuzapi.git"
DB_USER="wuzapi_user"
DB_PASSWORD="wuzapi_pass_2024"
DB_NAME="wuzapi_db"
DB_PORT="5432"
API_PORT="8080"
ADMIN_TOKEN="admin_wuzapi_2024_secure"
ENCRYPTION_KEY="encryption_key_32_chars_wuzapi_2024"
HMAC_KEY="hmac_key_32_chars_wuzapi_secure_2024"

# ============================================
# ETAPA 1: Limpeza Total
# ============================================
echo -e "${BLUE}ETAPA 1: Limpando instalação anterior...${NC}"

# Parar processos
pkill wuzapi_server 2>/dev/null || true
echo "  ✓ Processos parados"

# Parar e remover containers Docker
cd /opt/amz-ofertas 2>/dev/null || true
docker-compose down 2>/dev/null || true
docker stop wuzapi-postgres 2>/dev/null || true
docker rm wuzapi-postgres 2>/dev/null || true
echo "  ✓ Containers Docker removidos"

# Remover diretório
rm -rf /opt/amz-ofertas/wuzapi
echo "  ✓ Diretório removido"

echo -e "${GREEN}✅ Limpeza concluída${NC}"
echo ""

# ============================================
# ETAPA 2: Clonar Repositório
# ============================================
echo -e "${BLUE}ETAPA 2: Clonando repositório...${NC}"

cd /opt/amz-ofertas
git clone $REPO_URL
cd wuzapi

echo -e "${GREEN}✅ Repositório clonado${NC}"
echo ""

# ============================================
# ETAPA 3: Configurar PostgreSQL via Docker
# ============================================
echo -e "${BLUE}ETAPA 3: Configurando PostgreSQL...${NC}"

cat > docker-compose.yml << 'EOF'
version: '3.8'
services:
  db:
    image: postgres:14-alpine
    container_name: wuzapi-postgres
    restart: always
    environment:
      POSTGRES_USER: wuzapi_user
      POSTGRES_PASSWORD: wuzapi_pass_2024
      POSTGRES_DB: wuzapi_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U wuzapi_user -d wuzapi_db"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
EOF

echo "  ✓ docker-compose.yml criado"

# Iniciar PostgreSQL
docker-compose up -d db

echo -e "${YELLOW}  ⏳ Aguardando PostgreSQL iniciar (30s)...${NC}"
sleep 30

# Verificar se está rodando
if docker ps | grep -q wuzapi-postgres; then
    echo -e "${GREEN}✅ PostgreSQL rodando${NC}"
else
    echo -e "${RED}❌ ERRO: PostgreSQL não iniciou${NC}"
    exit 1
fi
echo ""

# ============================================
# ETAPA 4: Configurar Backend
# ============================================
echo -e "${BLUE}ETAPA 4: Configurando backend...${NC}"

cd backend

# CRÍTICO: DB_HOST=localhost porque backend roda FORA do Docker!
cat > .env << 'EOF'
# ============================================
# Configurações do Banco de Dados
# ============================================
# IMPORTANTE: localhost porque backend roda FORA do Docker
DB_HOST=localhost
DB_PORT=5432
DB_USER=wuzapi_user
DB_PASSWORD=wuzapi_pass_2024
DB_NAME=wuzapi_db

# ============================================
# Configurações da API
# ============================================
API_PORT=8080

# ============================================
# Chaves de Segurança (SALVE ESTES VALORES!)
# ============================================
WUZAPI_ADMIN_TOKEN=admin_wuzapi_2024_secure
WUZAPI_GLOBAL_ENCRYPTION_KEY=encryption_key_32_chars_wuzapi_2024
WUZAPI_GLOBAL_HMAC_KEY=hmac_key_32_chars_wuzapi_secure_2024

# ============================================
# Configurações Opcionais
# ============================================
LOG_LEVEL=info
EOF

echo "  ✓ .env criado com DB_HOST=localhost (CORRIGIDO!)"
echo -e "${GREEN}✅ Backend configurado${NC}"
echo ""

# ============================================
# ETAPA 5: Compilar Backend
# ============================================
echo -e "${BLUE}ETAPA 5: Compilando backend...${NC}"
echo -e "${YELLOW}  ⏳ Isso pode demorar alguns minutos...${NC}"

go mod tidy
go build -o wuzapi_server

if [ -f "wuzapi_server" ]; then
    echo -e "${GREEN}✅ Backend compilado com sucesso${NC}"
else
    echo -e "${RED}❌ ERRO: Falha na compilação${NC}"
    exit 1
fi
echo ""

# ============================================
# ETAPA 6: Iniciar Servidor
# ============================================
echo -e "${BLUE}ETAPA 6: Iniciando servidor Wuzapi...${NC}"

nohup ./wuzapi_server > wuzapi.log 2>&1 &
BACKEND_PID=$!

echo "  ✓ Servidor iniciado (PID: $BACKEND_PID)"
echo -e "${YELLOW}  ⏳ Aguardando inicialização (15s)...${NC}"
sleep 15

# ============================================
# ETAPA 7: Verificar Status
# ============================================
echo -e "${BLUE}ETAPA 7: Verificando instalação...${NC}"

# Verificar PostgreSQL
if docker ps | grep -q wuzapi-postgres; then
    echo -e "  ${GREEN}✓${NC} PostgreSQL: OK"
else
    echo -e "  ${RED}✗${NC} PostgreSQL: ERRO"
fi

# Verificar processo
if ps aux | grep -v grep | grep -q wuzapi_server; then
    echo -e "  ${GREEN}✓${NC} Processo Wuzapi: OK"
else
    echo -e "  ${RED}✗${NC} Processo Wuzapi: ERRO"
fi

# Testar API
echo ""
echo -e "${YELLOW}Testando API...${NC}"
if curl -s http://localhost:8080/ > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} API respondendo: OK"
    API_STATUS="OK"
else
    echo -e "  ${RED}✗${NC} API não está respondendo"
    echo ""
    echo -e "${YELLOW}Últimas 30 linhas do log:${NC}"
    tail -n 30 wuzapi.log
    API_STATUS="ERRO"
fi

echo ""
echo "============================================"
if [ "$API_STATUS" = "OK" ]; then
    echo -e "${GREEN}✅ INSTALAÇÃO CONCLUÍDA COM SUCESSO!${NC}"
else
    echo -e "${YELLOW}⚠️  INSTALAÇÃO PARCIALMENTE CONCLUÍDA${NC}"
    echo -e "${YELLOW}   Verifique os logs acima${NC}"
fi
echo "============================================"
echo ""

# ============================================
# Informações Finais
# ============================================
echo "📊 INFORMAÇÕES DO SISTEMA:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  📁 Diretório: $INSTALL_DIR"
echo "  🌐 API URL: http://localhost:$API_PORT"
echo "  🔑 Admin Token: $ADMIN_TOKEN"
echo "  🗄️  Database: PostgreSQL (Docker)"
echo "  📝 Log File: $INSTALL_DIR/backend/wuzapi.log"
echo ""

echo "🔧 COMANDOS ÚTEIS:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Ver logs:        tail -f $INSTALL_DIR/backend/wuzapi.log"
echo "  Status Docker:   docker ps | grep wuzapi"
echo "  Status processo: ps aux | grep wuzapi_server"
echo "  Parar Wuzapi:    pkill wuzapi_server"
echo "  Reiniciar:       cd $INSTALL_DIR/backend && nohup ./wuzapi_server > wuzapi.log 2>&1 &"
echo ""

echo "🔗 PRÓXIMOS PASSOS:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  1. Configure o webhook do Supabase com a URL do seu servidor"
echo "  2. Conecte um dispositivo WhatsApp usando a API"
echo "  3. Teste o envio/recebimento de mensagens"
echo ""

echo "📚 CREDENCIAIS DO BANCO (para referência):"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Host:     localhost"
echo "  Port:     $DB_PORT"
echo "  User:     $DB_USER"
echo "  Password: $DB_PASSWORD"
echo "  Database: $DB_NAME"
echo ""

echo -e "${GREEN}🎉 Instalação finalizada!${NC}"
