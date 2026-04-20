# 03 -- Registros

## Que es un registro

Un registro es una **plantilla** que define que datos se van a recopilar. Es el equivalente digital de una planilla de laboratorio, un formulario de control de calidad o una hoja de produccion. Cada registro tiene campos personalizables y genera **entradas** (instancias con datos reales).

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
| **No periodico** | `NOT_PERIODIC` | No | Registros puntuales, checklist de verificacion, inspecciones |
| **Periodico** | `PERIODIC` | No | Control diario de temperatura, limpieza semanal, verificacion de balanzas |
| **Con revision** | `NOT_PERIODIC_WITH_REVISION` | No | Contratos, certificados, documentos con fecha de vencimiento |
| **Instrumental** | `INSTRUMENTAL` | Si -- crea Instrumento | Alta de balanzas, pHmetros, cromatografos, autoclaves |
| **Lote/Produccion** | `BATCH` | Si -- crea Batch | Produccion de fertilizantes, soluciones buffer, mezclas de concreto |
| **Muestra** | `SAMPLE` | Si -- crea Sample | Recepcion de muestras de agua, suelo, alimentos, materiales |
| **Stock** | `STOCK` | Si -- crea StockMovement | Ingresos y egresos de reactivos, materias primas, insumos |

### Registros con seguimiento ("Con seguimiento")

Los tipos INSTRUMENTAL, BATCH, SAMPLE y STOCK son especiales: al crear una entrada, el sistema crea automaticamente una **entidad companera** vinculada (Instrument, Batch, Sample o StockMovement). Estas entidades tienen su propio ciclo de vida y pagina de gestion.

Para que el sistema pueda crear correctamente la entidad companera, el registro debe incluir campos con **labels especificos obligatorios**. El sistema valida la existencia de estos campos antes de aprobar el registro.

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

> **Importante:** Si un registro de tipo con seguimiento no incluye todos los labels requeridos, el sistema rechazara su aprobacion en el circuito de aprobacion.

## Campos personalizables

Cada registro define sus propios campos. Los tipos disponibles se dividen en basicos, avanzados y especiales.

### Tipos basicos

| Tipo | Descripcion | Ejemplo |
|------|-------------|---------|
| **NUMBER** | Valor numerico | Concentracion: 15.3 |
| **TEXT** | Texto libre (se almacena en MAYUSCULAS) | Observaciones: "SIN ANOMALIAS" |
| **DATE** | Selector de fecha | Fecha de muestreo: 2026-04-01 |
| **DROPDOWN** | Selector de opciones predefinidas | Estado del envase: INTEGRO / DANADO / ABIERTO |
| **QUANTITY** | Valor numerico + unidad de medida configurable | Peso neto: 10.5 kg |

### Tipos avanzados

| Tipo | Descripcion | Ejemplo |
|------|-------------|---------|
| **COMPARISON** | Valor numerico con validacion automatica contra limites | pH medido: 7.2 (debe estar entre 6.5 y 8.5) -- PASA |
| **FORMULA** | Calculo automatico basado en otros campos | Error (%) = ((Medido - Referencia) / Referencia) * 100 |
| **RELATED_ENTRY** | Referencia a una entrada de otro registro | Equipo utilizado: BAL-001 (del registro de balanzas) |
| **MULTIPLE_RELATED_ENTRY** | Multiples referencias a entradas de otro registro | Ensayos vinculados: pH, Turbidez, Cloro libre |

### Tipos especiales (para registros con seguimiento)

| Tipo | Descripcion | Aplica a |
|------|-------------|----------|
| **MATRIX_METHOD** | Selector de matriz y metodos analiticos | SAMPLE -- permite seleccionar la matriz de ensayo y los metodos aplicables por muestra |
| **RECIPE_SELECT** | Selector de receta/producto activo | BATCH -- permite seleccionar que receta se va a producir por cada entrada |

### Propiedades de cada campo

