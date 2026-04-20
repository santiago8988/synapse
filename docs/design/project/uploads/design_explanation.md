# Rediseño de layout y formularios — QualitTab2

Rediseñá el layout principal de QualitTab2 **y** los formularios de toda la app. La app es form-heavy: el corazón es un **Record Builder** que genera formularios dinámicos, así que todas las pantallas deben sentirse coherentes con ese patrón.

Objetivo: interfaz moderna, densa pero clara, mobile-first (PWA), que transmita seriedad de herramienta de calidad industrial (ISO 9001 / 17025).

## Qué es QualitTab2

SaaS **multitenant** de gestión de calidad para laboratorios y empresas de producción. Resuelve: trazabilidad de ensayos, recordatorios de calibración/verificación, automatización de ciclos, detección de no conformidades. Roles: `ADMIN`, `QUALITY_MANAGER`, `TECHNICIAN`, `AUDITOR`. Login **solo Google OAuth con whitelist**.

## Stack frontend
Next.js 14+ App Router · TypeScript strict · Tailwind + **shadcn/ui** (base, no reemplazar) · React Hook Form + Zod · TanStack Query · Zustand · next-pwa · next-auth

## Estructura de rutas

```
app/
  (auth)/              login · select-org
  (app)/               layout con sidebar + header
    dashboard
    records            new · [id] · [id]/entries/new · [id]/entries/[entryId]
    documents          [id]
    recipes · matrices · methods · calibration-templates
    batches · samples · instruments · calibrations · stock
    non-conformities · approvals · audit
    settings
```

## Modelo mental: Record → Entry + Companion

| RecordType | Companion (1:1) | Usa plantilla |
|---|---|---|
| `NOT_PERIODIC` / `PERIODIC` / `NOT_PERIODIC_WITH_REVISION` | — | — |
| `INSTRUMENTAL` | `Instrument` | — |
| `BATCH` | `Batch` | Recipe |
| `SAMPLE` | `Sample` | Matrix + Methods |
| `STOCK` | `StockMovement` | — |
| `CALIBRATION` | `Calibration` | CalibrationTemplate |

Records se conectan vía **RecordAction** (cascada: al completar Entry en A → crear Entry en B mapeando campos).

---

## MOCKUPS

