# 12 -- Matrices y Metodos Analiticos

## Introduccion

Este modulo gestiona dos componentes fundamentales del trabajo analitico de laboratorio:

1. **Matrices de ensayo**: definen que se analiza (agua potable, suelo, alimentos, etc.), con que parametros y bajo que condiciones de muestreo
2. **Metodos analiticos** (OrgMethod): catalogo de metodos normativos y propios que se aplican a los parametros de las matrices

Ambos componentes se integran con el modulo de muestras a traves del campo **MATRIX_METHOD**, permitiendo seleccionar matriz y metodos por cada muestra individual.

---

## PARTE 1: Matrices de ensayo

### Que es una matriz

Una matriz representa un **tipo de muestra** o **medio de ensayo** que el laboratorio analiza. Define los parametros a determinar, los metodos aplicables y las condiciones de la toma de muestra.

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

| Campo | Descripcion |
|-------|-------------|
| **Nombre** | Nombre de la matriz (ej: AGUA POTABLE, SUELO AGRICOLA, EFLUENTE INDUSTRIAL) |
| **Codigo** | Codigo identificador (opcional, ej: AP-001) |
| **Descripcion** | Descripcion del alcance de la matriz |
| **Version** | Se incrementa automaticamente al crear nuevas versiones |
| **Estado** | DRAFT, IN_REVIEW, ACTIVE (circuito de aprobacion) |
| **isActive** | Indica si la matriz esta vigente |

### Parametros (MatrixParameter)

Los parametros definen **que se analiza** en la matriz. Cada parametro tiene:

| Campo | Descripcion |
|-------|-------------|
| **Nombre** | Nombre del parametro analitico (ej: PH, TURBIDEZ, DBO5) |
| **Metodo** | Metodo analitico aplicable (ej: APHA 4500-H+ B) |
| **Unidad** | Unidad de medida del resultado (ej: mg/L, NTU, UFC/100mL) |
| **Valor minimo** | Limite inferior aceptable (opcional) |
| **Valor maximo** | Limite superior aceptable (opcional) |
| **Orden** | Posicion en la lista de parametros |

Los parametros se usan para:
- Generar los campos de resultados en la pagina de detalle de muestra
- Evaluar automaticamente si los resultados estan dentro de los limites aceptables
- Determinar los **parametros efectivos** de cada muestra segun los metodos seleccionados

### Condiciones (MatrixCondition)

Las condiciones definen **campos dinamicos** para registrar las condiciones de la toma de muestra. Se completan en la pagina de detalle de cada muestra.

| Campo | Descripcion |
|-------|-------------|
| **Label** | Nombre del campo (ej: PUNTO DE MUESTREO, TEMPERATURA IN SITU) |
| **Tipo de campo** | Tipo de dato: TEXT, NUMBER, DROPDOWN |
| **Unidad** | Unidad de medida (opcional, ej: C, m, L/s) |
| **Opciones** | Lista de opciones predefinidas (solo para tipo DROPDOWN) |
| **Orden** | Posicion en el formulario |

**Ejemplo: Condiciones para "AGUA RESIDUAL INDUSTRIAL"**

| Condicion | Tipo | Unidad | Opciones |
|-----------|------|--------|----------|
| PUNTO DE MUESTREO | TEXT | - | - |
| TEMPERATURA IN SITU | NUMBER | C | - |
| PROFUNDIDAD | NUMBER | m | - |
| CAUDAL | NUMBER | L/s | - |
| TIPO DE MUESTRA | DROPDOWN | - | SIMPLE, COMPUESTA |
| COLOR APARENTE | DROPDOWN | - | INCOLORO, AMARILLO, VERDE, MARRON, NEGRO |
| OLOR | DROPDOWN | - | INODORO, SULFUROSO, QUIMICO, PUTREFACTO |

### Versionado de matrices

El versionado de matrices funciona igual que el de recetas:

- **Edicion de matrices en DRAFT**: se edita in-place, sin crear nueva version
- **Edicion de matrices ACTIVE**: se crea automaticamente una nueva version (v2, v3...) en DRAFT. La version anterior se desactiva.

```
AP-001 v1 (ACTIVE) ----> Se edita ----> AP-001 v1 (isActive=false)
                                         AP-001 v2 (DRAFT, isActive=true)
                                             |
                                         Aprobacion ----> AP-001 v2 (ACTIVE)
```

Las muestras existentes conservan la referencia a la version de la matriz con la que fueron creadas.

### Circuito de aprobacion

Las matrices pasan por el mismo circuito de aprobacion que documentos, registros y recetas:

```
DRAFT ----> IN_REVIEW ----> ACTIVE
```

Ver [09 - Circuito de Aprobacion](./09-circuito-aprobacion.md).

### Crear una matriz

1. Ir a **Matrices** en el menu lateral
2. Click en **Nueva matriz**
3. Completar nombre, codigo (opcional) y descripcion
4. Agregar **parametros** con sus metodos, unidades y limites
5. Agregar **condiciones** de muestreo con sus tipos de campo
6. Click en **Crear matriz**
7. La matriz se crea en estado DRAFT
8. Enviar a aprobacion para que los tecnicos puedan usarla

