# 06 -- Lotes de Produccion

## Que es un lote

Un lote representa una **corrida de produccion** -- una instancia concreta de fabricacion siguiendo una receta. Cada lote tiene un numero unico, un ciclo de vida con estados, trazabilidad hacia la receta utilizada y opcionalmente consumo de stock de materias primas.

## Como se crea un lote

Los lotes se crean automaticamente al crear una entrada en un registro de tipo **BATCH**:

1. Ir al registro de produccion (ej: "PRODUCCION PLANTA FERTILIZANTES")
2. Click en **Nueva entrada**
3. Completar los campos del registro:
   - Campo con label **"LOTE"**: numero de lote (ej: LOT-2026-001). Este campo debe ser identificador.
   - Campo de tipo **RECIPE_SELECT**: seleccionar la receta a producir (ej: "FERTILIZANTE NPK 15-15-15")
   - Demas campos personalizados (temperaturas, cantidades, observaciones, etc.)
4. Click en **Crear entrada**
5. El sistema crea la entrada en estado **DRAFT** + un **Batch** vinculado en estado **PLANNED**

> **Importante:** La receta se selecciona **por entrada** mediante el campo RECIPE_SELECT, no a nivel de registro. Esto permite que un mismo registro de produccion trabaje con diferentes productos.

## Ciclo de vida

```
PLANNED ----> IN_PROGRESS ----> COMPLETED ----> APPROVED
                                     +----> REJECTED ----> PLANNED (reinicio)
```

| Estado | Significado |
|--------|-------------|
| **PLANNED** | Lote planificado, aun no inicio la produccion |
| **IN_PROGRESS** | Produccion en curso. Se registra la fecha de inicio (startedAt) |
| **COMPLETED** | Produccion terminada, pendiente de aprobacion de calidad |
| **APPROVED** | Lote aprobado para liberacion y despacho |
| **REJECTED** | Lote rechazado por calidad (puede reiniciarse a PLANNED) |

### Acciones disponibles por estado

| Estado actual | Accion | Estado resultante |
|--------------|--------|-------------------|
| PLANNED | **Iniciar produccion** | IN_PROGRESS |
| IN_PROGRESS | **Completar produccion** | COMPLETED |
| COMPLETED | **Aprobar** | APPROVED |
| COMPLETED | **Rechazar** | REJECTED |
| REJECTED | **Reiniciar** | PLANNED |

Cada cambio de estado se registra en el **BatchStatusLog** con: quien lo cambio, cuando, motivo (opcional) y estados anterior/posterior.

## Consumo de stock al iniciar produccion

Cuando un lote tiene una receta con ingredientes marcados como `fromStock`, al **iniciar produccion** (pasar de PLANNED a IN_PROGRESS), el sistema solicita al operador que seleccione los lotes de stock a consumir:

1. El operador hace click en **Iniciar produccion**
2. El sistema muestra la lista de ingredientes con `fromStock = true`
3. Para cada ingrediente, el operador:
   - Selecciona el/los lote(s) de stock disponibles
   - Indica la cantidad a consumir de cada lote
4. El sistema registra los egresos de stock correspondientes
5. El lote pasa a IN_PROGRESS

**Ejemplo:**
```
Lote LOT-2026-015 -- Receta: FERTILIZANTE NPK 15-15-15

Consumo de stock al iniciar:
  NITRATO DE AMONIO:
    +-- Lote STCK-2026-001: 100 kg
    +-- Lote STCK-2026-004: 50 kg
  SUPERFOSFATO TRIPLE:
    +-- Lote STCK-2026-008: 150 kg
  CLORURO DE POTASIO:
    +-- Lote STCK-2026-012: 150 kg
```

Ver [11 - Stock](./11-stock.md) para mas informacion sobre la gestion de inventario.

## Entrada y completitud

La entrada del registro BATCH queda en estado **DRAFT** mientras el lote esta en proceso. Cuando el lote pasa a **COMPLETED**:

1. La entrada asociada se completa automaticamente (pasa a COMPLETED)
2. Se registra la cantidad producida y la unidad (producedQuantity, unit)
3. Se pueden disparar acciones automaticas (RecordActions) configuradas en el registro

Este mecanismo garantiza que la entrada refleja el estado real de la produccion.

## Gestion de lotes

La pagina **Lotes** muestra todos los lotes de la organizacion con:

- Filtro por estado (PLANNED, IN_PROGRESS, COMPLETED, APPROVED, REJECTED)
- Busqueda por numero de lote, nombre de registro o receta
- Informacion rapida: numero de lote, receta, estado, fechas
- Botones de accion segun el estado actual

## Informacion del lote

Cada lote muestra:

| Campo | Descripcion |
|-------|-------------|
| **Numero de lote** | Identificador unico (ej: LOT-2026-001) |
| **Registro** | Registro BATCH al que pertenece |
| **Receta** | Receta/producto que se esta fabricando (si aplica) |
| **Estado** | Estado actual del ciclo de vida |
| **Cantidad producida** | Valor numerico + unidad (al completar) |
| **Fecha de inicio** | Cuando se inicio la produccion |
| **Fecha de completitud** | Cuando se completo la produccion |
| **Datos de entrada** | Valores de los campos del registro (cantidades, temperaturas, controles) |
| **Historial de estados** | Log completo de cambios de estado |

## Trazabilidad

Un lote tiene **trazabilidad cruzada** con otros modulos del sistema:

```
Stock (materias primas consumidas)
  +-- Lote STCK-2026-001: NITRATO DE AMONIO (150 kg)
  +-- Lote STCK-2026-008: SUPERFOSFATO TRIPLE (150 kg)
       |
       v
Lote LOT-2026-015 (FERTILIZANTE NPK 15-15-15)
  +-- Receta: FER-001 v2
  +-- Muestra M-2026-042 (Control de calidad)
       +-- Ensayo Fisicoquimico: N 15.1%, P 14.8%, K 15.2% --> PASA
       +-- Ensayo Granulometria: 2.8 mm --> PASA
       --> Resultado: Lote APPROVED
```

Esta trazabilidad se logra con:
- Campos **RELATED_ENTRY** para vincular lotes con muestras y ensayos
- **Consumo de stock** para vincular lotes con materias primas
- **Receta** para vincular lotes con la formula utilizada

## Permisos

| Accion | Roles permitidos |
|--------|-----------------|
| Ver lotes | Todos |
| Crear lotes (crear entrada en registro BATCH) | ADMIN, QUALITY_MANAGER, TECHNICIAN |
| Cambiar estado (iniciar, completar, aprobar, rechazar) | ADMIN, QUALITY_MANAGER, TECHNICIAN |