### 1. App Shell (desktop)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ≡  QualitTab   Laboratorio Alfa ▾   [ Área: Microbiología ▾ ]  🔔³  👤   │
├───────────────┬──────────────────────────────────────────────────────────┤
│ DEFINICIÓN    │  Registros ›  Verificación diaria balanza                │
│  Dashboard    │ ─────────────────────────────────────────────────────────│
│  Registros  ●  │                                                          │
│  Documentos   │   [ main content ]                                       │
│  Recetas      │                                                          │
│  Matrices     │                                                          │
│  Métodos      │                                                          │
│  Plantillas   │                                                          │
│  calibración  │                                                          │
│               │                                                          │
│ SEGUIMIENTO   │                                                          │
│  Lotes        │                                                          │
│  Muestras     │                                                          │
│  Instrumental │                                                          │
│  Calibraciones│                                                          │
│  Stock        │                                                          │
│               │                                                          │
│ CALIDAD       │                                                          │
│  No Conform.  │                                                          │
│  Aprobaciones⁵│                                                          │
│  Auditoría    │                                                          │
│               │                                                          │
│ CONFIGURACIÓN │                                                          │
│  Ajustes      │                                                          │
├───────────────┤                                                          │
│ Lab. Alfa  ▾  │                                                          │
│ S. Domínguez  │                                                          │
│ QUALITY_MGR   │                                                          │
└───────────────┴──────────────────────────────────────────────────────────┘
```

### 1b. Mobile shell (drawer cerrado)

```
┌─────────────────────────────┐
│ ≡  QualitTab        🔔³  👤 │
├─────────────────────────────┤
│ Dashboard                   │
│                             │
│  ┌──────────┐ ┌──────────┐  │
│  │ Vencen   │ │ NCs      │  │
│  │   7      │ │ abiertas │  │
│  │ esta sem │ │   3      │  │
│  └──────────┘ └──────────┘  │
│                             │
│  Mis tareas                 │
│  ──────────────────────     │
│  • Verif. balanza   vence   │
│  • Ingreso muestra  hoy     │
│  ...                        │
│                             │
├─────────────────────────────┤
│   [ + Nueva entrada ]       │  ← bottom action
└─────────────────────────────┘
```

### 2. Dashboard

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Dashboard · Laboratorio Alfa                                    Hoy      │
├──────────────────────────────────────────────────────────────────────────┤
│  ┌─── KPI ────┐  ┌─── KPI ────┐  ┌─── KPI ────┐  ┌─── KPI ────┐         │
│  │ Vencen 7d  │  │ Instrum.   │  │ NCs        │  │ Docs a     │         │
│  │     12     │  │ calibrando │  │ abiertas   │  │ revisar    │         │
│  │  ▲ +3 sem  │  │     2      │  │     4      │  │     1      │         │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘         │
│                                                                          │
│  ┌────────────── Mis tareas ───────────────┐  ┌──── Actividad ─────┐    │
│  │ 📅 Hoy                                  │  │ • J.P. completó    │    │
│  │   ✓ Verif. temp. heladera   ✗ Fallida  │  │   Entry #231       │    │
│  │   ○ Ingreso muestra agua     ahora      │  │ • L.R. cambió      │    │
│  │ 📅 Esta semana                          │  │   estado BAL-003   │    │
│  │   ○ Calibración interna pipeta          │  │ • NC #45 asignada  │    │
│  │   ○ Stock mínimo revisión               │  │   a S.M.           │    │
│  │ 📅 Próximas (14 días)                   │  │ • ...              │    │
│  │   ○ Verificación interna termómetro     │  │                    │    │
│  └─────────────────────────────────────────┘  └────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3. Record Builder (split: configuración + preview)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ‹ Registros › Nuevo                      [Guardar borrador] [Publicar]   │
├──────────────────────────────┬───────────────────────────────────────────┤
│ ① DATOS                      │  PREVIEW    🖥 Desktop · 📱 Mobile         │
│  Nombre                      │  ┌─────────────────────────────────────┐  │
│  [Verificación diaria balanza]│  │ Verificación diaria balanza        │  │
│  Tipo:                       │  │ DRAFT · Vence: ─                   │  │
│  ◉ PERIODIC  ○ NOT_PERIODIC  │  │ ─────────────────────────────────  │  │
│  ○ BATCH  ○ SAMPLE           │  │                                    │  │
│  ○ CALIBRATION  ○ INSTRUM.   │  │  CÓDIGO *            [           ] │  │
│  Periodicidad: [1] días      │  │  Lectura patrón      [        ] g  │  │
│  Notificar: [1] día antes    │  │  Lectura balanza     [        ] g  │  │
│  Área: [Microbiología ▸]     │  │  Desviación          (= calc)  mg  │  │
│  Documento: [SOP-LAB-003 ▾]  │  │  ¿Dentro de ±0.5 mg? ✓ cumple     │  │
│                              │  │                                    │  │
│ ② CAMPOS OWN  [+ Agregar]    │  │  [📎 Adjuntar]                     │  │
│  ⋮⋮ CÓDIGO (default)    🔒   │  │                                    │  │
│  ⋮⋮ [Patrón] NUMBER · g      │  │  ┌──────────────────────────────┐  │  │
│      □ req  ☑ identifier     │  │  │ Guardar borrador · Completar │  │  │
│  ⋮⋮ [Lectura] NUMBER · g     │  │  └──────────────────────────────┘  │  │
│      ☑ req                   │  └─────────────────────────────────────┘  │
│  ⋮⋮ [Desviación] FORMULA     │                                           │
│      expr: {lectura}-{patrón}│  Errores de validación: —                │
│  ⋮⋮ [OK?] COMPARISON         │                                           │
│      BETWEEN -0.5 y 0.5      │                                           │
│      compareAgainst: FIELD   │                                           │
│      field: {desviación}     │                                           │
│                              │                                           │
│ ③ ACCIONES EN CASCADA  [+]   │                                           │
│  • Cuando se completa aquí → │                                           │
│    Crear Entry en "NCs auto" │                                           │
│    mapeo: CÓDIGO → REF       │                                           │
│                              │                                           │
│ ④ PUBLICACIÓN                │                                           │
│  Estado: DRAFT               │                                           │
│  [Enviar a revisión]         │                                           │
└──────────────────────────────┴───────────────────────────────────────────┘
```

### 3b. Configuración inline de campo COMPARISON (expand)

```
┌──────────────────────────────────────────────────────┐
│ ⋮⋮  [¿Dentro de tolerancia?]   COMPARISON   ⊗       │
│  ─────────────────────────────────────────────────── │
│  Operador:  [ BETWEEN ▾ ]                            │
│  Comparar contra:  ◉ CONSTANTE  ○ CAMPO              │
│  Mín: [-0.5]   Máx: [0.5]   Unidad: [mg]             │
│  Mensaje en fallo:                                   │
│  [Desviación fuera de tolerancia — generar NC]       │
│  ☑ Requerido   ○ Identificador                       │
└──────────────────────────────────────────────────────┘
```

