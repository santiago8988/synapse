# Plantillas de Calibracion — Analisis e Implementacion

## Concepto

Una **Plantilla de Calibracion** define la estructura de pruebas que se realizan para verificar/calibrar un tipo de instrumento. Es al instrumental lo que la receta es a produccion y la matriz es a muestras.

| Dominio | Plantilla | Define | Se usa en |
|---------|-----------|--------|-----------|
| Produccion | Recipe | Ingredientes + Pasos | Batch |
| Laboratorio | Matrix | Parametros + Condiciones | Sample |
| **Metrologia** | **CalibrationTemplate** | **Pruebas + Puntos** | **Verificacion interna** |

---

## Modelo conceptual

```
CalibrationTemplate: "CALIBRACION BALANZA ANALITICA" (v1, ACTIVE)
│
├── Pruebas (CalibrationTest[]):
│   │
│   ├── Test 1: EXCENTRICIDAD
│   │   ├── descripcion: "Verificar uniformidad de carga en plato"
│   │   ├── tolerancia: 0.5 MG
│   │   ├── lecturas_por_punto: 1
│   │   ├── formula_error: "LECTURA - VALOR_PATRON"
│   │   ├── criterio: ERROR <= TOLERANCIA
│   │   └── Puntos (CalibrationPoint[]):
│   │       ├── CENTRO    — carga: 100 G
│   │       ├── FRONTAL   — carga: 100 G
│   │       ├── POSTERIOR  — carga: 100 G
│   │       ├── IZQUIERDA — carga: 100 G
│   │       └── DERECHA   — carga: 100 G
│   │
│   ├── Test 2: REPETIBILIDAD
│   │   ├── descripcion: "Evaluar dispersion de lecturas repetidas"
│   │   ├── tolerancia: 0.3 MG
│   │   ├── lecturas_por_punto: 10
│   │   ├── formula_error: "DESV_ESTANDAR"
│   │   ├── criterio: DESV_ESTANDAR <= TOLERANCIA
│   │   └── Puntos:
│   │       └── 50% CAPACIDAD — carga: 100 G
│   │
│   └── Test 3: LINEALIDAD
│       ├── descripcion: "Verificar respuesta en todo el rango"
│       ├── tolerancia: 1 MG
│       ├── lecturas_por_punto: 3
│       ├── formula_error: "PROMEDIO - VALOR_PATRON"
│       ├── criterio: ERROR <= TOLERANCIA
│       └── Puntos:
│           ├── 0 G
│           ├── 50 G
│           ├── 100 G
│           ├── 150 G
│           └── 200 G
│
└── Metadata:
    ├── unidad_principal: G (gramos)
    ├── unidad_tolerancia: MG (miligramos)
    └── notas: "Segun procedimiento P-MET-003"
```

### Ejemplo: Termometro

```
CalibrationTemplate: "VERIFICACION TERMOMETRO"
│
└── Pruebas:
    └── Test 1: VERIFICACION DE PUNTO
        ├── descripcion: "Comparar lectura del termometro contra patron"
        ├── tolerancia: (definida al ejecutar, segun resolucion)
        ├── lecturas_por_punto: 3
        ├── formula_error: "PROMEDIO_LECTURAS - VALOR_PATRON"
        ├── criterio: |ERROR| <= TOLERANCIA
        └── Puntos:
            └── (definidos al ejecutar, segun patron disponible)
```

### Ejemplo: Pipeta

```
CalibrationTemplate: "VERIFICACION PIPETA AUTOMATICA"
│
└── Pruebas:
    ├── Test 1: EXACTITUD Y PRECISION AL 10% NOMINAL
    │   ├── tolerancia_exactitud: 2.5%
    │   ├── tolerancia_precision: 1.5%
    │   ├── lecturas_por_punto: 10
    │   ├── formula: "ERROR_SISTEMATICO = ((PROMEDIO - NOMINAL) / NOMINAL) * 100"
    │   ├── formula: "CV = (DESV_ESTANDAR / PROMEDIO) * 100"
    │   └── Puntos:
    │       └── 10% VOLUMEN NOMINAL
    │
    ├── Test 2: EXACTITUD Y PRECISION AL 50% NOMINAL
    │   └── ... (misma estructura)
    │
    └── Test 3: EXACTITUD Y PRECISION AL 100% NOMINAL
        └── ... (misma estructura)
```

