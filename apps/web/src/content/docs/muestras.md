# Muestras

## Qué es una muestra

Una muestra representa un **espécimen recibido para análisis** en el laboratorio. Puede ser una muestra externa (de un cliente o punto de monitoreo) o interna (control de calidad de producción). Cada muestra tiene un código único, una matriz de ensayo asociada, métodos analíticos seleccionados y un ciclo de vida que refleja su progreso en el laboratorio.

## Como se crea una muestra

Las muestras se crean al crear una entrada en un registro de tipo **SAMPLE**:

1. Ir al registro de muestras (ej: "RECEPCIÓN DE MUESTRAS")
2. Click en **Nueva entrada**
3. Completar los campos del registro:
   - Campo con label **"CÓDIGO MUESTRA"** (obligatorio, identificador): ej: M-2026-001
   - Campo de tipo **MATRIX_METHOD** con label **"MATRIZ Y MÉTODOS"** (obligatorio): seleccionar la matriz de ensayo y los métodos analíticos a aplicar
   - Demás campos personalizados (cliente, punto de muestreo, fecha de toma, etc.)
4. Click en **Crear entrada**
5. El sistema crea la entrada en estado **DRAFT** + un **Sample** vinculado en estado **RECEIVED**

> **Importante:** La matriz se selecciona **por cada muestra** (a través del campo MATRIX_METHOD), no a nivel de registro. Esto permite que un mismo registro de muestras reciba especímenes de diferentes matrices.

## Selección de matriz y métodos (MATRIX_METHOD)

El campo MATRIX_METHOD es un selector especializado que permite:

1. **Seleccionar la matriz**: ej: AGUA POTABLE, AGUA RESIDUAL, SUELO AGRÍCOLA
2. **Seleccionar los métodos analíticos**: una vez elegida la matriz, se muestran los métodos disponibles

### Modos de selección de métodos

- **Todos los métodos de la matriz**: seleccionar la matriz sin elegir métodos individuales. Se aplican todos los parámetros definidos en la matriz.
- **Métodos individuales**: seleccionar manualmente uno o más métodos específicos de los disponibles en la matriz.

### Parámetros efectivos (effectiveParameters)

Los parámetros que se analizan en la muestra se determinan automáticamente:

| Selección | Parámetros efectivos |
|-----------|---------------------|
| Solo matriz (sin métodos individuales) | **Todos** los parámetros definidos en la matriz |
| Métodos individuales seleccionados | Solo los parámetros de los **métodos seleccionados** |

Ejemplo:
```
Matriz: AGUA POTABLE
  Parametros totales: pH, Turbidez, Cloro libre, Conductividad, Coliformes, E.coli

Muestra M-2026-001: selecciono solo metodos de Fisicoquimica
  effectiveParameters: pH, Turbidez, Cloro libre, Conductividad

Muestra M-2026-002: selecciono todos
  effectiveParameters: pH, Turbidez, Cloro libre, Conductividad, Coliformes, E.coli
```

Ver [12 - Matrices y Métodos](./12-matrices-métodos.md) para más detalle sobre configuración de matrices y métodos.

## Ciclo de vida

```
RECEIVED ----> IN_TESTING ----> COMPLETED
```

| Estado | Significado |
|--------|-------------|
| **RECEIVED** | Muestra recibida en el laboratorio, pendiente de análisis |
| **IN_TESTING** | Ensayos en curso |
| **COMPLETED** | Todos los ensayos terminados, resultados cargados |

Cuando la muestra pasa a **COMPLETED**, la entrada asociada se completa automáticamente (pasa de DRAFT a COMPLETED).

## Página de detalle de muestra

La página de detalle de cada muestra muestra tres secciones principales:

### 1. Condiciones de muestreo

Si la matriz seleccionada tiene **condiciones** (MatrixCondition) configuradas, se muestran campos dinámicos para completar. Estos campos representan las condiciones de la toma de muestra.

