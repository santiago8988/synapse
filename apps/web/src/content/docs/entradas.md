# Entradas

## Qué es una entrada

Una entrada es una **instancia de datos** de un registro. Si el registro es la plantilla, la entrada son los datos concretos cargados en un momento determinado. Cada entrada almacena:

- Los valores de cada campo del registro (en formato JSON)
- Los resultados de comparaciones automáticas
- Los resultados de fórmulas calculadas
- Fecha de creación, versión del registro utilizada y quien la creo
- Estado: DRAFT o COMPLETED

## Texto en mayúsculas

**Todos los valores de texto** ingresados en las entradas se almacenan automáticamente en **MAYÚSCULAS**. Esta regla aplica a campos TEXT, DROPDOWN y cualquier campo de texto libre. Esto garantiza:

- Consistencia de datos en toda la organización
- Búsquedas sin sensibilidad a mayúsculas/minúsculas
- Eliminación de duplicados por diferencias de capitalización

Ejemplo: si un operador ingresa "Lote prueba", el sistema almacena "LOTE PRUEBA".

## Ciclo de vida según tipo de registro

El comportamiento al crear una entrada depende del tipo de registro:

### NOT_PERIODIC y NOT_PERIODIC_WITH_REVISION

```
Se crea ----> COMPLETED (automatico)
```

Se completan automáticamente al crearse. Son registros puntuales o de revisión.

### PERIODIC

```
Se crea (DRAFT) ----> Se completa (COMPLETED) ----> Se crea la siguiente automaticamente
```

Al completar una entrada periódica, el sistema crea automáticamente la siguiente con la fecha de vencimiento calculada (hoy + periodicidad en días).

### INSTRUMENTAL

```
Se crea ----> COMPLETED (automatico) + se crea Instrument vinculado
```

La entrada se completa automáticamente y se crea un Instrumento con estado ACTIVE y fecha de próxima calibración calculada. Ver [08 - Instrumental](./08-instrumental.md).

### BATCH (Lote)

```
Se crea (DRAFT) + se crea Batch (PLANNED) ----> [Batch se completa] ----> Entry COMPLETED
```

La entrada queda en estado **DRAFT** al crearse. **No se completa hasta que el Batch asociado se complete.** Cuando el lote pasa a COMPLETED, la entrada se completa automáticamente. Ver [06 - Lotes](./06-lotes.md).

### SAMPLE (Muestra)

```
Se crea (DRAFT) + se crea Sample (RECEIVED) ----> [Sample se completa] ----> Entry COMPLETED
```

La entrada queda en estado **DRAFT** al crearse. Se completa cuando la muestra asociada llega a estado COMPLETED. Ver [07 - Muestras](./07-muestras.md).

### STOCK

```
Se crea ----> COMPLETED (automatico) + se crea StockMovement vinculado
```

Las entradas de stock se completan automáticamente (igual que NOT_PERIODIC) y se crea un StockMovement con los datos del movimiento de inventario. Ver [11 - Stock](./11-stock.md).

## Crear una entrada

1. Ir al registro deseado
2. Click en **Nueva entrada**
3. Completar los campos obligatorios
4. Para registros **BATCH**: el campo con label "LOTE" es obligatorio. El campo RECIPE_SELECT permite seleccionar la receta a producir.
5. Para registros **SAMPLE**: el campo "CÓDIGO MUESTRA" es obligatorio. El campo MATRIX_METHOD permite seleccionar matriz y métodos analíticos.
6. Para registros **STOCK**: los campos "PRODUCTO", "LOTE", "TIPO MOVIMIENTO" y "CANTIDAD" son obligatorios.
7. Click en **Crear entrada**

## Campos especiales

### Comparacion (COMPARISON)

Los campos de comparacion evalúan automáticamente si un valor cumple un criterio definido en la plantilla:

| Operador | Clave | Descripción | Ejemplo industrial |
|----------|-------|-------------|-------------------|
| Menor que | `LT` | Valor < límite | Turbidez < 1 NTU |
| Menor o igual | `LTE` | Valor <= límite | Error relativo <= 5% |
| Mayor que | `GT` | Valor > límite | Rendimiento > 90% |
| Mayor o igual | `GTE` | Valor >= límite | Temperatura >= 121 C (esterilización) |
| Igual a | `EQ` | Valor = referencia | Conteo de particulas = 0 |
| Entre valores | `BETWEEN` | min <= Valor <= max | pH entre 6.5 y 8.5 |

