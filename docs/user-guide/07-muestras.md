# 07 -- Muestras

## Que es una muestra

Una muestra representa un **especimen recibido para analisis** en el laboratorio. Puede ser una muestra externa (de un cliente o punto de monitoreo) o interna (control de calidad de produccion). Cada muestra tiene un codigo unico, una matriz de ensayo asociada, metodos analiticos seleccionados y un ciclo de vida que refleja su progreso en el laboratorio.

## Como se crea una muestra

Las muestras se crean al crear una entrada en un registro de tipo **SAMPLE**:

1. Ir al registro de muestras (ej: "RECEPCION DE MUESTRAS")
2. Click en **Nueva entrada**
3. Completar los campos del registro:
   - Campo con label **"CODIGO MUESTRA"** (obligatorio, identificador): ej: M-2026-001
   - Campo de tipo **MATRIX_METHOD** con label **"MATRIZ Y METODOS"** (obligatorio): seleccionar la matriz de ensayo y los metodos analiticos a aplicar
   - Demas campos personalizados (cliente, punto de muestreo, fecha de toma, etc.)
4. Click en **Crear entrada**
5. El sistema crea la entrada en estado **DRAFT** + un **Sample** vinculado en estado **RECEIVED**

> **Importante:** La matriz se selecciona **por cada muestra** (a traves del campo MATRIX_METHOD), no a nivel de registro. Esto permite que un mismo registro de muestras reciba especimenes de diferentes matrices.

## Seleccion de matriz y metodos (MATRIX_METHOD)

El campo MATRIX_METHOD es un selector especializado que permite:

1. **Seleccionar la matriz**: ej: AGUA POTABLE, AGUA RESIDUAL, SUELO AGRICOLA
2. **Seleccionar los metodos analiticos**: una vez elegida la matriz, se muestran los metodos disponibles

### Modos de seleccion de metodos

- **Todos los metodos de la matriz**: seleccionar la matriz sin elegir metodos individuales. Se aplican todos los parametros definidos en la matriz.
- **Metodos individuales**: seleccionar manualmente uno o mas metodos especificos de los disponibles en la matriz.

### Parametros efectivos (effectiveParameters)

Los parametros que se analizan en la muestra se determinan automaticamente:

| Seleccion | Parametros efectivos |
|-----------|---------------------|
| Solo matriz (sin metodos individuales) | **Todos** los parametros definidos en la matriz |
| Metodos individuales seleccionados | Solo los parametros de los **metodos seleccionados** |

Ejemplo:
```
Matriz: AGUA POTABLE
  Parametros totales: pH, Turbidez, Cloro libre, Conductividad, Coliformes, E.coli

Muestra M-2026-001: selecciono solo metodos de Fisicoquimica
  effectiveParameters: pH, Turbidez, Cloro libre, Conductividad

Muestra M-2026-002: selecciono todos
  effectiveParameters: pH, Turbidez, Cloro libre, Conductividad, Coliformes, E.coli
```

Ver [12 - Matrices y Metodos](./12-matrices-metodos.md) para mas detalle sobre configuracion de matrices y metodos.

## Ciclo de vida

```
RECEIVED ----> IN_TESTING ----> COMPLETED
```

| Estado | Significado |
|--------|-------------|
| **RECEIVED** | Muestra recibida en el laboratorio, pendiente de analisis |
| **IN_TESTING** | Ensayos en curso |
| **COMPLETED** | Todos los ensayos terminados, resultados cargados |

Cuando la muestra pasa a **COMPLETED**, la entrada asociada se completa automaticamente (pasa de DRAFT a COMPLETED).

## Pagina de detalle de muestra

La pagina de detalle de cada muestra muestra tres secciones principales:

### 1. Condiciones de muestreo

Si la matriz seleccionada tiene **condiciones** (MatrixCondition) configuradas, se muestran campos dinamicos para completar. Estos campos representan las condiciones de la toma de muestra.

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

### 2. Resultados analiticos

Muestra los **parametros efectivos** de la muestra con campos para cargar los resultados:

```
Resultados:
  - pH: [valor] (rango: 6.5 - 8.5)           --> PASA / FALLA
  - TURBIDEZ: [valor] NTU (max: 1.0)          --> PASA / FALLA
  - CLORO LIBRE: [valor] mg/L (rango: 0.2-1.0) --> PASA / FALLA
  - CONDUCTIVIDAD: [valor] uS/cm (max: 1500)  --> PASA / FALLA
```

Los resultados se almacenan en el campo `results` (JSON) de la muestra.

### 3. Informacion general

- Codigo de muestra
- Cliente (si aplica)
- Matriz seleccionada
- Metodos seleccionados
- Estado actual
- Fechas de recepcion y completitud

## Vinculacion con ensayos (via registros)

Ademas de los resultados directos en la muestra, se pueden vincular ensayos mediante registros complementarios usando campos **RELATED_ENTRY** o **MULTIPLE_RELATED_ENTRY**.

### Ejemplo practico: Laboratorio de aguas

**Setup (una sola vez):**

1. Crear registro tipo SAMPLE: "RECEPCION DE MUESTRAS"
   - Campo: CODIGO MUESTRA (TEXT, identificador)
   - Campo: MATRIZ Y METODOS (MATRIX_METHOD)
   - Campo: CLIENTE (TEXT)
   - Campo: FECHA DE TOMA (DATE)

2. Configurar matrices:
   - Matriz "AGUA POTABLE" con parametros: pH, Turbidez, Cloro libre, Conductividad, Coliformes, E.coli
   - Matriz "AGUA RESIDUAL" con parametros: DBO5, DQO, SST, pH, Aceites y grasas
   - Condiciones para "AGUA RESIDUAL": punto de muestreo, temperatura in situ, profundidad, caudal

**Operacion diaria:**

1. Llega muestra --> crear entrada: CODIGO MUESTRA = M-2026-001, Matriz = AGUA POTABLE, metodos = todos
2. El sistema crea Sample en estado RECEIVED con todos los parametros de AGUA POTABLE
3. En la pagina de detalle, el tecnico carga los resultados de cada parametro
4. Si algun resultado esta fuera de rango --> se crea No Conformidad automaticamente
5. Cuando todos los resultados estan cargados --> marcar muestra como COMPLETED

## Trazabilidad con lotes

Si la muestra proviene de un lote de produccion, se vincula via campos RELATED_ENTRY:

```
Lote LOT-2026-015 (FERTILIZANTE NPK 15-15-15)
  <--- Muestra M-2026-042 (Control de calidad)
         +-- Parametro N: 15.1% --> PASA
         +-- Parametro P: 14.8% --> PASA
         +-- Parametro K: 15.2% --> PASA
         --> Resultado: Muestra COMPLETED, Lote APPROVED
```

## Gestion de muestras

La pagina **Muestras** muestra todas las muestras con:

- Filtro por estado (RECEIVED, IN_TESTING, COMPLETED)
- Busqueda por codigo, cliente, matriz o registro
- Indicadores visuales del progreso de resultados
- Boton para avanzar el estado

## Permisos

| Accion | Roles permitidos |
|--------|-----------------|
| Ver muestras | Todos |
| Crear muestras (crear entrada en registro SAMPLE) | ADMIN, QUALITY_MANAGER, TECHNICIAN |
| Cargar resultados | ADMIN, QUALITY_MANAGER, TECHNICIAN |
| Cargar condiciones | ADMIN, QUALITY_MANAGER, TECHNICIAN |
| Cambiar estado | ADMIN, QUALITY_MANAGER, TECHNICIAN |
