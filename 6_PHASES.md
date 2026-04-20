# QualitTab — Fases de Desarrollo MVP

## Fase 1 — Fundación (monorepo + auth + org)
**Objetivo:** poder loguearse con Google y tener una organización con áreas y usuarios.

### Backend
- [ ] Setup monorepo (Turborepo + pnpm workspaces)
- [ ] Setup NestJS base con Prisma + PostgreSQL
- [ ] Migración inicial del schema completo
- [ ] Módulo Auth: Google OAuth + Passport + JWT
- [ ] Lógica de whitelist en callback de OAuth
- [ ] Módulo Organizations: CRUD organización
- [ ] Módulo Areas: árbol recursivo (crear, anidar, mover)
- [ ] Módulo Users: whitelist, asignar rol/área
- [ ] Guards: TenantGuard, RolesGuard, AreaAccessGuard
- [ ] AuditInterceptor base

### Frontend
- [ ] Setup Next.js + Tailwind + shadcn/ui + PWA
- [ ] Setup next-auth con Google Provider
- [ ] Layout principal (sidebar + header)
- [ ] Pantalla login
- [ ] Pantalla select-org (si tiene múltiples)
- [ ] Dashboard básico
- [ ] Settings de organización (áreas, whitelist, usuarios)
- [ ] Componente AreaTreeSelector

---

## Fase 2 — Documentos y Registros
**Objetivo:** poder crear documentos ISO y definir registros con campos OWN.

### Backend
- [ ] Módulo Documents: CRUD + versioning + upload R2
- [ ] Módulo Records: CRUD con validaciones de tipo
- [ ] RecordField: CRUD de campos OWN
- [ ] Validación de comparisonConfig y formulaConfig al guardar campo
- [ ] Validación de relatedRecord (misma org, tipos compatibles)
- [ ] RecordAction: CRUD de acciones entre registros

### Frontend
- [ ] Lista y detalle de documentos
- [ ] Upload de PDF de documento
- [ ] Lista de registros
- [ ] Record Builder: formulario de creación con campos OWN dinámicos
  - [ ] Configurador de COMPARISON
  - [ ] Editor de FORMULA con autocomplete
  - [ ] Drag & drop de campos
  - [ ] Toggle identificador
- [ ] Detalle de registro con resumen de configuración

---

## Fase 3 — Entradas
**Objetivo:** poder completar entradas de registros con todos los tipos de campo.

### Backend
- [ ] Módulo Entries: crear, editar, completar
- [ ] Evaluación de FORMULA con mathjs al guardar
- [ ] Evaluación de COMPARISON al guardar
- [ ] Creación automática de NonConformity si comparison falla
- [ ] Lógica de campos IDENTIFIER (inmutables en COMPLETED)
- [ ] Lógica de RecordAction: disparar creación de entry en target record
- [ ] Scheduling PERIODIC: calcular próxima dueDate al completar entry
- [ ] BullMQ: job diario de check-due-entries

### Frontend
- [ ] Dynamic Record Form: renderizar formulario según campos OWN
  - [ ] NUMBER field
  - [ ] TEXT field
  - [ ] DATE field
  - [ ] RELATED_ENTRY field (selector con búsqueda)
  - [ ] MULTIPLE_RELATED_ENTRY field
  - [ ] COMPARISON field con badge de resultado en tiempo real
  - [ ] FORMULA field (solo lectura, cálculo en tiempo real con mathjs)
- [ ] Lista de entradas de un registro
- [ ] Detalle de entrada
- [ ] Indicador visual de entries próximas a vencer

---

## Fase 4 — Instrumental
**Objetivo:** tener trazabilidad del instrumental con cambios de estado.

### Backend
- [ ] Módulo Instruments: CRUD
- [ ] Cambio de estado con log (InstrumentStatusLog)
- [ ] Validación: instrumento IN_CALIBRATION/IN_REPAIR no usable en entries

### Frontend
- [ ] Lista de instrumentos con filtro por estado
- [ ] Detalle con historial de estados
- [ ] Modal de cambio de estado
- [ ] Badge de estado con colores

---

## Fase 5 — No Conformidades
**Objetivo:** gestión completa de no conformidades y acciones correctivas.

### Backend
- [ ] Módulo NonConformities: CRUD
- [ ] Creación manual y automática (por comparison fallida)
- [ ] Módulo CorrectiveActions
- [ ] Workflow de estado: OPEN → IN_PROGRESS → RESOLVED → CLOSED

### Frontend
- [ ] Lista de no conformidades con filtros
- [ ] Detalle con acciones correctivas
- [ ] Creación manual
- [ ] Indicadores en dashboard (NCAs abiertas, vencidas)

---

## Fase 6 — Auditoría y Polish
**Objetivo:** sistema listo para pasar una auditoría real.

### Backend
- [ ] Endpoint de AuditLog con filtros completos
- [ ] Notificaciones por email (BullMQ + nodemailer o Resend)
- [ ] Push notifications PWA

### Frontend
- [ ] Vista de AuditLog
- [ ] Dashboard con métricas: entries vencidas, NCAs abiertas, instrumentos fuera de servicio
- [ ] Export a PDF de entradas / registros (para auditoría)
- [ ] Modo offline básico (cache de registros y entries del día)
- [ ] Instalación PWA (prompt en mobile)

---

## V2 (post-MVP)
- Ensayos (Experiments) con lista de instrumental requerido
- Validación de instrumental vigente al iniciar ensayo
- Pricing / planes
- Reportes avanzados
- AaaS: agente que prepara el informe de auditoría automáticamente
