# Synapse

SaaS multitenant de gestión de calidad para laboratorios y empresas de producción. Diseñado para soportar certificaciones **ISO 9001** (calidad) e **ISO/IEC 17025** (laboratorios de ensayo y calibración). El sistema cubre trazabilidad de ensayos, control de instrumental, calibraciones, lotes, muestras, stock, no conformidades y circuito de aprobación documental.

Fork de QualitTab2 con redesign visual; el nombre de la marca actual es **Synapse by NosisHub**.

## Monorepo

```
synapse/
  apps/
    api/                  ← NestJS + Prisma (backend)         → apps/api/CLAUDE.md
    web/                  ← Next.js 14 App Router (frontend)  → apps/web/CLAUDE.md
  packages/
    types/                ← tipos TS y enums compartidos      → packages/types/CLAUDE.md
    validators/           ← schemas Zod compartidos            → packages/validators/CLAUDE.md
  docs/
    user-guide/           ← guía de usuario activa (12 módulos)
    design/               ← briefs de diseño activos
    legacy/               ← markdowns originales (QualitTab) — referencia histórica
  SAMPLE_CUSTODY_SPEC.md  ← spec ISO 17025 §7.4 pendiente de implementar
```

Workspace manager: **pnpm** (versión declarada en `package.json` → `packageManager: pnpm@9.15.0`).
Task runner: **Turborepo** (`turbo.json`).

## Stack consolidado

**Backend** — NestJS · Prisma + PostgreSQL · BullMQ + Redis · Passport (Google OAuth) · JWT · Zod · Cloudflare R2 (`@aws-sdk/client-s3`) · `mathjs` (evaluación de fórmulas, **nunca** `eval`).

**Frontend** — Next.js 14 App Router · TypeScript strict · Tailwind CSS · shadcn/ui · React Hook Form + Zod · TanStack Query · Zustand · next-pwa.

**Infra** — PostgreSQL en Supabase/Railway · Redis en Upstash · Frontend en Vercel · R2 en Cloudflare.

## Comandos

```bash
pnpm dev            # api + web en paralelo (concurrently)
pnpm dev:turbo      # idem vía turbo
pnpm build          # build de todo el monorepo
pnpm lint           # lint de todo el monorepo
pnpm db:generate    # genera Prisma Client
pnpm db:push        # push del schema (sin migración)
pnpm db:migrate     # crea/aplica migración
```

Para correr un solo workspace: `pnpm --filter @synapse/api dev` o `pnpm --filter @synapse/web dev`.

## Convenciones globales

- **Idioma**: código y nombres de variables en **inglés**; comentarios, commits y UI en **español**.
- **TypeScript**: `strict: true` siempre. Prohibido `any` — usar `unknown` y tipear.
- **Texto ingresado por usuario**: se almacena en **MAYÚSCULAS** (consistencia y búsquedas). El backend hace el upper-case al recibir; el frontend muestra tal cual.
- **Versionado**: ver `apps/api/prisma/schema.prisma` para la verdad sobre modelos y enums (la fuente de los `packages/types/src/enums.ts`).
- **Branches**: `feature/`, `fix/`, `chore/`. Commits descriptivos en español. Nunca `--no-verify` ni `--force` a `main`.

## Reglas globales NUNCA-HACER (críticas para ISO + seguridad)

1. **Nunca** ejecutar queries Prisma sin `where: { organizationId }` — el aislamiento multitenant depende de esto.
2. **Nunca** tomar `organizationId` del body, params o query string. Siempre desde el JWT (`@CurrentUser() user.organizationId`).
3. **Nunca** usar `eval()` para fórmulas. Solo `mathjs` con scope explícito de variables.
4. **Nunca** hacer `UPDATE` o `DELETE` sobre `AuditLog`, `InstrumentStatusLog`, `BatchStatusLog`, ni futuros `*StatusLog` o `*Event` (append-only — requisito ISO).
5. **Nunca** modificar valores de campos `isIdentifier` de una `Entry` con `status = COMPLETED`. El frontend deshabilita; el backend valida.
6. **Nunca** editar in-place un `Document` con `status = ACTIVE`. Crear nueva versión y la anterior pasa a `SUPERSEDED`.
7. **Nunca** commitear `.env*`, claves R2, `JWT_SECRET`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`. Verificar con `git diff` antes de stage.
8. **Nunca** loguear payloads que contengan tokens, contraseñas o PII en el `AuditLog` (revisar `before`/`after` antes de persistir).
9. **Nunca** eliminar tablas, columnas o enums append-only en una migración Prisma sin un plan documentado de rollback y backfill.
10. **Nunca** retornar datos cross-tenant en una respuesta — incluso si el caller "tiene permiso", filtrar por `organizationId`.

## Variables de entorno requeridas

```
# Base de datos
DATABASE_URL=
REDIS_URL=

# Auth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXTAUTH_SECRET=
NEXTAUTH_URL=
JWT_SECRET=

# Storage
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=

# App
NEXT_PUBLIC_API_URL=
```

## Modelo de negocio

- **Multitenant**: cada `Organization` es un tenant aislado.
- **Auth por whitelist**: el admin de la organización agrega emails permitidos (`EmailWhitelist`).
- **Login**: Google OAuth → verificar email en whitelist → asignar/recuperar `OrganizationUser` → emitir JWT.
- **Sin registro público**.
- **Roles**: `ADMIN`, `QUALITY_MANAGER`, `TECHNICIAN`, `AUDITOR`. Visibilidad jerárquica por `Area` (un usuario ve su área y todas las sub-áreas).

## Documentación viva

- `docs/user-guide/` — 12 módulos describiendo el sistema desde la perspectiva del usuario (administradores, calidad, técnicos, auditores). Es la referencia funcional canónica.
- `docs/design/` — briefs visuales y mockups del rediseño actual.
- `docs/legacy/` — markdowns del diseño original (QualitTab). Útil para entender el porqué de decisiones, **no** para inferir estado actual del código.
- `SAMPLE_CUSTODY_SPEC.md` — spec ISO 17025 §7.4 pendiente. Implementación bloqueada por falta del modelo `SampleCustodyEvent`.

## Sub-CLAUDE.md

Cada workspace tiene su propio CLAUDE.md con stack, convenciones y reglas específicas:

- **[apps/api/CLAUDE.md](apps/api/CLAUDE.md)** — backend NestJS, módulos, guards, eventos de dominio, reglas ISO.
- **[apps/web/CLAUDE.md](apps/web/CLAUDE.md)** — frontend Next.js, rutas, componentes, dynamic forms, PWA.
- **[packages/types/CLAUDE.md](packages/types/CLAUDE.md)** — tipos y enums compartidos.
- **[packages/validators/CLAUDE.md](packages/validators/CLAUDE.md)** — schemas Zod compartidos.
