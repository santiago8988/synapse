# QualitTab — Root CLAUDE.md

## ¿Qué es QualitTab?
SaaS multitenant de gestión de calidad para laboratorios y empresas.
Resuelve el problema de ensayos realizados con materiales/instrumentos fuera de calibración o mantenimiento.
El sistema actúa como trazabilidad + recordatorio + automatización de ciclos de calidad.

## Monorepo Structure
```
qualitab/
  apps/
    api/          ← NestJS (backend)
    web/          ← Next.js 14+ (frontend PWA)
  packages/
    types/        ← tipos y enums compartidos (TypeScript)
    validators/   ← schemas Zod compartidos
  docker-compose.yml
  turbo.json
  package.json   ← workspace root (pnpm)
```

## Tech Stack

### Backend (apps/api)
- **NestJS** con TypeScript strict
- **Prisma** ORM + PostgreSQL
- **BullMQ + Redis** para scheduling y notificaciones
- **Zod** para validación
- **Google OAuth** via Passport.js (NO contraseñas)
- **Cloudflare R2** para documentos y attachments (via @aws-sdk/client-s3)
- **JWT** para sesiones post-OAuth

### Frontend (apps/web)
- **Next.js 14+** App Router
- **TypeScript strict**
- **Tailwind CSS + shadcn/ui**
- **React Hook Form + Zod** para formularios dinámicos
- **PWA** (next-pwa)
- **Google OAuth** (next-auth)

### Infra
- PostgreSQL hosteado en Railway o Supabase
- Redis hosteado en Upstash
- Frontend en Vercel
- R2 en Cloudflare

## Convenciones Generales

### Idioma
- Código y variables: **inglés**
- Comentarios y documentación: **español**
- UI/UX labels: **español**

### TypeScript
- Siempre `strict: true`
- No usar `any` — usar `unknown` si es necesario
- Exportar tipos desde `packages/types`

### Git
- Branches: `feature/`, `fix/`, `chore/`
- Commits en español, descriptivos

### Nunca hacer
- No guardar contraseñas (auth solo Google OAuth)
- No hardcodear secrets (usar variables de entorno)
- No exponer datos de otros tenants (siempre filtrar por `organizationId`)
- No modificar entradas con `identifier` una vez creadas

## Variables de Entorno necesarias
```
# Base
DATABASE_URL=
REDIS_URL=

# Auth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXTAUTH_SECRET=
NEXTAUTH_URL=

# Storage
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=

# App
NEXT_PUBLIC_API_URL=
JWT_SECRET=
```

## Modelo de Negocio
- Multitenant: cada Organization es un tenant aislado
- Auth por whitelist: el Admin de la org agrega emails permitidos
- Login: Google OAuth → verificar email en whitelist → asignar rol
- Sin registro público
