# Arquitectura — People Hub (Alegra)

## Descripción general

**People Hub** es una aplicación web interna de Alegra para la gestión del talento humano. Está construida con Next.js 16 (App Router), TypeScript estricto, y Supabase como plataforma de autenticación y base de datos.

Incluye cinco módulos principales: Clima Organizacional, eNPS, Evaluaciones 360°, Encuestas People y Organigrama. Cada módulo tiene su propio backend (API Routes) y frontend (componentes React), con control de acceso por rol.

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16.2 (App Router) |
| Lenguaje | TypeScript 6 (strict mode) |
| UI | React 19 + Tailwind CSS 3 |
| Auth | Supabase Auth (OAuth Google) |
| Base de datos | PostgreSQL (via Supabase) |
| ORM | Prisma 5 |
| Email | Nodemailer (Gmail SMTP) |
| Gráficos | Recharts |
| Editor de texto | TipTap (WYSIWYG) |
| Organigrama | @xyflow/react (React Flow) |
| Exportación | xlsx (Excel) |
| Iconos | Lucide React |
| Deploy | Docker → Google Cloud Run |

---

## Estructura de carpetas

```
/
├── src/
│   ├── app/
│   │   ├── api/              # Backend — API Routes de Next.js
│   │   │   ├── auth/         # Perfil y rol del usuario autenticado
│   │   │   ├── clima/        # CRUD encuestas de clima
│   │   │   ├── enps/         # CRUD encuestas eNPS
│   │   │   ├── evaluaciones360/  # CRUD evaluaciones 360°
│   │   │   ├── people/       # CRUD encuestas People
│   │   │   ├── empleados/    # Listado y equipos de empleados
│   │   │   ├── organigrama/  # Datos del árbol jerárquico
│   │   │   ├── admin/        # Gestión de usuarios y módulos
│   │   │   ├── home/         # Dashboard y pendientes por módulo
│   │   │   ├── modules/      # Módulos activos del usuario
│   │   │   ├── email/        # Envío de invitaciones
│   │   │   └── health/       # Health check
│   │   ├── admin/            # Páginas de administración
│   │   ├── clima/            # Páginas del módulo clima
│   │   ├── enps/             # Páginas del módulo eNPS
│   │   ├── evaluaciones360/  # Páginas del módulo 360°
│   │   ├── people/           # Páginas del módulo People
│   │   ├── organigrama/      # Página del organigrama
│   │   ├── login/            # Página de login
│   │   ├── layout.tsx        # Root layout (fonts, ConditionalLayout)
│   │   └── page.tsx          # Home/Dashboard
│   ├── components/
│   │   ├── Header.tsx        # Navbar con notificaciones
│   │   ├── ConditionalLayout.tsx  # Oculta nav en login/encuesta pública
│   │   ├── clima/            # Componentes del módulo clima
│   │   ├── enps/             # Componentes del módulo eNPS
│   │   ├── evaluaciones360/  # Componentes del módulo 360°
│   │   ├── people/           # Componentes del módulo People
│   │   └── organigrama/      # Componentes del organigrama
│   ├── lib/
│   │   ├── prisma.ts         # Singleton del cliente Prisma
│   │   ├── mailer.ts         # Configuración de Nodemailer
│   │   └── emailTemplate.ts  # Generación de HTML para emails
│   ├── types/
│   │   ├── clima.ts          # Tipos para clima y people
│   │   ├── enps.ts           # Tipos para eNPS
│   │   └── evaluaciones360.ts # Tipos para evaluaciones 360°
│   ├── utils/
│   │   └── supabase/
│   │       ├── client.ts     # Cliente browser (createBrowserClient)
│   │       ├── server.ts     # Cliente SSR con cookies
│   │       └── admin.ts      # Cliente con service role (bypasa RLS)
│   └── proxy.ts              # Middleware de autenticación (edge)
├── prisma/
│   ├── schema.prisma         # Modelos ORM
│   ├── migrations/           # Migraciones SQL complementarias
│   └── *.sql                 # Scripts de creación por módulo
├── Dockerfile                # Build multi-stage para Cloud Run
├── cloudbuild.yaml           # Pipeline CI/CD (Google Cloud Build)
├── next.config.js            # output: 'standalone'
├── tailwind.config.ts        # Tokens de diseño y fuente
└── .env.example              # Variables de entorno necesarias
```

---

## Arquitectura general

### Flujo de una petición

