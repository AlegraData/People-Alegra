# === Etapa 1: dependencias ===
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# === Etapa 2: builder ===
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# === Etapa 3: runner ===
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Chromium del sistema para generar los PDFs de reportes 360° (puppeteer-core,
# sin descargar su propio Chromium). Alpine no trae glibc, así que no sirve el
# Chromium embebido de Puppeteer — se usa el binario de apk, compatible con musl.
RUN apk add --no-cache openssl chromium nss freetype freetype-dev harfbuzz ca-certificates ttf-freefont
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_DOWNLOAD=true

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Prisma engine binary (needed at runtime)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
# Prisma generated client code (overrides standalone bundle to ensure fresh models)
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
