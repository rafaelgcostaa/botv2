# Usa uma imagem Node.js segura
FROM node:20-slim

# Instala as dependências do sistema necessárias para rodar o Chrome/Puppeteer
# Isso é obrigatório para o bot não crashar no servidor
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Configura variáveis para o Puppeteer usar o Chromium instalado
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PORT=80

# Define a pasta de trabalho
WORKDIR /app

# Copia os arquivos de configuração primeiro (para cache eficiente)
COPY package*.json ./

# Instala as dependências do projeto
RUN npm install

# Copia o restante do código
COPY . .

# Expõe a porta 80 (padrão do Easypanel)
EXPOSE 80

# Comando para iniciar o bot
CMD ["npm", "start"]