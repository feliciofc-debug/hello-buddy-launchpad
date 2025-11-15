# 🚀 Deploy AMZ Ofertas - Guia Completo

## 📋 Pré-requisitos

- Servidor Locaweb VPS (2GB RAM / 60GB SSD) - R$ 39/mês
- Domínio configurado (api.amzofertas.com.br)
- Credenciais Supabase

---

## 1️⃣ CONFIGURAR SERVIDOR LOCAWEB

### Acesso SSH
```bash
ssh root@SEU-IP-LOCAWEB
```

### Executar instalação automática
```bash
# Baixar projeto
git clone https://github.com/seu-repo/amz-ofertas.git
cd amz-ofertas

# Executar instalação
./scripts/install-locaweb.sh
```

---

## 2️⃣ CONFIGURAR EVOLUTION API

### Copiar arquivos
```bash
sudo cp docker-compose-evolution.yml /opt/amz-ofertas/evolution/docker-compose.yml
sudo cp .env.evolution /opt/amz-ofertas/evolution/.env
```

### Editar credenciais
```bash
sudo nano /opt/amz-ofertas/evolution/.env

# Alterar:
# - EVOLUTION_API_KEY (gerar chave aleatória forte)
# - SUPABASE_DB_URL (pegar do Supabase)
# - SUPABASE_SERVICE_KEY (pegar do Supabase)
```

### Iniciar Evolution API
```bash
cd /opt/amz-ofertas/evolution
docker-compose up -d

# Ver logs
docker-compose logs -f
```

---

## 3️⃣ CONFIGURAR NGINX + SSL
```bash
cd ~/amz-ofertas
./scripts/nginx-config.sh
```

Aguardar SSL ser instalado.

Testar: https://api.amzofertas.com.br

---

## 4️⃣ CONFIGURAR SCRAPERS

### Copiar arquivos
```bash
sudo cp -r scripts/scrapers /opt/amz-ofertas/
cd /opt/amz-ofertas/scrapers
```

### Instalar dependências
```bash
npm install
```

### Configurar .env
```bash
nano .env

# Adicionar:
SUPABASE_URL=https://jibpvpqgplmahjhswiza.supabase.co
SUPABASE_SERVICE_KEY=sua-service-key
```

### Iniciar com PM2
```bash
pm2 start cron/executar-campanhas.js --name "amz-cron"
pm2 save
pm2 startup

# Ver logs
pm2 logs amz-cron
```

---

## 5️⃣ MONITORAMENTO

### Ver processos
```bash
# Docker
docker ps

# PM2
pm2 status

# NGINX
sudo systemctl status nginx
```

### Ver logs
```bash
# Evolution
docker logs -f evolution-api

# Scrapers
pm2 logs amz-cron

# NGINX
sudo tail -f /var/log/nginx/access.log
```

---

## 🔒 SEGURANÇA

### Firewall
```bash
sudo ufw status
```

### Trocar porta SSH (recomendado)
```bash
sudo sed -i 's/#Port 22/Port 2222/' /etc/ssh/sshd_config
sudo systemctl restart sshd
sudo ufw allow 2222/tcp
```

---

## ✅ CHECKLIST FINAL

- [ ] Servidor Locaweb configurado
- [ ] Evolution API rodando (porta 8080)
- [ ] NGINX + SSL configurado
- [ ] Scrapers rodando com PM2
- [ ] Firewall ativo
- [ ] Logs sendo gerados
- [ ] Domínio apontando corretamente
- [ ] Teste de QR Code WhatsApp funcionando

---

## 🆘 TROUBLESHOOTING

### Evolution API não inicia
```bash
cd /opt/amz-ofertas/evolution
docker-compose down
docker-compose up
```

### SSL não instala
```bash
# Verificar DNS
nslookup api.amzofertas.com.br

# Tentar novamente
sudo certbot --nginx -d api.amzofertas.com.br
```

### PM2 não inicia ao boot
```bash
pm2 startup
# Copiar e executar o comando que aparecer
pm2 save
```

---

## 📞 SUPORTE

Dúvidas: contato@atombrasildigital.com
