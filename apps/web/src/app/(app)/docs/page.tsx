'use client'

import { useState } from 'react'
import {
  BookOpen,
  Building2,
  FileText,
  ClipboardList,
  ListChecks,
  FlaskConical,
  Package,
  TestTube2,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  Warehouse,
  Microscope,
  Scale,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

// ─── Contenido de documentación ─────────────

const sections = [
  {
    id: 'conceptos',
    label: 'Conceptos Generales',
    icon: Building2,
    content: `
## Que es QualitTab

QualitTab es un sistema de gestion de calidad para laboratorios, plantas industriales y organizaciones que operan bajo normas ISO (especialmente ISO 17025 e ISO 9001). Centraliza documentos controlados, registros, instrumental, muestras, lotes de produccion, stock de insumos, matrices de ensayo y no conformidades.

## Estructura del sistema

- **Organizacion** — Espacio aislado (multitenant) con logo, areas, usuarios y configuracion propia
- **Areas** — Jerarquicas (ej: Laboratorio Central > Fisicoquimica > Cromatografia). Cada area puede tener un jefe asignado
- **Usuarios** — Invitados por email (whitelist) con rol y puesto asignado
- **Puestos** — Configurables por organizacion (ej: Analista Quimico, Jefe de Planta, Director Tecnico)

## Roles de usuario

| Rol | Permisos |
|-----|----------|
| **ADMIN** | Control total. Gestiona usuarios, areas, puestos, configuracion. Sin restriccion de area. |
| **QUALITY_MANAGER** | Crea registros, documentos, recetas, matrices. Gestiona no conformidades. Acceso a su area y sub-areas. |
| **TECHNICIAN** | Carga datos en entradas, opera lotes, registra muestras y movimientos de stock. Acceso a su area. |
| **AUDITOR** | Solo lectura. Accede a toda la organizacion para auditorias. |

## Texto en MAYUSCULAS

Todos los valores de texto ingresados se almacenan automaticamente en **MAYUSCULAS**. Esto garantiza consistencia de datos, facilita busquedas y evita duplicados por diferencias de capitalizacion (ej: "Agua Potable" se guarda como "AGUA POTABLE").

## Capacitaciones

Cada usuario puede tener capacitaciones registradas con fecha de realizacion, vencimiento, certificado adjunto y estado automatico (**Vigente**, **Por vencer**, **Vencida**). El dashboard alerta sobre capacitaciones proximas a vencer.

## Registro de auditoria

Todas las acciones relevantes quedan registradas en el **Audit Log** con usuario, tipo de accion, estado anterior/posterior, IP y fecha/hora. Esto garantiza la trazabilidad requerida por ISO 17025.

## Acceso al sistema

1. Un ADMIN agrega el email del usuario a la **whitelist** con un rol
2. El usuario ingresa con su cuenta de Google (OAuth)
3. Se crea automaticamente su perfil en la organizacion
4. El ADMIN completa su perfil: puesto, area, telefono, firma
    `,
  },
  {
    id: 'documentos',
    label: 'Documentos',
    icon: FileText,
    content: `
## Gestion documental

Un documento representa un **documento controlado** del sistema de calidad: procedimientos (POE), manuales, instructivos, politicas, especificaciones tecnicas. Tiene titulo, codigo opcional, version automatica, estado y archivo PDF adjunto.

## Ciclo de vida

\`\`\`
DRAFT → IN_REVIEW → ACTIVE → SUPERSEDED (al crear nueva version)
\`\`\`

- **DRAFT**: editable libremente
- **IN_REVIEW**: enviado al circuito de aprobacion, no editable
- **ACTIVE**: aprobado y publicado, inmutable
- **SUPERSEDED**: reemplazado por nueva version, conservado para trazabilidad

## Operaciones

- **Crear**: titulo + codigo opcional → estado DRAFT
- **Adjuntar archivo**: subir PDF (una vez por version; para cambiar, crear nueva version)
- **Enviar a aprobacion**: pasa al circuito revision → aprobacion
- **Nueva version**: crea copia en DRAFT con version incrementada (ej: 2.0), la anterior pasa a SUPERSEDED

## Vinculacion con registros

Un documento puede ser la base teorica de uno o mas registros, permitiendo trazabilidad procedimiento → registro → datos.

\`\`\`
POE-LAB-001 "Determinacion de pH en aguas"
  +-- Registro "Control de pH - Agua Potable"
  |     +-- Entrada 2026-04-01: pH 7.2 -- PASA
  +-- Registro "Control de pH - Efluentes"
        +-- Entrada 2026-04-01: pH 8.1 -- PASA
\`\`\`
    `,
  },
  {
    id: 'registros',
    label: 'Registros',
    icon: ClipboardList,
    content: `
## Que es un registro

Un registro es una **plantilla** que define que datos se recopilan. Es el equivalente digital de una planilla de laboratorio. Genera **entradas** con datos reales.

## Tipos de registro

| Tipo | Comportamiento |
|------|---------------|
| **No periodico** | Se crean y completan al instante |
| **Periodico** | Al completar, se crea la siguiente con fecha de vencimiento |
| **Con revision** | Fecha de revision obligatoria con alerta N dias antes |
| **Instrumental** | Cada entrada crea un equipo con control de calibracion |
| **Lote/Produccion** | Cada entrada crea un lote con ciclo de vida |
| **Muestra** | Cada entrada crea una muestra con seguimiento |
| **Stock** | Cada entrada crea un movimiento de inventario |

## Labels requeridos por tipo

Los registros con seguimiento requieren campos con labels especificos. Sin ellos, el sistema rechaza la aprobacion.

| Tipo | Labels obligatorios |
|------|---------------------|
| **INSTRUMENTAL** | CODIGO |
| **BATCH** | LOTE |
| **SAMPLE** | CODIGO MUESTRA, MATRIZ Y METODOS (tipo MATRIX_METHOD) |
| **STOCK** | LOTE, PRODUCTO, TIPO MOVIMIENTO (DROPDOWN), CANTIDAD (QUANTITY) |

## Campos personalizables

| Tipo | Descripcion |
|------|-------------|
| **NUMBER** | Valor numerico |
| **TEXT** | Texto libre (se almacena en MAYUSCULAS) |
| **DATE** | Selector de fecha |
| **DROPDOWN** | Selector de opciones predefinidas (ej: VIDRIO, PLASTICO, METAL) |
| **QUANTITY** | Valor numerico + unidad de medida configurable (ej: 10.5 kg) |
| **COMPARISON** | Valor con validacion automatica contra limites |
| **FORMULA** | Calculo basado en otros campos |
| **RELATED_ENTRY** | Referencia a entrada de otro registro |
| **MULTIPLE_RELATED_ENTRY** | Multiples referencias |
| **MATRIX_METHOD** | Selector de matriz y metodos analiticos (solo SAMPLE) |
| **RECIPE_SELECT** | Selector de receta/producto activo (solo BATCH) |

## Versionado

Al editar un registro se incrementa la version y se pide un motivo del cambio. Las entradas existentes conservan su version original. Los campos eliminados se marcan como inactivos pero sus datos historicos se preservan.

## Estado

\`\`\`
DRAFT → IN_REVIEW → ACTIVE
\`\`\`

Solo los registros ACTIVE permiten crear entradas. Para registros con seguimiento, el sistema valida que todos los labels requeridos esten presentes antes de permitir la aprobacion.
    `,
  },
  {
    id: 'entradas',
    label: 'Entradas',
    icon: ListChecks,
    content: `
## Que es una entrada

Una entrada es una **instancia de datos** de un registro. Si el registro es la plantilla, la entrada son los datos concretos. Todos los textos se almacenan en **MAYUSCULAS**.

## Comportamiento segun tipo

| Tipo de registro | Al crear entrada |
|-----------------|------------------|
| No periodico / Con revision | Se completa automaticamente |
| Periodico | Queda en DRAFT, al completar se crea la siguiente |
| Instrumental | Se completa + crea Instrumento vinculado |
| Lote | Queda en DRAFT + crea Batch en PLANNED. Se completa cuando el Batch llega a COMPLETED |
| Muestra | Queda en DRAFT + crea Sample en RECEIVED. Se completa cuando la Sample llega a COMPLETED |
| Stock | Se completa automaticamente + crea StockMovement |

## Campos especiales

**COMPARISON**: evalua automaticamente si un valor cumple un criterio. Operadores: LT (<), LTE (<=), GT (>), GTE (>=), EQ (=), BETWEEN. Si falla, puede crear una No Conformidad automatica.

**FORMULA**: calcula valores a partir de otros campos. Ejemplo:
\`\`\`
Error (%) = ((VALOR MEDIDO - VALOR REFERENCIA) / VALOR REFERENCIA) * 100
\`\`\`

**DROPDOWN**: lista de opciones predefinidas. Solo se puede seleccionar una opcion (ej: INGRESO, EGRESO, AJUSTE).

**QUANTITY**: valor numerico + unidad configurada. El operador ingresa el numero; la unidad se muestra automaticamente (ej: 25.5 kg).

**MATRIX_METHOD**: selector de matriz de ensayo y metodos analiticos por muestra. Exclusivo para registros tipo SAMPLE.

**RECIPE_SELECT**: selector de receta activa para el lote. Exclusivo para registros tipo BATCH.

**RELATED_ENTRY**: vincula con otra entrada. Si referencia un instrumento, valida que este ACTIVO.

## Acciones automaticas

Al crear/completar una entrada:
- Evaluacion de comparaciones → No Conformidades automaticas
- RecordActions: crea entradas en otros registros con datos mapeados (cascading)
- Creacion de siguiente entrada periodica
- Creacion de entidad companera (Instrument / Batch / Sample / StockMovement)
    `,
  },
  {
    id: 'recetas',
    label: 'Recetas',
    icon: FlaskConical,
    content: `
## Formulas de produccion

Una receta define los **ingredientes** (BOM) y los **pasos del proceso** para fabricar un producto. Se vincula con el inventario de stock y tiene versionado con trazabilidad.

## Estructura

\`\`\`
Receta: "FERTILIZANTE NPK 15-15-15" (FER-001) v1
+-- Ingredientes (BOM)
|   +-- NITRATO DE AMONIO -- 150 kg [desde stock]
|   +-- SUPERFOSFATO TRIPLE -- 150 kg [desde stock]
|   +-- CLORURO DE POTASIO -- 150 kg [desde stock]
|   +-- MATERIAL DE RELLENO -- 550 kg
+-- Pasos del proceso
    +-- 1. PESAJE (15 min) -- Control: verificar calibracion
    +-- 2. MEZCLADO (30 min) -- Control: homogeneidad visual
    +-- 3. GRANULADO (45 min) -- Control: tamano 2-4 mm
    +-- 4. SECADO (60 min) -- Control: humedad < 2%
    +-- 5. ENVASADO (20 min) -- Control: peso neto y sellado
\`\`\`

## Ingredientes vinculados a stock

Cuando un ingrediente tiene \`fromStock = true\`, se vincula con un producto del inventario. Al iniciar produccion de un lote, el operador debe seleccionar los lotes y cantidades de stock a consumir para cada ingrediente vinculado. Esto permite trazabilidad completa de materias primas.

## Versionado

- **Receta en DRAFT**: se edita in-place, sin crear nueva version
- **Receta ACTIVE**: al editarla se crea una nueva version (v2, v3...) en DRAFT. La anterior se desactiva. Los lotes existentes conservan la referencia a la version original

\`\`\`
FER-001 v1 (ACTIVE) → Se edita → FER-001 v1 (isActive=false)
                                   FER-001 v2 (DRAFT) → Aprobacion → ACTIVE
\`\`\`

## Uso en produccion

La receta se selecciona **por cada entrada** de un registro tipo BATCH mediante un campo **RECIPE_SELECT**. Un mismo registro puede trabajar con diferentes recetas. Solo se muestran recetas en estado ACTIVE.

## Codigo obligatorio

El codigo (SKU) es **obligatorio** y unico por organizacion. Funciona como identificador del producto.
    `,
  },
  {
    id: 'lotes',
    label: 'Lotes',
    icon: Package,
    content: `
## Produccion por lotes

Un lote representa una corrida de produccion. Se crea automaticamente al crear una entrada en un registro tipo BATCH.

## Ciclo de vida

\`\`\`
PLANNED → IN_PROGRESS → COMPLETED → APPROVED / REJECTED
\`\`\`

| Estado | Significado |
|--------|-------------|
| **PLANNED** | Planificado, no inicio |
| **IN_PROGRESS** | Produccion en curso |
| **COMPLETED** | Terminado, pendiente de aprobacion. La entrada se completa automaticamente |
| **APPROVED** | Aprobado para liberacion |
| **REJECTED** | Rechazado (puede reiniciarse a PLANNED) |

## Consumo de stock al iniciar

Cuando la receta tiene ingredientes \`fromStock\`, al pasar de PLANNED a IN_PROGRESS:

1. El sistema muestra los ingredientes vinculados a stock
2. El operador selecciona los lotes de stock disponibles
3. Indica la cantidad a consumir de cada lote
4. El sistema registra los egresos de stock (StockMovements de tipo EGRESO)
5. El lote pasa a IN_PROGRESS

## Trazabilidad

\`\`\`
Stock (materias primas consumidas)
  +-- Lote STCK-2026-001: NITRATO DE AMONIO (150 kg)
       |
Lote LOT-2026-015 (FERTILIZANTE NPK 15-15-15)
  +-- Receta: FER-001 v2
  +-- Muestra M-2026-042 (Control de calidad)
       +-- N 15.1%, P 14.8%, K 15.2% → PASA
       → Lote APPROVED
\`\`\`

La trazabilidad se logra con campos RELATED_ENTRY, consumo de stock y la receta vinculada.
    `,
  },
  {
    id: 'muestras',
    label: 'Muestras',
    icon: TestTube2,
    content: `
## Muestras de laboratorio

Una muestra representa un especimen recibido para analisis. Se crea al crear una entrada en un registro tipo SAMPLE.

## Campos obligatorios

- **CODIGO MUESTRA** (TEXT, identificador): ej: M-2026-001
- **MATRIZ Y METODOS** (MATRIX_METHOD): seleccion de la matriz de ensayo y los metodos analiticos a aplicar

## Seleccion de matriz y metodos

El campo MATRIX_METHOD permite seleccionar por cada muestra:

1. La **matriz** de ensayo (ej: AGUA POTABLE, SUELO AGRICOLA, EFLUENTE INDUSTRIAL)
2. Los **metodos analiticos**: todos los de la matriz o solo algunos individuales

Los parametros efectivos se determinan segun la seleccion de metodos.

## Ciclo de vida

\`\`\`
RECEIVED → IN_TESTING → COMPLETED
\`\`\`

Cuando la muestra pasa a COMPLETED, la entrada asociada se completa automaticamente.

## Pagina de detalle

La pagina de detalle de cada muestra muestra tres secciones:

1. **Condiciones de muestreo**: campos dinamicos definidos en la matriz (ej: punto de muestreo, temperatura in situ, caudal)
2. **Resultados analiticos**: parametros efectivos con campos para cargar resultados y evaluacion automatica contra limites
3. **Informacion general**: codigo, cliente, matriz, metodos, estado, fechas

## Vinculacion con lotes

Si la muestra proviene de un lote de produccion, se vincula via campos RELATED_ENTRY para trazabilidad completa desde producto terminado hasta materias primas.
    `,
  },
  {
    id: 'instrumental',
    label: 'Instrumental',
    icon: Wrench,
    content: `
## Gestion de equipos

El modulo instrumental gestiona equipos de medicion: balanzas analiticas, pHmetros, cromatografos, espectrofotometros, autoclaves, pipetas, termometros calibrados, etc. Cada instrumento tiene estado operativo, fecha de proxima calibracion e historial completo de estados.

## Creacion

Se crea automaticamente al crear una entrada en un registro tipo INSTRUMENTAL. El registro debe incluir un campo con label exacto **"CODIGO"** (identificador). Se configura la periodicidad de calibracion (ej: 365 dias).

## Estados

| Estado | Significado |
|--------|-------------|
| **ACTIVE** | Disponible para mediciones. Estado inicial |
| **IN_CALIBRATION** | En calibracion, no disponible |
| **IN_REPAIR** | En reparacion, no disponible |
| **DECOMMISSIONED** | Dado de baja permanentemente |

## Calibracion

La proxima calibracion se calcula automaticamente: fecha de alta + periodicidad del registro. El dashboard alerta equipos proximos a calibrar.

## Validacion de uso

Si un registro tiene un campo RELATED_ENTRY que apunta a instrumentos, el sistema **valida automaticamente** que el instrumento este ACTIVE. No se permite usar instrumentos en calibracion, reparacion o dados de baja.

## Historial

Cada cambio de estado queda registrado con: estado anterior/posterior, motivo, quien lo cambio y fecha/hora. Trazabilidad completa para auditorias ISO.
    `,
  },
  {
    id: 'stock',
    label: 'Stock',
    icon: Warehouse,
    content: `
## Inventario de insumos

El modulo de stock gestiona el inventario de **materias primas, reactivos, insumos y materiales**. Permite registrar ingresos, egresos y ajustes con trazabilidad por producto y por lote.

## Como funciona

Se gestiona a traves de un registro tipo **STOCK**. Cada entrada crea un **StockMovement** (se auto-completa como un registro no periodico).

## Labels obligatorios del registro

| Label | Tipo de campo | Descripcion |
|-------|---------------|-------------|
| **PRODUCTO** | TEXT | Nombre del producto (ej: NITRATO DE AMONIO) |
| **LOTE** | TEXT | Numero de lote del proveedor o interno |
| **TIPO MOVIMIENTO** | DROPDOWN | Opciones: INGRESO, EGRESO, AJUSTE |
| **CANTIDAD** | QUANTITY | Valor numerico + unidad (ej: 500 kg) |

Campos opcionales: PROVEEDOR, FECHA DE VENCIMIENTO, CERTIFICADO, UBICACION, MOTIVO.

## Tipos de movimiento

| Tipo | Efecto | Ejemplo |
|------|--------|---------|
| **INGRESO** | Suma al stock | Recepcion de 500 kg de NITRATO DE AMONIO |
| **EGRESO** | Resta del stock | Consumo de 150 kg para produccion |
| **AJUSTE** | Suma o resta segun signo | Ajuste por merma: -5 kg |

## Pagina de stock

Muestra un resumen consolidado agrupado por producto con stock total y detalle por lote:

\`\`\`
ACIDO CLORHIDRICO 37% (Stock total: 18 L)
  +-- Lote PROV-2026-A001: 18 L (Ingreso 20 L, Egreso 2 L)

BIFTALATO DE POTASIO (Stock total: 4.85 kg)
  +-- Lote PROV-2026-C003: 4.85 kg (Ingreso 5 kg, Egreso 0.15 kg)
\`\`\`

## Consumo desde lotes de produccion

Cuando una receta tiene ingredientes \`fromStock\`, al iniciar produccion el operador selecciona los lotes y cantidades de stock a consumir. El sistema crea los egresos automaticamente. Esto permite trazabilidad completa desde producto terminado hasta materias primas.
    `,
  },
  {
    id: 'matrices-metodos',
    label: 'Matrices y Metodos',
    icon: Microscope,
    content: `
## Matrices de ensayo

Una matriz representa un **tipo de muestra** que el laboratorio analiza (ej: AGUA POTABLE, SUELO AGRICOLA, EFLUENTE INDUSTRIAL). Define los parametros a determinar, los metodos aplicables y las condiciones de la toma de muestra.

## Estructura de una matriz

\`\`\`
Matriz: "AGUA POTABLE" (AP-001) v1
+-- Parametros (que se analiza)
|   +-- PH -- Metodo: APHA 4500-H+ B -- Rango: 6.5 - 8.5
|   +-- TURBIDEZ -- Metodo: APHA 2130 B -- NTU -- Max: 1.0
|   +-- CLORO LIBRE -- Metodo: APHA 4500-Cl G -- mg/L -- 0.2 - 1.0
+-- Condiciones (como se tomo la muestra)
    +-- PUNTO DE MUESTREO (TEXT)
    +-- TEMPERATURA IN SITU (NUMBER, C)
    +-- ASPECTO (DROPDOWN: CLARO, TURBIO, COLOREADO)
\`\`\`

## Condiciones de muestreo

Las condiciones definen campos dinamicos que se completan en la pagina de detalle de cada muestra. Tipos disponibles: TEXT, NUMBER, DROPDOWN.

## Versionado

Funciona igual que las recetas:
- **Matriz en DRAFT**: se edita in-place
- **Matriz ACTIVE**: al editarla se crea nueva version en DRAFT. La anterior se desactiva. Las muestras existentes conservan la referencia a su version original

Las matrices pasan por el circuito de aprobacion (DRAFT → IN_REVIEW → ACTIVE).

## Metodos analiticos

Catalogo de metodos de la organizacion. Dos tipos:

| Tipo | Descripcion |
|------|-------------|
| **Globales** | Metodos normativos precargados (ej: APHA para aguas). Disponibles para todos. No editables. |
| **De organizacion** | Metodos propios creados internamente (ej: MET-INT-001). Solo visibles en la organizacion. |

Cada metodo tiene: codigo, nombre, parametro, unidad, limites por defecto y referencia fuente.

## Integracion con muestras

Al crear una muestra, el campo **MATRIX_METHOD** permite seleccionar la matriz y los metodos. En la pagina de detalle de la muestra se muestran las condiciones para completar y los parametros efectivos para cargar resultados con evaluacion automatica.
    `,
  },
  {
    id: 'aprobacion',
    label: 'Circuito de Aprobacion',
    icon: CheckCircle2,
    content: `
## Workflow ISO 17025

El circuito implementa el requisito de control documental: elaborar → revisar → aprobar.

## Roles de calidad

| Rol | Funcion |
|-----|---------|
| **REVIEWER** | Revisa contenido tecnico. Aprueba o rechaza con comentarios. |
| **APPROVER** | Visto bueno final. Actua despues del revisor. |

Estos roles son independientes del rol del usuario. Se configuran en **Configuracion > Calidad**. Solo el ADMIN puede asignarlos. Un usuario puede tener ambos roles.

## Flujo

1. Elaborador crea entidad (DRAFT)
2. Envia a revision → pasa a IN_REVIEW
3. Revisor aprueba → pasa a aprobador
4. Aprobador aprueba → pasa a ACTIVE
5. Si alguien rechaza → vuelve a DRAFT con comentarios obligatorios

## Validacion de registros

Para registros con seguimiento, el sistema valida que existan los campos con labels obligatorios antes de permitir la aprobacion:

| Tipo | Labels obligatorios |
|------|---------------------|
| **INSTRUMENTAL** | CODIGO |
| **BATCH** | LOTE |
| **SAMPLE** | CODIGO MUESTRA, MATRIZ Y METODOS |
| **STOCK** | LOTE, PRODUCTO, TIPO MOVIMIENTO, CANTIDAD |

## Aplica a

- Documentos
- Registros
- Recetas
- Matrices de ensayo

Cada decision (APPROVED/REJECTED) queda registrada con quien decidio, comentarios, fecha/hora y etapa (REVIEW o APPROVAL), proporcionando evidencia para auditorias ISO.
    `,
  },
  {
    id: 'no-conformidades',
    label: 'No Conformidades',
    icon: AlertTriangle,
    content: `
## Desvios y acciones correctivas

Una no conformidad (NC) es un desvio respecto a un requisito establecido. Se detecta automaticamente o se registra manualmente.

## Deteccion automatica

Cuando un campo COMPARISON falla, se crea una NC vinculada a la entrada y al campo que fallo:

| Registro | Campo | Valor | Criterio | Resultado |
|----------|-------|-------|----------|-----------|
| Control de pH | PH MEDIDO | 9.1 | BETWEEN 6.5 - 8.5 | NC creada |
| Verificacion de balanza | ERROR RELATIVO | 6.2% | LTE 5% | NC creada |
| Control microbiologico | COLIFORMES | 5 UFC/100mL | EQ 0 | NC creada |
| Control de temperatura | TEMP. AUTOCLAVE | 119 C | GTE 121 | NC creada |

## Ciclo de vida

\`\`\`
OPEN → IN_PROGRESS → RESOLVED → CLOSED
\`\`\`

## Acciones correctivas

Cada NC puede tener multiples acciones correctivas con:
- Descripcion de la accion
- Fecha limite
- Fecha de completado

## Flujo tipico

1. Se detecta la NC → estado: OPEN
2. Responsable de calidad define acciones correctivas con fechas limite
3. Estado pasa a IN_PROGRESS
4. Se ejecutan y completan las acciones
5. Estado pasa a RESOLVED
6. Se verifica eficacia → se cierra como CLOSED

## Dashboard

Muestra NCs abiertas, en progreso, total pendiente de cierre y acciones correctivas con fecha vencida.
    `,
  },
]

// ─── Componente principal ───────────────────

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState('conceptos')

  const current = sections.find((s) => s.id === activeSection) || sections[0]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Documentación</h1>
        <p className="mt-1 text-muted-foreground">
          Guia de uso del sistema de gestion de calidad
        </p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar de secciones */}
        <div className="w-56 shrink-0">
          <nav className="space-y-1">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  activeSection === section.id
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <section.icon className="h-4 w-4" />
                {section.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Contenido */}
        <div className="flex-1 animate-fade-in">
          <Card>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none p-6">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b">
                <current.icon className="h-6 w-6 text-primary" />
                <h1 className="text-xl font-bold m-0">{current.label}</h1>
              </div>
              <MarkdownContent content={current.content} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