```
Browser
  │
  ▼
Middleware (src/proxy.ts)  ←── edge, ejecuta en EVERY request
  │  • Verifica sesión Supabase
  │  • Redirige a /login si no autenticado
  │  • Valida que el módulo esté activo (module_config)
  │
  ▼
Next.js App Router
  │
  ├─► page.tsx (Server Component)
  │     └─► Client Component ("use client")
  │              └─► fetch('/api/...')
  │
  └─► /api/**/route.ts  (API Route Handler)
         • getUser() — verifica auth
         • Chequea rol del usuario
         • Consulta via Prisma → PostgreSQL (Supabase)
         • Retorna JSON
```

### Patrones de componentes

Los **Server Components** (archivos `page.tsx`) no tienen estado y sirven como punto de entrada de cada ruta. Los componentes interactivos (tablas, formularios, modales) son **Client Components** marcados con `"use client"`.

El patrón de fetch de datos es directo: `useState` + `useEffect` + `fetch()` a la API interna. No se usa SWR, React Query ni axios.

---

## Base de datos

**Motor**: PostgreSQL hosteado en Supabase  
**ORM**: Prisma 5 con cliente singleton en `src/lib/prisma.ts`

### Modelos principales

```
UserRole              — Roles globales (admin / manager / viewer)
UserModuleRole        — Roles por módulo (sobreescribe el global)

Employee              — GID y email del empleado
EmployeePersonalInfo  — Nombres, validoDesde, esActual

ClimateSurvey         — Encuesta de clima (preguntas en JSON)
ClimateSurveyResponse — Respuesta individual (answers en JSON)

PeopleSurvey          — Encuesta People (misma estructura que clima)
PeopleSurveyResponse

EnpsSurvey            — Encuesta eNPS (pregunta 0-10 + seguimiento)
EnpsSurveyAssignment  — Asignación encuesta ↔ empleado
EnpsSurveyResponse    — Score + respuesta abierta

Evaluation360         — Evaluación 360° con 4 tipos y ponderaciones
Evaluation360Assignment — Asignación por tipo (ascendente/descendente/
                          paralela/autoevaluación) con estado y respuestas
```

**Tablas adicionales (SQL, no en schema.prisma)**:
- `climate_survey_assignments` — asignación clima ↔ empleado
- `module_config` — control de módulos activos (is_active)
- `v_empleados_activos_completa` — vista con datos enriquecidos de empleados

---

## Autenticación y autorización

### Autenticación

Supabase Auth con proveedor **Google OAuth**. El flujo es:

1. `/login` → botón Google → Supabase OAuth
2. Supabase redirige a `/auth/callback` con `code`
3. Server Component intercambia el código por una sesión
4. La sesión se guarda en cookies (manejada por `@supabase/ssr`)
5. Redirige al destino original o al home

### Middleware (`src/proxy.ts`)

Se ejecuta en el Edge Runtime en **cada petición**. Responsabilidades:

- Refrescar el token de sesión automáticamente
- Redirigir a `/login` si no hay sesión válida
- Verificar si el módulo solicitado está activo (`module_config.is_active`)
- Manejar headers de Cloud Run (`x-forwarded-proto`, `x-forwarded-host`)

### Control de acceso por rol (RBAC)

Hay tres roles disponibles: `admin`, `manager`, `viewer`.

Los roles se almacenan en dos niveles:

| Tabla | Alcance |
|---|---|
| `user_roles` | Global — aplica a todos los módulos |
| `user_module_roles` | Por módulo — sobreescribe el global |

Cada API Route obtiene el usuario autenticado con `supabase.auth.getUser()` y consulta su rol para filtrar los datos que retorna. Por ejemplo, un `viewer` solo recibe las encuestas que le fueron asignadas.

### Clientes de Supabase

| Archivo | Cuándo se usa |
|---|---|
| `utils/supabase/client.ts` | Componentes del browser |
| `utils/supabase/server.ts` | Server Components y API Routes (con cookies) |
| `utils/supabase/admin.ts` | API Routes que necesitan bypassar RLS (service role) |

---

## Módulos de la aplicación

### 1. Clima Organizacional (`/clima`)

Encuestas de clima con preguntas configurables (escala, opción múltiple, texto libre).

- **Admin**: crea, edita, elimina encuestas; asigna participantes; ve resultados
- **Manager**: acceso de solo lectura a resultados
- **Viewer**: responde las encuestas asignadas

Componentes clave:
- `SurveyBuilder.tsx` — formulario de 3 pasos (preguntas → participantes → emails)
- `SurveyTaker.tsx` — formulario de respuesta
- `SurveyResults.tsx` — visualización con Recharts
- `EmailTemplateEditor.tsx` — editor de plantilla de invitación (TipTap)