---

## Modelo de datos (Prisma)

```prisma
model CalibrationTemplate {
  id             String       @id @default(cuid())
  organizationId String
  name           String
  code           String?
  description    String?
  version        Int          @default(1)
  status         RecordStatus @default(DRAFT)
  isActive       Boolean      @default(true)
  unitMain       String?          // unidad principal (G, ML, °C)
  unitTolerance  String?          // unidad de tolerancia (MG, UL, °C)
  createdById    String
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  organization Organization         @relation(fields: [organizationId], references: [id])
  tests        CalibrationTest[]
  calibrations Calibration[]         // ejecuciones de esta plantilla

  @@index([organizationId])
}

model CalibrationTest {
  id          String  @id @default(cuid())
  templateId  String
  name        String                 // "EXCENTRICIDAD", "REPETIBILIDAD"
  description String?
  order       Int
  tolerance   Float?                 // tolerancia de esta prueba
  toleranceUnit String?              // unidad de la tolerancia
  readingsPerPoint Int @default(3)   // cuantas lecturas por punto
  formulaError String?               // formula para calcular error
  criteriaOperator String?           // LTE, GTE, EQ, BETWEEN
  notes       String?

  template CalibrationTemplate      @relation(fields: [templateId], references: [id], onDelete: Cascade)
  points   CalibrationPoint[]

  @@index([templateId])
}

model CalibrationPoint {
  id     String  @id @default(cuid())
  testId String
  name   String              // "CENTRO", "FRONTAL", "50 G", "25 °C"
  order  Int
  load   Float?              // carga/valor de referencia
  unit   String?             // unidad de la carga

  test CalibrationTest @relation(fields: [testId], references: [id], onDelete: Cascade)

  @@index([testId])
}
```

### Entidad de ejecucion: Calibration

```prisma
model Calibration {
  id             String   @id @default(cuid())
  organizationId String
  templateId     String
  instrumentId   String           // instrumento que se calibra (entry de reg. instrumental)
  patternId      String?          // patron usado (entry de reg. patrones)
  entryId        String   @unique // 1:1 con Entry del registro de calibraciones
  status         CalibrationStatus @default(IN_PROGRESS)
  results        Json?            // resultados: { testId: { pointId: { readings: [1,2,3], avg, error, passed } } }
  startedAt      DateTime @default(now())
  completedAt    DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization Organization        @relation(fields: [organizationId], references: [id])
  template     CalibrationTemplate  @relation(fields: [templateId], references: [id])
  entry        Entry                @relation(fields: [entryId], references: [id])

  @@index([organizationId])
  @@index([templateId])
}

enum CalibrationStatus {
  IN_PROGRESS
  COMPLETED
  APPROVED
  REJECTED
}
```

---

## Nuevo FieldType: CALIBRATION_TEMPLATE

Siguiendo el patron de RECIPE_SELECT y MATRIX_METHOD:

- Se agrega al enum `FieldType`
- Se renderiza como un select de plantillas de calibracion activas
- Valor en `entry.data[fieldId]`: ID de la plantilla seleccionada
- Solo CALIBRATION_TEMPLATE se puede mapear a CALIBRATION_TEMPLATE en acciones

---

## Nuevo RecordType: CALIBRATION (opcional)

Podria ser un nuevo tipo de registro con seguimiento, o simplemente usar NOT_PERIODIC con el campo CALIBRATION_TEMPLATE y crear la entidad Calibration como companion.

**Recomendacion**: Nuevo tipo CALIBRATION con companion entity, similar a BATCH/SAMPLE.

Labels obligatorios:
- CODIGO (identificador)
- PLANTILLA (tipo CALIBRATION_TEMPLATE)

---

## Flujo de uso

### 1. Configuracion (una vez)

