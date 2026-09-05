# Registros

## Qué es un registro

Un registro es una **plantilla** que define que datos se van a recopilar. Es el equivalente digital de una planilla de laboratorio, un formulario de control de calidad o una hoja de producción. Cada registro tiene campos personalizables y genera **entradas** (instancias con datos reales).

```
Registro "Control de pH - Agua Potable"     <-- Plantilla (se crea una vez)
+-- Campo: Punto de muestreo (TEXT)
+-- Campo: pH medido (COMPARISON, entre 6.5 y 8.5)
+-- Campo: Temperatura (QUANTITY, unidad: C)
+-- Campo: Equipo utilizado (RELATED_ENTRY)
+-- Entradas                                 <-- Datos (se crean muchas veces)
    +-- Entrada 1: PLANTA NORTE, pH 7.2, 22.5 C, PH-001 -- PASA
    +-- Entrada 2: POZO SUR, pH 8.9, 24.1 C, PH-002 -- FUERA DE RANGO
    +-- Entrada 3: RESERVORIO ESTE, pH 7.0, 21.8 C, PH-001 -- PASA
```

## Tipos de registro

| Tipo | Clave | Seguimiento | Caso de uso |
|------|-------|-------------|-------------|
| **No periódico** | `NOT_PERIODIC` | No | Registros puntuales, checklist de verificación, inspecciones |
| **Periódico** | `PERIODIC` | No | Control diario de temperatura, limpieza semanal, verificación de balanzas |
| **Con revisión** | `NOT_PERIODIC_WITH_REVISION` | No | Contratos, certificados, documentos con fecha de vencimiento |
| **Instrumental** | `INSTRUMENTAL` | Si -- crea Instrumento | Alta de balanzas, pHmetros, cromatógrafos, autoclaves |
| **Lote/Producción** | `BATCH` | Si -- crea Batch | Producción de fertilizantes, soluciones buffer, mezclas de concreto |
| **Muestra** | `SAMPLE` | Si -- crea Sample | Recepción de muestras de agua, suelo, alimentos, materiales |
| **Stock** | `STOCK` | Si -- crea StockMovement | Ingresos y egresos de reactivos, materias primas, insumos |

### Registros con seguimiento ("Con seguimiento")

Los tipos INSTRUMENTAL, BATCH, SAMPLE y STOCK son especiales: al crear una entrada, el sistema crea automáticamente una **entidad compañera** vinculada (Instrument, Batch, Sample o StockMovement). Estas entidades tienen su propio ciclo de vida y página de gestión.

Para que el sistema pueda crear correctamente la entidad compañera, el registro debe incluir campos con **labels específicos obligatorios**. El sistema valida la existencia de estos campos antes de aprobar el registro.

#### Labels requeridos por tipo

| Tipo | Labels requeridos | Tipo de campo recomendado |
|------|-------------------|---------------------------|
| **INSTRUMENTAL** | `CODIGO` | TEXT (identificador) |
| **BATCH** | `LOTE` | TEXT (identificador) |
| **SAMPLE** | `CODIGO MUESTRA` | TEXT (identificador) |
| **SAMPLE** | `MATRIZ Y METODOS` | MATRIX_METHOD (obligatorio) |
| **STOCK** | `LOTE` | TEXT |
| **STOCK** | `PRODUCTO` | TEXT |
| **STOCK** | `TIPO MOVIMIENTO` | DROPDOWN (opciones: INGRESO, EGRESO, AJUSTE) |
| **STOCK** | `CANTIDAD` | QUANTITY |

> **Importante:** Si un registro de tipo con seguimiento no incluye todos los labels requeridos, el sistema rechazara su aprobación en el circuito de aprobación.

## Campos personalizables

Cada registro define sus propios campos. Los tipos disponibles se dividen en básicos, avanzados y especiales.

### Tipos básicos

| Tipo | Descripción | Ejemplo |
|------|-------------|---------|
| **NUMBER** | Valor numérico | Concentración: 15.3 |
| **TEXT** | Texto libre (se almacena en MAYÚSCULAS) | Observaciones: "SIN ANOMALÍAS" |
| **DATE** | Selector de fecha | Fecha de muestreo: 2026-04-01 |
| **DROPDOWN** | Selector de opciones predefinidas | Estado del envase: INTEGRO / DAÑADO / ABIERTO |
| **QUANTITY** | Valor numérico + unidad de medida configurable | Peso neto: 10.5 kg |

### Tipos avanzados

| Tipo | Descripción | Ejemplo |
|------|-------------|---------|
| **COMPARISON** | Valor numérico con validación automática contra límites | pH medido: 7.2 (debe estar entre 6.5 y 8.5) -- PASA |
| **FÓRMULA** | Cálculo automático basado en otros campos | Error (%) = ((Medido - Referencia) / Referencia) * 100 |
| **RELATED_ENTRY** | Referencia a una entrada de otro registro | Equipo utilizado: BAL-001 (del registro de balanzas) |
| **MULTIPLE_RELATED_ENTRY** | Múltiples referencias a entradas de otro registro | Ensayos vinculados: pH, Turbidez, Cloro libre |

