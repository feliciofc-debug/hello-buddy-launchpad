#!/bin/bash

echo "🌐 Configurando NGINX + SSL para Evolution API"
echo "==============================================="

# Substitua pelo seu domínio
DOMAIN="api.amzofertas.com.br"
EMAIL="contato@atombrasildigital.com"

echo ""
echo "Criando configuração NGINX..."

sudo tee /etc/nginx/sites-available/evolution <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
EOF

echo "Ativando site..."
sudo ln -sf /etc/nginx/sites-available/evolution /etc/nginx/sites-enabled/

echo "Testando configuração..."
sudo nginx -t

echo "Reiniciando NGINX..."
sudo systemctl reload nginx

echo ""
echo "Instalando SSL com Let's Encrypt..."
sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email $EMAIL

echo ""
echo "✅ Configuração concluída!"
echo "🔒 SSL instalado"
echo "🌐 Evolution API disponível em: https://$DOMAIN"