### 2. eNPS (`/enps`)

Encuesta de Employee Net Promoter Score: una pregunta de 0 a 10 con una pregunta de seguimiento opcional.

Scoring: `NPS = (promotores − detractores) / total × 100`  
Segmentos: Promotores (9-10), Pasivos (7-8), Detractores (0-6)

### 3. Evaluaciones 360° (`/evaluaciones360`)

Evaluaciones multidireccionales con cuatro tipos configurables por separado:

| Tipo | Dirección |
|---|---|
| Descendente | Jefe → Reporte |
| Ascendente | Reporte → Jefe |
| Paralela | Peer → Peer |
| Autoevaluación | Persona → sí misma |

Cada tipo tiene su propio conjunto de preguntas y peso en el score final. El evaluador solo ve las preguntas del tipo que le corresponde.

Estados de un assignment: `pending → in_progress → completed → submitted`

### 4. Encuestas People (`/people`)

Misma arquitectura que clima, operada por el equipo de People. Comparte tipos del módulo clima.

### 5. Organigrama (`/organigrama`)

Visualización de la jerarquía de la empresa construida con React Flow (`@xyflow/react`). Los nodos muestran foto, nombre y cargo. Los datos vienen de la API `/api/organigrama`.

### 6. Admin (`/admin`)

Gestión de usuarios (asignar/modificar roles) y control de módulos (activar/desactivar). Solo accesible para el rol `admin`.

---

## API interna

Todos los endpoints siguen la convención REST sobre `src/app/api/`.

**Parámetros de query comunes**:
- `?page=1&pageSize=10` — paginación
- `?search=texto` — búsqueda
- `?sort=campo&order=asc|desc` — ordenamiento

**Patrón de respuesta**:
```json
{ "data": [...], "total": 100 }   // listados
{ "error": "mensaje" }             // errores
```

**Endpoints representativos**:

```
GET  /api/auth/role                        Rol del usuario (global + modular)
GET  /api/home                             Módulos activos + items pendientes

GET  /api/clima/surveys                    Listado filtrado por rol
POST /api/clima/surveys                    Crear encuesta
GET  /api/clima/surveys/[id]/results       Resultados agregados
POST /api/clima/surveys/[id]/assignments   Asignar participantes

GET  /api/enps/surveys
POST /api/enps/responses

GET  /api/evaluaciones360/surveys/[id]/results  Análisis por tipo
POST /api/evaluaciones360/surveys/[id]/remind   Enviar recordatorios

GET  /api/empleados                        Lista paginada con búsqueda
GET  /api/admin/modules                    Estado de módulos
PATCH /api/admin/modules/[id]              Activar/desactivar módulo
```

---

## Email

El sistema usa **Nodemailer** con Gmail SMTP para enviar invitaciones y recordatorios.

- `src/lib/mailer.ts` — transporter singleton
- `src/lib/emailTemplate.ts` — genera HTML con interpolación de variables (`{{variable}}`)
- Los admins pueden personalizar el cuerpo del email desde el `EmailTemplateEditor` (TipTap)

---

## Despliegue

La aplicación está configurada para **Google Cloud Run**:

- `next.config.js`: `output: 'standalone'` genera un build auto-contenido
- `Dockerfile`: build multi-stage (build → runtime Node 20 alpine)
- `cloudbuild.yaml`: pipeline de CI/CD en Google Cloud Build

**Variables de entorno requeridas**:

```
DATABASE_URL                   # PostgreSQL (Supabase connection pooler)
NEXT_PUBLIC_SUPABASE_URL       # URL del proyecto Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY  # Clave pública (segura en el cliente)
SUPABASE_SERVICE_ROLE_KEY      # Clave secreta (solo servidor)
GMAIL_USER                     # Cuenta de correo para envíos
GMAIL_APP_PASSWORD             # App password de Gmail
```

---

## Diseño y estilos

Los estilos usan Tailwind CSS con tokens personalizados:

| Token | Valor | Uso |
|---|---|---|
| `primary` | `#00D6BC` | Acciones, hover, acentos |
| `dark-bg` | `#1e293b` | Fondos oscuros |
| `body-bg` | `#f1f5f9` | Fondo general de la app |

Fuente principal: **Plus Jakarta Sans** (Google Fonts).

Los iconos son de **Lucide React**. Los gráficos usan **Recharts**.
