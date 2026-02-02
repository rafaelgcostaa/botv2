FROM node:20-slim

# Instala dependências do Chrome
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PORT=80

WORKDIR /app

# Copia e instala dependências
COPY package*.json ./
RUN npm install

# Copia o resto dos arquivos para a raiz /app
COPY . .

EXPOSE 80
CMD ["npm", "start"]