// ─── Renderizador de Markdown simple ────────

function MarkdownContent({ content }: { content: string }) {
  const lines = content.trim().split('\n')
  const elements: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Heading
    if (line.startsWith('## ')) {
      elements.push(<h2 key={i} className="text-lg font-semibold mt-6 mb-3">{line.slice(3)}</h2>)
      i++
      continue
    }

    // Code block
    if (line.startsWith('```')) {
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      elements.push(
        <pre key={`code-${i}`} className="rounded-lg bg-muted p-4 text-xs overflow-x-auto font-mono">
          <code>{codeLines.join('\n')}</code>
        </pre>,
      )
      i++
      continue
    }

    // Table
    if (line.includes('|') && line.trim().startsWith('|')) {
      const tableLines: string[] = []
      while (i < lines.length && lines[i].includes('|') && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i])
        i++
      }

      if (tableLines.length >= 2) {
        const headerCells = tableLines[0].split('|').filter((c) => c.trim()).map((c) => c.trim())
        const bodyRows = tableLines.slice(2) // skip header + separator

        elements.push(
          <div key={`table-${i}`} className="my-4 overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b">
                  {headerCells.map((cell, ci) => (
                    <th key={ci} className="px-3 py-2 text-left font-semibold text-foreground">
                      {renderInline(cell)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bodyRows.map((row, ri) => {
                  const cells = row.split('|').filter((c) => c.trim()).map((c) => c.trim())
                  return (
                    <tr key={ri} className="border-b last:border-0">
                      {cells.map((cell, ci) => (
                        <td key={ci} className="px-3 py-2 text-muted-foreground">
                          {renderInline(cell)}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>,
        )
        continue
      }
    }

    // List item
    if (line.startsWith('- ')) {
      const listItems: string[] = []
      while (i < lines.length && lines[i].startsWith('- ')) {
        listItems.push(lines[i].slice(2))
        i++
      }
      elements.push(
        <ul key={`list-${i}`} className="my-2 space-y-1 list-disc pl-5">
          {listItems.map((item, li) => (
            <li key={li} className="text-sm text-muted-foreground">{renderInline(item)}</li>
          ))}
        </ul>,
      )
      continue
    }

    // Numbered list
    if (/^\d+\.\s/.test(line)) {
      const listItems: string[] = []
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        listItems.push(lines[i].replace(/^\d+\.\s/, ''))
        i++
      }
      elements.push(
        <ol key={`ol-${i}`} className="my-2 space-y-1 list-decimal pl-5">
          {listItems.map((item, li) => (
            <li key={li} className="text-sm text-muted-foreground">{renderInline(item)}</li>
          ))}
        </ol>,
      )
      continue
    }

    // Empty line
    if (line.trim() === '') {
      i++
      continue
    }

    // Paragraph
    elements.push(<p key={i} className="text-sm text-muted-foreground my-2">{renderInline(line)}</p>)
    i++
  }

  return <>{elements}</>
}

function renderInline(text: string): React.ReactNode {
  // Bold + inline code
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{part.slice(1, -1)}</code>
    }
    return part
  })
}
