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
# fontconfig: sin esto Chromium no resuelve bien font-family por nombre (cae a
# un fallback genérico distinto al de la vista en vivo, que corre en el
# navegador real del admin). ttf-liberation: métricamente compatible con
# Arial/Times/Courier — fontconfig los alía automáticamente, así que la
# negrilla/ancho de letra queda igual que "Segoe UI, Arial, sans-serif" en vez
# de caer a ttf-freefont (peso distinto). font-noto-emoji: sin un font de
# emoji instalado, cualquier emoji del reporte (🚀, 👏, etc.) se renderiza como
# un cuadro vacío ("tofu") en el PDF aunque se vea bien en la vista en vivo.
RUN apk add --no-cache openssl chromium nss freetype freetype-dev harfbuzz ca-certificates ttf-freefont fontconfig ttf-liberation font-noto-emoji
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
