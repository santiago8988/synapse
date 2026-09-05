# Recetas

## Qué es una receta

Una receta es una **fórmula de producción** que define los ingredientes (BOM -- Bill of Materials) y los pasos del proceso necesarios para fabricar un producto. Es la base teórica de los lotes de producción y permite gestionar fórmulas con trazabilidad, versionado y vinculación con el inventario de stock.

## Estructura de una receta

```
Receta: "FERTILIZANTE NPK 15-15-15" (FER-001) v1
+-- Ingredientes (BOM)
|   +-- 1. NITRATO DE AMONIO -- 150 kg [desde stock: NITRATO DE AMONIO]
|   +-- 2. SUPERFOSFATO TRIPLE -- 150 kg [desde stock: SUPERFOSFATO TRIPLE]
|   +-- 3. CLORURO DE POTASIO -- 150 kg [desde stock: KCL]
|   +-- 4. MATERIAL DE RELLENO -- 550 kg
+-- Pasos del proceso
    +-- 1. PESAJE (15 min) -- "PESAR CADA COMPONENTE SEGUN FORMULA"
    |      Control: "VERIFICAR CALIBRACION DE BALANZA INDUSTRIAL"
    +-- 2. MEZCLADO (30 min) -- "MEZCLAR EN EQUIPO ROTATIVO A 25 RPM"
    |      Control: "VERIFICAR HOMOGENEIDAD VISUAL"
    +-- 3. GRANULADO (45 min) -- "GRANULAR EN DISCO PELETIZADOR"
    |      Control: "VERIFICAR TAMANO DE GRANULO 2-4 MM"
    +-- 4. SECADO (60 min) -- "SECAR EN HORNO ROTATIVO A 85 C"
    |      Control: "HUMEDAD FINAL < 2%"
    +-- 5. ENVASADO (20 min) -- "ENVASAR EN BOLSAS DE 50 KG"
           Control: "VERIFICAR PESO NETO Y SELLADO"
```

## Propiedades

| Campo | Descripción |
|-------|-------------|
| **Nombre** | Nombre del producto. Ej: "FERTILIZANTE NPK 15-15-15" |
| **Código** | Código de producto/SKU. **Obligatorio.** Único por organización. Ej: "FER-001" |
| **Versión** | Se incrementa automáticamente al crear nuevas versiones (v1, v2, v3...) |
| **Estado** | DRAFT, IN_REVIEW, ACTIVE (circuito de aprobación) |
| **isActive** | Indica si la receta esta vigente (las versiones anteriores se desactivan) |

> **El código es obligatorio** y funciona como identificador del producto (SKU). Permite buscar y referenciar la receta de forma unívoca.

## Ingredientes (BOM)

Cada ingrediente tiene:

| Campo | Descripción |
|-------|-------------|
| **Nombre** | Materia prima o insumo |
| **Cantidad** | Valor numérico base para la fórmula |
| **Unidad** | kg, g, L, mL, u (unidades), etc. |
| **Orden** | Posición en la lista de ingredientes |
| **fromStock** | Si el ingrediente se gestiona desde el módulo de stock |
| **stockRecipeId** | Referencia al producto del stock vinculado (si fromStock = true) |

### Ingredientes vinculados a stock

Cuando un ingrediente tiene `fromStock = true`, se vincula con un producto gestionado en el módulo de stock. Esto permite:

- **Trazabilidad de materias primas**: saber de que lotes de stock se consumieron los ingredientes
- **Consumo al iniciar producción**: al arrancar un lote, el operador debe seleccionar los lotes y cantidades de stock a consumir para cada ingrediente vinculado
- **Control de disponibilidad**: verificar que hay stock suficiente antes de producir

Ejemplo:
```
Ingrediente: ACIDO FOSFORICO (fromStock = true)
  +-- Vinculado a producto de stock: "ACIDO FOSFORICO 85%"
  +-- Al iniciar lote LOT-2026-015:
      +-- Consumir 200 L del lote STCK-2026-003
      +-- Consumir 50 L del lote STCK-2026-007
```

Ver [11 - Stock](./11-stock.md) para más información sobre gestión de inventario.

## Pasos del proceso

Cada paso tiene:

