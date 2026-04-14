# People Hub — Alegra

Portal interno de gestión de personas para Alegra. Permite a los equipos de RR.HH. crear y distribuir encuestas de clima organizacional, gestionar participantes y visualizar resultados, con acceso basado en roles.

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router) |
| Lenguaje | TypeScript 6 (strict) |
| UI | React 19 + Tailwind CSS 3 |
| Base de datos | PostgreSQL vía Supabase |
| ORM | Prisma 5 |
| Autenticación | Supabase Auth (OAuth Google) |
| Iconos | Lucide React |
| Fuente | Plus Jakarta Sans |

---

## Módulos

### Clima Organizacional (`/clima`)

Gestión completa del ciclo de vida de encuestas de clima:

- **Admin**: crea, edita y elimina encuestas; asigna participantes; visualiza resultados y gestiona el avance por persona. Puede alternar entre modo *Gestionar* y modo *Participar* para responder encuestas como empleado.
- **Manager**: visualiza resultados de todas las encuestas.
- **Viewer**: ve y responde únicamente las encuestas que le fueron asignadas.

---

## Estructura del proyecto

```
src/
├── app/
│   ├── api/
│   │   ├── auth/role/         # Obtiene el rol del usuario autenticado
│   │   ├── clima/
│   │   │   ├── responses/     # Guardar / consultar respuestas
│   │   │   └── surveys/       # CRUD de encuestas + participantes
│   │   └── empleados/         # Lista paginada de empleados activos
│   ├── auth/callback/         # Callback de OAuth (Supabase)
│   ├── login/                 # Página de inicio de sesión
│   ├── clima/                 # Módulo de clima (página principal)
│   └── layout.tsx             # Layout raíz con Header y Footer
├── components/
│   ├── Header.tsx
│   ├── Footer.tsx
│   └── clima/
│       ├── AdminList.tsx          # Tabla de encuestas para admin
│       ├── ManagerList.tsx        # Vista de resultados para manager
│       ├── ViewerList.tsx         # Encuestas pendientes/completadas para viewer
│       ├── SurveyBuilder.tsx      # Formulario de creación/edición (3 pasos)
│       ├── ParticipantSelector.tsx # Selector de participantes con búsqueda y paginación
│       ├── SurveyTaker.tsx        # Formulario para responder una encuesta
│       ├── SurveyResults.tsx      # Visualización de resultados
│       └── SurveyParticipants.tsx # Gestión de participantes asignados
├── lib/
│   └── prisma.ts              # Singleton del cliente Prisma
├── types/
│   └── clima.ts               # Tipos TypeScript del módulo de clima
└── utils/
    └── supabase/
        ├── client.ts          # Cliente Supabase para el navegador
        ├── server.ts          # Cliente Supabase SSR (Server Components)
        └── admin.ts           # Cliente Supabase con service role (bypass RLS)
```

---

## Base de datos

### Tablas principales (Prisma)

| Tabla | Descripción |
|---|---|
| `user_roles` | Roles de acceso por usuario (admin, manager, viewer) |
| `employees` | Registro de empleados vinculados a cuentas Supabase |
| `employee_personal_info` | Historial de datos personales del empleado |
| `climate_surveys` | Encuestas de clima (título, descripción, preguntas JSON) |
| `climate_survey_responses` | Respuestas por empleado (unique: survey_id + employee_id) |

### Tablas en Supabase (SQL directo)

| Tabla / Vista | Descripción |
|---|---|
| `climate_survey_assignments` | Asignaciones de encuesta a empleados |
| `v_empleados_activos_completa` | Vista con datos enriquecidos del empleado activo |

### Scripts SQL

```
prisma/
├── create_tables.sql        # employees, climate_surveys, climate_survey_responses
├── create_assignments.sql   # climate_survey_assignments
└── add_unique_response.sql  # Constraint único en respuestas
```

---

## Configuración local

### 1. Clonar el repositorio

```bash
git clone <url-del-repo>
cd people-hub
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Variables de entorno

Copia el archivo de ejemplo y completa los valores:

```bash
cp .env.example .env
```

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | URL de conexión directa a PostgreSQL (puerto 5432) |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública (anon) de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de servicio (solo servidor, no exponer al cliente) |

### 4. Generar el cliente Prisma

```bash
npx prisma generate
```

### 5. Ejecutar migraciones SQL

Ejecuta los scripts en orden desde el SQL Editor de Supabase o con:

```bash
npx prisma db execute --file prisma/create_tables.sql
npx prisma db execute --file prisma/create_assignments.sql
npx prisma db execute --file prisma/add_unique_response.sql
```

### 6. Iniciar el servidor de desarrollo

```bash
npm run dev
```

La app estará disponible en `http://localhost:3001`.

---

## Scripts disponibles

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo (puerto 3001) |
| `npm run build` | Build de producción |
| `npm run start` | Inicia el servidor de producción |
| `npm run lint` | Linting con ESLint |

---

## Roles y permisos

| Acción | Admin | Manager | Viewer |
|---|:---:|:---:|:---:|
| Crear encuesta | ✓ | | |
| Editar encuesta | ✓ | | |
| Eliminar encuesta | ✓ | | |
| Gestionar participantes | ✓ | | |
| Ver resultados | ✓ | ✓ | |
| Responder encuesta | ✓* | | ✓ |

*El admin puede activar el modo **Participar** desde el selector en la parte superior derecha del módulo.

---

## Paleta de colores

| Token | Valor | Uso |
|---|---|---|
| `primary` | `#00D6BC` | Acciones principales, acentos |
| `dark-bg` | `#1e293b` | Fondos oscuros, texto principal |
| `body-bg` | `#f1f5f9` | Fondo general de la app |
| `error` | `#EF4444` | Errores y acciones destructivas |
| `success` | `#10B981` | Estados completados |