### 4. Dynamic Record Form (entry — desktop)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ‹ Registros › Verif. diaria balanza › Nueva entrada                      │
│  DRAFT · Vence: 2026-04-20 · Creado por S.D.                             │
├─────────────────────────────────────────────┬────────────────────────────┤
│                                             │  HISTORIAL                 │
│  Identificación                             │  ─────────────────────     │
│   CÓDIGO *          [VBAL-20260420-01  ]    │  • Creada ahora            │
│                                             │                            │
│  Mediciones                                 │  ENTRIES ANTERIORES        │
│   Patrón (g)        [100.000           ]    │  • VBAL-...19 ✓            │
│   Lectura (g)       [100.003           ]    │  • VBAL-...18 ✓            │
│   Desviación (mg)   (3.0)  read-only        │  • VBAL-...17 ✗ NC-#45     │
│   ¿Tolerancia?      ✗ fuera de ±0.5 mg      │                            │
│                                             │  NCs ASOCIADAS             │
│  Adjuntos                                   │  —                         │
│   [📷 Tomar foto] [📎 Adjuntar archivo]     │                            │
│                                             │                            │
├─────────────────────────────────────────────┴────────────────────────────┤
│  [Guardar borrador]                          [Completar entrada]         │
└──────────────────────────────────────────────────────────────────────────┘
```

### 4b. Dynamic Form (mobile) con badge fail visible

```
┌────────────────────────────┐
│ ‹ Verif. diaria balanza    │
│  DRAFT · vence hoy         │
├────────────────────────────┤
│ CÓDIGO *                   │
│ [VBAL-20260420-01      ]   │
│                            │
│ Patrón (g) *               │
│ [100.000               ]   │
│                            │
│ Lectura (g) *              │
│ [100.003               ]   │
│                            │
│ Desviación (mg)            │
│ ┌──── 3.0 (calc) ────┐     │
│                            │
│ ¿Tolerancia?               │
│ ╔══════════════════════╗   │
│ ║ ✗  fuera de ±0.5 mg ║    │
│ ╚══════════════════════╝   │
│                            │
│ [📷 Foto]  [📎 Archivo]    │
├────────────────────────────┤
│  Borrador  │  Completar    │  ← sticky bottom
└────────────────────────────┘
```

### 5. Calibration execution (`/calibrations/[id]`)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ‹ Calibraciones › CAL-BAL-2026-001                     IN_PROGRESS       │
│ Instrumento: BAL-003  ·  Patrón: PAT-M-001  ·  Plantilla: Balanza v1     │
├──────────────────────────────────────────────────────────────────────────┤
│ PRUEBA 1 · EXCENTRICIDAD                        tolerancia: 0.5 mg       │
│ ┌─────────────┬──────────┬───────────┬──────────┬──────┐                 │
│ │ Punto       │ Patrón   │ Lectura   │ Error    │  ✓/✗ │                 │
│ ├─────────────┼──────────┼───────────┼──────────┼──────┤                 │
│ │ CENTRO      │ 100.000  │ [100.001] │ (  0.001)│  ✓   │                 │
│ │ FRONTAL     │ 100.000  │ [100.002] │ (  0.002)│  ✓   │                 │
│ │ POSTERIOR   │ 100.000  │ [       ] │   —      │  —   │                 │
│ │ IZQUIERDA   │ 100.000  │ [       ] │   —      │  —   │                 │
│ │ DERECHA     │ 100.000  │ [       ] │   —      │  —   │                 │
│ └─────────────┴──────────┴───────────┴──────────┴──────┘                 │
│ Resultado: pendiente                                                     │
│                                                                          │
│ PRUEBA 2 · REPETIBILIDAD                        tolerancia: 0.3 mg       │
│ Punto: 50% CAP (100 g)                                                   │
│ L1 [100.001]  L2 [100.002]  L3 [99.999]   L4 [      ]  L5 [      ]       │
│ L6 [       ]  L7 [       ]  L8 [       ]  L9 [      ] L10 [      ]       │
│ Promedio: (= calc)    Desv.Est: (= calc)                                 │
│ Resultado: —                                                             │
│                                                                          │
│ PRUEBA 3 · LINEALIDAD (5 puntos, 3 lecturas c/u)                         │
│ [ tabla similar con 5 filas × (patrón + L1 L2 L3 + avg + error + ✓/✗) ]  │
│                                                                          │
│ ─────────────────────── RESULTADO GENERAL: ─────────────────────────     │
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│   [Guardar]   [Completar]   [Aprobar]   [Rechazar]                       │
└──────────────────────────────────────────────────────────────────────────┘
```