### Tipos especiales (para registros con seguimiento)

| Tipo | Descripción | Aplica a |
|------|-------------|----------|
| **MATRIX_METHOD** | Selector de matriz y métodos analíticos | SAMPLE -- permite seleccionar la matriz de ensayo y los métodos aplicables por muestra |
| **RECIPE_SELECT** | Selector de receta/producto activo | BATCH -- permite seleccionar que receta se va a producir por cada entrada |

### Propiedades de cada campo

| Propiedad | Descripción |
|-----------|-------------|
| **label** | Nombre del campo visible al usuario. Los labels de campos con seguimiento deben coincidir exactamente con los requeridos. |
| **fieldType** | Tipo de dato (ver tablas anteriores) |
| **order** | Posición del campo en el formulario |
| **isIdentifier** | Si es identificador, no se puede modificar una vez completada la entrada |
| **isRequired** | Si es obligatorio al crear la entrada |
| **isActive** | Si esta activo en la versión actual |
| **relatedRecordId** | Para RELATED_ENTRY y MULTIPLE_RELATED_ENTRY: registro de referencia |
| **relatedFieldIds** | Para RELATED_ENTRY: campos específicos a mostrar del registro relacionado |
| **comparisonConfig** | Para COMPARISON: operador y valores límite (JSON) |
| **formulaConfig** | Para FÓRMULA: expresión y campos referenciados (JSON) |

### Configuración de COMPARISON

```json
{
  "operator": "BETWEEN",
  "value": 6.5,
  "maxValue": 8.5
}
```

Operadores disponibles: `LT` (<), `LTE` (<=), `GT` (>), `GTE` (>=), `EQ` (=), `BETWEEN` (entre dos valores).

### Configuración de DROPDOWN

Las opciones del dropdown se definen en la configuración del campo. Ejemplo para un campo "TIPO DE ENVASE":

Opciones: VIDRIO, PLÁSTICO, METAL, CARTON

### Configuración de QUANTITY

El campo QUANTITY almacena un valor numérico junto con una unidad de medida configurable. La unidad se define al crear el campo (ej: kg, g, L, mL, m3, unidades). El usuario ingresa solo el valor numérico; la unidad se muestra automáticamente.

## Versionado

Los registros tienen un sistema de versionado integrado. Al editar un registro (agregar, quitar o modificar campos):

1. Se incrementa automáticamente la **versión** (v1, v2, v3...)
2. Se pide un **motivo del cambio** (changeLog)
3. Las entradas existentes **no se modifican** -- conservan la versión con la que fueron creadas
4. Los campos eliminados se marcan como inactivos (`removedInVersion`) pero sus datos históricos se preservan

> Solo se pueden editar registros en estado **DRAFT**. Una vez aprobado (ACTIVE), hay que crear una nueva versión para modificarlo.

## Estado del registro

Los registros pasan por un circuito de aprobación antes de poder usarse:

```
DRAFT ----> IN_REVIEW ----> ACTIVE
```

- **DRAFT**: se puede editar libremente
- **IN_REVIEW**: enviado al circuito de aprobación, no se puede editar
- **ACTIVE**: aprobado, se pueden crear entradas

Para registros con seguimiento, el sistema valida que todos los **labels requeridos** estén presentes antes de permitir el envio a aprobación.

Ver [09 - Circuito de Aprobación](./09-circuito-aprobación.md).

## Acciones entre registros (RecordAction)

Un registro puede tener **acciones** que se disparan automáticamente cuando se completa una entrada. Esto permite crear flujos de trabajo encadenados.

**Ejemplo:** Al completar una entrada en "Recepción de Muestras", se crea automáticamente una entrada en "Análisis Fisicoquímico" con los datos mapeados.

Las acciones requieren un **mapeo de campos** (fieldMapping): que campo del registro origen corresponde a que campo del registro destino.

Para registros de tipo BATCH, SAMPLE y STOCK, las acciones crean la entidad compañera correspondiente en el registro destino.

## Vinculación con documentos

Al crear un registro, se puede seleccionar un **documento** como base teórica. Esto permite:

- Saber que procedimiento respalda cada registro
- Trazabilidad completa: documento --> registro --> entrada --> datos

## Propiedades adicionales del registro

| Campo | Aplica a | Descripción |
|-------|----------|-------------|
| **Periodicidad** (días) | PERIODIC, INSTRUMENTAL | Cada cuantos días se repite o se calibra |
| **Notificar días antes** | PERIODIC, NOT_PERIODIC_WITH_REVISION | Cuantos días antes del vencimiento se genera alerta |
| **Área** | Todos | Área organizacional a la que pertenece el registro |
| **Documento base** | Todos | Documento de referencia asociado |
| **isSystem** | Todos | Indica si es un registro de sistema (no editable por el usuario) |

## Permisos

| Acción | Roles permitidos |
|--------|-----------------|
| Ver registros | Todos (filtrado por área) |
| Crear/editar registros | ADMIN, QUALITY_MANAGER |
| Archivar/restaurar | ADMIN, QUALITY_MANAGER |
| Crear entradas | ADMIN, QUALITY_MANAGER, TECHNICIAN |