Ejemplo para matriz "AGUA RESIDUAL":
```
Condiciones de muestreo:
  - PUNTO DE MUESTREO: [campo texto]
  - TEMPERATURA IN SITU: [campo numerico, unidad: C]
  - PROFUNDIDAD: [campo numerico, unidad: m]
  - TIPO DE MUESTRA: [dropdown: SIMPLE, COMPUESTA]
  - CAUDAL: [campo numerico, unidad: L/s]
```

Las condiciones se almacenan en el campo `conditions` (JSON) de la muestra.

### 2. Resultados analíticos

Muestra los **parámetros efectivos** de la muestra con campos para cargar los resultados:

```
Resultados:
  - pH: [valor] (rango: 6.5 - 8.5)           --> PASA / FALLA
  - TURBIDEZ: [valor] NTU (max: 1.0)          --> PASA / FALLA
  - CLORO LIBRE: [valor] mg/L (rango: 0.2-1.0) --> PASA / FALLA
  - CONDUCTIVIDAD: [valor] uS/cm (max: 1500)  --> PASA / FALLA
```

Los resultados se almacenan en el campo `results` (JSON) de la muestra.

### 3. Información general

- Código de muestra
- Cliente (si aplica)
- Matriz seleccionada
- Métodos seleccionados
- Estado actual
- Fechas de recepción y completitud

## Vinculación con ensayos (vía registros)

Además de los resultados directos en la muestra, se pueden vincular ensayos mediante registros complementarios usando campos **RELATED_ENTRY** o **MULTIPLE_RELATED_ENTRY**.

### Ejemplo práctico: Laboratorio de aguas

**Setup (una sola vez):**

1. Crear registro tipo SAMPLE: "RECEPCIÓN DE MUESTRAS"
   - Campo: CÓDIGO MUESTRA (TEXT, identificador)
   - Campo: MATRIZ Y MÉTODOS (MATRIX_METHOD)
   - Campo: CLIENTE (TEXT)
   - Campo: FECHA DE TOMA (DATE)

2. Configurar matrices:
   - Matriz "AGUA POTABLE" con parámetros: pH, Turbidez, Cloro libre, Conductividad, Coliformes, E.coli
   - Matriz "AGUA RESIDUAL" con parámetros: DBO5, DQO, SST, pH, Aceites y grasas
   - Condiciones para "AGUA RESIDUAL": punto de muestreo, temperatura in situ, profundidad, caudal

**Operación diaria:**

1. Llega muestra --> crear entrada: CÓDIGO MUESTRA = M-2026-001, Matriz = AGUA POTABLE, métodos = todos
2. El sistema crea Sample en estado RECEIVED con todos los parámetros de AGUA POTABLE
3. En la página de detalle, el técnico carga los resultados de cada parámetro
4. Si algún resultado esta fuera de rango --> se crea No Conformidad automáticamente
5. Cuando todos los resultados están cargados --> marcar muestra como COMPLETED

## Trazabilidad con lotes

Si la muestra proviene de un lote de producción, se vincula vía campos RELATED_ENTRY:

```
Lote LOT-2026-015 (FERTILIZANTE NPK 15-15-15)
  <--- Muestra M-2026-042 (Control de calidad)
         +-- Parametro N: 15.1% --> PASA
         +-- Parametro P: 14.8% --> PASA
         +-- Parametro K: 15.2% --> PASA
         --> Resultado: Muestra COMPLETED, Lote APPROVED
```

## Gestión de muestras

La página **Muestras** muestra todas las muestras con:

- Filtro por estado (RECEIVED, IN_TESTING, COMPLETED)
- Búsqueda por código, cliente, matriz o registro
- Indicadores visuales del progreso de resultados
- Botón para avanzar el estado

## Permisos

| Acción | Roles permitidos |
|--------|-----------------|
| Ver muestras | Todos |
| Crear muestras (crear entrada en registro SAMPLE) | ADMIN, QUALITY_MANAGER, TECHNICIAN |
| Cargar resultados | ADMIN, QUALITY_MANAGER, TECHNICIAN |
| Cargar condiciones | ADMIN, QUALITY_MANAGER, TECHNICIAN |
| Cambiar estado | ADMIN, QUALITY_MANAGER, TECHNICIAN |
