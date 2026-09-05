# Matrices y Métodos Analíticos

## Introducción

Este módulo gestiona dos componentes fundamentales del trabajo analítico de laboratorio:

1. **Matrices de ensayo**: definen que se analiza (agua potable, suelo, alimentos, etc.), con que parámetros y bajo que condiciones de muestreo
2. **Métodos analíticos** (OrgMethod): catálogo de métodos normativos y propios que se aplican a los parámetros de las matrices

Ambos componentes se integran con el módulo de muestras a través del campo **MATRIX_METHOD**, permitiendo seleccionar matriz y métodos por cada muestra individual.

---

## PARTE 1: Matrices de ensayo

### Qué es una matriz

Una matriz representa un **tipo de muestra** o **medio de ensayo** que el laboratorio analiza. Define los parámetros a determinar, los métodos aplicables y las condiciones de la toma de muestra.

### Estructura de una matriz

```
Matriz: "AGUA POTABLE" (AP-001) v1
+-- Parametros (que se analiza)
|   +-- 1. PH -- Metodo: APHA 4500-H+ B -- Unidad: - -- Rango: 6.5 - 8.5
|   +-- 2. TURBIDEZ -- Metodo: APHA 2130 B -- Unidad: NTU -- Max: 1.0
|   +-- 3. CLORO LIBRE -- Metodo: APHA 4500-Cl G -- Unidad: mg/L -- Rango: 0.2 - 1.0
|   +-- 4. CONDUCTIVIDAD -- Metodo: APHA 2510 B -- Unidad: uS/cm -- Max: 1500
|   +-- 5. COLIFORMES TOTALES -- Metodo: APHA 9221 B -- Unidad: NMP/100mL -- Max: 1.1
|   +-- 6. E. COLI -- Metodo: APHA 9221 F -- Unidad: NMP/100mL -- EQ: 0
+-- Condiciones (como se tomo la muestra)
    +-- 1. PUNTO DE MUESTREO -- Tipo: TEXT
    +-- 2. TEMPERATURA IN SITU -- Tipo: NUMBER -- Unidad: C
    +-- 3. CLORO RESIDUAL IN SITU -- Tipo: NUMBER -- Unidad: mg/L
    +-- 4. ASPECTO -- Tipo: DROPDOWN -- Opciones: CLARO, TURBIO, COLOREADO
```

### Propiedades de una matriz

| Campo | Descripción |
|-------|-------------|
| **Nombre** | Nombre de la matriz (ej: AGUA POTABLE, SUELO AGRÍCOLA, EFLUENTE INDUSTRIAL) |
| **Código** | Código identificador (opcional, ej: AP-001) |
| **Descripción** | Descripción del alcance de la matriz |
| **Versión** | Se incrementa automáticamente al crear nuevas versiones |
| **Estado** | DRAFT, IN_REVIEW, ACTIVE (circuito de aprobación) |
| **isActive** | Indica si la matriz esta vigente |

### Parámetros (MatrixParameter)

Los parámetros definen **que se analiza** en la matriz. Cada parámetro tiene:

| Campo | Descripción |
|-------|-------------|
| **Nombre** | Nombre del parámetro analítico (ej: PH, TURBIDEZ, DBO5) |
| **Método** | Método analítico aplicable (ej: APHA 4500-H+ B) |
| **Unidad** | Unidad de medida del resultado (ej: mg/L, NTU, UFC/100mL) |
| **Valor mínimo** | Límite inferior aceptable (opcional) |
| **Valor máximo** | Límite superior aceptable (opcional) |
| **Orden** | Posición en la lista de parámetros |

Los parámetros se usan para:
- Generar los campos de resultados en la página de detalle de muestra
- Evaluar automáticamente si los resultados están dentro de los límites aceptables
- Determinar los **parámetros efectivos** de cada muestra según los métodos seleccionados

### Condiciones (MatrixCondition)

Las condiciones definen **campos dinámicos** para registrar las condiciones de la toma de muestra. Se completan en la página de detalle de cada muestra.

| Campo | Descripción |
|-------|-------------|
| **Label** | Nombre del campo (ej: PUNTO DE MUESTREO, TEMPERATURA IN SITU) |
| **Tipo de campo** | Tipo de dato: TEXT, NUMBER, DROPDOWN |
| **Unidad** | Unidad de medida (opcional, ej: C, m, L/s) |
| **Opciones** | Lista de opciones predefinidas (solo para tipo DROPDOWN) |
| **Orden** | Posición en el formulario |

**Ejemplo: Condiciones para "AGUA RESIDUAL INDUSTRIAL"**

| Condición | Tipo | Unidad | Opciones |
|-----------|------|--------|----------|
| PUNTO DE MUESTREO | TEXT | - | - |
| TEMPERATURA IN SITU | NUMBER | C | - |
| PROFUNDIDAD | NUMBER | m | - |
| CAUDAL | NUMBER | L/s | - |
| TIPO DE MUESTRA | DROPDOWN | - | SIMPLE, COMPUESTA |
| COLOR APARENTE | DROPDOWN | - | INCOLORO, AMARILLO, VERDE, MARRÓN, NEGRO |
| OLOR | DROPDOWN | - | INODORO, SULFUROSO, QUÍMICO, PUTREFACTO |

