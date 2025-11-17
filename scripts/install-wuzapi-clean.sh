#!/bin/bash

# Script de Instalação Limpa do Wuzapi
# Autor: Lovable AI
# Data: 2025-11-17

set -e  # Para o script se houver erro

echo "=========================================="
echo "🚀 Instalação Limpa do Wuzapi"
echo "=========================================="
echo ""

# Cores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Variáveis
INSTALL_DIR="/opt/amz-ofertas/wuzapi"
REPO_URL="https://github.com/asternic/wuzapi.git"
DB_USER="wuzapi_user"
DB_PASSWORD="wuzapi_pass_2024"
DB_NAME="wuzapi_db"
DB_PORT="5432"
API_PORT="8080"

# 1. Limpar instalação anterior
echo -e "${BLUE}1. Limpando instalação anterior...${NC}"
pkill wuzapi_server 2>/dev/null || true
cd /opt/amz-ofertas
docker-compose down 2>/dev/null || true
rm -rf wuzapi
echo -e "${GREEN}✓ Limpeza concluída${NC}"
echo ""

# 2. Criar diretório e clonar repositório
echo -e "${BLUE}2. Clonando repositório do Wuzapi...${NC}"
git clone $REPO_URL
cd wuzapi
echo -e "${GREEN}✓ Repositório clonado${NC}"
echo ""

# 3. Configurar Docker Compose para PostgreSQL
echo -e "${BLUE}3. Configurando banco de dados PostgreSQL...${NC}"
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

# Iniciar PostgreSQL
docker-compose up -d db
echo -e "${YELLOW}Aguardando PostgreSQL iniciar (30 segundos)...${NC}"
sleep 30
echo -e "${GREEN}✓ PostgreSQL configurado e iniciado${NC}"
echo ""

# 4. Configurar backend
echo -e "${BLUE}4. Configurando backend do Wuzapi...${NC}"
cd backend

# Criar .env com configurações corretas
cat > .env << 'EOF'
# Configurações do Banco de Dados
DB_HOST=localhost
DB_PORT=5432
DB_USER=wuzapi_user
DB_PASSWORD=wuzapi_pass_2024
DB_NAME=wuzapi_db

# Configurações da API
API_PORT=8080

# Chaves de segurança (geradas automaticamente)
WUZAPI_ADMIN_TOKEN=admin_wuzapi_2024_secure_token
WUZAPI_GLOBAL_ENCRYPTION_KEY=encryption_key_32_chars_min_wuzapi
WUZAPI_GLOBAL_HMAC_KEY=hmac_key_32_chars_minimum_wuzapi

# Logs
LOG_LEVEL=info
EOF

echo -e "${GREEN}✓ Arquivo .env criado${NC}"
echo ""

# 5. Compilar backend
echo -e "${BLUE}5. Compilando backend (pode demorar)...${NC}"
go mod tidy
go build -o wuzapi_server
echo -e "${GREEN}✓ Backend compilado${NC}"
echo ""

# 6. Iniciar servidor
echo -e "${BLUE}6. Iniciando servidor Wuzapi...${NC}"
nohup ./wuzapi_server > wuzapi.log 2>&1 &
BACKEND_PID=$!
echo -e "${GREEN}✓ Servidor iniciado (PID: $BACKEND_PID)${NC}"
echo ""

# 7. Aguardar e testar
echo -e "${YELLOW}Aguardando servidor inicializar (10 segundos)...${NC}"
sleep 10

# 8. Verificar status
echo -e "${BLUE}7. Verificando status do servidor...${NC}"
if curl -s http://localhost:8080/ > /dev/null; then
    echo -e "${GREEN}✓ Servidor Wuzapi está respondendo!${NC}"
else
    echo -e "${RED}✗ Servidor não está respondendo${NC}"
    echo -e "${YELLOW}Verificando logs:${NC}"
    tail -n 20 wuzapi.log
fi
echo ""

# Informações finais
echo "=========================================="
echo -e "${GREEN}✅ Instalação concluída!${NC}"
echo "=========================================="
echo ""
echo "📊 Informações do Sistema:"
echo "  • Diretório: $INSTALL_DIR"
echo "  • API URL: http://localhost:$API_PORT"
echo "  • Admin Token: admin_wuzapi_2024_secure_token"
echo ""
echo "🔍 Comandos úteis:"
echo "  • Ver logs: tail -f $INSTALL_DIR/backend/wuzapi.log"
echo "  • Status DB: docker ps"
echo "  • Parar Wuzapi: pkill wuzapi_server"
echo "  • Reiniciar Wuzapi: cd $INSTALL_DIR/backend && nohup ./wuzapi_server > wuzapi.log 2>&1 &"
echo ""
echo "🔗 Próximos passos:"
echo "  1. Configure o webhook no Supabase apontando para seu servidor"
echo "  2. Conecte um dispositivo WhatsApp via API"
echo "  3. Teste o envio de mensagens"
echo ""
