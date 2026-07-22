# Smart Student Picker — Review/Deploy Image
FROM node:22-alpine
WORKDIR /app

# Dependencies (eigene Layer für besseres Caching)
COPY package.json package-lock.json ./
RUN npm ci

# Quellcode + Prisma-Client generieren + Next-Build
COPY . .
# Dummy-URL nur für den Build: src/lib/prisma.ts wirft sonst beim Modul-Load.
# Zur Laufzeit wird DATABASE_URL via --env-file/compose überschrieben.
ARG DATABASE_URL="mysql://build:build@127.0.0.1:3306/build"
ENV DATABASE_URL=$DATABASE_URL
RUN npx prisma generate && npm run build

ENV NODE_ENV=production
# Standard-Port; per PORT-Env überschreibbar (docker-compose setzt 32300)
EXPOSE 3000
CMD ["npm", "run", "start"]