### Versionado de matrices

El versionado de matrices funciona igual que el de recetas:

- **Edición de matrices en DRAFT**: se edita in-place, sin crear nueva versión
- **Edición de matrices ACTIVE**: se crea automáticamente una nueva versión (v2, v3...) en DRAFT. La versión anterior se desactiva.

```
AP-001 v1 (ACTIVE) ----> Se edita ----> AP-001 v1 (isActive=false)
                                         AP-001 v2 (DRAFT, isActive=true)
                                             |
                                         Aprobacion ----> AP-001 v2 (ACTIVE)
```

Las muestras existentes conservan la referencia a la versión de la matriz con la que fueron creadas.

### Circuito de aprobación

Las matrices pasan por el mismo circuito de aprobación que documentos, registros y recetas:

```
DRAFT ----> IN_REVIEW ----> ACTIVE
```

Ver [09 - Circuito de Aprobación](./09-circuito-aprobación.md).

### Crear una matriz

1. Ir a **Matrices** en el menú lateral
2. Click en **Nueva matriz**
3. Completar nombre, código (opcional) y descripción
4. Agregar **parámetros** con sus métodos, unidades y límites
5. Agregar **condiciones** de muestreo con sus tipos de campo
6. Click en **Crear matriz**
7. La matriz se crea en estado DRAFT
8. Enviar a aprobación para que los técnicos puedan usarla

---

## PARTE 2: Métodos analíticos (OrgMethod)

### Qué es un método analítico

Un método analítico (OrgMethod) es una entrada en el **catálogo de métodos** de la organización. Representa un procedimiento normalizado o propio para determinar un parámetro específico en un tipo de muestra.

### Tipos de métodos

| Tipo | Descripción |
|------|-------------|
| **Global** | Métodos normativos precargados en el sistema (ej: normas APHA para análisis de aguas). Disponibles para todas las organizaciones. No se pueden editar. |
| **De organización** | Métodos propios creados por la organización (métodos internos, adaptaciones, etc.). Solo visibles dentro de la organización. |

### Propiedades de un método

| Campo | Descripción |
|-------|-------------|
| **Código** | Código del método (ej: APHA 4500-H+ B, MET-INT-001). Único por organización. |
| **Nombre** | Nombre descriptivo (ej: DETERMINACIÓN DE PH - MÉTODO ELECTROMÉTRICO) |
| **Parámetro** | Parámetro que determina (ej: PH, TURBIDEZ, DBO5) |
| **Unidad** | Unidad de medida del resultado (ej: mg/L, NTU) |
| **Valor mínimo por defecto** | Límite inferior sugerido (opcional) |
| **Valor máximo por defecto** | Límite superior sugerido (opcional) |
| **isGlobal** | Indica si es un método global del sistema |
| **Referencia fuente** | Norma o documento de origen (ej: "Standard Methods 24th Ed.") |

### Métodos globales precargados

El sistema incluye métodos globales precargados basados en estándares internacionales, como los métodos APHA (American Public Health Association) para análisis de aguas. Estos métodos:

- Están disponibles para todas las organizaciones
- No se pueden editar ni eliminar
- Sirven como referencia para los parámetros de las matrices
- Incluyen códigos, nombres, parámetros, unidades y límites por defecto

**Ejemplo de métodos globales APHA:**

| Código | Nombre | Parámetro | Unidad | Rango |
|--------|--------|-----------|--------|-------|
| APHA 4500-H+ B | Determinación de pH | PH | - | 6.5 - 8.5 |
| APHA 2130 B | Turbidez - Nefelométrico | TURBIDEZ | NTU | 0 - 1.0 |
| APHA 4500-Cl G | Cloro residual - DPD | CLORO LIBRE | mg/L | 0.2 - 1.0 |
| APHA 2510 B | Conductividad | CONDUCTIVIDAD | uS/cm | 0 - 1500 |
| APHA 9221 B | Coliformes totales - NMP | COLIFORMES TOTALES | NMP/100mL | 0 - 1.1 |
| APHA 9221 F | E. coli - NMP | E. COLI | NMP/100mL | 0 |
| APHA 5210 B | DBO5 | DBO5 | mg/L | - |
| APHA 5220 D | DQO - Colorimétrico | DQO | mg/L | - |

### Crear un método propio

1. Ir a **Métodos** en el menú lateral
2. Click en **Nuevo método**
3. Completar:
   - **Código**: código único (ej: MET-INT-001)
   - **Nombre**: nombre descriptivo
   - **Parámetro**: parámetro que determina
   - **Unidad**: unidad de medida
   - **Límites por defecto**: valores mínimo y máximo sugeridos (opcional)
   - **Referencia**: norma o documento de origen
