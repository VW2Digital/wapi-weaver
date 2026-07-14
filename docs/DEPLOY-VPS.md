# Guia de Deploy - Servidor VPS Linux

Este documento orienta o provisionamento do WAPI Weaver em ambiente de produção (Ubuntu 22.04 / 24.04 ou Debian).

## 1. Pré-Requisitos na VPS
1. **Node.js**: Versão 20.x ou superior (Usar NVM).
2. **PM2**: Gerenciador de processos daemon para Node.js (`npm install -g pm2`).
3. **Docker e Docker Compose**: Para hospedar o MySQL isoladamente (Versão MySQL 8.0+).
4. **Nginx**: Como proxy reverso e terminação SSL.
5. **Certbot**: Para geração de certificados SSL via Let's Encrypt.

## 2. Preparação do Banco de Dados (Docker)
1. Dentro do projeto na VPS, verifique o arquivo `docker-compose.yml`.
2. Rode `docker-compose up -d`. Isso subirá o banco MySQL no container `wapi_weaver_mysql`.
3. Certifique-se de que a porta `3306` esteja bloqueada no firewall externo (UFW) ou acessível apenas pela aplicação localhost. (No docker-compose, mapeie via `127.0.0.1:3003:3306`).

## 3. Preparação do Código e Build
```bash
# Clone ou envie o código para a VPS (ex: /var/www/wapi-weaver)
cd /var/www/wapi-weaver

# Instale dependências e execute o build
npm install
npm run build
```

## 4. Subindo com PM2
O `npm run build` do Vinxi (Start) gerará arquivos otimizados em `.output/server/index.mjs`.

1. Inicialize a aplicação via PM2:
```bash
pm2 start .output/server/index.mjs --name "wapi-weaver-crm" -i max
pm2 save
pm2 startup
```
> O comando `-i max` inicializa o servidor em modo Cluster (aproveitando os núcleos da CPU), ideal para grande volume de webhooks assíncronos.

## 5. Configuração do Proxy Reverso (Nginx)

Crie um *server block* em `/etc/nginx/sites-available/wapiweaver`:

```nginx
server {
    listen 80;
    server_name seu-dominio.com;

    location / {
        proxy_pass http://127.0.0.1:3000; # Porta padrão do Node Nitro
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # Extensão para lidar com webhooks sem timeout abrupto
        proxy_read_timeout 60s;
        proxy_connect_timeout 60s;
    }
}
```

Ative e adicione SSL:
```bash
ln -s /etc/nginx/sites-available/wapiweaver /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
certbot --nginx -d seu-dominio.com
```

## 6. Checagem de Produção
- Acesse `https://seu-dominio.com` e confira o login. O usuário `vw2digital@gmail.com` será promovido a `adminmaster` automaticamente se constar no `server.ts`.
