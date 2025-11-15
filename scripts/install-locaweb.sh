#!/bin/bash

echo "🚀 Instalação AMZ Ofertas - Servidor Locaweb"
echo "=============================================="
echo ""

# Cores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}1. Atualizando sistema...${NC}"
sudo apt update && sudo apt upgrade -y

echo ""
echo -e "${BLUE}2. Instalando Docker...${NC}"
curl -fsSL https://get.docker.com | sh
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker $USER

echo ""
echo -e "${BLUE}3. Instalando Docker Compose...${NC}"
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

echo ""
echo -e "${BLUE}4. Instalando Node.js 20 LTS...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

echo ""
echo -e "${BLUE}5. Instalando PM2...${NC}"
sudo npm install -g pm2

echo ""
echo -e "${BLUE}6. Instalando NGINX...${NC}"
sudo apt install -y nginx certbot python3-certbot-nginx

echo ""
echo -e "${BLUE}7. Configurando Firewall...${NC}"
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

echo ""
echo -e "${BLUE}8. Criando estrutura de pastas...${NC}"
sudo mkdir -p /opt/amz-ofertas
sudo mkdir -p /opt/amz-ofertas/evolution
sudo mkdir -p /opt/amz-ofertas/scrapers
sudo mkdir -p /opt/amz-ofertas/logs
sudo chown -R $USER:$USER /opt/amz-ofertas

echo ""
echo -e "${GREEN}✅ Instalação básica concluída!${NC}"
echo ""
echo -e "${YELLOW}PRÓXIMOS PASSOS:${NC}"
echo "1. Configure o arquivo .env.evolution"
echo "2. Suba a Evolution API: cd /opt/amz-ofertas/evolution && docker-compose up -d"
echo "3. Configure NGINX com SSL"
echo ""
