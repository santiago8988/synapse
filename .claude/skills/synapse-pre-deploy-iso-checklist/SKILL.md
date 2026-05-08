---
name: synapse-pre-deploy-iso-checklist
description: Checklist interactivo a correr antes de cualquier deploy de Synapse a producción. Verifica integridad ISO (audit log, append-only, documents ACTIVE), seguridad (no eval, no secrets en logs, headers en next.config), y limpieza de tipos (tsc --noEmit). Útil para liberación de versiones que pasan auditoría.
---

# synapse-pre-deploy-iso-checklist

Checklist guiado pre-deploy. Cada ítem se verifica con un comando concreto. Si alguno falla, el deploy se frena hasta resolver.

## Cómo correrlo

Ejecutar uno por uno los comandos de cada sección. Marcar en una lista en chat lo que va pasando (✓) o fallando (✗ con detalle).

## 1. Integridad de schema y migraciones

```bash
# 1.1 Schema válido y client generado
pnpm --filter @synapse/api db:generate
# Esperado: "✔ Generated Prisma Client"

# 1.2 No hay migraciones pendientes
pnpm --filter @synapse/api prisma migrate status
# Esperado: "Database schema is up to date!"
# Si dice "Following migrations have not yet been applied" → frenar
```

## 2. Tipos limpios

```bash
# 2.1 API
pnpm --filter @synapse/api exec tsc --noEmit
# Esperado: 0 errores

# 2.2 Web (los pre-existentes en records/[id] y settings se pueden tolerar
#      según el baseline en main; los nuevos no)
pnpm --filter @synapse/web exec tsc --noEmit
```

## 3. Append-only respetado

```bash
# 3.1 No hay updates sobre AuditLog ni *StatusLog en código
grep -rn "auditLog\.update\|auditLog\.delete\|auditLog\.deleteMany\|auditLog\.upsert" apps/api/src
grep -rn "instrumentStatusLog\.update\|instrumentStatusLog\.delete" apps/api/src
grep -rn "batchStatusLog\.update\|batchStatusLog\.delete" apps/api/src

# Esperado: cero matches.
# Si aparece alguno → frenar y revisar el módulo correspondiente.
```

## 4. No hay eval()

```bash
# 4.1 Solo mathjs evalúa fórmulas
grep -rn "eval(" apps/api/src apps/web/src
grep -rn "new Function(" apps/api/src apps/web/src

# Esperado: cero matches en código de evaluación de fórmulas.
# Falsos positivos válidos: en tests aislados o comentarios.
```

## 5. No hay secrets en código

```bash
# 5.1 Buscar strings que parecen secrets hardcoded
grep -rEn "(password|secret|apiKey|token)\s*[:=]\s*['\"][a-zA-Z0-9_/+=-]{20,}" apps/api/src apps/web/src --include='*.ts' --include='*.tsx'

# 5.2 Verificar que .env* no esté tracked
git ls-files | grep -E '\.env(\..*)?$'
# Esperado: solo .env.example si existe, ninguna otra variante.

# 5.3 Audit log no contiene tokens
grep -rEn "before:.*password|after:.*password|before:.*token|after:.*token" apps/api/src

# Esperado: cero matches.
```

## 6. Multitenant sano

```bash
# 6.1 Spot-check: ¿hay queries Prisma sin where organizationId?
# Buscar findFirst/findMany sobre tablas con organizationId, sin organizationId en el where:
grep -rn "prisma\.\(record\|entry\|instrument\|document\|nonConformity\|recipe\|batch\|sample\|matrix\|stockMovement\|calibrationTemplate\|calibration\|approvalRequest\)\.findMany" apps/api/src

# Para cada match, verificar manualmente que el where incluya organizationId
# (o que el filtro esté en una relación, ej. record: { organizationId }).
```

Si la base de código creció, considerar correr el agent `multitenant-isolation-checker` en lugar del grep manual.

## 7. Documents y plantillas ACTIVE no se modificaron in-place

```bash
# 7.1 Buscar updates a Document que cambien content/fileUrl sin pasar por nueva versión
grep -rn "document\.update.*content\|document\.update.*fileUrl" apps/api/src

# Verificar manualmente que cualquier match esté en el flujo de "crear nueva versión",
# no en un PATCH directo.
```

## 8. Headers de seguridad

```bash
# 8.1 Verificar que next.config tenga headers()
grep -A 20 "headers()" apps/web/next.config.js

# Esperado: bloque que devuelve CSP, HSTS, X-Frame-Options, etc.
# Si no existe → invocar la skill `synapse-security-headers`.
```

## 9. Lint limpio

```bash
pnpm lint
# Esperado: cero errores. Warnings se evalúan caso a caso.
```

## 10. Variables de entorno

Verificar manualmente en el panel de Vercel/Railway/Supabase que todas estén configuradas:

```
DATABASE_URL, REDIS_URL,
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXTAUTH_SECRET, NEXTAUTH_URL, JWT_SECRET,
R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL,
NEXT_PUBLIC_API_URL
```

Si alguna falta → frenar.

## 11. Whitelist al día

Solo aplicable si se está liberando una versión a una organización nueva o si hay rotación de personal:

- Verificar `EmailWhitelist` en cada org afectada.
- Eliminar emails de personas que ya no trabajan en la org.

## 12. Backup de DB

Antes de aplicar migraciones a producción:
- Tomar snapshot de la DB en Supabase.
- Anotar el timestamp del snapshot en el ticket de release.
- Si la migración hace algo irreversible (DROP COLUMN con datos, RENAME), agregar el timestamp del backup como comentario en el `migration.sql`.

## Plantilla de reporte

Al terminar, generar este reporte:

```
## Pre-deploy checklist — <fecha> — release <vN.N.N>

1. Integridad schema: ✓ / ✗ <detalle>
2. Tipos limpios api: ✓ / ✗
3. Tipos limpios web: ✓ / ✗ (toleramos N errores pre-existentes en <archivos>)
4. Append-only: ✓
5. No eval: ✓
6. No secrets: ✓
7. Multitenant: ✓ (M queries verificadas)
8. Documents ACTIVE: ✓
9. Headers de seguridad: ✓ / ✗ (pendiente — issue #N)
10. Lint: ✓
11. Env vars: ✓
12. Whitelist actualizada: ✓ / N/A
13. Backup tomado: ✓ <timestamp del snapshot>

VEREDICTO: APTO PARA DEPLOY / FRENAR — resolver <items>
```

## NO hacer

- No saltear ítems "porque ya pasó la última vez". Cada release los re-verifica.
- No deployar fuera de horario laboral si el equipo de calidad no puede revisar AuditLog en caso de bug crítico.
- No deployar migraciones destructivas y código en el mismo release sin un plan de rollback escrito.
