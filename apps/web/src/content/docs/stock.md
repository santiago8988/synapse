# Stock e Inventario

## Qué es el módulo de stock

El módulo de stock gestiona el **inventario de materias primas, reactivos, insumos y materiales** de la organización. Permite registrar ingresos, egresos y ajustes de inventario con trazabilidad por producto y por lote. Se integra con el módulo de recetas para el consumo de materias primas durante la producción.

## Conceptos clave

| Concepto | Descripción |
|----------|-------------|
| **Producto** | Materia prima o insumo identificado por nombre (ej: NITRATO DE AMONIO, ÁCIDO CLORHÍDRICO) |
| **Lote** | Partida específica de un producto, identificada por número de lote del proveedor |
| **Movimiento** | Registro de un cambio en el inventario: ingreso, egreso o ajuste |
| **StockMovement** | Entidad compañera creada automáticamente por cada entrada de tipo STOCK |

## Como funciona

El stock se gestiona a través de un registro de tipo **STOCK**. Cada entrada en este registro crea un **StockMovement** que representa un movimiento de inventario.

### Configuración del registro de stock

El registro de tipo STOCK debe incluir los siguientes campos con labels exactos:

| Label requerido | Tipo de campo | Descripción |
|----------------|---------------|-------------|
| **PRODUCTO** | TEXT | Nombre del producto/materia prima |
| **LOTE** | TEXT | Número de lote del proveedor o interno |
| **TIPO MOVIMIENTO** | DROPDOWN | Opciones: INGRESO, EGRESO, AJUSTE |
| **CANTIDAD** | QUANTITY | Valor numérico + unidad de medida (ej: kg, L, u) |

Campos adicionales opcionales:

- PROVEEDOR (TEXT)
- FECHA DE VENCIMIENTO (DATE)
- CERTIFICADO DE CALIDAD (TEXT)
- OBSERVACIONES (TEXT)
- UBICACIÓN (DROPDOWN)
- MOTIVO (TEXT) -- especialmente útil para ajustes

### Crear un movimiento de stock

1. Ir al registro de stock (ej: "MOVIMIENTOS DE INVENTARIO")
2. Click en **Nueva entrada**
3. Completar los campos:
   - PRODUCTO: ej: "NITRATO DE AMONIO"
   - LOTE: ej: "STCK-2026-001"
   - TIPO MOVIMIENTO: seleccionar INGRESO, EGRESO o AJUSTE
   - CANTIDAD: ej: 500 kg
   - Campos adicionales según configuración
4. Click en **Crear entrada**
5. La entrada se completa **automáticamente** (como NOT_PERIODIC) y se crea un StockMovement

> **Nota:** Las entradas de stock se auto-completan al crearse. No requieren completitud manual como los lotes o muestras.

## Tipos de movimiento

| Tipo | Descripción | Efecto en inventario | Ejemplo |
|------|-------------|---------------------|---------|
| **INGRESO** | Recepción de material del proveedor o producción interna | Suma al stock disponible | Recepción de 500 kg de NITRATO DE AMONIO |
| **EGRESO** | Consumo, despacho o baja de material | Resta del stock disponible | Consumo de 150 kg para producción |
| **AJUSTE** | Corrección de inventario por conteo físico, merma o error | Suma o resta según signo | Ajuste por merma: -5 kg |

## Página de stock

La página **Stock** muestra un resumen consolidado del inventario:

### Vista por producto

Agrupa todos los movimientos por **PRODUCTO** y muestra:

| Columna | Descripción |
|---------|-------------|
| **Producto** | Nombre del producto/materia prima |
| **Stock total** | Suma neta de todos los movimientos (ingresos - egresos +/- ajustes) |
| **Unidad** | Unidad de medida |
| **Cantidad de lotes** | Número de lotes diferentes registrados |

### Detalle por lote

Al expandir un producto, se ve el detalle por cada lote:

