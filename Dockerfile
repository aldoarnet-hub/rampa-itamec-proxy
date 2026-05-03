FROM node:20-alpine

WORKDIR /app

# Instala dependências primeiro (cache de layer)
COPY package*.json ./
RUN npm install --omit=dev

# Copia o resto
COPY . .

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "server.js"]
