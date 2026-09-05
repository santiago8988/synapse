# No Conformidades

## Qué es una no conformidad

Una no conformidad (NC) es un **desvío respecto a un requisito establecido**. Puede detectarse automáticamente (cuando una comparacion falla en una entrada) o registrarse manualmente por personal de calidad. El módulo permite gestionar el ciclo completo: detección, investigación, acciones correctivas y cierre.

## Detección automática

Cuando un campo de tipo **COMPARISON** falla al crear una entrada, el sistema crea automáticamente una NC vinculada:

```
Entrada: CONTROL DE PH - AGUA POTABLE
  Campo: PH MEDIDO = 9.1
  Comparacion: debe estar entre 6.5 y 8.5 --> FALLA
  --> Se crea NC: "VALOR FUERA DE RANGO: PH MEDIDO (9.1)"
       Vinculada a: entrada + campo que fallo
```

La NC queda vinculada a la entrada y al campo específico que fallo, proporcionando trazabilidad completa desde el dato hasta la acción correctiva.

### Ejemplos de detección automática

| Registro | Campo | Valor | Criterio | Resultado |
|----------|-------|-------|----------|-----------|
| Control de pH | PH MEDIDO | 9.1 | BETWEEN 6.5 - 8.5 | NC creada |
| Verificación de balanza | ERROR RELATIVO | 6.2% | LTE 5% | NC creada |
| Control de turbidez | TURBIDEZ | 0.8 NTU | LT 1 NTU | Sin NC (PASA) |
| Control microbiológico | COLIFORMES | 5 UFC/100mL | EQ 0 | NC creada |
| Control de temperatura | TEMP. AUTOCLAVE | 119 C | GTE 121 | NC creada |

## Ciclo de vida

```
OPEN ----> IN_PROGRESS ----> RESOLVED ----> CLOSED
```

| Estado | Significado |
|--------|-------------|
| **OPEN** | NC detectada, pendiente de atención |
| **IN_PROGRESS** | Se están ejecutando acciones correctivas |
| **RESOLVED** | Acciones completadas, pendiente de verificación y cierre |
| **CLOSED** | NC cerrada definitivamente |

## Propiedades de una NC

| Campo | Descripción |
|-------|-------------|
| **Título** | Descripción breve del desvío |
| **Descripción** | Detalle completo de la no conformidad |
| **Estado** | OPEN, IN_PROGRESS, RESOLVED, CLOSED |
| **Entrada vinculada** | Referencia a la entrada donde se detectó (si aplica) |
| **Campo vinculado** | Campo específico que fallo (si es automática) |
| **Detectada el** | Fecha y hora de detección |
| **Resuelta el** | Fecha y hora de resolución |
| **Creada por** | Usuario que la registro (o "sistema" si es automática) |
| **Asignada a** | Responsable de gestionar la NC |

## Acciones correctivas

Cada NC puede tener múltiples **acciones correctivas** asociadas:

| Campo | Descripción |
|-------|-------------|
| **Descripción** | Que acción se va a ejecutar para corregir el desvío |
| **Fecha límite** | Cuando debe estar completada la acción |
| **Completada el** | Fecha en que efectivamente se completo |
| **Creada por** | Usuario que definió la acción |

### Flujo tipico de gestión

1. Se detecta la NC (automática o manualmente) --> estado: **OPEN**
2. El responsable de calidad evalúa la NC y define acciones correctivas con fechas límite
3. Se cambia el estado a **IN_PROGRESS**
4. Los responsables ejecutan las acciones correctivas
5. Se marcan las acciones como completadas (con fecha)
6. Se cambia el estado a **RESOLVED**
7. Se verifica la eficacia de las acciones
8. Se cierra definitivamente --> estado: **CLOSED**

### Ejemplo: NC por pH fuera de rango

```
NC: "VALOR FUERA DE RANGO: PH MEDIDO (9.1)"
Estado: IN_PROGRESS
Entrada: CONTROL DE PH - POZO SUR, 2026-04-02

Acciones correctivas:
  1. "VERIFICAR CALIBRACION DEL PHMETRO PH-002"
     Fecha limite: 2026-04-03
     Completada: 2026-04-03

  2. "REPETIR MUESTREO EN POZO SUR"
     Fecha limite: 2026-04-04
     Completada: 2026-04-04

  3. "INVESTIGAR FUENTE DE CONTAMINACION ALCALINA"
     Fecha limite: 2026-04-10
     Completada: (pendiente)
```

## Crear una NC manualmente

1. Ir a **No Conformidades** en el menú lateral
2. Click en **Nueva NC**
3. Completar:
   - **Título**: descripción breve del desvío
   - **Descripción**: detalle completo
   - **Entrada vinculada** (opcional): si la NC se relaciona con una entrada existente
   - **Responsable asignado** (opcional): usuario que gestionara la NC

Ejemplos de NC manuales:
- Procedimiento no seguido durante auditoría interna
- Documento vencido detectado en revisión
- Equipo utilizado sin calibración vigente
- Desviación de temperatura en cámara de almacenamiento

## Dashboard

El dashboard muestra indicadores de no conformidades:

- Cantidad de NCs **abiertas** (OPEN)
- Cantidad de NCs **en progreso** (IN_PROGRESS)
- Total de NCs pendientes de cierre (OPEN + IN_PROGRESS + RESOLVED)
- Acciones correctivas con fecha límite vencida

## Permisos

| Acción | Roles permitidos |
|--------|-----------------|
| Ver NCs | Todos |
| Crear NCs manualmente | ADMIN, QUALITY_MANAGER |
| Cambiar estado | ADMIN, QUALITY_MANAGER |
| Agregar acciones correctivas | ADMIN, QUALITY_MANAGER |
| Completar acciones correctivas | ADMIN, QUALITY_MANAGER |