```
1. Crear plantilla "CALIBRACION BALANZA ANALITICA"
   - Prueba EXCENTRICIDAD: 5 puntos, 1 lectura, tol 0.5 MG
   - Prueba REPETIBILIDAD: 1 punto, 10 lecturas, tol 0.3 MG
   - Prueba LINEALIDAD: 5 puntos, 3 lecturas, tol 1 MG
2. Aprobar plantilla
3. Crear registro tipo CALIBRATION "CALIBRACIONES INTERNAS"
   - CODIGO (TEXT, identificador)
   - INSTRUMENTO (RELATED_ENTRY → registro de balanzas)
   - PATRON (RELATED_ENTRY → registro de patrones)
   - PLANTILLA (CALIBRATION_TEMPLATE)
4. Aprobar registro
```

### 2. Ejecucion (cada vez que se calibra)

```
1. Crear entrada en "CALIBRACIONES INTERNAS"
   - CODIGO: CAL-BAL-2026-001
   - INSTRUMENTO: BAL-003 (de registro Balanzas)
   - PATRON: PAT-M-001 (de registro Patrones)
   - PLANTILLA: CALIBRACION BALANZA ANALITICA
2. Se crea entidad Calibration en estado IN_PROGRESS
3. Ir a /calibrations/[id] → formulario dinamico:
   
   ┌─────────────────────────────────────────────┐
   │ Calibracion CAL-BAL-2026-001                │
   │ Instrumento: BAL-003 | Patron: PAT-M-001   │
   │ Plantilla: Calibracion Balanza Analitica v1 │
   ├─────────────────────────────────────────────┤
   │                                             │
   │ PRUEBA 1: EXCENTRICIDAD (tol: 0.5 MG)      │
   │ ┌───────────┬────────┬────────┬──────────┐  │
   │ │ Punto     │ Patron │ Lectura│ Error    │  │
   │ ├───────────┼────────┼────────┼──────────┤  │
   │ │ CENTRO    │ 100.000│[      ]│ = calc   │  │
   │ │ FRONTAL   │ 100.000│[      ]│ = calc   │  │
   │ │ POSTERIOR │ 100.000│[      ]│ = calc   │  │
   │ │ IZQUIERDA │ 100.000│[      ]│ = calc   │  │
   │ │ DERECHA   │ 100.000│[      ]│ = calc   │  │
   │ └───────────┴────────┴────────┴──────────┘  │
   │ Resultado: [CUMPLE] / [NO CUMPLE]           │
   │                                             │
   │ PRUEBA 2: REPETIBILIDAD (tol: 0.3 MG)      │
   │ ┌───────────────────────────────────────┐   │
   │ │ Punto: 50% CAP (100 G)               │   │
   │ │ L1:[  ] L2:[  ] L3:[  ] L4:[  ]      │   │
   │ │ L5:[  ] L6:[  ] L7:[  ] L8:[  ]      │   │
   │ │ L9:[  ] L10:[ ]                       │   │
   │ │ Promedio: = calc  Desv.Est: = calc    │   │
   │ └───────────────────────────────────────┘   │
   │ Resultado: [CUMPLE] / [NO CUMPLE]           │
   │                                             │
   │ PRUEBA 3: LINEALIDAD (tol: 1 MG)           │
   │ ┌───────────┬────────┬──────────────────┐   │
   │ │ Punto     │ Patron │ L1   L2   L3  Avg│  │
   │ ├───────────┼────────┼──────────────────┤   │
   │ │ 0 G       │ 0.000  │ [  ] [  ] [  ] = │  │
   │ │ 50 G      │ 50.000 │ [  ] [  ] [  ] = │  │
   │ │ 100 G     │ 100.000│ [  ] [  ] [  ] = │  │
   │ │ 150 G     │ 150.000│ [  ] [  ] [  ] = │  │
   │ │ 200 G     │ 200.000│ [  ] [  ] [  ] = │  │
   │ └───────────┴────────┴──────────────────┘   │
   │ Resultado: [CUMPLE] / [NO CUMPLE]           │
   │                                             │
   │ RESULTADO GENERAL: [CUMPLE] / [NO CUMPLE]   │
   │                                             │
   │ [Guardar] [Completar calibracion]           │
   └─────────────────────────────────────────────┘

4. Al completar:
   - Si CUMPLE: instrumento se confirma ACTIVE
   - Si NO CUMPLE: se puede crear NC automatica
   - La entry se completa
   - Se registra la fecha como ultima calibracion
```

### 3. Trazabilidad

