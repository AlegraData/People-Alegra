# Plan de Migración a Google Cloud Run + Sistema de Correos

> Documento de trabajo para iterar con Claude en VSCode.
> Proyecto: **People Hub — Alegra**
> Fecha: 2026-04-21
> Autor: Cristhian Luna

---

## Índice

1. [Contexto del proyecto](#1-contexto-del-proyecto)
2. [Diagnóstico del estado actual](#2-diagnóstico-del-estado-actual)
3. [Decisión estratégica: Vercel vs Google Cloud Run](#3-decisión-estratégica-vercel-vs-google-cloud-run)
4. [Dimensionamiento para 600 colaboradores](#4-dimensionamiento-para-600-colaboradores)
5. [Sistema de correos — decisión de arquitectura](#5-sistema-de-correos--decisión-de-arquitectura)
6. [Fase 0 — Prerrequisitos](#fase-0--prerrequisitos)
7. [Fase 1 — Preparar el código para Cloud Run](#fase-1--preparar-el-código-para-cloud-run)
8. [Fase 2 — Infraestructura en GCP](#fase-2--infraestructura-en-gcp)
9. [Fase 3 — Correo con Gmail API](#fase-3--correo-con-gmail-api)
10. [Fase 4 — Plantillas de correo editables](#fase-4--plantillas-de-correo-editables)
11. [Fase 5 — Checklist de go-live](#fase-5--checklist-de-go-live)
12. [Artefactos a crear en el repo](#6-artefactos-a-crear-en-el-repo)
13. [Consideraciones adicionales](#7-consideraciones-adicionales)
14. [Estimación de costos](#8-estimación-de-costos)
15. [Roadmap sugerido](#9-roadmap-sugerido)

---

## 1. Contexto del proyecto

**People Hub** es el portal interno de gestión de personas de Alegra. Permite a RR.HH. crear y distribuir encuestas de clima organizacional y eNPS, gestionar participantes y visualizar resultados con acceso basado en roles (admin, manager, viewer).

### Stack actual

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router) |
| Lenguaje | TypeScript 6 (strict) |
| UI | React 19 + Tailwind CSS 3 |
| Base de datos | PostgreSQL vía Supabase (plan Premium) |
| ORM | Prisma 5 |
| Autenticación | Supabase Auth con OAuth Google |
| Hosting actual | Vercel (plan Free) |
| App hermana | Google Cloud Run (plan empresarial), misma DB |

### Objetivos del cambio

1. Migrar de Vercel Free a Google Cloud Run (consolidar con app hermana).
2. Agregar envío de correos transaccionales al lanzar encuestas.
3. Plantillas de correo editables por el equipo de RR.HH.
4. Botón en correo con login automático (magic link) que lleve directo a la encuesta.
5. Asegurar disponibilidad bajo carga (600 colaboradores, picos de lanzamiento).
6. Envío desde dominio corporativo `@alegra.com`.

---

## 2. Diagnóstico del estado actual

### Fortalezas

- Arquitectura limpia: rutas API bien separadas por dominio (`/clima`, `/enps`, `/admin`).
- Separación correcta entre cliente Supabase (navegador), servidor (SSR) y `supabaseAdmin` (service role).
- Middleware de autenticación funcional.
- Esquema de base de datos sólido con Prisma.
- TypeScript estricto.

### Limitaciones del plan Free de Vercel

- **100 GB de bandwidth/mes** — un lanzamiento grande más uso sostenido se acerca rápido.
- **Serverless Functions**: 10s de timeout, 1024 MB RAM por invocación.
- **100.000 invocaciones/día** máximo.
- **Sin cron jobs** — necesarios para recordatorios de encuestas.
- **Uso comercial no permitido** en ToS del plan Hobby. Para empresa (Alegra) es bloqueante legal.

### Riesgos técnicos identificados

- **Prisma + serverless**: cada cold start abre conexiones a Postgres. Con 600 usuarios concurrentes y múltiples instancias, puede saturar la DB.
- **Pool de conexiones**: verificar que `DATABASE_URL` apunte a Supavisor (pooler) en modo transaction, no al puerto directo.
- **RLS parcial**: se usa `supabaseAdmin` (service role) que bypassea RLS. Toda la autorización vive en código Next.js — una línea de defensa menos.
- **Sin rate limiting** en rutas API — expuesto a abuse.
- **Sin observabilidad de errores en prod** (no hay Sentry ni equivalente).

### Ausencias actuales

- No hay integración de correo (ni Resend, SendGrid, Nodemailer, Mailgun).
- No hay sistema de plantillas.
- No hay cola de jobs.
- No hay healthcheck endpoint.
- No hay Dockerfile.

---

## 3. Decisión estratégica: Vercel vs Google Cloud Run

| Criterio | Vercel Pro (~$20/mes) | Google Cloud Run (empresarial) |
|---|---|---|
| Fit con Next.js 16 | Óptimo, runtime nativo | Bueno con Dockerfile optimizado |
| Cold starts | Muy bajos | Configurables con `min-instances` |
| Uso comercial legal | Sí | Sí |
| Cron jobs | Vercel Cron incluido | Cloud Scheduler (más robusto) |
| Integración con ecosistema Google | Externa | Nativa (Cloud SQL, Secret Manager, IAM, Logging) |
| Observabilidad | Buena | Excelente (Logging, Monitoring, Trace, Error Reporting) |
| Gobierno centralizado con app hermana | No | Sí |
| Curva de configuración | Cero | Media (Dockerfile, CI/CD, Secret Manager) |

### Recomendación: Google Cloud Run

**Razones**:

1. Alegra ya tiene plan empresarial de Google Cloud.
2. Existe otra app hermana corriendo en Cloud Run con la misma base de datos.
3. Vercel Free no es legal para uso corporativo.
4. Consolidación de operaciones, facturación y gobernanza.
5. Secret Manager centraliza credenciales con auditoría y rotación nativas.
6. Cloud Logging y Error Reporting consistentes entre apps.
7. Cloud Scheduler + Cloud Tasks ideales para envío masivo de correos y recordatorios.
8. Gradual rollouts con revisiones y traffic splitting (canary deploys).

### Contrapartidas honestas

- Necesita Dockerfile bien hecho (multi-stage, `output: 'standalone'` de Next).
- ISR y revalidación on-demand requieren atención extra (no hay caché global Vercel).
- Mayor configuración inicial.

---

## 4. Dimensionamiento para 600 colaboradores

### Patrón de carga esperado

- **Base**: ~20–50 usuarios concurrentes en horario laboral.
- **Pico de lanzamiento**: correo masivo a las 9:00 AM → ~300 aperturas en 30 min → ~10 req/s sostenidos, picos de 20–30 req/s.

### Configuración Cloud Run recomendada

```
cpu: 1 vCPU
memory: 1 GiB
min-instances: 1  (horario laboral, baja a 0 fuera con Cloud Scheduler)
max-instances: 20
concurrency: 80
timeout: 60s
```

### Pool de conexiones Prisma → Supabase

**Crítico**. Con 20 instancias × 5 conexiones = 100 conexiones concurrentes → dentro de límites Supabase Premium.

```
DATABASE_URL="postgresql://...@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=5&pool_timeout=10"
DIRECT_URL="postgresql://...@db.xxx.supabase.co:5432/postgres"  # solo para migraciones
```

### Optimizaciones de query (no urgente, pre-10k encuestas)

- `GET /api/clima/surveys` filtra surveys en memoria tras traer todos. Mover filtro a SQL (JOIN con `climate_survey_assignments`).
- Evitar round-trips múltiples donde un solo query con JOIN sirve.

### Rate limiting (antes de go-live)

- Opción A: Upstash Redis (si se queda en Vercel).
- Opción B: **Cloud Armor** delante del Load Balancer (Cloud Run) — recomendado.
- Reglas sugeridas: 60 req/min por IP en `/api/*`, 10 req/min en endpoints sensibles (`/api/clima/responses`).

---

## 5. Sistema de correos — decisión de arquitectura

### Aclaración importante

Google Cloud **NO** tiene un servicio de correo transaccional propio (equivalente a AWS SES). Las opciones "nativas al ecosistema Google" son:

#### Opción A — Gmail API con Google Workspace (RECOMENDADA)

- Envía como `no-reply@alegra.com` usando Service Account con domain-wide delegation.
- Costo marginal cero (solo la licencia Workspace del buzón).
- Límite: 2.000 destinatarios externos/día por usuario Workspace Business → suficiente para 600 colaboradores internos.
- Deliverability perfecta (correo "real" desde Gmail).

#### Opción B — SendGrid vía Google Cloud Marketplace

- Facturado en la misma factura GCP.
- Editor visual drag-and-drop para plantillas.
- Analytics de apertura/click nativos.
- $19.95/mes por 50k correos.
- Ideal si se necesita ergonomía no-técnica para RR.HH.

### Decisión para este plan: Opción A (Gmail API)

**Razones**:

- Alegra ya usa Google Workspace (implícito por OAuth Google existente).
- Uso 100% interno (sin correo a externos).
- Cero costo adicional mensual.
- Consolidación con el ecosistema Google.
- Si en el futuro se requiere enviar a externos o analytics avanzados, SendGrid se integra como segundo canal.

---

## Fase 0 — Prerrequisitos

### 0.1 Confirmaciones antes de empezar

- [ ] Acceso a proyecto GCP empresarial (crear `alegra-people-hub-prod` y `alegra-people-hub-staging`).
- [ ] Región única para todos los recursos (sugerido: `us-east1` — baja latencia con Supabase).
- [ ] Decisión de subdominio remitente: `no-reply@alegra.com` o `no-reply@notificaciones.alegra.com`.
- [ ] Acceso a DNS de `alegra.com` (para SPF, DKIM, DMARC).
- [ ] Identificar Super Admin de Google Workspace (necesario para domain-wide delegation).
- [ ] Confirmar que la app hermana en Cloud Run NO ejecuta `prisma migrate` en runtime.
- [ ] Confirmar retención de backups PITR en Supabase Premium (sugerido: 30 días).

### 0.2 Regla de oro del esquema

Una sola app debe ser dueña del schema Prisma y ejecutar migraciones. Las demás son consumidoras. Documentar quién es el owner (sugerido: People Hub).

---

## Fase 1 — Preparar el código para Cloud Run

### 1.1 `next.config.js` con output standalone

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // ...resto de la config actual
};

module.exports = nextConfig;
```

**Efecto**: imagen Docker final ~150 MB en lugar de ~1 GB.

### 1.2 `Dockerfile` multi-stage (raíz del proyecto)

```dockerfile
# === Etapa 1: dependencias ===
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# === Etapa 2: builder ===
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# === Etapa 3: runner ===
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
```

### 1.3 `.dockerignore`

```
node_modules
.next
.git
.env*
README.md
.vscode
.idea
*.log
.DS_Store
tsconfig.tsbuildinfo
```

### 1.4 Healthcheck endpoint

Crear `src/app/api/health/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json({ status: 'error' }, { status: 503 });
  }
}
```

### 1.5 Ajuste de Prisma para serverless

En `.env` (y Secret Manager):

```
DATABASE_URL="postgresql://...@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=5&pool_timeout=10"
DIRECT_URL="postgresql://...@db.xxx.supabase.co:5432/postgres"
```

### 1.6 Proxy headers

Verificar que no se use `request.ip` directamente en middleware. Usar:

```typescript
const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';
```

---

## Fase 2 — Infraestructura en GCP

### 2.1 Secret Manager

Crear secretos (nunca como env vars planas del servicio):

| Secreto | Contenido |
|---|---|
| `DATABASE_URL` | URL del pooler Supabase |
| `DIRECT_URL` | URL directa para migraciones |
| `NEXT_PUBLIC_SUPABASE_URL` | URL proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anon |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role |
| `GMAIL_SERVICE_ACCOUNT_KEY` | JSON del SA para Gmail API |
| `GMAIL_IMPERSONATE_USER` | `no-reply@alegra.com` |
| `APP_BASE_URL` | `https://people.alegra.com` |
| `INTERNAL_API_SECRET` | Token para endpoints `/api/internal/*` |

### 2.2 Artifact Registry

```bash
gcloud artifacts repositories create people-hub \
  --repository-format=docker \
  --location=us-east1 \
  --description="Imágenes Docker de People Hub"
```

### 2.3 Service Accounts

**Runtime SA**: `people-hub-runtime@<proyecto>.iam.gserviceaccount.com`

Roles:
- `roles/secretmanager.secretAccessor` (scope: secretos del proyecto)
- `roles/cloudtrace.agent`
- `roles/logging.logWriter`
- `roles/cloudsql.client` (si se usa Cloud SQL como fallback futuro)

**Gmail Sender SA**: `gmail-sender@<proyecto>.iam.gserviceaccount.com`

- Sin roles IAM de GCP.
- Key JSON descargada y subida a Secret Manager.
- Domain-wide delegation en Workspace Admin (ver Fase 3).

**Cloud Tasks invoker SA**: `tasks-invoker@<proyecto>.iam.gserviceaccount.com`

- Usado por Cloud Tasks para invocar endpoints `/api/internal/*` con OIDC token.

### 2.4 Cloud Build

Archivo `cloudbuild.yaml`:

```yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '-t'
      - 'us-east1-docker.pkg.dev/$PROJECT_ID/people-hub/app:$COMMIT_SHA'
      - '-t'
      - 'us-east1-docker.pkg.dev/$PROJECT_ID/people-hub/app:latest'
      - '.'

  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', '--all-tags', 'us-east1-docker.pkg.dev/$PROJECT_ID/people-hub/app']

  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'people-hub'
      - '--image=us-east1-docker.pkg.dev/$PROJECT_ID/people-hub/app:$COMMIT_SHA'
      - '--region=us-east1'
      - '--platform=managed'
      - '--service-account=people-hub-runtime@$PROJECT_ID.iam.gserviceaccount.com'
      - '--set-secrets=DATABASE_URL=DATABASE_URL:latest,DIRECT_URL=DIRECT_URL:latest,NEXT_PUBLIC_SUPABASE_URL=NEXT_PUBLIC_SUPABASE_URL:latest,NEXT_PUBLIC_SUPABASE_ANON_KEY=NEXT_PUBLIC_SUPABASE_ANON_KEY:latest,SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest,GMAIL_SERVICE_ACCOUNT_KEY=GMAIL_SERVICE_ACCOUNT_KEY:latest,GMAIL_IMPERSONATE_USER=GMAIL_IMPERSONATE_USER:latest,APP_BASE_URL=APP_BASE_URL:latest,INTERNAL_API_SECRET=INTERNAL_API_SECRET:latest'
      - '--min-instances=1'
      - '--max-instances=20'
      - '--cpu=1'
      - '--memory=1Gi'
      - '--concurrency=80'
      - '--timeout=60s'

options:
  logging: CLOUD_LOGGING_ONLY
```

**Triggers**:
- `main` → despliegue a staging
- Tag `release-*` → despliegue a producción (con aprobación manual)

### 2.5 Cloud Run Service (config inicial)

```bash
gcloud run deploy people-hub \
  --image=us-east1-docker.pkg.dev/<proyecto>/people-hub/app:latest \
  --region=us-east1 \
  --service-account=people-hub-runtime@<proyecto>.iam.gserviceaccount.com \
  --min-instances=1 \
  --max-instances=20 \
  --cpu=1 \
  --memory=1Gi \
  --concurrency=80 \
  --timeout=60s \
  --allow-unauthenticated
```

### 2.6 Dominio custom

- Mapear `people.alegra.com` al servicio Cloud Run.
- Certificado SSL managed por Google (cero configuración).
- Actualizar registro A/AAAA en DNS según instrucciones de Cloud Run.

### 2.7 Actualizar Supabase Auth

En Supabase → Authentication → URL Configuration:
- **Site URL**: `https://people.alegra.com`
- **Redirect URLs**: añadir `https://people.alegra.com/auth/callback`

En Google Cloud Console → OAuth consent screen → credenciales:
- Añadir URI autorizado: `https://people.alegra.com/auth/callback`

---

## Fase 3 — Correo con Gmail API

### 3.1 Crear buzón remitente en Workspace

- Crear usuario `no-reply@alegra.com` en Admin de Workspace.
- Licencia Workspace mínima requerida.
- Configurar reenvío automático a `rrhh@alegra.com` (opcional, para que respuestas humanas lleguen a alguien).

### 3.2 Service Account para Gmail API

```bash
gcloud iam service-accounts create gmail-sender \
  --display-name="Gmail Sender for People Hub"

gcloud iam service-accounts keys create gmail-sa-key.json \
  --iam-account=gmail-sender@<proyecto>.iam.gserviceaccount.com
```

Subir `gmail-sa-key.json` a Secret Manager como `GMAIL_SERVICE_ACCOUNT_KEY`. **Eliminar el archivo local**.

### 3.3 Domain-Wide Delegation

En Workspace Admin → Security → API Controls → Domain-wide delegation:

- Client ID: copiar el Unique ID del service account.
- Scopes: `https://www.googleapis.com/auth/gmail.send`

**Este paso requiere Super Admin de Workspace**.

### 3.4 Configuración DNS — SPF, DKIM, DMARC

| Registro | Host | Valor |
|---|---|---|
| SPF | `alegra.com` | `v=spf1 include:_spf.google.com ~all` |
| DKIM | `google._domainkey.alegra.com` | Generado en Workspace Admin → Gmail → Authenticate email |
| DMARC (fase 1, monitoreo) | `_dmarc.alegra.com` | `v=DMARC1; p=none; rua=mailto:dmarc@alegra.com` |
| DMARC (fase 2, endurecido) | `_dmarc.alegra.com` | `v=DMARC1; p=quarantine; rua=mailto:dmarc@alegra.com` |

**Validación**: usar [mxtoolbox.com](https://mxtoolbox.com) o [dmarcian.com](https://dmarcian.com) antes de enviar en producción.

### 3.5 Dependencias NPM

```bash
npm install googleapis nodemailer mustache mjml
npm install -D @types/nodemailer @types/mustache
```

### 3.6 `src/lib/mailer.ts` (esqueleto)

```typescript
import { google } from 'googleapis';
import nodemailer from 'nodemailer';

const SCOPES = ['https://www.googleapis.com/auth/gmail.send'];

function getGmailClient() {
  const credentials = JSON.parse(process.env.GMAIL_SERVICE_ACCOUNT_KEY!);
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: SCOPES,
    subject: process.env.GMAIL_IMPERSONATE_USER, // no-reply@alegra.com
  });
  return google.gmail({ version: 'v1', auth });
}

export async function sendMail(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  const gmail = getGmailClient();

  const raw = await buildRawMessage({
    from: `Alegra People Hub <${process.env.GMAIL_IMPERSONATE_USER}>`,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
  });

  const response = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw },
  });

  return response.data;
}

async function buildRawMessage(opts: {
  from: string; to: string; subject: string; html: string; text?: string;
}) {
  // Usar nodemailer para construir el MIME y base64-URL-encodear
  // ...
}
```

### 3.7 Cola de envío con Cloud Tasks

**Crear la cola**:

```bash
gcloud tasks queues create email-queue \
  --location=us-east1 \
  --max-dispatches-per-second=10 \
  --max-concurrent-dispatches=20 \
  --max-attempts=5 \
  --min-backoff=10s \
  --max-backoff=600s
```

**Endpoint interno**: `src/app/api/internal/send-email/route.ts`
- Verifica OIDC token de Cloud Tasks (service account `tasks-invoker`).
- Rechaza con 401 si no viene del SA esperado.
- Ejecuta render de plantilla + `sendMail()`.

**Endpoint de lanzamiento** (`/api/clima/surveys/:id/launch`):
- Verifica permisos admin.
- Itera participantes.
- Para cada empleado: genera magic link + encola tarea en Cloud Tasks.
- Responde 202 Accepted con `{ queuedCount: N }`.

### 3.8 Recordatorios con Cloud Scheduler

```bash
gcloud scheduler jobs create http survey-reminders-daily \
  --location=us-east1 \
  --schedule="0 9 * * *" \
  --time-zone="America/Bogota" \
  --http-method=POST \
  --uri=https://people.alegra.com/api/internal/send-reminders \
  --oidc-service-account-email=tasks-invoker@<proyecto>.iam.gserviceaccount.com
```

Endpoint `/api/internal/send-reminders`:
- Consulta asignaciones sin respuesta con deadline en <48h.
- Encola correos de recordatorio en `email-queue`.

---

## Fase 4 — Plantillas de correo editables

### 4.1 Modelo de datos

Agregar al `schema.prisma`:

```prisma
model EmailTemplate {
  id         String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  key        String   @unique                // "climate_survey_launch"
  subject    String                          // con {{variables}}
  bodyMjml   String   @db.Text               // MJML crudo editable
  bodyHtml   String   @db.Text               // HTML renderizado (cache)
  variables  Json                            // { "employee_name": "Nombre empleado", ... }
  updatedAt  DateTime @updatedAt @map("updated_at")
  updatedBy  String?  @map("updated_by")
  version    Int      @default(1)

  versions   EmailTemplateVersion[]

  @@map("email_templates")
}

model EmailTemplateVersion {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  templateId  String   @map("template_id") @db.Uuid
  subject     String
  bodyMjml    String   @db.Text @map("body_mjml")
  version     Int
  createdAt   DateTime @default(now()) @map("created_at")
  createdBy   String?  @map("created_by")

  template    EmailTemplate @relation(fields: [templateId], references: [id])

  @@map("email_template_versions")
}
```

### 4.2 Plantillas iniciales (seeds)

| Key | Uso | Variables clave |
|---|---|---|
| `climate_survey_launch` | Lanzamiento encuesta de clima | `employee_name`, `survey_title`, `survey_link`, `deadline`, `estimated_minutes` |
| `climate_survey_reminder` | Recordatorio sin responder | `employee_name`, `survey_title`, `survey_link`, `days_remaining` |
| `enps_survey_launch` | Lanzamiento eNPS | `employee_name`, `survey_link`, `deadline` |
| `enps_survey_reminder` | Recordatorio eNPS | `employee_name`, `survey_link`, `days_remaining` |
| `survey_closed_thanks` | Agradecimiento al cerrar | `employee_name`, `survey_title` |
| `welcome_new_user` | Bienvenida onboarding | `employee_name`, `app_link` |

### 4.3 Generación del magic link por empleado

En el encolado, por cada empleado:

```typescript
const { data } = await supabaseAdmin.auth.admin.generateLink({
  type: 'magiclink',
  email: employee.email,
  options: {
    redirectTo: `${process.env.APP_BASE_URL}/clima/${surveyId}`,
  },
});

const surveyLink = data.properties?.action_link;
// surveyLink → este es el link que va en el botón del correo
```

**Comportamiento**:
- Token único por empleado y por envío.
- Expira en 1h (configurable en Supabase Auth).
- Al hacer click: valida token → crea/refresca sesión → redirige a `/clima/{surveyId}`.
- Si el empleado no tiene cuenta, se crea automáticamente al primer click.

### 4.4 Render de plantillas

`src/lib/templates.ts`:

```typescript
import Mustache from 'mustache';
import prisma from '@/lib/prisma';

export async function renderTemplate(key: string, variables: Record<string, any>) {
  const tpl = await prisma.emailTemplate.findUnique({ where: { key } });
  if (!tpl) throw new Error(`Template not found: ${key}`);

  const subject = Mustache.render(tpl.subject, variables);
  const html = Mustache.render(tpl.bodyHtml, variables);

  return { subject, html };
}
```

**Importante**: usar Mustache o Handlebars, **nunca** template literals de JS (riesgo de injection).

### 4.5 Editor en el admin

Ruta nueva: `/admin/plantillas` (solo rol admin).

**UI**:
- Lista de plantillas con `key`, `updatedAt`, última versión.
- Editor split:
  - Panel izquierdo: textarea con MJML + tags de variables disponibles.
  - Panel derecho: preview HTML renderizado con valores dummy.
- Botones:
  - **Guardar**: crea nueva fila en `EmailTemplateVersion`, actualiza `EmailTemplate.version++`, re-renderiza MJML → HTML y lo cachea en `bodyHtml`.
  - **Enviar prueba**: manda correo al email del admin logueado.
  - **Restaurar versión**: modal con lista histórica, permite revertir.

**Endpoints nuevos**:
- `GET /api/admin/templates` — lista
- `GET /api/admin/templates/:id` — detalle
- `PUT /api/admin/templates/:id` — actualizar (crea nueva versión)
- `POST /api/admin/templates/:id/test` — enviar prueba
- `POST /api/admin/templates/:id/restore/:versionId` — restaurar versión

### 4.6 Diseño visual base (MJML)

Estructura recomendada:

```
[Header con logo Alegra — URL estable en Cloud Storage o Supabase Storage]
  ↓
[Saludo: "Hola, {{employee_name}}"]
  ↓
[Cuerpo breve (3–5 líneas): qué es la encuesta, tiempo estimado, fecha límite]
  ↓
[Botón CTA grande: "Responder encuesta" → {{survey_link}}]
  Color: #00D6BC (primary Alegra)
  Texto: blanco, bold, 16px
  Padding: 16px 32px
  Border-radius: 8px
  ↓
[Footer:
  - Link a política de privacidad
  - "¿Dudas? Escribe a rrhh@alegra.com"
  - "Este es un correo automático, no respondas"]
```

**Specs técnicas**:
- Ancho máximo: 600px
- Responsive automático con MJML
- Probar en: Gmail web, Gmail móvil, Outlook desktop, Outlook móvil
- Dark mode: Gmail respeta colores, Outlook invierte — testear con [Litmus](https://litmus.com) o [mail-tester.com](https://www.mail-tester.com)

---

## Fase 5 — Checklist de go-live

### 5.1 Validación DNS

- [ ] SPF publicado y validado en mxtoolbox
- [ ] DKIM activo en Workspace y validado
- [ ] DMARC en modo `p=none` con reporting activo por 2 semanas
- [ ] Sin errores en reportes DMARC antes de endurecer a `p=quarantine`

### 5.2 Pruebas de correo

- [ ] Envío de prueba a 5 buzones distintos:
  - [ ] Gmail corporativo (@alegra.com)
  - [ ] Gmail personal
  - [ ] Outlook
  - [ ] Yahoo
  - [ ] ProtonMail (u otro)
- [ ] Todos llegan a inbox (no spam)
- [ ] Magic link funciona: link → redirect → autenticado → landing correcta
- [ ] Magic link expira después de 1h
- [ ] Botón CTA renderiza bien en web, móvil, y Outlook
- [ ] Variables se reemplazan correctamente (no hay `{{employee_name}}` literal)

### 5.3 Pruebas de carga

Herramientas: [k6](https://k6.io) o [artillery](https://artillery.io).

- [ ] 100 req/s contra `GET /api/clima/surveys/:id` durante 5 min
- [ ] 50 req/s contra `POST /api/clima/responses` durante 5 min
- [ ] Latencia p95 < 500ms
- [ ] Error rate = 0%
- [ ] Conexiones DB no se agotan (verificar en Supabase dashboard)

### 5.4 Observabilidad

- [ ] Sentry (o Cloud Error Reporting) capturando errores de prod
- [ ] Dashboard en Cloud Monitoring con:
  - `email_sent_total` (contador)
  - `email_failed_total` (contador)
  - `request_latency_p95` (histograma)
  - `db_connections_active` (gauge)
  - `cold_starts_total` (contador)
- [ ] Alertas configuradas:
  - Error rate > 5% en 5 min → PagerDuty/Slack
  - Latencia p95 > 1s en 10 min → Slack
  - Bounce rate correo > 3% → Slack

### 5.5 Seguridad

- [ ] Rate limiting activo en `/api/*`
- [ ] Endpoints `/api/internal/*` rechazan requests sin OIDC válido
- [ ] RLS activado en tablas críticas (fase opcional, recomendada)
- [ ] Secretos en Secret Manager, ninguno en código ni env vars planas
- [ ] Service accounts con principio de mínimo privilegio

### 5.6 Plan de rollback

- [ ] Versión Vercel sigue corriendo 1 semana post-migración en modo "read-only" como backup
- [ ] Documentado cómo cambiar DNS en <15 min si se necesita rollback
- [ ] Backup completo de DB antes de la migración (Supabase PITR + snapshot manual)

---

## 6. Artefactos a crear en el repo

### Archivos nuevos

```
Dockerfile
.dockerignore
cloudbuild.yaml
.github/workflows/ci.yml           (opcional, si no se usa Cloud Build trigger)

src/app/api/health/route.ts
src/app/api/internal/send-email/route.ts
src/app/api/internal/send-reminders/route.ts
src/app/api/admin/templates/route.ts
src/app/api/admin/templates/[id]/route.ts
src/app/api/admin/templates/[id]/test/route.ts
src/app/api/admin/templates/[id]/restore/[versionId]/route.ts
src/app/admin/plantillas/page.tsx
src/app/admin/plantillas/[id]/page.tsx

src/lib/mailer.ts
src/lib/templates.ts
src/lib/cloud-tasks.ts
src/lib/mjml.ts

src/components/admin/TemplateEditor.tsx
src/components/admin/TemplatePreview.tsx
src/components/admin/TemplateList.tsx

prisma/migrations/xxxx_add_email_templates/migration.sql
prisma/seeds/email-templates.ts
```

### Archivos a modificar

```
next.config.js          → añadir output: 'standalone'
package.json            → añadir googleapis, nodemailer, mustache, mjml
prisma/schema.prisma    → añadir EmailTemplate, EmailTemplateVersion
src/middleware.ts       → verificar proxy headers
.env.example            → añadir variables nuevas
README.md               → documentar nuevo flujo de deploy y correos
```

---

## 7. Consideraciones adicionales

### 7.1 Secretos y seguridad

- Ningún secreto en `.env` commiteado.
- `.env.local` solo para desarrollo.
- Producción y staging: Secret Manager exclusivamente.
- Rotación trimestral de `SUPABASE_SERVICE_ROLE_KEY` y `INTERNAL_API_SECRET`.

### 7.2 RLS (Row Level Security) en Supabase

Hoy se usa `supabaseAdmin` extensivamente, bypaseando RLS. Recomendado:

- Activar RLS en `climate_surveys`, `climate_survey_responses`, `climate_survey_assignments`, `enps_*`.
- Policies: `SELECT` para el dueño, `INSERT/UPDATE` según rol.
- Service role solo donde realmente se necesita (operaciones batch, tasks, admin global).

### 7.3 Privacidad y compliance de encuestas de clima

**Riesgo alto**: el esquema actual guarda `employee_id` junto a respuestas de clima. Si la promesa al empleado es anonimato, esto es un problema legal.

**Opciones**:

- **Anonimización post-cierre**: al cerrar la encuesta, un job elimina `employee_id` de `climate_survey_responses` dejando solo datos agregables.
- **Hash rotativo**: guardar `hash(employee_id + survey_id + salt_mensual)` en vez del ID real.
- **Respuestas en tabla aparte sin FK**: diseño desde cero donde la respuesta nunca se relaciona con quien respondió.

Consultar con legal/compliance de Alegra antes de lanzar primera campaña.

### 7.4 Backup y disaster recovery

- Supabase Premium: backups diarios + PITR 7/14/30 días (verificar plan contratado).
- Sugerido: 30 días de retención.
- Snapshot manual antes de cada migración Prisma en prod.

### 7.5 Next.js 16 — novedad

Next 16 es muy reciente. Validar antes de go-live:

- Compatibilidad Prisma 5 ✓
- Compatibilidad `@supabase/ssr` ✓
- Testing exhaustivo de Server Actions, RSC, caching.
- Red de seguridad: downgrade documentado a Next 15.x si aparecen bugs.

### 7.6 App hermana compartiendo DB

- Confirmar que **solo People Hub** ejecuta migraciones Prisma.
- La otra app debe ser consumidora (solo queries).
- Si ambas tocan tablas distintas, documentar contrato de ownership.
- Considerar extraer una librería compartida con tipos Prisma generados.

---

## 8. Estimación de costos

### Costos mensuales aproximados (producción, 600 usuarios)

| Servicio | Costo estimado |
|---|---|
| Cloud Run (1 instancia min, 20 max, uso moderado) | $15–25 |
| Secret Manager (10 secretos) | ~$0.06 |
| Artifact Registry (imágenes Docker) | ~$1 |
| Cloud Tasks (cola de correos) | ~$0.40 por millón |
| Cloud Scheduler (1 job diario) | $0.10 |
| Cloud Logging (retención default) | ~$5 |
| Cloud Monitoring (métricas custom) | ~$5 |
| Workspace licencia `no-reply@alegra.com` | ~$6 (Business Starter) |
| Gmail API | $0 (incluido en Workspace) |
| **Total mensual estimado** | **~$35–45 USD/mes** |

### Comparación con Vercel Pro

- Vercel Pro: $20/mes base + adicionales por bandwidth/functions.
- Google Cloud Run: $35–45/mes pero con observabilidad, scheduler, tasks, secrets todo incluido y auditoría nativa.

**Trade-off**: ligeramente más caro en Cloud Run pero con mucho más control y consolidación operativa.

### Costos one-time

- Tiempo de ingeniería: estimado 40–60h de trabajo para implementación completa.
- Tiempo de RR.HH. para definir copys de plantillas: ~4–8h.
- Revisión de legal/compliance para anonimato de encuestas: dependerá del proceso interno.

---

## 9. Roadmap sugerido

### Sprint 1 (Semana 1-2): Fundamentos

- Fase 0: prerrequisitos, decisiones, accesos.
- Fase 1: Dockerfile, next.config, healthcheck, ajustes Prisma.
- Fase 2.1-2.3: Secret Manager, Artifact Registry, Service Accounts.
- Build y push de imagen a staging.

### Sprint 2 (Semana 3): Deploy staging

- Fase 2.4-2.7: Cloud Build, Cloud Run, dominio staging, Supabase Auth update.
- Smoke test completo en `staging.people.alegra.com`.
- Pruebas de carga básicas.

### Sprint 3 (Semana 4): Correos

- Fase 3.1-3.4: Workspace, Service Account, DNS (SPF/DKIM/DMARC).
- Fase 3.5-3.6: implementar `mailer.ts`.
- Envíos de prueba desde staging.

### Sprint 4 (Semana 5): Plantillas y cola

- Fase 4: modelo de datos, editor admin, seeds iniciales.
- Fase 3.7-3.8: Cloud Tasks + Cloud Scheduler.
- Pruebas end-to-end con 10 empleados piloto.

### Sprint 5 (Semana 6): Go-live prod

- Cutover DNS de Vercel → Cloud Run prod.
- Primer lanzamiento real de encuesta de clima.
- Monitoreo intensivo primera semana.
- Vercel en modo read-only como backup.

### Sprint 6 (Semana 7+): Hardening

- RLS granular en Supabase.
- Rate limiting con Cloud Armor.
- Anonimización de respuestas de clima.
- Decomisionar Vercel.

---

## Notas para iterar con Claude en VSCode

**Contexto rápido para cualquier sesión futura**:

- Proyecto: Next.js 16 + React 19 + Prisma 5 + Supabase (Postgres + Auth Google OAuth).
- 600 colaboradores, uso interno Alegra.
- Módulos activos: Clima Organizacional, eNPS.
- Objetivo: migrar Vercel Free → Google Cloud Run + agregar sistema de correos con Gmail API.
- DB compartida con app hermana (Cloud Run). Only People Hub ejecuta migrations.
- Autenticación existente: Google OAuth vía Supabase Auth.
- Magic links de Supabase Auth serán el mecanismo de "login desde correo a encuesta".

**Áreas donde pedir ayuda a Claude (siguientes pasos)**:

1. Implementación del `Dockerfile` optimizado.
2. Implementación completa de `src/lib/mailer.ts` con Gmail API + Service Account.
3. Diseño MJML de las 6 plantillas base.
4. Editor de plantillas en `/admin/plantillas` (componente React).
5. Endpoint de encolado en Cloud Tasks.
6. Migración Prisma para `EmailTemplate` + `EmailTemplateVersion`.
7. Configuración de Cloud Build y trigger de CI/CD.
8. Anonimización de respuestas de clima (consultar con legal primero).

**Archivos clave del proyecto actual**:

- `src/lib/prisma.ts` — singleton Prisma
- `src/middleware.ts` — auth middleware
- `src/utils/supabase/{client,server,admin}.ts` — clientes Supabase
- `src/app/auth/callback/route.ts` — OAuth callback
- `src/app/api/clima/surveys/route.ts` — CRUD encuestas
- `prisma/schema.prisma` — esquema completo

---

**Última actualización**: 2026-04-21