```
NITRATO DE AMONIO (Stock total: 850 kg)
+-- Lote STCK-2026-001: 350 kg (Ingreso 500 kg, Egreso 150 kg)
+-- Lote STCK-2026-004: 500 kg (Ingreso 500 kg)

ACIDO CLORHIDRICO 37% (Stock total: 180 L)
+-- Lote STCK-2026-010: 80 L (Ingreso 100 L, Egreso 20 L)
+-- Lote STCK-2026-015: 100 L (Ingreso 100 L)

BIFTALATO DE POTASIO (Stock total: 4.85 kg)
+-- Lote STCK-2026-020: 4.85 kg (Ingreso 5 kg, Egreso 0.15 kg)
```

## Consumo de stock desde lotes de producción

Cuando una receta tiene ingredientes marcados como `fromStock`, el operador debe seleccionar los lotes de stock a consumir al **iniciar la producción** del lote:

1. El operador inicia producción del lote LOT-2026-015
2. El sistema muestra los ingredientes con `fromStock = true`
3. Para cada ingrediente, el operador selecciona:
   - El o los lotes de stock disponibles
   - La cantidad a consumir de cada lote
4. El sistema registra los egresos de stock correspondientes (crea StockMovements de tipo EGRESO)
5. El lote pasa a IN_PROGRESS

Esto permite trazabilidad completa desde el producto terminado hasta las materias primas utilizadas, incluyendo los lotes específicos de cada insumo.

Ver [06 - Lotes](./06-lotes.md) para más detalle sobre el consumo de stock en producción.

## Ejemplo completo: Laboratorio de química analítica

### Setup

1. Crear registro tipo STOCK: "INVENTARIO DE REACTIVOS"
   - PRODUCTO (TEXT)
   - LOTE (TEXT)
   - TIPO MOVIMIENTO (DROPDOWN: INGRESO, EGRESO, AJUSTE)
   - CANTIDAD (QUANTITY, unidad: variada)
   - PROVEEDOR (TEXT)
   - FECHA DE VENCIMIENTO (DATE)
   - NÚMERO DE CERTIFICADO (TEXT)
   - UBICACIÓN (DROPDOWN: ALMACÉN A, ALMACÉN B, HELADERA, CAMPANA)

2. Aprobar el registro vía circuito de aprobación

### Operación

```
Dia 1 - Recepcion de reactivos:
  INGRESO: ACIDO CLORHIDRICO 37%, Lote PROV-2026-A001, 20 L, MERCK
  INGRESO: HIDROXIDO DE SODIO, Lote PROV-2026-B015, 10 kg, SIGMA
  INGRESO: PATRON PH 7.00, Lote PROV-2026-C003, 500 mL, HANNA

Dia 5 - Consumo en laboratorio:
  EGRESO: ACIDO CLORHIDRICO 37%, Lote PROV-2026-A001, 2 L
  EGRESO: HIDROXIDO DE SODIO, Lote PROV-2026-B015, 0.5 kg

Dia 15 - Inventario fisico:
  AJUSTE: PATRON PH 7.00, Lote PROV-2026-C003, -50 mL (MOTIVO: MERMA POR EVAPORACION)

Resultado en pagina de stock:
  ACIDO CLORHIDRICO 37%: 18 L
  HIDROXIDO DE SODIO: 9.5 kg
  PATRON PH 7.00: 450 mL
```

## Trazabilidad

El módulo de stock proporciona trazabilidad en múltiples niveles:

```
Proveedor (via campo PROVEEDOR)
  +-- Ingreso de materia prima (StockMovement INGRESO)
       +-- Lote de stock (ej: STCK-2026-001)
            +-- Consumo en produccion (StockMovement EGRESO)
                 +-- Lote de produccion (ej: LOT-2026-015)
                      +-- Producto terminado (via Receta)
                           +-- Muestra de control (via Sample)
```

## Permisos

| Acción | Roles permitidos |
|--------|-----------------|
| Ver stock | Todos |
| Crear movimientos (crear entrada en registro STOCK) | ADMIN, QUALITY_MANAGER, TECHNICIAN |
| Ver detalle por lote | Todos |