4. Click en **Crear método**

**Ejemplo de métodos propios:**

| Código | Nombre | Parámetro | Referencia |
|--------|--------|-----------|------------|
| MET-INT-001 | Determinación de nitrógeno total - Kjeldahl | NITRÓGENO TOTAL | POE-LAB-015 |
| MET-INT-002 | Granulometría por tamizado | DISTRIBUCIÓN GRANULOMÉTRICA | IRAM 1505 |
| MET-INT-003 | Contenido de humedad en fertilizantes | HUMEDAD | POE-LAB-022 |

---

## Integración con muestras

Las matrices y los métodos se integran con el módulo de muestras a través del campo **MATRIX_METHOD**:

1. Al crear una muestra, el operador selecciona la **matriz** en el campo MATRIX_METHOD
2. Luego selecciona los **métodos** a aplicar (todos o individuales)
3. El sistema determina los **parámetros efectivos** según la selección
4. En la página de detalle de la muestra:
   - Se muestran las **condiciones** de la matriz para completar
   - Se muestran los **parámetros efectivos** para cargar resultados

```
Muestra M-2026-001
  Matriz: AGUA POTABLE (AP-001 v1)
  Metodos seleccionados: APHA 4500-H+ B, APHA 2130 B, APHA 4500-Cl G
  
  Condiciones (de la matriz):
    PUNTO DE MUESTREO: PLANTA NORTE - SALIDA
    TEMPERATURA IN SITU: 22.5 C
    CLORO RESIDUAL IN SITU: 0.3 mg/L
    ASPECTO: CLARO
  
  Parametros efectivos (de los metodos seleccionados):
    PH: 7.2 (6.5 - 8.5) --> PASA
    TURBIDEZ: 0.45 NTU (max 1.0) --> PASA
    CLORO LIBRE: 0.35 mg/L (0.2 - 1.0) --> PASA
```

Ver [07 - Muestras](./07-muestras.md) para el flujo completo de trabajo con muestras.

---

## Ejemplos por industria

### Laboratorio de aguas

```
Matriz: AGUA RESIDUAL INDUSTRIAL (ARI-001)
Parametros:
  - DBO5 (APHA 5210 B) -- mg/L -- max: 50
  - DQO (APHA 5220 D) -- mg/L -- max: 250
  - SST (APHA 2540 D) -- mg/L -- max: 60
  - ACEITES Y GRASAS (APHA 5520 B) -- mg/L -- max: 50
  - PH (APHA 4500-H+ B) -- rango: 6.0 - 9.0
Condiciones:
  - PUNTO DE DESCARGA (TEXT)
  - CAUDAL (NUMBER, L/s)
  - TEMPERATURA (NUMBER, C)
  - COLOR APARENTE (DROPDOWN: INCOLORO, AMARILLO, MARRON, NEGRO)
```

### Laboratorio de suelos

```
Matriz: SUELO AGRICOLA (SA-001)
Parametros:
  - PH (MET-INT-010) -- rango: 5.5 - 7.5
  - CONDUCTIVIDAD ELECTRICA (MET-INT-011) -- dS/m -- max: 4.0
  - MATERIA ORGANICA (MET-INT-012) -- % -- min: 2.0
  - NITROGENO TOTAL (MET-INT-013) -- mg/kg
  - FOSFORO DISPONIBLE (MET-INT-014) -- mg/kg
  - POTASIO INTERCAMBIABLE (MET-INT-015) -- cmol/kg
Condiciones:
  - UBICACION GPS (TEXT)
  - PROFUNDIDAD DE MUESTREO (NUMBER, cm)
  - TIPO DE CULTIVO (TEXT)
  - FECHA DE ULTIMA FERTILIZACION (DATE)
```

### Laboratorio de materiales de construcción

```
Matriz: CONCRETO ENDURECIDO (CE-001)
Parametros:
  - RESISTENCIA A COMPRESION 7D (MET-INT-020) -- MPa -- min: 20
  - RESISTENCIA A COMPRESION 28D (MET-INT-021) -- MPa -- min: 30
  - DENSIDAD (MET-INT-022) -- kg/m3 -- rango: 2300 - 2500
Condiciones:
  - OBRA (TEXT)
  - ELEMENTO ESTRUCTURAL (DROPDOWN: COLUMNA, VIGA, LOSA, FUNDACION)
  - FECHA DE HORMIGONADO (DATE)
  - TEMPERATURA AMBIENTE (NUMBER, C)
  - PROVEEDOR DE CONCRETO (TEXT)
```

---

## Permisos

| Acción | Roles permitidos |
|--------|-----------------|
| Ver matrices | Todos |
| Crear/editar matrices | ADMIN, QUALITY_MANAGER |
| Enviar matriz a aprobación | ADMIN, QUALITY_MANAGER |
| Ver métodos | Todos |
| Crear/editar métodos propios | ADMIN, QUALITY_MANAGER |
| Ver métodos globales | Todos |
