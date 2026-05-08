# Inactivacion en cascada de entries

## Concepto

Cuando una entrada se inactiva, se deben inactivar todas las entries relacionadas siguiendo la cadena de `triggeredById` y las entidades companion.

## Cadena de relaciones

Cada entry puede tener:
- `triggeredById` — la entry que la origino (via accion)
- Entidad companion vinculada por `entryId`:
  - Batch (BATCH)
  - Sample (SAMPLE)
  - Instrument (INSTRUMENTAL)
  - StockMovement (STOCK)

## Algoritmo

```
inactivarEntry(entryId):
  1. Marcar entry como INACTIVE (nuevo status o flag)
  2. Si tiene entidad companion:
     - Batch → marcar como CANCELLED
     - Sample → marcar como CANCELLED  
     - Instrument → marcar como OUT_OF_SERVICE
     - StockMovement → revertir movimiento (crear movimiento inverso? o marcar como anulado?)
  3. Buscar todas las entries donde triggeredById = entryId
  4. Para cada una → inactivarEntry(entry.id)  // RECURSION
```

## Ejemplo completo

```
Ingreso MP (NOT_PERIODIC)
  Entry: "UREA LOTE-001"  ← SE INACTIVA ESTA
    ↓ accion
  Stock Interno (STOCK)
    Entry: "INGRESO UREA LOTE-001" ← SE INACTIVA EN CASCADA
      StockMovement: INGRESO 500kg ← SE ANULA

Orden Produccion (NOT_PERIODIC)  
  Entry: "OP-001 Pan Integral" ← SE INACTIVA ESTA
    ↓ accion
  Productivo (BATCH)
    Entry: "LOTE-PI-001" ← SE INACTIVA EN CASCADA
      Batch: PLANNED → CANCELLED
        ↓ si habia consumido stock al iniciar
        StockMovement: EGRESO harina ← SE REVIERTE (crear INGRESO inverso)
```

## Decisiones pendientes

### 1. Como marcar una entry como inactiva?
- Opcion A: Nuevo status `INACTIVE` en EntryStatus enum
- Opcion B: Campo `isActive: Boolean` en Entry (como Record)
- Recomendacion: Opcion A, es mas explicito y permite filtrar en queries

### 2. StockMovements anulados — como se manejan?
- Opcion A: Crear movimiento inverso (INGRESO si era EGRESO y viceversa) con motivo "ANULACION"
- Opcion B: Marcar el StockMovement como anulado (campo `isActive` o `status`)
- Recomendacion: Opcion A, mantiene trazabilidad completa y el saldo se recalcula automaticamente

### 3. Se puede reactivar?
- Si se reactiva una entry, se reactivan las cascadas?
- O la reactivacion es manual entry por entry?
- Recomendacion: No permitir reactivacion por ahora, solo inactivacion

### 4. Batch que ya esta COMPLETED/APPROVED
- Si inactivo una entry cuyo batch ya fue completado/aprobado, que pasa?
- Se permite? Se bloquea?
- Recomendacion: Permitir con warning, el usuario asume la responsabilidad

### 5. Donde se dispara la inactivacion?
- Boton en la tabla de entries del record detail
- Confirmacion con mensaje explicando la cascada
- Mostrar preview de cuantas entries/entidades se van a afectar antes de confirmar

## Schema changes necesarios

```prisma
// Agregar INACTIVE a EntryStatus
enum EntryStatus {
  DRAFT
  COMPLETED
  INACTIVE
}

// Agregar CANCELLED a BatchStatus  
enum BatchStatus {
  PLANNED
  IN_PROGRESS
  COMPLETED
  APPROVED
  REJECTED
  CANCELLED
}

// Agregar CANCELLED a SampleStatus
enum SampleStatus {
  RECEIVED
  IN_TESTING
  COMPLETED
  CANCELLED
}
```

## Implementacion

### Backend
1. Nuevo endpoint: `POST /entries/:id/inactivate`
2. Servicio recursivo que sigue la cadena de triggeredById
3. Manejo de cada tipo de companion entity
4. Para stock: crear movimientos inversos

### Frontend
1. Boton "Inactivar" en cada entry de la tabla (con icono de ban/cancel)
2. Dialog de confirmacion mostrando:
   - Cuantas entries se van a inactivar
   - Cuantas entidades companion se afectan
   - Lista preview de lo que se va a hacer
3. Entries inactivas se muestran con estilo diferente (gris, tachado)
4. Filtro para mostrar/ocultar inactivas

## Orden de implementacion

1. Schema: nuevos status (INACTIVE, CANCELLED)
2. Backend: endpoint inactivate con recursion
3. Backend: reversion de stock movements
4. Frontend: boton + dialog de confirmacion
5. Frontend: visualizacion de entries inactivas
6. Testing: probar cadena completa con multiples niveles