---

## PARTE 2: Metodos analiticos (OrgMethod)

### Que es un metodo analitico

Un metodo analitico (OrgMethod) es una entrada en el **catalogo de metodos** de la organizacion. Representa un procedimiento normalizado o propio para determinar un parametro especifico en un tipo de muestra.

### Tipos de metodos

| Tipo | Descripcion |
|------|-------------|
| **Global** | Metodos normativos precargados en el sistema (ej: normas APHA para analisis de aguas). Disponibles para todas las organizaciones. No se pueden editar. |
| **De organizacion** | Metodos propios creados por la organizacion (metodos internos, adaptaciones, etc.). Solo visibles dentro de la organizacion. |

### Propiedades de un metodo

| Campo | Descripcion |
|-------|-------------|
| **Codigo** | Codigo del metodo (ej: APHA 4500-H+ B, MET-INT-001). Unico por organizacion. |
| **Nombre** | Nombre descriptivo (ej: DETERMINACION DE PH - METODO ELECTROMETRICO) |
| **Parametro** | Parametro que determina (ej: PH, TURBIDEZ, DBO5) |
| **Unidad** | Unidad de medida del resultado (ej: mg/L, NTU) |
| **Valor minimo por defecto** | Limite inferior sugerido (opcional) |
| **Valor maximo por defecto** | Limite superior sugerido (opcional) |
| **isGlobal** | Indica si es un metodo global del sistema |
| **Referencia fuente** | Norma o documento de origen (ej: "Standard Methods 24th Ed.") |

### Metodos globales precargados

El sistema incluye metodos globales precargados basados en estandares internacionales, como los metodos APHA (American Public Health Association) para analisis de aguas. Estos metodos:

- Estan disponibles para todas las organizaciones
- No se pueden editar ni eliminar
- Sirven como referencia para los parametros de las matrices
- Incluyen codigos, nombres, parametros, unidades y limites por defecto

**Ejemplo de metodos globales APHA:**

| Codigo | Nombre | Parametro | Unidad | Rango |
|--------|--------|-----------|--------|-------|
| APHA 4500-H+ B | Determinacion de pH | PH | - | 6.5 - 8.5 |
| APHA 2130 B | Turbidez - Nefelometrico | TURBIDEZ | NTU | 0 - 1.0 |
| APHA 4500-Cl G | Cloro residual - DPD | CLORO LIBRE | mg/L | 0.2 - 1.0 |
| APHA 2510 B | Conductividad | CONDUCTIVIDAD | uS/cm | 0 - 1500 |
| APHA 9221 B | Coliformes totales - NMP | COLIFORMES TOTALES | NMP/100mL | 0 - 1.1 |
| APHA 9221 F | E. coli - NMP | E. COLI | NMP/100mL | 0 |
| APHA 5210 B | DBO5 | DBO5 | mg/L | - |
| APHA 5220 D | DQO - Colorimetrico | DQO | mg/L | - |

### Crear un metodo propio

1. Ir a **Metodos** en el menu lateral
2. Click en **Nuevo metodo**
3. Completar:
   - **Codigo**: codigo unico (ej: MET-INT-001)
   - **Nombre**: nombre descriptivo
   - **Parametro**: parametro que determina
   - **Unidad**: unidad de medida
   - **Limites por defecto**: valores minimo y maximo sugeridos (opcional)
   - **Referencia**: norma o documento de origen
4. Click en **Crear metodo**

**Ejemplo de metodos propios:**

| Codigo | Nombre | Parametro | Referencia |
|--------|--------|-----------|------------|
| MET-INT-001 | Determinacion de nitrogeno total - Kjeldahl | NITROGENO TOTAL | POE-LAB-015 |
| MET-INT-002 | Granulometria por tamizado | DISTRIBUCION GRANULOMETRICA | IRAM 1505 |
| MET-INT-003 | Contenido de humedad en fertilizantes | HUMEDAD | POE-LAB-022 |

---

## Integracion con muestras

Las matrices y los metodos se integran con el modulo de muestras a traves del campo **MATRIX_METHOD**:

1. Al crear una muestra, el operador selecciona la **matriz** en el campo MATRIX_METHOD
2. Luego selecciona los **metodos** a aplicar (todos o individuales)
3. El sistema determina los **parametros efectivos** segun la seleccion
4. En la pagina de detalle de la muestra:
   - Se muestran las **condiciones** de la matriz para completar
   - Se muestran los **parametros efectivos** para cargar resultados

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

### Laboratorio de materiales de construccion

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

| Accion | Roles permitidos |
|--------|-----------------|
| Ver matrices | Todos |
| Crear/editar matrices | ADMIN, QUALITY_MANAGER |
| Enviar matriz a aprobacion | ADMIN, QUALITY_MANAGER |
| Ver metodos | Todos |
| Crear/editar metodos propios | ADMIN, QUALITY_MANAGER |
| Ver metodos globales | Todos |