```
Instrumento BAL-003
├── Calibracion CAL-BAL-2026-001 (15/01/2026) → CUMPLE
│   └── Patron: PAT-M-001 (cert. vigente)
├── Calibracion CAL-BAL-2026-002 (15/07/2026) → CUMPLE
│   └── Patron: PAT-M-001 (cert. vigente)
└── Proxima calibracion: 15/01/2027
```

---

## Pagina /calibrations

Similar a /batches y /samples:

### Lista
- Filtro por estado (EN PROGRESO, COMPLETADA, APROBADA)
- Busqueda por codigo, instrumento, plantilla
- Badge de estado
- Click para ir al detalle

### Detalle /calibrations/[id]
- Header: codigo, instrumento, patron, plantilla, estado
- Columna principal: formulario dinamico de pruebas (renderizado desde la plantilla)
- Sidebar: info, acciones (completar, aprobar, rechazar)
- Resultados con indicadores CUMPLE/NO CUMPLE por prueba y general

---

## Pagina /calibration-templates

Similar a /recipes y /matrices:

### Lista
- Nombre, codigo, version, estado, cantidad de calibraciones
- Click para ver detalle en dialog

### Detalle (dialog)
- Pruebas con sus puntos en tabla
- Tolerancias y formulas
- Acciones: editar, enviar a revision, eliminar

### Formulario de creacion/edicion
- Nombre, codigo, descripcion
- Unidad principal y de tolerancia
- Pruebas (agregar/quitar):
  - Nombre, descripcion, tolerancia, lecturas por punto
  - Puntos (agregar/quitar): nombre, carga, unidad
- Versionado igual que recetas/matrices

---

## Sidebar

Agregar en la seccion "Configuracion":
```
Configuracion
  Recetas
  Matrices
  Metodos
  Plantillas de calibracion   ← NUEVO
```

Agregar en la seccion "Seguimiento":
```
Seguimiento
  Lotes
  Muestras
  Instrumental
  Calibraciones               ← NUEVO
  Stock
```

---

## Relacion con Instrumental

Actualmente los instrumentos tienen calibracion externa con periodicidad. Las plantillas de calibracion agregan la calibracion INTERNA:

- **Calibracion externa**: definida por la periodicidad del registro instrumental (cada N dias). Es un recordatorio, no un formulario.
- **Calibracion interna**: definida por la plantilla. Es un formulario dinamico con pruebas, puntos y lecturas.

Ambas coexisten. La plantilla se elige al crear la calibracion, no al crear el instrumento.

---

## Orden de implementacion

### Fase 1 — Schema y migracion
1. Crear modelos: CalibrationTemplate, CalibrationTest, CalibrationPoint, Calibration
2. Agregar CALIBRATION a RecordType
3. Agregar CALIBRATION_TEMPLATE a FieldType
4. Agregar CalibrationStatus enum
5. Agregar relacion en Entry (calibration companion)

### Fase 2 — Backend plantillas
6. Modulo CalibrationTemplates: CRUD con pruebas y puntos
7. Circuito de aprobacion para plantillas
8. Versionado (igual que recetas/matrices)

### Fase 3 — Backend calibraciones
9. Modulo Calibrations: crear, guardar resultados, completar
10. entries.service: crear Calibration companion para tipo CALIBRATION
11. record-action.listener: crear companion en cascada
12. Logica de evaluacion: calcular error, promedio, desv. estandar por prueba
13. Resultado general: CUMPLE si todas las pruebas cumplen

### Fase 4 — Frontend plantillas
14. Pagina /calibration-templates: lista, dialog detalle, formulario
15. Sidebar: agregar link

### Fase 5 — Frontend calibraciones
16. Pagina /calibrations: lista con filtros
17. Pagina /calibrations/[id]: formulario dinamico de pruebas
18. Renderizado de grilla por prueba con inputs de lecturas
19. Calculos automaticos (promedio, error, desv. estandar)
20. Indicadores CUMPLE/NO CUMPLE
21. Sidebar: agregar link

### Fase 6 — Integracion
22. records/new: auto-campos para tipo CALIBRATION
23. records/[id]: renderizar CALIBRATION_TEMPLATE en entry form
24. Validacion de labels obligatorios: CODIGO, PLANTILLA
25. Tooltip en tabla de entries con info de la plantilla
