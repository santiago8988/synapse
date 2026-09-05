# Calibraciones

Synapse distingue dos cosas que suelen confundirse:

- **Calibración externa** — la hace un laboratorio acreditado y termina en un
  certificado. Vive en **Calibración Ext.**, junto al instrumento.
- **Verificación interna** — la hace tu propio personal siguiendo un
  procedimiento propio, con una periodicidad definida. Vive en **Calibraciones**
  y usa las **Plantillas de calibración**.

Las dos alimentan el mismo objetivo de ISO 17025 §6.4: demostrar que el equipo
estaba en condiciones cuando se usó.

## Certificados de calibración externa

Desde el detalle del instrumento se suben los PDF de los certificados, con
fecha, resultado (**conforme** o **no conforme**) y notas.

El historial de certificados es **inalterable**: se agregan, nunca se editan ni
se borran. Un certificado que se pudiera reemplazar no probaría nada, que es
justamente lo que un auditor viene a verificar.

Si un certificado da **no conforme**, el instrumento debería pasar a reparación
o baja. El sistema no lo hace solo —es una decisión técnica, no administrativa—
pero el estado queda visible junto al certificado.

## Plantillas de calibración

Una plantilla describe **cómo se verifica** un tipo de equipo. Se define una vez
y se reutiliza en cada verificación.

Una plantilla tiene:

- **Pruebas** — cada aspecto a verificar (repetibilidad, excentricidad, linealidad).
- **Puntos** por prueba — las cargas o valores a los que se mide, con su unidad.
- **Lecturas por punto** — cuántas mediciones se toman en cada uno. Por defecto 3.
- **Tolerancia** y su unidad — el límite aceptable.
- **Fórmula de error** y **criterio** — cómo se calcula la desviación y contra
  qué se compara para decidir si pasa.
- **Periodicidad** y **aviso previo** — cada cuántos días toca, y con cuánta
  anticipación avisar.
- **Manual de verificación** (PDF) — el procedimiento que el técnico consulta
  mientras ejecuta. A diferencia de los certificados, este archivo sí se
  reemplaza: hay una sola versión vigente.

```
Plantilla "Verificación de balanza analítica"
+-- Prueba: Repetibilidad
|   +-- Punto: 50 g    (3 lecturas)
|   +-- Punto: 200 g   (3 lecturas)
+-- Prueba: Excentricidad
    +-- Punto: 100 g, centro
    +-- Punto: 100 g, frente
    ...
```

Las plantillas tienen versión y estado, igual que los registros: una vez en uso,
modificarlas genera una versión nueva y las verificaciones ya hechas siguen
apuntando a la versión con la que se ejecutaron. Sin eso, cambiar una tolerancia
hoy reescribiría el significado de un resultado del año pasado.

## Ejecutar una verificación

Desde **Calibraciones** se inicia una verificación eligiendo el instrumento y la
plantilla. El sistema despliega las pruebas y los puntos, y el técnico carga las
lecturas.

Estados de la verificación:

| Estado | Significado |
|--------|-------------|
| **IN_PROGRESS** | En curso. Se pueden seguir cargando lecturas. |
| **COMPLETED** | Terminada, con su resultado calculado. |
| **APPROVED** | Revisada y aprobada por quien corresponde. |
| **REJECTED** | Rechazada: el equipo no cumple. |

## Estados del instrumento

| Estado | Se puede usar en ensayos |
|--------|--------------------------|
| **ACTIVE** | Sí |
| **IN_CALIBRATION** | No |
| **IN_REPAIR** | No |
| **DECOMMISSIONED** | No |

Al cargar una entrada que usa un instrumento, la app muestra su estado actual y
no permite seleccionar uno que esté en calibración, en reparación o dado de
baja. Es la barrera que evita el hallazgo más común de auditoría: un resultado
firmado con un equipo que en esa fecha no estaba habilitado.

Cada cambio de estado queda registrado de forma inalterable, con el motivo.

## Vencimientos

Con la periodicidad definida en la plantilla, el sistema calcula la próxima
fecha y avisa con la anticipación configurada. El dashboard muestra los
instrumentos con calibración vencida o por vencer.