Cuando una comparacion **falla**, el sistema puede crear automáticamente una **No Conformidad** vinculada a la entrada y al campo que fallo. Ver [10 - No Conformidades](./10-no-conformidades.md).

### Fórmula (FÓRMULA)

Los campos de fórmula calculan valores automáticamente a partir de otros campos del mismo registro:

```
Error relativo (%) = ((VALOR MEDIDO - VALOR REFERENCIA) / VALOR REFERENCIA) * 100
```

Las fórmulas se definen usando los labels o IDs de otros campos. Se evalúan automáticamente al crear la entrada.

### Cantidad (QUANTITY)

Almacena un valor numérico junto con la unidad de medida configurada en el campo. Ejemplo:

- Campo "PESO NETO" configurado con unidad "kg" --> el operador ingresa 25.5, se almacena como "25.5 kg"
- Campo "VOLUMEN" configurado con unidad "L" --> el operador ingresa 100, se almacena como "100 L"

### Dropdown (DROPDOWN)

Presenta al operador una lista de opciones predefinidas. Solo se puede seleccionar una opción. Útil para:

- Tipos de envase: VIDRIO, PLÁSTICO, METAL
- Condición de la muestra: INTEGRA, DAÑADA, RECHAZADA
- Tipo de movimiento: INGRESO, EGRESO, AJUSTE

### Selector de matriz y métodos (MATRIX_METHOD)

Exclusivo para registros tipo SAMPLE. Permite al operador seleccionar:

1. La **matriz** de ensayo aplicable (ej: AGUA POTABLE, AGUA RESIDUAL, SUELO)
2. Los **métodos analíticos** a aplicar -- puede seleccionar todos los de la matriz o solo algunos

Ver [12 - Matrices y Métodos](./12-matrices-métodos.md).

### Selector de receta (RECIPE_SELECT)

Exclusivo para registros tipo BATCH. Permite al operador seleccionar la receta activa que se va a producir en ese lote. Solo muestra recetas en estado ACTIVE.

Ver [05 - Recetas](./05-recetas.md).

### Entrada relacionada (RELATED_ENTRY)

Permite vincular una entrada con otra de un registro diferente. Ejemplo:

- Campo "EQUIPO UTILIZADO" --> referencia a una entrada del registro "BALANZAS ANALÍTICAS"
- El sistema valida que el instrumento referenciado este en estado ACTIVE

### Múltiples entradas relacionadas (MULTIPLE_RELATED_ENTRY)

Igual que RELATED_ENTRY pero permite seleccionar múltiples entradas. Ideal para:

- Vincular múltiples ensayos a una muestra
- Asociar varios instrumentos a un procedimiento
- Referenciar múltiples lotes de materia prima

## Entradas periódicas -- vencimiento

Las entradas de registros periódicos tienen una **fecha de vencimiento** (dueDate). El dashboard alerta sobre:

- Entradas **vencidas**: pasaron la fecha sin completarse
- Entradas **próximas a vencer**: vencen en los próximos N días (configurable)

## Entradas con revisión -- fecha de revisión

Las entradas de registros tipo NOT_PERIODIC_WITH_REVISION tienen una **fecha de revisión** obligatoria. El sistema alerta N días antes (según la configuración del registro).

Ejemplo: un certificado de calibración externa que vence el 01/01/2027 con alerta 30 días antes.

## Acciones automáticas al crear/completar una entrada

1. **No Conformidades**: si una comparacion falla, se crea una NC automáticamente
2. **RecordActions**: se crea una entrada en otro registro con datos mapeados (cascading). Para registros BATCH/SAMPLE/STOCK destino, esto crea la entidad compañera correspondiente.
3. **Siguiente entrada periódica**: se programa la próxima entrada con nueva fecha de vencimiento
4. **Entidad compañera**: se crea Instrument, Batch, Sample o StockMovement según el tipo de registro

## Editar una entrada

- Las entradas en estado **DRAFT** se pueden editar libremente
- Las entradas **COMPLETED** permiten editar todos los campos **excepto los identificadores**
- Los campos identificadores son inmutables una vez completada la entrada

## Permisos

| Acción | Roles permitidos |
|--------|-----------------|
| Ver entradas | Todos (filtrado por área del registro) |
| Crear entradas | ADMIN, QUALITY_MANAGER, TECHNICIAN |
| Editar entradas | ADMIN, QUALITY_MANAGER, TECHNICIAN |
| Completar entradas | ADMIN, QUALITY_MANAGER, TECHNICIAN |