| Campo | Descripción |
|-------|-------------|
| **Nombre** | Acción a realizar (ej: MEZCLADO, GRANULADO, ESTERILIZACIÓN) |
| **Descripción** | Instrucciones detalladas (opcional) |
| **Duracion** | Tiempo estimado en minutos (opcional) |
| **Controles** | Verificaciones durante o después del paso (opcional) |
| **Orden** | Posición en la secuencia de proceso |

## Versionado

Las recetas tienen un sistema de versionado que depende de su estado:

### Edición de recetas en DRAFT

Si la receta esta en estado **DRAFT**, la edición se realiza **in-place** (sin crear nueva versión). Esto permite iterar libremente sobre la fórmula antes de enviarla a aprobación.

### Edición de recetas ACTIVE

Si la receta esta en estado **ACTIVE** y se modifica:

1. Se crea automáticamente una **nueva versión** (v2, v3, etc.) en estado DRAFT
2. La versión anterior se **desactiva** (isActive = false)
3. Los lotes existentes conservan la referencia a la versión con la que fueron producidos
4. La nueva versión debe pasar por el circuito de aprobación para volver a ser ACTIVE

```
FER-001 v1 (ACTIVE) ----> Se edita ----> FER-001 v1 (ACTIVE, isActive=false)
                                          FER-001 v2 (DRAFT, isActive=true)
                                              |
                                          Aprobacion ----> FER-001 v2 (ACTIVE, isActive=true)
```

> Esto garantiza que nunca se modifica una fórmula aprobada sin trazabilidad. Los lotes producidos con v1 siempre referencian la fórmula original.

## Crear una receta

1. Ir a **Recetas** en el menú lateral
2. Click en **Nueva receta**
3. Completar:
   - **Nombre**: nombre del producto (ej: SOLUCIÓN BUFFER PH 7)
   - **Código**: código SKU obligatorio (ej: BUF-007)
4. Agregar ingredientes con sus cantidades y unidades
   - Marcar `fromStock` los ingredientes que se gestionan desde inventario
   - Vincular con el producto de stock correspondiente
5. Agregar pasos del proceso con controles de calidad
6. Click en **Crear receta**

La receta se crea en estado DRAFT. Para usarla en producción, debe pasar por el circuito de aprobación y llegar a ACTIVE.

## Uso en producción

La receta se selecciona **por cada entrada** de un registro tipo BATCH, mediante un campo de tipo **RECIPE_SELECT**. Esto permite que un mismo registro de producción trabaje con diferentes recetas.

```
Registro "PRODUCCION PLANTA 1" (tipo BATCH)
+-- Entrada 1: Receta FER-001 "FERTILIZANTE NPK 15-15-15", Lote LOT-2026-001
+-- Entrada 2: Receta BUF-007 "SOLUCION BUFFER PH 7", Lote LOT-2026-002
+-- Entrada 3: Receta FER-001 "FERTILIZANTE NPK 15-15-15", Lote LOT-2026-003
```

Ver [06 - Lotes](./06-lotes.md) para el ciclo de vida completo del lote.

## Ejemplos industriales

### Farmacéutica
```
Receta: "SOLUCION RINGER LACTATO" (SRL-001)
Ingredientes:
  - CLORURO DE SODIO -- 6.0 g/L [stock]
  - CLORURO DE POTASIO -- 0.3 g/L [stock]
  - CLORURO DE CALCIO -- 0.2 g/L [stock]
  - LACTATO DE SODIO -- 3.1 g/L [stock]
  - AGUA PARA INYECCION -- 1000 mL
```

### Materiales de construcción
```
Receta: "MEZCLA DE CONCRETO H30" (CON-H30)
Ingredientes:
  - CEMENTO PORTLAND -- 400 kg [stock]
  - ARENA GRUESA -- 600 kg [stock]
  - GRAVA 3/4" -- 1100 kg [stock]
  - AGUA -- 180 L
  - ADITIVO PLASTIFICANTE -- 4 L [stock]
```

### Química analítica
```
Receta: "SOLUCION PATRON PH 4.00" (PAT-PH4)
Ingredientes:
  - BIFTALATO DE POTASIO -- 10.12 g [stock]
  - AGUA DESTILADA -- 1000 mL
```

## Permisos

| Acción | Roles permitidos |
|--------|-----------------|
| Ver recetas | Todos |
| Crear/editar recetas | ADMIN, QUALITY_MANAGER |
| Eliminar recetas | ADMIN, QUALITY_MANAGER (solo si no tiene lotes asociados) |
| Enviar a aprobación | ADMIN, QUALITY_MANAGER |