### 6. Listado (ej: Samples) con filtros

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Muestras                            [Buscar código…]   [+ Nueva muestra] │
├────────────┬─────────────────────────────────────────────────────────────┤
│ FILTROS    │  ☑ Mostrar inactivas                          48 resultados │
│ Matriz     │ ┌─────────┬──────────┬──────────┬─────────┬────────┬──────┐ │
│  ☑ Agua    │ │ Código  │ Matriz   │ Métodos  │ Cliente │ Estado │  …   │ │
│  ☐ Suelo   │ ├─────────┼──────────┼──────────┼─────────┼────────┼──────┤ │
│ Estado     │ │ M-00231 │ Agua pot.│ pH, Cl₂  │ CoopX   │🟢 RECIB│ ⋮   │ │
│  ☑ Recibida│ │ M-00230 │ Suelo    │ pH, Hum. │ Estancia│🔵 TESTI│ ⋮   │ │
│  ☑ Testing │ │ M-00229 │ Agua pot.│ Cl₂      │ Municip.│🟢 RECIB│ ⋮   │ │
│  ☐ Complet.│ │ ...                                                     │ │
│ Área       │ └─────────┴──────────┴──────────┴─────────┴────────┴──────┘ │
│  [árbol ▸] │                                         ‹ 1 2 3 ... 5 ›     │
│ Fecha      │                                                             │
│  [desde]   │                                                             │
│  [hasta]   │                                                             │
└────────────┴─────────────────────────────────────────────────────────────┘
```

### 7. Detalle de Record con lista de Entries

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ‹ Registros › Verificación diaria balanza          ACTIVE · v2 · [Editar]│
│ Tipo: PERIODIC · cada 1 día · notifica 1 día antes · Área: Micro         │
├──────────────────────────────────────────────────────────────────────────┤
│  CAMPOS                         │  ENTRIES                               │
│  ──────                         │  ──────                                │
│  • CÓDIGO (id)                  │  [+ Nueva entrada]     [Filtrar ▾]     │
│  • Patrón (num · g)             │                                        │
│  • Lectura (num · g)            │  ┌─────────┬───────┬───────┬─────────┐ │
│  • Desviación (formula)         │  │ Código  │ Fecha │ Result│ Estado  │ │
│  • ¿Tolerancia? (compare)       │  ├─────────┼───────┼───────┼─────────┤ │
│                                 │  │ VBAL-01 │ 20/04 │  ✗    │ COMPLET │ │
│  ACCIONES                       │  │ VBAL-00 │ 19/04 │  ✓    │ APPROVD │ │
│  ──────                         │  │ VBAL-…  │ 18/04 │  ✓    │ APPROVD │ │
│  → Genera NC auto si COMP. falla│  └─────────┴───────┴───────┴─────────┘ │
│                                 │                                        │
│  DOCUMENTO BASE                 │                                        │
│  SOP-LAB-003 v3 (ACTIVE)        │                                        │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Layout principal (shell)

### Sidebar agrupado
```
DEFINICIÓN      Dashboard · Registros · Documentos · Recetas · Matrices · Métodos · Plantillas calib.
SEGUIMIENTO     Lotes · Muestras · Instrumental · Calibraciones · Stock
CALIDAD         No conformidades · Aprobaciones (badge) · Auditoría
CONFIGURACIÓN   Organización · Áreas · Whitelist · Usuarios
```

### Header
Breadcrumbs · selector de área (árbol) · notificaciones (BullMQ: vencimientos, NCs, aprobaciones) · avatar.

### Mobile
Drawer colapsable · bottom action bar en formularios · tabs cuando hay preview+edit (Record Builder).

## Paleta y estados

- Primary `blue-600` · Success `green-600` · Warning `amber-500` · Danger `red-600` · Neutral `slate`
- Entry: DRAFT gris · COMPLETED verde · REQUIRES_REVISION amarillo · APPROVED azul · INACTIVE gris+tachado
- Instrument: ACTIVE verde · IN_CALIBRATION azul+reloj · IN_REPAIR naranja+herramienta · DECOMMISSIONED rojo
- Document: DRAFT · ACTIVE · SUPERSEDED
- NC: OPEN · IN_PROGRESS · RESOLVED · CLOSED

## Restricciones

- Mantener **shadcn/ui** como base (no reemplazar)
- Todo en español en UI; código en inglés
- Mobile-first real (uso en laboratorio/planta, a veces con guantes — inputs grandes)
- Organización activa siempre visible (multitenant)
- Respetar jerarquía de áreas en filtros y selectores

## Output esperado

- Componentes React/TSX con Tailwind + shadcn
- Estructura compatible: `components/layout/`, `components/forms/dynamic-record-form/`, `components/forms/record-builder/`, `components/shared/`
- Set de pantallas clave: App shell · Dashboard · Record Builder · Dynamic Form (desktop+mobile) · Calibration execution · Listado con filtros · Detalle de Record
