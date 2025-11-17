#!/bin/bash

# Script de Instalação Automatizada do Wuzapi (WhatsApp Meow API)
# Autor: Manus AI
# Data: 17 de Novembro de 2025
#
# Este script automatiza a instalação do Wuzapi, um serviço de API RESTful para WhatsApp.
# Requer Docker, Docker Compose, Git, Go e Node.js/npm instalados no sistema.
# O script assume que você está executando em um ambiente Linux (como o Ubuntu).

# --- Variáveis de Configuração ---
REPO_URL="https://github.com/asternic/wuzapi.git"
PROJECT_DIR="wuzapi"
DB_CONTAINER_NAME="wuzapi-postgres"
DB_USER="wuzapi_user"
DB_PASSWORD=$(openssl rand -base64 12) # Gera uma senha aleatória
DB_NAME="wuzapi_db"
DB_PORT="5432"
API_PORT="8080"
FRONTEND_PORT="3000"

echo "--- Início da Instalação do Wuzapi ---"

# 1. Verificar e Instalar Pré-requisitos (Apenas para fins de documentação, pois o ambiente sandbox já tem alguns)
# Em um ambiente real, você precisaria de:
# - Docker e Docker Compose
# - Git
# - Go (versão 1.18+)
# - Node.js e npm (para o frontend)
echo "Verifique se Docker, Docker Compose, Git, Go e Node.js/npm estão instalados."
echo "Prosseguindo com as etapas de instalação do Wuzapi..."

# 2. Clonar o Repositório
if [ -d "$PROJECT_DIR" ]; then
    echo "Diretório $PROJECT_DIR já existe. Pulando a clonagem."
else
    echo "Clonando o repositório do Wuzapi..."
    git clone $REPO_URL
    if [ $? -ne 0 ]; then
        echo "ERRO: Falha ao clonar o repositório."
        exit 1
    fi
fi

cd $PROJECT_DIR

# 3. Configurar e Iniciar o Banco de Dados PostgreSQL com Docker Compose
echo "Configurando e iniciando o banco de dados PostgreSQL com Docker Compose..."

# Criar o arquivo docker-compose.yml
cat << EOF > docker-compose.yml
version: '3.8'
services:
  db:
    image: postgres:14-alpine
    container_name: $DB_CONTAINER_NAME
    restart: always
    environment:
      POSTGRES_USER: $DB_USER
      POSTGRES_PASSWORD: $DB_PASSWORD
      POSTGRES_DB: $DB_NAME
    ports:
      - "$DB_PORT:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
EOF

# Iniciar o container do banco de dados
docker-compose up -d db
if [ $? -ne 0 ]; then
    echo "ERRO: Falha ao iniciar o container do banco de dados. Verifique a instalação do Docker/Docker Compose."
    exit 1
fi

echo "Aguardando 10 segundos para o banco de dados iniciar..."
sleep 10

# 4. Configurar o Backend (Go)
echo "Configurando o backend (Go)..."

# Criar o arquivo .env para o backend
cat << EOF > backend/.env
# Configurações do Banco de Dados
DB_HOST=db
DB_PORT=$DB_PORT
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_NAME=$DB_NAME

# Configurações da API
API_PORT=$API_PORT
# Chave secreta para JWT (Mude para uma string mais segura em produção)
JWT_SECRET=$(openssl rand -base64 32)

# Outras configurações (opcional)
# LOG_LEVEL=info
EOF

# 5. Compilar e Iniciar o Backend
echo "Compilando o backend..."
cd backend
go mod tidy
go build -o wuzapi_server
if [ $? -ne 0 ]; then
    echo "ERRO: Falha ao compilar o backend. Verifique a instalação do Go."
    exit 1
fi

echo "Iniciando o servidor backend em segundo plano (porta $API_PORT)..."
# Usar nohup ou um gerenciador de processos como PM2/Supervisor para produção
# Para este script, vamos apenas iniciar e manter o processo em segundo plano.
nohup ./wuzapi_server > wuzapi_server.log 2>&1 &
BACKEND_PID=$!
echo "Backend iniciado com PID: $BACKEND_PID. Verifique o log em backend/wuzapi_server.log"
cd ..

# 6. Configurar e Iniciar o Frontend (Node.js/React)
echo "Configurando o frontend (Node.js/React)..."
cd frontend

# Criar o arquivo .env para o frontend
cat << EOF > .env
# O frontend espera que a API esteja na mesma URL, mas em uma porta diferente.
# Se o frontend e o backend estiverem no mesmo servidor, use a URL local.
# Para produção, você deve usar um proxy reverso (Nginx/Apache).
REACT_APP_API_URL=http://localhost:$API_PORT
# Para acessar de fora do servidor, mude localhost para o IP público/domínio
# REACT_APP_API_URL=http://SEU_IP_OU_DOMINIO:$API_PORT
EOF

echo "Instalando dependências do frontend (pode demorar)..."
npm install
if [ $? -ne 0 ]; then
    echo "AVISO: Falha ao instalar dependências do frontend. O frontend pode não funcionar corretamente."
fi

echo "Iniciando o servidor frontend (porta $FRONTEND_PORT)..."
# Iniciar o frontend em segundo plano
nohup npm start > frontend_server.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend iniciado com PID: $FRONTEND_PID. Verifique o log em frontend/frontend_server.log"
cd ..

echo "--- Instalação Concluída ---"
echo "Detalhes da Instalação:"
echo "Diretório do Projeto: $(pwd)/$PROJECT_DIR"
echo "Usuário do DB (PostgreSQL): $DB_USER"
echo "Senha do DB (PostgreSQL): $DB_PASSWORD"
echo "Nome do DB (PostgreSQL): $DB_NAME"
echo "Acesso ao Painel de Controle (Frontend): http://localhost:$FRONTEND_PORT"
echo "Acesso à API (Backend): http://localhost:$API_PORT"
echo ""
echo "PRÓXIMOS PASSOS IMPORTANTES:"
echo "1. Para acessar o painel de controle de fora do servidor, você precisará expor as portas $FRONTEND_PORT e $API_PORT."
echo "2. O primeiro acesso ao painel irá pedir para você criar um usuário administrador."
echo "3. Para parar os serviços, use: docker-compose down (no diretório $PROJECT_DIR) e mate os processos Go e Node.js (PIDs: $BACKEND_PID e $FRONTEND_PID)."

# Tornar o script executável
chmod +x /home/ubuntu/install_wuzapi.sh