| Propiedad | Descripcion |
|-----------|-------------|
| **label** | Nombre del campo visible al usuario. Los labels de campos con seguimiento deben coincidir exactamente con los requeridos. |
| **fieldType** | Tipo de dato (ver tablas anteriores) |
| **order** | Posicion del campo en el formulario |
| **isIdentifier** | Si es identificador, no se puede modificar una vez completada la entrada |
| **isRequired** | Si es obligatorio al crear la entrada |
| **isActive** | Si esta activo en la version actual |
| **relatedRecordId** | Para RELATED_ENTRY y MULTIPLE_RELATED_ENTRY: registro de referencia |
| **relatedFieldIds** | Para RELATED_ENTRY: campos especificos a mostrar del registro relacionado |
| **comparisonConfig** | Para COMPARISON: operador y valores limite (JSON) |
| **formulaConfig** | Para FORMULA: expresion y campos referenciados (JSON) |

### Configuracion de COMPARISON

```json
{
  "operator": "BETWEEN",
  "value": 6.5,
  "maxValue": 8.5
}
```

Operadores disponibles: `LT` (<), `LTE` (<=), `GT` (>), `GTE` (>=), `EQ` (=), `BETWEEN` (entre dos valores).

### Configuracion de DROPDOWN

Las opciones del dropdown se definen en la configuracion del campo. Ejemplo para un campo "TIPO DE ENVASE":

Opciones: VIDRIO, PLASTICO, METAL, CARTON

### Configuracion de QUANTITY

El campo QUANTITY almacena un valor numerico junto con una unidad de medida configurable. La unidad se define al crear el campo (ej: kg, g, L, mL, m3, unidades). El usuario ingresa solo el valor numerico; la unidad se muestra automaticamente.

## Versionado

Los registros tienen un sistema de versionado integrado. Al editar un registro (agregar, quitar o modificar campos):

1. Se incrementa automaticamente la **version** (v1, v2, v3...)
2. Se pide un **motivo del cambio** (changeLog)
3. Las entradas existentes **no se modifican** -- conservan la version con la que fueron creadas
4. Los campos eliminados se marcan como inactivos (`removedInVersion`) pero sus datos historicos se preservan

> Solo se pueden editar registros en estado **DRAFT**. Una vez aprobado (ACTIVE), hay que crear una nueva version para modificarlo.

## Estado del registro

Los registros pasan por un circuito de aprobacion antes de poder usarse:

```
DRAFT ----> IN_REVIEW ----> ACTIVE
```

- **DRAFT**: se puede editar libremente
- **IN_REVIEW**: enviado al circuito de aprobacion, no se puede editar
- **ACTIVE**: aprobado, se pueden crear entradas

Para registros con seguimiento, el sistema valida que todos los **labels requeridos** esten presentes antes de permitir el envio a aprobacion.

Ver [09 - Circuito de Aprobacion](./09-circuito-aprobacion.md).

## Acciones entre registros (RecordAction)

Un registro puede tener **acciones** que se disparan automaticamente cuando se completa una entrada. Esto permite crear flujos de trabajo encadenados.

**Ejemplo:** Al completar una entrada en "Recepcion de Muestras", se crea automaticamente una entrada en "Analisis Fisicoquimico" con los datos mapeados.

Las acciones requieren un **mapeo de campos** (fieldMapping): que campo del registro origen corresponde a que campo del registro destino.

Para registros de tipo BATCH, SAMPLE y STOCK, las acciones crean la entidad companera correspondiente en el registro destino.

## Vinculacion con documentos

Al crear un registro, se puede seleccionar un **documento** como base teorica. Esto permite:

- Saber que procedimiento respalda cada registro
- Trazabilidad completa: documento --> registro --> entrada --> datos

## Propiedades adicionales del registro

| Campo | Aplica a | Descripcion |
|-------|----------|-------------|
| **Periodicidad** (dias) | PERIODIC, INSTRUMENTAL | Cada cuantos dias se repite o se calibra |
| **Notificar dias antes** | PERIODIC, NOT_PERIODIC_WITH_REVISION | Cuantos dias antes del vencimiento se genera alerta |
| **Area** | Todos | Area organizacional a la que pertenece el registro |
| **Documento base** | Todos | Documento de referencia asociado |
| **isSystem** | Todos | Indica si es un registro de sistema (no editable por el usuario) |

## Permisos

| Accion | Roles permitidos |
|--------|-----------------|
| Ver registros | Todos (filtrado por area) |
| Crear/editar registros | ADMIN, QUALITY_MANAGER |
| Archivar/restaurar | ADMIN, QUALITY_MANAGER |
| Crear entradas | ADMIN, QUALITY_MANAGER, TECHNICIAN |
